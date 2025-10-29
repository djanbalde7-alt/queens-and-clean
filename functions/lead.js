// functions/lead.js
// Version: v2 (time_slot & special_instructions optionnels)

import fetch from 'node-fetch';
import { quoteEngine } from '../services/quoteEngine.js';
import { sendQuoteEmail } from '../lib/sendgrid.js';
import { signAcceptToken } from '../lib/token.js';

const HS_BASE   = process.env.HUBSPOT_API_URL || 'https://api.hubapi.com';
const HS_TOKEN  = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const ACCEPT_SECRET = process.env.ACCEPT_TOKEN_SECRET || 'dev_secret';

// Pipelines / stages (env)
const PIPELINE_ID         = process.env.HUBSPOT_PIPELINE_ID;
const STAGE_QUOTE_SENT    = process.env.HUBSPOT_STAGE_QUOTE_SENT;

// Accept URL base (env ou fallback local)
const ACCEPT_BASE = (process.env.SENDGRID_ACCEPT_URL_BASE || `${process.env.SITE_URL || 'http://localhost:8888'}/api/accept`);

const headersHS = {
  'Authorization': `Bearer ${HS_TOKEN}`,
  'Content-Type': 'application/json',
};

// ---------- utils http ----------
const badReq = (msg='Bad Request') => ({
  statusCode: 400,
  body: JSON.stringify({ ok:false, error: msg }),
});

const ok = (obj={}) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ok:true, ...obj }),
});

// ---------- HubSpot helpers ----------
async function findContactByEmail(email) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: headersHS,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      properties: ['email','firstname','lastname','phone'],
      limit: 1
    })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot search: ${res.status} ${j.message || ''}`);
  const results = j.results || [];
  return results.length ? results[0] : null;
}

async function createContact({ email, firstname, lastname, phone }) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: headersHS,
    body: JSON.stringify({ properties: { email, firstname, lastname, phone } })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot create contact: ${res.status} ${j.message || ''}`);
  return { id: j.id };
}

async function updateContact(contactId, { email, firstname, lastname, phone }) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    headers: headersHS,
    body: JSON.stringify({ properties: { email, firstname, lastname, phone } })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot update contact: ${res.status} ${j.message || ''}`);
  return { id: j.id || contactId };
}

async function upsertContact({ email, firstname, lastname, phone }) {
  const existing = await findContactByEmail(email);
  if (existing?.id) {
    return updateContact(existing.id, { email, firstname, lastname, phone });
  }
  return createContact({ email, firstname, lastname, phone });
}

async function createDeal(properties) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/deals`, {
    method: 'POST',
    headers: headersHS,
    body: JSON.stringify({ properties })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot create deal: ${res.status} ${j.message || ''}`);
  return { id: j.id };
}

async function associateDealToContact(dealId, contactId) {
  const res = await fetch(`${HS_BASE}/crm/v4/objects/deals/${dealId}/associations/contacts/${contactId}`, {
    method: 'PUT',
    headers: headersHS,
    body: JSON.stringify({ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 })
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`hubspot assoc: ${res.status} ${j.message || ''}`);
  }
}

async function updateDealStage(dealId, pipelineId, stageId) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    headers: headersHS,
    body: JSON.stringify({ properties: { pipeline: pipelineId, dealstage: stageId } })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot stage: ${res.status} ${j.message || ''}`);
}

// ---------- helpers locaux ----------
const whitelist = {
  service_type:       ['standard', 'deep'],
  number_of_bedrooms: ['studio', 'p_1br', 'p_2br', 'p_3br', 'p_4br'],
};

function splitName(fullname) {
  const parts = String(fullname || '').trim().split(/\s+/);
  const firstname = parts.shift() || '';
  const lastname  = parts.join(' ') || '';
  return { firstname, lastname };
}

// ---------- handler ----------
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return badReq('POST only');

  try {
    const body = JSON.parse(event.body || '{}');

    // 1) validations (sans time_slot / special_instructions)
    const required = [
      'fullname', 'email', 'phone',
      'service_address', 'service_type',
      'number_of_bedrooms', 'preferred_date'
    ];
    for (const k of required) {
      if (!(k in body) || String(body[k]).trim() === '') {
        return badReq(`Missing: ${k}`);
      }
    }
    if (!whitelist.service_type.includes(body.service_type)) {
      return badReq('Invalid service_type');
    }
    if (!whitelist.number_of_bedrooms.includes(body.number_of_bedrooms)) {
      return badReq('Invalid number_of_bedrooms');
    }

    // 2) calcul du devis
    const { amount, currency } = quoteEngine({
      service_type: body.service_type,
      number_of_bedrooms: body.number_of_bedrooms
    });

    // 3) contact
    const { firstname, lastname } = splitName(body.fullname);
    const contact = await upsertContact({
      email: body.email,
      firstname,
      lastname,
      phone: body.phone
    });

    // 4) deal (avec champs optionnels ajoutés seulement s’ils existent)
    const dealProps = {
      dealname: `Quote ${firstname} ${lastname} · ${body.service_type}`,
      amount: amount,
      pipeline: PIPELINE_ID,
      dealstage: STAGE_QUOTE_SENT,
      service_address: body.service_address,
      service_type: body.service_type,
      number_of_bedrooms: body.number_of_bedrooms,
      preferred_date: body.preferred_date,
    };
    if (body.time_slot)           dealProps.time_slot = body.time_slot;
    if (body.special_instructions) dealProps.special_instructions = body.special_instructions;

    const deal = await createDeal(dealProps);
    await associateDealToContact(deal.id, contact.id);

    // 5) (sécurité) s’assurer du stage
    await updateDealStage(deal.id, PIPELINE_ID, STAGE_QUOTE_SENT);

    // 6) email SendGrid avec lien d’acceptation
    const currencySign = currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : currency);
    const total_formatted = `${currencySign}${amount.toFixed(2)}`;
    const date_label = body.preferred_date; // plus de time_slot concaténé

    // token signé
    const token = signAcceptToken({
      dealId: deal.id,
      ttlSec: 60 * 60 * 12, // 12h
      secret: ACCEPT_SECRET
    });
    const accept_url = `${ACCEPT_BASE}?d=${encodeURIComponent(deal.id)}&t=${encodeURIComponent(token)}`;

    await sendQuoteEmail({
      to: body.email,
      templateData: {
        full_name: `${firstname} ${lastname}`,
        service_type: body.service_type,
        bedrooms: body.number_of_bedrooms.replace('p_', '').toUpperCase(),
        address: body.service_address,
        date_label,
        total_formatted,
        accept_url
      }
    });

    return ok({ dealId: deal.id, contactId: contact.id });

  } catch (err) {
    console.error('[lead] error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok:false, error: String(err.message || err) })
    };
  }
};

// functions/lead.js

// ----- Imports (ESM) -----
import fetch from 'node-fetch';
import { quoteEngine } from '../services/quoteEngine.js';
import { sendQuoteEmail } from '../lib/sendgrid.js';
import { signAcceptToken } from '../lib/token.js';

// ----- Env & bases -----
const HS_BASE = process.env.HUBSPOT_API_URL || 'https://api.hubapi.com';
const HS_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const ACCEPT_SECRET = process.env.ACCEPT_TOKEN_SECRET || 'dev_secret';

const headersHS = {
  'Authorization': `Bearer ${HS_TOKEN}`,
  'Content-Type': 'application/json'
};

// ----- Utils réponse -----
const badReq = (msg = '') => ({ statusCode: 400, body: JSON.stringify({ ok: false, error: msg }) });
const ok     = (obj = {}) => ({ statusCode: 200, body: JSON.stringify({ ok: true, ...obj }) });

/* ---------------- HubSpot helpers ---------------- */

// 1) Chercher un contact par email
async function findContactByEmail(email) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: headersHS,
    body: JSON.stringify({
      filterGroups: [
        { filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }
      ],
      properties: ['email','firstname','lastname','phone'],
      limit: 1
    })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot search: ${res.status} ${j.message || ''}`);
  const results = j.results || [];
  return results.length ? results[0] : null;
}

// 2) Créer un contact
async function createContact({ email, firstname, lastname, phone }) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: headersHS,
    body: JSON.stringify({ properties: { email, firstname, lastname, phone } })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot create contact: ${res.status} ${j.message || ''}`);
  return { id: j.id || j?.id };
}

// 3) Mettre à jour un contact
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

// 4) Upsert contact
async function upsertContact({ email, firstname, lastname, phone }) {
  const existing = await findContactByEmail(email);
  if (existing?.id) {
    return updateContact(existing.id, { email, firstname, lastname, phone });
  }
  return createContact({ email, firstname, lastname, phone });
}

// 5) Créer un deal
async function createDeal(props) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/deals`, {
    method: 'POST',
    headers: headersHS,
    body: JSON.stringify({ properties: props })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot deal: ${res.status} ${j.message || ''}`);
  return { id: j.id };
}

// 6) Associer deal <> contact
async function associateDealToContact(dealId, contactId) {
  const res = await fetch(`${HS_BASE}/crm/v4/objects/deals/${dealId}/associations/contacts/${contactId}`, {
    method: 'PUT',
    headers: headersHS,
    body: JSON.stringify({
      associationCategory: 'HUBSPOT_DEFINED',
      associationTypeId: 3 // Deal->Contact
    })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`hubspot assoc: ${res.status} ${j.message || ''}`);
}

// 7) Mettre à jour le stage d’un deal
async function updateDealStage(dealId, pipelineId, stageId) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    headers: headersHS,
    body: JSON.stringify({ properties: { pipeline: pipelineId, dealstage: stageId } })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot stage: ${res.status} ${j.message || ''}`);
}

/* --------------- Validation & utils --------------- */

// ⚠️ On ne valide plus time_slot : on le retire du whitelist
const whitelist = {
  service_type: ['standard', 'deep'],
  number_of_bedrooms: ['studio', 'p_1br', 'p_2br', 'p_3br', 'p_4br']
};

function splitName(fullname) {
  const parts = String(fullname || '').trim().split(/\s+/);
  const firstname = parts.shift() || '';
  const lastname  = parts.join(' ') || '';
  return { firstname, lastname };
}

/* -------------------- Handler -------------------- */

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return badReq('POST only');

  try {
    const body = JSON.parse(event.body || '{}');

    // Champs requis (sans time_slot ni special_instructions)
    const req = ['fullname','email','phone','service_address','service_type','number_of_bedrooms','preferred_date'];
    for (const k of req) if (!body[k]) return badReq(`Missing: ${k}`);

    // Validations simples
    if (!whitelist.service_type.includes(body.service_type)) {
      return badReq('Invalid service_type');
    }
    if (!whitelist.number_of_bedrooms.includes(body.number_of_bedrooms)) {
      return badReq('Invalid number_of_bedrooms');
    }
    // ⛔️ plus de validation time_slot ici

    // 1) Calcul du devis
    const { amount, currency } = quoteEngine({
      service_type: body.service_type,
      number_of_bedrooms: body.number_of_bedrooms
    });

    // 2) Contact (upsert) + Deal + association
    const { firstname, lastname } = splitName(body.fullname);
    const contact = await upsertContact({ email: body.email, firstname, lastname, phone: body.phone });

    // Propriétés deal : on retire time_slot & special_instructions
    const dealProps = {
      dealname: `Quote ${firstname} ${lastname} - ${body.service_type}`,
      amount: amount,           // si tu as une propriété personnalisée, remplace ici
      pipeline: process.env.HUBSPOT_PIPELINE_ID,
      dealstage: process.env.HUBSPOT_STAGE_QUOTE_SENT,
      service_address: body.service_address,
      service_type: body.service_type,
      number_of_bedrooms: body.number_of_bedrooms,
      preferred_date: body.preferred_date
      // time_slot: supprimé
      // special_instructions: supprimé
    };

    const deal = await createDeal(dealProps);
    await associateDealToContact(deal.id, contact.id);

    // Confirmer le stage (au cas où)
    await updateDealStage(deal.id, process.env.HUBSPOT_PIPELINE_ID, process.env.HUBSPOT_STAGE_QUOTE_SENT);

    // 3) Email SendGrid (token signé)
    const currencySign = (currency === 'USD') ? '$' : (currency === 'EUR' ? '€' : currency);
    const total_formatted = `${currencySign}${amount.toFixed(2)}`;

    // 👉 La date affichée dans l'email : seulement la date, plus de créneau
    const date_label = body.preferred_date;

    const base = process.env.SENDGRID_ACCEPT_URL_BASE || `${process.env.SITE_URL || 'http://localhost:8888'}/api/accept`;
    const token = signAcceptToken({ dealId: deal.id, ttlSec: 60 * 60 * 12 }, ACCEPT_SECRET); // 12h
    const accept_url = `${base}?d=${encodeURIComponent(deal.id)}&t=${encodeURIComponent(token)}`;

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
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err.message || err) }) };
  }
};

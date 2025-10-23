import fetch from 'node-fetch';

const API = process.env.HUBSPOT_API_URL || 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const TIMEOUT = Number(process.env.API_TIMEOUT || 10000);

function hsHeaders(){
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };
}
function withTimeout(promise, ms=TIMEOUT){
  return Promise.race([promise, new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout')), ms))]);
}

/** CONTACTS **/
export async function createOrUpdateContact({ firstname, lastname, email, phone }){
  const url = `${API}/crm/v3/objects/contacts?hapikey=`;
  const payload = { properties: { firstname, lastname, email, phone } };
  const res = await withTimeout(fetch(url, { method:'POST', headers: hsHeaders(), body: JSON.stringify(payload) }));
  if (res.status === 409) {
    // Conflict → update by email search
    const existing = await findContactByEmail(email);
    if (existing) return existing;
  }
  if (!res.ok) {
    // try upsert via search + patch
    const existing = await findContactByEmail(email);
    if (existing) {
      await updateContact(existing.id, { firstname, lastname, phone });
      return existing;
    }
    throw new Error(`HubSpot contact error: ${res.status}`);
  }
  const data = await res.json();
  return { id: data.id };
}

async function findContactByEmail(email){
  const url = `${API}/crm/v3/objects/contacts/search`;
  const payload = {
    filterGroups: [{ filters: [{ propertyName:'email', operator:'EQ', value: email }] }],
    properties: ['email'],
    limit: 1
  };
  const res = await withTimeout(fetch(url, { method:'POST', headers: hsHeaders(), body: JSON.stringify(payload) }));
  if (!res.ok) return null;
  const data = await res.json();
  const r = (data.results||[])[0];
  return r ? { id: r.id } : null;
}

async function updateContact(id, props){
  const url = `${API}/crm/v3/objects/contacts/${id}`;
  const payload = { properties: props };
  const res = await withTimeout(fetch(url, { method:'PATCH', headers: hsHeaders(), body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error(`HubSpot update contact error: ${res.status}`);
}

/** DEALS **/
export async function createOrUpdateDeal(props){
  // Create a new deal every time for clarity (alternativement: search by address+email)
  const url = `${API}/crm/v3/objects/deals`;
  const payload = {
    properties: {
      ...props,
      pipeline: process.env.HUBSPOT_PIPELINE_ID,
      dealstage: process.env.HUBSPOT_STAGE_NEW
    }
  };
  const res = await withTimeout(fetch(url, { method:'POST', headers: hsHeaders(), body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error(`HubSpot create deal error: ${res.status}`);
  const data = await res.json();
  return { id: data.id };
}

export async function associateDealToContact(dealId, contactId){
  const url = `${API}/crm/v4/objects/deals/${dealId}/associations/contacts/${contactId}`;
  const payload = [{ associationCategory:'HUBSPOT_DEFINED', associationTypeId: 3 }]; // default "deal_to_contact"
  const res = await withTimeout(fetch(url, { method:'PUT', headers: hsHeaders(), body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error(`HubSpot association error: ${res.status}`);
}

export async function updateDealStage(dealId, pipelineId, stageId){
  const url = `${API}/crm/v3/objects/deals/${dealId}`;
  const payload = { properties: { pipeline: pipelineId, dealstage: stageId } };
  const res = await withTimeout(fetch(url, { method:'PATCH', headers: hsHeaders(), body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error(`HubSpot update deal error: ${res.status}`);
}

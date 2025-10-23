// functions/accept.js
import fetch from 'node-fetch';
import { verifyAcceptToken } from './lib/token.js';

const HS_BASE  = process.env.HUBSPOT_API_URL || 'https://api.hubapi.com';
const HS_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const ACCEPT_SECRET = process.env.ACCEPT_TOKEN_SECRET || 'dev_secret';

const headersHS = {
  'Authorization': `Bearer ${HS_TOKEN}`,
  'Content-Type': 'application/json'
};

async function updateDealStage(dealId, pipelineId, stageId) {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    headers: headersHS,
    body: JSON.stringify({ properties: { pipeline: pipelineId, dealstage: stageId } })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`hubspot stage: ${res.status} ${j.message || ''}`);
}

const html = (title, body) => `
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif; margin:0; color:#111}
  .wrap{max-width:560px;margin:0 auto;padding:32px 20px}
  .card{background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.08);padding:24px}
  h1{font-size:22px;margin:0 0 8px}
  p{line-height:1.6;margin:0 0 10px}
  .ok{color:#0a7d33}
  .err{color:#b00020}
</style></head><body>
<div class="wrap"><div class="card">${body}</div></div>
</body></html>`;

export const handler = async (event) => {
  try {
    const dealId = event.queryStringParameters?.d || '';
    const token  = event.queryStringParameters?.t || '';

    if (!dealId || !token) {
      return { statusCode: 400, headers: { 'Content-Type': 'text/html' },
        body: html('Invalid request', `<h1 class="err">Invalid request</h1><p>Missing parameters.</p>`) };
    }

    const v = verifyAcceptToken(token, ACCEPT_SECRET);
    if (!v.valid || v.payload?.dealId !== dealId) {
      return { statusCode: 400, headers: { 'Content-Type': 'text/html' },
        body: html('Invalid token', `<h1 class="err">Invalid token</h1><p>Please ask us for a new quote link.</p>`) };
    }

    // ok → update stage to ACCEPTED
    await updateDealStage(dealId, process.env.HUBSPOT_PIPELINE_ID, process.env.HUBSPOT_STAGE_ACCEPTED);

    return { statusCode: 200, headers: { 'Content-Type': 'text/html' },
      body: html('Quote accepted', `
        <h1 class="ok">Thank you — Quote accepted ✅</h1>
        <p>Your booking request has been confirmed. We’ll be in touch shortly to finalize the schedule.</p>
      `) };
  } catch (err) {
    console.error('[accept] error:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' },
      body: html('Server error', `<h1 class="err">Something went wrong</h1><p>Please try again later.</p>`) };
  }
};

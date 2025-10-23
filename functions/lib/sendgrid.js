// functions/lib/sendgrid.js
import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn('[sendgrid] Missing SENDGRID_API_KEY env var');
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// "true" -> bool
const flag = v => String(v || '').toLowerCase() === 'true';

/**
 * Envoie l’e-mail de devis via un Template dynamique SendGrid.
 * @param {{to:string, templateData:Object}} opts
 * @returns {Promise<boolean>}
 */
export async function sendQuoteEmail({ to, templateData }) {
  const sandbox = flag(process.env.SENDGRID_SANDBOX); // true en dev => pas de délivrance
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    templateId: process.env.SENDGRID_TEMPLATE_ID, // d-xxxxxxxx...
    dynamicTemplateData: templateData,
    mailSettings: { sandboxMode: { enable: sandbox } }
  };

  try {
    const [resp] = await sgMail.send(msg);
    console.log('[sendgrid] status:', resp?.statusCode, 'sandbox:', sandbox);
    return true;
  } catch (err) {
    console.error('[sendgrid] error:', err.response?.body || err.message);
    throw err;
  }
}

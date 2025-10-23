import sg from '@sendgrid/mail';
import { signToken } from './signer.js';

const FROM = process.env.SENDGRID_FROM_EMAIL;
const TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID;
const ACCEPT_BASE = process.env.SENDGRID_ACCEPT_URL_BASE || `${process.env.SITE_URL}/api/accept`;

sg.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendQuoteEmail({ to, full_name, service_type, bedrooms, address, date_label, total_formatted, dealId }){
  const token = signToken({ dealId });
  const accept_url = `${ACCEPT_BASE}?d=${encodeURIComponent(dealId)}&t=${encodeURIComponent(token)}`;

  const msg = {
    to,
    from: FROM,
    templateId: TEMPLATE_ID,
    dynamicTemplateData: {
      full_name,
      service_type,
      bedrooms,
      address,
      date_label,
      total_formatted,
      accept_url
    },
    mailSettings: {
      sandboxMode: { enable: process.env.NODE_ENV === 'development' ? true : false }
    }
  };
  await sg.send(msg);
}

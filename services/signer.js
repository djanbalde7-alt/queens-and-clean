import crypto from 'crypto';

const SECRET = process.env.ACCEPT_TOKEN_SECRET || 'dev_secret';

export function signToken({ dealId }){
  const data = `deal=${dealId}`;
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${dealId}.${sig}`;
}

export function verifyToken({ dealId, token }){
  if (!token || !dealId) return false;
  const [dealPart, sig] = String(token).split('.');
  if (dealPart !== dealId || !sig) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(`deal=${dealId}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

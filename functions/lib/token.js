// functions/lib/token.js
import crypto from 'crypto';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export function signAcceptToken({ dealId, ttlSec = 60 * 60 }, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { dealId, iat: now, exp: now + ttlSec, iss: 'qnc' };

  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  const s = b64url(sig);
  return `${data}.${s}`;
}

export function verifyAcceptToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, error: 'Malformed token' };
  }
  const [h64, p64, s64] = token.split('.');
  const data = `${h64}.${p64}`;
  const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  if (s64 !== expected) return { valid: false, error: 'Bad signature' };

  const payload = JSON.parse(Buffer.from(p64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { valid: false, error: 'Expired token' };

  return { valid: true, payload };
}

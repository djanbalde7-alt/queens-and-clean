export function splitFullName(fullname){
  const parts = String(fullname || '').trim().split(/\s+/);
  const firstname = parts.shift() || '';
  const lastname = parts.join(' ') || '';
  return { firstname, lastname };
}

export function normalizePhone(phone){
  const digits = String(phone||'').replace(/[^\d+]/g,'');
  return digits;
}

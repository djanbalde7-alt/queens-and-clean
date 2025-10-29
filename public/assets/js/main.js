const form  = document.getElementById('quote-form');
const toast = document.getElementById('toast');

const whitelist = {
  service_type: ['standard','deep'],
  number_of_bedrooms: ['studio','p_1br','p_2br','p_3br','p_4br'],
  time_slot: ['morning','afternoon','evening']
};

function getFormData(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}

function frontValidate(d) {
  const req = ['fullname','email','phone','service_address','service_type','number_of_bedrooms','preferred_date','time_slot'];
  for (const k of req) if (!d[k] || String(d[k]).trim()==='') throw new Error(`Please complete: ${k}`);
  if (!whitelist.service_type.includes(d.service_type)) throw new Error('Invalid service type');
  if (!whitelist.number_of_bedrooms.includes(d.number_of_bedrooms)) throw new Error('Invalid bedrooms');
  if (!whitelist.time_slot.includes(d.time_slot)) throw new Error('Invalid time slot');
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = getFormData(form);
  console.log('Submitting payload →', data);
  try {
    frontValidate(data);

    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(data)
    });

    const out = await res.json().catch(()=>({ ok:false, error:'Invalid JSON response'}));
    console.log('Server response →', res.status, out);

    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

    // success
    toast.textContent = 'Request received ✅ — You’ll get your quote shortly.';
    toast.hidden = false;
    form.reset();
    ['service_type','number_of_bedrooms','time_slot'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  } catch (err) {
    toast.textContent = `❗ ${err.message || 'Something went wrong'}`;
    toast.hidden = false;
  }
});

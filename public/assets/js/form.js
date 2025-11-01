// public/assets/js/form.js
const form = document.getElementById('quote-form');
const toast = document.getElementById('toast');

// Whitelists simples
const whitelist = {
  service_type: ['standard','deep'],
  number_of_bedrooms: ['studio','p_1br','p_2br','p_3br','p_4br'],
  time_slot: ['morning','afternoon','evening']
};

function getFormData(frm) {
  const fd = new FormData(frm);
  return Object.fromEntries(fd.entries());
}

function frontValidate(d) {
  const req = ['fullname', 'email', 'phone', 'service_address',
               'service_type','number_of_bedrooms','preferred_date','time_slot'];
  for (const k of req) {
    if (!d[k] || String(d[k]).trim() === '') throw new Error(`Please complete: ${k}`);
  }
  if (!whitelist.service_type.includes(d.service_type)) throw new Error('Invalid service type');
  if (!whitelist.number_of_bedrooms.includes(d.number_of_bedrooms)) throw new Error('Invalid bedrooms');
  if (!whitelist.time_slot.includes(d.time_slot)) throw new Error('Invalid time slot');
}

// petit helper fbq sûr
function fbqSafe() {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq.apply(null, arguments);
  } else {
    console.debug('[fbq skipped]', arguments);
  }
}

if (form) {
  // évite d’attacher 2 fois si ce fichier serait importé 2x par erreur
  if (!form.dataset.boundSubmit) {
    form.dataset.boundSubmit = '1';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = getFormData(form);
      try {
        frontValidate(data);

        const res = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const out = await res.json().catch(() => ({ ok:false, error:'Invalid JSON response'}));
        if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

        // ---- succès UI
        toast.textContent = 'Request received ✅ — You’ll get your quote shortly.';
        toast.hidden = false;
        form.reset();
        ['service_type','number_of_bedrooms','time_slot'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });

        // ---- Event META: Lead
        console.log('[meta] Lead -> quote-form');
        fbqSafe('trackCustom', 'Lead', {
          form_id: 'quote-form',
          service_type: data.service_type,
          bedrooms: data.number_of_bedrooms,
          time_slot: data.time_slot
        });

      } catch (err) {
        toast.textContent = '❗ ' + (err.message || 'Something went wrong');
        toast.hidden = false;
        console.error('[form] submit error:', err);
      }
    });
  }
} else {
  console.warn('[form] #quote-form introuvable');
}

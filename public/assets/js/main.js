// public/assets/js/main.js
// Version: v2 (no time_slot, no special_instructions required)

(function () {
  const form  = document.getElementById('quote-form');
  const toast = document.getElementById('toast');

  if (!form) {
    console.warn('[main.js] No form with id="quote-form" found.');
    return;
  }

  console.log('JS ACTIF = main.js v2 (no time_slot)');

  // --- listes de valeurs permises (sécurité côté client) ---
  const whitelist = {
    service_type:        ['standard', 'deep'],
    number_of_bedrooms:  ['studio', 'p_1br', 'p_2br', 'p_3br', 'p_4br'],
  };

  // --- helpers ---
  function getFormData(formEl) {
    const fd = new FormData(formEl);
    return Object.fromEntries(fd.entries());
  }

  function frontValidate(data) {
    // Champs obligatoires (sans time_slot ni special_instructions)
    const required = [
      'fullname',
      'email',
      'phone',
      'service_address',
      'service_type',
      'number_of_bedrooms',
      'preferred_date'
    ];

    for (const k of required) {
      if (!(k in data) || String(data[k]).trim() === '') {
        throw new Error(`Please complete: ${k}`);
      }
    }

    if (!whitelist.service_type.includes(data.service_type)) {
      throw new Error('Invalid service_type');
    }
    if (!whitelist.number_of_bedrooms.includes(data.number_of_bedrooms)) {
      throw new Error('Invalid number_of_bedrooms');
    }
  }

  function setToast(msg, isError=false) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.toggle('is-error', !!isError);
  }

  // --- submit ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      const data = getFormData(form);
      console.log('[submit] payload (raw):', data);

      frontValidate(data);

      // Nettoyage : on enlève les clés vides si jamais elles existent dans le HTML
      if ('time_slot' in data && !data.time_slot) delete data.time_slot;
      if ('special_instructions' in data && !data.special_instructions) delete data.special_instructions;

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const out = await res.json().catch(() => ({ ok:false, error: 'Invalid JSON response' }));
      console.log('[submit] server response:', res.status, out);

      if (!res.ok || !out.ok) {
        throw new Error(out.error || `HTTP ${res.status}`);
      }

      setToast('Request received ✅ — You’ll get your quote shortly.');
      // Nettoyage des champs sélectifs
      ['service_type','number_of_bedrooms'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      form.reset();

    } catch (err) {
      console.error('[form] submit error:', err);
      setToast(err.message || 'Something went wrong', true);
    }
  });
})();

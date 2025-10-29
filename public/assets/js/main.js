// public/assets/js/main.js
(() => {
  const form = document.getElementById('quote-form');
  const toast = document.getElementById('toast');

  // --- Whitelist (time_slot retiré) ---
  const whitelist = {
    service_type: ['standard', 'deep'],
    number_of_bedrooms: ['studio', 'p_1br', 'p_2br', 'p_3br', 'p_4br'],
    // time_slot supprimé
  };

  function getFormData(form) {
    const fd = new FormData(form);
    return Object.fromEntries(fd.entries());
  }

  function frontValidate(d) {
    // Champs requis (sans time_slot, sans special_instructions)
    const req = [
      'fullname',
      'email',
      'phone',
      'service_address',
      'service_type',
      'number_of_bedrooms',
      'preferred_date'
    ];

    for (const k of req) {
      if (!d[k] || String(d[k]).trim() === '') {
        throw new Error(`Please complete: ${k}`);
      }
    }

    if (!whitelist.service_type.includes(d.service_type)) {
      throw new Error('Invalid service type');
    }
    if (!whitelist.number_of_bedrooms.includes(d.number_of_bedrooms)) {
      throw new Error('Invalid bedrooms');
    }
    // Pas de validation time_slot
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = getFormData(form);
    console.log('Submitting payload →', data);

    try {
      frontValidate(data);

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const out = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON response' }));
      if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);

      // --- Succès ---
      toast.textContent = 'Request received — You’ll get your quote shortly.';
      toast.hidden = false;

      // Réinitialiser uniquement les selects conservés
      ['service_type', 'number_of_bedrooms'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      form.reset();
    } catch (err) {
      toast.textContent = ` ${err.message || 'Something went wrong'}`;
      toast.hidden = false;
      console.error('form submit error:', err);
    }
  });
})();

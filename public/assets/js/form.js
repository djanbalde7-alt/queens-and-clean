// public/assets/js/form.js

const form  = document.getElementById('quote-form');
const toast = document.getElementById('toast');

// Listes de valeurs autorisées (sans time_slot)
const whitelist = {
  service_type: ['standard', 'deep'],
  number_of_bedrooms: ['studio', 'p_1br', 'p_2br', 'p_3br', 'p_4br']
};

function getFormData(formEl) {
  const fd = new FormData(formEl);
  return Object.fromEntries(fd.entries());
}

// Validation front (sans time_slot)
function frontValidate(d) {
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

  // ⛔️ plus de validation de time_slot ici
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const data = getFormData(form);

    // On supprime explicitement si les champs existent encore dans le DOM
    delete data.time_slot;
    delete data.special_instructions;

    frontValidate(data);

    toast.hidden = false;
    toast.textContent = 'Submitting…';

    const res = await fetch('/.netlify/functions/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const out = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON response' }));
    if (!res.ok || !out.ok) {
      throw new Error(out.error || `HTTP ${res.status}`);
    }

    // Succès
    toast.textContent = 'Request received — You’ll get your quote shortly.';
    toast.hidden = false;

    // Nettoyage du formulaire
    form.reset();

    // Par sécurité, on vide aussi les selects clés
    ['service_type', 'number_of_bedrooms'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  } catch (err) {
    toast.textContent = (err?.message || 'Something went wrong');
    toast.hidden = false;
    console.error('[form] submit error:', err);
  }
});

// public/assets/js/form.js
(() => {
  'use strict';

  // --------- DOM refs (noms uniques pour éviter les collisions) ----------
  const formEl  = document.getElementById('quote-form');
  const toastEl = document.getElementById('toast');

  if (!formEl) return; // rien à faire si le formulaire n'est pas présent

  // --------- Helpers ----------
  // Appel fbq sécurisé (ne casse pas si le pixel n'est pas dispo)
  const safeFbq = (fn, name, params = {}) => {
    try { if (typeof window.fbq === 'function') window.fbq(fn, name, params); }
    catch (_) { /* no-op */ }
  };

  // Listes blanches pour les selects
  const whitelist = {
    service_type:       ['standard', 'deep'],
    number_of_bedrooms: ['studio', 'p_1br', 'p_2br', 'p_3br', 'p_4br'],
    time_slot:          ['morning', 'afternoon', 'evening']
  };

  // Récupérer proprement les données du formulaire
  const getFormData = (form) => {
    const fd = new FormData(form);
    return Object.fromEntries(fd.entries());
  };

  // Validation front simple (champs requis + whitelists)
  const frontValidate = (d) => {
    const required = [
      'fullname', 'email', 'phone',
      'service_address', 'service_type',
      'number_of_bedrooms', 'preferred_date', 'time_slot'
    ];

    for (const k of required) {
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
    if (!whitelist.time_slot.includes(d.time_slot)) {
      throw new Error('Invalid time slot');
    }
  };

  // --------- Tracking "StartForm" (une seule fois) ----------
  let startedOnce = false;
  const startOnce = () => {
    if (startedOnce) return;
    startedOnce = true;
    safeFbq('trackCustom', 'StartForm', {
      content_name: 'quote-form'
    });
  };
  // Déclenche dès la première interaction sur n’importe quel champ du formulaire
  formEl.addEventListener('focusin', startOnce, { once: true, passive: true });

  // --------- Soumission du formulaire ----------
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = getFormData(formEl);

    try {
      // Valide côté client
      frontValidate(data);

      // Envoie à ton endpoint Netlify/serveur
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const out = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON response' }));
      if (!res.ok || !out.ok) {
        throw new Error(out.error || `HTTP ${res.status}`);
      }

      // ------- Succès UI -------
      if (toastEl) {
        toastEl.textContent = 'Request received ✅ — You’ll get your quote shortly.';
        toastEl.hidden = false;
      }
      formEl.reset();
      // Remet à vide les selects (si besoin de forcer l’UI)
      ['service_type', 'number_of_bedrooms', 'time_slot'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      // ------- Tracking "Lead" -------
      safeFbq('trackCustom', 'Lead', {
        content_name: 'quote-form',
        currency: 'USD',
        value: 0 // tu peux mettre un montant si tu en as un
      });

    } catch (err) {
      // ------- Erreur UI -------
      if (toastEl) {
        toastEl.textContent = `❗ ${err.message || 'Something went wrong'}`;
        toastEl.hidden = false;
      }
      console.error('[form] submit error:', err);
    }
  });
})();

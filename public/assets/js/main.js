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





document.addEventListener('DOMContentLoaded', () => {
  // Sécurité d'appel fbq
  const fbqSafe = (...args) => {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq(...args);
    } else {
      console.debug('[fbq skipped]', args);
    }
  };

  // --- 1) ViewContent quand le HERO est visible à 50%
  (function trackViewContent() {
    const hero = document.getElementById('hero');
    if (!hero) {
      console.warn('[meta] #hero introuvable -> ViewContent non armé');
      return;
    }
    if (!('IntersectionObserver' in window)) {
      console.warn('[meta] IntersectionObserver indisponible');
      return;
    }

    let fired = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!fired && entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          fired = true;
          console.log('[meta] ViewContent -> landing_hero');
          fbqSafe('track', 'ViewContent', {
            content_name: 'landing_hero',
            content_category: 'landing',
          });
          io.disconnect();
        }
      });
    }, { threshold: 0.5 });

    io.observe(hero);
  })();

  // --- 2) ClickButton sur tous les CTAs (liens ET boutons)
  (function trackClickButton() {
    const ctas = document.querySelectorAll('a.btn.cta[data-cta], button.btn.cta');
    if (!ctas.length) {
      console.warn('[meta] aucun CTA trouvé');
      return;
    }
    ctas.forEach((el) => {
      el.addEventListener('click', () => {
        const source = el.getAttribute('data-cta') || (el.tagName === 'BUTTON' ? 'form_button' : 'unknown');
        const href = el.getAttribute && el.getAttribute('href') ? el.getAttribute('href') : '';
        console.log('[meta] ClickButton ->', { source, href });
        fbqSafe('trackCustom', 'ClickButton', { cta_source: source, href });
      }, { passive: true });
    });
  })();

  // --- 3) StartForm au premier focus dans le formulaire
  (function trackStartForm() {
    const form = document.getElementById('quote-form');
    if (!form) {
      console.warn('[meta] #quote-form introuvable');
      return;
    }
    let started = false;
    const onStart = (e) => {
      if (started) return;
      if (!form.contains(e.target)) return;
      started = true;
      console.log('[meta] StartForm -> quote-form');
      fbqSafe('trackCustom', 'StartForm', { form_id: 'quote-form' });
      document.removeEventListener('focusin', onStart);
    };
    document.addEventListener('focusin', onStart);
  })();
});

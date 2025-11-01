// public/assets/js/main.js
// ---- Helpers ----
function fbqSafe() {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq.apply(null, arguments);
  } else {
    console.debug('[fbq skipped]', arguments);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 1) ViewContent lorsque le hero est vu à 50%
  (function trackViewContent() {
    const hero = document.getElementById('hero');
    if (!hero) { console.warn('[meta] #hero introuvable → ViewContent non armé'); return; }
    if (!('IntersectionObserver' in window)) { console.warn('[meta] IntersectionObserver indisponible'); return; }

    let fired = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!fired && entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          fired = true;
          console.log('[meta] ViewContent -> landing_hero');
          fbqSafe('track', 'ViewContent', { content_category: 'landing' });
          io.disconnect();
        }
      });
    }, { threshold: 0.5 });

    io.observe(hero);
  })();

  // 2) ClickButton sur tous les CTA (liens ET boutons)
  (function trackClickButton() {
    const ctas = document.querySelectorAll('a.btn.cta[data-cta], button.btn.cta');
    if (!ctas.length) { console.warn('[meta] aucun CTA trouvé'); return; }

    ctas.forEach((el) => {
      el.addEventListener('click', () => {
        const source = el.getAttribute('data-cta') || (el.tagName === 'BUTTON' ? 'form_button' : 'unknown');
        const href = el.getAttribute('href') || '';
        console.log('[meta] ClickButton ->', { source, href });
        fbqSafe('trackCustom', 'ClickButton', { cta_source: source, href });
      }, { passive: true });
    });
  })();

  // 3) StartForm au premier focus dans le formulaire
  (function trackStartForm() {
    const form = document.getElementById('quote-form');
    if (!form) { console.warn('[meta] #quote-form introuvable'); return; }

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

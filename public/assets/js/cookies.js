// cookies.js — simple, auto-hide, UX-friendly cookie banner
document.addEventListener('DOMContentLoaded', () => {
  const banner = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('cookie-accept');
  const cookieKey = 'qc_cookie_consent';

  // Affiche si non encore accepté
  if (!localStorage.getItem(cookieKey)) {
    banner.classList.remove('hidden');

    // Disparaît après 10 s si rien n’est cliqué
    setTimeout(() => {
      if (!localStorage.getItem(cookieKey)) {
        banner.classList.add('fade-out');
        setTimeout(() => banner.remove(), 400);
      }
    }, 10000);
  }

  // Si clic sur OK → enregistrer et cacher
  acceptBtn.addEventListener('click', () => {
    localStorage.setItem(cookieKey, 'accepted');
    banner.classList.add('fade-out');
    setTimeout(() => banner.remove(), 400);
  });
});

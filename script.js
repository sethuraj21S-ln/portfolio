// Enables the scroll-reveal styles (content stays visible if this file fails to load)
document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Footer year ---------- */
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

/* ---------- Scroll reveal ---------- */
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('in'));
}

/* ---------- Highlight the current section in the nav ---------- */
const navLinks = document.querySelectorAll('.nav nav a');
const sections = [...navLinks]
  .map((a) => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => {
        a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => navObserver.observe(s));
}

/* ---------- 3D particle background ---------- */
async function startBackground() {
  if (reduceMotion) return; // respect users who prefer less motion; CSS fallback is used

  try {
    const { ParticlesSwarm } = await import('./particles.js');

    const small = window.matchMedia('(max-width: 768px)').matches;
    const swarm = new ParticlesSwarm(document.getElementById('bg'), small ? 6000 : 15000);

    document.body.classList.add('bg-ready');

    // Keep the scene sized correctly when the window changes
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      swarm.camera.aspect = w / h;
      swarm.camera.updateProjectionMatrix();
      swarm.renderer.setSize(w, h);
      swarm.composer.setSize(w, h);
    });
  } catch (err) {
    // No WebGL or the CDN is blocked: the site still works with the gradient background
    console.warn('3D background could not start:', err);
  }
}

startBackground();

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

/* ---------- Light / dark theme ---------- */
const root = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const THEME_BG = { dark: '#03050a', light: '#f3f6fc' }; // same as --bg in style.css
let swarm = null; // set once the 3D background is running

function currentTheme() {
  return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

// Keep the button label, browser bar colour and 3D background in step with the theme
function syncTheme() {
  const theme = currentTheme();
  if (themeBtn) {
    const next = theme === 'light' ? 'dark' : 'light';
    themeBtn.setAttribute('aria-label', `Switch to ${next} theme`);
    themeBtn.setAttribute('title', `Switch to ${next} theme`);
  }
  if (themeMeta) themeMeta.setAttribute('content', THEME_BG[theme]);
  if (swarm && swarm.bgCompositePass) {
    swarm.bgCompositePass.uniforms['bgColor'].value.set(THEME_BG[theme]);
  }
}

if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode: just don't remember */ }
    syncTheme();
  });
}
syncTheme();

/* ---------- 3D particle background ---------- */
async function startBackground() {
  if (reduceMotion) return; // respect users who prefer less motion; CSS fallback is used

  try {
    const { ParticlesSwarm } = await import('./particles.js');

    const small = window.matchMedia('(max-width: 768px)').matches;
    swarm = new ParticlesSwarm(document.getElementById('bg'), small ? 6000 : 15000);
    syncTheme(); // apply the right background colour straight away

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

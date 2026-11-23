// FINDATION website, version 2: navigation, hero slider, join forms, form handling, scroll reveal. The Ask FINDATION demo lives in app.html / app.js.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Navigation
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav.addEventListener('click', e => {
  if (e.target.closest('a')) { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
});
document.getElementById('year').textContent = new Date().getFullYear();


// Hero slider. Moves on by itself every few seconds, always. Arrows, dots, swipe and
// keyboard jump to a slide and the automatic change carries on from there.
(() => {
  const AUTO_MS = 6000;
  const hero = document.getElementById('home');
  const slides = Array.from(hero.querySelectorAll('.slide'));
  const controls = hero.querySelector('.slider-nav');
  const dotsWrap = hero.querySelector('.slider-dots');
  if (slides.length < 2) return;

  let current = 0, timer = null;

  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'slider-dot';
    dot.setAttribute('aria-label', 'Slide ' + (i + 1) + ' of ' + slides.length);
    dot.addEventListener('click', () => { takeOver(); go(i); });
    dotsWrap.appendChild(dot);
    return dot;
  });

  function go(n) {
    current = (n + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('is-active', i === current));
    dots.forEach((d, i) => {
      d.classList.toggle('is-active', i === current);
      if (i === current) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
    hero.classList.toggle('is-green', slides[current].classList.contains('slide-green'));
  }

  // Always running. A manual move restarts the countdown so the chosen slide gets its full time.
  function play() { clearInterval(timer); timer = setInterval(() => { if (!document.hidden) go(current + 1); }, AUTO_MS); }
  function takeOver() { play(); }

  hero.querySelectorAll('.slider-arrow').forEach(b => b.addEventListener('click', () => { takeOver(); go(current + Number(b.dataset.dir)); }));
  hero.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { takeOver(); go(current - 1); }
    if (e.key === 'ArrowRight') { takeOver(); go(current + 1); }
  });

  // Swipe on touch screens
  let startX = 0, startY = 0;
  hero.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  hero.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    takeOver(); go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  controls.hidden = false;
  go(0);
  play();
})();

// Programme posters: "Join" slides that programme's form in over the poster; "Back" slides it away.
document.querySelectorAll('.poster').forEach(poster => {
  const panel = poster.querySelector('.poster-join');
  if (!panel) return;
  const openBtn = poster.querySelector('[data-join]'), backBtn = panel.querySelector('.join-back');
  const form = panel.querySelector('form'), note = form.querySelector('.form-note');
  const front = Array.from(poster.children).filter(el => el !== panel);

  function show(open) {
    poster.classList.toggle('is-joining', open);
    panel.inert = !open;
    front.forEach(el => { el.inert = open; });
    if (!open) { openBtn.focus({ preventScroll: true }); return; }
    // Bring the top of the form into view, then put the cursor in it (not on touch screens, where that would pop the keyboard up).
    if (poster.getBoundingClientRect().top < 76) poster.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    (matchMedia('(hover: hover)').matches ? panel.querySelector('input') : panel).focus({ preventScroll: true });
  }

  panel.inert = true;
  openBtn.addEventListener('click', () => show(true));
  backBtn.addEventListener('click', () => show(false));
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') show(false); });
  // Placeholder handler: the form is not yet connected to a backend.
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    note.textContent = 'This form is not connected yet, so your details were not sent.';
  });
});

// Reveal blocks as they scroll into view, with a small stagger inside groups.
if ('IntersectionObserver' in window && !reduceMotion) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const target = en.target;
    target.classList.add('in');
    io.unobserve(target);
    setTimeout(() => { target.classList.remove('reveal', 'in'); target.style.removeProperty('--d'); }, 1300);
  }), { threshold: 0.12 });
  document.querySelectorAll('.section-head, .poster').forEach(el => {
    const index = Array.prototype.indexOf.call(el.parentElement.children, el);
    el.style.setProperty('--d', Math.min(index, 6) * 0.07 + 's');
    el.classList.add('reveal');
    io.observe(el);
  });
}

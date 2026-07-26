/* ═══════════════════════════════════════════════════════════════
   STABL.FUN — landing behaviour

   Two kinds of footage, on purpose:
   • the gallop is a looping film — it runs whether or not anyone
     touches the wheel, so the hero is never dead on arrival;
   • the enclosure is a frame sequence — the reader advances it
     themselves, and the market settles as they do.
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ─── masthead: transparent over the footage, solid past it ─── */

  function initMasthead() {
    const bar = document.querySelector('.masthead');
    if (!bar) return;
    let stuck = false, ticking = false;

    const check = () => {
      const should = scrollY > 40;
      if (should !== stuck) { bar.classList.toggle('is-stuck', should); stuck = should; }
    };
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; check(); });
    }, { passive: true });
    check();
  }

  /* ─── hero ──────────────────────────────────────────────────── */

  const REELS = {
    desktop: { gallop: 'assets/hero/gallop.mp4',   crowd: 'assets/hero/crowd-d/', frames: 45 },
    mobile:  { gallop: 'assets/hero/gallop-m.mp4', crowd: 'assets/hero/crowd-m/', frames: 30 },
  };

  // Where the field passes the post: the market settles and the enclosure
  // takes the screen. The reaction finishes at CROWD_END — after that the
  // last frame simply holds, and the market cards ride up over it.
  const POST      = 0.35;
  const CROWD_END = 0.62;

  function initHero() {
    const hero  = document.querySelector('.hero');
    const stage = document.querySelector('.hero__stage');
    const media = document.querySelector('[data-media]');
    if (!hero || !stage || !media) return;

    const copy   = document.querySelector('.hero__copy');
    const poster = document.querySelector('.hero__poster');
    const gallop = document.querySelector('[data-reel="gallop"]');
    const crowd  = document.querySelector('[data-crowd]');

    const cta     = document.querySelector('.hero__cta');
    const tape    = document.querySelector('[data-tape]');
    const elYes   = document.querySelector('[data-yes]');
    const elNo    = document.querySelector('[data-no]');
    const elBar   = document.querySelector('[data-bar]');
    const elState = document.querySelector('[data-tape-state]');

    const reduced  = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    const still    = reduced || saveData;      // poster only: a different hero, not a broken one

    const set = matchMedia('(max-width: 700px)').matches ? REELS.mobile : REELS.desktop;

    /* --- the gallop, playing on its own ------------------------- */

    if (!still) {
      gallop.addEventListener('canplay', () => {
        gallop.classList.add('is-live');
        loadShots();                 // only now — nothing competes with first paint
      }, { once: true });

      gallop.src = set.gallop;
      const kick = gallop.play();
      if (kick && kick.catch) kick.catch(() => {});   // autoplay may be refused; poster stays
    }

    /* --- the enclosure, advanced by the reader ------------------ */

    const ctx   = crowd.getContext('2d', { alpha: false });
    const shots = new Array(set.frames).fill(null);
    let drawn = -1, sized = false;

    function sizeCrowd() {
      const dpr  = Math.min(devicePixelRatio || 1, 2);
      const rect = crowd.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width  * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (crowd.width !== w || crowd.height !== h) {
        crowd.width = w; crowd.height = h; drawn = -1;
      }
      sized = true;
    }

    function drawCover(img) {
      const cw = crowd.width, ch = crowd.height;
      const scale = Math.max(cw / img.width, ch / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }

    function nearest(i) {
      if (shots[i]) return shots[i];
      for (let r = 1; r < shots.length; r++) {
        if (shots[i - r]) return shots[i - r];
        if (shots[i + r]) return shots[i + r];
      }
      return null;
    }

    function paintCrowd(p) {
      if (still || p < POST) return;
      if (!sized) sizeCrowd();
      const t = clamp((p - POST) / (CROWD_END - POST), 0, 1);
      const i = clamp(Math.round(t * (shots.length - 1)), 0, shots.length - 1);
      if (i === drawn) return;
      const img = nearest(i);
      if (!img) return;
      drawCover(img);
      drawn = i;
      crowd.classList.add('is-live');
    }

    function grab(i) {
      return new Promise(done => {
        const img = new Image();
        img.decoding = 'async';
        img.onload  = () => { shots[i] = img; done(); };
        img.onerror = done;
        img.src = `${set.crowd}${String(i + 1).padStart(3, '0')}.webp`;
      });
    }

    async function loadShots() {
      const coarse = [];
      for (let i = 0; i < shots.length; i += 5) coarse.push(i);
      await Promise.all(coarse.map(grab));
      for (let i = 0; i < shots.length; i++) if (!shots[i]) await grab(i);
    }

    /* --- the market, priced against the race -------------------- */

    let lastYes = -1, lastSettled = null;
    const cents = n => `${n}<i>¢</i>`;

    function market(p) {
      if (p >= POST) return { yes: 100, settled: true };
      const t    = p / POST;                          // 0 → 1 through the race
      const draw = 54 + Math.pow(t, 1.7) * 43;        // belief hardens as he closes
      const wob  = Math.sin(t * 27) * 3.4 * (1 - t)   // the tape is never still…
                 + Math.sin(t * 71) * 1.1 * (1 - t);  // …and never smooth
      return { yes: Math.round(clamp(draw + wob, 2, 98)), settled: false };
    }

    function priceIt(p) {
      if (!tape) return;
      const { yes, settled } = market(p);
      if (yes !== lastYes) {
        elYes.innerHTML = cents(yes);
        elNo.innerHTML  = cents(100 - yes);
        elBar.style.setProperty('--fill', yes + '%');
        lastYes = yes;
      }
      if (settled !== lastSettled) {
        tape.classList.toggle('is-settled', settled);
        elState.textContent = settled ? 'Settled' : 'Live';
        lastSettled = settled;
      }
    }

    /* --- hand the screen over at the post ----------------------- */

    let onCrowd = false;

    function handOver(p) {
      const past = p >= POST;
      if (past !== onCrowd) {
        onCrowd = past;
        media.classList.toggle('is-crowd', past);
        if (past) gallop.pause(); else gallop.play().catch(() => {});
      }
      const o = 1 - clamp((p - .14) / .18, 0, 1);     // the headline belongs to the gallop
      if (copy) { copy.style.opacity = o; copy.style.transform = `translateY(${(1 - o) * -20}px)`; }

      // Once the cards start rising, the hero's own furniture steps aside
      // rather than sitting half-covered behind them.
      const f = 1 - clamp((p - .58) / .14, 0, 1);
      if (cta)  cta.style.opacity  = f;
      if (tape) tape.style.opacity = f;
    }

    /* --- a slow push out, so the camera never sits still --------- */

    function frameIt(p) {
      const s = (1.08 - .08 * p).toFixed(4);
      if (gallop) gallop.style.transform = `scale(${s})`;
      if (crowd)  crowd .style.transform = `scale(${s})`;
      if (poster) poster.style.transform = `scale(${s})`;
    }

    let ticking = false;

    function onScroll() {
      const rect = hero.getBoundingClientRect();
      const span = hero.offsetHeight - stage.clientHeight;
      const p    = span > 0 ? clamp(-rect.top / span, 0, 1) : 0;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        priceIt(p); handOver(p); paintCrowd(p); frameIt(p);
      });
    }

    let resizeTimer;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { sized = false; onScroll(); }, 180);
    }, { passive: true });

    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ─── waitlist ──────────────────────────────────────────────── */

  function initSignup() {
    const form = document.querySelector('.signup');
    if (!form) return;
    const input = form.querySelector('.signup__input');
    const note  = form.querySelector('[data-signup-note]');
    const resting = note.textContent;

    form.addEventListener('submit', e => {
      e.preventDefault();
      const value = input.value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

      if (!ok) {
        input.setAttribute('aria-invalid', 'true');
        note.dataset.state = 'error';
        note.textContent = 'That address does not look complete. Check it and try again.';
        input.focus();
        return;
      }

      // TODO: POST to the waitlist endpoint. Nothing is stored yet.
      input.removeAttribute('aria-invalid');
      note.dataset.state = 'done';
      note.textContent = 'You are on the list. We write once, when the exchange opens.';
      input.value = '';
      setTimeout(() => { note.dataset.state = ''; note.textContent = resting; }, 6000);
    });

    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        input.removeAttribute('aria-invalid');
        note.dataset.state = '';
        note.textContent = resting;
      }
    });
  }

  /* ─── card reveal, only where CSS can't do it ───────────────── */

  function initReveal() {
    if (CSS.supports('animation-timeline: view()')) return;
    if (!('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    document.querySelectorAll('.card').forEach(el => io.observe(el));
  }

  initMasthead();
  initHero();
  initSignup();
  initReveal();
})();

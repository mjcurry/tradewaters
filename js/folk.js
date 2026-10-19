// Townsfolk going about their business on the quay of a port's city view: sailors with
// barrels, market women, merchants, soldiers, porters, ladies, children and the odd dog.
// They walk the paved strip in front of the buildings, stop now and then, and come and go
// at the open edge of the scene or fade out by the harbor pier. Drawn on a canvas that
// ignores the pointer, so the buildings stay clickable; runs only while the view is shown.
(function () {
  // h: height as a share of the scene; speed: scene widths per second; bob: stride bounce.
  const KINDS = [
    { id: 'sailor',      h: 0.088, speed: 0.026, bob: 1 },
    { id: 'marketwoman', h: 0.094, speed: 0.022, bob: 0.7 },
    { id: 'merchant',    h: 0.088, speed: 0.02,  bob: 0.8 },
    { id: 'soldier',     h: 0.092, speed: 0.028, bob: 0.9 },
    { id: 'porter',      h: 0.07,  speed: 0.017, bob: 0.4 },
    { id: 'lady',        h: 0.09,  speed: 0.018, bob: 0.4 },
    { id: 'child',       h: 0.06,  speed: 0.045, bob: 1.6 },
    { id: 'dog',         h: 0.04,  speed: 0.055, bob: 1.4 },
  ];
  const ART = {};
  TW.loadFolk = () => Promise.all(KINDS.map(k => new Promise(res => {
    const img = new Image();
    img.onload = () => { ART[k.id] = img; res(); };
    img.onerror = () => res();
    img.src = `assets/img/folk/${k.id}.webp`;
  })));

  const rand = (a, b) => a + Math.random() * (b - a);
  const COUNT = 6, FADE = 0.035;

  // scene: the .city-scene element. quay: y (0..1) where buildings stand.
  // harborLeft: which end the harbor pier is on (folk keep clear of it).
  TW.startFolk = function (scene, { quay, harborLeft }) {
    const canvas = document.createElement('canvas');
    canvas.className = 'folk';
    canvas.setAttribute('aria-hidden', 'true');
    // Buildings stack by base (z = base x 100): stand in front of the quay, behind the pier.
    canvas.style.zIndex = Math.round((quay + 0.07) * 100);
    scene.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // The walkable stretch: off the open edge at one end, up to the pier at the other.
    const lo = harborLeft ? 0.25 : -0.06, hi = harborLeft ? 1.06 : 0.75;
    const top = quay + 0.02, bottom = quay + 0.062;
    const spawn = (initial) => {
      const k = KINDS[Math.floor(Math.random() * KINDS.length)];
      const dir = Math.random() < 0.5 ? 1 : -1;
      // New arrivals enter from either end; on first paint they're already scattered about.
      const x = initial ? rand(lo + 0.05, hi - 0.05) : dir > 0 ? lo : hi;
      return { k, dir, x, lane: rand(top, bottom), phase: rand(0, 6), speed: k.speed * rand(0.85, 1.15), rest: 0, restIn: rand(4, 14) };
    };
    const folk = Array.from({ length: COUNT }, () => spawn(true));
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, last = 0;

    function size() {
      const r = scene.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function step(dt) {
      for (let i = 0; i < folk.length; i++) {
        const f = folk[i];
        if (f.rest > 0) { f.rest -= dt; continue; }
        f.restIn -= dt;
        if (f.restIn <= 0) {   // stop for a breather, a chat or a look at the ships
          f.rest = rand(1.5, 4.5); f.restIn = rand(6, 16);
          if (Math.random() < 0.25) f.dir *= -1;
          continue;
        }
        f.x += f.dir * f.speed * dt;
        f.phase += dt * f.speed * 260;
        if (f.x < lo - 0.02 || f.x > hi + 0.02) folk[i] = spawn(false);
      }
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const f of [...folk].sort((a, b) => a.lane - b.lane)) {   // further back first
        const img = ART[f.k.id];
        if (!img) continue;
        // Fade in and out at the ends of the walk, and a touch smaller further back.
        const edge = Math.min(f.x - lo, hi - f.x);
        const alpha = Math.max(0, Math.min(1, edge / FADE));
        if (alpha <= 0) continue;
        const depth = 0.9 + 0.1 * (f.lane - top) / (bottom - top);
        const ph = f.k.h * h * depth, pw = ph * img.width / img.height;
        const walking = f.rest <= 0;
        const bob = walking ? Math.abs(Math.sin(f.phase)) * ph * 0.025 * f.k.bob : 0;
        const sway = walking ? Math.sin(f.phase) * 0.025 * f.k.bob : 0;
        const fx = f.x * w, fy = f.lane * h;
        ctx.save();
        ctx.globalAlpha = alpha;
        // a soft shadow underfoot
        ctx.fillStyle = 'rgba(40,30,20,0.18)';
        ctx.beginPath(); ctx.ellipse(fx, fy, pw * 0.32, ph * 0.035, 0, 0, Math.PI * 2); ctx.fill();
        ctx.translate(fx, fy - bob);
        ctx.rotate(sway * f.dir);
        ctx.scale(f.dir, 1);
        ctx.drawImage(img, -pw / 2, -ph, pw, ph);
        ctx.restore();
      }
    }
    function loop(now) {
      if (!canvas.isConnected) return;   // the city view was replaced: stop
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      if (canvas.width !== Math.round(scene.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))) size();
      step(dt); draw();
      requestAnimationFrame(loop);
    }
    size();
    if (calm) { draw(); return; }
    requestAnimationFrame(loop);
    // Sprites may still be loading on the very first port; draw as soon as they land.
    if (KINDS.some(k => !ART[k.id])) TW.loadFolk().then(() => canvas.isConnected && draw());
  };
})();

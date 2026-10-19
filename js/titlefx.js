// Ambient title-screen effects drawn over the background art: gulls wheeling
// across the sky and sun glints twinkling on the water. Stops by itself once
// the canvas leaves the page.
(function () {
  const IMG_ASPECT = 1600 / 895;   // title.jpg, drawn with background-size: cover
  const rand = (a, b) => a + Math.random() * (b - a);

  TW.titleFX = function (canvas) {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, last = performance.now();

    // Map a point in the source image (0..1) to screen pixels under "cover" scaling.
    const toScreen = (u, v) => {
      const scale = Math.max(w / IMG_ASPECT, h) ;
      const iw = scale * IMG_ASPECT, ih = scale;
      return [(w - iw) / 2 + u * iw, (h - ih) / 2 + v * ih, iw / 1600];
    };

    const gulls = Array.from({ length: 5 }, (_, i) => newGull(true, i));
    function newGull(initial, i = 0) {
      return {
        u: initial ? rand(-0.1, 0.9) : -0.08 - rand(0, 0.25),
        v: rand(0.12, 0.42), size: rand(7, 13), speed: rand(0.012, 0.028),
        phase: rand(0, 6.28), flap: rand(5, 8), drift: rand(0.004, 0.012), seed: i + Math.random(),
      };
    }
    // Glints cluster in the sun's reflection column; a few are scattered wider.
    const glints = Array.from({ length: 34 }, () => newGlint());
    function newGlint() {
      const wide = Math.random() < 0.3;
      const v = rand(0.73, 0.97);
      const spread = (v - 0.71) * (wide ? 1.4 : 0.45);
      return { u: 0.61 + rand(-spread, spread), v, t: rand(0, 1), life: rand(0.8, 2.2), size: rand(2, 4.5) };
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
    }
    resize();
    window.addEventListener('resize', resize);

    function drawGull(x, y, s, flap) {
      const lift = Math.sin(flap) * s * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - s, y - lift);
      ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.55 - lift * 0.5, x, y);
      ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.55 - lift * 0.5, x + s, y - lift);
      ctx.stroke();
    }

    function frame(now) {
      if (!canvas.isConnected) { window.removeEventListener('resize', resize); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(40, 52, 66, 0.75)';
      gulls.forEach((g, i) => {
        g.u += g.speed * dt;
        g.v += Math.sin(t * 0.4 + g.phase) * g.drift * dt;
        if (g.u > 1.1) gulls[i] = newGull(false, i);
        const [x, y, k] = toScreen(g.u, g.v);
        ctx.lineWidth = Math.max(1.2, g.size * k * 0.28);
        drawGull(x, y, g.size * k, t * g.flap + g.phase);
      });

      glints.forEach((s, i) => {
        s.t += dt / s.life;
        if (s.t >= 1) { glints[i] = newGlint(); return; }
        const a = Math.sin(Math.PI * s.t);
        const [x, y, k] = toScreen(s.u, s.v);
        const r = s.size * k * (0.6 + a);
        ctx.fillStyle = `rgba(255, 246, 210, ${0.85 * a})`;
        ctx.beginPath();
        ctx.moveTo(x - r * 2.2, y); ctx.lineTo(x, y - r * 0.5); ctx.lineTo(x + r * 2.2, y); ctx.lineTo(x, y + r * 0.5);
        ctx.closePath(); ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
})();

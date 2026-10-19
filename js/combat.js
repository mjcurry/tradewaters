// Real-time naval combat. Each cannon reloads and fires on its own; the player
// picks a target, triggers special ammo, or tries to flee.
(function () {
  const W = 960, H = 540;
  const rand = (a, b) => a + Math.random() * (b - a);
  const LOOKS = {
    sloop:      { len: 70,  masts: [0.55],            tall: 70,  castle: 0 },
    schooner:   { len: 90,  masts: [0.35, 0.65],      tall: 80,  castle: 0 },
    brigantine: { len: 110, masts: [0.35, 0.65],      tall: 95,  castle: 0.1 },
    barque:     { len: 130, masts: [0.25, 0.5, 0.75], tall: 100, castle: 0.12 },
    galleon:    { len: 150, masts: [0.25, 0.5, 0.75], tall: 115, castle: 0.22 },
    frigate:    { len: 160, masts: [0.22, 0.5, 0.78], tall: 120, castle: 0.12 },
    manowar:    { len: 180, masts: [0.2, 0.47, 0.75], tall: 135, castle: 0.18 },
  };

  // Painted ship sprites, bow to the right, with the waterline along the bottom edge:
  // m-<look> is the player's merchant rig, p-<look> the pirate version. Until they load
  // (or if one fails) ships fall back to the flat silhouette below.
  const ART = {};
  TW.loadShipArt = function () {
    const load = (key, src, then) => new Promise(res => {
      const img = new Image();
      img.onload = () => { ART[key] = img; then && then(img); res(); };
      img.onerror = () => res();
      img.src = src;
    });
    return Promise.all([
      ...Object.keys(LOOKS).flatMap(look => ['m', 'p'].map(v => load(`${v}-${look}`, `assets/img/ships/${v}-${look}.webp`))),
      ...Object.keys(DEFENSE_W).map(kind => load(kind, `assets/img/siege/${kind}.webp`, img => { ART[kind + '-ruin'] = scorched(img); })),
    ]);
  };
  // A soot-blackened copy of a sprite, cross-faded in as a fort or battery is destroyed.
  function scorched(img) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(38,28,22,0.55)'; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  const artFor = (look, pirate) => ART[`${pirate ? 'p' : 'm'}-${look}`];
  TW.shipArt = artFor;
  const artWidth = L => L.len * 1.5;   // painted ships include bowsprit and ensign

  // dir = 1 faces right, -1 faces left. (x, y) sits a little above the waterline, which
  // is at y + len * 0.11. opts.pirate (or the older opts.skull) picks the pirate art.
  function drawShip(ctx, look, x, y, dir, opts = {}) {
    const L = LOOKS[look] || LOOKS.sloop, s = opts.scale || 1;
    const img = artFor(look, opts.pirate || opts.skull);
    ctx.save(); ctx.translate(x, y); ctx.rotate(opts.tilt || 0); ctx.scale(dir * s, s);
    const len = L.len, h = len * 0.22;
    if (img) {
      const w = artWidth(L), ah = w * img.height / img.width, wl = h * 0.5;
      ctx.drawImage(img, -w / 2, wl - ah, w, ah);
      if (opts.wash !== undefined) {
        // A strip of sea and foam over the waterline, so the hull sits in the water.
        const t = opts.wash, x0 = -w * 0.42, x1 = w * 0.4, d = len * 0.05;
        ctx.beginPath(); ctx.moveTo(x0, wl + 2);
        for (let wx = x0; wx <= x1; wx += 6) ctx.lineTo(wx, wl - d + Math.sin(wx / 9 + t * 3) * 1.6);
        ctx.lineTo(x1, wl + 2); ctx.closePath();
        ctx.fillStyle = 'rgba(16,42,66,0.78)'; ctx.fill();
        ctx.beginPath();
        for (let wx = x0; wx <= x1; wx += 6) ctx.lineTo(wx, wl - d + Math.sin(wx / 9 + t * 3) * 1.6);
        ctx.strokeStyle = 'rgba(235,245,250,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.restore();
      return;
    }
    // hull
    ctx.fillStyle = opts.hullColor || '#5b3a24';
    ctx.beginPath();
    ctx.moveTo(-len / 2, -h * 0.4); ctx.lineTo(len / 2 + 12, -h * 0.55);
    ctx.lineTo(len / 2 - 6, h * 0.5); ctx.lineTo(-len / 2 + 8, h * 0.5); ctx.closePath(); ctx.fill();
    if (L.castle) { ctx.fillRect(-len / 2, -h * 0.4 - len * L.castle * 0.4, len * L.castle * 1.4, len * L.castle * 0.4); }
    ctx.fillStyle = opts.stripe || '#d9b26a';
    ctx.fillRect(-len / 2 + 4, -h * 0.05, len - 6, 3);
    // gun ports
    ctx.fillStyle = '#1e140d';
    for (let gx = -len / 2 + 14; gx < len / 2 - 8; gx += 14) ctx.fillRect(gx, h * 0.12, 5, 4);
    // masts and sails
    for (const m of L.masts) {
      const mx = -len / 2 + len * m, top = -h * 0.4 - L.tall;
      ctx.strokeStyle = '#3b2615'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx, -h * 0.4); ctx.lineTo(mx, top); ctx.stroke();
      ctx.fillStyle = opts.sail || '#f4ead2';
      const sw = len * 0.16;
      for (let k = 0; k < 2; k++) {
        const sy = top + 10 + k * L.tall * 0.42, sh = L.tall * 0.36;
        ctx.beginPath();
        ctx.moveTo(mx - sw, sy); ctx.quadraticCurveTo(mx + sw * 0.3, sy + sh * 0.5, mx - sw, sy + sh);
        ctx.lineTo(mx + sw, sy + sh); ctx.quadraticCurveTo(mx + sw * 1.4, sy + sh * 0.5, mx + sw, sy);
        ctx.closePath(); ctx.fill();
      }
    }
    // flag
    const fm = -len / 2 + len * L.masts[L.masts.length - 1], ft = -h * 0.4 - L.tall;
    ctx.fillStyle = opts.flag || '#1a1a1a';
    ctx.fillRect(fm, ft - 12, 18, 11);
    if (opts.skull) { ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(fm + 9, ft - 7, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  TW.drawShipSide = drawShip;

  // Draw a ship scaled to fit a w×h box with its waterline at `water` (default: near the
  // bottom). Used for the shipyard cards and the plunder list.
  TW.drawShipFit = function (ctx, look, w, h, opts = {}) {
    const L = LOOKS[look] || LOOKS.sloop, img = artFor(look, opts.pirate);
    const water = opts.water ?? h * 0.94;
    const sw = img ? artWidth(L) : L.len + 20, sh = img ? sw * img.height / img.width : L.tall + L.len * 0.2 + 12;
    const s = Math.min(w * 0.9 / sw, water * 0.92 / sh);
    drawShip(ctx, look, w / 2, water - L.len * 0.11 * s, opts.dir || 1, { ...opts, scale: s });
  };

  // Port defenses for hostile-port battles: a stone fortress and earthwork gun batteries,
  // drawn standing on `base`. As `ruin` goes 0 → 1 the sprite blackens and settles into
  // its own rubble.
  const DEFENSE_W = { fort: 175, battery: 140 };
  const defenseH = kind => { const img = ART[kind]; return DEFENSE_W[kind] * (img ? img.height / img.width : 0.6); };
  function drawDefense(ctx, kind, x, base, opts = {}) {
    const w = DEFENSE_W[kind] * (opts.scale || 1), h = defenseH(kind) * (opts.scale || 1), ruin = opts.ruin || 0;
    const img = ART[kind], dark = ART[kind + '-ruin'];
    ctx.save();
    ctx.beginPath(); ctx.rect(x - w, base - h * 2, w * 2, h * 2); ctx.clip();
    const top = base - h + h * 0.28 * ruin;
    if (img) {
      if (ruin < 1) { ctx.globalAlpha = 1 - ruin; ctx.drawImage(img, x - w / 2, top, w, h); }
      if (ruin > 0 && dark) { ctx.globalAlpha = ruin; ctx.drawImage(dark, x - w / 2, top, w, h); }
    } else {
      // Fallback silhouette: a sandstone wall with battlements.
      ctx.fillStyle = ruin ? '#5a4a3a' : '#c9a66b';
      const wallTop = top + h * 0.3;
      ctx.fillRect(x - w / 2, wallTop, w, base - wallTop);
      for (let bx = x - w / 2; bx < x + w / 2 - 8; bx += 18) ctx.fillRect(bx, wallTop - 10, 10, 10);
      ctx.fillStyle = '#222'; ctx.fillRect(x - w / 2 + 10, top - h * 0.1, 18, 12);
    }
    ctx.restore();
  }
  TW.drawDefenseFit = function (ctx, kind, w, h, opts = {}) {
    const dw = DEFENSE_W[kind], dh = defenseH(kind), water = opts.water ?? h * 0.94;
    const s = Math.min(w * 0.86 / dw, water * 0.9 / dh);
    drawDefense(ctx, kind, w / 2, water, { ...opts, scale: s });
  };

  // Height above (x, y) and half-width of an enemy (ships draw at 0.75 scale; defenses
  // stand on y).
  const shipTop = e => {
    if (e.land) return defenseH(e.kind);
    const L = LOOKS[e.look] || LOOKS.sloop, img = artFor(e.look, true);
    return (img ? artWidth(L) * img.height / img.width - L.len * 0.11 : L.tall + L.len * 0.12 + 12) * 0.75;
  };
  const shipHalfW = e => {
    if (e.land) return DEFENSE_W[e.kind] * 0.45;
    const L = LOOKS[e.look] || LOOKS.sloop; return artFor(e.look, true) ? artWidth(L) * 0.32 : L.len * 0.5;
  };

  const Combat = {};
  let S = null;  // active combat state
  const LEDGE_Y = 258;   // where port defenses stand on the siege background's headland

  Combat.start = function (canvas, setup, onEnd) {
    const ctx = canvas.getContext('2d');
    const pShip = TW.SHIP[setup.ship.type];
    // At sea the pirates sit in a line to the right. In a port battle the fort and its
    // batteries stand on the headland and any pirate ships guard the water below it.
    const land = setup.enemies.filter(e => e.land), ships = setup.enemies.filter(e => !e.land);
    const batteries = land.filter(e => e.kind === 'battery');
    const SLOTS = batteries.length > 1 ? [605, 880] : [620];
    const place = (e, i, n) => setup.port
      ? (e.land ? { x: e.kind === 'fort' ? 760 : SLOTS[batteries.indexOf(e)] ?? 905, y: LEDGE_Y }
        : { x: 640 + (n === 1 ? 110 : i * (220 / Math.max(1, n - 1))), y: 418 + (i % 2) * 22 })
      : { x: 560 + (n === 1 ? 160 : i * (300 / Math.max(1, n - 1))), y: 318 + (i % 2) * 18 };
    const enemies = [...land.map((e, i) => [e, i, land.length]), ...ships.map((e, i) => [e, i, ships.length])].map(([e, i, n]) => ({
      ...e, hp: e.hull, maxHp: e.hull, alive: true, sink: 0, ...place(e, i, n),
      guns: Array.from({ length: e.guns }, () => rand(0.8, e.reload * 1.5)),
    }));
    const guns = Array.from({ length: setup.ship.guns }, (_, i) => ({ t: rand(0.3, 1.2), broken: i < setup.ship.broken }));
    S = {
      ctx, canvas, onEnd, enemies, guns, pShip,
      hull: setup.ship.hull, maxHull: pShip.hull,
      ammo: { ...setup.ammo }, target: 0, shots: [], fx: [], t: 0, shake: 0,
      flee: null, fleeCooldown: 0, specialCd: 0, over: false, msg: null, msgT: 0,
      px: 230, py: 420, booty: 0,
    };
    S.port = !!setup.port;
    S.bg = (S.port && TW.images.siege) || TW.images.combat;
    S.waveTop = S.port ? 336 : 300;
    canvas.onclick = (ev) => {
      const r = canvas.getBoundingClientRect();
      const x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height;
      let best = -1, bd = 110;
      S.enemies.forEach((e, i) => { if (!e.alive) return; const d = Math.hypot(e.x - x, e.y - shipTop(e) / 2 - y); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) { S.target = best; TW.sfx('click'); }
    };
    let last = performance.now();
    const loop = (now) => {
      if (!S || S.ctx !== ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt); draw();
      if (!S.over) S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
    Combat.refreshButtons();
  };

  Combat.stop = function () { if (S) cancelAnimationFrame(S.raf); S = null; };
  // For automated checks: run the battle forward `sec` seconds without waiting for frames.
  Combat._advance = function (sec) { for (let t = 0; t < sec && S && !S.over; t += 0.05) update(0.05); if (S && !S.over) draw(); };

  function say(text) { S.msg = text; S.msgT = 2.5; }

  function aliveTarget() {
    if (S.enemies[S.target] && S.enemies[S.target].alive) return S.enemies[S.target];
    const i = S.enemies.findIndex(e => e.alive);
    S.target = i;
    return i >= 0 ? S.enemies[i] : null;
  }

  function shoot(from, to, opts) {
    S.shots.push({ x0: from.x, y0: from.y, x1: to.x + rand(-12, 12), y1: to.y + rand(-6, 6), t: 0,
      dur: opts.dur || rand(0.7, 0.95), arc: opts.arc || rand(40, 80), ...opts });
    S.fx.push({ kind: 'smoke', x: from.x, y: from.y, t: 0, life: 0.8 });
  }

  function update(dt) {
    S.t += dt; S.shake = Math.max(0, S.shake - dt * 3);
    S.msgT -= dt; S.specialCd -= dt; S.fleeCooldown -= dt;
    const target = aliveTarget();
    const fleeingAway = S.flee && S.flee.t > 0.6;
    // player guns
    if (target && !fleeingAway) {
      S.guns.forEach((g, i) => {
        if (g.broken) return;
        g.t -= dt;
        if (g.t <= 0) {
          g.t = S.pShip.reload * rand(0.85, 1.15);
          const hit = Math.random() < (target.land ? 0.9 : 0.72);   // walls are hard to miss
          shoot({ x: S.px + 40 + i * 4, y: S.py - 12 }, { x: target.x, y: target.y - 6 },
            { by: 'p', hit, dmg: 1, tgt: S.enemies.indexOf(target) });
          TW.sfx('cannon');
        }
      });
    }
    // enemy guns
    for (const e of S.enemies) {
      if (!e.alive) continue;
      e.guns.forEach((t, i) => {
        e.guns[i] -= dt;
        if (e.guns[i] <= 0) {
          e.guns[i] = e.reload * rand(0.85, 1.2);
          // Shore gunners are less accurate than pirate crews, and worse at a moving target.
          const hitChance = (e.land ? 0.3 : 0.5) * (fleeingAway ? 0.6 : 1);
          const from = e.land ? { x: e.x - shipHalfW(e) * 0.7, y: e.y - shipTop(e) * 0.4 } : { x: e.x - 30, y: e.y - 8 };
          shoot(from, { x: S.px, y: S.py - 10 }, { by: 'e', hit: Math.random() < hitChance, dmg: 1 });
          if (Math.random() < 0.5) TW.sfx('cannonFar');
        }
      });
    }
    // projectiles
    for (const s of S.shots) {
      s.t += dt / s.dur;
      if (s.t >= 1 && !s.done) {
        s.done = true;
        if (s.by === 'e') {
          if (s.hit && !S.over) {
            S.hull = Math.max(0, S.hull - s.dmg); S.shake = 1;
            S.fx.push({ kind: 'hit', x: s.x1, y: s.y1, t: 0, life: 0.6 });
            TW.sfx('hit');
            if (Math.random() < 0.05) {
              const ok = S.guns.filter(g => !g.broken);
              if (ok.length) { ok[Math.floor(Math.random() * ok.length)].broken = true; say('A cannon was knocked out!'); }
            }
          } else S.fx.push({ kind: 'splash', x: s.x1 + rand(-40, 40), y: S.py + 20, t: 0, life: 0.9 });
        } else {
          const hitSet = s.all ? S.enemies.filter(e => e.alive) : [S.enemies[s.tgt]].filter(e => e && e.alive);
          if (s.hit || s.special) {
            for (const e of hitSet) {
              e.hp -= s.dmg;
              S.fx.push({ kind: s.special === 'fire' ? 'fire' : 'hit', x: e.x + rand(-20, 20), y: e.y - rand(0, 30), t: 0, life: 0.9 });
              if (e.hp <= 0 && e.alive) {
                e.alive = false; S.booty += e.booty;
                TW.sfx(e.land ? 'boom' : 'sink');
                say(e.land ? `${e.name} ${['is silenced!', 'crumbles!', 'falls quiet!'][Math.floor(Math.random() * 3)]}` : `${e.name} is going down!`);
              }
            }
            TW.sfx(s.special ? 'boom' : 'hitFar');
          } else S.fx.push({ kind: 'splash', x: s.x1 + rand(-30, 30), y: s.y1 + 20, t: 0, life: 0.9 });
        }
      }
    }
    S.shots = S.shots.filter(s => !s.done);
    for (const f of S.fx) f.t += dt;
    S.fx = S.fx.filter(f => f.t < f.life);
    for (const e of S.enemies) if (!e.alive) {
      e.sink = Math.min(1, e.sink + dt * (e.land ? 0.6 : 0.35));
      // Wrecked defenses keep smouldering.
      if (e.land && Math.random() < dt * 6) S.fx.push({ kind: 'smoke', x: e.x + rand(-0.35, 0.35) * shipHalfW(e) * 2, y: e.y - shipTop(e) * 0.45, t: 0, life: 1.6 });
    }

    // flee progress
    if (S.flee) {
      S.flee.t += dt;
      S.px = 230 - Math.min(1, S.flee.t / 4) * 180;
      if (S.flee.t >= 4) {
        if (Math.random() < S.flee.chance) return finish('fled');
        S.flee = null; S.px = 230; S.fleeCooldown = 4;
        say('They cut you off! No escape this time.');
        Combat.refreshButtons();
      }
    }
    if (S.hull <= 0) return finish('sunk');
    if (!S.enemies.some(e => e.alive) && S.enemies.every(e => e.sink >= 1)) return finish('win');
  }

  function finish(outcome) {
    if (S.over) return;
    S.over = true;
    draw();
    const res = { outcome, hull: Math.max(0, Math.round(S.hull)), broken: S.guns.filter(g => g.broken).length,
      ammo: S.ammo, booty: S.booty, sunk: S.enemies.filter(e => !e.alive).length };
    const cb = S.onEnd;
    setTimeout(() => cb(res), 700);
  }

  Combat.special = function (id) {
    if (!S || S.over || S.specialCd > 0 || !S.ammo[id]) return;
    const a = TW.AMMO_BY[id], target = aliveTarget();
    if (!target) return;
    S.ammo[id]--; S.specialCd = 2.5;
    const list = a.all ? S.enemies.filter(e => e.alive) : [target];
    list.forEach((e, k) => shoot({ x: S.px + 50, y: S.py - 20 }, { x: e.x, y: e.y - 10 },
      { by: 'p', special: id, all: false, dmg: a.dmg, tgt: S.enemies.indexOf(e), dur: 1 + k * 0.08, arc: 110 }));
    TW.sfx('cannon');
    Combat.refreshButtons();
  };

  Combat.flee = function () {
    if (!S || S.over || S.flee || S.fleeCooldown > 0) return;
    // Only ships can give chase; forts are easy to sail away from.
    const alive = S.enemies.filter(e => e.alive && !e.land).length;
    const chance = S.port ? Math.min(0.95, 0.85 - 0.1 * alive + (S.pShip.speed - 44) / 80)
      : Math.max(0.15, Math.min(0.9, 0.62 - 0.1 * (alive - 1) + (S.pShip.speed - 44) / 60));
    S.flee = { t: 0, chance };
    say('Hard about! Make all sail!');
    Combat.refreshButtons();
  };

  Combat.refreshButtons = function () {
    if (!S) return;
    for (const a of TW.AMMO) {
      const b = document.getElementById('ammo-' + a.id);
      if (b) { b.querySelector('.n').textContent = S.ammo[a.id] || 0; b.disabled = !S.ammo[a.id]; }
    }
    const f = document.getElementById('btn-flee');
    if (f) f.disabled = !!S.flee;
  };

  function draw() {
    const { ctx } = S;
    const sx = S.shake ? rand(-4, 4) * S.shake : 0, sy = S.shake ? rand(-3, 3) * S.shake : 0;
    ctx.save(); ctx.translate(sx, sy);
    if (S.bg) ctx.drawImage(S.bg, -10, -10, W + 20, H + 20);
    else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#6d8aa5'); g.addColorStop(0.5, '#c8d4dc'); g.addColorStop(0.5, '#24506e'); g.addColorStop(1, '#122c40');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const t = S.t;
    // defenses on the headland
    for (const e of S.enemies) if (e.land) drawDefense(ctx, e.kind, e.x, e.y, { ruin: e.sink });
    // wave bands
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(14,40,60,${0.12 + i * 0.03})`;
      ctx.beginPath();
      const by = S.waveTop + i * 42;
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, by + Math.sin(x / 60 + t * (1 + i * 0.2) + i) * 5);
      ctx.lineTo(W, H); ctx.fill();
    }
    // enemies
    S.enemies.forEach((e, i) => {
      if (!e.land) {
        const bob = Math.sin(t * 1.6 + i) * 3;
        ctx.save();
        ctx.globalAlpha = 1 - e.sink * 0.9;
        drawShip(ctx, e.look, e.x, e.y + bob + e.sink * 60, -1,
          { scale: 0.75, tilt: e.sink * 0.5, pirate: true, sail: '#d8d0bc', hullColor: '#3d2a1e', wash: t + i });
        ctx.restore();
      }
      if (e.alive) {
        const bw = 90, bx = e.x - bw / 2, byy = e.y - shipTop(e) - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, byy, bw, 8);
        ctx.fillStyle = '#e8604c'; ctx.fillRect(bx, byy, bw * Math.max(0, e.hp / e.maxHp), 8);
        ctx.font = '14px "IM Fell English SC", Georgia'; ctx.fillStyle = '#fff8e6'; ctx.textAlign = 'center';
        ctx.fillText(e.name, e.x, byy - 4);
        if (i === S.target) {
          ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          const top = shipTop(e); ctx.beginPath(); ctx.ellipse(e.x, e.y - top / 2 + 8, shipHalfW(e) + 12, top / 2 + 14, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    });
    // player
    drawShip(ctx, S.pShip.id, S.px, S.py + Math.sin(t * 1.3) * 4, 1, { scale: 1.05, flag: '#1f6f8b', sail: '#fff8e6', wash: t });
    // shots
    for (const s of S.shots) {
      const x = s.x0 + (s.x1 - s.x0) * s.t, y = s.y0 + (s.y1 - s.y0) * s.t - Math.sin(Math.PI * s.t) * s.arc;
      ctx.fillStyle = s.special === 'fire' ? '#ff8a3d' : s.special === 'keg' ? '#ffd23d' : s.special === 'chain' ? '#bfc7cc' : '#111';
      ctx.beginPath(); ctx.arc(x, y, s.special ? 6 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // effects
    for (const f of S.fx) {
      const k = f.t / f.life;
      if (f.kind === 'smoke') { ctx.fillStyle = `rgba(230,230,225,${0.6 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y - k * 20, 8 + k * 18, 0, Math.PI * 2); ctx.fill(); }
      if (f.kind === 'splash') { ctx.strokeStyle = `rgba(230,245,255,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y, 6 + k * 20, 2 + k * 5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(230,245,255,${0.8 * (1 - k)})`; ctx.fillRect(f.x - 2, f.y - 25 * Math.sin(Math.PI * k), 4, 25 * Math.sin(Math.PI * k)); }
      if (f.kind === 'hit' || f.kind === 'fire') { ctx.fillStyle = f.kind === 'fire' ? `rgba(255,120,40,${1 - k})` : `rgba(255,200,80,${1 - k})`; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 22, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    // HUD: hull bar and gun reload pips
    ctx.fillStyle = 'rgba(10,25,35,0.65)'; ctx.fillRect(16, 16, 300, 64);
    ctx.fillStyle = '#fff8e6'; ctx.font = 'bold 16px Alegreya, Georgia'; ctx.textAlign = 'left';
    ctx.fillText(`Hull ${Math.ceil(S.hull)} / ${S.maxHull}`, 28, 36);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(28, 42, 276, 10);
    ctx.fillStyle = S.hull / S.maxHull < 0.3 ? '#e8604c' : '#5fc28a'; ctx.fillRect(28, 42, 276 * S.hull / S.maxHull, 10);
    S.guns.forEach((g, i) => {
      const x = 28 + (i % 23) * 12, y = 60 + Math.floor(i / 23) * 12;
      if (g.broken) { ctx.fillStyle = '#7a3a30'; ctx.fillRect(x, y, 9, 9); return; }
      const f = 1 - Math.max(0, g.t) / S.pShip.reload;
      ctx.fillStyle = '#334'; ctx.fillRect(x, y, 9, 9);
      ctx.fillStyle = f >= 0.98 ? '#f2b84b' : '#8aa'; ctx.fillRect(x, y + 9 * (1 - f), 9, 9 * f);
    });
    if (!S.guns.length) { ctx.fillStyle = '#f2b84b'; ctx.font = '14px "IM Fell English SC", Georgia'; ctx.fillText('No cannons! Flee or use special ammo.', 28, 70); }
    if (S.msgT > 0) {
      ctx.globalAlpha = Math.min(1, S.msgT);
      ctx.font = '30px "Pirata One", Georgia'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,25,35,0.8)'; ctx.strokeText(S.msg, W / 2, 130);
      ctx.fillStyle = '#fff8e6'; ctx.fillText(S.msg, W / 2, 130);
      ctx.globalAlpha = 1;
    }
    if (S.flee) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 150, 490, 300, 14);
      ctx.fillStyle = '#f2b84b'; ctx.fillRect(W / 2 - 150, 490, 300 * Math.min(1, S.flee.t / 4), 14);
      ctx.fillStyle = '#fff8e6'; ctx.font = '14px "IM Fell English SC", Georgia'; ctx.textAlign = 'center';
      ctx.fillText(`Fleeing… (${Math.round(S.flee.chance * 100)}% chance)`, W / 2, 484);
    }
  }

  TW.Combat = Combat;
})();

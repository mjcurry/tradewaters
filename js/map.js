// World map: coastline rasterization, sea-lane pathfinding, and rendering.
(function () {
  const CELL = 5;
  const M = TW.MAP;
  const COLS = Math.ceil(M.w / CELL), ROWS = Math.ceil(M.h / CELL);
  let grid = null;           // Uint8Array, 1 = land
  const routeCache = {};

  // ---------- Coastlines ----------
  // TW.LAND is coarse: most small islands are bare four-corner boxes. Before anything is
  // drawn or routed, each ring is turned into a natural-looking coast in map pixels: small
  // islands become irregular blobs along their long axis, and every other coast has its
  // straight edges broken up with a seeded wiggle and smoothed. The sailing grid is built
  // from the same shapes, so routes and ports match what the chart shows.
  let COAST = null;
  function hash(n) {
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function noise1(x, seed) {   // smooth value noise, -1..1
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const a = hash(i * 374761 + seed * 668265 + 1), b = hash((i + 1) * 374761 + seed * 668265 + 1);
    return (a * (1 - u) + b * u) * 2 - 1;
  }
  const fbm = (x, seed) => noise1(x, seed) * 0.6 + noise1(x * 2.3, seed + 7) * 0.3 + noise1(x * 5.1, seed + 13) * 0.1;
  function chaikin(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    return out;
  }
  // A small island: an irregular blob with the box's centre, long axis and rough area.
  function islandBlob(pts, seed) {
    const n0 = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n0, cy = pts.reduce((s, p) => s + p[1], 0) / n0;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ca = Math.cos(ang), sa = Math.sin(ang);
    let ra = 0, rb = 0;
    for (const [x, y] of pts) { const u = (x - cx) * ca + (y - cy) * sa, v = -(x - cx) * sa + (y - cy) * ca; ra = Math.max(ra, Math.abs(u)); rb = Math.max(rb, Math.abs(v)); }
    ra = Math.max(2.2, ra * 1.08); rb = Math.max(2.2, rb * 1.08);
    const n = Math.max(16, Math.round((ra + rb) * 2.2)), out = [];
    for (let k = 0; k < n; k++) {
      const t = k / n, a = t * Math.PI * 2;
      // Broad lobes and bays, then finer ragged edges.
      const r = 1 + 0.36 * fbm(t * 4, seed) + 0.14 * fbm(t * 11, seed + 3) + 0.05 * fbm(t * 29, seed + 9);
      const u = Math.cos(a) * ra * r, v = Math.sin(a) * rb * r;
      out.push([cx + u * ca - v * sa, cy + u * sa + v * ca]);
    }
    return chaikin(out);
  }
  // A larger coast: subdivide long edges and push the new points in and out a little.
  function roughen(pts, seed) {
    const out = [];
    let dist = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      const len = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / len, ny = (bx - ax) / len;
      const steps = Math.max(1, Math.ceil(len / 4)), amp = Math.min(2.6, len * 0.12);
      for (let j = 0; j < steps; j++) {
        const t = j / steps, d = j ? fbm((dist + t * len) / 10, seed) * amp : 0;   // keep the original corners
        out.push([ax + (bx - ax) * t + nx * d, ay + (by - ay) * t + ny * d]);
      }
      dist += len;
    }
    return chaikin(out);
  }
  function buildCoast() {
    COAST = TW.LAND.map((ring, i) => {
      const pts = ring.map(([lon, lat]) => TW.project(lon, lat));
      return pts.length <= 6 ? islandBlob(pts, i + 1) : roughen(pts, i + 1);
    });
  }

  function tracePolys(ctx) {
    for (const ring of COAST) {
      ctx.beginPath();
      ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    }
  }

  function buildGrid() {
    const c = document.createElement('canvas');
    c.width = M.w; c.height = M.h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    tracePolys(ctx);
    const data = ctx.getImageData(0, 0, M.w, M.h).data;
    grid = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
      const x = Math.min(M.w - 1, q * CELL + 2), y = Math.min(M.h - 1, r * CELL + 2);
      grid[r * COLS + q] = data[(y * M.w + x) * 4 + 3] > 100 ? 1 : 0;
    }
    // Map edges count as land so routes stay on the chart.
    for (let q = 0; q < COLS; q++) { grid[q] = 1; grid[(ROWS - 1) * COLS + q] = 1; }
    for (let r = 0; r < ROWS; r++) { grid[r * COLS] = 1; grid[r * COLS + COLS - 1] = 1; }
  }

  const land = (q, r) => q < 0 || r < 0 || q >= COLS || r >= ROWS || grid[r * COLS + q] === 1;

  // Move each port to the nearest open-water cell so ships can reach it.
  function placePorts() {
    for (const p of TW.PORTS) {
      const [x, y] = TW.project(p.lon, p.lat);
      let q0 = Math.floor(x / CELL), r0 = Math.floor(y / CELL), found = null;
      for (let rad = 0; rad < 12 && !found; rad++) {
        let best = Infinity;
        for (let dr = -rad; dr <= rad; dr++) for (let dq = -rad; dq <= rad; dq++) {
          if (Math.max(Math.abs(dr), Math.abs(dq)) !== rad) continue;
          if (!land(q0 + dq, r0 + dr)) {
            const d = dq * dq + dr * dr;
            if (d < best) { best = d; found = [q0 + dq, r0 + dr]; }
          }
        }
      }
      p.cell = found;
      p.x = found[0] * CELL + CELL / 2; p.y = found[1] * CELL + CELL / 2;
      p.landX = x; p.landY = y;
    }
  }

  // A* over 8-connected water cells, with a small penalty for hugging the coast.
  function astar(a, b) {
    const N = COLS * ROWS, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const idx = (q, r) => r * COLS + q;
    const h = (q, r) => Math.hypot(q - b[0], r - b[1]);
    const open = [[h(a[0], a[1]), idx(a[0], a[1])]];
    g[idx(a[0], a[1])] = 0;
    const goal = idx(b[0], b[1]);
    const push = (item) => {
      open.push(item);
      let i = open.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; }
    };
    const pop = () => {
      const top = open[0], last = open.pop();
      if (open.length) {
        open[0] = last; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < open.length && open[l][0] < open[m][0]) m = l;
          if (r < open.length && open[r][0] < open[m][0]) m = r;
          if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m;
        }
      }
      return top;
    };
    while (open.length) {
      const [, cur] = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const q = cur % COLS, r = (cur / COLS) | 0;
      for (let dr = -1; dr <= 1; dr++) for (let dq = -1; dq <= 1; dq++) {
        if (!dq && !dr) continue;
        const nq = q + dq, nr = r + dr;
        if (land(nq, nr)) continue;
        if (dq && dr && (land(q + dq, r) || land(q, r + dr))) continue;
        let cost = dq && dr ? 1.4142 : 1;
        if (land(nq + 1, nr) || land(nq - 1, nr) || land(nq, nr + 1) || land(nq, nr - 1)) cost += 0.6;
        const ni = idx(nq, nr), ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; push([ng + h(nq, nr), ni]); }
      }
    }
    const cells = [];
    for (let c = goal; c !== -1; c = from[c]) cells.push([c % COLS, (c / COLS) | 0]);
    return cells.reverse();
  }

  function lineClear(a, b) {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (land(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t))) return false;
    }
    return true;
  }

  // String-pull the cell path into a few straight sea legs.
  function smooth(cells) {
    if (cells.length < 3) return cells;
    const out = [cells[0]];
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !lineClear(cells[i], cells[j])) j--;
      out.push(cells[j]); i = j;
    }
    return out;
  }

  TW.route = function (fromId, toId) {
    const key = fromId < toId ? fromId + '|' + toId : toId + '|' + fromId;
    if (!routeCache[key]) {
      const a = TW.PORT[fromId < toId ? fromId : toId], b = TW.PORT[fromId < toId ? toId : fromId];
      const pts = smooth(astar(a.cell, b.cell)).map(([q, r]) => [q * CELL + CELL / 2, r * CELL + CELL / 2]);
      pts[0] = [a.x, a.y]; pts[pts.length - 1] = [b.x, b.y];
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      routeCache[key] = { pts, len, a: a.id };
    }
    const r = routeCache[key];
    return r.a === fromId ? r : { pts: r.pts.slice().reverse(), len: r.len, a: fromId };
  };

  TW.pointAlong = function (route, t) {
    let d = t * route.len;
    for (let i = 1; i < route.pts.length; i++) {
      const [x0, y0] = route.pts[i - 1], [x1, y1] = route.pts[i];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      if (d <= seg || i === route.pts.length - 1) {
        const f = seg ? Math.min(1, d / seg) : 0;
        return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, ang: Math.atan2(y1 - y0, x1 - x0) };
      }
      d -= seg;
    }
    const p = route.pts[route.pts.length - 1];
    return { x: p[0], y: p[1], ang: 0 };
  };

  // ---------- Rendering ----------
  let baseLayer = null;

  // ---------- The chart ----------
  // Drawn as an old sea chart on parchment: rhumb lines, water-lined coasts, washed land
  // and a graduated border. The painted pieces (parchment, compass rose, sea serpent,
  // title cartouche) load with TW.loadMapArt(); until then the chart uses plain fills.
  const ART = {};
  const INK = '#3b2a1a';
  const COMPASS = { x: 715, y: 405, r: 58 };       // open water in the central Caribbean
  const SERPENT = { x: 150, y: 128, w: 120 };      // the Gulf of Mexico
  const CARTOUCHE = { x: 1018, y: 96, w: 250 };    // the open Atlantic, top right
  TW.loadMapArt = function () {
    const files = { parchment: 'parchment.jpg', compass: 'compass.webp', serpent: 'serpent.webp', cartouche: 'cartouche.webp' };
    return Promise.all(Object.entries(files).map(([k, f]) => new Promise(res => {
      const img = new Image();
      img.onload = () => { ART[k] = img; res(); };
      img.onerror = () => res();
      img.src = 'assets/img/map/' + f;
    }))).then(renderBase);
  };

  function renderBase() {
    const c = document.createElement('canvas');
    c.width = M.w * 2; c.height = M.h * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    // Parchment, washed sea-green where there is water.
    if (ART.parchment) ctx.drawImage(ART.parchment, 0, 0, M.w, M.h);
    else { ctx.fillStyle = '#eadcb5'; ctx.fillRect(0, 0, M.w, M.h); }
    ctx.globalCompositeOperation = 'multiply';
    const sea = ctx.createRadialGradient(M.w * 0.55, M.h * 0.5, 60, M.w * 0.55, M.h * 0.5, M.w * 0.7);
    sea.addColorStop(0, 'rgba(150,200,195,0.55)'); sea.addColorStop(1, 'rgba(110,165,170,0.7)');
    ctx.fillStyle = sea; ctx.fillRect(0, 0, M.w, M.h);
    ctx.globalCompositeOperation = 'source-over';
    // Rhumb lines from the compass rose and a second wind-rose point in the Gulf.
    ctx.strokeStyle = 'rgba(70,45,25,0.16)'; ctx.lineWidth = 0.7;
    for (const [cx, cy] of [[COMPASS.x, COMPASS.y], [235, 175]]) for (let i = 0; i < 32; i++) {
      const a = i * Math.PI / 16;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 1600, cy + Math.sin(a) * 1600); ctx.stroke();
    }
    // Faint latitude and longitude lines.
    ctx.strokeStyle = 'rgba(70,45,25,0.12)'; ctx.setLineDash([2, 4]);
    for (let lon = -95; lon <= -60; lon += 5) { const [x] = TW.project(lon, 0); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, M.h); ctx.stroke(); }
    for (let lat = 10; lat <= 25; lat += 5) { const [, y] = TW.project(0, lat); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(M.w, y); ctx.stroke(); }
    ctx.setLineDash([]);
    // Pale shallows, then concentric water-lines around every coast.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(250,244,225,0.45)'; ctx.lineWidth = 16; strokeRings(ctx);
    for (const [d, a] of [[3, 0.55], [6.5, 0.4], [10.5, 0.28], [15, 0.18]]) waterLine(ctx, d, `rgba(40,85,100,${a})`);
    // Land: an ochre wash with a greener band along the shore, inked coastline.
    ctx.save();
    ctx.beginPath(); for (const ring of COAST) addRing(ctx, ring);
    ctx.fillStyle = 'rgba(205,180,120,0.62)'; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(110,140,70,0.45)'; ctx.lineWidth = 10; strokeRings(ctx);
    ctx.strokeStyle = 'rgba(110,140,70,0.25)'; ctx.lineWidth = 22; strokeRings(ctx);
    ctx.restore();
    drawHills(ctx);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; strokeRings(ctx);
    // Title cartouche.
    if (ART.cartouche) {
      const w = CARTOUCHE.w, h = w * ART.cartouche.height / ART.cartouche.width;
      ctx.drawImage(ART.cartouche, CARTOUCHE.x - w / 2, CARTOUCHE.y - h / 2, w, h);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = INK;
    ctx.font = '16px "IM Fell English SC", Georgia, serif';
    ctx.fillText('Mare Caribbæum', CARTOUCHE.x, CARTOUCHE.y - 11);
    ctx.font = 'italic 8px "IM Fell English", Georgia, serif';
    ctx.fillText('The Western Indies · Anno 1700', CARTOUCHE.x, CARTOUCHE.y);
    // Darkened, toasted edges and a graduated double border.
    const v = ctx.createRadialGradient(M.w / 2, M.h / 2, M.h * 0.45, M.w / 2, M.h / 2, M.w * 0.62);
    v.addColorStop(0, 'rgba(90,55,20,0)'); v.addColorStop(1, 'rgba(90,55,20,0.38)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, M.w, M.h);
    drawBorder(ctx);
    baseLayer = c;
  }
  // Little inked hills scattered over the interior of the larger landmasses, placed by a
  // fixed hash so they never move between visits.
  function drawHills(ctx) {
    const inland = (q, r) => { for (let dr = -3; dr <= 3; dr++) for (let dq = -3; dq <= 3; dq++) if (!land(q + dq, r + dr)) return false; return true; };
    const near = TW.PORTS.map(p => [p.x, p.y]);
    ctx.save(); ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    for (let r = 4; r < ROWS - 4; r += 3) for (let q = 4; q < COLS - 4; q += 3) {
      const h = ((q * 73856093) ^ (r * 19349663)) >>> 0;
      if (h % 100 > 11 || !inland(q, r)) continue;
      const x = q * CELL + (h % 7) - 3, y = r * CELL + ((h >> 3) % 7) - 3, w = 5 + (h >> 6) % 4;
      if (near.some(([px, py]) => Math.abs(px - x) < 60 && Math.abs(py - y) < 14)) continue;   // keep labels clear
      ctx.fillStyle = 'rgba(120,95,55,0.35)';
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.2, y - w * 1.5, x + w * 0.2, y - w * 1.2); ctx.lineTo(x + w * 0.2, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(59,42,26,0.7)';
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.2, y - w * 1.6, x + w, y); ctx.stroke();
    }
    ctx.restore();
  }
  function addRing(ctx, ring) {
    ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  function strokeRings(ctx) { for (const ring of COAST) { ctx.beginPath(); addRing(ctx, ring); ctx.stroke(); } }
  // One thin line following every coast at distance d, as old engravers drew the sea.
  function waterLine(ctx, d, color) {
    const o = document.createElement('canvas'); o.width = M.w * 2; o.height = M.h * 2;
    const x = o.getContext('2d'); x.scale(2, 2); x.lineJoin = 'round';
    x.strokeStyle = color; x.lineWidth = d * 2 + 1; strokeRings(x);
    x.globalCompositeOperation = 'destination-out'; x.strokeStyle = '#000'; x.lineWidth = d * 2 - 0.6; strokeRings(x);
    ctx.drawImage(o, 0, 0, M.w, M.h);
  }
  function drawBorder(ctx) {
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(4, 4, M.w - 8, M.h - 8);
    ctx.lineWidth = 0.8; ctx.strokeRect(10, 10, M.w - 20, M.h - 20);
    // Alternating scale bars between the two rules, a degree apart.
    ctx.fillStyle = INK;
    const step = TW.MAP.k;
    for (let i = 0, x = 10; x < M.w - 10; i++, x += step) if (i % 2) {
      const w = Math.min(step, M.w - 10 - x);
      ctx.fillRect(x, 4.8, w, 5.2); ctx.fillRect(x, M.h - 10, w, 5.2);
    }
    for (let i = 0, y = 10; y < M.h - 10; i++, y += step) if (i % 2) {
      const h = Math.min(step, M.h - 10 - y);
      ctx.fillRect(4.8, y, 5.2, h); ctx.fillRect(M.w - 10, y, 5.2, h);
    }
    ctx.restore();
  }
  function drawCompass(ctx, t) {
    const { x, y, r } = COMPASS;
    ctx.save(); ctx.translate(x, y);
    if (ART.compass) { ctx.globalAlpha = 0.88; ctx.drawImage(ART.compass, -r, -r, r * 2, r * 2); ctx.globalAlpha = 1; }
    else {
      ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, len = i % 2 ? r * 0.55 : r;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.lineTo(Math.cos(a + 0.3) * r * 0.18, Math.sin(a + 0.3) * r * 0.18);
        ctx.lineTo(Math.cos(a - 0.3) * r * 0.18, Math.sin(a - 0.3) * r * 0.18); ctx.closePath();
        i % 2 ? ctx.stroke() : ctx.fill();
      }
    }
    // A brass needle that never quite settles.
    ctx.rotate(Math.sin(t * 0.7) * 0.07 + Math.sin(t * 1.9) * 0.02);
    ctx.fillStyle = '#8a1f14';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.62); ctx.lineTo(3.2, 0); ctx.lineTo(-3.2, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,30,20,0.85)';
    ctx.beginPath(); ctx.moveTo(0, r * 0.62); ctx.lineTo(3.2, 0); ctx.lineTo(-3.2, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawSerpent(ctx, t) {
    if (!ART.serpent) return;
    const { x, y, w } = SERPENT, h = w * ART.serpent.height / ART.serpent.width;
    ctx.save(); ctx.translate(x, y + Math.sin(t * 0.9) * 2.2); ctx.rotate(Math.sin(t * 0.6) * 0.03);
    ctx.globalAlpha = 0.9; ctx.drawImage(ART.serpent, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Other ships working the sea lanes: a few merchantmen and the odd pirate sloop, sailing
  // real routes between charted ports so the chart never sits still.
  let traders = [], lastT = 0;
  const TRADER_LOOKS = ['schooner', 'brigantine', 'barque', 'sloop'];   // the last one flies the black flag
  function newLeg(s, ports, from) {
    const options = ports.filter(id => id !== from);
    s.from = from; s.to = options[Math.floor(Math.random() * options.length)];
    s.route = TW.route(s.from, s.to); s.t = 0; s.speed = 9 + Math.random() * 6;
  }
  function moveTraders(ctx, state, t) {
    const dt = lastT ? Math.min(0.1, t - lastT) : 0; lastT = t;
    const ports = state.known.length > 1 ? state.known : TW.PORTS.map(p => p.id);
    while (traders.length < TRADER_LOOKS.length) {
      const k = traders.length, s = { k, look: TRADER_LOOKS[k], pirate: k === TRADER_LOOKS.length - 1 };
      newLeg(s, ports, ports[Math.floor(Math.random() * ports.length)]);
      s.t = Math.random();
      traders.push(s);
    }
    for (const s of traders) {
      if (!s.route || !s.route.len) { newLeg(s, ports, s.to || ports[0]); continue; }
      s.t += dt * s.speed / s.route.len;
      if (s.t >= 1) { newLeg(s, ports, s.to); continue; }
      const pos = TW.pointAlong(s.route, Math.min(1, s.t));
      const img = TW.shipArt && TW.shipArt(s.look, s.pirate);
      if (!img) continue;
      const w = 17, h = w * img.height / img.width;
      ctx.save(); ctx.translate(pos.x, pos.y + Math.sin(t * 2 + s.k) * 0.6);
      if (Math.cos(pos.ang) < 0) ctx.scale(-1, 1);
      ctx.globalAlpha = 0.82; ctx.drawImage(img, -w / 2, 3 - h, w, h);
      ctx.restore();
    }
  }

  // The player's ship on the chart: its painted sprite when `look` is given and loaded,
  // otherwise a tiny two-sail silhouette. The waterline sits 4 units below (x, y).
  TW.drawShipIcon = function (ctx, x, y, ang, scale = 1, look) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const flip = Math.cos(ang) < 0 ? -1 : 1;
    ctx.scale(flip, 1);
    const img = look && TW.shipArt && TW.shipArt(look);
    if (img) {
      const w = 30, h = w * img.height / img.width;
      ctx.drawImage(img, -w / 2, 4 - h, w, h);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(6, 4); ctx.lineTo(-7, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8e6';
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -14); ctx.lineTo(8, -2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(-1, -11); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  TW.initMap = function () {
    buildCoast(); buildGrid(); placePorts(); renderBase();
  };

  // opts: { state, hover, route, ship:{x,y,ang}, onlyKnown }
  TW.drawMap = function (ctx, opts) {
    const { state } = opts;
    ctx.drawImage(baseLayer, 0, 0, M.w, M.h);
    const t = performance.now() / 1000;
    // Inked wave marks drifting slowly across open water.
    ctx.strokeStyle = 'rgba(45,80,95,0.32)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 46; i++) {
      const x = (i * 197 + t * 4) % M.w, y = (i * 83 + 20) % M.h;
      const q = Math.floor(x / CELL), r = Math.floor(y / CELL);
      if (land(q, r) || land(q + 2, r) || land(q - 2, r)) continue;
      const yy = y + Math.sin(t * 0.8 + i) * 1.5;
      ctx.beginPath(); ctx.moveTo(x - 6, yy); ctx.quadraticCurveTo(x - 3, yy - 3, x, yy); ctx.quadraticCurveTo(x + 3, yy - 3, x + 6, yy); ctx.stroke();
    }
    drawSerpent(ctx, t);
    drawCompass(ctx, t);
    moveTraders(ctx, state, t);
    if (opts.route) {
      ctx.save();
      ctx.setLineDash([4, 5]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(140,35,25,0.85)';
      ctx.beginPath(); opts.route.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.restore();
    }
    for (const p of TW.PORTS) {
      const known = state.known.includes(p.id), here = state.port === p.id && !opts.ship, hov = opts.hover === p.id;
      if ((state.contracts || []).some(c => c.to === p.id)) {   // contract destination: gold ring
        ctx.beginPath(); ctx.arc(p.x, p.y, 11 + Math.sin(performance.now() / 300) * 1.5, 0, Math.PI * 2);
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#c8901c'; ctx.stroke();
      }
      const seized = known && state.hostile && state.hostile[p.id];
      if (seized) {   // held by pirates: pulsing red ring and a skull
        ctx.beginPath(); ctx.arc(p.x, p.y, 12 + Math.sin(performance.now() / 250) * 1.5, 0, Math.PI * 2);
        ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(178,40,28,0.9)'; ctx.stroke();
        ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.fillText('☠', p.x, p.y - 15);
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, hov ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = !known ? 'rgba(90,70,50,0.45)' : seized ? '#2b2b2b' : here ? '#e0a832' : '#b8432f';
      ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = known ? INK : 'rgba(59,42,26,0.5)'; ctx.stroke();
      ctx.font = (hov ? '16px' : '15px') + ' "IM Fell English SC", Georgia, serif';
      ctx.textAlign = p.lon > -64 ? 'right' : 'left';
      const lx = p.x + (p.lon > -64 ? -11 : 11);
      const label = known ? p.name : '?', ly = p.y + 4 + (p.labelDy || 0);   // labelDy: nudge clear of a close neighbour
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(244,234,205,0.8)'; ctx.strokeText(label, lx, ly);
      ctx.fillStyle = known ? INK : 'rgba(59,42,26,0.55)'; ctx.fillText(label, lx, ly);
    }
    const look = state.ship && state.ship.type;
    if (opts.ship) TW.drawShipIcon(ctx, opts.ship.x, opts.ship.y, opts.ship.ang, 1.4, look);
    else { const p = TW.PORT[state.port]; TW.drawShipIcon(ctx, p.x, p.y - 12, 0, 1.1, look); }
    if (opts.storm) {
      ctx.fillStyle = 'rgba(40,50,70,0.35)'; ctx.fillRect(0, 0, M.w, M.h);
    }
  };

  TW.portAt = function (x, y) {
    let best = null, bd = 18;
    for (const p of TW.PORTS) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return best;
  };
})();

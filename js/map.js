// World map: coastline rasterization, sea-lane pathfinding, and rendering.
(function () {
  const CELL = 5;
  const M = TW.MAP;
  const COLS = Math.ceil(M.w / CELL), ROWS = Math.ceil(M.h / CELL);
  let grid = null;           // Uint8Array, 1 = land
  const routeCache = {};

  function tracePolys(ctx) {
    for (const ring of TW.LAND) {
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const [x, y] = TW.project(lon, lat);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
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

  function renderBase() {
    const c = document.createElement('canvas');
    c.width = M.w * 2; c.height = M.h * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    const sea = ctx.createRadialGradient(M.w * 0.55, M.h * 0.5, 50, M.w * 0.55, M.h * 0.5, M.w * 0.75);
    sea.addColorStop(0, '#3fa7b5'); sea.addColorStop(1, '#1d5f7a');
    ctx.fillStyle = sea; ctx.fillRect(0, 0, M.w, M.h);
    // Latitude / longitude graticule
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let lon = -95; lon <= -60; lon += 5) { const [x] = TW.project(lon, 0); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, M.h); ctx.stroke(); }
    for (let lat = 10; lat <= 25; lat += 5) { const [, y] = TW.project(0, lat); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(M.w, y); ctx.stroke(); }
    // Shallow-water halo, then sand, then land
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(160,230,220,0.35)'; ctx.lineWidth = 14; ctx.fillStyle = 'rgba(160,230,220,0.35)';
    strokeAll(ctx);
    ctx.strokeStyle = '#e8d6a3'; ctx.lineWidth = 4; strokeAll(ctx);
    ctx.fillStyle = '#7fae6a'; ctx.strokeStyle = '#7fae6a'; ctx.lineWidth = 1.5;
    for (const ring of TW.LAND) { pathRing(ctx, ring); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    // Compass rose
    drawCompass(ctx, 1060, 500, 38);
    baseLayer = c;
  }
  function pathRing(ctx, ring) {
    ctx.beginPath();
    ring.forEach(([lon, lat], i) => { const [x, y] = TW.project(lon, lat); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  }
  function strokeAll(ctx) { for (const ring of TW.LAND) { pathRing(ctx, ring); ctx.stroke(); ctx.fill(); } }
  function drawCompass(ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255,248,230,0.7)'; ctx.fillStyle = 'rgba(255,248,230,0.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, len = i % 2 ? r * 0.55 : r;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + 0.3) * r * 0.18, Math.sin(a + 0.3) * r * 0.18);
      ctx.lineTo(Math.cos(a - 0.3) * r * 0.18, Math.sin(a - 0.3) * r * 0.18); ctx.closePath();
      i % 2 ? ctx.stroke() : ctx.fill();
    }
    ctx.font = '16px "Pirata One", Georgia'; ctx.textAlign = 'center'; ctx.fillText('N', 0, -r - 6);
    ctx.restore();
  }

  TW.drawShipIcon = function (ctx, x, y, ang, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const flip = Math.cos(ang) < 0 ? -1 : 1;
    ctx.scale(flip, 1);
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(6, 4); ctx.lineTo(-7, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8e6';
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -14); ctx.lineTo(8, -2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(-1, -11); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  TW.initMap = function () {
    buildGrid(); placePorts(); renderBase();
  };

  // opts: { state, hover, route, ship:{x,y,ang}, onlyKnown }
  TW.drawMap = function (ctx, opts) {
    const { state } = opts;
    ctx.drawImage(baseLayer, 0, 0, M.w, M.h);
    const t = performance.now() / 1000;
    // gentle wave glints
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const x = (i * 197 + t * 6) % M.w, y = (i * 83) % M.h;
      const q = Math.floor(x / CELL), r = Math.floor(y / CELL);
      if (land(q, r)) continue;
      ctx.beginPath(); ctx.arc(x, y + Math.sin(t + i) * 2, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    if (opts.route) {
      ctx.save();
      ctx.setLineDash([3, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,248,230,0.9)';
      ctx.beginPath(); opts.route.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      ctx.restore();
    }
    for (const p of TW.PORTS) {
      const known = state.known.includes(p.id), here = state.port === p.id && !opts.ship, hov = opts.hover === p.id;
      ctx.beginPath(); ctx.arc(p.x, p.y, hov ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = !known ? 'rgba(30,40,50,0.55)' : here ? '#f2b84b' : '#e8604c';
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff8e6'; ctx.stroke();
      ctx.font = (hov ? '16px' : '15px') + ' "IM Fell English SC", Georgia, serif';
      ctx.textAlign = p.lon > -64 ? 'right' : 'left';
      const lx = p.x + (p.lon > -64 ? -11 : 11);
      const label = known ? p.name : '?';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,40,55,0.85)'; ctx.strokeText(label, lx, p.y + 4);
      ctx.fillStyle = known ? '#fff8e6' : '#c9d6dc'; ctx.fillText(label, lx, p.y + 4);
    }
    if (opts.ship) TW.drawShipIcon(ctx, opts.ship.x, opts.ship.y, opts.ship.ang, 1.4);
    else { const p = TW.PORT[state.port]; TW.drawShipIcon(ctx, p.x, p.y - 12, 0, 1.1); }
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

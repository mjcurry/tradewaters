// Market simulation: each port holds a price and stock per good.
// Prices drift back toward a port-specific base, get pushed by random shortages and gluts,
// and react to the player's own buying and selling in two ways: an instant per-unit move
// (elastic) that fades in a couple of weeks, and a lasting "pressure" that shifts the
// port's base price and fades over a couple of months. Pressure is what stops a single
// two-port shuttle from paying forever: keep draining one port and flooding another and
// the margin closes, so traders have to rotate routes.
(function () {
  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const SELL_SPREAD = 0.9;
  const PRESSURE = 0.6;         // lasting price shift per 'depth' units traded
  const PRESSURE_DECAY = 0.99; // per day: half-life of about 69 days

  function stockCap(port, good, idx) {
    const scale = Math.max(0.25, 1 - idx * 0.08);
    if (good.id === 'gems') return port.makes.includes('gems') ? Math.round(rand(10, 30)) : 0;
    if (port.makes.includes(good.id)) return Math.round(rand(180, 400) * scale);
    if (port.wants.includes(good.id)) return Math.round(rand(0, 15) * scale);
    return Math.round(rand(25, 90) * scale);
  }

  function baseFactor(port, good) {
    if (port.makes.includes(good.id)) return rand(0.05, 0.25);
    if (port.wants.includes(good.id)) return rand(0.75, 0.95);
    return rand(0.35, 0.65);
  }

  TW.initMarket = function (state) {
    state.market = {};
    for (const port of TW.PORTS) {
      const m = state.market[port.id] = {};
      TW.GOODS.forEach((g, i) => {
        const base = g.min + (g.max - g.min) * baseFactor(port, g);
        const cap = stockCap(port, g, i);
        m[g.id] = { base, price: base * rand(0.9, 1.1), stock: cap, cap, mult: 1, until: 0 };
      });
    }
  };

  TW.tickMarket = function (state) {
    for (const port of TW.PORTS) {
      const m = state.market[port.id];
      for (const g of TW.GOODS) {
        const e = m[g.id];
        if (e.until && state.day >= e.until) { e.mult = 1; e.until = 0; e.kind = null; }
        e.press = (e.press || 0) * PRESSURE_DECAY;
        const target = e.base * e.mult * (1 + e.press);
        e.price += (target - e.price) * 0.05 + gauss() * (g.max - g.min) * 0.02;
        e.price = Math.min(g.max * 1.6, Math.max(g.min * 0.5, e.price));
        e.stock += (e.cap * (e.kind === 'glut' ? 2 : 1) - e.stock) * 0.06;
      }
    }
    // Roughly one new market event somewhere every ten days.
    if (Math.random() < 0.1) {
      const port = TW.PORTS[Math.floor(Math.random() * TW.PORTS.length)];
      const g = TW.GOODS[Math.floor(Math.random() * TW.GOODS.length)];
      const e = state.market[port.id][g.id];
      if (!e.kind) {
        e.kind = Math.random() < 0.55 ? 'shortage' : 'glut';
        e.mult = e.kind === 'shortage' ? rand(1.45, 1.9) : rand(0.45, 0.65);
        e.until = state.day + Math.round(rand(15, 45));
        if (e.kind === 'shortage') e.stock *= 0.3;
      }
    }
  };

  TW.unitBuy = e => Math.max(1, Math.round(e.price));
  TW.unitSell = e => Math.max(1, Math.round(e.price * SELL_SPREAD));

  // Cost of buying qty units, walking the price up unit by unit.
  TW.quoteBuy = function (state, portId, goodId, qty) {
    const e = state.market[portId][goodId], g = TW.GOOD[goodId];
    let p = e.price, total = 0;
    for (let i = 0; i < qty; i++) { total += Math.max(1, Math.round(p)); p *= 1 + g.elastic; }
    return { total, after: p };
  };
  TW.quoteSell = function (state, portId, goodId, qty) {
    const e = state.market[portId][goodId], g = TW.GOOD[goodId];
    let p = e.price, total = 0;
    for (let i = 0; i < qty; i++) { total += Math.max(1, Math.round(p * SELL_SPREAD)); p *= 1 - g.elastic; }
    return { total, after: p };
  };

  // Largest qty purchasable with given cash, space and stock.
  TW.maxBuy = function (state, portId, goodId, cash, space) {
    const e = state.market[portId][goodId], g = TW.GOOD[goodId];
    const limit = Math.min(space, Math.floor(e.stock));
    let p = e.price, total = 0, n = 0;
    while (n < limit) {
      const c = Math.max(1, Math.round(p));
      if (total + c > cash) break;
      total += c; p *= 1 + g.elastic; n++;
    }
    return n;
  };

  TW.applyBuy = function (state, portId, goodId, qty) {
    const q = TW.quoteBuy(state, portId, goodId, qty), e = state.market[portId][goodId];
    e.price = q.after; e.stock -= qty;
    e.press = Math.min(0.9, (e.press || 0) + qty / TW.GOOD[goodId].depth * PRESSURE);
    return q.total;
  };
  TW.applySell = function (state, portId, goodId, qty) {
    const q = TW.quoteSell(state, portId, goodId, qty), e = state.market[portId][goodId];
    e.price = q.after; e.stock += qty * 0.5;
    e.press = Math.max(-0.5, (e.press || 0) - qty / TW.GOOD[goodId].depth * PRESSURE);
    return q.total;
  };

  // A tavern rumor: prefer real active events, otherwise the most extreme price deviation.
  TW.rumor = function (state) {
    const known = state.known.filter(id => id !== state.port);
    const goods = TW.GOODS.filter(g => TW.goodUnlocked(state, g));
    const events = [];
    for (const pid of known) for (const g of goods) {
      const e = state.market[pid][g.id];
      if (e.kind) events.push({ pid, g, e });
    }
    let pick;
    if (events.length && Math.random() < 0.75) pick = events[Math.floor(Math.random() * events.length)];
    else {
      let best = 0;
      for (const pid of known) for (const g of goods) {
        const e = state.market[pid][g.id];
        const dev = Math.abs((e.price - (g.min + g.max) / 2) / (g.max - g.min)) * rand(0.6, 1.4);
        if (dev > best) { best = dev; pick = { pid, g, e }; }
      }
    }
    if (!pick) return 'The tavern is quiet tonight. Nobody has much to say.';
    const port = TW.PORT[pick.pid].name, good = pick.g.name.toLowerCase();
    const high = pick.e.kind ? pick.e.kind === 'shortage' : pick.e.price > (pick.g.min + pick.g.max) / 2;
    const lines = high ? [
      `A sailor leans in: “${port} is crying out for ${good}. They’ll pay near anything.”`,
      `“Just came from ${port},” says a deckhand. “Merchants there would kill for ${good}.”`,
      `Word on the docks: ${good} fetches a fine price in ${port} these days.`,
    ] : [
      `“${port} is drowning in ${good},” grumbles a trader. “Can’t give it away.”`,
      `A fisherman laughs: “${good} in ${port}? Cheap as seawater right now.”`,
      `Rumor has it ${port} warehouses are overflowing with ${good}. Prices have collapsed.`,
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  };
})();

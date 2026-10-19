// Nations, contraband and contracts.
//
// Each port answers to a nation, and some nations ban certain foreign goods. Banned goods
// can still be sold on the black market, but navy patrols watch the approaches and may
// stop a ship carrying them. Contracts give traders goals beyond buy-low-sell-high:
//   cargo    - deliver goods to a port by a deadline (Harbor Office), bond forfeited if late
//   courier  - carry sealed dispatches on a tight deadline (Harbor Office), no cargo needed
//   smuggle  - run contraband into a port that bans it, for a big payout (Tavern)
(function () {
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];

  TW.NATIONS = {
    spanish: { name: 'Spanish', navy: 'a Spanish guarda costa', bans: ['cloth', 'rum'] },
    english: { name: 'English', navy: 'a Royal Navy sloop', bans: ['tobacco'] },
    french:  { name: 'French',  navy: 'a French naval frigate', bans: ['muskets'] },
    dutch:   { name: 'Dutch',   navy: 'a Dutch patrol', bans: [] },
    danish:  { name: 'Danish',  navy: 'a Danish patrol', bans: [] },
    free:    { name: 'Free',    navy: 'nobody in particular', bans: [] },
  };
  TW.NATION = {
    havana: 'spanish', merida: 'spanish', trujillo: 'spanish', sanjuan: 'spanish', portobelo: 'spanish',
    cartagena: 'spanish', caracas: 'spanish', puertorico: 'spanish', santodomingo: 'spanish',
    belize: 'english', barbados: 'english', antigua: 'english', nevis: 'english', portroyal: 'english', cayman: 'english',
    martinique: 'french', guadeloupe: 'french', curacao: 'dutch', stthomas: 'danish', freeport: 'free',
  };
  TW.nationOf = portId => TW.NATIONS[TW.NATION[portId] || 'free'];
  TW.banned = (portId, goodId) => TW.nationOf(portId).bans.includes(goodId);

  TW.MAX_CONTRACTS = 3;
  const BOARD_DAYS = 20;   // boards refresh this often

  let nextId = 1;
  const id = S => `c${S.day}-${nextId++}-${Math.floor(Math.random() * 1e4)}`;

  // ctx: { days(from, to), cargoCap, danger, unlocked(good) }
  function cargoOffer(S, from, ctx) {
    const dests = S.known.filter(p => p !== from);
    const to = pick(dests);
    const tp = TW.PORT[to];
    const goods = TW.GOODS.filter(g => g.id !== 'gems' && ctx.unlocked(g) && !TW.banned(to, g.id));
    const wanted = goods.filter(g => tp.wants.includes(g.id));
    const g = pick(wanted.length && Math.random() < 0.7 ? wanted : goods);
    const qty = Math.max(10, Math.min(300, Math.round(ctx.cargoCap * rand(0.25, 0.6) / 5) * 5));
    const days = ctx.days(from, to);
    const sell = S.market[to][g.id].base * 0.9;   // what the open market there would pay
    const reward = Math.round((qty * sell * rand(1.15, 1.35) + days * 60 * (1 + ctx.danger / 12)) / 10) * 10;
    return { id: id(S), kind: 'cargo', from, to, good: g.id, qty, reward, bond: Math.round(reward * 0.15 / 10) * 10,
      due: S.day + days * 2 + irand(8, 15), issuer: `the merchants of ${TW.PORT[from].name}` };
  }

  function courierOffer(S, from, ctx) {
    const to = pick(S.known.filter(p => p !== from));
    const days = ctx.days(from, to);
    const reward = Math.round((300 + days * 140) * (1 + ctx.danger / 14) / 10) * 10;
    return { id: id(S), kind: 'courier', from, to, reward, bond: Math.round(reward * 0.25 / 10) * 10,
      due: S.day + days + irand(3, 6), issuer: `the governor of ${TW.PORT[from].name}` };
  }

  function smuggleOffer(S, from, ctx) {
    const options = [];
    for (const to of S.known) if (to !== from) for (const gid of TW.nationOf(to).bans) if (ctx.unlocked(TW.GOOD[gid])) options.push([to, gid]);
    if (!options.length) return null;
    const [to, gid] = pick(options);
    const qty = Math.max(5, Math.min(200, Math.round(ctx.cargoCap * rand(0.15, 0.4) / 5) * 5));
    const days = ctx.days(from, to);
    const reward = Math.round(qty * S.market[to][gid].base * 0.9 * rand(1.4, 1.7) / 10) * 10;
    return { id: id(S), kind: 'smuggle', from, to, good: gid, qty, reward, bond: 0,
      due: S.day + days * 2 + irand(10, 18), issuer: 'a hooded figure in the corner' };
  }

  // The current offers on a port's board (Harbor Office or Tavern), regenerated every few weeks.
  TW.boardOffers = function (S, portId, where, ctx) {
    S.boards = S.boards || {};
    const key = portId + ':' + where;
    let b = S.boards[key];
    if (!b || S.day - b.day >= BOARD_DAYS) {
      const offers = [];
      if (where === 'harbor') {
        offers.push(cargoOffer(S, portId, ctx), cargoOffer(S, portId, ctx));
        if (Math.random() < 0.8) offers.push(courierOffer(S, portId, ctx));
      } else {
        const n = Math.random() < 0.5 ? 1 : 2;
        for (let i = 0; i < n; i++) { const o = smuggleOffer(S, portId, ctx); if (o) offers.push(o); }
      }
      b = S.boards[key] = { day: S.day, offers };
    }
    return b.offers;
  };

  TW.takeOffer = function (S, portId, where, offerId) {
    const b = S.boards && S.boards[portId + ':' + where];
    const i = b ? b.offers.findIndex(o => o.id === offerId) : -1;
    if (i < 0) return null;
    const [c] = b.offers.splice(i, 1);
    (S.contracts = S.contracts || []).push(c);
    return c;
  };

  // A short, human description of a contract.
  TW.describeContract = function (c) {
    const to = TW.PORT[c.to].name;
    if (c.kind === 'courier') return `Carry sealed dispatches to ${to}`;
    const g = TW.GOOD[c.good];
    return `${c.kind === 'smuggle' ? 'Smuggle' : 'Deliver'} ${c.qty} ${g.name.toLowerCase()} to ${to}`;
  };
  TW.contractIcon = c => (c.kind === 'courier' ? '✉️' : c.kind === 'smuggle' ? '🕯️' : TW.GOOD[c.good].icon);
})();

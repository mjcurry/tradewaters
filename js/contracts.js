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

  // Charted ports other than `from` that are open for trade (not held by pirates).
  const openPorts = (S, from) => S.known.filter(p => p !== from && !(S.hostile && S.hostile[p]));

  // ---------- Who posts a job, and why ----------
  // Respectable clients carry names that suit the port's nation; tavern jobs come from
  // people who would rather not give one. Reasons fill {good}, {to} and {from}.
  const NAMES = {
    spanish: ['Don Rodrigo Alvarado', 'Doña Inés Valcárcel', 'Don Mateo Quiroga', 'Doña Catalina Ibarra', 'Don Esteban Ortíz', 'Doña Leonor Zamora', 'Don Felipe Arriaga'],
    english: ['Mr. Josiah Pell', 'Mrs. Abigail Thorne', 'Mr. Nathaniel Crewe', 'Mrs. Hester Bligh', 'Mr. Ezekiel Marsh', 'Mrs. Prudence Lowell', 'Mr. Gideon Fairweather'],
    french:  ['Monsieur Étienne Lavalle', 'Madame Colette Arnaud', 'Monsieur Gaspard Delisle', 'Madame Sidonie Roux', 'Monsieur Achille Ferrand'],
    dutch:   ['Mijnheer Pieter van Dam', 'Mevrouw Griet Hoorn', 'Mijnheer Joost Verbeek', 'Mevrouw Aaltje Smit'],
    danish:  ['Herr Niels Holm', 'Fru Karen Juhl', 'Herr Anders Bech', 'Fru Mette Lund'],
    free:    ['Captain Silas Reed', 'Widow Mercy Lane', 'Old Tobias Grey', 'Madam Ruby Cutler'],
  };
  const ROLES = {   // each describes the one person named before it
    cargo: ['a sugar planter', 'quartermaster of the garrison', 'a widowed shipowner', "steward to the bishop", 'factor of a trading house',
      "the governor's steward", 'a tavern keeper with big plans', 'master of the shipyard'],
    courier: ["the governor's secretary", 'the harbor master', 'clerk of a banking house', "the admiralty's agent", "the bishop's secretary", 'a nervous lieutenant'],
    passenger: ['the harbor master', "the governor's steward", 'a worried parent', 'factor of a merchant house'],
  };

  const SHADY = ['a hooded figure in the corner', 'a one-eyed boatswain', 'a clerk from the customs house, sweating', 'a woman in a veiled hat',
    'a man who says his name is Smith', 'the barkeep’s cousin', 'a priest who swears like a gunner', 'a pair of twins who finish each other’s sentences'];
  const REASONS = {
    cargo: ['{to} is short of {good}, and prices there are climbing.', 'A wedding feast in {to} needs {good}, and the bride’s family will not wait.',
      'The garrison at {to} was promised {good} months ago.', 'Settling an old debt with a trading house in {to}.',
      'A rival bought up every crate in {to}. Beat him to the wharf.', 'A new warehouse in {to} opens soon and its shelves are bare.',
      'The governor of {to} is hosting a feast and wants {good} on the tables.'],
    courier: ['Sealed orders for the garrison commander at {to}.', 'A love letter. Do not read it. Please.', 'Bills of exchange the bank in {to} must have before month’s end.',
      'News of a treaty that will move prices in {to}.', 'A pardon for a man due to hang in {to}. Hurry.', 'Plans for the new fortifications at {to}. Guard them.'],
    passenger: ['passenger:a disgraced nobleman|He pays well and talks constantly.', 'passenger:a ship’s surgeon|{to} has fever in the streets and no one to treat it.',
      'passenger:a young bride-to-be|Her intended waits in {to}. So does her dowry.', 'passenger:a botanist and his crates of seedlings|He insists the seedlings sleep below decks.',
      'passenger:a retired admiral|He will tell you how to sail. Often.'],
    shadyPassenger: ['passenger:a fugitive with a full purse|Somebody in {from} wants him back badly.', 'passenger:a deserter from the garrison|No uniform, no questions, no names.',
      'passenger:a cardsharp who cheated the wrong man|He swears it was luck.'],
    smuggle: ['No questions, no receipts.', 'The customs men in {to} owe me a favour. They just don’t know it yet.', 'Land it after dark. Someone will be waiting.',
      'Half now, half when it’s ashore. Don’t get caught; I won’t know you.', 'Sell it in {to} and the whole town will drink to your health. Quietly.'],
  };
  const fill = (t, c) => t.replace('{good}', c.good ? TW.GOOD[c.good].name.toLowerCase() : '').replace('{to}', TW.PORT[c.to].name).replace('{from}', TW.PORT[c.from].name);
  const client = (from, kind) => `${pick(NAMES[TW.NATION[from] || 'free'] || NAMES.free)}, ${pick(ROLES[kind])}`;

  // ctx: { days(from, to), cargoCap, danger, unlocked(good) }
  function cargoOffer(S, from, ctx) {
    const dests = openPorts(S, from);
    if (!dests.length) return null;
    const to = pick(dests);
    const tp = TW.PORT[to];
    const goods = TW.GOODS.filter(g => g.id !== 'gems' && ctx.unlocked(g) && !TW.banned(to, g.id));
    const wanted = goods.filter(g => tp.wants.includes(g.id));
    const g = pick(wanted.length && Math.random() < 0.7 ? wanted : goods);
    const qty = Math.max(10, Math.min(300, Math.round(ctx.cargoCap * rand(0.25, 0.6) / 5) * 5));
    const days = ctx.days(from, to);
    const sell = S.market[to][g.id].base * 0.9;   // what the open market there would pay
    const reward = Math.round((qty * sell * rand(1.15, 1.35) + days * 60 * (1 + ctx.danger / 12)) / 10) * 10;
    const c = { id: id(S), kind: 'cargo', where: 'harbor', from, to, good: g.id, qty, reward, bond: Math.round(reward * 0.15 / 10) * 10,
      due: S.day + days * 2 + irand(8, 15), issuer: client(from, 'cargo') };
    c.note = fill(pick(REASONS.cargo), c);
    return finish(c, S, days, { urgent: 0.25, risky: 0.2 });
  }

  function courierOffer(S, from, ctx) {
    const dests = openPorts(S, from);
    if (!dests.length) return null;
    const to = pick(dests);
    const days = ctx.days(from, to);
    const reward = Math.round((300 + days * 140) * (1 + ctx.danger / 14) / 10) * 10;
    const c = { id: id(S), kind: 'courier', where: 'harbor', from, to, reward, bond: Math.round(reward * 0.25 / 10) * 10,
      due: S.day + days + irand(3, 6), issuer: client(from, 'courier') };
    c.note = fill(pick(REASONS.courier), c);
    return finish(c, S, days, { urgent: 0.3, risky: 0.15 });
  }

  // A passenger needs no hold space, only a berth and a timely arrival. Respectable ones
  // come through the Harbor Office; the tavern offers the kind who pay more and ask less.
  function passengerOffer(S, from, ctx, shady) {
    const dests = openPorts(S, from);
    if (!dests.length) return null;
    const to = pick(dests);
    const days = ctx.days(from, to);
    const reward = Math.round((500 + days * 190) * (1 + ctx.danger / 14) * (shady ? 1.5 : 1) / 10) * 10;
    const c = { id: id(S), kind: 'passenger', where: shady ? 'tavern' : 'harbor', from, to, reward,
      bond: shady ? 0 : Math.round(reward * 0.2 / 10) * 10, due: S.day + Math.round(days * 1.5) + irand(4, 8),
      issuer: shady ? pick(SHADY) : client(from, 'passenger') };
    const [who, why] = pick(shady ? REASONS.shadyPassenger : REASONS.passenger).slice('passenger:'.length).split('|');
    c.passenger = who; c.note = fill(why, c);
    return finish(c, S, days, shady ? { risky: 0.5 } : { urgent: 0.25 });
  }

  function smuggleOffer(S, from, ctx) {
    const options = [];
    for (const to of openPorts(S, from)) for (const gid of TW.nationOf(to).bans) if (ctx.unlocked(TW.GOOD[gid])) options.push([to, gid]);
    if (!options.length) return null;
    const [to, gid] = pick(options);
    const qty = Math.max(5, Math.min(200, Math.round(ctx.cargoCap * rand(0.15, 0.4) / 5) * 5));
    const days = ctx.days(from, to);
    const reward = Math.round(qty * S.market[to][gid].base * 0.9 * rand(1.4, 1.7) / 10) * 10;
    const c = { id: id(S), kind: 'smuggle', where: 'tavern', from, to, good: gid, qty, reward, bond: 0,
      due: S.day + days * 2 + irand(10, 18), issuer: pick(SHADY) };
    c.note = fill(pick(REASONS.smuggle), c);
    return finish(c, S, days, { urgent: 0.2, risky: 0.3 });
  }

  // Twists that change how a job plays, each with its premium:
  //   urgent - only a little slack beyond the sailing time, for 45% more pay
  //   risky  - word of the cargo has leaked, so pirates are likelier on that voyage (+35%)
  // The bond is recomputed from the final reward.
  function finish(c, S, days, odds) {
    if (Math.random() < (odds.urgent || 0)) {
      c.urgent = true;
      c.due = S.day + Math.max(days + 2, Math.round(days * 1.25) + 1);
      c.reward = Math.round(c.reward * 1.45 / 10) * 10;
    }
    if (Math.random() < (odds.risky || 0)) { c.risky = true; c.reward = Math.round(c.reward * 1.35 / 10) * 10; }
    if (c.bond) c.bond = Math.round(c.reward * (c.kind === 'cargo' ? 0.15 : c.kind === 'courier' ? 0.25 : 0.2) / 10) * 10;
    return c;
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
        if (Math.random() < 0.8) offers.push(Math.random() < 0.6 ? courierOffer(S, portId, ctx) : passengerOffer(S, portId, ctx, false));
      } else {
        const n = Math.random() < 0.5 ? 1 : 2;
        for (let i = 0; i < n; i++) offers.push(smuggleOffer(S, portId, ctx));
        if (Math.random() < 0.35) offers.push(passengerOffer(S, portId, ctx, true));
      }
      b = S.boards[key] = { day: S.day, offers: offers.filter(Boolean) };
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
    if (c.kind === 'passenger') return `Give passage to ${c.passenger} bound for ${to}`;
    const g = TW.GOOD[c.good];
    return `${c.kind === 'smuggle' ? 'Smuggle' : 'Deliver'} ${c.qty} ${g.name.toLowerCase()} to ${to}`;
  };
  TW.contractIcon = c => (c.kind === 'courier' ? '✉️' : c.kind === 'passenger' ? '🧳' : c.kind === 'smuggle' ? '🕯️' : TW.GOOD[c.good].icon);
  // Where a contract was posted (older saves predate the field).
  TW.contractWhere = c => c.where || (c.kind === 'smuggle' ? 'tavern' : 'harbor');
})();

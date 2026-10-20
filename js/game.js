// Tradewaters: game state, screens, and the voyage loop.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const gold = n => `<span class="gold">${fmt(n)}</span>`;
  const SAVE_KEY = 'tradewaters-save-v1';
  const CAREER_DAYS = 3650;
  const BANK_RATE = 0.015;     // per month, about 20% a year
  const LOAN_RATE = 0.10;      // per month
  const OVERDUE_RATE = 0.15;   // per month once a loan is past due
  const LOAN_TERM = 90;        // days until a loan falls due
  const COLLECTION_FEE = 0.1;  // added when the moneylender's collectors come calling
  const START_PORTS = ['portroyal', 'havana', 'barbados', 'curacao', 'cartagena', 'stthomas'];
  const MILESTONES = [20000, 50000, 100000, 200000, 400000, 700000, 1000000, 1500000, 2500000, 4000000];

  TW.images = {};
  let S = null;              // game state
  let view = { screen: 'title', tab: 'market' };

  // ---------- helpers ----------
  // Net worth counts cargo at what you paid, so buying goods doesn't look like losing money.
  const worth = (s = S) => s.cash + s.bank - s.debt +
    Object.values(s.ship.cargo).reduce((a, c) => a + c.qty * c.cost, 0);
  TW.goodUnlocked = (s, g) => s.peakWorth >= g.unlock;
  // ---------- Curiosities and fittings ----------
  // Their effects multiply together (see TW.CURIOS in data.js); switches just turn on.
  const curioFx = it => { const c = TW.CURIO[it.id]; return it.variant === 'fake' ? {} : it.variant === 'cursed' ? c.cursed.fx : c.fx; };
  const curioDesc = it => { const c = TW.CURIO[it.id]; return it.variant === 'fake' ? 'Worthless. Stuffed with sawdust.' : it.variant === 'cursed' ? c.cursed.desc : c.desc; };
  function mods(fittings = S.ship.fittings, items = S.items) {
    const m = { hull: 1, cargo: 1, speed: 1, reload: 1, storm: 1, pirates: 1, patrol: 1, enemyAim: 1, bankRate: 1, loanRate: 1, loanCap: 1, drinks: 1, rumorTrue: false, noLoans: false };
    const apply = fx => { for (const [k, v] of Object.entries(fx)) m[k] = typeof v === 'boolean' ? m[k] || v : m[k] * v; };
    for (const it of items || []) apply(curioFx(it));
    for (const id of fittings || []) apply(TW.FITTING[id].fx);
    return m;
  }
  // A ship's working numbers once fittings and curiosities are counted.
  function statsFor(type, fittings) {
    const b = TW.SHIP[type], m = mods(fittings);
    return { ...b, hull: Math.round(b.hull * m.hull), cargo: Math.round(b.cargo * m.cargo), speed: Math.round(b.speed * m.speed), reload: Math.round(b.reload * m.reload * 100) / 100 };
  }
  const shipDef = () => statsFor(S.ship.type, S.ship.fittings);
  const cargoQty = () => Object.values(S.ship.cargo).reduce((a, c) => a + c.qty, 0);
  const usedSpace = () => cargoQty() + S.ship.guns * TW.GUN_SPACE;
  const freeSpace = () => shipDef().cargo - usedSpace();
  const rankOf = w => { let r = TW.RANKS[0][1]; for (const [min, t] of TW.RANKS) if (w >= min) r = t; return r; };
  const port = () => TW.PORT[S.port];
  const has = c => port().svc.includes(c);

  function dateStr(day) {
    let y = 1700 + Math.floor(day / 365), d = day % 365, m = 0;
    while (d >= TW.MONTH_DAYS[m]) { d -= TW.MONTH_DAYS[m]; m++; }
    return `${d + 1} ${TW.MONTHS[m]} ${y}`;
  }
  const monthIndex = day => { let d = day % 365, m = 0; while (d >= TW.MONTH_DAYS[m]) { d -= TW.MONTH_DAYS[m]; m++; } return Math.floor(day / 365) * 12 + m; };

  function log(text) { S.log.unshift({ day: S.day, text }); S.log.length = Math.min(S.log.length, 100); }
  function toast(html, kind = '') {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = html;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3200);
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }

  // ---------- new game ----------
  // The chosen difficulty drives TW.diff, which combat, markets and costs read.
  function applyDifficulty() { TW.diff = TW.DIFFICULTY[S.difficulty] || TW.DIFFICULTY.easy; }
  const diffName = () => (TW.DIFFICULTY[S.difficulty] || TW.DIFFICULTY.easy).name;

  function newGame(name, mode, home, difficulty = 'medium') {
    S = {
      v: 1, name: name || 'Captain', mode, difficulty, day: 0, cash: 6000, bank: 0, debt: 0, peakWorth: 6000,
      port: home, home, ship: { type: 'sloop', hull: TW.SHIP.sloop.hull, guns: 2, broken: 0, cargo: {} },
      ammo: { chain: 0, fire: 0, keg: 0 }, known: [], seen: {}, log: [], offers: {}, offerMonth: -1,
      milestone: 0, stats: { voyages: 0, won: 0, fled: 0, lost: 0, storms: 0, profit: 0, booty: 0 },
      visited: { [home]: true },
    };
    applyDifficulty();
    const hp = TW.PORT[home];
    S.known = TW.PORTS.slice().sort((a, b) => Math.hypot(a.x - hp.x, a.y - hp.y) - Math.hypot(b.x - hp.x, b.y - hp.y))
      .slice(0, 9).map(p => p.id);
    TW.initMarket(S);
    for (let i = 0; i < 20; i++) TW.tickMarket(S);
    refreshOffers();
    log(`${S.name} takes command of a humble sloop in ${hp.name}. Buy low, sell high, and watch the horizon.`);
    remember();
    save();
  }

  function refreshOffers() {
    const m = monthIndex(S.day);
    if (S.offerMonth === m) return;
    S.offerMonth = m; S.offers = {};
    for (const p of TW.PORTS) if (p.svc.includes('S')) {
      const pool = TW.SHIPS.filter(s => s.unlock <= Math.max(S.peakWorth * 1.6, 60000));
      const picks = new Set();
      for (let i = 0; i < 3; i++) picks.add(pool[Math.floor(Math.random() * pool.length)].id);
      S.offers[p.id] = [...picks].map(id => ({ id, price: Math.round(TW.SHIP[id].price * rand(0.9, 1.12) / 100) * 100 }));
    }
  }

  // ----- Hostile ports -----
  // Now and then pirates seize a port and close its harbor. The only way in is to fight
  // past its fort and gun batteries; otherwise the town is retaken after a few months.
  const hostile = () => S.hostile || (S.hostile = {});
  const isHostile = id => !!(S.hostile && S.hostile[id]);
  function hostileTick() {
    for (const [id, h] of Object.entries(hostile())) if (S.day >= h.until) {
      delete S.hostile[id];
      log(`${TW.PORT[id].name} has been retaken from ${h.captain}'s pirates. Its harbor is open again.`);
      toast(`⚓ ${TW.PORT[id].name} is open again.`, 'good');
    }
    // After the first two months, about one port every couple of months, two at most.
    if (S.day < 60 || Object.keys(hostile()).length >= 2 || Math.random() > 1 / 55) return;
    const options = S.known.filter(id => id !== S.port && !isHostile(id));
    if (!options.length) return;
    const id = options[Math.floor(Math.random() * options.length)];
    const captain = TW.PIRATE_NAMES[Math.floor(Math.random() * TW.PIRATE_NAMES.length)];
    S.hostile[id] = { since: S.day, until: S.day + irand(90, 180), captain };
    log(`News: ${captain}'s pirates have seized ${TW.PORT[id].name} and closed its harbor.`);
    toast(`☠ Pirates have seized ${TW.PORT[id].name}!`, 'bad');
  }
  // The nearest charted port that is still open, measured from `pos`.
  function nearestOpenPort(pos, except) {
    const open = S.known.filter(id => id !== except && !isHostile(id)).map(id => TW.PORT[id]);
    return open.sort((a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y))[0] || TW.PORT[S.port];
  }
  // A hostile port's defenders: its fort, one or two gun batteries and sometimes a pirate
  // ship or two in the harbor, all scaled to the danger level.
  function makeDefenses(dest) {
    const D = dangerLevel(), tier = Math.max(0, Math.min(5, Math.floor(D / 8))), row = TW.DEFENSES[tier];
    const unit = (kind, name) => ({ kind, land: true, name, ...row[kind], reload: TW.DEFENSE_RELOAD });
    const units = [unit('fort', 'Fortress')];
    if (D >= 12) units.push(unit('battery', 'West Battery'), unit('battery', 'East Battery'));
    else units.push(unit('battery', 'Gun Battery'));
    const nShips = Math.random() < 0.55 ? 1 + (D >= 20 && Math.random() < 0.4) : 0;
    return { captain: hostile()[dest].captain, port: dest, tier, ships: [...units, ...makeFleet().ships.slice(0, nShips)] };
  }

  function remember() {
    const m = S.market[S.port];
    S.seen[S.port] = { day: S.day, p: Object.fromEntries(TW.GOODS.map(g => [g.id, Math.round(m[g.id].price)])) };
  }

  // Advance one day of world time.
  function passDay() {
    const before = monthIndex(S.day);
    S.day++;
    TW.tickMarket(S);
    payUpkeep();
    expireContracts();
    hostileTick();
    if (S.debt > 0 && S.loanDue && S.day === S.loanDue) {
      log(`Your loan is now overdue. The moneylender’s interest rises to ${overduePct()}% a month.`);
      toast('⚠ Your loan is overdue!', 'bad');
    }
    if (monthIndex(S.day) !== before) {
      if (S.bank > 0) { const i = Math.round(S.bank * bankRate()); S.bank += i; log(`The bank paid ${fmt(i)} gold in interest.`); }
      if (S.debt > 0) {
        const i = Math.round(S.debt * (loanOverdue() ? OVERDUE_RATE : LOAN_RATE) * mods().loanRate * TW.diff.loan); S.debt += i;
        log(`The moneylender adds ${fmt(i)} gold of interest to your debt.`);
      }
      if (S.wages) { log(`Paid ${fmt(S.wages)} gold in wages and provisions last month.`); S.wages = 0; }
      refreshOffers();
    }
    S.peakWorth = Math.max(S.peakWorth, worth());
  }

  // Crew wages and provisions come out of cash first, then the bank. If both are empty
  // the crew grumbles and goes unpaid (once a month in the log).
  function payUpkeep() {
    let owed = TW.upkeep(shipDef(), S.ship.guns);
    const fromCash = Math.min(S.cash, owed); S.cash -= fromCash; owed -= fromCash;
    const fromBank = Math.min(S.bank, owed); S.bank -= fromBank; owed -= fromBank;
    S.wages = (S.wages || 0) + fromCash + fromBank;
    if (owed > 0 && S.unpaidMonth !== monthIndex(S.day)) { S.unpaidMonth = monthIndex(S.day); log('No gold for wages. The crew grumbles but sails on.'); }
  }
  const loanOverdue = () => S.debt > 0 && S.loanDue && S.day >= S.loanDue;
  const loanLimit = () => { const m = mods(); return loanOverdue() || m.noLoans ? 0 : Math.max(0, Math.max(5000, worth()) * m.loanCap - S.debt); };

  // ----- Contracts -----
  const contracts = () => (S.contracts = S.contracts || []);
  const contractCtx = () => ({
    days: (a, b) => travelDays(TW.route(a, b)),
    cargoCap: Math.max(10, shipDef().cargo - S.ship.guns * TW.GUN_SPACE),
    danger: dangerLevel(),
    unlocked: g => TW.goodUnlocked(S, g),
  });
  function takeFrom(amount) {
    const c = Math.min(S.cash, amount); S.cash -= c;
    const b = Math.min(S.bank, amount - c); S.bank -= b;
    return c + b;
  }
  function expireContracts() {
    for (const c of contracts().filter(c => S.day > c.due)) {
      S.contracts = contracts().filter(x => x !== c);
      const paid = c.bond ? takeFrom(c.bond) : 0;
      log(`Missed the deadline: ${TW.describeContract(c).toLowerCase()}.${paid ? ` Forfeited a ${fmt(paid)} gold bond.` : ''}`);
      toast(`⌛ Contract failed: ${TW.describeContract(c)}`, 'bad');
    }
  }
  // Hand over whatever contracts end in this port. Returns lines for the arrival report.
  function deliverContracts() {
    const lines = [];
    for (const c of contracts().filter(c => c.to === S.port)) {
      if (c.good) {   // dispatches and passengers need no cargo
        const held = S.ship.cargo[c.good]?.qty || 0;
        if (held < c.qty) { lines.push(`<li class="warn">${TW.contractIcon(c)} ${TW.describeContract(c)}: you have ${held} of ${c.qty}. Bring the rest by ${dateStr(c.due)}.</li>`); continue; }
        S.ship.cargo[c.good].qty -= c.qty;
        if (!S.ship.cargo[c.good].qty) delete S.ship.cargo[c.good];
      }
      S.contracts = contracts().filter(x => x !== c);
      S.cash += c.reward; S.stats.contracts = (S.stats.contracts || 0) + 1;
      log(`Completed a contract: ${TW.describeContract(c).toLowerCase()} for ${fmt(c.reward)} gold.`);
      lines.push(`<li class="ok">${TW.contractIcon(c)} ${TW.describeContract(c)}: <b>${gold(c.reward)}</b> paid.</li>`);
    }
    if (lines.some(l => l.includes('class="ok"'))) { TW.sfx('coins'); S.peakWorth = Math.max(S.peakWorth, worth()); }
    return lines;
  }
  function contractCard(c, action) {
    const days = c.due - S.day;
    const held = c.good ? (S.ship.cargo[c.good]?.qty || 0) : null;
    const tags = (c.urgent ? `<span class="tagx urgent" ${tip('<b>Urgent.</b> Only a little time beyond the sailing itself, but it pays about 45% more.')}>urgent</span>` : '')
      + (c.risky ? `<span class="tagx risky" ${tip(`<b>Pirates are watching.</b> Word of this job has leaked along the waterfront. Pirates are much likelier to come for you on the voyage to ${TW.PORT[c.to].name}, so it pays about 35% more.`)}>pirates watching</span>` : '');
    return `<div class="contract ${c.kind}">
      <span class="c-ico">${TW.contractIcon(c)}</span>
      <div class="c-body"><span class="c-title"><b>${TW.describeContract(c)}</b>${tags}</span>
        ${c.note ? `<i class="c-note">“${esc(c.note)}”</i>` : ''}
        <small>For ${esc(c.issuer)} · due ${dateStr(c.due)} (${days} days)${c.bond ? ` · ${fmt(c.bond)} g bond if late` : ''}${held !== null && action !== 'take' ? ` · in hold: ${held}/${c.qty}` : ''}</small></div>
      <span class="c-reward">${gold(c.reward)}</span>
      ${action === 'take' ? `<button data-act="take-contract" data-id="${c.id}" data-where="${TW.contractWhere(c)}" ${contracts().length >= TW.MAX_CONTRACTS ? 'disabled title="You already hold three contracts"' : ''}>Accept</button>`
        : action === 'abandon' ? `<button class="ghost" data-act="abandon-contract" data-id="${c.id}">Abandon</button>` : ''}
    </div>`;
  }
  function contractList(action) {
    const list = contracts();
    return list.length ? list.map(c => contractCard(c, action)).join('') : '<p class="hint">No contracts. Visit a Harbor Office to find work.</p>';
  }

  // Overdue debtors find collectors waiting in any port with a moneylender.
  function collectDebt() {
    if (!loanOverdue() || !port().svc.includes('L')) return null;
    const fee = Math.round(S.debt * COLLECTION_FEE), take = Math.min(S.cash, S.debt + fee);
    if (take <= 0) return null;
    S.cash -= take;
    S.debt = Math.max(0, S.debt + fee - take);
    if (!S.debt) S.loanDue = 0;
    log(`Debt collectors seized ${fmt(take)} gold on the wharf in ${port().name}.`);
    return { take, fee, left: S.debt };
  }

  function checkMilestones() {
    while (S.milestone < MILESTONES.length && S.peakWorth >= MILESTONES[S.milestone]) {
      S.milestone++;
      const p = revealPort();
      if (p) { log(`Your growing fame earns you a chart to ${p.name}.`); toast(`New port charted: <b>${p.name}</b>`, 'good'); }
    }
    for (const g of TW.GOODS) if (g.unlock && TW.goodUnlocked(S, g) && !S['un_' + g.id]) {
      S['un_' + g.id] = true;
      log(`Merchants now trust you with ${g.name.toLowerCase()}.`);
      toast(`${g.icon} <b>${g.name}</b> can now be traded!`, 'good');
    }
  }
  function revealPort() {
    const unknown = TW.PORTS.filter(p => !S.known.includes(p.id));
    if (!unknown.length) return null;
    const dist = p => Math.min(...S.known.map(k => Math.hypot(TW.PORT[k].x - p.x, TW.PORT[k].y - p.y)));
    unknown.sort((a, b) => dist(a) - dist(b));
    S.known.push(unknown[0].id);
    return unknown[0];
  }

  // ---------- HUD ----------
  function hud() {
    const el = $('#hud');
    if (!S || view.screen === 'title' || view.screen === 'newgame') { el.hidden = true; return; }
    el.hidden = false;
    const w = worth();
    const left = S.mode === 'career' ? ` · ${Math.max(0, Math.ceil((CAREER_DAYS - S.day) / 365 * 10) / 10)} yrs left` : '';
    el.innerHTML = `
      <div class="brand">Tradewaters</div>
      <div class="stat"><label>Date</label>${dateStr(S.day)}<small>${left}</small></div>
      <div class="stat"><label>Cash</label>${gold(S.cash)}</div>
      <div class="stat"><label>Bank</label>${gold(S.bank)}</div>
      <div class="stat ${S.debt ? 'bad' : ''}"><label>Debt</label>${gold(S.debt)}${S.debt && S.loanDue ? `<small>${loanOverdue() ? 'overdue!' : `due in ${S.loanDue - S.day}d`}</small>` : ''}</div>
      <div class="stat"><label>Net worth</label>${gold(w)}<small>${rankOf(w)}</small></div>
      <div class="hud-btns">
        <button data-act="toggle-sfx" title="Sound effects">${TW.audioSettings.sfx ? '🔊' : '🔈'}</button>
        <button data-act="toggle-music" title="Music">${TW.audioSettings.music ? '🎵' : '🔇'}</button>
        <button data-act="help" title="How to play">?</button>
        <button data-act="menu" title="Menu">☰</button>
      </div>`;
  }

  // ---------- screens ----------
  function render() {
    hud();
    const el = $('#screen');
    el.className = 'screen-' + view.screen;
    ({ title: renderTitle, newgame: renderNew, port: renderPort, map: renderMap, combat: () => {}, end: renderEnd })[view.screen](el);
  }
  function go(screen, opts = {}, origin) {
    const from = view.screen;
    if (from === 'map' && screen !== 'map') stopMapLoop();
    Object.assign(view, { screen }, opts);
    TW.music({ title: 'title', newgame: 'title', port: view.place === 'tavern' ? 'tavern' : 'port', map: 'sea', combat: 'combat', end: 'victory' }[screen]);
    TW.ambience({ port: 'port', map: 'sea', combat: 'sea' }[screen] || null);
    const kind = from === screen ? null
      : from === 'port' && screen === 'map' ? 'chart'
      : from === 'map' && screen === 'port' ? 'landfall' : 'fade';
    if (kind === 'chart') TW.sfx('map');
    if (kind) transition(kind, render, origin); else render();
  }

  // ---------- transitions ----------
  // Moving between the chart, a port and its buildings animates, as in the original. The
  // old view is snapshotted into an overlay that plays its exit while the new view, already
  // rendered underneath, plays its entrance, so rendering itself stays synchronous.
  // `origin` (CSS transform-origin within #screen) aims zooms at a building or a port.
  const T_MS = 750;
  let ghostEl = null;
  function transition(kind, update, origin) {
    const el = $('#screen');
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || !el.firstElementChild) return update();
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    // Canvases clone without their pixels; copy them across.
    const src = el.querySelectorAll('canvas'), dst = ghost.querySelectorAll('canvas');
    src.forEach((c, i) => { try { dst[i].getContext('2d').drawImage(c, 0, 0); } catch (e) {} });
    ghost.querySelectorAll('video, audio').forEach(n => n.remove());
    ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    ghost.removeAttribute('id');
    ghost.classList.add('t-out-' + kind);
    ghost.style.transformOrigin = origin || '';
    // A fixed frame over #screen clips the snapshot so zooms stay inside the play area.
    const frame = document.createElement('div');
    frame.className = 't-ghost'; frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    frame.appendChild(ghost);
    document.body.appendChild(ghostEl = frame);
    const ghostRoot = ghostEl;
    update();
    el.classList.add('t-in-' + kind);
    el.style.transformOrigin = origin || '';
    setTimeout(() => {
      if (ghostEl === ghostRoot) { ghostRoot.remove(); ghostEl = null; }
      el.classList.remove('t-in-' + kind);
      el.style.transformOrigin = '';
    }, T_MS);
  }
  // The centre of an element, or of a port on the chart, as a transform-origin in #screen.
  function originOf(rect) {
    const s = $('#screen').getBoundingClientRect();
    return `${Math.round(rect.left + rect.width / 2 - s.left)}px ${Math.round(rect.top + rect.height / 2 - s.top)}px`;
  }
  function portOrigin(id) {
    const c = $('#map'), p = TW.PORT[id];
    if (!c || !p) return undefined;
    const r = c.getBoundingClientRect(), x = r.left + p.x / TW.MAP.w * r.width, y = r.top + p.y / TW.MAP.h * r.height;
    return originOf({ left: x, top: y, width: 0, height: 0 });
  }

  // Browsers won't play music until the visitor clicks or presses a key, so on a cold
  // load the title screen asks for that first click before showing its menu.
  // If music is already playing (autoplay was allowed), the prompt goes away by itself.
  let gateOpen = false;
  const needsGate = () => !gateOpen && TW.audioSettings.music &&
    !(navigator.userActivation && navigator.userActivation.hasBeenActive);
  function openGate() {
    if (gateOpen) return;
    gateOpen = true;
    $('.press-start')?.remove();
    $('.press-hint')?.remove();
    const box = $('.title-box');
    if (box && box.classList.contains('gated')) { box.classList.remove('gated'); box.classList.add('revealed'); }
  }
  TW.onMusicStart = openGate;
  document.addEventListener('keydown', () => { if ($('.press-start')) openGate(); });

  function renderTitle(el) {
    const saved = loadSave();
    const gated = needsGate();
    el.innerHTML = `
      ${titleArt(false)}
      <canvas class="title-fx"></canvas>
      ${gated ? '<button class="press-start" data-act="begin" aria-label="Click anywhere to begin"></button>' : ''}
      <div class="title-box ${gated ? 'gated' : ''}">
        <h1 aria-label="Tradewaters">${[...'Tradewaters'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</h1>
        <p class="tag">Buy low. Sell high. Outrun the pirates.</p>
        <div class="menu-area">
          ${gated ? '<div class="press-hint"><span>⚓ Click anywhere to begin ⚓</span></div>' : ''}
          <div class="col">
            <button class="big" data-act="new">New Voyage</button>
            ${saved ? `<button class="big ghost" data-act="continue">Continue: ${esc(saved.name)}, ${dateStr(saved.day)}</button>` : ''}
            <button class="ghost" data-act="help">How to Play</button>
          </div>
        </div>
      </div>`;
    TW.titleFX($('.title-fx', el));
  }

  // Title backdrop: the still image, with the looping video fading in over it once it can play.
  function titleArt(dim) {
    return `<div class="title-art ${dim ? 'dim' : ''}" style="${bgStyle('title')}">
      <video class="title-video" src="assets/video/title.mp4" autoplay muted loop playsinline preload="auto"
        oncanplay="this.classList.add('ready')" onerror="this.remove()"></video></div>`;
  }

  function renderNew(el) {
    el.innerHTML = `
      ${titleArt(true)}
      <div class="panel newgame">
        <h2>A New Captain</h2>
        <label>Your name<input id="ng-name" maxlength="24" placeholder="Captain…" value="${esc(view.ngName || '')}"></label>
        <label>Voyage
          <select id="ng-mode">
            <option value="career">Career: 10 years, then your fortune is judged</option>
            <option value="endless">Endless: sail until you retire</option>
          </select>
        </label>
        <label>Home port
          <select id="ng-home">${START_PORTS.map(id => `<option value="${id}">${TW.PORT[id].name}</option>`).join('')}</select>
        </label>
        <fieldset class="difficulty"><legend>Difficulty</legend>
          ${TW.DIFFICULTIES.map(d => `<label class="diff-opt"><input type="radio" name="ng-diff" value="${d.id}" ${d.id === (view.ngDiff || 'medium') ? 'checked' : ''}>
            <b>${d.name}</b><small>${d.desc}</small></label>`).join('')}
        </fieldset>
        <p class="hint">You begin with a sloop, two cannons and 6,000 gold.</p>
        <div class="row"><button class="ghost" data-act="title">Back</button><button class="big" data-act="start">Set Sail</button></div>
      </div>`;
    $('#ng-name').focus();
  }

  function bgStyle(key) { return TW.images[key] ? `background-image:url(${TW.images[key].src})` : ''; }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ----- Port: city view and buildings -----
  // view.place is 'city' (the quay with clickable buildings) or a building id.
  const BUILDINGS = {
    market:   { label: 'Marketplace',   h: 0.34, render: el => renderMarket(el) },
    tavern:   { label: 'Tavern',        h: 0.38, render: el => renderTavern(el) },
    shipyard: { label: 'Shipyard',      h: 0.37, svc: 'S', render: el => renderShipyard(el) },
    bank:     { label: 'Bank',          h: 0.35, svc: 'B', render: el => renderBank(el) },
    lender:   { label: 'Moneylender',   h: 0.40, svc: 'L', render: el => renderLender(el) },
    harbor:   { label: 'Harbor Office', h: 0.33, render: el => renderHarbor(el) },
  };
  const INTERIOR = { market: 'market', tavern: 'tavern', shipyard: 'shipyard', bank: 'int-bank', lender: 'int-lender', harbor: 'int-harbor' };
  const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const portBuildings = p => Object.keys(BUILDINGS).filter(b => !BUILDINGS[b].svc || p.svc.includes(BUILDINGS[b].svc));

  // Where each building stands on the quay. The order is shuffled per port (but stable),
  // and the harbor office sits at one end with its pier out over the water.
  function cityLayout(p) {
    const city = TW.CITY[p.id] || {};
    const quay = city.quay || 0.78;
    const h = hash(p.id);
    const others = portBuildings(p).filter(b => b !== 'harbor');
    for (let i = others.length - 1; i > 0; i--) { const j = (h >>> i) % (i + 1); [others[i], others[j]] = [others[j], others[i]]; }
    const harborLeft = city.harbor ? city.harbor === 'left' : h % 2 === 0;
    const [a, b] = harborLeft ? [0.27, 0.95] : [0.05, 0.73];
    const style = city.style || 'english', slot = (b - a) / Math.max(1, others.length);
    // Scene is 16:9, so a building of height h (fraction of scene height) is h * aspect * 9/16 wide.
    const fit = (id, h, maxW) => Math.min(h, maxW / ((TW.BUILDING_ASPECT[`${style}-${id}`] || 1) * 9 / 16));
    const spots = others.map((id, i) => ({ id, x: a + slot * (i + 0.5), base: quay, h: fit(id, BUILDINGS[id].h, slot * 1.15) }));
    spots.push({ id: 'harbor', x: harborLeft ? 0.12 : 0.88, base: Math.min(0.97, quay + 0.14), h: fit('harbor', BUILDINGS.harbor.h, 0.22) });
    return spots;
  }

  function renderPort(el) {
    if (!view.place || (view.place !== 'city' && !portBuildings(port()).includes(view.place))) view.place = 'city';
    if (view.place === 'city') renderCity(el); else renderBuilding(el, view.place);
  }

  function renderCity(el) {
    const p = port(), city = TW.CITY[p.id] || {}, style = city.style || 'english';
    preloadKeepers(p.id);
    const d = shipDef();
    el.innerHTML = `
      <div class="city">
        <div class="city-scene" style="background-image:url(assets/img/ports/${p.id}.jpg); --water-top:${(((city.quay || 0.78) + 0.07) * 100).toFixed(1)}%">
          <div class="city-sign"><span>${p.name}</span><small>${city.blurb || ''}</small></div>
          ${cityLayout(p).map(b => `
            <button class="bld bld-${b.id}" data-act="enter" data-place="${b.id}" aria-label="${BUILDINGS[b.id].label}"
              style="left:${(b.x * 100).toFixed(2)}%; top:${((b.base - b.h) * 100).toFixed(2)}%; height:${(b.h * 100).toFixed(2)}%; z-index:${Math.round(b.base * 100)}">
              <img src="assets/img/buildings/${style}-${b.id}.png" alt="" draggable="false">
            </button>`).join('')}
          <div class="bld-signs" aria-hidden="true">${cityLayout(p).map(b => `<span class="bld-sign" data-act="enter" data-place="${b.id}"
            style="left:${(b.x * 100).toFixed(2)}%; top:${(b.base * 100).toFixed(2)}%">${BUILDINGS[b.id].label}</span>`).join('')}</div>
        </div>
        <div class="city-bar">
          <div class="mini" data-act="show-ship" role="button" tabindex="0" title="Your ship and record">
            <div class="mini-row"><b>${d.name}</b><span>Hull ${S.ship.hull}/${d.hull}</span><span>Hold ${usedSpace()}/${d.cargo}</span><span>Cannons ${S.ship.guns}</span></div>
            <div class="mini-ammo" title="Special shot aboard">${TW.AMMO.map(a => `${{ chain: '⛓', fire: '🔥', keg: '💥' }[a.id]} ${a.name} ${S.ammo[a.id]}`).join(' · ')}</div></div>
          <button class="ghost" data-act="show-contracts">🧾 Contracts (${contracts().length})</button>
          <button class="ghost" data-act="show-ship">⚓ Ship</button>
          <button class="ghost" data-act="show-log">📜 Captain's Log</button>
          <button class="sail" data-act="open-map">⛵ Set Sail</button>
        </div>
      </div>`;
    // On a first visit the scene may still be downloading: keep the whole view hidden
    // until it has decoded, rather than showing buildings over an empty sky.
    // Building name signs sit on their own layer above the townsfolk; hovering one lifts
    // its building just as hovering the building lights the sign.
    el.querySelectorAll('.bld-signs .bld-sign').forEach(sign => {
      const b = el.querySelector(`.bld[data-place="${sign.dataset.place}"]`);
      sign.onmouseenter = () => b.classList.add('lit');
      sign.onmouseleave = () => b.classList.remove('lit');
    });
    // Townsfolk on the quay, kept clear of the harbor pier (same side rule as cityLayout).
    const folkBox = el.querySelector('.city-scene'), quay = city.quay || 0.78;
    if (TW.startFolk) TW.startFolk(folkBox, { quay, dock: city.dock, harborLeft: city.harbor ? city.harbor === 'left' : hash(p.id) % 2 === 0 });
    const scene = preloadScene(p.id);
    if (!scene.ready) {
      const box = el.querySelector('.city-scene');
      box.classList.add('scene-pending');
      scene.promise.then(() => box.classList.remove('scene-pending'));
    }
  }

  // Port scenes are fetched and decoded ahead of time (when a voyage is planned or begins),
  // so making landfall shows the whole town at once.
  const scenes = {};
  function preloadScene(id) {
    if (scenes[id]) return scenes[id];
    const img = new Image(), entry = { img, ready: false };
    img.src = `assets/img/ports/${id}.jpg`;
    const loaded = img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    entry.promise = loaded.catch(() => {}).then(() => { entry.ready = true; });
    return scenes[id] = entry;
  }

  // Context the keepers' dialogue can react to.
  function talkContext() {
    const p = port(), d = shipDef();
    const list = ids => ids.map(id => TW.GOOD[id].name.toLowerCase()).join(' and ');
    return {
      portId: p.id, name: S.name, port: p.name, home: TW.PORT[S.home].name, ship: d.name,
      cash: S.cash, bank: S.bank, debt: S.debt, worth: worth(), guns: S.ship.guns,
      cargo: cargoQty(), hullPct: S.ship.hull / d.hull, loadPct: usedSpace() / d.cargo,
      threat: seaAt(p.id).act,
      uncharted: S.known.length < TW.PORTS.length, firstVisit: !(S.visited || {})[p.id],
      overdue: loanOverdue(), dueIn: S.loanDue ? S.loanDue - S.day : 0,
      contracts: contracts().length,
      hostile: Object.keys(S.hostile || {}).filter(id => S.known.includes(id)).map(id => TW.PORT[id].name).join(' and '),
      wants: list(p.wants), makes: list(p.makes.filter(id => id !== 'gems')),
    };
  }
  // Set what the current building's keeper is saying.
  function speak(kind, prefix = '') {
    const who = view.place;
    const text = TW.line(who, kind, talkContext());
    if (text || prefix) view.speech = { who, text: (prefix ? prefix + ' ' : '') + (text || ''), id: Math.random() };
  }
  let typedId = null;
  function typeSpeech() {
    const el = $('.speech-text');
    if (!el || !view.speech) return;
    const full = view.speech.text;
    if (typedId === view.speech.id) { el.textContent = full; return; }
    typedId = view.speech.id;
    let i = 0;
    const tick = () => {
      if (!el.isConnected || typedId !== view.speech.id) return;
      i = Math.min(full.length, i + 2);
      el.textContent = full.slice(0, i);
      if (i < full.length) setTimeout(tick, 18);
    };
    tick();
  }

  // Keeper portraits: the monogram underneath only shows if the picture fails to load.
  // A portrait fades in the first time it loads; once it has, re-renders show it at once.
  const portraitsReady = new Set();
  const PORTRAIT_REV = 2;   // bump when portraits are re-rendered: they're cached for a week
  TW._portraitLoaded = img => { portraitsReady.add(img.getAttribute('src')); img.classList.remove('pending'); };
  TW._portraitFailed = img => { img.parentNode.classList.add('no-art'); img.remove(); };
  function portraitImg(src, alt) {
    return `<img src="${src}" alt="${esc(alt)}" class="${portraitsReady.has(src) ? '' : 'pending'}"
      onload="TW._portraitLoaded(this)" onerror="TW._portraitFailed(this)">`;
  }
  // Fetch and decode this port's keepers while the captain is on the quay.
  function preloadKeepers(portId) {
    for (const b of portBuildings(TW.PORT[portId])) {
      const src = `assets/img/chars/${portId}-${b}.jpg?r=${PORTRAIT_REV}`;
      if (portraitsReady.has(src)) continue;
      const img = new Image(); img.src = src;
      (img.decode ? img.decode() : Promise.resolve()).then(() => portraitsReady.add(src), () => {});
    }
  }

  function renderBuilding(el, id) {
    const ch = TW.keeper(S.port, id);
    if (!view.speech || view.speech.who !== id) speak('greet');
    el.innerHTML = `
      <div class="bld-view">
        <aside class="keeper">
          <div class="keeper-art" style="${bgStyle(INTERIOR[id])}">
            <button class="portrait" data-act="talk" title="Talk to ${ch.name}">
              <span class="monogram">${ch.name.replace(/[“”"].*?[“”"]\s*/g, '').split(' ').filter(w => /^[A-ZÁÉÍÓÚÑ]/.test(w)).slice(-2).map(w => w[0]).join('')}</span>
              ${portraitImg(`assets/img/chars/${S.port}-${id}.jpg?r=${PORTRAIT_REV}`, ch.name)}</button>
          </div>
          <div class="keeper-name">${ch.name}<small>${ch.title}</small></div>
          <div class="speech"><p class="speech-text"></p></div>
          <button class="ghost back" data-act="to-city">← Back to the wharf</button>
        </aside>
        <section class="port-main panel" id="port-main"></section>
        <aside class="port-side">${shipCard()}${logCard()}</aside>
      </div>`;
    BUILDINGS[id].render($('#port-main'));
    typeSpeech();
  }

  function renderHarbor(el) {
    const d = shipDef(), c = talkContext();
    const sea = seaAt(), m = mods();
    const checks = [
      [S.ship.hull >= d.hull * 0.7, `Hull ${S.ship.hull}/${d.hull}`],
      [S.ship.guns - S.ship.broken >= Math.min(d.guns, 2 + c.threat * 3), `${S.ship.guns - S.ship.broken} working cannons`],
      [c.loadPct < 0.85, `Hold ${usedSpace()}/${d.cargo}${c.loadPct >= 0.85 ? ' (heavy, slower)' : ''}`],
      [S.ammo.chain + S.ammo.fire + S.ammo.keg > 0, `${S.ammo.chain + S.ammo.fire + S.ammo.keg} special shot`],
    ];
    el.innerHTML = `<h2>Harbor Office</h2>
      <div class="threat t${sea.act}"><span>Pirate activity</span><b>${ACTIVITY[sea.act]}</b></div>
      <div class="threat weather w${sea.wx}"><span>Weather report${hurricaneSeason() ? '<small>Hurricane season</small>' : ''}</span>
        <b>${WEATHER[sea.wx].name}</b></div>
      <p class="hint weather-note">${WEATHER[sea.wx].desc} ${shipWeather(m)}</p>
      <h3>Readiness</h3>
      <ul class="checks">${checks.map(([ok, t]) => `<li class="${ok ? 'ok' : 'warn'}">${ok ? '✔' : '⚠'} ${t}</li>`).join('')}</ul>
      <p class="hint">${S.known.length} of ${TW.PORTS.length} ports charted.</p>
      <h3>Freight board</h3>
      <p class="hint">Contracts pay better than the market if you make the deadline. Late delivery forfeits the bond. You may hold ${TW.MAX_CONTRACTS} at once.</p>
      ${(() => { const offers = TW.boardOffers(S, S.port, 'harbor', contractCtx()); return offers.length ? offers.map(c => contractCard(c, 'take')).join('') : '<p class="hint">The board is bare. New postings go up every few weeks.</p>'; })()}
      <h3>Your contracts</h3>
      ${contractList('abandon')}
      <button class="sail" data-act="open-map">⛵ Chart a course</button>`;
  }

  function shipCard() {
    const d = shipDef(), used = usedSpace();
    const cargo = Object.entries(S.ship.cargo).filter(([, c]) => c.qty > 0);
    return `<div class="panel card">
      <h3><button class="link" data-act="show-ship" title="Your ship and record">${d.name} ›</button></h3>
      <div class="bar"><span style="width:${100 * S.ship.hull / d.hull}%" class="${S.ship.hull / d.hull < 0.4 ? 'low' : ''}"></span><em>Hull ${S.ship.hull}/${d.hull}</em></div>
      <div class="bar cargo"><span style="width:${Math.min(100, 100 * used / d.cargo)}%"></span><em>Hold ${used}/${d.cargo}</em></div>
      <div class="kv"><span>Cannons</span><b>${S.ship.guns}/${d.guns}${S.ship.broken ? ` <i class="bad">(${S.ship.broken} broken)</i>` : ''}</b></div>
      <div class="kv"><span>Special ammo</span><b>⛓${S.ammo.chain} · 🔥${S.ammo.fire} · 💥${S.ammo.keg}</b></div>
      <div class="kv"><span>Wages &amp; provisions</span><b>${fmt(TW.upkeep(d, S.ship.guns))} g/day</b></div>
      <div class="cargo-list">${cargo.length ? cargo.map(([id, c]) => `<div>${TW.GOOD[id].icon} ${TW.GOOD[id].name} <b>${c.qty}</b> <small>@${fmt(c.cost)}</small></div>`).join('') : '<small>The hold is empty.</small>'}</div>
    </div>`;
  }
  // ---------- Ship & Captain ----------
  // A full sheet for the ship and its captain: the vessel in paint, specs measured against
  // the finest ship afloat, the cargo manifest priced at this port, the captain's record,
  // and the ships still to come. The ship can be named here.
  const SHIP_NAMES = ['Gull’s Fortune', 'Saucy Margaret', 'Lucky Doubloon', 'Windward Lass', 'Sea Sparrow', 'Merry Widow', 'Salt Sovereign',
    'Copper Kettle', 'Restless Heron', 'Silver Mullet', 'Honest Mischief', 'Brave Bonito'];
  const shipName = () => S.shipName || (S.shipName = SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)]);
  const tradeInValue = () => { const d = shipDef(); return Math.round(d.price * 0.6 * (0.5 + 0.5 * S.ship.hull / d.hull) / 100) * 100; };
  function showShip() {
    const d = shipDef(), w = worth(), m = S.market[S.port];
    const best = k => Math.max(...TW.SHIPS.map(x => x[k]));
    const meter = (label, value, max, text, cls = '') => `<div class="spec"><span>${label}</span>
      <div class="meter ${cls}"><i style="width:${Math.max(3, Math.min(100, 100 * value / max))}%"></i></div><b>${text}</b></div>`;
    const firepower = x => x.guns / x.reload;   // shots per second from a full gun deck
    const cargoRows = Object.entries(S.ship.cargo).filter(([, c]) => c.qty > 0).map(([id, c]) => {
      const g = TW.GOOD[id], sell = TW.unitSell(m[id]), pl = c.cost ? Math.round((sell - c.cost) / c.cost * 100) : null;
      return `<tr><td>${g.icon} ${g.name}${TW.banned(S.port, id) ? ' <small class="bad">banned here</small>' : ''}</td><td>${c.qty}</td>
        <td>${c.cost ? fmt(c.cost) : '<small class="up">free</small>'}</td><td>${fmt(sell)}</td><td>${fmt(sell * c.qty)}</td>
        <td class="${pl === null || pl >= 0 ? 'up' : 'down'}">${pl === null ? '–' : (pl >= 0 ? '+' : '') + pl + '%'}</td></tr>`;
    }).join('');
    const rankIdx = TW.RANKS.reduce((k, [min], i) => (w >= min ? i : k), 0);
    const [lo] = TW.RANKS[rankIdx], next = TW.RANKS[rankIdx + 1];
    const st = S.stats;
    modal(`
      <div class="ship-hero"><canvas width="1200" height="400" data-hero></canvas>
        <div class="ship-title"><label>The</label><input id="ship-name" maxlength="28" value="${esc(shipName())}" aria-label="Ship name" title="Click to rename your ship">
          <small>${d.name} · Captain ${esc(S.name)}, ${rankOf(w)}</small></div></div>
      <div class="ship-grid">
        <section><h3>Specifications</h3>
          ${meter('Hull', S.ship.hull, best('hull'), `${S.ship.hull} / ${d.hull}`, S.ship.hull / d.hull < 0.4 ? 'low' : '')}
          ${meter('Hold', d.cargo, best('cargo'), `${usedSpace()} / ${d.cargo} used`)}
          <div class="hold-split"><span style="flex:${cargoQty()}" class="c">cargo ${cargoQty()}</span><span style="flex:${S.ship.guns * TW.GUN_SPACE}" class="g">cannons ${S.ship.guns * TW.GUN_SPACE}</span><span style="flex:${Math.max(0, freeSpace())}" class="f">free ${Math.max(0, freeSpace())}</span></div>
          ${meter('Speed', d.speed, best('speed'), `${d.speed}`)}
          ${meter('Firepower', firepower({ guns: S.ship.guns - S.ship.broken, reload: d.reload }), firepower(TW.SHIPS[TW.SHIPS.length - 1]), `${S.ship.guns - S.ship.broken} guns`)}
          <div class="kv"><span>Gun deck</span><b>${S.ship.guns} of ${d.guns} mounted${S.ship.broken ? `, <i class="bad">${S.ship.broken} broken</i>` : ''}</b></div>
          <div class="kv"><span>Reload</span><b>${d.reload}s per gun</b></div>
          <div class="kv"><span>Special shot</span><b>⛓ ${S.ammo.chain} · 🔥 ${S.ammo.fire} · 💥 ${S.ammo.keg}</b></div>
          <div class="kv"><span>Wages &amp; provisions</span><b>${fmt(TW.upkeep(d, S.ship.guns))} g/day</b></div>
          <div class="kv"><span>Trade-in value</span><b>${gold(tradeInValue())}</b></div>
        </section>
        <section><h3>Manifest <small>priced in ${port().name}</small></h3>
          ${cargoRows ? `<table class="manifest"><thead><tr><th>Good</th><th>Qty</th><th>Paid</th><th>Sells</th><th>Worth</th><th></th></tr></thead><tbody>${cargoRows}</tbody></table>`
            : '<p class="hint">The hold is empty. Nothing aboard but rats and rope.</p>'}
          ${contracts().length ? `<h4>Contracts aboard</h4>${contracts().map(c => `<div class="mini-contract">${TW.contractIcon(c)} ${TW.describeContract(c)} <small>· ${c.due - S.day} days</small></div>`).join('')}` : ''}
        </section>
        <section><h3>Captain’s record</h3>
          <div class="rank"><b>${rankOf(w)}</b>${next ? `<div class="meter"><i style="width:${Math.round(100 * (w - lo) / (next[0] - lo))}%"></i></div><small>${gold(next[0] - w)} more to ${next[1]}</small>` : '<small>The highest rank there is.</small>'}</div>
          <div class="kv"><span>Net worth</span><b>${gold(w)}</b></div>
          <div class="kv"><span>Difficulty</span><b>${diffName()}</b></div>
          <div class="kv"><span>Days in command</span><b>${fmt(S.day)}</b></div>
          <div class="kv"><span>Voyages</span><b>${st.voyages}</b></div>
          <div class="kv"><span>Trading profit</span><b>${gold(st.profit)}</b></div>
          <div class="kv"><span>Contracts completed</span><b>${st.contracts || 0}</b></div>
          <div class="kv"><span>Pirates sunk / escaped / lost to</span><b>${st.won} / ${st.fled} / ${st.lost}</b></div>
          <div class="kv"><span>Booty taken</span><b>${gold(st.booty)}</b></div>
          <div class="kv"><span>Ports liberated</span><b>${st.liberated || 0}</b></div>
          <div class="kv"><span>Storms weathered</span><b>${st.storms}</b></div>
          <div class="kv"><span>Cargo seized by navies</span><b>${st.seized || 0}</b></div>
          <div class="kv"><span>Ports charted</span><b>${S.known.length} of ${TW.PORTS.length}</b></div>
        </section>
      </div>
      <div class="ship-items">
        <section><h3>Curiosities aboard</h3>
          ${(S.items || []).length ? S.items.map((it, i) => { const c = TW.CURIO[it.id];
            return `<div class="kv item-row"><span>${c.icon} <b>${c.name}</b>${it.variant === 'cursed' ? ' <small class="bad">has a catch</small>' : it.variant === 'fake' ? ' <small class="bad">fake</small>' : ''}<br><small>${curioDesc(it)}</small></span>
              <button class="ghost" data-act="sell-curio" data-i="${i}" title="Traders buy curiosities back at half price">Sell · ${fmt(Math.round(it.paid / 2))} g</button></div>`; }).join('')
            : '<p class="hint">None yet. Tavern traders sell charms, some of which even work.</p>'}
        </section>
        <section><h3>Fittings on the ${esc(shipName())}</h3>
          ${(S.ship.fittings || []).length ? S.ship.fittings.map(id => { const f = TW.FITTING[id]; return `<div class="kv item-row"><span>${f.icon} <b>${f.name}</b><br><small>${f.desc}</small></span></div>`; }).join('')
            : '<p class="hint">None fitted. Shipyards sell cannon, hull and rigging upgrades.</p>'}
        </section>
      </div>
      <h3 class="ladder-head">The ships of the Caribbean</h3>
      <div class="ship-ladder">${TW.SHIPS.map(x => {
        const mine = x.id === d.id, open = S.peakWorth >= x.unlock;
        return `<div class="rung ${mine ? 'mine' : open ? 'open' : 'locked'}"><canvas width="240" height="130" data-rung="${x.id}"></canvas>
          <b>${x.name}</b><small>${mine ? 'Your ship' : open ? 'Sold at shipyards' : `Unlocks at ${fmt(x.unlock)}`}</small>
          <small class="dim">Hull ${x.hull} · Hold ${x.cargo} · ${x.guns} guns</small></div>`;
      }).join('')}</div>`,
      [['Close', null, 'big']], 'wide ship-sheet');
    const box = $('#modal');
    const hero = box.querySelector('canvas[data-hero]'), hx = hero.getContext('2d');
    const sky = hx.createLinearGradient(0, 0, 0, hero.height);
    sky.addColorStop(0, '#f3c98b'); sky.addColorStop(0.62, '#a9d3d6'); sky.addColorStop(0.62, '#2f7d8f'); sky.addColorStop(1, '#173f57');
    hx.fillStyle = sky; hx.fillRect(0, 0, hero.width, hero.height);
    hx.save(); hx.translate(hero.width * 0.18, 0);
    TW.drawShipFit(hx, d.id, hero.width * 0.64, hero.height, { water: hero.height * 0.8, flag: '#1f6f8b', wash: 0 });
    hx.restore();
    box.querySelectorAll('canvas[data-rung]').forEach(c => {
      const x = c.getContext('2d');
      TW.drawShipFit(x, c.dataset.rung, c.width, c.height, { water: c.height * 0.9, flag: '#1f6f8b' });
    });
    const input = box.querySelector('#ship-name');
    input.onchange = () => { S.shipName = input.value.trim().slice(0, 28) || shipName(); input.value = S.shipName; save(); toast(`She is now the <b>${esc(S.shipName)}</b>.`, 'good'); };
    input.onkeydown = ev => { if (ev.key === 'Enter') input.blur(); };
  }

  function logCard() {
    return `<div class="panel card log"><h3>Captain's Log</h3>${S.log.slice(0, 7).map(l => `<p><small>${dateStr(l.day)}</small>${l.text}</p>`).join('')}</div>`;
  }

  function priceClass(g, price) {
    const k = (price - g.min) / (g.max - g.min);
    return k < 0.3 ? 'cheap' : k > 0.7 ? 'dear' : '';
  }

  function renderMarket(el) {
    const m = S.market[S.port];
    const rows = TW.GOODS.map(g => {
      const e = m[g.id], held = S.ship.cargo[g.id]?.qty || 0;
      // Goods above your standing can't be bought yet, but anything you've captured can be sold.
      const locked = !TW.goodUnlocked(S, g);
      if (locked && !held) return `<tr class="locked"><td><span class="emoji">${g.icon}</span> ${g.name}</td><td colspan="5">Unlocks at ${gold(g.unlock)} net worth</td></tr>`;
      const noBuy = locked || !stockOf(e) || TW.banned(S.port, g.id);
      const buy = TW.unitBuy(e), sell = TW.unitSell(e), stock = stockOf(e);
      const avg = S.ship.cargo[g.id]?.cost;
      const pl = held && avg ? Math.round((sell - avg) / avg * 100) : null;
      return `<tr data-good="${g.id}">
        <td class="good"><span class="gname">${g.icon} <b>${g.name}</b></span>${e.kind ? `<span class="tagx ${e.kind}" ${tip(eventTip(e.kind, g))}>${e.kind}</span>` : ''}${TW.banned(S.port, g.id) ? `<span class="tagx contraband" ${tip(contrabandTip(g))}>contraband</span>` : ''}${locked ? `<span class="tagx sellonly" ${tip(`<b>Sell only.</b> These are captured goods. Merchants here will buy them from you, but won't sell ${g.name.toLowerCase()} to you until your net worth reaches ${gold(g.unlock)}.`)}>sell only</span>` : ''}</td>
        <td class="${priceClass(g, buy)}">${fmt(buy)}</td>
        <td class="${priceClass(g, sell)}">${fmt(sell)}</td>
        <td>${stock || '<i class="muted">none</i>'}</td>
        <td>${!held ? '<span class="muted">-</span>' : pl === null ? `${held} <small class="up">free</small>` :
          `${held} <small class="${pl >= 0 ? 'up' : 'down'}">${pl >= 0 ? '+' : ''}${pl}%</small>`}</td>
        <td class="trade">
          <input type="number" min="0" value="" placeholder="qty" data-qty="${g.id}">
          <button data-act="max-buy" data-good="${g.id}" title="Fill with the most you can buy" ${locked ? 'disabled' : ''}>Max</button>
          <button class="buy" data-act="buy" data-good="${g.id}" ${noBuy ? 'disabled' : ''}><span>Buy</span><small></small></button>
          <button data-act="all-sell" data-good="${g.id}" ${!held ? 'disabled' : ''} title="Fill with all you hold">All</button>
          <button class="sell" data-act="sell" data-good="${g.id}" ${!held ? 'disabled' : ''}><span>Sell</span><small></small></button>
        </td></tr>`;
    }).join('');
    el.innerHTML = `<h2>Marketplace</h2>
      <p class="hint">Free hold space: <b>${freeSpace()}</b> · Prices move as you trade. <span class="cheap">Green</span> is cheap, <span class="dear">red</span> is dear.</p>
      <table class="market"><thead><tr><th>Good</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Held</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    el.oninput = (ev) => { const id = ev.target.dataset.qty; if (id) showRowQuote(el, id, ev.target.value); };
  }

  // Live totals on a row's Buy and Sell buttons as the quantity is typed. Shows the
  // quantity actually traded when stock, hold space or cargo held caps the order.
  const stockOf = e => Math.floor(e.stock);

  // Explanations for the market's tags (shown by the tooltip helper below).
  function contrabandTip(g) {
    const nation = TW.nationOf(S.port).name, good = g.name.toLowerCase();
    return `<b>Contraband in ${nation} ports.</b> The ${nation} crown bans ${good}. You can still sell it here on the black market, but nobody will sell it to you.
      <br><br>Sail into any ${nation} port with ${good} aboard and a navy patrol may stop you: submit and lose the cargo plus a fine, offer a bribe, or try to outrun them.
      <br><br>Taverns sometimes offer smuggling jobs that pay well for running it in.`;
  }
  function eventTip(kind, g) {
    const good = g.name.toLowerCase();
    if (kind === 'shortage' && TW.banned(S.port, g.id)) return `<b>Shortage.</b> ${good.charAt(0).toUpperCase() + good.slice(1)} is banned here, and the black market has run dry. It pays well above the usual price for a few weeks, if you can get it past the navy.`;
    return kind === 'shortage'
      ? `<b>Shortage.</b> ${port().name} has run short of ${good}, so it pays well above the usual price for a few weeks. A good time to sell here.`
      : `<b>Glut.</b> ${port().name} is overflowing with ${good}, so it's cheap for a few weeks. A good time to buy here.`;
  }
  // Markup that gives an element a tooltip: hover, keyboard focus or a tap shows it.
  const tip = html => `tabindex="0" role="note" data-tip="${esc(html.replace(/\s+/g, ' '))}"`;

  function showRowQuote(el, id, value) {
    const q = Math.max(0, Math.floor(+value || 0));
    const e = S.market[S.port][id], held = S.ship.cargo[id]?.qty || 0;
    const buyBtn = el.querySelector(`button.buy[data-good="${id}"]`), sellBtn = el.querySelector(`button.sell[data-good="${id}"]`);
    const set = (btn, n, total, short) => {
      const small = btn.querySelector('small');
      small.textContent = n > 0 ? `${n < q ? n + ' for ' : ''}${fmt(total)} g` : '';
      btn.classList.toggle('short', !!short);
      btn.title = short ? 'Not enough cash' : '';
    };
    const nb = Math.min(q, Math.floor(e.stock), Math.max(0, freeSpace()));
    const cost = nb > 0 ? TW.quoteBuy(S, S.port, id, nb).total : 0;
    set(buyBtn, nb, cost, nb > 0 && cost > S.cash);
    const ns = Math.min(q, held);
    set(sellBtn, ns, ns > 0 ? TW.quoteSell(S, S.port, id, ns).total : 0, false);
  }

  function trade(kind, id) {
    const input = document.querySelector(`[data-qty="${id}"]`);
    let q = Math.max(0, Math.floor(+input.value || 0));
    const g = TW.GOOD[id], e = S.market[S.port][id];
    if (kind === 'buy') {
      if (!TW.goodUnlocked(S, g)) return toast(`Merchants won't sell ${g.name.toLowerCase()} to you until ${gold(g.unlock)} net worth.`, 'bad');
      if (TW.banned(S.port, id)) return toast(`${g.name} is contraband in ${port().name}. Nobody will sell it to you openly.`, 'bad');
      if (!q) q = TW.maxBuy(S, S.port, id, S.cash, freeSpace());
      q = Math.min(q, Math.floor(e.stock), freeSpace());
      if (q <= 0) {
        if (freeSpace() <= 0) { speak('holdFull'); return render(); }
        if (S.cash < TW.unitBuy(e)) { speak('cantAfford'); return render(); }
        return toast('Nothing to buy.', 'bad');
      }
      const cost = TW.quoteBuy(S, S.port, id, q).total;
      if (cost > S.cash) { speak('cantAfford'); return render(); }
      TW.applyBuy(S, S.port, id, q);
      TW.sfx('crate');
      S.cash -= cost;
      const c = S.ship.cargo[id] || (S.ship.cargo[id] = { qty: 0, cost: 0 });
      c.cost = (c.cost * c.qty + cost) / (c.qty + q); c.qty += q;
      toast(`Bought ${q} ${g.name} for ${gold(cost)}`);
      log(`Bought ${q} ${g.name.toLowerCase()} in ${port().name} for ${fmt(cost)} gold.`);
      speak(q >= 50 ? 'bigBuy' : 'buy');
    } else {
      const c = S.ship.cargo[id]; if (!c) return;
      if (!q) q = c.qty;
      q = Math.min(q, c.qty); if (q <= 0) return;
      const got = TW.applySell(S, S.port, id, q);
      S.cash += got;
      const profit = got - c.cost * q;
      S.stats.profit += profit;
      c.qty -= q; if (!c.qty) delete S.ship.cargo[id];
      toast(`Sold ${q} ${g.name} for ${gold(got)} <span class="${profit >= 0 ? 'up' : 'down'}">(${profit >= 0 ? '+' : ''}${fmt(profit)})</span>`, profit >= 0 ? 'good' : '');
      log(`Sold ${q} ${g.name.toLowerCase()} in ${port().name} for ${fmt(got)} gold, ${profit >= 0 ? 'a profit' : 'a loss'} of ${fmt(Math.abs(profit))}.`);
      if (profit > 0) TW.sfx('coins');
      speak(profit >= 0 ? 'sellProfit' : 'sellLoss');
    }
    S.peakWorth = Math.max(S.peakWorth, worth());
    checkMilestones(); remember(); save(); render();
  }

  const roundCost = () => Math.round(50 * mods().drinks);
  const bankRate = () => BANK_RATE * mods().bankRate * TW.diff.bank;
  const overduePct = () => +(OVERDUE_RATE * mods().loanRate * TW.diff.loan * 100).toFixed(1);
  // Each tavern's curiosity trader and each shipyard's fittings restock monthly.
  function curiosAt(portId) {
    const month = monthIndex(S.day), store = S.curios || (S.curios = {});
    if (!store[portId] || store[portId].month !== month) {
      const pool = TW.CURIOS.filter(c => c.price <= Math.max(25000, S.peakWorth * 1.5));
      const n = Math.random() < 0.5 ? 1 : 2, picks = [];
      while (picks.length < Math.min(n, pool.length)) { const c = pool[Math.floor(Math.random() * pool.length)]; if (!picks.some(o => o.id === c.id)) picks.push({ id: c.id, price: Math.round(c.price * rand(0.9, 1.15) / 100) * 100 }); }
      store[portId] = { month, offers: picks };
    }
    return store[portId].offers;
  }
  function fittingsAt(portId) {
    const month = monthIndex(S.day), store = S.fitStock || (S.fitStock = {});
    if (!store[portId] || store[portId].month !== month) {
      const ids = TW.FITTINGS.map(f => f.id).sort(() => Math.random() - 0.5).slice(0, irand(3, 4));
      store[portId] = { month, ids: TW.FITTINGS.map(f => f.id).filter(id => ids.includes(id)) };
    }
    return store[portId].ids.map(id => TW.FITTING[id]);
  }

  function renderTavern(el) {
    const chartCost = 2500 + 2000 * Math.max(0, S.known.length - 9);
    const unknown = TW.PORTS.length - S.known.length;
    const tavernName = (TW.keeper(S.port, 'tavern').title.match(/^Keeper of (?:the )?(.+)$/) || [])[1];
    el.innerHTML = `<h2>${tavernName ? (/^[A-Z’']/.test(tavernName) && !/^(La|El|’t) /.test(tavernName) ? 'The ' : '') + tavernName : 'The Tavern'}</h2>
      <p class="hint">Sailors talk when the drinks are free. Buy a round and hear what's going around the harbor.</p>
      <div class="row wrap">
        <button data-act="rumor">🍺 Buy a round (${fmt(roundCost())} g)</button>
        <button data-act="chart" ${!unknown ? 'disabled' : ''}>🗺 Buy a sea chart (${fmt(chartCost)} g)</button>
        <button data-act="wait">🛏 Wait 3 days</button>
      </div>
      <p class="hint">${unknown ? `${unknown} ports are still uncharted. Grow your fortune or buy charts to find them.` : 'You have charted every port in the Caribbean.'}</p>
      <h3>Whispers in the back room</h3>
      ${(() => { const offers = TW.boardOffers(S, S.port, 'tavern', contractCtx());
        return offers.length ? '<p class="hint">Banned goods pay handsomely, if the navy doesn’t catch you on the way in.</p>' + offers.map(c => contractCard(c, 'take')).join('')
          : '<p class="hint">Nobody here wants anything smuggled. Yet.</p>'; })()}
      <h3>The curiosity trader</h3>
      <p class="hint">A sly fellow with a tray of charms. Some work as promised. Some don’t. You only find out once you’ve paid.</p>
      ${(() => { const offers = curiosAt(S.port);
        return offers.length ? offers.map(o => { const c = TW.CURIO[o.id], owned = (S.items || []).some(it => it.id === o.id);
          return `<div class="contract curio"><span class="c-ico">${c.icon}</span>
            <div class="c-body"><b>${c.name}</b><i class="c-note">“${c.promise}”</i></div>
            <span class="c-reward">${gold(o.price)}</span>
            <button data-act="buy-curio" data-id="${o.id}" ${owned ? 'disabled title="You already carry one"' : ''}>${owned ? 'Owned' : 'Buy'}</button></div>`; }).join('')
          : '<p class="hint">The trader has sold out. Come back next month.</p>'; })()}`;
  }

  function renderShipyard(el) {
    const d = shipDef(), missing = d.hull - S.ship.hull, rate = 40 + 15 * TW.SHIPS.findIndex(x => x.id === d.id);
    const repairCost = missing * rate, fixGun = 400;
    const tradeIn = Math.round(d.price * 0.6 * (0.5 + 0.5 * S.ship.hull / d.hull) / 100) * 100;
    const offers = (S.offers[S.port] || []).filter(o => o.id !== S.ship.type);
    el.innerHTML = `<h2>Shipyard</h2>
      <div class="grid2">
        <div>
          <h3>Repairs</h3>
          <p>Hull ${S.ship.hull}/${d.hull}. ${missing ? `Full repair costs ${gold(repairCost)}.` : 'She is in fine shape.'}</p>
          <div class="row"><button data-act="repair" ${!missing ? 'disabled' : ''}>Repair hull</button>
          <button data-act="fixguns" ${!S.ship.broken ? 'disabled' : ''}>Fix ${S.ship.broken} cannon${S.ship.broken === 1 ? '' : 's'} (${fmt(fixGun * S.ship.broken)} g)</button></div>
          <h3>Cannons</h3>
          <p>${S.ship.guns}/${d.guns} mounted. Each takes ${TW.GUN_SPACE} hold space. Buy ${gold(TW.CANNON_PRICE)}, sell ${gold(TW.CANNON_PRICE / 2)}.</p>
          <div class="row"><button data-act="gun-buy" ${S.ship.guns >= d.guns ? 'disabled' : ''}>Buy cannon</button><button data-act="gun-sell" ${!S.ship.guns ? 'disabled' : ''}>Sell cannon</button></div>
          <h3>Special ammunition</h3>
          ${TW.AMMO.map(a => `<div class="kv"><span><b>${a.name}</b> (${S.ammo[a.id]}): ${a.desc}</span><button class="ammo-buy" data-act="ammo" data-ammo="${a.id}">Buy · ${fmt(a.price)} g</button></div>`).join('')}
          <h3>Fittings for your ${d.name}</h3>
          <p class="hint">Built into the ship: if you buy another ship, they stay behind with this one. Stock changes every month.</p>
          ${fittingsAt(S.port).map(f => {
            const have = (S.ship.fittings || []), installed = have.includes(f.id);
            const better = TW.FITTINGS.find(x => x.replaces === f.id && have.includes(x.id));
            const price = TW.fittingPrice(f, TW.SHIP[S.ship.type]);
            return `<div class="kv fitting"><span>${f.icon} <b>${f.name}</b>: ${f.desc}${f.replaces && have.includes(f.replaces) ? ` <small>(replaces your ${TW.FITTING[f.replaces].name})</small>` : ''}</span>
              <button class="ammo-buy" data-act="buy-fitting" data-id="${f.id}" ${installed || better ? 'disabled' : ''}>${installed ? 'Installed' : better ? 'Superseded' : `Fit · ${fmt(price)} g`}</button></div>`;
          }).join('')}
        </div>
        <div>
          <h3>Ships for sale</h3>
          <p class="hint">Trade-in value of your ${d.name}: ${gold(tradeIn)}</p>
          ${offers.length ? offers.map(o => {
            const s = TW.SHIP[o.id], locked = S.peakWorth < s.unlock;
            return `<div class="ship-offer ${locked ? 'locked' : ''}">
              <canvas width="320" height="180" data-ship="${o.id}"></canvas>
              <div><b>${s.name}</b> · ${gold(o.price)}<br><small>Hull ${s.hull} · Hold ${s.cargo} · Cannons ${s.guns} · Speed ${s.speed} · Upkeep from ${fmt(TW.upkeep(s, 0))} g/day</small><br>
              ${locked ? `<small class="bad">Shipwrights won't sell to you until ${fmt(s.unlock)} net worth.</small>` :
                `<button data-act="buyship" data-ship="${o.id}" data-price="${o.price}">Buy for ${fmt(Math.max(0, o.price - tradeIn))} g after trade-in</button>`}</div></div>`;
          }).join('') : '<p>No ships on the slipway this month.</p>'}
        </div>
      </div>`;
    el.querySelectorAll('canvas[data-ship]').forEach(c => {
      TW.drawShipFit(c.getContext('2d'), c.dataset.ship, c.width, c.height, { water: c.height * 0.88, flag: '#1f6f8b' });
    });
  }

  function renderBank(el) {
    el.innerHTML = `<h2>Bank</h2>
      <p>Deposits are safe from pirates and earn <b>${+(bankRate() * 100).toFixed(2)}% a month</b>. Wages are drawn from here if your purse runs dry. Your balance: ${gold(S.bank)}</p>
      <div class="row"><input type="number" id="amt" min="0" placeholder="amount">
      <button data-act="deposit">Deposit</button><button data-act="withdraw">Withdraw</button>
      <button class="ghost" data-act="deposit-all">Deposit all</button><button class="ghost" data-act="withdraw-all">Withdraw all</button></div>
      ${[['cash', 'Of your purse', S.cash], ['bank', 'Of your balance', S.bank]].map(([of, label, total]) => `<div class="quick-fill"><span>${label}</span>
        ${[25, 50, 75].map(pct => `<button class="chip" data-act="bank-fill" data-of="${of}" data-pct="${pct}" ${total > 0 ? '' : 'disabled'}>${pct}%<small>${fmt(Math.floor(total * pct / 100))}</small></button>`).join('')}</div>`).join('')}
      <p class="hint">You can only use banks in ports that have one.</p>`;
  }
  function renderLender(el) {
    const max = loanLimit(), overdue = loanOverdue();
    const due = S.debt > 0 && S.loanDue ? (overdue ? `<b class="bad">Overdue since ${dateStr(S.loanDue)}.</b> Interest is now ${overduePct()}% a month and collectors will meet you in any port with a moneylender.`
      : `Due in <b>${S.loanDue - S.day} days</b> (${dateStr(S.loanDue)}).`) : '';
    el.innerHTML = `<h2>Moneylender</h2>
      <p>${mods().noLoans ? '<b class="bad">Word of your Banker’s Doll has reached the moneylenders. They will not lend to you.</b>' : `Loans cost <b>${+(LOAN_RATE * mods().loanRate * TW.diff.loan * 100).toFixed(1)}% a month</b>, up to ${mods().loanCap > 1 ? `${mods().loanCap}× ` : ''}your net worth, and fall due ${LOAN_TERM} days after you first borrow.`}</p>
      <p>Current debt: ${gold(S.debt)} ${due}</p>
      <p>${overdue ? 'No new loans until you settle up.' : `You may borrow up to ${gold(max)}.`}</p>
      <div class="row"><input type="number" id="amt" min="0" placeholder="amount">
      <button data-act="borrow">Borrow</button><button data-act="repay">Repay</button><button class="ghost" data-act="repay-all">Repay all</button></div>`;
  }

  // ----- Map & voyage -----
  let mapRaf = 0, mapState = null;
  function stopMapLoop() { cancelAnimationFrame(mapRaf); mapRaf = 0; mapState = null; }

  function renderMap(el) {
    el.innerHTML = `
      <div class="map-wrap"><canvas id="map" width="${TW.MAP.w * 2}" height="${TW.MAP.h * 2}"></canvas>
        <div id="map-tip" class="map-tip" hidden></div></div>
      <div class="map-bar">
        <span id="map-status">Choose a destination. Hover a port to see what you last saw there.</span>
        <button class="ghost" data-act="back-port" id="btn-back">Stay in port</button>
      </div>`;
    const c = $('#map'), ctx = c.getContext('2d');
    ctx.scale(2, 2);
    mapState = { ctx, hover: null, voyage: null };
    const toMap = ev => { const r = c.getBoundingClientRect(); return [(ev.clientX - r.left) * TW.MAP.w / r.width, (ev.clientY - r.top) * TW.MAP.h / r.height]; };
    c.onmousemove = ev => {
      if (mapState.voyage) return;
      const p = TW.portAt(...toMap(ev));
      mapState.hover = p && p.id;
      c.style.cursor = p && S.known.includes(p.id) && p.id !== S.port ? 'pointer' : 'default';
      showTip(p, ev);
    };
    c.onmouseleave = () => { mapState.hover = null; $('#map-tip').hidden = true; };
    c.onclick = ev => {
      if (mapState.voyage) return;
      const p = TW.portAt(...toMap(ev));
      if (!p) return;
      if (!S.known.includes(p.id)) return toast('That port is uncharted. Buy a chart in a tavern, or grow your fame.', 'bad');
      if (p.id === S.port) return go('port');
      confirmSail(p);
    };
    const loop = () => {
      if (!mapState) return;
      const v = mapState.voyage;
      const route = v ? v.route : mapState.hover && S.known.includes(mapState.hover) && mapState.hover !== S.port ? TW.route(S.port, mapState.hover) : null;
      TW.drawMap(ctx, { state: S, hover: mapState.hover, route, ship: v ? v.pos : null, storm: v && v.storm });
      mapRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  function travelDays(route) {
    const load = usedSpace() / shipDef().cargo;
    return Math.max(1, Math.ceil(route.len / shipDef().speed * (1 + load * 0.15)));
  }

  function showTip(p, ev) {
    const tip = $('#map-tip');
    if (!p) { tip.hidden = true; return; }
    const known = S.known.includes(p.id);
    let html = `<b>${known ? p.name : 'Uncharted port'}</b>`;
    if (known && p.id !== S.port) {
      const r = TW.route(S.port, p.id);
      html += `<br>About ${travelDays(r)} days' sail`;
    } else if (p.id === S.port) html += '<br>You are here';
    if (known) {
      const svc = ['Market', 'Tavern'].concat(p.svc.includes('S') ? ['Shipyard'] : [], p.svc.includes('B') ? ['Bank'] : [], p.svc.includes('L') ? ['Lender'] : []);
      html += `<br><small>${svc.join(' · ')}</small>`;
      const seen = S.seen[p.id];
      if (seen) {
        const goods = TW.GOODS.filter(g => TW.goodUnlocked(S, g));
        html += `<div class="tip-prices"><small>Prices ${S.day - seen.day ? `${S.day - seen.day} days ago` : 'today'}:</small>` +
          goods.map(g => `<div><span>${g.icon} ${g.name}</span><span class="${priceClass(g, seen.p[g.id])}">${fmt(seen.p[g.id])}</span></div>`).join('') + '</div>';
      } else html += '<br><small><i>Never visited</i></small>';
      const due = contracts().filter(c => c.to === p.id);
      if (due.length) html += `<div class="tip-contracts">${due.map(c => `<div>${TW.contractIcon(c)} ${TW.describeContract(c)}<small> · due in ${c.due - S.day} days</small></div>`).join('')}</div>`;
      if (isHostile(p.id)) html += `<br><b class="bad">☠ Seized by ${esc(hostile()[p.id].captain)}'s pirates.</b><br><small class="bad">The harbor is closed. Fight your way in to free it.</small>`;
      const bans = TW.nationOf(p.id).bans.filter(id => TW.goodUnlocked(S, TW.GOOD[id]));
      if (bans.length) html += `<br><small class="bad">${TW.nationOf(p.id).name} port: ${bans.map(id => TW.GOOD[id].name.toLowerCase()).join(' and ')} banned</small>`;
    }
    tip.innerHTML = html; tip.hidden = false;
    const wrap = tip.parentElement.getBoundingClientRect();
    let x = ev.clientX - wrap.left + 16, y = ev.clientY - wrap.top + 12;
    if (x + tip.offsetWidth > wrap.width) x -= tip.offsetWidth + 32;
    if (y + tip.offsetHeight > wrap.height) y = wrap.height - tip.offsetHeight - 6;
    tip.style.left = x + 'px'; tip.style.top = Math.max(4, y) + 'px';
  }

  function confirmSail(p) {
    preloadScene(p.id);
    const r = TW.route(S.port, p.id), days = travelDays(r);
    const d = shipDef();
    const warn = [];
    if (S.ship.hull < d.hull * 0.5) warn.push('Your hull is badly damaged.');
    if (stormOdds() >= 1.4) warn.push(`${WEATHER[seaAt().wx].name} weather: ${WEATHER[seaAt().wx].desc.split('. ')[1]}`);
    if (!S.ship.guns) warn.push('You carry no cannons. Pirates will find you easy prey.');
    if (contracts().some(c => c.risky && c.to === p.id)) warn.push(`Word of your job for ${p.name} has spread. Pirates are watching for you.`);
    if (isHostile(p.id)) warn.push(`${hostile()[p.id].captain}'s pirates hold ${p.name}. You'll have to fight past its fort to dock.`);
    const contraband = bannedAboard(p.id);
    if (contraband.length) warn.push(`${contraband.map(id => TW.GOOD[id].name).join(' and ')} ${contraband.length > 1 ? 'are' : 'is'} contraband in ${p.name}. Navy patrols may stop you.`);
    modal(`<h2>Sail to ${p.name}?</h2>
      <p>The voyage should take about <b>${days} days</b>, costing about ${gold(days * TW.upkeep(d, S.ship.guns))} in wages and provisions.</p>
      ${warn.map(w => `<p class="bad">⚠ ${w}</p>`).join('')}`,
      [['Weigh anchor!', () => startVoyage(p.id, r, days), 'big'], ['Not yet', null, 'ghost']]);
  }

  // ----- Sea conditions -----
  // Each port's harbor office posts its own pirate activity and weather, fresh each week.
  // Activity centres on how dangerous the sea has become (your wealth and the years) but
  // swings either way, and the swing changes how often pirates find you. Weather follows
  // the season: August to October is hurricane season.
  const ACTIVITY = ['Quiet', 'Some sightings', 'Dangerous', 'Deadly'];
  const SWING = [[-2, 0.15, 0.55], [-1, 0.3, 0.75], [0, 0.35, 1], [1, 0.15, 1.45], [2, 0.05, 1.9]];   // offset, weight, encounter odds (averages about 1)
  const WEATHER = [
    { name: 'Fair', storm: 0.35, desc: 'Clear skies and steady trade winds. A storm is unlikely.' },
    { name: 'Overcast', storm: 0.8, desc: 'Grey skies, but nothing brewing. Little chance of a storm.' },
    { name: 'Squally', storm: 1.4, desc: 'Squalls on the horizon. A storm is likelier than usual.' },
    { name: 'Stormy', storm: 2.2, desc: 'A gale is building. Sail now and you may well meet a storm.' },
  ];
  // A word on what your own ship does to those odds (charms and fittings).
  const shipWeather = m => m.storm === 0 ? 'Your Ultimate Compass will steer you clear of any storm.'
    : m.storm < 1 ? 'Your ship\u2019s charms make a storm less likely.' : m.storm > 1 ? 'Your light trim makes a storm more likely.' : '';
  const pickWeighted = w => { let k = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while ((k -= w[i]) > 0 && i < w.length - 1) i++; return i; };
  const hurricaneSeason = () => monthIndex(S.day) % 12 >= 7 && monthIndex(S.day) % 12 <= 9;
  const dangerTier = () => { const D = dangerLevel(); return D < 6 ? 0 : D < 14 ? 1 : D < 26 ? 2 : 3; };
  function seaAt(id = S.port) {
    const wk = Math.floor(S.day / 7), sea = S.sea || (S.sea = {});
    if (!sea[id] || sea[id].wk !== wk) {
      const [off, , odds] = SWING[pickWeighted(SWING.map(x => x[1]))];
      sea[id] = { wk, act: Math.max(0, Math.min(3, dangerTier() + off)), pirates: odds,
        wx: pickWeighted(hurricaneSeason() ? [0.1, 0.3, 0.35, 0.25] : [0.3, 0.4, 0.2, 0.1]) };
    }
    return sea[id];
  }
  // How much likelier than usual a storm is if you sail from here now, counting your ship.
  const stormOdds = (id = S.port) => WEATHER[seaAt(id).wx].storm * mods().storm;

  function dangerLevel() {
    const w = Math.max(1, worth());
    // Mostly driven by wealth; the sea also grows a little more dangerous every two years.
    return Math.max(0, Math.min(48, Math.round(4 * Math.log2(w / 4000)) + Math.floor(S.day / 730) + TW.diff.danger));
  }

  function makeFleet() {
    const D = dangerLevel();
    // Pirates strike less often than they used to, but in bigger fleets.
    const n = 1 + (Math.random() < D / 24) + (Math.random() < D / 40) + (Math.random() < D / 60);
    const pool = TW.ENEMIES.filter(e => e.tier <= D);
    const fleet = [];
    for (let i = 0; i < n; i++) {
      const weights = pool.map(e => 1 + 1.5 * e.tier / (D + 1));
      let k = Math.random() * weights.reduce((a, b) => a + b), j = 0;
      while ((k -= weights[j]) > 0) j++;
      fleet.push({ ...pool[Math.min(j, pool.length - 1)] });
    }
    return { captain: TW.PIRATE_NAMES[Math.floor(Math.random() * TW.PIRATE_NAMES.length)], ships: fleet };
  }

  function startVoyage(dest, route, days) {
    preloadScene(dest);
    S.stats.voyages++;
    TW.sfx('sail');
    const scale = Math.max(0.5, Math.min(1.6, route.len / 350));
    const events = [];
    const m = mods();
    const sea = seaAt(S.port);   // conditions where you weigh anchor
    if (Math.random() < 0.12 * scale * m.storm * TW.diff.storms * WEATHER[sea.wx].storm) events.push({ t: rand(0.2, 0.8), kind: 'storm' });
    // Fewer but tougher encounters; a fuller hold draws more attention.
    const watched = contracts().some(c => c.risky && c.to === dest);   // a leaked job draws pirates
    const pirateChance = (0.18 * scale * (cargoQty() ? 0.75 + 0.5 * usedSpace() / shipDef().cargo : 0.5) + (watched ? 0.2 : 0)) * m.pirates * TW.diff.pirates * sea.pirates;
    if (Math.random() < pirateChance) events.push({ t: rand(0.25, 0.85), kind: 'pirates' });
    if (Math.random() < 0.05) events.push({ t: rand(0.2, 0.8), kind: 'flotsam' });
    // Navy patrols watch the approaches to ports that ban goods you are carrying.
    if (bannedAboard(dest).length) {
      const smuggling = contracts().some(c => c.kind === 'smuggle' && c.to === dest);
      if (Math.random() < Math.min(0.5, 0.2 * scale + (smuggling ? 0.15 : 0)) * m.patrol) events.push({ t: rand(0.6, 0.9), kind: 'patrol' });
    }
    if (TW._debug.nextEvents) { TW._debug.nextEvents.forEach(kind => events.push({ t: rand(0.2, 0.8), kind })); TW._debug.nextEvents = null; }
    events.sort((a, b) => a.t - b.t);
    const v = { dest, route, days, events, t: 0, dayDone: 0, paused: false, pos: TW.pointAlong(route, 0) };
    mapState.voyage = v; mapState.hover = null;
    $('#map-tip').hidden = true;
    $('#btn-back').hidden = true;
    $('#map-status').innerHTML = `Sailing to <b>${TW.PORT[dest].name}</b>…`;
    log(`Set sail from ${port().name} bound for ${TW.PORT[dest].name}.`);
    const dur = Math.max(1800, Math.min(6500, days * 320));
    let last = performance.now();
    const step = (now) => {
      if (!mapState || mapState.voyage !== v) return;
      const dt = Math.max(0, now - last); last = now;   // a frame can be stamped slightly before `last`
      if (!v.paused) {
        v.t = Math.min(1, v.t + dt / dur);
        v.pos = TW.pointAlong(route, v.t);
        while (v.dayDone < Math.floor(v.t * days)) { v.dayDone++; passDay(); hud(); }
        if (v.events.length && v.t >= v.events[0].t) { v.paused = true; runEvent(v, v.events.shift()); }
        else if (v.t >= 1) return isHostile(dest) ? hostileArrival(v) : arrive(dest);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function resume(v) { v.paused = false; v.storm = false; hud(); }

  function hostileArrival(v) {
    const p = TW.PORT[v.dest], h = hostile()[v.dest];
    v.paused = true;
    TW.sfx('bell');
    modal(`<h2>☠ A hostile port!</h2>
      <p>A black flag flies over ${p.name}. <b>${esc(h.captain)}</b>'s pirates hold the town, and the fort's guns are run out. The only way into the harbor is to take it back.</p>
      <p class="hint">Shore guns are easy to hit and easy to sail away from, but there are a lot of them. You have ${S.ship.guns - S.ship.broken} working cannons and ${S.ship.hull} hull.</p>`,
      [['⚔ Attack the port', () => fight(v, makeDefenses(v.dest)), 'big'],
       ['⛵ Sail on elsewhere', () => turnAway(v, `Turned away from ${p.name}, which is held by pirates.`), 'ghost']]);
  }
  // Leave a hostile port's waters for the nearest open harbor.
  function turnAway(v, text) {
    const near = nearestOpenPort(TW.PORT[v.dest], v.dest);
    const days = travelDays(TW.route(v.dest, near.id));
    for (let i = 0; i < days; i++) passDay();
    log(`${text} Made for ${near.name}, ${days} more days at sea.`);
    toast(`You make for ${near.name} (${days} days).`);
    if (mapState) mapState.voyage = null;
    arrive(near.id);
  }

  function runEvent(v, ev) {
    if (ev.kind === 'storm') return stormEvent(v);
    if (ev.kind === 'flotsam') {
      const goods = TW.GOODS.filter(g => TW.goodUnlocked(S, g) && g.id !== 'gems');
      const g = goods[Math.floor(Math.random() * goods.length)];
      const q = Math.min(freeSpace(), irand(3, 15));
      if (q <= 0) return resume(v);
      const c = S.ship.cargo[g.id] || (S.ship.cargo[g.id] = { qty: 0, cost: 0 });
      c.cost = c.cost * c.qty / (c.qty + q); c.qty += q;
      log(`Fished ${q} crates of ${g.name.toLowerCase()} out of the sea from some unlucky wreck.`);
      return modal(`<h2>Flotsam!</h2><p>Your lookout spots floating crates. You haul aboard <b>${q} ${g.name}</b>.</p>`, [['Splendid', () => resume(v)]]);
    }
    if (ev.kind === 'pirates') return pirateEvent(v);
    if (ev.kind === 'patrol') return patrolEvent(v);
  }

  const bannedAboard = dest => Object.keys(S.ship.cargo).filter(id => S.ship.cargo[id].qty > 0 && TW.banned(dest, id));

  // A navy patrol hails you near a port whose banned goods are in your hold.
  function patrolEvent(v) {
    const ids = bannedAboard(v.dest);
    if (!ids.length) return resume(v);
    const nation = TW.nationOf(v.dest);
    const value = ids.reduce((a, id) => a + S.ship.cargo[id].qty * S.market[v.dest][id].base, 0);
    const list = ids.map(id => `${S.ship.cargo[id].qty} ${TW.GOOD[id].name.toLowerCase()}`).join(', ');
    const bribe = Math.max(500, Math.round(value * 0.3 / 10) * 10);
    const escape = Math.max(0.1, Math.min(0.8, 0.4 + (shipDef().speed - 44) / 50 - usedSpace() / shipDef().cargo * 0.2));
    const confiscate = (mult, extra = '') => {
      ids.forEach(id => delete S.ship.cargo[id]);
      const fine = takeFrom(Math.round(value * 0.25 * mult));
      S.stats.seized = (S.stats.seized || 0) + 1;
      log(`${nation.name} navy seized ${list}${fine ? ` and fined you ${fmt(fine)} gold` : ''}.`);
      TW.sfx('bad');
      modal(`<h2>Contraband seized</h2>${extra}<p>The ${nation.name} officers confiscate <b>${list}</b>${fine ? ` and fine you <b>${gold(fine)}</b>` : ''}.</p>`, [['Sail on', () => resume(v)]]);
    };
    TW.sfx('bell');
    modal(`<h2>⚓ Navy patrol!</h2>
      <p>${nation.navy.charAt(0).toUpperCase() + nation.navy.slice(1)} signals you to heave to for inspection off ${TW.PORT[v.dest].name}.</p>
      <p>Your hold carries <b class="bad">${list}</b>, which is contraband there.</p>`,
      [['Submit to inspection', () => confiscate(1), 'ghost'],
       [`💰 Offer a bribe (${fmt(bribe)} g)`, () => {
          if (S.cash < bribe) return confiscate(1, '<p>You fumble for coins you don’t have. The officer is not amused.</p>');
          S.cash -= bribe;
          if (Math.random() < 0.7) { log(`Bribed a ${nation.name} officer ${fmt(bribe)} gold to look the other way.`); toast('The officer pockets the purse and waves you on.', 'good'); resume(v); }
          else confiscate(1, `<p>The officer takes your ${fmt(bribe)} gold, then searches the hold anyway.</p>`);
        }],
       [`⛵ Run for it (${Math.round(escape * 100)}%)`, () => {
          if (Math.random() < escape) { log(`Outran ${nation.navy} with a hold full of contraband.`); toast('You slip away into the haze!', 'good'); resume(v); }
          else confiscate(1.6, '<p>The patrol runs you down. Running has made things worse.</p>');
        }, 'big']]);
  }

  function stormEvent(v) {
    S.stats.storms++;
    v.storm = true; TW.sfx('storm');
    if (Math.random() < 0.15) {
      log('A squall line chased you, but the crew outran it.');
      return modal(`<h2>Storm on the horizon</h2><p>Black clouds race toward you, but your crew crowds on sail and outruns the worst of it.</p>`, [['Onward', () => resume(v)]]);
    }
    const d = shipDef();
    const dmg = Math.min(S.ship.hull - 1, Math.max(1, Math.round(d.hull * rand(0.05, 0.18))));
    S.ship.hull -= dmg;
    const lost = irand(1, 4);
    for (let i = 0; i < lost; i++) passDay();
    v.days += lost;
    let lostCargo = '';
    const stacks = Object.entries(S.ship.cargo);
    if (stacks.length && Math.random() < 0.3) {
      const [id, c] = stacks[Math.floor(Math.random() * stacks.length)];
      const q = Math.max(1, Math.round(c.qty * rand(0.1, 0.3)));
      c.qty -= q; if (!c.qty) delete S.ship.cargo[id];
      lostCargo = `<p class="bad">${q} crates of ${TW.GOOD[id].name.toLowerCase()} washed overboard.</p>`;
    }
    log(`Battered by a storm: ${dmg} hull damage and ${lost} days lost.`);
    modal(`<h2>Storm!</h2><p>Howling winds and mountainous seas. Timbers groan as you ride it out.</p>
      <p class="bad">Hull damage: ${dmg} · Days lost: ${lost}</p>${lostCargo}`, [['Ride it out', () => resume(v)]]);
  }

  function pirateEvent(v) {
    const fleet = makeFleet();
    const list = fleet.ships.map(s => `<li>${s.name} <small>(${s.guns} guns)</small></li>`).join('');
    const escape = Math.max(0.1, Math.min(0.85, 0.5 + (shipDef().speed - 44) / 50 - usedSpace() / shipDef().cargo * 0.2 - 0.08 * (fleet.ships.length - 1)));
    TW.sfx('bell');
    modal(`<h2>☠ Pirates!</h2><p>Sails on the horizon, flying the black flag. <b>${fleet.captain}</b> bears down on you with:</p><ul class="fleet">${list}</ul>
      <p class="hint">You have ${S.ship.guns - S.ship.broken} working cannons and ${S.ship.hull} hull.</p>`,
      [['⚔ Fight', () => fight(v, fleet), 'big'],
       [`⛵ Outrun them (${Math.round(escape * 100)}%)`, () => {
          if (Math.random() < escape) { S.stats.fled++; log(`Outran ${fleet.captain}'s pirates.`); toast('You left them in your wake!', 'good'); resume(v); }
          else { toast('They are too fast! Battle stations!', 'bad'); fight(v, fleet); }
        }],
       ['🏳 Surrender', () => surrender(v, fleet), 'ghost']]);
  }

  function surrender(v, fleet) {
    let lost = [];
    for (const [id, c] of Object.entries(S.ship.cargo)) {
      const q = Math.ceil(c.qty * 0.5); c.qty -= q; lost.push(`${q} ${TW.GOOD[id].name}`);
      if (!c.qty) delete S.ship.cargo[id];
    }
    const take = Math.round(S.cash * (lost.length ? 0.2 : 0.35));
    S.cash -= take;
    log(`Surrendered to ${fleet.captain}. They took ${fmt(take)} gold${lost.length ? ' and half the cargo' : ''}.`);
    modal(`<h2>Surrender</h2><p>The pirates swarm aboard, laughing, and help themselves.</p>
      <p class="bad">Lost: ${fmt(take)} gold${lost.length ? ', ' + lost.join(', ') : ''}</p>`, [['Sail on, poorer', () => resume(v)]]);
  }

  function fight(v, fleet) {
    stopMapLoopKeepVoyage();
    view.screen = 'combat';
    TW.music('combat');
    hud();
    const el = $('#screen');
    transition('battle', () => {
    el.className = 'screen-combat';
    el.innerHTML = `<div class="combat-wrap"><canvas id="combat" width="960" height="540"></canvas></div>
      <div class="combat-bar">
        <span class="hint">${fleet.port ? 'Click the fort, a battery or a ship to target it.' : 'Click an enemy ship to target it.'} Cannons fire on their own; click a special shot to load it into the next gun.</span>
        ${TW.AMMO.map(a => `<button id="ammo-${a.id}" data-act="special" data-ammo="${a.id}" title="${a.desc}">${a.name} <span class="n">0</span></button>`).join('')}
        <button id="btn-flee" class="ghost" data-act="flee">Flee</button>
      </div>`;
    });
    const before = { hull: S.ship.hull, broken: S.ship.broken, ammo: { ...S.ammo }, worth: worth() };
    const d = shipDef();
    TW.Combat.start($('#combat'), { ship: S.ship, stats: { hull: d.hull, reload: d.reload, speed: d.speed }, enemyAim: mods().enemyAim,
      enemies: fleet.ships, ammo: S.ammo, port: fleet.port }, res => {
      TW.Combat.stop();
      S.ship.hull = res.hull; S.ship.broken = res.broken; S.ammo = res.ammo;
      afterCombat(v, fleet, res, before);
    });
  }
  // Leave the voyage object alive while combat runs; the map is rebuilt afterward.
  function stopMapLoopKeepVoyage() { cancelAnimationFrame(mapRaf); mapRaf = 0; }

  function afterCombat(v, fleet, res, before) {
    const backToMap = (then, track = 'sea') => {
      view.screen = 'map'; TW.music(track);
      const saved = mapState.voyage;
      transition('fade', render);
      mapState.voyage = saved;
      $('#btn-back').hidden = true;
      $('#map-status').innerHTML = `Sailing to <b>${TW.PORT[saved.dest].name}</b>…`;
      then && then();
    };
    if (res.outcome === 'win') {
      S.stats.won++;
      before.shotUsed = TW.AMMO.reduce((n, am) => n + Math.max(0, before.ammo[am.id] - S.ammo[am.id]), 0);
      const { spoils, booty, loot } = fleet.port ? liberate(fleet) : plunder(fleet);
      const haul = `${fmt(booty)} gold${loot.length ? ' and ' + loot.map(l => `${l.qty} ${l.name.toLowerCase()}`).join(', ') : ''}`;
      log(fleet.port ? `Liberated ${TW.PORT[fleet.port].name} from ${fleet.captain}'s pirates and took ${haul}.`
        : `Defeated ${fleet.captain}'s pirates and took ${haul}.`);
      TW.sfx('cheer');
      backToMap(() => showPlunder(v, fleet, spoils, booty, loot, before), 'victory');
    } else if (res.outcome === 'fled' && fleet.port) {
      S.stats.fled++;
      backToMap(() => turnAway(v, `Broke off the attack on ${TW.PORT[fleet.port].name}; its defenses were too strong.`));
    } else if (res.outcome === 'fled') {
      S.stats.fled++;
      log(`Escaped ${fleet.captain}'s pirates.`);
      backToMap(() => { toast('You escaped!', 'good'); resume(v); });
    } else shipwreck(v, fleet);
  }

  // ----- Shipwreck -----
  // A sunk ship takes her cargo, cannons, fittings and special shot down with her. The
  // captain is fished out and set ashore at the nearest open home port with a shipyard,
  // where purse and bank must cover a new ship. If they can't, the game is over.
  const HAVENS = START_PORTS.filter(id => TW.PORT[id].svc.includes('S'));
  const RESCUERS = ['a Dutch fluyt', 'a fishing smack', 'a Spanish mail packet', 'a turtling sloop', 'an English merchantman'];
  const cheapestShip = () => Math.min(...TW.SHIPS.map(sh => sh.price));
  function shipwreck(v, fleet) {
    S.stats.lost++;
    const lost = shipDef().name, from = v.pos || port();
    const take = Math.round(S.cash * 0.5); S.cash -= take;
    const haven = HAVENS.filter(id => !isHostile(id)).map(id => TW.PORT[id])
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0] || TW.PORT[S.home];
    const days = Math.min(12, 3 + Math.round(Math.hypot(haven.x - from.x, haven.y - from.y) / 90));
    const rescuer = RESCUERS[Math.floor(Math.random() * RESCUERS.length)];
    // Nothing left but the clothes on your back (and any curiosities in your pockets).
    S.ship = { type: 'sloop', hull: 0, guns: 0, broken: 0, cargo: {}, fittings: [] };
    S.ammo = { chain: 0, fire: 0, keg: 0 };
    mapState.voyage = null;
    log(`Sunk by ${fleet.captain}${fleet.port ? ` off ${TW.PORT[fleet.port].name}` : ''}. The ${lost} went down with all her cargo.`);
    TW.music(null); TW.sfx('defeat');
    modal(`<h2>\u2620 Shipwrecked</h2>
      <p>Your ${lost} slips beneath the waves, taking her cargo, cannons and fittings with her.${take ? ` ${esc(fleet.captain)}\u2019s men pick over the wreckage and take <b>${gold(take)}</b> from your purse.` : ''}</p>
      <p>You cling to a spar until ${rescuer} hauls you aboard and carries you to <b>${haven.name}</b>, ${days} days away.</p>`,
      [['Go ashore', () => {
        for (let i = 0; i < days; i++) passDay();
        if (!S.known.includes(haven.id)) S.known.push(haven.id);
        castaway(haven);
      }, 'big']], 'wreck');
  }
  // Ashore with no ship: buy one with purse and bank together, or retire bankrupt.
  function castaway(haven) {
    S.port = haven.id;
    const funds = S.cash + S.bank;
    if (funds < cheapestShip()) {
      S.ended = 'bankrupt';
      log(`Bankrupt in ${haven.name}, with no ship and no gold to buy one.`);
      TW.sfx('bad');
      return modal(`<h2>Bankrupt</h2>
        <p>You walk the wharf at ${haven.name} with ${gold(funds)} to your name. The cheapest hull in the harbor costs ${gold(cheapestShip())}, and no lender will stake a captain without a ship.</p>
        <p class="bad">Your days as a merchant captain are over.</p>`, [['The end of the road', () => go('end'), 'big']], 'wreck');
    }
    const ships = TW.SHIPS.filter(sh => TW.goodUnlocked(S, sh) && sh.price <= funds);
    modal(`<h2>A ship for ${esc(S.name)}</h2>
      <p>The shipwrights of ${haven.name} have hulls for sale. You have ${gold(S.cash)} in your purse and ${gold(S.bank)} in the bank; the bank covers whatever the purse can't.</p>
      <p class="hint">A new ship comes bare, with ${Math.min(2, TW.SHIP.sloop.guns)} old cannons thrown in.</p>`,
      ships.map((sh, i) => [`${sh.name} · ${fmt(sh.price)} g`, () => newShipAshore(sh.id), i === 0 ? 'big' : 'ghost']), 'wreck');
  }
  function newShipAshore(id) {
    const nd = TW.SHIP[id], fromCash = Math.min(S.cash, nd.price);
    S.cash -= fromCash; S.bank -= nd.price - fromCash;
    S.ship = { type: id, hull: nd.hull, guns: Math.min(2, nd.guns), broken: 0, cargo: {}, fittings: [] };
    S.ship.hull = shipDef().hull;   // curiosities like the Shield Doll still count
    log(`Bought a ${nd.name} in ${port().name} and went back to sea.`);
    TW.sfx('bell');
    arrive(S.port, true);
  }
  // Share out the spoils of a won battle: gold from every ship sunk, plus a chance at
  // cargo, gems, special shot, a working cannon or a chart to an uncharted port.
  function plunder(fleet) {
    const spoils = fleet.ships.map(ship => ({ ship, ...haul(ship) }));
    const booty = spoils.reduce((a, sp) => a + sp.gold, 0);
    S.cash += booty; S.stats.booty += booty;
    const loot = [];
    // Mostly goods you already trade, sometimes a richer cargo from a tier or two above
    // your standing: you can't buy those yet, but any market will buy them from you.
    const goods = TW.GOODS.filter(g => TW.goodUnlocked(S, g) && g.id !== 'gems');
    const rare = TW.GOODS.filter(g => !TW.goodUnlocked(S, g) && g.id !== 'gems').slice(0, 2);
    for (let i = 0; i < spoils.length; i++) {
      if (Math.random() < 0.45) {
        const pool = rare.length && Math.random() < 0.2 ? rare : goods;
        const g = pool[Math.floor(Math.random() * pool.length)];
        addLoot(g.id, pool === rare ? irand(2, 8) : irand(5, 25), loot);
      }
      if (Math.random() < 0.1) addLoot('gems', irand(1, 4), loot);
      if (Math.random() < 0.22) {
        const id = Math.random() < 0.6 ? 'chain' : 'fire', n = irand(1, 2);
        S.ammo[id] += n;
        addItem(loot, { icon: id === 'chain' ? '⛓️' : '🔥', qty: n, name: TW.AMMO_BY[id].name });
      }
      if (Math.random() < 0.12 && S.ship.guns < shipDef().guns && freeSpace() >= TW.GUN_SPACE) {
        S.ship.guns++;
        addItem(loot, { icon: '💣', qty: 1, name: 'Cannon' });
      }
      if (Math.random() < 0.08) {
        const p = revealPort();
        if (p) loot.push({ icon: '🗺️', qty: 1, name: `Chart to ${p.name}`, chart: true });
      }
    }
    S.peakWorth = Math.max(S.peakWorth, worth());
    return { spoils, booty, loot };
  }
  // What one sunk ship or taken fort yields: its own roll, so two of a kind rarely match.
  // Now and then a hold is fat with a strongbox or picked nearly clean; on average it pays
  // the listed booty.
  function haul(ship) {
    const r = Math.random();
    const [mult, note] = r < 0.1 ? [rand(1.8, 2.6), ship.land ? 'Treasury strongroom!' : 'A fat strongbox!']
      : r < 0.18 ? [rand(0.3, 0.5), ship.land ? 'Already looted' : 'Barely a purse']
      : [rand(0.65, 1.2), ''];
    // Odd sums read like counted coin, not a round figure.
    return { gold: Math.max(1, Math.round(ship.booty * mult * TW.diff.booty) + irand(-9, 9)), note };
  }
  // Spoils for taking back a hostile port: the defenders' gold and stores, plus gems from
  // the grateful town (paid in gold instead if the hold is full). The harbor reopens.
  function liberate(fleet) {
    const out = plunder(fleet);
    const gems = irand(1, 2 + fleet.tier), room = Math.min(gems, Math.max(0, freeSpace()));
    if (room) addLoot('gems', room, out.loot);
    const inGold = (gems - room) * TW.GOOD.gems.min;
    if (inGold) { S.cash += inGold; S.stats.booty += inGold; out.booty += inGold; }
    delete hostile()[fleet.port];
    S.stats.liberated = (S.stats.liberated || 0) + 1;
    S.peakWorth = Math.max(S.peakWorth, worth());
    return out;
  }
  // Merge identical spoils into one card with a running count.
  function addItem(list, item) {
    const prev = list.find(l => l.name === item.name);
    if (prev) prev.qty += item.qty; else list.push(item);
  }
  function addLoot(id, q, list) {
    q = Math.min(q, freeSpace()); if (q <= 0) return;
    const c = S.ship.cargo[id] || (S.ship.cargo[id] = { qty: 0, cost: 0 });
    c.cost = c.cost * c.qty / (c.qty + q); c.qty += q;
    const prev = list.find(l => l.good === id);
    if (prev) prev.qty += q;
    else list.push({ good: id, icon: TW.GOOD[id].icon, qty: q, name: TW.GOOD[id].name });
  }

  // The plunder screen: the victory fanfare plays while the haul is counted up.
  function showPlunder(v, fleet, spoils, booty, loot, before) {
    const hullLost = before.hull - S.ship.hull;
    const newlyBroken = Math.max(0, S.ship.broken - before.broken);
    const coins = Array.from({ length: 16 }, () =>
      `<span class="coin-drop" style="left:${irand(4, 96)}%; animation-delay:${(Math.random() * 0.9).toFixed(2)}s; --spin:${irand(-540, 540)}deg">🪙</span>`).join('');
    modal(`
      <div class="plunder-hero" style="${bgStyle('plunder')}">
        <div class="coin-rain" aria-hidden="true">${coins}</div>
        <h1>${fleet.port ? 'Liberated!' : 'Victory!'}</h1>
        <p>${fleet.port ? `${TW.PORT[fleet.port].name} is free! The townsfolk cheer you into the harbor.`
          : `${esc(fleet.captain)}’s ${spoils.length > 1 ? `fleet of ${spoils.length} is` : 'ship is'} sent to the bottom.`}</p>
      </div>
      <div class="plunder-body">
        <section>
          <h3>${fleet.port ? 'Defenses taken' : 'Ships sunk'}</h3>
          ${spoils.map(sp => `<div class="sunk-row">
            <canvas width="300" height="180" ${sp.ship.land ? `data-kind="${sp.ship.kind}"` : `data-look="${sp.ship.look}"`}></canvas>
            <div><b>${sp.ship.name}</b><small>${sp.ship.guns} guns · ${sp.ship.hull} ${sp.ship.land ? 'walls' : 'hull'}</small>${sp.note ? `<em class="haul-note ${sp.gold > sp.ship.booty ? 'rich' : 'poor'}">${sp.note}</em>` : ''}</div>
            <span class="gold">${fmt(sp.gold)}</span></div>`).join('')}
        </section>
        <section>
          <h3>Spoils</h3>
          <div class="booty"><span>🪙</span><b id="booty-count">0</b><small>gold</small></div>
          <div class="loot-grid">${loot.length ? loot.map((l, i) => `<div class="loot" style="--i:${i}">
            <span class="ico">${l.icon}</span>${l.chart ? '' : `<b>${l.qty}</b>`}<small>${esc(l.name)}</small></div>`).join('')
            : '<p class="hint">The holds were empty. Only gold worth taking.</p>'}</div>
        </section>
      </div>
      <div class="plunder-cost">
        <span>Hull lost <b class="${hullLost ? 'down' : ''}">${hullLost ? '−' + hullLost : 'none'}</b></span>
        <span>Cannons knocked out <b class="${newlyBroken ? 'down' : ''}">${newlyBroken}</b></span>
        <span>Special shot fired <b>${before.shotUsed}</b></span>
        <span>Net worth <b>${fmt(before.worth)}</b> → <b class="up">${fmt(worth())}</b></span>
      </div>`,
      [fleet.port ? ['⚓ Enter the harbor', () => { checkMilestones(); if (mapState) mapState.voyage = null; arrive(fleet.port); }, 'big']
        : ['⛵ Back to sea', () => { TW.music('sea'); checkMilestones(); resume(v); }, 'big']], 'wide plunder');
    $('#modal').querySelectorAll('canvas[data-kind]').forEach(c => {
      // A wrecked fort or battery, still smoking, on its patch of headland.
      const x = c.getContext('2d'), ground = c.height * 0.84;
      x.fillStyle = '#5f7a3c'; x.fillRect(0, ground, c.width, c.height - ground);
      x.fillStyle = '#c9a66b'; x.fillRect(0, ground + 6, c.width, c.height - ground - 6);
      TW.drawDefenseFit(x, c.dataset.kind, c.width, c.height, { water: ground + 2, ruin: 0.8 });
      x.fillStyle = 'rgba(220,220,215,0.45)';
      for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(c.width * (0.35 + i * 0.1), c.height * (0.28 - i * 0.04), 16 + i * 6, 0, Math.PI * 2); x.fill(); }
    });
    $('#modal').querySelectorAll('canvas[data-look]').forEach(c => {
      // Listing and going down by the bow, half under the waves.
      const x = c.getContext('2d'), sea = c.height * 0.55;
      x.translate(c.width * 0.04, 0);
      TW.drawShipFit(x, c.dataset.look, c.width, c.height, { water: c.height * 0.6, dir: -1, tilt: 0.25, pirate: true, sail: '#cfc6b0', hullColor: '#3d2a1d' });
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = 'rgba(42,88,115,0.88)'; x.fillRect(0, sea, c.width, c.height - sea);
      x.strokeStyle = 'rgba(235,245,250,0.5)'; x.lineWidth = 2;
      x.beginPath(); for (let wx = 0; wx <= c.width; wx += 8) x.lineTo(wx, sea + Math.sin(wx / 14) * 2); x.stroke();
    });
    // Count the gold up, with a few coin clinks along the way.
    const el = $('#booty-count'), start = performance.now(), dur = 1600;
    let clinks = 0;
    const tick = () => {
      if (!el.isConnected) return;
      const k = Math.min(1, (performance.now() - start) / dur), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(booty * eased);
      if (k * 4 > clinks) { clinks++; TW.sfx('coins'); }
      if (k < 1) setTimeout(tick, 30);
    };
    setTimeout(tick, 350);
  }


  function arrive(dest, towed) {
    S.port = dest;
    if (!towed) log(`Dropped anchor in ${TW.PORT[dest].name}.`);
    remember(); checkMilestones(); save();
    if (S.mode === 'career' && S.day >= CAREER_DAYS) return go('end');
    view.place = 'city'; view.speech = null;
    TW.sfx('anchor');
    const delivered = deliverContracts();
    const collected = collectDebt();
    go('port', {}, portOrigin(dest));
    const showDebt = () => collected && modal(`<h2>Debt collectors!</h2>
      <p>Hard-faced men are waiting on the wharf with your overdue note. They take <b>${gold(collected.take)}</b>, including a ${fmt(collected.fee)} gold collection fee.</p>
      ${collected.left ? `<p class="bad">You still owe ${gold(collected.left)}, and it keeps growing at ${overduePct()}% a month.</p>` : '<p>Your debt is settled.</p>'}`, [['Grumble and pay', null, 'big']]);
    if (delivered.length) modal(`<h2>Contracts in ${port().name}</h2><ul class="checks">${delivered.join('')}</ul>`, [['Excellent', showDebt, 'big']]);
    else showDebt();
  }

  // ----- End -----
  function renderEnd(el) {
    const w = worth();
    // Best scores are kept per difficulty (Easy keeps the original key).
    const bestKey = 'tradewaters-best' + (S.difficulty && S.difficulty !== 'easy' ? '-' + S.difficulty : '');
    let best = 0; try { best = +localStorage.getItem(bestKey) || 0; } catch (e) {}
    const isBest = w > best;
    if (isBest) try { localStorage.setItem(bestKey, String(w)); } catch (e) {}
    el.innerHTML = `${titleArt(true)}
      <div class="panel newgame end">
        <h2>${S.ended === 'bankrupt' ? 'Bankrupt' : S.mode === 'career' ? 'Ten Years at Sea' : 'Retirement'}</h2>
        <p>${S.ended === 'bankrupt' ? `Shipwrecked and penniless, ${esc(S.name)} is stranded in ${port().name}, a ruined <b>${rankOf(w)}</b>, on ${diffName()}.`
          : `${esc(S.name)} retires as a <b>${rankOf(w)}</b>, on ${diffName()}.`}</p>
        <p class="score">Net worth ${gold(w)}${isBest ? ` <span class="up">New best on ${diffName()}!</span>` : ` <small>(best on ${diffName()}: ${fmt(best)})</small>`}</p>
        <div class="kv"><span>Voyages</span><b>${S.stats.voyages}</b></div>
        <div class="kv"><span>Trading profit</span><b>${fmt(S.stats.profit)}</b></div>
        <div class="kv"><span>Pirate fleets sunk / escaped / lost to</span><b>${S.stats.won} / ${S.stats.fled} / ${S.stats.lost}</b></div>
        <div class="kv"><span>Booty taken</span><b>${fmt(S.stats.booty)}</b></div>
        <div class="kv"><span>Storms weathered</span><b>${S.stats.storms}</b></div>
        <div class="row"><button class="big" data-act="new">New Voyage</button><button class="ghost" data-act="title">Title</button></div>
      </div>`;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  // ---------- modal ----------
  function modal(html, buttons, cls = '') {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-box panel ${cls}">${html}<div class="row">${buttons.map((b, i) => `<button class="${b[2] || ''}" data-i="${i}">${b[0]}</button>`).join('')}</div></div>`;
    m.hidden = false;
    m.onclick = ev => {
      const i = ev.target.closest('button')?.dataset.i;
      if (i === undefined) return;
      m.hidden = true; m.innerHTML = '';
      TW.sfx('click');
      buttons[+i][1] && buttons[+i][1]();
    };
  }

  // Pick a new difficulty mid-voyage; it takes effect straight away.
  function chooseDifficulty() {
    modal(`<h2>Difficulty</h2><p class="hint">Takes effect at once. Your score is kept separately for each difficulty.</p>
      ${TW.DIFFICULTIES.map(d => `<div class="kv diff-row"><span><b>${d.name}</b>${d.id === S.difficulty ? ' <small class="up">current</small>' : ''}<br><small>${d.desc}</small></span></div>`).join('')}`,
      [...TW.DIFFICULTIES.filter(d => d.id !== S.difficulty).map(d => [d.name, () => {
        S.difficulty = d.id; applyDifficulty();
        log(`Difficulty set to ${d.name}.`); toast(`Difficulty: <b>${d.name}</b>`); save(); render();
      }, 'ghost']), ['Cancel', null, 'big']]);
  }

  function amount() { return Math.max(0, Math.floor(+($('#amt')?.value) || 0)); }

  // ---------- actions ----------
  // ---------- tooltips ----------
  // Elements with data-tip explain themselves in a small floating card: on hover, on
  // keyboard focus, or on a tap for touch screens. The card lives on <body> so scrolling
  // panels can't clip it.
  const hintEl = document.createElement('div');
  hintEl.className = 'hint-tip'; hintEl.hidden = true; hintEl.setAttribute('role', 'tooltip');
  document.body.appendChild(hintEl);
  let hintFor = null;
  function showHint(t) {
    hintFor = t;
    hintEl.innerHTML = t.dataset.tip;
    hintEl.hidden = false;
    const r = t.getBoundingClientRect(), w = hintEl.offsetWidth, h = hintEl.offsetHeight;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const above = r.top - h - 10 > 8;
    hintEl.style.left = x + 'px';
    hintEl.style.top = (above ? r.top - h - 10 : r.bottom + 10) + 'px';
    hintEl.classList.toggle('below', !above);
  }
  function hideHint() { hintFor = null; hintEl.hidden = true; }
  document.addEventListener('mouseover', ev => { const t = ev.target.closest('[data-tip]'); if (t && t !== hintFor) showHint(t); });
  document.addEventListener('mouseout', ev => {
    const t = ev.target.closest('[data-tip]');
    if (t && !(ev.relatedTarget && t.contains(ev.relatedTarget))) hideHint();
  });
  document.addEventListener('focusin', ev => { const t = ev.target.closest('[data-tip]'); if (t) showHint(t); });
  document.addEventListener('focusout', ev => { if (ev.target.closest('[data-tip]')) hideHint(); });
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-tip]');
    if (t) { if (hintFor === t && !hintEl.hidden) hideHint(); else showHint(t); }
    else if (hintFor) hideHint();
  }, true);
  document.addEventListener('scroll', () => hintFor && hideHint(), true);

  const actions = {
    'begin': () => openGate(),
    'new': () => go('newgame'),
    'title': () => go('title'),
    'continue': () => {
      S = loadSave(); if (!S) return go('title');
      if (S.debt > 0 && !S.loanDue) S.loanDue = S.day + LOAN_TERM;   // saves from before loans had due dates
      if (!S.difficulty) S.difficulty = 'easy';   // saves from before difficulty played as Easy
      applyDifficulty();
      view.place = 'city'; view.speech = null; go('port');
    },
    'start': () => {
      const diff = (document.querySelector('input[name="ng-diff"]:checked') || {}).value || 'medium';
      newGame($('#ng-name').value.trim(), $('#ng-mode').value, $('#ng-home').value, diff);
      view.place = 'city'; view.speech = null; go('port');
    },
    'help': () => {
      // Each section pairs a gameplay screenshot with a short tip; click a picture to enlarge it.
      const rows = [
        ['city', 'Explore the port', 'Every port has its own harbor. Click a building on the wharf to step inside and meet its keeper. They have opinions about your ship, your debts and your cargo.'],
        ['market', 'Trade', 'Each port makes some goods cheaply and pays dearly for others. Buy where prices are <span class="cheap">green</span> and sell where they are <span class="dear">red</span>. Big trades move the price, and ports remember: run the same route again and again and its margin shrinks for weeks, so rotate your routes. Tags beside a good (shortage, glut, contraband) explain themselves: hover or tap them.'],
        ['map', 'Sail', 'Visit the Harbor Office or press Set Sail, then pick a port on the chart. Hover a port to see the prices you saw there last. Harbor Offices post freight contracts that beat market prices if you make the deadline, and taverns whisper of smuggling jobs. Each nation bans some goods, and its navy patrols the approaches.'],
        ['combat', 'Survive', 'Pirates and storms prowl the sea lanes. In battle, click an enemy to target it. Your cannons fire on their own. Click a special shot to load it into the next cannon to fire: chain shot, fire pots and powder kegs can turn the tide. Outgunned? Flee. If your ship sinks you are carried to the nearest home port with a shipyard and must buy another from your purse and bank; if you can\u2019t, you are bankrupt and the game is over. Now and then pirates seize a port and close its harbor: storm its fort and batteries to free it, for gold and gems.'],
        ['ship', 'Grow', 'Rising net worth (cash + bank + cargo \u2212 debt) unlocks richer goods, new charts and bigger ships. Cannons cost hold space, so balance firepower against cargo. Every day at sea costs wages and provisions, and the moneylender charges 10% a month with loans due in 90 days. Shipyards sell fittings such as faster-firing cannons and bigger holds, and tavern traders sell curiosities, if you trust them.'],
      ];
      modal(`<h2>How to Play</h2>${rows.map(([img, title, text]) => `
        <div class="help-row">
          <button class="help-shot" title="Click to enlarge"><img src="assets/img/help/${img}.jpg?r=3" alt="${title}" loading="lazy"></button>
          <div><h3>${title}</h3><p>${text}</p></div>
        </div>`).join('')}`, [['Got it', null, 'big']], 'wide');
      $('#modal').querySelectorAll('.help-shot').forEach(b => {
        b.onclick = () => b.closest('.help-row').classList.toggle('zoomed');
      });
    },
    'menu': () => modal(`<h2>Menu</h2><p>Your game saves automatically each time you reach port.</p>
      <p>Difficulty: <b>${diffName()}</b></p>`,
      [['Resume', null, 'big'], ['Change difficulty', () => chooseDifficulty(), 'ghost'], ['Retire and see your score', () => go('end'), 'ghost'], ['Quit to title', () => { save(); go('title'); }, 'ghost']]),
    'toggle-sfx': () => { TW.toggleAudio('sfx'); hud(); },
    'toggle-music': () => { TW.toggleAudio('music'); hud(); },
    'enter': (b) => {
      view.place = b.dataset.place; view.speech = null;
      view.doorway = originOf(($(`.bld[data-place="${b.dataset.place}"]`) || b).getBoundingClientRect());
      TW.music(view.place === 'tavern' ? 'tavern' : 'port');
      TW.sfx('door');
      transition('enter', render, view.doorway);
      // First visit to each port is remembered so keepers can remark on it.
      (S.visited || (S.visited = {}))[S.port] = true;
    },
    'to-city': () => { view.place = 'city'; view.speech = null; TW.music('port'); transition('leave', render, view.doorway); },
    'talk': () => { speak('idle'); typeSpeech(); },
    'take-contract': (b) => {
      if (contracts().length >= TW.MAX_CONTRACTS) return toast('You can hold three contracts at most.', 'bad');
      const c = TW.takeOffer(S, S.port, b.dataset.where, b.dataset.id);
      if (!c) return;
      log(`Accepted a contract: ${TW.describeContract(c).toLowerCase()} by ${dateStr(c.due)} for ${fmt(c.reward)} gold.`);
      speak(TW.contractWhere(c) === 'tavern' ? 'smuggle' : 'contract'); TW.sfx('quill'); save(); render();
    },
    'abandon-contract': (b) => {
      const c = contracts().find(x => x.id === b.dataset.id); if (!c) return;
      modal(`<h2>Abandon this contract?</h2><p>${TW.describeContract(c)}.</p>${c.bond ? `<p class="bad">You forfeit the ${gold(c.bond)} bond.</p>` : ''}`,
        [['Abandon it', () => { S.contracts = contracts().filter(x => x !== c); const paid = c.bond ? takeFrom(c.bond) : 0;
          log(`Abandoned a contract: ${TW.describeContract(c).toLowerCase()}${paid ? `, forfeiting ${fmt(paid)} gold` : ''}.`); save(); render(); }, 'big'], ['Keep it', null, 'ghost']]);
    },
    'show-contracts': () => modal(`<h2>Your contracts</h2>${contractList('none')}`, [['Close', null, 'big']], 'wide'),
    'show-ship': () => showShip(),
    'buy-curio': (b) => {
      const offers = curiosAt(S.port), o = offers.find(x => x.id === b.dataset.id), c = o && TW.CURIO[o.id];
      if (!c) return;
      if (S.cash < o.price) { speak('broke'); return render(); }
      S.cash -= o.price;
      const variant = c.fake ? 'fake' : c.cursed && Math.random() < c.cursed.chance ? 'cursed' : 'true';
      const it = { id: c.id, variant, paid: o.price };
      (S.items || (S.items = [])).push(it);
      offers.splice(offers.indexOf(o), 1);
      log(`Bought a ${c.name} from a tavern trader in ${port().name} for ${fmt(o.price)} gold${variant === 'fake' ? '. It was a fake' : variant === 'cursed' ? '. It came with a catch' : ''}.`);
      TW.sfx(variant === 'true' ? 'coins' : 'bad');
      S.peakWorth = Math.max(S.peakWorth, worth()); save(); render();
      modal(`<h2>${c.icon} ${c.name}</h2>
        <p>${variant === 'fake' ? c.reveal : variant === 'cursed' ? 'It works, after a fashion. There is a catch.' : 'It works exactly as promised.'}</p>
        <p><b>${curioDesc(it)}</b></p><p class="hint">Any curiosity trader will buy it back for half what you paid. See it in the Ship &amp; Captain sheet.</p>`,
        [['Stow it aboard', null, 'big']]);
    },
    'buy-fitting': (b) => {
      const f = TW.FITTING[b.dataset.id]; if (!f) return;
      const price = TW.fittingPrice(f, TW.SHIP[S.ship.type]);
      if (S.cash < price) { speak('cantAfford'); return render(); }
      S.cash -= price;
      S.ship.fittings = (S.ship.fittings || []).filter(id => id !== f.replaces).concat(f.id);
      log(`Fitted ${f.name} to the ${shipName()} for ${fmt(price)} gold.`);
      TW.sfx('hammer'); speak('repair'); toast(`${f.icon} <b>${f.name}</b> fitted.`, 'good'); save(); render();
    },
    'sell-curio': (b) => {
      const i = +b.dataset.i, it = (S.items || [])[i]; if (!it) return;
      const c = TW.CURIO[it.id], back = Math.round(it.paid / 2);
      const without = S.items.filter((_, k) => k !== i), cargoAfter = Math.round(TW.SHIP[S.ship.type].cargo * mods(S.ship.fittings, without).cargo);
      if (cargoAfter < usedSpace()) return toast(`Your hold is too full to give up the ${c.name}. Sell some cargo first.`, 'bad');
      S.items = without; S.cash += back;
      S.ship.hull = Math.min(S.ship.hull, shipDef().hull);
      log(`Sold a ${c.name} back to a trader for ${fmt(back)} gold.`);
      TW.sfx('coins'); save(); showShip();
    },
    'show-log': () => modal(`<h2>Captain's Log</h2><div class="log modal-log">${S.log.slice(0, 20).map(l => `<p><small>${dateStr(l.day)}</small>${l.text}</p>`).join('')}</div>`, [['Close', null, 'big']]),
    'open-map': () => go('map'),
    'back-port': () => go('port'),
    'max-buy': (b) => {
      const id = b.dataset.good, n = TW.maxBuy(S, S.port, id, S.cash, freeSpace());
      const input = document.querySelector(`[data-qty="${id}"]`); input.value = n; input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    'all-sell': (b) => {
      const id = b.dataset.good, input = document.querySelector(`[data-qty="${id}"]`);
      input.value = S.ship.cargo[id]?.qty || 0; input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    'buy': (b) => trade('buy', b.dataset.good),
    'sell': (b) => trade('sell', b.dataset.good),
    'rumor': () => {
      const cost = roundCost();
      if (S.cash < cost) { speak('broke'); return render(); }
      S.cash -= cost; TW.sfx('mug');
      view.speech = { who: 'tavern', text: TW.line('tavern', 'rumor', talkContext()) + ' ' + TW.rumor(S, mods().rumorTrue).replace(/<[^>]+>/g, ''), id: Math.random() };
      render();
    },
    'chart': () => {
      const cost = 2500 + 2000 * Math.max(0, S.known.length - 9);
      if (S.cash < cost) { speak('broke'); return render(); }
      S.cash -= cost; const p = revealPort(); TW.sfx('map');
      speak('chart', `Here's a chart to ${p.name}.`);
      toast(`New port charted: <b>${p.name}</b>`, 'good');
      log(`Bought a sea chart to ${p.name}.`); save(); render();
    },
    'wait': () => { TW.sfx('mug'); for (let i = 0; i < 3; i++) passDay(); remember(); save();
      speak('wait');
      if (S.mode === 'career' && S.day >= CAREER_DAYS) return go('end'); render(); },
    'repair': () => {
      const d = shipDef(), rate = 40 + 15 * TW.SHIPS.findIndex(x => x.id === d.id);
      const n = Math.min(d.hull - S.ship.hull, Math.floor(S.cash / rate));
      if (n <= 0) { speak('cantAfford'); return render(); }
      S.cash -= n * rate; S.ship.hull += n; toast(`Repaired ${n} hull for ${fmt(n * rate)} gold`); log(`Repaired the hull in ${port().name} for ${fmt(n * rate)} gold.`); TW.sfx('hammer'); speak('repair'); save(); render();
    },
    'fixguns': () => {
      const n = Math.min(S.ship.broken, Math.floor(S.cash / 400));
      if (n <= 0) { speak('cantAfford'); return render(); }
      S.cash -= n * 400; S.ship.broken -= n; TW.sfx('hammer'); speak('repair'); save(); render();
    },
    'gun-buy': () => {
      if (S.cash < TW.CANNON_PRICE) { speak('cantAfford'); return render(); }
      if (freeSpace() < TW.GUN_SPACE) return toast('No room in the hold for another cannon.', 'bad');
      if (S.ship.guns >= shipDef().guns) return;
      S.cash -= TW.CANNON_PRICE; S.ship.guns++; log(`Mounted a new cannon (${S.ship.guns} aboard).`); TW.sfx('hammer'); speak('buyGun'); save(); render();
    },
    'gun-sell': () => {
      if (!S.ship.guns) return;
      S.ship.guns--; if (S.ship.broken > S.ship.guns) S.ship.broken = S.ship.guns;
      S.cash += TW.CANNON_PRICE / 2; log(`Sold a cannon (${S.ship.guns} left).`); TW.sfx('crate'); speak('sellGun'); save(); render();
    },
    'ammo': (b) => {
      const a = TW.AMMO_BY[b.dataset.ammo];
      if (S.cash < a.price) { speak('cantAfford'); return render(); }
      S.cash -= a.price; S.ammo[a.id]++; log(`Bought a ${a.name.toLowerCase()} for ${fmt(a.price)} gold.`); TW.sfx('crate'); speak('ammo'); save(); render();
    },
    'buyship': (b) => {
      const id = b.dataset.ship, price = +b.dataset.price, d = shipDef(), nd = TW.SHIP[id];
      const tradeIn = Math.round(d.price * 0.6 * (0.5 + 0.5 * S.ship.hull / d.hull) / 100) * 100;
      const cost = Math.max(0, price - tradeIn);
      if (S.cash < cost) { speak('cantAfford'); return render(); }
      const guns = Math.min(S.ship.guns, nd.guns);
      if (cargoQty() + guns * TW.GUN_SPACE > nd.cargo) return toast(`Your cargo won't fit in the ${nd.name}. Sell some first.`, 'bad');
      modal(`<h2>Buy the ${nd.name}?</h2><p>Price ${gold(price)}, less ${gold(tradeIn)} for your ${d.name}. You pay ${gold(cost)}.</p>
        ${S.ship.guns > guns ? `<p>${S.ship.guns - guns} cannons won't fit and will be sold.</p>` : ''}
        ${(S.ship.fittings || []).length ? `<p class="bad">Your fittings (${S.ship.fittings.map(id => TW.FITTING[id].name).join(', ')}) stay with the ${d.name}.</p>` : ''}`,
        [['Shake hands', () => {
          S.cash -= cost; S.cash += (S.ship.guns - guns) * TW.CANNON_PRICE / 2;
          S.ship = { type: id, hull: nd.hull, guns, broken: Math.min(S.ship.broken, guns), cargo: S.ship.cargo, fittings: [] };
          S.ship.hull = shipDef().hull;   // curiosities like the Shield Doll still count
          S.offers[S.port] = S.offers[S.port].filter(o => o.id !== id);
          log(`Bought a ${nd.name}. A fine vessel!`); TW.sfx('bell'); speak('buyShip'); save(); render();
        }, 'big'], ['Cancel', null, 'ghost']]);
    },
    // Prefill the amount with a share of the purse or the balance; nothing moves until Deposit/Withdraw.
    'bank-fill': (b) => {
      const total = b.dataset.of === 'bank' ? S.bank : S.cash, input = $('#amt');
      input.value = Math.floor(total * +b.dataset.pct / 100);
      input.focus();
    },
    'deposit': () => { const a = Math.min(amount(), S.cash); S.cash -= a; S.bank += a; if (a) log(`Deposited ${fmt(a)} gold in the bank.`); if (a) TW.sfx('coins'); speak(a ? 'deposit' : 'nothing'); save(); render(); },
    'withdraw': () => { const a = Math.min(amount(), S.bank); S.bank -= a; S.cash += a; if (a) log(`Withdrew ${fmt(a)} gold from the bank.`); if (a) TW.sfx('coins'); speak(a ? 'withdraw' : 'nothing'); save(); render(); },
    'deposit-all': () => { const a = S.cash; S.bank += S.cash; S.cash = 0; if (a) log(`Deposited ${fmt(a)} gold in the bank.`); if (a) TW.sfx('coins'); speak(a ? 'deposit' : 'nothing'); save(); render(); },
    'withdraw-all': () => { const a = S.bank; S.cash += S.bank; S.bank = 0; if (a) log(`Withdrew ${fmt(a)} gold from the bank.`); if (a) TW.sfx('coins'); speak(a ? 'withdraw' : 'nothing'); save(); render(); },
    'borrow': () => {
      const max = loanLimit();
      const a = Math.min(amount(), max);
      if (!a) { if (max) return toast('Enter an amount.', 'bad'); speak('refused'); return render(); }
      if (!S.debt) S.loanDue = S.day + LOAN_TERM;
      S.cash += a; S.debt += a; log(`Borrowed ${fmt(a)} gold from the moneylender, due ${dateStr(S.loanDue)}.`); TW.sfx('quill'); speak('borrow'); save(); render();
    },
    'repay': () => { const a = Math.min(amount(), S.cash, S.debt); S.cash -= a; S.debt -= a; if (!S.debt) S.loanDue = 0; if (a) { TW.sfx('quill'); log(`Repaid ${fmt(a)} gold to the moneylender.`); speak(S.debt ? 'repay' : 'repayAll'); } save(); render(); },
    'repay-all': () => { const a = Math.min(S.cash, S.debt); S.cash -= a; S.debt -= a; if (!S.debt) { S.loanDue = 0; log('Paid off the moneylender in full.'); TW.sfx('quill'); speak('repayAll'); } save(); render(); },
    'special': (b) => TW.Combat.special(b.dataset.ammo),
    'flee': () => TW.Combat.flee(),
  };

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.closest('#modal')) return;
    const fn = actions[b.dataset.act];
    if (fn) { if (!['special', 'flee'].includes(b.dataset.act)) TW.sfx('click'); fn(b); }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.qty) trade('buy', ev.target.dataset.qty);
    if (view.screen === 'combat') {
      if (ev.key === '1') TW.Combat.special('chain');
      if (ev.key === '2') TW.Combat.special('fire');
      if (ev.key === '3') TW.Combat.special('keg');
      if (ev.key === 'f' || ev.key === 'F') TW.Combat.flee();
    }
  });

  // ---------- boot ----------
  function loadImages() {
    const names = ['title', 'harbor', 'market', 'shipyard', 'tavern', 'combat', 'siege', 'int-bank', 'int-lender', 'int-harbor', 'plunder'];
    return Promise.all(names.map(n => new Promise(res => {
      const img = new Image();
      img.onload = () => { TW.images[n] = img; res(); };
      img.onerror = () => res();
      img.src = `assets/img/${n}.jpg`;
    })));
  }
  // Decode the building cut-outs up front so the city view's first hovers don't stall.
  function predecodeBuildings() {
    for (const style of ['spanish', 'english']) for (const b of ['market', 'tavern', 'shipyard', 'bank', 'lender', 'harbor']) {
      const img = new Image(); img.src = `assets/img/buildings/${style}-${b}.png`;
      if (img.decode) img.decode().catch(() => {});
    }
  }

  TW.boot = async function () {
    // Canvas text (map labels, combat) only uses web fonts that have already loaded.
    if (document.fonts) await Promise.race([
      Promise.all(['16px "Pirata One"', '16px "IM Fell English SC"', '16px Alegreya', 'bold 16px Alegreya']
        .map(f => document.fonts.load(f).catch(() => {}))),
      new Promise(r => setTimeout(r, 2500)),
    ]);
    TW.initMap();
    TW.loadSfx();   // not awaited: until a sample decodes, its synthesized stand-in plays
    TW.loadFolk();  // not awaited either: townsfolk appear once their sprites are in
    await Promise.all([loadImages(), TW.loadShipArt(), TW.loadMapArt()]);
    predecodeBuildings();
    go('title');
  };
  // Exposed for debugging and automated checks.
  // Set TW._debug.nextEvents = ['pirates', 'storm'] to force events on the next voyage.
  TW._debug = { get state() { return S; }, set state(v) { S = v; }, go, passDay, makeFleet, worth, arrive, nextEvents: null,
    // This week's pirate activity and weather at a port: { act 0-3, pirates odds, wx 0-3 }.
    sea: seaAt, stormOdds,
    // Fire a sea event ('storm', 'pirates', 'flotsam', 'patrol') as if sailing toward `dest`.
    event(kind, dest = S.port) { runEvent({ dest, paused: true }, { kind }); },
    // Hand a charted port to pirates now (defaults to the first other charted port).
    hostile(id = S.known.find(k => k !== S.port)) { S.hostile = S.hostile || {}; S.hostile[id] = { since: S.day, until: S.day + 120, captain: 'Black Barnaby' }; return id; },
    // Attack a hostile port as if just arrived there (from the map screen).
    siege(id) { go('map'); const v = { dest: id, route: TW.route(S.port, id), days: 1, events: [], paused: true, pos: TW.PORT[id] }; mapState.voyage = v; fight(v, makeDefenses(id)); },
    // Sail to `id` and arrive at once (fires the hostile-port prompt if pirates hold it).
    reach(id) { go('map'); const v = { dest: id, route: TW.route(S.port, id), days: 1, events: [], paused: true, pos: TW.PORT[id] }; mapState.voyage = v; isHostile(id) ? hostileArrival(v) : arrive(id); },
    // Skip straight to the post-battle plunder screen against a freshly rolled pirate fleet.
    winBattle() {
      const fleet = makeFleet(), before = { hull: S.ship.hull, broken: S.ship.broken, ammo: { ...S.ammo }, worth: worth(), shotUsed: 0 };
      S.stats.won++;
      const { spoils, booty, loot } = plunder(fleet);
      TW.music('victory');
      showPlunder({ paused: true }, fleet, spoils, booty, loot, before);
    },
  };
})();

// Tradewaters: game state, screens, and the voyage loop.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const gold = n => `<span class="gold">${fmt(n)}</span>`;
  const SAVE_KEY = 'tradewaters-save-v1';
  const CAREER_DAYS = 3650;
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
  const shipDef = () => TW.SHIP[S.ship.type];
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

  function log(text) { S.log.unshift({ day: S.day, text }); S.log.length = Math.min(S.log.length, 60); }
  function toast(html, kind = '') {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = html;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3200);
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }

  // ---------- new game ----------
  function newGame(name, mode, home) {
    S = {
      v: 1, name: name || 'Captain', mode, day: 0, cash: 6000, bank: 0, debt: 0, peakWorth: 6000,
      port: home, home, ship: { type: 'sloop', hull: TW.SHIP.sloop.hull, guns: 2, broken: 0, cargo: {} },
      ammo: { chain: 0, fire: 0, keg: 0 }, known: [], seen: {}, log: [], offers: {}, offerMonth: -1,
      milestone: 0, stats: { voyages: 0, won: 0, fled: 0, lost: 0, storms: 0, profit: 0, booty: 0 },
      visited: { [home]: true },
    };
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

  function remember() {
    const m = S.market[S.port];
    S.seen[S.port] = { day: S.day, p: Object.fromEntries(TW.GOODS.map(g => [g.id, Math.round(m[g.id].price)])) };
  }

  // Advance one day of world time.
  function passDay() {
    const before = monthIndex(S.day);
    S.day++;
    TW.tickMarket(S);
    if (monthIndex(S.day) !== before) {
      if (S.bank > 0) { const i = Math.round(S.bank * 0.008); S.bank += i; }
      if (S.debt > 0) { const i = Math.round(S.debt * 0.1); S.debt += i; log(`The moneylender adds ${fmt(i)} gold of interest to your debt.`); }
      refreshOffers();
    }
    S.peakWorth = Math.max(S.peakWorth, worth());
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
      <div class="stat ${S.debt ? 'bad' : ''}"><label>Debt</label>${gold(S.debt)}</div>
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
  function go(screen, opts = {}) {
    if (view.screen === 'map' && screen !== 'map') stopMapLoop();
    Object.assign(view, { screen }, opts);
    TW.music({ title: 'title', newgame: 'title', port: view.place === 'tavern' ? 'tavern' : 'port', map: 'sea', combat: 'combat', end: 'victory' }[screen]);
    render();
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
    const d = shipDef();
    el.innerHTML = `
      <div class="city">
        <div class="city-scene" style="background-image:url(assets/img/ports/${p.id}.jpg)">
          <div class="city-sign"><span>${p.name}</span><small>${city.blurb || ''}</small></div>
          ${cityLayout(p).map(b => `
            <button class="bld bld-${b.id}" data-act="enter" data-place="${b.id}" aria-label="${BUILDINGS[b.id].label}"
              style="left:${(b.x * 100).toFixed(2)}%; top:${((b.base - b.h) * 100).toFixed(2)}%; height:${(b.h * 100).toFixed(2)}%; z-index:${Math.round(b.base * 100)}">
              <img src="assets/img/buildings/${style}-${b.id}.png" alt="" draggable="false">
              <span class="bld-sign">${BUILDINGS[b.id].label}</span>
            </button>`).join('')}
        </div>
        <div class="city-bar">
          <div class="mini"><b>${d.name}</b>
            <span>Hull ${S.ship.hull}/${d.hull}</span><span>Hold ${usedSpace()}/${d.cargo}</span><span>Cannons ${S.ship.guns}</span></div>
          <button class="ghost" data-act="show-log">📜 Captain's Log</button>
          <button class="sail" data-act="open-map">⛵ Set Sail</button>
        </div>
      </div>`;
  }

  // Context the keepers' dialogue can react to.
  function talkContext() {
    const p = port(), d = shipDef();
    const list = ids => ids.map(id => TW.GOOD[id].name.toLowerCase()).join(' and ');
    const D = dangerLevel();
    return {
      name: S.name, port: p.name, home: TW.PORT[S.home].name, ship: d.name,
      cash: S.cash, bank: S.bank, debt: S.debt, worth: worth(), guns: S.ship.guns,
      cargo: cargoQty(), hullPct: S.ship.hull / d.hull, loadPct: usedSpace() / d.cargo,
      threat: D < 6 ? 0 : D < 14 ? 1 : D < 26 ? 2 : 3,
      uncharted: S.known.length < TW.PORTS.length, firstVisit: !(S.visited || {})[p.id],
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

  function renderBuilding(el, id) {
    const ch = TW.CHARACTERS[id];
    if (!view.speech || view.speech.who !== id) speak('greet');
    el.innerHTML = `
      <div class="bld-view">
        <aside class="keeper">
          <div class="keeper-art" style="${bgStyle(INTERIOR[id])}">
            <button class="portrait" data-act="talk" title="Talk to ${ch.name}">
              <img src="assets/img/chars/${id}.jpg" alt="${ch.name}"></button>
          </div>
          <div class="keeper-name">${ch.name}<small>${ch.title}</small></div>
          <div class="speech"><p class="speech-text"></p></div>
          <button class="ghost back" data-act="to-city">← Back to the quay</button>
        </aside>
        <section class="port-main panel" id="port-main"></section>
        <aside class="port-side">${shipCard()}${logCard()}</aside>
      </div>`;
    BUILDINGS[id].render($('#port-main'));
    typeSpeech();
  }

  function renderHarbor(el) {
    const d = shipDef(), c = talkContext();
    const threat = ['Quiet', 'Some sightings', 'Dangerous', 'Deadly'][c.threat];
    const checks = [
      [S.ship.hull >= d.hull * 0.7, `Hull ${S.ship.hull}/${d.hull}`],
      [S.ship.guns - S.ship.broken >= Math.min(d.guns, 2 + c.threat * 3), `${S.ship.guns - S.ship.broken} working cannons`],
      [c.loadPct < 0.85, `Hold ${usedSpace()}/${d.cargo}${c.loadPct >= 0.85 ? ' (heavy, slower)' : ''}`],
      [S.ammo.chain + S.ammo.fire + S.ammo.keg > 0, `${S.ammo.chain + S.ammo.fire + S.ammo.keg} special shot`],
    ];
    el.innerHTML = `<h2>Harbor Office</h2>
      <div class="threat t${c.threat}"><span>Pirate activity</span><b>${threat}</b></div>
      <h3>Readiness</h3>
      <ul class="checks">${checks.map(([ok, t]) => `<li class="${ok ? 'ok' : 'warn'}">${ok ? '✔' : '⚠'} ${t}</li>`).join('')}</ul>
      <p class="hint">${S.known.length} of ${TW.PORTS.length} ports charted.</p>
      <button class="sail" data-act="open-map">⛵ Chart a course</button>`;
  }

  function shipCard() {
    const d = shipDef(), used = usedSpace();
    const cargo = Object.entries(S.ship.cargo).filter(([, c]) => c.qty > 0);
    return `<div class="panel card">
      <h3>${d.name}</h3>
      <div class="bar"><span style="width:${100 * S.ship.hull / d.hull}%" class="${S.ship.hull / d.hull < 0.4 ? 'low' : ''}"></span><em>Hull ${S.ship.hull}/${d.hull}</em></div>
      <div class="bar cargo"><span style="width:${Math.min(100, 100 * used / d.cargo)}%"></span><em>Hold ${used}/${d.cargo}</em></div>
      <div class="kv"><span>Cannons</span><b>${S.ship.guns}/${d.guns}${S.ship.broken ? ` <i class="bad">(${S.ship.broken} broken)</i>` : ''}</b></div>
      <div class="kv"><span>Special ammo</span><b>⛓${S.ammo.chain} · 🔥${S.ammo.fire} · 💥${S.ammo.keg}</b></div>
      <div class="cargo-list">${cargo.length ? cargo.map(([id, c]) => `<div>${TW.GOOD[id].icon} ${TW.GOOD[id].name} <b>${c.qty}</b> <small>@${fmt(c.cost)}</small></div>`).join('') : '<small>The hold is empty.</small>'}</div>
    </div>`;
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
      if (!TW.goodUnlocked(S, g)) return `<tr class="locked"><td>${g.icon} ${g.name}</td><td colspan="5">Unlocks at ${gold(g.unlock)} net worth</td></tr>`;
      const buy = TW.unitBuy(e), sell = TW.unitSell(e), stock = Math.floor(e.stock);
      const avg = S.ship.cargo[g.id]?.cost;
      const pl = held && avg ? Math.round((sell - avg) / avg * 100) : null;
      return `<tr data-good="${g.id}">
        <td>${g.icon} <b>${g.name}</b>${e.kind ? `<span class="tagx ${e.kind}">${e.kind}</span>` : ''}</td>
        <td class="${priceClass(g, buy)}">${fmt(buy)}</td>
        <td class="${priceClass(g, sell)}">${fmt(sell)}</td>
        <td>${stock || '<i class="muted">none</i>'}</td>
        <td>${!held ? '<span class="muted">-</span>' : pl === null ? `${held} <small class="up">free</small>` :
          `${held} <small class="${pl >= 0 ? 'up' : 'down'}">${pl >= 0 ? '+' : ''}${pl}%</small>`}</td>
        <td class="trade">
          <input type="number" min="0" value="" placeholder="qty" data-qty="${g.id}">
          <button data-act="max-buy" data-good="${g.id}" title="Fill with the most you can buy">Max</button>
          <button class="buy" data-act="buy" data-good="${g.id}" ${!stock ? 'disabled' : ''}>Buy</button>
          <button data-act="all-sell" data-good="${g.id}" ${!held ? 'disabled' : ''} title="Fill with all you hold">All</button>
          <button class="sell" data-act="sell" data-good="${g.id}" ${!held ? 'disabled' : ''}>Sell</button>
        </td></tr>`;
    }).join('');
    el.innerHTML = `<h2>Marketplace</h2>
      <p class="hint">Free hold space: <b>${freeSpace()}</b> · Prices move as you trade. <span class="cheap">Green</span> is cheap, <span class="dear">red</span> is dear.</p>
      <table class="market"><thead><tr><th>Good</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Held</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div id="quote" class="quote"></div>`;
    el.oninput = (ev) => {
      const id = ev.target.dataset.qty; if (!id) return;
      const q = Math.max(0, Math.floor(+ev.target.value || 0));
      if (!q) { $('#quote').textContent = ''; return; }
      const b = TW.quoteBuy(S, S.port, id, q).total, s = TW.quoteSell(S, S.port, id, Math.min(q, S.ship.cargo[id]?.qty || 0)).total;
      $('#quote').innerHTML = `${q} × ${TW.GOOD[id].name}: buy for ${gold(b)}${S.ship.cargo[id]?.qty ? ` · sell for ${gold(s)}` : ''}`;
    };
  }

  function trade(kind, id) {
    const input = document.querySelector(`[data-qty="${id}"]`);
    let q = Math.max(0, Math.floor(+input.value || 0));
    const g = TW.GOOD[id], e = S.market[S.port][id];
    if (kind === 'buy') {
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
      S.cash -= cost;
      const c = S.ship.cargo[id] || (S.ship.cargo[id] = { qty: 0, cost: 0 });
      c.cost = (c.cost * c.qty + cost) / (c.qty + q); c.qty += q;
      toast(`Bought ${q} ${g.name} for ${gold(cost)}`);
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
      if (profit > 0) TW.sfx('coins');
      speak(profit >= 0 ? 'sellProfit' : 'sellLoss');
    }
    S.peakWorth = Math.max(S.peakWorth, worth());
    checkMilestones(); remember(); save(); render();
  }

  function renderTavern(el) {
    const chartCost = 2500 + 2000 * Math.max(0, S.known.length - 9);
    const unknown = TW.PORTS.length - S.known.length;
    el.innerHTML = `<h2>The Salted Lantern</h2>
      <p class="hint">Sailors talk when the drinks are free. Buy a round and Bilge will share what he's heard.</p>
      <div class="row wrap">
        <button data-act="rumor">🍺 Buy a round (${fmt(50)} g)</button>
        <button data-act="chart" ${!unknown ? 'disabled' : ''}>🗺 Buy a sea chart (${fmt(chartCost)} g)</button>
        <button data-act="wait">🛏 Wait 3 days</button>
      </div>
      <p class="hint">${unknown ? `${unknown} ports are still uncharted. Grow your fortune or buy charts to find them.` : 'You have charted every port in the Caribbean.'}</p>`;
  }

  function renderShipyard(el) {
    const d = shipDef(), missing = d.hull - S.ship.hull, rate = 40 + 15 * TW.SHIPS.indexOf(d);
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
          ${TW.AMMO.map(a => `<div class="kv"><span><b>${a.name}</b> (${S.ammo[a.id]}): ${a.desc}</span><button data-act="ammo" data-ammo="${a.id}">Buy ${fmt(a.price)} g</button></div>`).join('')}
        </div>
        <div>
          <h3>Ships for sale</h3>
          <p class="hint">Trade-in value of your ${d.name}: ${gold(tradeIn)}</p>
          ${offers.length ? offers.map(o => {
            const s = TW.SHIP[o.id], locked = S.peakWorth < s.unlock;
            return `<div class="ship-offer ${locked ? 'locked' : ''}">
              <canvas width="160" height="90" data-ship="${o.id}"></canvas>
              <div><b>${s.name}</b> · ${gold(o.price)}<br><small>Hull ${s.hull} · Hold ${s.cargo} · Cannons ${s.guns} · Speed ${s.speed}</small><br>
              ${locked ? `<small class="bad">Shipwrights won't sell to you until ${fmt(s.unlock)} net worth.</small>` :
                `<button data-act="buyship" data-ship="${o.id}" data-price="${o.price}">Buy for ${fmt(Math.max(0, o.price - tradeIn))} g after trade-in</button>`}</div></div>`;
          }).join('') : '<p>No ships on the slipway this month.</p>'}
        </div>
      </div>`;
    el.querySelectorAll('canvas[data-ship]').forEach(c => {
      const x = c.getContext('2d'); x.scale(0.6, 0.6);
      TW.drawShipSide(x, c.dataset.ship, 133, 140, 1, { scale: 0.75, flag: '#1f6f8b' });
    });
  }

  function renderBank(el) {
    el.innerHTML = `<h2>Bank</h2>
      <p>Deposits are safe from pirates and earn about 10% a year. Your balance: ${gold(S.bank)}</p>
      <div class="row"><input type="number" id="amt" min="0" placeholder="amount">
      <button data-act="deposit">Deposit</button><button data-act="withdraw">Withdraw</button>
      <button class="ghost" data-act="deposit-all">Deposit all</button><button class="ghost" data-act="withdraw-all">Withdraw all</button></div>
      <p class="hint">You can only use banks in ports that have one.</p>`;
  }
  function renderLender(el) {
    const max = Math.max(0, Math.max(5000, 2 * worth()) - S.debt);
    el.innerHTML = `<h2>Moneylender</h2>
      <p>The rate is a ruinous <b>10% per month</b>.</p>
      <p>Current debt: ${gold(S.debt)} · You may borrow up to ${gold(max)}</p>
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
    }
    tip.innerHTML = html; tip.hidden = false;
    const wrap = tip.parentElement.getBoundingClientRect();
    let x = ev.clientX - wrap.left + 16, y = ev.clientY - wrap.top + 12;
    if (x + tip.offsetWidth > wrap.width) x -= tip.offsetWidth + 32;
    if (y + tip.offsetHeight > wrap.height) y = wrap.height - tip.offsetHeight - 6;
    tip.style.left = x + 'px'; tip.style.top = Math.max(4, y) + 'px';
  }

  function confirmSail(p) {
    const r = TW.route(S.port, p.id), days = travelDays(r);
    const d = shipDef();
    const warn = [];
    if (S.ship.hull < d.hull * 0.5) warn.push('Your hull is badly damaged.');
    if (!S.ship.guns) warn.push('You carry no cannons. Pirates will find you easy prey.');
    modal(`<h2>Sail to ${p.name}?</h2>
      <p>The voyage should take about <b>${days} days</b>.</p>
      ${warn.map(w => `<p class="bad">⚠ ${w}</p>`).join('')}`,
      [['Weigh anchor!', () => startVoyage(p.id, r, days), 'big'], ['Not yet', null, 'ghost']]);
  }

  function dangerLevel() {
    const w = Math.max(1, worth());
    return Math.max(0, Math.min(48, Math.round(4 * Math.log2(w / 4000)) + Math.floor(S.day / 365)));
  }

  function makeFleet() {
    const D = dangerLevel();
    const n = 1 + (Math.random() < D / 30) + (Math.random() < D / 50) + (Math.random() < D / 75);
    const pool = TW.ENEMIES.filter(e => e.tier <= D);
    const fleet = [];
    for (let i = 0; i < n; i++) {
      const weights = pool.map(e => 1 + 3 * e.tier / (D + 1));
      let k = Math.random() * weights.reduce((a, b) => a + b), j = 0;
      while ((k -= weights[j]) > 0) j++;
      fleet.push({ ...pool[Math.min(j, pool.length - 1)] });
    }
    return { captain: TW.PIRATE_NAMES[Math.floor(Math.random() * TW.PIRATE_NAMES.length)], ships: fleet };
  }

  function startVoyage(dest, route, days) {
    S.stats.voyages++;
    const scale = Math.max(0.5, Math.min(1.6, route.len / 350));
    const events = [];
    if (Math.random() < 0.12 * scale) events.push({ t: rand(0.2, 0.8), kind: 'storm' });
    const pirateChance = 0.33 * scale * (cargoQty() ? 1 : 0.6);
    if (Math.random() < pirateChance) events.push({ t: rand(0.25, 0.85), kind: 'pirates' });
    if (Math.random() < 0.05) events.push({ t: rand(0.2, 0.8), kind: 'flotsam' });
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
      const dt = now - last; last = now;
      if (!v.paused) {
        v.t = Math.min(1, v.t + dt / dur);
        v.pos = TW.pointAlong(route, v.t);
        while (v.dayDone < Math.floor(v.t * days)) { v.dayDone++; passDay(); hud(); }
        if (v.events.length && v.t >= v.events[0].t) { v.paused = true; runEvent(v, v.events.shift()); }
        else if (v.t >= 1) return arrive(dest);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function resume(v) { v.paused = false; v.storm = false; hud(); }

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
    const el = $('#screen'); el.className = 'screen-combat';
    el.innerHTML = `<div class="combat-wrap"><canvas id="combat" width="960" height="540"></canvas></div>
      <div class="combat-bar">
        <span class="hint">Click an enemy ship to target it. Cannons fire on their own.</span>
        ${TW.AMMO.map(a => `<button id="ammo-${a.id}" data-act="special" data-ammo="${a.id}" title="${a.desc}">${a.name} <span class="n">0</span></button>`).join('')}
        <button id="btn-flee" class="ghost" data-act="flee">Flee</button>
      </div>`;
    const c = $('#combat');
    const ctx = c.getContext('2d');
    TW.Combat.start(c, { ship: S.ship, enemies: fleet.ships, ammo: S.ammo }, res => {
      TW.Combat.stop();
      S.ship.hull = res.hull; S.ship.broken = res.broken; S.ammo = res.ammo;
      afterCombat(v, fleet, res);
    });
    void ctx;
  }
  // Leave the voyage object alive while combat runs; the map is rebuilt afterward.
  function stopMapLoopKeepVoyage() { cancelAnimationFrame(mapRaf); mapRaf = 0; }

  function afterCombat(v, fleet, res) {
    const backToMap = (then) => {
      view.screen = 'map'; TW.music('sea');
      const saved = mapState.voyage;
      render();
      mapState.voyage = saved;
      $('#btn-back').hidden = true;
      $('#map-status').innerHTML = `Sailing to <b>${TW.PORT[saved.dest].name}</b>…`;
      then && then();
    };
    if (res.outcome === 'win') {
      S.stats.won++;
      const booty = Math.round(res.booty * rand(0.8, 1.2));
      S.cash += booty; S.stats.booty += booty;
      const loot = [];
      for (let i = 0; i < res.sunk; i++) {
        if (Math.random() < 0.1 && freeSpace() > 0) addLoot('gems', irand(1, 4), loot);
        else if (Math.random() < 0.4) {
          const goods = TW.GOODS.filter(g => TW.goodUnlocked(S, g) && g.id !== 'gems');
          addLoot(goods[Math.floor(Math.random() * goods.length)].id, irand(5, 25), loot);
        }
      }
      S.peakWorth = Math.max(S.peakWorth, worth());
      log(`Defeated ${fleet.captain}'s pirates and took ${fmt(booty)} gold in booty.`);
      TW.sfx('coins');
      backToMap(() => modal(`<h2>Victory!</h2><p>${fleet.captain}'s fleet is sent to the bottom.</p>
        <p>Booty: ${gold(booty)}${loot.length ? `<br>Salvaged: ${loot.join(', ')}` : ''}</p>`, [['Splendid!', () => { checkMilestones(); resume(v); }]]));
    } else if (res.outcome === 'fled') {
      S.stats.fled++;
      log(`Escaped ${fleet.captain}'s pirates.`);
      backToMap(() => { toast('You escaped!', 'good'); resume(v); });
    } else {
      S.stats.lost++;
      const takeCash = Math.round(S.cash * 0.5);
      S.cash -= takeCash; S.ship.cargo = {}; S.ship.hull = 1;
      S.ship.broken = Math.min(S.ship.guns, S.ship.broken + Math.ceil(S.ship.guns / 2));
      const pos = v.pos;
      const near = S.known.map(id => TW.PORT[id]).sort((a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y))[0];
      log(`Crippled by ${fleet.captain}. Lost all cargo and ${fmt(takeCash)} gold. Towed into ${near.name}.`);
      TW.sfx('bad');
      backToMap(() => modal(`<h2>Defeat</h2><p>Your ship is a smoking wreck. The pirates strip her bare and leave you adrift.</p>
        <p class="bad">Lost all cargo and ${fmt(takeCash)} gold. Half your cannons are broken.</p>
        <p>A passing fisherman tows you into <b>${near.name}</b>.</p>`, [['Limp ashore', () => {
          for (let i = 0; i < 3; i++) passDay();
          mapState.voyage = null; arrive(near.id, true);
        }]]));
    }
  }
  function addLoot(id, q, list) {
    q = Math.min(q, freeSpace()); if (q <= 0) return;
    const c = S.ship.cargo[id] || (S.ship.cargo[id] = { qty: 0, cost: 0 });
    c.cost = c.cost * c.qty / (c.qty + q); c.qty += q;
    list.push(`${q} ${TW.GOOD[id].name}`);
  }

  function arrive(dest, towed) {
    S.port = dest;
    if (!towed) log(`Dropped anchor in ${TW.PORT[dest].name}.`);
    remember(); checkMilestones(); save();
    if (S.mode === 'career' && S.day >= CAREER_DAYS) return go('end');
    view.place = 'city'; view.speech = null;
    TW.sfx('bell');
    go('port');
  }

  // ----- End -----
  function renderEnd(el) {
    const w = worth();
    let best = 0; try { best = +localStorage.getItem('tradewaters-best') || 0; } catch (e) {}
    const isBest = w > best;
    if (isBest) try { localStorage.setItem('tradewaters-best', String(w)); } catch (e) {}
    el.innerHTML = `${titleArt(true)}
      <div class="panel newgame end">
        <h2>${S.mode === 'career' ? 'Ten Years at Sea' : 'Retirement'}</h2>
        <p>${esc(S.name)} retires as a <b>${rankOf(w)}</b>.</p>
        <p class="score">Net worth ${gold(w)}${isBest ? ' <span class="up">New best!</span>' : ` <small>(best ${fmt(best)})</small>`}</p>
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

  function amount() { return Math.max(0, Math.floor(+($('#amt')?.value) || 0)); }

  // ---------- actions ----------
  const actions = {
    'begin': () => openGate(),
    'new': () => go('newgame'),
    'title': () => go('title'),
    'continue': () => { S = loadSave(); if (!S) return go('title'); view.place = 'city'; view.speech = null; go('port'); },
    'start': () => {
      newGame($('#ng-name').value.trim(), $('#ng-mode').value, $('#ng-home').value);
      view.place = 'city'; view.speech = null; go('port');
    },
    'help': () => {
      // Each section pairs a gameplay screenshot with a short tip; click a picture to enlarge it.
      const rows = [
        ['city', 'Explore the port', 'Every port has its own harbor. Click a building on the quay to step inside and meet its keeper. They have opinions about your ship, your debts and your cargo.'],
        ['market', 'Trade', 'Each port makes some goods cheaply and pays dearly for others. Buy where prices are <span class="cheap">green</span> and sell where they are <span class="dear">red</span>. Big trades move the price, so spread them across ports.'],
        ['map', 'Sail', 'Visit the Harbor Office or press Set Sail, then pick a port on the chart. Hover a port to see the prices you saw there last.'],
        ['combat', 'Survive', 'Pirates and storms prowl the sea lanes. In battle, click an enemy to target it. Your cannons fire on their own, and special ammo can turn the tide. Outgunned? Flee.'],
        ['shipyard', 'Grow', 'Rising net worth (cash + bank + cargo \u2212 debt) unlocks richer goods, new charts and bigger ships. Cannons cost hold space, so balance firepower against cargo. The moneylender charges 10% a month!'],
      ];
      modal(`<h2>How to Play</h2>${rows.map(([img, title, text]) => `
        <div class="help-row">
          <button class="help-shot" title="Click to enlarge"><img src="assets/img/help/${img}.jpg" alt="${title}" loading="lazy"></button>
          <div><h3>${title}</h3><p>${text}</p></div>
        </div>`).join('')}`, [['Got it', null, 'big']], 'wide');
      $('#modal').querySelectorAll('.help-shot').forEach(b => {
        b.onclick = () => b.closest('.help-row').classList.toggle('zoomed');
      });
    },
    'menu': () => modal(`<h2>Menu</h2><p>Your game saves automatically each time you reach port.</p>`,
      [['Resume', null, 'big'], ['Retire and see your score', () => go('end'), 'ghost'], ['Quit to title', () => { save(); go('title'); }, 'ghost']]),
    'toggle-sfx': () => { TW.toggleAudio('sfx'); hud(); },
    'toggle-music': () => { TW.toggleAudio('music'); hud(); },
    'enter': (b) => {
      view.place = b.dataset.place; view.speech = null;
      TW.music(view.place === 'tavern' ? 'tavern' : 'port'); render();
      // First visit to each port is remembered so keepers can remark on it.
      (S.visited || (S.visited = {}))[S.port] = true;
    },
    'to-city': () => { view.place = 'city'; view.speech = null; TW.music('port'); render(); },
    'talk': () => { speak('idle'); typeSpeech(); },
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
      if (S.cash < 50) { speak('broke'); return render(); }
      S.cash -= 50;
      view.speech = { who: 'tavern', text: TW.line('tavern', 'rumor', talkContext()) + ' ' + TW.rumor(S).replace(/<[^>]+>/g, ''), id: Math.random() };
      render();
    },
    'chart': () => {
      const cost = 2500 + 2000 * Math.max(0, S.known.length - 9);
      if (S.cash < cost) { speak('broke'); return render(); }
      S.cash -= cost; const p = revealPort();
      speak('chart', `Here's a chart to ${p.name}.`);
      toast(`New port charted: <b>${p.name}</b>`, 'good');
      log(`Bought a sea chart to ${p.name}.`); save(); render();
    },
    'wait': () => { for (let i = 0; i < 3; i++) passDay(); remember(); save();
      speak('wait');
      if (S.mode === 'career' && S.day >= CAREER_DAYS) return go('end'); render(); },
    'repair': () => {
      const d = shipDef(), rate = 40 + 15 * TW.SHIPS.indexOf(d);
      const n = Math.min(d.hull - S.ship.hull, Math.floor(S.cash / rate));
      if (n <= 0) { speak('cantAfford'); return render(); }
      S.cash -= n * rate; S.ship.hull += n; toast(`Repaired ${n} hull for ${fmt(n * rate)} gold`); speak('repair'); save(); render();
    },
    'fixguns': () => {
      const n = Math.min(S.ship.broken, Math.floor(S.cash / 400));
      if (n <= 0) { speak('cantAfford'); return render(); }
      S.cash -= n * 400; S.ship.broken -= n; speak('repair'); save(); render();
    },
    'gun-buy': () => {
      if (S.cash < TW.CANNON_PRICE) { speak('cantAfford'); return render(); }
      if (freeSpace() < TW.GUN_SPACE) return toast('No room in the hold for another cannon.', 'bad');
      if (S.ship.guns >= shipDef().guns) return;
      S.cash -= TW.CANNON_PRICE; S.ship.guns++; speak('buyGun'); save(); render();
    },
    'gun-sell': () => {
      if (!S.ship.guns) return;
      S.ship.guns--; if (S.ship.broken > S.ship.guns) S.ship.broken = S.ship.guns;
      S.cash += TW.CANNON_PRICE / 2; speak('sellGun'); save(); render();
    },
    'ammo': (b) => {
      const a = TW.AMMO_BY[b.dataset.ammo];
      if (S.cash < a.price) { speak('cantAfford'); return render(); }
      S.cash -= a.price; S.ammo[a.id]++; speak('ammo'); save(); render();
    },
    'buyship': (b) => {
      const id = b.dataset.ship, price = +b.dataset.price, d = shipDef(), nd = TW.SHIP[id];
      const tradeIn = Math.round(d.price * 0.6 * (0.5 + 0.5 * S.ship.hull / d.hull) / 100) * 100;
      const cost = Math.max(0, price - tradeIn);
      if (S.cash < cost) { speak('cantAfford'); return render(); }
      const guns = Math.min(S.ship.guns, nd.guns);
      if (cargoQty() + guns * TW.GUN_SPACE > nd.cargo) return toast(`Your cargo won't fit in the ${nd.name}. Sell some first.`, 'bad');
      modal(`<h2>Buy the ${nd.name}?</h2><p>Price ${gold(price)}, less ${gold(tradeIn)} for your ${d.name}. You pay ${gold(cost)}.</p>
        ${S.ship.guns > guns ? `<p>${S.ship.guns - guns} cannons won't fit and will be sold.</p>` : ''}`,
        [['Shake hands', () => {
          S.cash -= cost; S.cash += (S.ship.guns - guns) * TW.CANNON_PRICE / 2;
          S.ship = { type: id, hull: nd.hull, guns, broken: Math.min(S.ship.broken, guns), cargo: S.ship.cargo };
          S.offers[S.port] = S.offers[S.port].filter(o => o.id !== id);
          log(`Bought a ${nd.name}. A fine vessel!`); TW.sfx('bell'); speak('buyShip'); save(); render();
        }, 'big'], ['Cancel', null, 'ghost']]);
    },
    'deposit': () => { const a = Math.min(amount(), S.cash); S.cash -= a; S.bank += a; speak(a ? 'deposit' : 'nothing'); save(); render(); },
    'withdraw': () => { const a = Math.min(amount(), S.bank); S.bank -= a; S.cash += a; speak(a ? 'withdraw' : 'nothing'); save(); render(); },
    'deposit-all': () => { const a = S.cash; S.bank += S.cash; S.cash = 0; speak(a ? 'deposit' : 'nothing'); save(); render(); },
    'withdraw-all': () => { const a = S.bank; S.cash += S.bank; S.bank = 0; speak(a ? 'withdraw' : 'nothing'); save(); render(); },
    'borrow': () => {
      const max = Math.max(0, Math.max(5000, 2 * worth()) - S.debt);
      const a = Math.min(amount(), max);
      if (!a) { if (max) return toast('Enter an amount.', 'bad'); speak('refused'); return render(); }
      S.cash += a; S.debt += a; log(`Borrowed ${fmt(a)} gold from the moneylender.`); speak('borrow'); save(); render();
    },
    'repay': () => { const a = Math.min(amount(), S.cash, S.debt); S.cash -= a; S.debt -= a; if (a) speak(S.debt ? 'repay' : 'repayAll'); save(); render(); },
    'repay-all': () => { const a = Math.min(S.cash, S.debt); S.cash -= a; S.debt -= a; if (!S.debt) { log('Paid off the moneylender in full.'); speak('repayAll'); } save(); render(); },
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
    const names = ['title', 'harbor', 'market', 'shipyard', 'tavern', 'combat', 'int-bank', 'int-lender', 'int-harbor'];
    return Promise.all(names.map(n => new Promise(res => {
      const img = new Image();
      img.onload = () => { TW.images[n] = img; res(); };
      img.onerror = () => res();
      img.src = `assets/img/${n}.jpg`;
    })));
  }

  TW.boot = async function () {
    // Canvas text (map labels, combat) only uses web fonts that have already loaded.
    if (document.fonts) await Promise.race([
      Promise.all(['16px "Pirata One"', '16px "IM Fell English SC"', '16px Alegreya', 'bold 16px Alegreya']
        .map(f => document.fonts.load(f).catch(() => {}))),
      new Promise(r => setTimeout(r, 2500)),
    ]);
    TW.initMap();
    await loadImages();
    go('title');
  };
  // Exposed for debugging and automated checks.
  // Set TW._debug.nextEvents = ['pirates', 'storm'] to force events on the next voyage.
  TW._debug = { get state() { return S; }, set state(v) { S = v; }, go, passDay, makeFleet, worth, nextEvents: null };
})();

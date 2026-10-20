// Static game data for Tradewaters. Numbers are original balancing, informed by the
// mechanics of the classic Tradewinds games.
window.TW = window.TW || {};

TW.GOODS = [
  { id: 'fish',    name: 'Fish',    min: 8,    max: 60,    unlock: 0,       elastic: 0.003, depth: 900, icon: '🐟' },
  { id: 'cotton',  name: 'Cotton',  min: 15,   max: 110,   unlock: 0,       elastic: 0.003, depth: 900, icon: '☁️' },
  { id: 'timber',  name: 'Timber',  min: 40,   max: 220,   unlock: 0,       elastic: 0.003, depth: 700, icon: '🪵' },
  { id: 'cocoa',   name: 'Cocoa',   min: 120,  max: 520,   unlock: 0,       elastic: 0.0028, depth: 550, icon: '🫘' },
  { id: 'sugar',   name: 'Sugar',   min: 250,  max: 900,   unlock: 0,       elastic: 0.0026, depth: 500, icon: '🧂' },
  { id: 'muskets', name: 'Arms',    min: 800,  max: 2600,  unlock: 40000,   elastic: 0.0022, depth: 350, icon: '⚔️' },   // id kept for old saves
  { id: 'cloth',   name: 'Cloth',   min: 1500, max: 5000,  unlock: 120000,  elastic: 0.002, depth: 280, icon: '🧵' },
  { id: 'tobacco', name: 'Tobacco', min: 2500, max: 7000,  unlock: 350000,  elastic: 0.0018, depth: 220, icon: '🍂' },
  { id: 'rum',     name: 'Rum',     min: 4000, max: 9500,  unlock: 900000,  elastic: 0.0016, depth: 180, icon: '🍾' },
  { id: 'gems',    name: 'Gems',    min: 9000, max: 22000, unlock: 2000000, elastic: 0.004, depth: 50, icon: '💎' },
];
// depth: how many units a port's market absorbs before your trading leaves a lasting mark
// on its price (see economy.js). Rarer goods have thinner markets.
TW.GOOD = Object.fromEntries(TW.GOODS.map(g => [g.id, g]));

// services: B = bank, L = moneylender, S = shipyard. Every port has a market and tavern.
TW.PORTS = [
  { id: 'havana',      name: 'Havana',             lat: 23.17, lon: -82.36, svc: 'BLS', makes: ['tobacco', 'sugar'],  wants: ['cloth', 'muskets'] },
  { id: 'merida',      name: 'Mérida',             lat: 21.42, lon: -89.66, svc: 'L',   makes: ['timber', 'cotton'],  wants: ['rum', 'fish'] },
  { id: 'belize',      name: 'Belize',             lat: 17.50, lon: -88.05, svc: 'B',   makes: ['timber', 'fish'],    wants: ['cloth', 'sugar'] },
  { id: 'trujillo',    name: 'Trujillo',           lat: 16.05, lon: -85.95, svc: 'L',   makes: ['cocoa', 'timber'],   wants: ['muskets', 'rum'] },
  { id: 'sanjuan',     name: 'San Juan del Norte', lat: 10.95, lon: -83.55, svc: 'BS',  makes: ['cocoa', 'fish'],     wants: ['cloth', 'tobacco'] },
  { id: 'portobelo',   name: 'Portobelo',          lat: 9.70,  lon: -79.66, svc: 'LS',  makes: ['cotton', 'gems'],    wants: ['muskets', 'cloth'] },
  { id: 'cartagena',   name: 'Cartagena',          lat: 10.55, lon: -75.60, svc: 'BLS', makes: ['cocoa', 'gems'],     wants: ['muskets', 'rum'] },
  { id: 'caracas',     name: 'Caracas',            lat: 10.75, lon: -66.93, svc: 'S',   makes: ['cocoa', 'tobacco'],  wants: ['cloth', 'fish'] },
  { id: 'curacao',     name: 'Curaçao',            lat: 12.00, lon: -68.95, svc: 'B',   makes: ['cloth', 'muskets'],  wants: ['sugar', 'cocoa', 'cotton'] },
  { id: 'barbados',    name: 'Barbados',           lat: 13.10, lon: -59.75, svc: 'BS',  makes: ['sugar', 'rum'],      wants: ['timber', 'fish'] },
  { id: 'martinique',  name: 'Martinique',         lat: 14.60, lon: -61.25, svc: 'BL',  makes: ['sugar', 'rum'],      wants: ['timber', 'cloth'] },
  { id: 'guadeloupe',  name: 'Guadeloupe',         lat: 16.00, lon: -61.95, svc: 'B',   makes: ['sugar', 'cotton'],   wants: ['fish', 'muskets'] },
  { id: 'antigua',     name: 'Antigua',            lat: 17.00, lon: -61.95, svc: 'BLS', makes: ['sugar', 'rum'],      wants: ['timber', 'fish'] },
  { id: 'nevis',       name: 'Nevis',              lat: 17.20, lon: -62.75, svc: 'LS',  makes: ['cotton'],            wants: ['cloth', 'fish'] },
  { id: 'stthomas',    name: 'St. Thomas',         lat: 18.25, lon: -64.95, svc: 'BS',  makes: ['cloth', 'muskets'],  wants: ['cocoa', 'tobacco'] },
  { id: 'puertorico',  name: 'Puerto Rico',        lat: 18.62, lon: -66.11, svc: 'B',   makes: ['sugar', 'tobacco'],  wants: ['muskets', 'cloth'] },
  { id: 'santodomingo',name: 'Santo Domingo',      lat: 18.30, lon: -69.90, svc: 'L',   makes: ['timber', 'tobacco'], wants: ['fish', 'cloth'] },
  { id: 'portroyal',   name: 'Port Royal',         lat: 17.80, lon: -76.84, svc: 'BLS', makes: ['sugar', 'rum'],      wants: ['cloth', 'timber'] },
  { id: 'cayman',      name: 'Grand Cayman',       lat: 19.20, lon: -81.38, svc: 'L',   makes: ['fish', 'timber'],    wants: ['rum', 'sugar'] },
  { id: 'freeport',    name: 'Freeport',           lat: 26.40, lon: -78.70, svc: 'LS',  makes: ['fish', 'muskets'],   wants: ['tobacco', 'rum'] },
];
TW.PORT = Object.fromEntries(TW.PORTS.map(p => [p.id, p]));

// Player ships. reload = seconds between shots per cannon; speed = map px per day.
TW.SHIPS = [
  { id: 'sloop',      name: 'Sloop',      price: 25000,   hull: 30,  cargo: 80,  guns: 6,  reload: 2.6, speed: 44, unlock: 0 },
  { id: 'schooner',   name: 'Schooner',   price: 48000,   hull: 60,  cargo: 130, guns: 10, reload: 2.3, speed: 50, unlock: 30000 },
  { id: 'brigantine', name: 'Brigantine', price: 90000,   hull: 100, cargo: 200, guns: 15, reload: 2.1, speed: 46, unlock: 80000 },
  { id: 'barque',     name: 'Barque',     price: 240000,  hull: 180, cargo: 270, guns: 20, reload: 1.9, speed: 42, unlock: 250000 },
  { id: 'galleon',    name: 'Galleon',    price: 900000,  hull: 300, cargo: 480, guns: 24, reload: 1.8, speed: 38, unlock: 700000 },
  { id: 'frigate',    name: 'Frigate',    price: 2100000, hull: 300, cargo: 360, guns: 30, reload: 1.6, speed: 50, unlock: 2000000 },
  { id: 'manowar',    name: 'Man-o-War',  price: 2600000, hull: 450, cargo: 300, guns: 40, reload: 1.4, speed: 40, unlock: 3000000 },
];
TW.SHIP = Object.fromEntries(TW.SHIPS.map(s => [s.id, s]));
// Difficulty. Easy is the game as first balanced; each step up makes pirates tougher and
// more frequent, markets thinner and life at sea dearer. The game sets TW.diff whenever a
// save loads or the setting changes, and every rule reads it from there.
//   enemyHull/enemyFire/enemyAim: pirate and fort hull, rate of fire, accuracy
//   danger: added to the danger level (bigger fleets and forts sooner)
//   pirates/storms: encounter odds; spread: what a market pays as a share of its price
//   impact: how far your own trades move prices; upkeep: wages; booty: plunder gold
//   bank/loan: interest rates
TW.DIFFICULTIES = [
  { id: 'easy', name: 'Easy', desc: 'Forgiving pirates and fat margins. The Caribbean as first charted.',
    enemyHull: 1, enemyFire: 1, enemyAim: 1, danger: 0, pirates: 1, storms: 1, spread: 0.9, impact: 1, upkeep: 1, booty: 1, bank: 1, loan: 1 },
  { id: 'medium', name: 'Medium', desc: 'Pirates hit harder and turn up more often; margins are thinner and crews cost more.',
    enemyHull: 1.15, enemyFire: 1.08, enemyAim: 1.05, danger: 2, pirates: 1.3, storms: 1.25, spread: 0.88, impact: 1.15, upkeep: 1.2, booty: 0.9, bank: 0.85, loan: 1.1 },
  { id: 'hard', name: 'Hard', desc: 'Bigger fleets come sooner, every route dries up fast and a crew eats your profit.',
    enemyHull: 1.3, enemyFire: 1.15, enemyAim: 1.1, danger: 3, pirates: 1.6, storms: 1.5, spread: 0.865, impact: 1.35, upkeep: 1.45, booty: 0.8, bank: 0.7, loan: 1.25 },
  { id: 'impossible', name: 'Impossible', desc: 'Every pirate in the Caribbean wants you dead and every merchant wants your purse.',
    enemyHull: 1.45, enemyFire: 1.25, enemyAim: 1.15, danger: 5, pirates: 2, storms: 1.8, spread: 0.85, impact: 1.6, upkeep: 1.8, booty: 0.7, bank: 0.5, loan: 1.5 },
];
TW.DIFFICULTY = Object.fromEntries(TW.DIFFICULTIES.map(d => [d.id, d]));
TW.diff = TW.DIFFICULTY.easy;

// Daily wages and provisions: bigger ships need bigger crews, and every cannon needs gunners.
TW.upkeep = (ship, guns) => Math.round((ship.price * 0.0004 + guns * 3) * TW.diff.upkeep);
TW.GUN_SPACE = 5;
TW.CANNON_PRICE = 1500;

// Enemy pirate ships. tier = minimum danger level before they appear.
TW.ENEMIES = [
  { id: 'sloop',      name: 'Pirate Sloop',     hull: 9,   guns: 2,  reload: 2.8, tier: 0,  booty: 2600,   look: 'sloop' },
  { id: 'schooner',   name: 'Pirate Schooner',  hull: 25,  guns: 3,  reload: 2.6, tier: 5,  booty: 7000,   look: 'schooner' },
  { id: 'brigantine', name: 'Corsair Brig',     hull: 52,  guns: 5,  reload: 2.4, tier: 10, booty: 16000,  look: 'brigantine' },
  { id: 'barque',     name: 'Raider Barque',    hull: 92,  guns: 8,  reload: 2.2, tier: 17, booty: 38000,  look: 'barque' },
  { id: 'galleon',    name: 'Black Galleon',    hull: 125, guns: 12, reload: 2.1, tier: 24, booty: 88000,  look: 'galleon' },
  { id: 'frigate',    name: 'Rogue Frigate',    hull: 160, guns: 18, reload: 1.9, tier: 31, booty: 120000, look: 'frigate' },
  { id: 'manowar',    name: 'Dread Man-o-War',  hull: 240, guns: 26, reload: 1.8, tier: 42, booty: 225000, look: 'manowar' },
];

// Port defenses for hostile-port battles, one row per tier (danger level / 8). From the
// original's cannon emplacements and fortresses, rebalanced for this game's ships: land
// targets are easy to hit and easy to sail away from, but carry a lot of guns.
TW.DEFENSES = [
  { battery: { hull: 10,  guns: 1,  booty: 1500 },  fort: { hull: 25,  guns: 2,  booty: 4500 } },
  { battery: { hull: 35,  guns: 3,  booty: 6000 },  fort: { hull: 58,  guns: 4,  booty: 11000 } },
  { battery: { hull: 46,  guns: 4,  booty: 8000 },  fort: { hull: 92,  guns: 6,  booty: 16000 } },
  { battery: { hull: 58,  guns: 6,  booty: 16000 }, fort: { hull: 145, guns: 9,  booty: 32000 } },
  { battery: { hull: 100, guns: 8,  booty: 32000 }, fort: { hull: 200, guns: 12, booty: 80000 } },
  { battery: { hull: 140, guns: 10, booty: 80000 }, fort: { hull: 230, guns: 16, booty: 160000 } },
];
TW.DEFENSE_RELOAD = 3;

// Curiosities: charms sold by a trader in the taverns, after the magic dolls of Tradewinds 2.
// `promise` is the trader's pitch; the truth (`fx`, `desc`) shows only once you've paid.
// Some come in a crooked version (`cursed`, with its odds) and the rag doll is always a dud.
// Effects multiply: hull, cargo, speed, reload (lower is faster), storm, pirates and patrol
// (encounter odds), enemyAim, bankRate, loanRate, loanCap, drinks; rumorTrue and noLoans
// are switches. Sold back to any trader for half the price.
TW.CURIOS = [
  { id: 'ragdoll', name: 'Lucky Rag Doll', icon: '🧸', price: 10000, fake: true,
    promise: 'Brings a fair wind and a full purse to whoever carries it. The trader swears on his mother.',
    reveal: 'It is stuffed with sawdust and nothing else. You have been had.' },
  { id: 'lenderdoll', name: "Moneylender's Doll", icon: '🪆', price: 15000,
    promise: 'Moneylenders will trust you with three times the credit.',
    fx: { loanCap: 3, loanRate: 2 }, desc: 'Lenders offer three times the credit, at double the interest.' },
  { id: 'stormdoll', name: 'Storm Watcher Doll', icon: '🪞', price: 100000,
    promise: 'Holds a tiny mirror that sees storms coming long before your lookout does.',
    fx: { storm: 0.5 }, desc: 'Storms are half as likely.' },
  { id: 'bartenderdoll', name: "Bartender's Doll", icon: '🍻', price: 200000,
    promise: 'Loosens every tongue in every tavern. No more idle gossip.',
    fx: { rumorTrue: true }, desc: 'Every rumor points to a real shortage or glut.',
    cursed: { chance: 0.35, fx: { rumorTrue: true, drinks: 3 }, desc: 'Every rumor is true, but the house now charges you triple for a round.' } },
  { id: 'battledoll', name: 'Battle Doll', icon: '🎯', price: 300000,
    promise: 'Your gunners will reload thirty per cent faster.',
    fx: { reload: 0.7 }, desc: 'Cannons reload 30% faster.',
    cursed: { chance: 0.35, fx: { reload: 0.7, pirates: 2 }, desc: 'Cannons reload 30% faster, but it seems to call pirates to you: twice as many attacks.' } },
  { id: 'friendring', name: 'Ring of Friendship', icon: '💍', price: 400000,
    promise: 'Wins you the friendship of every moneylender in the Caribbean.',
    fx: { loanRate: 0.5 }, desc: 'Moneylenders charge half the interest.' },
  { id: 'bankerdoll', name: "Banker's Doll", icon: '🏦', price: 1000000,
    promise: 'Bankers pay half as much again in interest.',
    fx: { bankRate: 1.5, noLoans: true }, desc: 'Bank interest is half as much again, but moneylenders now refuse to deal with you.' },
  { id: 'shielddoll', name: 'Magic Shield Doll', icon: '🛡️', price: 2000000,
    promise: 'Wards your hull. Cannonballs bounce off a little more often.',
    fx: { hull: 1.2 }, desc: 'Hull 20% stronger.' },
  { id: 'mambo', name: 'Stinky Mambo', icon: '🌫️', price: 2000000,
    promise: 'Summons a fog that hides your ship from pirates.',
    fx: { pirates: 0.4 }, desc: 'Not fog: a stench. Pirates keep well clear, with 60% fewer attacks.' },
  { id: 'shrinkwand', name: 'Shrink Wand', icon: '🪄', price: 5000000,
    promise: 'Shrinks everything in your hold to fit more aboard.',
    fx: { cargo: 1.5 }, desc: 'Hold capacity +50%.' },
  { id: 'portdoll', name: 'Port Authority Doll', icon: '🪆', price: 8000000,
    promise: 'Customs officers simply cannot see contraband near it.',
    fx: { patrol: 0 }, desc: 'Navy patrols never stop you.',
    cursed: { chance: 0.5, fx: { patrol: 0.5 }, desc: 'This one is missing an eye. Patrols stop you half as often.' } },
  { id: 'blindsailor', name: 'Blind Sailor', icon: '🕶️', price: 12000000,
    promise: 'Blinds the gunners of any ship that dares fire on you.',
    fx: { enemyAim: 0.4 }, desc: 'Enemy gunners hit 60% less often.' },
];
TW.CURIO = Object.fromEntries(TW.CURIOS.map(c => [c.id, c]));

// Ship fittings sold at shipyards, after Tradewinds 2's ship upgrades. They are built into
// the ship and lost when you change ships. Cost is a share of the ship's price; `replaces`
// names a lesser fitting this one supersedes.
TW.FITTINGS = [
  { id: 'speedguns', name: 'Speed Cannons', icon: '🎯', cost: 0.18, fx: { reload: 0.8 }, desc: 'Streamlined cannons that reload 20% faster.' },
  { id: 'heavyguns', name: 'Heavy Cannons', icon: '💣', cost: 0.35, fx: { reload: 0.7 }, desc: 'Heavy-bore cannons on new carriages: reload 30% faster.', replaces: 'speedguns' },
  { id: 'oak', name: 'Reinforced Oak', icon: '🪵', cost: 0.25, fx: { hull: 1.2 }, desc: 'Oak planking doubled below the waterline: hull 20% stronger.' },
  { id: 'storage', name: 'Storage Hull', icon: '📦', cost: 0.2, fx: { cargo: 1.2 }, desc: 'Rebuilt holds: 20% more cargo space.' },
  { id: 'massive', name: 'Massive Hull', icon: '🛢️', cost: 0.5, fx: { cargo: 1.5 }, desc: 'A deeper, wider hull: 50% more cargo space.', replaces: 'storage' },
  { id: 'evasive', name: 'Evasive Rigging', icon: '⛵', cost: 0.3, fx: { pirates: 0.6 }, desc: 'Quick-handling sails: pirates spot and catch you 40% less often.' },
  { id: 'feather', name: 'Feather-Light Trim', icon: '🪶', cost: 0.25, fx: { speed: 1.2, pirates: 0.8, storm: 1.5 }, desc: '20% faster and harder to catch, but storms catch a light ship more often.' },
  { id: 'compass', name: 'Ultimate Compass', icon: '🧭', cost: 0.4, fx: { storm: 0 }, desc: 'Set into the binnacle. With it, you never sail into a storm.' },
];
TW.FITTING = Object.fromEntries(TW.FITTINGS.map(f => [f.id, f]));
TW.fittingPrice = (f, ship) => Math.max(3000, Math.round(ship.price * f.cost / 100) * 100);

TW.AMMO = [
  { id: 'chain', name: 'Chain Shot',  price: 600,   dmg: 10, all: false, desc: 'Heavy damage to the targeted ship.' },
  { id: 'fire',  name: 'Fire Pot',    price: 800,   dmg: 5,  all: true,  desc: 'Light damage to every enemy ship.' },
  { id: 'keg',   name: 'Powder Keg',  price: 12000, dmg: 25, all: true,  desc: 'Devastating damage to every enemy ship.' },
];
TW.AMMO_BY = Object.fromEntries(TW.AMMO.map(a => [a.id, a]));

TW.RANKS = [
  [0, 'Bilge Rat'], [1000, 'Deckhand'], [10000, 'Able Seaman'], [50000, 'Bosun'],
  [100000, 'First Mate'], [250000, 'Captain'], [500000, 'Merchant Captain'],
  [1000000, 'Commodore of Commerce'], [2500000, 'Trade Baron'], [5000000, 'Merchant Prince'],
  [10000000, 'Admiral of the Exchange'], [25000000, 'Lord of the Tradewaters'],
  [50000000, 'Legend of the Seven Seas'],
];

TW.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
TW.MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

TW.PIRATE_NAMES = ['Calico Meg', 'One-Eyed Haskins', 'Black Barnaby', 'Red Sol', 'Mad Ines',
  'Gentleman Fitch', 'Iron Tobias', 'Salt Mary', 'Captain Crowe', 'Jolly Dunmore',
  'Widow Vance', 'Bones Aldaro', 'Smiling Jack Pell', 'Bloody Harrow', 'Quick Ana Ruiz'];

// Simplified coastlines as [lon, lat] rings, drawn from real geography.
TW.LAND = [
  // Mexico, Central and South America as one mainland ring
  [[-97.4,28.5],[-97.4,27],[-97.6,25],[-97.7,24],[-97.8,22.5],[-97.3,21.5],[-96.5,19.8],[-96,19],[-95,18.6],[-94.5,18.2],
   [-93.5,18.4],[-92.5,18.6],[-91.5,18.4],[-90.7,19.3],[-90.4,20.5],[-90.0,21.1],[-89.0,21.35],[-88.0,21.5],[-87.1,21.55],
   [-86.8,21.2],[-86.9,20.4],[-87.5,19.5],[-87.7,18.5],[-88.1,18.4],[-88.3,17.5],[-88.2,16.6],[-88.6,15.9],[-88.0,15.8],
   [-87.5,15.8],[-86.6,15.8],[-85.9,15.95],[-85.0,15.9],[-84.3,15.8],[-83.4,15.2],[-83.2,14.4],[-83.4,13.5],[-83.5,12.5],
   [-83.7,11.5],[-83.7,10.9],[-83.2,10.0],[-82.5,9.5],[-81.8,9.0],[-81.0,8.8],[-80.0,9.3],[-79.5,9.6],[-78.8,9.4],[-77.8,8.7],
   [-77.4,8.6],[-76.8,8.3],[-76.3,9.0],[-75.8,9.5],[-75.5,10.4],[-75.0,11.0],[-74.2,11.3],[-73.3,11.3],[-72.2,11.9],[-71.6,12.4],
   [-71.1,12.0],[-71.4,10.9],[-70.2,11.6],[-69.8,11.4],[-69.0,11.5],[-68.3,10.8],[-67.5,10.6],[-66.2,10.6],[-65.0,10.1],
   [-64.2,10.6],[-63,10.7],[-62.2,10.6],[-61.8,10.0],[-61,9.5],[-60.0,8.5],[-58,7.8],[-58,5],[-99,5],[-99,28.5]],
  // Florida
  [[-82.8,28.0],[-82.6,27.5],[-82.0,26.5],[-81.7,25.9],[-81.1,25.1],[-80.4,25.2],[-80.1,26.0],[-80.0,26.8],[-80.4,27.8],[-80.6,28.5],[-80.9,29.5],[-83.2,29.5]],
  // Cuba
  [[-84.95,21.85],[-84.4,22.0],[-83.4,22.4],[-82.7,22.8],[-82.0,23.05],[-81.0,23.1],[-80.0,22.95],[-79.2,22.4],[-78.3,22.4],[-77.5,21.8],
   [-76.5,21.2],[-75.6,21.0],[-74.5,20.3],[-74.2,20.2],[-75.0,19.9],[-76.0,19.95],[-77.4,19.85],[-77.7,20.4],[-78.0,20.7],[-78.7,21.6],
   [-79.5,21.6],[-80.5,22.0],[-81.5,22.2],[-82.0,22.2],[-82.8,22.0],[-83.4,21.8],[-84.2,21.5]],
  [[-83.1,21.9],[-82.6,21.95],[-82.55,21.55],[-83.0,21.5]], // Isla de la Juventud
  // Hispaniola
  [[-74.45,18.45],[-73.4,18.5],[-72.8,18.4],[-72.4,18.6],[-72.8,19.0],[-73.4,19.7],[-72.7,19.9],[-71.7,19.85],[-70.9,19.9],
   [-70.0,19.65],[-69.2,19.3],[-68.4,18.6],[-68.6,18.2],[-69.9,18.45],[-70.5,18.2],[-71.4,17.6],[-71.7,18.0],[-72.8,18.15],[-73.8,18.05]],
  // Puerto Rico
  [[-67.25,18.5],[-66.1,18.48],[-65.6,18.4],[-65.6,18.0],[-66.8,17.95],[-67.2,18.0]],
  // Jamaica
  [[-78.35,18.3],[-77.5,18.5],[-76.8,18.4],[-76.2,18.0],[-76.6,17.9],[-77.2,17.7],[-77.8,17.85],[-78.35,18.2]],
  // Small islands
  [[-81.42,19.38],[-81.1,19.36],[-81.1,19.27],[-81.4,19.26]],                       // Grand Cayman
  [[-79.0,26.72],[-78.0,26.75],[-77.9,26.6],[-78.7,26.5],[-79.0,26.6]],              // Grand Bahama
  [[-77.5,26.9],[-77.0,26.5],[-77.2,25.9],[-77.4,26.2]],                              // Abaco
  [[-78.2,25.2],[-77.7,25.0],[-77.6,24.2],[-78.0,24.0],[-78.4,24.6]],                 // Andros
  [[-76.8,25.5],[-76.2,25.2],[-76.1,24.8],[-76.6,25.3]],                              // Eleuthera
  [[-75.9,23.6],[-75.2,23.1],[-75.1,23.25],[-75.7,23.7]],                             // Long Island
  [[-73.7,21.1],[-73.0,21.3],[-73.0,20.9],[-73.6,20.9]],                              // Inagua
  [[-65.05,18.38],[-64.85,18.38],[-64.85,18.3],[-65.05,18.3]],                        // St. Thomas
  [[-62.85,17.42],[-62.6,17.2],[-62.55,17.1],[-62.7,17.15]],                          // St. Kitts & Nevis
  [[-61.9,17.17],[-61.68,17.15],[-61.68,17.0],[-61.9,17.02]],                         // Antigua
  [[-61.8,16.5],[-61.2,16.5],[-61.3,16.0],[-61.8,16.0]],                              // Guadeloupe
  [[-61.4,15.6],[-61.25,15.6],[-61.25,15.2],[-61.4,15.2]],                            // Dominica
  [[-61.2,14.88],[-60.8,14.8],[-60.85,14.4],[-61.2,14.45]],                           // Martinique
  [[-61.07,14.1],[-60.88,14.1],[-60.9,13.72],[-61.08,13.75]],                         // St. Lucia
  [[-61.28,13.38],[-61.12,13.38],[-61.12,13.13],[-61.28,13.13]],                      // St. Vincent
  [[-61.8,12.22],[-61.6,12.22],[-61.6,12.0],[-61.8,12.0]],                            // Grenada
  [[-59.65,13.32],[-59.42,13.25],[-59.42,13.05],[-59.65,13.05]],                      // Barbados
  [[-61.95,10.85],[-60.9,10.82],[-61.0,10.05],[-61.95,10.05]],                        // Trinidad
  [[-69.18,12.38],[-68.75,12.08],[-68.85,12.03],[-69.2,12.3]],                        // Curaçao
  [[-70.06,12.62],[-69.86,12.42],[-69.95,12.4],[-70.08,12.55]],                       // Aruba
  [[-68.4,12.3],[-68.2,12.3],[-68.2,12.05],[-68.4,12.1]],                             // Bonaire
  [[-64.4,11.15],[-63.8,11.15],[-63.8,10.9],[-64.4,10.9]],                            // Margarita
  [[-87.0,20.6],[-86.75,20.6],[-86.75,20.3],[-87.0,20.3]],                            // Cozumel
];

// Map projection: lon -98..-58.5, lat 28..8.  30 px per degree.
TW.MAP = { lon0: -98, lat0: 28, k: 30, w: 1185, h: 600 };
TW.project = (lon, lat) => [(lon - TW.MAP.lon0) * TW.MAP.k, (TW.MAP.lat0 - lat) * TW.MAP.k];

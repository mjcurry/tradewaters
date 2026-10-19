// Building roles and dialogue. Each port has its own keepers (TW.CAST in cast.js) with
// their own greetings and chatter; the lines here are shared by role and kept in a
// neutral voice so they suit any keeper: situation-aware remarks (debt, hull damage,
// cargo...) and reactions to what the captain just did.
//
// Lines are strings with {placeholders}, or functions of the context that return a
// string or null (null = not applicable right now). See TW.line() at the bottom.
(function () {
  const pick = a => a[Math.floor(Math.random() * a.length)];

  TW.ROLES = {
    market: {
      building: 'Marketplace',
      greet: [
        c => c.cargo === 0 ? 'An empty hold is a sad sight, Captain. Let’s fix that.' : null,
        c => c.cargo > 0 ? 'I can smell your cargo from here, Captain. Selling, I hope?' : null,
        c => c.cash < 300 ? 'Browsing again? Coins jingle, Captain. Yours whisper.' : null,
        c => c.worth > 500000 ? 'Captain {name}! My favorite customer. Today, at least.' : null,
      ],
      idle: [
        'What does {port} crave? Mostly {wants}. Bring those and we’ll both smile.',
        'What do we have too much of here? {makes}. Take it off my hands, cheaply.',
        'Big orders move my prices, Captain. Spread your trades around.',
        'Rich goods need rich captains. Grow your purse and finer cargo will open up to you.',
      ],
      buy: ['A sound purchase. Probably.', 'Sold! Don’t let the pirates have it.', 'Pleasure doing business. Mostly mine.'],
      bigBuy: ['You’ll empty my warehouse! Prices are going up, naturally.', 'All of that? You’ll make me rich, and then poor.'],
      sellProfit: ['A tidy profit. I’m almost proud.', 'Ha! You bought cheap somewhere. Clever.', 'Now that is how a merchant sails.'],
      sellLoss: ['Selling at a loss? Your secret’s safe with me. Mostly.', 'Ouch. Next time, buy where the price is green.'],
      cantAfford: ['Credit? This is a market, Captain, not a moneylender.'],
      holdFull: ['Your hold is full. I admire the ambition.'],
    },

    tavern: {
      building: 'Tavern',
      greet: [
        c => c.firstVisit ? 'Never seen you in {port} before! Welcome, stranger. First drink’s the friendliest.' : null,
        c => c.hullPct < 0.5 ? 'By the look of your hull you’ve been arguing with reefs. Or cannons. Sit down.' : null,
        c => c.debt > 0 ? 'Word is you owe the moneylender. I’d drink fast if I were you.' : null,
      ],
      idle: [
        'Sailors talk when the drinks are free. That’s the whole business, really.',
        'Buy a round and the whole room starts remembering prices in other ports.',
      ],
      rumor: ['Lean closer…', 'Here’s what I heard…', 'You didn’t hear this from me…'],
      chart: ['An old navigator left this as payment. Tab’s settled!', 'Careful with that chart. The last owner got eaten. By debt.'],
      wait: ['A few days’ rest! You look almost human.', 'Back already? The rooms upstairs are cheap. And slightly haunted.'],
      broke: ['No coin, no rumors. House rules.'],
    },

    shipyard: {
      building: 'Shipyard',
      greet: [
        c => c.hullPct < 0.5 ? 'What did you do to her? Hold still, let me look at those holes.' : null,
        c => c.hullPct >= 1 ? 'Not a scratch. Either you’re careful or you’re boring.' : null,
        c => c.guns === 0 ? 'No cannons? Brave. Or foolish. Usually both.' : null,
      ],
      idle: [
        'Every cannon costs you five crates of cargo. Choose: profit or bang.',
        'A faster ship outruns trouble. A bigger ship carries more of it. Pick.',
        'Chain shot cuts rigging. Fire pots cut morale. Powder kegs cut everything.',
        'New hulls come down the slipway every month. Come back and look.',
      ],
      repair: ['There. Good as new. Better, actually.', 'Patched! Try to keep the sea on the outside this time.'],
      buyGun: ['Another cannon. She’ll bark louder now.', 'More guns. The pirates will hate that.'],
      sellGun: ['Selling a gun? The pirates will be delighted.'],
      ammo: ['Handle with care. Or don’t, and come back for a new ship.', 'Keep it dry. Keep it far from your pipe.'],
      buyShip: ['A new ship! Treat her well and she’ll bring you home.', 'She’s a beauty. Don’t you dare scratch her.'],
      cantAfford: ['Ships cost money, Captain. Wood doesn’t grow on… well. It does. But still.'],
    },

    bank: {
      building: 'Bank',
      greet: [
        c => c.bank > 0 ? 'Your deposit of {bank} gold remains safe, dry, and growing at a respectable pace.' : null,
        c => c.bank === 0 ? 'No deposits yet? Gold in your pocket is gold in a pirate’s pocket, eventually.' : null,
        c => c.debt > 0 ? 'I see you’ve visited the moneylender. We prefer not to discuss that here.' : null,
      ],
      idle: [
        'Roughly ten percent a year, Captain. Patience is the most profitable cargo.',
        'Interest is paid at the start of every month.',
      ],
      deposit: ['Recorded, stamped and filed. Splendid.', 'Ah, the sweet sound of a ledger balancing.'],
      withdraw: ['Withdrawing? Do be careful out there.', 'Very well. Try not to spend it all on one ship.'],
      nothing: ['A deposit of nothing earns precisely nothing. I checked the arithmetic.'],
    },

    lender: {
      building: 'Moneylender',
      greet: [
        c => c.debt > 0 && c.debt <= c.worth * 0.5 ? 'You owe me {debt}, Captain. No rush. Well, some rush.' : null,
        c => c.debt > 0 && c.debt > c.worth * 0.5 ? '{debt} gold, Captain. My associates are beginning to remember your face.' : null,
        c => c.worth > 1000000 ? 'So successful! Surely you don’t need me… but everyone needs me eventually.' : null,
      ],
      idle: [
        'Borrow to buy cargo, sell it dear, pay me back. Easy. Unless…',
        'Interest is added at the start of every month. Every month.',
      ],
      borrow: ['Signed in ink. Mine, of course, is permanent.', 'Spend it wisely. Or quickly. I prefer quickly.'],
      repay: ['A payment! You have made me very… mildly pleased.'],
      repayAll: ['All of it? How disappointing. Do come back soon.'],
      refused: ['No. Even I have limits, Captain.'],
    },

    harbor: {
      building: 'Harbor Office',
      greet: [
        c => c.threat >= 2 && c.guns < 6 ? 'Pirate sails spotted past the reef. With {guns} guns, I’d think twice.' : null,
        c => c.hullPct < 0.5 ? 'She’s sitting low and leaking, Captain. The shipyard can fix that.' : null,
        c => c.loadPct > 0.8 ? 'Heavy cargo slows you down, and pirates can smell it from a league away.' : null,
      ],
      idle: [
        'Every port on the chart wants something another port has. That’s the whole trick.',
        c => c.uncharted ? 'Old sailors speak of ports beyond the charts. The tavern might sell you a map.' : null,
        c => c.threat >= 3 ? 'Lately the pirates have grown bolder and richer. Rather like you, Captain.' : null,
      ],
    },
  };

  // The keeper of a building in a port, falling back to the role name if a port has none.
  TW.keeper = function (portId, building) {
    const c = TW.CAST[portId] && TW.CAST[portId][building];
    return c || { name: TW.ROLES[building].building, title: '', greet: [], idle: [] };
  };

  // Fill {placeholders} from the context.
  function fill(text, c) {
    return text.replace(/\{(\w+)\}/g, (m, k) => (c[k] === undefined ? m : typeof c[k] === 'number' ? Math.round(c[k]).toLocaleString('en-US') : c[k]));
  }

  // A line for the keeper of `who` (a building) in the context's port. Greetings mostly
  // react to the captain's situation when something applies; otherwise the keeper speaks
  // in their own voice. Idle chatter is mostly the keeper's own, with the odd role tip.
  // Reactions (buy, repair, borrow...) come from the role.
  TW.line = function (who, kind, ctx) {
    const role = TW.ROLES[who], own = TW.keeper(ctx.portId, who);
    if (!role) return null;
    const resolve = pool => (pool || []).map(l => (typeof l === 'function' ? l(ctx) : l)).filter(Boolean);
    let choice = null;
    if (kind === 'greet') {
      const situational = resolve(role.greet), personal = resolve(own.greet);
      choice = situational.length && (Math.random() < 0.6 || !personal.length) ? pick(situational) : pick(personal);
    } else if (kind === 'idle') {
      const personal = resolve(own.idle), tips = resolve(role.idle);
      choice = personal.length && (Math.random() < 0.7 || !tips.length) ? pick(personal) : pick(tips);
    } else {
      const pool = resolve(role[kind]);
      choice = pool.length ? pick(pool) : null;
    }
    return choice ? fill(choice, ctx) : null;
  };
})();

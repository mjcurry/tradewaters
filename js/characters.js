// The keepers of each building. Every port has the same cast (they insist they're
// "family" or "guild"), and each one reacts to the captain's situation.
//
// Lines are strings with {placeholders}, or functions of the context that return a
// string or null (null = not applicable right now). See TW.line() at the bottom.
(function () {
  const pick = a => a[Math.floor(Math.random() * a.length)];

  TW.CHARACTERS = {
    market: {
      name: 'Marisol Quintero', title: 'Factor of the Merchants’ Guild', building: 'Marketplace',
      greet: [
        'Ah, Captain {name}. The scales are polished and the prices are… negotiable. Mostly not.',
        '{port}’s finest goods, priced by the finest mind in the Caribbean. Mine.',
        c => c.cargo === 0 ? 'An empty hold is a sad thing, cariño. Let’s fix that.' : null,
        c => c.cargo > 0 ? 'I can smell your cargo from here. Selling, I hope?' : null,
        c => c.cash < 300 ? 'Browsing again? Coins jingle, Captain. Yours whisper.' : null,
        c => c.worth > 500000 ? 'Captain {name}! My favorite customer. Today, at least.' : null,
      ],
      idle: [
        'Buy low, sell high. They pay me to say obvious things, you know.',
        'Every port wants something. The trick is knowing what before they do.',
        'Big orders move my prices. Small orders move my heart. Neither moves much.',
        'I once sold sugar to a sugar plantation. Best day of my life.',
        'What does {port} crave? Mostly {wants}. Bring me those and we’ll both smile.',
        'What do we have too much of here? {makes}. Take it off my hands, cheaply.',
        'Rich goods need rich captains. Grow your purse and the guild will trust you with finer things.',
      ],
      buy: ['A sound purchase. Probably.', 'Sold! Don’t let the pirates have it.', 'Pleasure doing business. Mostly mine.'],
      bigBuy: ['You’ll empty my warehouse! Prices are going up, naturally.', 'All of it? Ay, you’ll make me rich and then poor.'],
      sellProfit: ['A tidy profit. I’m almost proud.', 'Ha! You bought cheap somewhere. Clever.', 'Now that is how a merchant sails.'],
      sellLoss: ['Selling at a loss? Your secret’s safe with me. Mostly.', 'Ouch. Next time, buy where it’s green, cariño.'],
      cantAfford: ['Credit? This is a market, cariño, not a moneylender.'],
      holdFull: ['Your hold is full. I admire the ambition.'],
    },

    tavern: {
      name: 'Barnaby “Bilge” Gumm', title: 'Keeper of the Salted Lantern', building: 'Tavern',
      greet: [
        'Welcome to the Salted Lantern! Mind the floor, it’s mostly rum.',
        'Captain {name}! Pull up a barrel. First rumor’s cheap, second one’s cheaper.',
        c => c.firstVisit ? 'Never seen you in {port} before! Don’t fret, my cousin back in {home} told me all about you.' : null,
        c => c.hullPct < 0.5 ? 'By the look of your hull you’ve been arguing with reefs. Or cannons. Sit down.' : null,
        c => c.debt > 0 ? 'Word is you owe the moneylender. I’d drink fast if I were you.' : null,
      ],
      idle: [
        'Every port has a Gumm behind the bar. Big family. Ugly family.',
        'Lost this eye to a parrot. Don’t ask about the parrot.',
        'A pirate walked in here once and ordered milk. We still talk about it.',
        'Storm season’s no joke. Neither is my cooking.',
        'I could tell you about the time I wrestled a shark… but it’d cost you a round.',
        'Sailors talk when the drinks are free. That’s the whole business, really.',
      ],
      rumor: ['Lean closer…', 'Here’s what I heard…', 'You didn’t hear this from me…'],
      chart: ['An old navigator left this as payment. Tab’s settled!', 'Careful with that chart. The last owner got eaten. By debt.'],
      wait: ['Three days of rest! You look almost human.', 'Back already? The rooms upstairs are cheap. And slightly haunted.'],
      broke: ['No coin, no rumors. House rules, mate.'],
    },

    shipyard: {
      name: 'Ingrid Hallvard', title: 'Master Shipwright', building: 'Shipyard',
      greet: [
        'Ah, the {ship}. Held together by tar and optimism, ja?',
        'Welcome to my yard. Touch nothing. Especially the saw.',
        c => c.hullPct < 0.5 ? 'Skit! What did you do to her? Hold still, I need a look at those holes.' : null,
        c => c.hullPct >= 1 ? 'Not a scratch. Either you’re careful or you’re boring.' : null,
        c => c.guns === 0 ? 'No cannons? Brave. Or stupid. Usually both.' : null,
      ],
      idle: [
        'Every cannon costs you five crates of cargo. Choose: profit or bang.',
        'A faster ship outruns trouble. A bigger ship carries more of it. Pick.',
        'Chain shot cuts rigging. Fire pots cut morale. Powder kegs cut everything.',
        'In Bergen we build ships to fight the North Sea. Here they fight sunburn.',
        'I talk to my ships. They listen better than captains.',
        'New hulls come down the slipway every month. Come back and look.',
      ],
      repair: ['There. Good as new. Better, actually. I did it.', 'Patched! Try to keep the sea on the outside this time.'],
      buyGun: ['Another cannon. She’ll bark louder now.', 'Ja, more guns. Pirates hate that.'],
      sellGun: ['Selling a gun? The pirates will be delighted.'],
      ammo: ['Handle with care. Or don’t, and I’ll sell your widow a new ship.', 'Keep it dry. Keep it far from your pipe.'],
      buyShip: ['A new ship! Treat her well and she’ll bring you home.', 'She’s a beauty. Don’t you dare scratch her.'],
      cantAfford: ['Ships cost money, Captain. Wood doesn’t grow on… well. It does. But still.'],
    },

    bank: {
      name: 'Cornelius Pettibone', title: 'Senior Clerk, Crown & Anchor Bank', building: 'Bank',
      greet: [
        'Good day, Captain {name}. Please wipe your boots. The ledgers are watching.',
        c => c.bank > 0 ? 'Your deposit of {bank} gold remains safe, dry, and growing at a respectable pace.' : null,
        c => c.bank === 0 ? 'No deposits yet? Gold in your pocket is gold in a pirate’s pocket, eventually.' : null,
        c => c.debt > 0 ? 'I see you’ve visited the… moneylender. *sniff* We don’t discuss her here.' : null,
      ],
      idle: [
        'Interest is paid monthly. Like clockwork. I adore clockwork.',
        'Pirates do not rob banks. Mostly because I glare at them.',
        'Roughly ten percent a year, Captain. Patience is the most profitable cargo.',
        'I have counted every coin in this vault twice. Thrice on Sundays.',
        'A bank in every major port, and every one of them spotless. I check.',
      ],
      deposit: ['Recorded, stamped and filed. Splendid.', 'Ah, the sweet sound of a ledger balancing.'],
      withdraw: ['Withdrawing? Do be careful out there.', 'Very well. I shall try not to weep.'],
      nothing: ['A deposit of nothing earns precisely nothing. I checked the arithmetic.'],
    },

    lender: {
      name: 'Madame Odile Vautrin', title: 'Moneylender', building: 'Moneylender',
      greet: [
        c => c.debt === 0 ? 'Captain {name}… what a pleasure. Come, sit. Let us talk about your future.' : null,
        c => c.debt > 0 && c.debt <= c.worth * 0.5 ? 'Ah, my favorite debtor. You owe me {debt}, chéri. No rush. Well, some rush.' : null,
        c => c.debt > 0 && c.debt > c.worth * 0.5 ? '{debt} gold, Captain. My associates are beginning to remember your face.' : null,
        c => c.worth > 1000000 ? 'So successful! Surely you do not need me… but everyone needs me eventually.' : null,
      ],
      idle: [
        'Ten percent a month. Simple, elegant, inevitable.',
        'I never threaten, Captain. I merely remind.',
        'My last debtor sailed to Africa to avoid me. I sent him a letter.',
        'Borrow to buy cargo, sell it dear, pay me back. Easy. Unless…',
        'Interest is like the tide, chéri. It always comes in.',
      ],
      borrow: ['Signed in ink. Mine, of course, is permanent.', 'Spend it wisely. Or quickly. I prefer quickly.'],
      repay: ['A payment! You have made me very… mildly pleased.'],
      repayAll: ['All of it? How disappointing. Do come back soon.'],
      refused: ['Non. Even I have limits, Captain.'],
    },

    harbor: {
      name: 'Ezekiel “Zeke” Morrow', title: 'Harbor Master', building: 'Harbor Office',
      greet: [
        'Tide’s good, Captain. Where are you bound?',
        'Forty years I’ve watched these waters. They never look the same twice.',
        c => c.threat >= 2 && c.guns < 6 ? 'Pirate sails spotted past the reef. With {guns} guns, I’d think twice.' : null,
        c => c.hullPct < 0.5 ? 'She’s sitting low and leaking, Captain. The shipyard’s just up the quay.' : null,
        c => c.loadPct > 0.8 ? 'Heavy cargo slows you down, and pirates can smell it from a league away.' : null,
      ],
      idle: [
        'The sea doesn’t read almanacs. Storms come when they please.',
        'Run if you’re outgunned. There’s no shame in a long life.',
        'Every port on that chart wants something another port has. That’s the whole trick.',
        'A full hold and an empty gun deck. That’s how pirates get rich.',
        'Red sky at night, sailor’s delight. Red sky at morning… stay in the tavern.',
        c => c.uncharted ? 'Old sailors speak of ports beyond the charts. Gumm in the tavern might sell you a map.' : null,
        c => c.threat >= 3 ? 'Lately the pirates have grown bolder and richer. Rather like you, Captain.' : null,
      ],
    },
  };

  // Fill {placeholders} from the context.
  function fill(text, c) {
    return text.replace(/\{(\w+)\}/g, (m, k) => (c[k] === undefined ? m : typeof c[k] === 'number' ? Math.round(c[k]).toLocaleString('en-US') : c[k]));
  }

  // A line for a character. `kind` is greet/idle or a reaction key. Conditional
  // lines that apply are preferred over generic ones so greetings feel responsive.
  TW.line = function (who, kind, ctx) {
    const ch = TW.CHARACTERS[who];
    const pool = ch && ch[kind];
    if (!pool) return null;
    const specific = [], generic = [];
    for (const l of pool) {
      if (typeof l === 'function') { const t = l(ctx); if (t) specific.push(t); }
      else generic.push(l);
    }
    const choice = specific.length && Math.random() < 0.75 ? pick(specific) : pick(generic.length ? generic : specific);
    return choice ? fill(choice, ctx) : null;
  };
})();

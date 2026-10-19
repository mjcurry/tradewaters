# Tradewaters

A browser trading game set in the 18th-century Caribbean, inspired by the classic
*Tradewinds 2*. Buy low, sell high, and survive storms and pirates.

## Play

The game is plain HTML/CSS/JS with no build step. Serve the folder and open it:

```bash
python3 -m http.server 8137
```

Then visit http://localhost:8137. Opening `index.html` straight from disk also works in most browsers.

## Deploy

Hosted on Cloudflare Pages, which deploys on every push to `main`:

- Build command: `sh scripts/build.sh`
- Build output directory: `dist`

The build only copies `index.html`, `_headers`, `css/`, `js/` and `assets/` into `dist/`, so
`docs/` and other repo files never reach the public site. `_headers` sets the caching:
`index.html` is never cached and everything else is cached for a week. After changing CSS
or JS, bump the `?v=` number in `index.html` so returning players get the new files.

## What's in it

- **City views.** Each port has its own painted harbor. Click a building on the quay to go inside, where its keeper greets you and reacts to what you do.
- **20 real Caribbean ports.** Each one produces some goods cheaply and pays well for others. Prices drift every day, and random shortages and gluts appear (rumors in the tavern tell you about them). Your own big trades move prices too.
- **10 goods,** from fish to gems. The richer goods unlock as your net worth grows.
- **7 ships,** from a sloop to a man-o-war. Cannons protect you but take up cargo space.
- **Voyages** follow real sea lanes, found with A* pathfinding around coastlines drawn from real geography. Storms, pirates and floating salvage can happen along the way.
- **Real-time naval combat.** Your cannons fire on their own while you choose targets, use Chain Shot / Fire Pots / Powder Kegs, or try to flee (keys `1` `2` `3` `F`).
- **Bank** (about 10%/yr), **moneylender** (10%/month!), sea charts, a ship trade-in market, and a captain's log.
- **Career mode** (10 years) or **Endless**. Autosaves to localStorage on arrival in each port.

## Project layout

| Path | Purpose |
|---|---|
| `index.html`, `css/style.css` | Page shell and styling |
| `js/data.js` | Goods, ports, ships, enemies, ranks, coastline polygons |
| `js/economy.js` | Market simulation, trade pricing, tavern rumors |
| `js/map.js` | Coastline rasterization, A* routing, map rendering |
| `js/combat.js` | Real-time battle loop and ship drawing |
| `js/audio.js` | Synthesized sound effects and the optional music player |
| `js/game.js` | Game state, screens (city view, buildings, map, combat), voyages, actions |
| `js/characters.js` | The six building keepers and their dialogue |
| `js/city.js` | Per-port architecture style, sign text and quay height for each city view |
| `assets/img/` | Title, interiors and battle art generated with Higgsfield |
| `assets/img/ports/` | One city-view painting per port |
| `assets/img/buildings/` | Clickable building cut-outs, in Spanish and English colonial styles |
| `assets/img/chars/` | Keeper portraits |
| `assets/video/title.mp4` | Looping animated title backdrop (Higgsfield, MiniMax H3) |
| `js/titlefx.js` | Title-screen gulls and water glints |
| `assets/music/` | Drop Suno tracks here. Prompts are in `assets/music/README.md` |

## Debugging

Open the console and run `TW._debug.nextEvents = ['pirates', 'storm', 'flotsam']` to force events on the next voyage.
`TW._debug.state` is the live game state.

## Credits and legal

Tradewaters is an original implementation. Its code, art, text and balance are new. It reuses
only general game mechanics that were observed in the original, and none of the original's
assets, characters, story or code. *Tradewinds 2* is © 2005 Sandlot Games.

# Tradewaters music

The game plays these files automatically if they exist. Missing files are skipped silently.
Each track is here as `.m4a` (the Suno download, Opus audio) plus an `.mp3` copy. Browsers that
can play Opus-in-M4A load the `.m4a`; others (such as older Safari) fall back to the `.mp3`.
To regenerate the copies after replacing a track:
`for f in *.m4a; do ffmpeg -y -i "$f" -codec:a libmp3lame -q:a 4 "${f%.m4a}.mp3"; done`

| File | Plays during | Loops |
|---|---|---|
| `title.mp3` | Title and new-game screens | yes |
| `port.mp3` | In port (market, shipyard, bank, lender) | yes |
| `tavern.mp3` | Tavern tab | yes |
| `sailing.mp3` | World map and voyages | yes |
| `combat.mp3` | Pirate battles | yes |
| `victory.mp3` | Final score screen | no |

All prompts are instrumental. In Suno, use **Custom mode**, turn on **Instrumental**, paste the
"Style" text into *Style of Music*, and use the title as the song title. For loops, trim to a clean
bar boundary or pick a take that ends on the tonic.

---

### 1. Title: "Tradewaters"
**Style:** cinematic orchestral sea shanty overture, instrumental, warm strings, French horn melody, fiddle, tin whistle, frame drum, bright Caribbean marimba accents, adventurous and hopeful, golden-hour sunset mood, 3/4 waltz lilt building to full orchestra, 92 BPM, D major

### 2. Port: "Harbor Ledger"
**Style:** relaxed Caribbean folk instrumental, acoustic nylon guitar, steel drum, light hand percussion, upright bass, gentle accordion, bustling harbor market, sunny and unhurried, loopable background music for a strategy game, no vocals, 100 BPM, G major

### 3. Tavern: "The Salted Lantern"
**Style:** lively 18th-century tavern jig, instrumental, fiddle and concertina lead, bodhrán, stomping feet and mug clinks, plucked mandolin, a little tipsy swing, warm candlelit pub atmosphere, loopable, no vocals, 118 BPM, A dorian

### 4. Sailing: "Open Water"
**Style:** sweeping maritime adventure instrumental, rolling 6/8 rhythm like waves, cello and viola ostinato, tin whistle melody, soft timpani swells, wind and distant gulls ambience, sense of open horizon and voyage, calm but purposeful, loopable game exploration music, 84 BPM, E minor to G major

### 5. Combat: "Black Flag Rising"
**Style:** intense pirate naval battle orchestral instrumental, driving taiko and snare, low brass stabs, aggressive staccato strings, war fiddle, cannon-like booms on the downbeat, tense minor key, relentless forward momentum, loopable action game combat music, no vocals, 148 BPM, D minor

### 6. Victory: "A Fortune Made"
**Style:** triumphant short orchestral fanfare, instrumental, brass and strings, celebratory sea shanty melody, cymbal swells, ringing ship bell, proud and joyful ending, 45 seconds, 104 BPM, D major

---

**Tips**
- To keep the set consistent, generate the title track first. Then use Suno's "Cover"/"Persona" feature or reuse its style tags on the others.
- If a track comes out with vocals, add `no vocals, no choir, no singing` to the style.
- Keep each loop between 1:30 and 2:30. The game crossfades when you change screens.

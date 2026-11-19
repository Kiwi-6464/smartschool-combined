# Handover: porting Smartschool Combined to Rust

This note is for the developer who will rewrite parts of the extension in Rust. Read it before touching anything.

## DO NOT TOUCH: `firebase-config.js`

`firebase-config.js` holds the real Firebase project settings. It is **not in this repository on purpose** (it is listed in `.gitignore`); only `firebase-config.example.js` is committed.

- Never edit, regenerate, print, log, copy into a test, or commit the real `firebase-config.js`.
- Never put keys, tokens or the database URL of the real project into new files, fixtures, docs, CI settings or Rust constants. The Rust code must read the same file (or a build-time injected value that the owner provides) and nothing else.
- If you need a config to run tests, copy `firebase-config.example.js` and fill in your own throw-away Firebase project.
- Treat anything in the real file as secret until the owner says otherwise.

## Also not in this repository

- The wallpapers in `assets/themes/*.jpg` are now in the repository (see `NOTICE.md` for their sources; licences are TO VERIFY); audio/cards (`assets/audio`, `assets/cards`).
- The owner's Smartschool user id and display name appear in the code as the "owner" check (`content.js` `ADMIN_IDS` and a name check; `ti84.js` `HOST_USER_IDS`; `database.rules.json`). This is UI only; real authorisation is the database rules plus `/admins/{authUid}` in the database, which the owner edits by hand. Do not move that decision into client code.

## What the project is

A Manifest V3 browser extension (plain JavaScript, no bundler) for the Smartschool web app. It adds themes, a widget start page, the "Islands" hub (arcade games, chess, farm, class league, calculator) and an owner admin board. Everything runs in content scripts on `*.smartschool.be` (and the demo site), with `background.js` as the only part that talks to Firebase.

## Layout (by responsibility)

| Area | Files |
|---|---|
| Entry and loading | `manifest.json`, `content.js` (page hooks, top bar buttons, admin/announce checks), `lazy.js` (lazy modules, `ssc:inject`), `background.js` (service worker) |
| Look | `themes.js`, `themes.css`, `layout.js`, `backdrop.js`, `settings.js`, `settings-window.js` |
| Start page widgets | `widgets.js`, `widget-system.js`, `widget-games.js`, `widget-3d.js` |
| Grades | `preload.js`, `grid-percentages.js`, `cutscene*.js`, `walkout.js`, `tunnel.js`, `fifa-card.js` |
| Hub | `hub.js` (islands, arcade shell, coins), `hub-games.js` (Mines, Plinko, Roulette, Blackjack), `hub-poker.js`, `hub-geometry.js`, `hub-chess.js` + `chess-engine.js` + `chess-bot.js`, `hub-farm.js` + `farm/` |
| Class | `league.js`, `team.js`, `team-nav.js`, `ti84.js` |
| Owner only | `admin.js` (board), `announce.js` (popups for students) |
| Rules and tests | `database.rules.json`, `tests/*.js` (plain node scripts) |

## Message protocol (content script <-> background)

`chrome.runtime.sendMessage({ type: "ssc:..." })`. Handlers live in `background.js`: `ssc:inject`, `ssc:fetchGrades`, `ssc:leagueGet|leagueJoin|leagueSaveWeekend`, `ssc:stateGet|stateSave` (coins, farm, pets, plants), `ssc:calc*`, `ssc:adminSetMatch`, `ssc:announceGet|List|Send|Delete|Seen`. Replies are `{ ok: true, ... }` or `{ ok: false, error }`. Keep these names and shapes; the UI depends on them.

## Data: Firebase Realtime Database over REST

Access goes through `rtdbRequest(method, path[], body)` in `background.js` with an anonymous Firebase Auth token. Nodes: `leagues/{class}/members|matches|calculatorPrograms`, `economies/{userId}` (coins, `adminSetAt`), `farms/{userId}`, `pets`, `pets2`, `plants`, `announcements/{id}` (with `seen/{userId}`), `admins/{authUid}`. Rules and validation are in `database.rules.json` (read it, it is the contract). Local storage keys are listed in `PRIVACY.md`.

## What is worth moving to Rust (and what is not)

A content script must stay JavaScript: only JS can touch the page DOM. The realistic split is **Rust compiled to WebAssembly** for the logic, with thin JS for the DOM:

- Good candidates, already pure (no DOM) and covered by tests: the poker engine (`Table`, `best7`, `sidePots`, `decide` in `hub-poker.js`), the Cube Dash simulation (`step`, `solve` in `hub-geometry.js`), `chess-engine.js` and `chess-bot.js`, the farm rules in `farm/data.js`, the coin/economy sync rules, the percentage and grade maths in `grid-percentages.js`.
- Keep in JS: all rendering, shadow DOM UI, `chrome.*` calls.
- Wasm in an MV3 extension needs `'wasm-unsafe-eval'` in the extension CSP, and content scripts have to fetch the `.wasm` through `chrome.runtime.getURL` (list it in `web_accessible_resources`). Do not download code at run time (store policy).
- Port one module at a time and keep the node tests: run the same cases against the Rust build. A port is done when `tests/*.js` pass unchanged.

## Tests

```
node tests/economy-sync.js
node tests/guess-pack.js
node tests/farm-pens.js
node tests/poker.js
node tests/geometry.js
node tests/chess-perft.js
```

## Known open points (TO VERIFY)

- Database rules: `economies`, `farms`, `pets`, `plants` accept writes from any signed-in user.
- A prepared but unbuilt online poker server: `POKER-SERVER.md`.
- Wallpaper licences: see `NOTICE.md` (each new photo lists author and licence; three older images are unverified).
- The privacy policy has not had legal review.

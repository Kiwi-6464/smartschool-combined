# Privacy policy: Smartschool Combined

Last updated: 2026-11-19. DRAFT written from the extension's source code. This is not legal advice; have it checked before you rely on it.

Smartschool Combined ("the extension") is an unofficial browser extension for Smartschool pages. It is not affiliated with or endorsed by Smartschool. Publisher: Iwert De Dijn. Contact: [CONTACT_EMAIL]

## Short version

- Your grades, settings, theme, coins and farm are kept in your browser (`chrome.storage.local`).
- A small part is also stored online in a Firebase Realtime Database so the class league, the coins and the farm keep working across devices. This is described below.
- No ads, no tracking, no analytics, nothing is sold or shared for marketing.

## What stays in your browser

Stored with `chrome.storage.local` on your device only (see `settings.js`, `hub.js`, `team.js`, `content.js`):

| Data | Key(s) | Why |
|---|---|---|
| Settings, theme, layout, widget choices | `sscSettings`, `sscWidgetData` | Remember how you set it up |
| A copy of your grades | `sscGradesCache` | Show grades and averages quickly |
| Which grades you already saw | `sscSeen`, `sscSeenInitialized` | Play the reveal only for new grades |
| Arcade coins and best scores | `sscArcade`, `sscUserEconomy` | The coin balance and high scores |
| Your team, opponents and league cache | `sscTeam_*`, `sscTeamSquad`, `sscOpponent_*`, `sscBattlePoints_*`, `sscLeague_*` | The Ultimate Team game |
| Class averages | `sscClassAvg` | Card ratings |
| Calculator access and welcome flags | `sscCalculatorAccess`, `sscWelcomeSeen` | Remember a choice |
| Farm game state | farm game keys | Your farm |
| Cube Dash progress (best percentage, cleared levels) and the optional poker server address | `sscGeometry`, `sscPokerServer` | Remember your progress and a server address you typed yourself |
| Which owner messages you already saw | `sscAnnounce_{userId}` (a start time, the last check and the last message seen) | Show each message once |

The extension reads your grades and agenda from the Smartschool page you are already logged in on, using that page's own requests to `/results/api/` and `/planner/api/`. It never sees or stores your Smartschool password.

## What is sent to the internet

1. **Firebase Realtime Database** (Google), project `smartschool-combined-default-rtdb`, host `smartschool-combined-default-rtdb.europe-west1.firebasedatabase.app`. Requests are made by `background.js` after an anonymous Firebase sign-in (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`). The anonymous account has no email or name. What is stored:
   - **League** (`leagues/{class}/members/{userId}`): your Smartschool user id, display name (max 40 characters), class name, your encoded team (card subject and rating derived from your grades, max 8000 characters), a timestamp and the anonymous Firebase id. Classmates in the same league can see this. Join only if you want that.
   - **League matches** (`leagues/{class}/matches/{week}`): weekly match results between teams.
   - **Calculator programs** (`leagues/{class}/calculatorPrograms`): files shared by the person who hosts them.
   - **Coins** (`economies/{userId}`): coin balance, peak and a few counters.
   - **Farm** (`farms/{userId}`): your farm data (one text string, max 60 000 characters) and level.
   - **Pets and plants** (`pets`, `pets2`, `plants`): small records for the pet and plant features.
   - **Messages from the owner** (`announcements/{id}`): a title, a text, a time and either "everyone" or a list of Smartschool user ids. The extension asks for these every few minutes while a Smartschool page is open, with your user id, and shows a popup for messages meant for you. Only the owner of the extension (an admin account in the database) can create or withdraw messages. When a message reaches your extension it writes the time it arrived under `announcements/{id}/seen/{userId}`, so the owner can see who received it. Any signed-in user could technically write such a receipt, so it is a convenience, not proof.
2. **Open-Meteo** (`geocoding-api.open-meteo.com`, `api.open-meteo.com`): only when you use the weather widget. The city you typed is sent to look up its coordinates and the weather. Nothing else is sent.
3. **Links and wallpapers you choose yourself.** If you paste a wallpaper link, your browser loads it from that address.

The database is readable by anyone who knows the paths (the league is open by design). Do not use a real name you do not want classmates to see.

The owner of the extension has an admin board that can read the coins, farm level and league results of the students in a class and can correct coins and match scores. It is used only to keep the games working and fair.

## Legal basis, retention and your rights

- The extension runs because you installed it and use its features. League data is stored because you chose to join.
- Data is kept until you remove it. It is not deleted automatically. [TO VERIFY: confirm whether any clean-up job exists on the Firebase project.]
- To delete local data: remove the extension, or clear its storage in your browser.
- To delete your online data (league member, coins, farm): email [CONTACT_EMAIL] with your display name and class. [TO VERIFY: add an in-extension delete button if you want to offer instant deletion.]
- You can ask what is stored about you and ask for correction or deletion (GDPR, EU/Belgium). Contact: [CONTACT_EMAIL]. You can also complain to the Belgian Data Protection Authority.
- Children: the extension is used by students. Ask your school or parents if you are unsure whether to join the league.

## Security

Transfers use HTTPS. Database rules (`database.rules.json`) require an anonymous sign-in and let only the same anonymous account change a league member. [TO VERIFY: the `economies`, `farms`, `pets` and `plants` nodes accept writes from any signed-in user; see PLAN-4.11.md item 7.]

## Third parties

Google Firebase (storage and anonymous sign-in) and Open-Meteo (weather). No analytics, advertising or tracking services are used.

## Changes

Changes to this policy are listed in `CHANGELOG.md`.


## Arcade games
Poker and Cube Dash run entirely in your browser with play coins; nothing about them is sent anywhere. Poker has an optional "Online" field for a WebSocket address of a server you or the owner run: the extension connects to that address only after you type it in and press the button, and then sends your chosen blinds and your actions to that server. Leave it empty and nothing is ever contacted.

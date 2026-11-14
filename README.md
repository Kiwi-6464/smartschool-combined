<p align="center">
  <img src="assets/icons/icon-128.png" width="96" height="96" alt="Smartschool Combined logo">
</p>

<h1 align="center">Smartschool Combined</h1>

<p align="center">
  The ultimate Smartschool upgrade: themes, a hub with games, Ultimate Team cards built from your grades, a class league, chess and more.<br>
  <b>Free for Microsoft Edge.</b>
</p>

<p align="center">
  <a href="https://microsoftedge.microsoft.com/addons/detail/smartschool-combined/lihijfpblolldifpiokeaohbdfcnmdhe"><b>Get it on Edge Add-ons</b></a>
  &nbsp;·&nbsp; <a href="#nederlands">Nederlands</a>
  &nbsp;·&nbsp; <a href="#english">English</a>
  &nbsp;·&nbsp; <a href="CHANGELOG.md">Changelog</a>
  &nbsp;·&nbsp; <a href="https://ko-fi.com/smartschoolcombined">Support on Ko-fi</a>
</p>

<p align="center">
  <img src="assets/screenshots/hub.webp" alt="The Islands hub" width="860">
</p>

<p align="center">
  <b>Vind je het handig? Steun de ontwikkeling. / Like it? Support development.</b><br>
  <a href="https://ko-fi.com/smartschoolcombined"><img src="https://img.shields.io/badge/Ko--fi-Trakteer%20op%20een%20koffie-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white" alt="Doneer via Ko-fi"></a>
  <a href="https://paypal.me/smartschoolcombined"><img src="https://img.shields.io/badge/PayPal-Doneer-00457C?style=for-the-badge&logo=paypal&logoColor=white" alt="Doneer via PayPal"></a>
</p>

---

## Nederlands

Smartschool Combined is een browserextensie die Smartschool mooier en leuker maakt. Alles draait in je eigen browser, op de Smartschool-pagina zelf. Er is geen apart account nodig.

### Functies

**Uiterlijk**
- Thema's en live achtergronden (donker, licht, bergen, Japan, auto's, ruimte en meer), of een eigen thema met je eigen afbeelding.
- Een vernieuwde inlogpagina in glass-stijl, met de knoppen voor Microsoft en de andere aanmeldopties.
- Een transparante bovenbalk als je dat wilt.
- Widgets en notities op de startpagina.

**Islands, de hub**
Eén scherm met zes eilanden, te openen met de knop "Islands" bovenaan:
- **Arcade**: Snake, 2048, Mines, Plinko, Roulette en Blackjack, met munten en records.
- **School**: snel naar je punten en evaluaties.
- **Stadion**: je Ultimate Team en de klascompetitie.
- **Boerderij**: zaaien, oogsten, bakken en bestellingen leveren.
- **Schaken**: tegen zes bots met klok en analyse na de partij, of samen op één scherm.
- **Rekentoestel**: programma's naar je TI-84 sturen via USB (nu alleen voor de ingestelde klas).

**Cijfers**
- Cijfers onthullen met animaties, zoals een pakje openen.
- Percentages bij de cijfers in het rooster.

**Ultimate Team en competitie**
- Je cijfers worden spelerskaarten. Elk vak is een kaart met een rating.
- Stel je team op in een formatie, open pakketten en bekijk walkout-animaties.
- Speel elk weekend in de klascompetitie tegen je klasgenoten.

<table align="center">
  <tr>
    <td><img src="assets/screenshots/arcade.webp" alt="Arcade" width="400"></td>
    <td><img src="assets/screenshots/team.webp" alt="Ultimate Team" width="400"></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/league.webp" alt="Competitie" width="400"></td>
    <td><img src="assets/screenshots/settings.webp" alt="Thema's" width="400"></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/login.webp" alt="Inlogpagina" width="400"></td>
    <td><img src="assets/screenshots/welcome.webp" alt="Welkom" width="400"></td>
  </tr>
</table>

### Installeren

**Makkelijk (aangeraden):** installeer via [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/smartschool-combined/lihijfpblolldifpiokeaohbdfcnmdhe).

**Handmatig (voor ontwikkelaars):**
1. Download deze repository (groene knop **Code**, dan **Download ZIP**) en pak de zip uit.
2. Open `edge://extensions` in Edge (of `chrome://extensions` in Chrome).
3. Zet **Ontwikkelaarsmodus** aan.
4. Klik op **Uitgepakte extensie laden** en kies de uitgepakte map (de map met `manifest.json`).
5. Open Smartschool en vernieuw de pagina.

Let op: deze broncode bevat geen achtergrondafbeeldingen, geluiden en Firebase-sleutels. De thema's tonen dan geen foto en de competitie werkt pas met je eigen Firebase-project (zie [Zelf bouwen](#zelf-bouwen-fork)). De versie in Edge Add-ons heeft alles.

### Privacy

- Je cijfers en instellingen blijven in je browser (`chrome.storage`).
- Alleen de klascompetitie en de gedeelde rekentoestel-programma's gebruiken een server (Firebase Realtime Database, anoniem aangemeld).
- Als je je inschrijft voor de competitie, komen je naam, je team en je kaarten op die server. Een kaart toont een vak en een rating die uit je cijfer komt, en je klasgenoten in de competitie kunnen die zien. Schrijf je niet in als je dat niet wilt.
- Geen tracking, geen advertenties.

---

## English

Smartschool Combined is a browser extension that makes Smartschool look better and adds fun on top. Everything runs in your own browser, on the Smartschool page itself. No extra account is needed.

### Features

**Look and feel**
- Themes and live wallpapers (dark, light, mountains, Japan, cars, space and more), or a custom theme with your own image.
- A redesigned glass-style login page, keeping the Microsoft button and the other sign-in options.
- An optional transparent top bar.
- Widgets and notes on the start page.

**Islands, the hub**
One screen with six islands, opened from the "Islands" button in the top bar:
- **Arcade**: Snake, 2048, Mines, Plinko, Roulette and Blackjack, with coins and high scores.
- **School**: a shortcut to your grades and evaluations.
- **Stadium**: your Ultimate Team and the class league.
- **Farm**: plant, harvest, bake and deliver orders.
- **Chess**: play six bots with a clock and post-game analysis, or two players on one screen.
- **Calculator**: send programs to your TI-84 over USB (currently limited to one configured class).

**Grades**
- Reveal new grades with animations, like opening a pack.
- Percentages next to grades in the grid.

**Ultimate Team and league**
- Your grades become player cards: every subject is a card with a rating.
- Pick a formation, open packs and watch walkout animations.
- Play your classmates every weekend in the class league.

### Install

**Easy (recommended):** install from [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/smartschool-combined/lihijfpblolldifpiokeaohbdfcnmdhe).

**Manual (for developers):**
1. Download this repository (green **Code** button, then **Download ZIP**) and unzip it.
2. Open `edge://extensions` in Edge (or `chrome://extensions` in Chrome).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped folder (the one with `manifest.json`).
5. Open Smartschool and reload the page.

Note: this source does not include the wallpaper images, the sound effects or any Firebase keys. Themes show no photo, and the league only works with your own Firebase project (see below). The Edge Add-ons version has everything.

### Privacy

- Your grades and settings stay in your browser (`chrome.storage`).
- Only the class league and the shared calculator programs use a server (Firebase Realtime Database, anonymous sign-in).
- If you join the league, your name, team and cards are stored there. A card shows a subject and a rating based on your grade, and classmates in the league can see it. Do not join if you do not want that.
- No tracking, no ads.

---

## Zelf bouwen (fork)

Plain JavaScript, Manifest V3, no build step and no external libraries. The UI lives in a shadow DOM so Smartschool's own CSS cannot break it.

To run the league on your own backend:
1. Create a Firebase project with a **Realtime Database** and turn on **Anonymous** sign-in.
2. Copy `firebase-config.example.js` to `firebase-config.js` and fill in your values. `firebase-config.js` is git-ignored, never commit it.
3. Put your `databaseURL` in `host_permissions` in `manifest.json`.
4. Deploy `database.rules.json` and replace `YOUR_SMARTSCHOOL_USER_ID` with the Smartschool user id that may manage calculator programs.

Without `firebase-config.js` the extension falls back to the example file: everything works except the online parts.

Tests: `node tests/chess-perft.js` and `node tests/chess-bot.js`.

## Credits

- [Smartschool++](https://github.com/sprksoft/smpp) by sprksoft: the settings window, top-bar icons and theme approach are based on it.
- [CijferReveal](https://github.com/js664/CijferReveal) by js664: the card tilt, glare and flip effects of the grade reveal. Licensed under PolyForm Noncommercial 1.0.0.
- Design inspiration (no code copied): [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/), [apple-ui-design](https://github.com/Tamoza4/apple-ui-design), [liquid-glass-component-kit](https://github.com/h0rhay/liquid-glass-component-kit), [glass-aurora-ui](https://github.com/IntMainJhy/glass-aurora-ui), [WindElements](https://github.com/muhammad-fiaz/WindElements), [typeui](https://github.com/bergside/typeui) and [SmarterSmartchool](https://github.com/EbbDrop/SmarterSmartchool).
- 3D island art: models from [Poly Pizza](https://poly.pizza) under CC BY 3.0, see [assets/islands/CREDITS.md](assets/islands/CREDITS.md).
- Farm art: [Kenney](https://kenney.nl) (CC0), see [farm/CREDITS.txt](farm/CREDITS.txt).

Smartschool is a trademark of its owner. This project is not affiliated with or endorsed by Smartschool.

## Steun / Support

Smartschool Combined is en blijft gratis, zonder betaalmuur. Wil je de ontwikkeling steunen? Trakteer op een koffie via [Ko-fi](https://ko-fi.com/smartschoolcombined) of [PayPal](https://paypal.me/smartschoolcombined).
The extension is and stays free. If you want to support development, you can buy me a coffee on [Ko-fi](https://ko-fi.com/smartschoolcombined) or via [PayPal](https://paypal.me/smartschoolcombined).

## License

The original code is MIT licensed, see [LICENSE](LICENSE). Parts based on other projects keep their own terms, see [NOTICE.md](NOTICE.md). Because of the CijferReveal parts, this project as a whole may **not** be used commercially.

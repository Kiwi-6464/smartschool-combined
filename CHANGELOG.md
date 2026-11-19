# Changelog

## 4.11.0
- Unboxing: new "Guess the grade" style (you see the test and its maximum, pick a score, and the closer you are the more coins you get, then the walkout plays) and a "Random" option that picks a different style every time.
- Farm: the order board now asks for your own teachers' names (from your grades; "Leerkracht <name>"), and pens can be upgraded twice (chickens, cows and pigs: 10 and then 20 animals, with a bigger building each time, if there is room). Buildings can be rotated.
- Fix: coins an admin changed in the database no longer revert when you refresh the page (a separate admin timestamp is compared before a device overwrites the server value; database rules updated, deploy them yourself).
- Admin board (a "Beheer" button in the top bar next to Islands, owner account only), styled like the settings window: coins and match results of the class typed straight into boxes, and popup messages to everyone or to chosen students (with preview, confirmation and withdrawing). Students check for new messages every few minutes; database rules updated, deploy them yourself.
- Arcade: two new games. Cube Dash (a rhythm platformer in the style of the classic one-button games, with its own levels, three levels with cube, ship, ball, gravity portals, pads and orbs, practice mode with checkpoints, optional sound; every level is proven beatable by a test) and Texas Hold'em poker against three AI players (side pots, animated table), with a prepared server option for online play.
- Admin board: shows per person whether a message arrived. Buttons now pick a readable text colour on any theme.
- Faster start page: the widgets now start right after the page loads instead of after a 1.5 to 4 second wait for the page to go quiet (about 4.3 s to about 0.6 s in the test page), the panel waits at most 1.2 s, backdrop blur is only used when "Glass" is on (it was permanently on for widgets and list rows), and a looping video wallpaper is paused on machines with 4 cores or 4 GB of memory or less, so Prestatiemodus is no longer needed for a smooth page.
- Faster grades page: the "Resultaten laden" screen and the reveal queue now start right after the page loads instead of after the quiet wait (about 1.3 s to about 0.2 s in the test page), and the grades are fetched from the page first, with the service worker as fallback.
- Guess the grade: the guess screen is opaque (the loading screen no longer shows behind it) and the result note moved to the top so it no longer overlaps the "ga verder" text.
- Readability: theme text is now at least 12:1 against the panels (was 8-10:1), the dimmer secondary text at least 6.8:1 (was about 4.2:1), accent colours at least 4.5:1, and 14 photo themes get a light scrim over the photo where the page text would otherwise land on a bright or dark area.
- Widgets on the start page fill in one by one instead of all at once, so the page appears sooner.
- Themes: the twenty-nine wallpapers the owner downloaded (911, Black Dunes, E30, Cherry Tree, Maple Fuji, Moon, McLaren, Monaco, Neon McLaren, Neon Violet, Gargantua, Blue Aesthetic, GTA VI, Lucia, EA FC 27, macOS Monterey, Surface, Windows 11 Dark, Hello World, Snow Mountains, Windows 11 Blue, Windows 11 Abstract, Apple Glow, Infinity Purple, Pink Abstract, Christmas Tree, Game Art 1-3), Dark Sands, a few colour-only themes (Default Deluxe, Boring white, Fairy Blue) and the fifty original Smartschool++ wallpapers (Alps, Audi, Aurora, Big Sur, Dragon, Ocean, Tokyo and so on). Colours follow each picture; the picker puts each theme in one group only (cars, Japan, space, games, nature, otherwise Dark or Light), sorted by name. A stored choice of a removed theme falls back to the default theme. Several pictures show other companies' logos or a real person; the licences of all wallpapers are TO VERIFY (see NOTICE.md). Removed on request: Indigo, Indigo Licht, Keith, Pizza and Error.
- Guess the grade: the guess screen and the result popup now live in their own shadow root, so the theme stylesheet can no longer turn their text dark on dark; texts are larger and brighter. The result popup is glassy and blurred, disappears by itself after 4.5 s, on a click, and when the reveal closes.
- Light themes: the pencil, gear and Islands icons in the top bar were white on a light bar and are now drawn in the bar's text colour. Widget error messages take a darker or lighter red depending on the theme. Hovered cards no longer scale (scaled cards re-rendered their text soft).
- The head-and-shoulders silhouette on the FIFA cards is gone.
- Edge/Chrome review: the extension also runs on a public demo site with fake data (`demo/`), and there is a privacy policy (PRIVACY.md), a disclaimer and a third-party credits list (NOTICE.md).

## 4.10.0
- Faster grades: the pages of your results load several at a time, and the widgets, the unboxing, the percentages and the team share one request instead of each asking again.
- The class league and the calculator are hidden completely for classes they are not meant for (no tab, no button, no "no access" message). Chess takes the small square, and the calculator becomes the wide bar underneath only when it is available.
- The stadium and calculator islands are back to their original hand-drawn art; the other islands keep the 3D renders.
- Calmer glass in the hub: the white sheen and inner glow are about half as strong in the default theme.

## 4.1.0
- Donate: choose Ko-fi or PayPal; the welcome window shows a calm support block instead of a tiny link.
- Puzzle for coins: new track puzzle (turn the pieces until one track runs from arrow to arrow); the logic puzzles still show up now and then.
- Island art redone as real 3D renders (Blender, CC BY models from Poly Pizza): arcade, school, stadium, farm, chess and calculator.
- Login page: the floating field label no longer overlaps the border or the typed text; the Microsoft, Vlaamse overheid and LeerID buttons show their logos again.
- Dark themes: Blackjack cards, the Mines bomb and the black Roulette pockets are readable again.
- The "Islands" button in the top bar uses the same text size as the other top-bar buttons.
- Full set of extension icons (16, 32, 48 and 128 px).

## 4.0.0
- Premium redesign: glass panels, new typography and a calmer colour system across the hub, settings and games.
- "What is new" window once per version, plus an optional donate link.

## 3.0.0
- Islands hub: one home screen for every feature.
- Arcade with Snake, 2048, Mines, Plinko, Roulette and Blackjack.
- Chess against six bots with clock and post-game analysis, or two players on one screen.
- Farm game.
- 3D widgets.

## 2.0.0
- Class league (online, Firebase) with weekend match days.
- TI-84 calculator programs over USB.
- Smartschool++-style settings window and top-bar buttons.
- Themed login page.
- Heavy features load only when opened.

## 1.0.0
- Ultimate Team: grades become player cards, with formations, packs and walkouts.
- Grade reveal cutscenes and live backgrounds.

## 0.2 / 0.1
- First versions: themes, widgets, grade percentages in the grid and the grade reveal.

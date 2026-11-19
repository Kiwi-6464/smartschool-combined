# Poker server (prepared, not built yet)

The poker table in the Arcade can be driven by your own server. Nothing connects until a player saves a WebSocket address under "Online (eigen server)" and presses "Verbind".

Messages are JSON over a WebSocket (`ws://` or `wss://`).

Client to server
- `{"t":"join","name":"...","buyIn":100,"stake":"1/2"}`
- `{"t":"act","a":"fold"|"check"|"call"|"raise","to":number}`
- `{"t":"leave"}`

Server to client
- `{"t":"state","view":{...}}` where `view` is `{ seats:[{name,stack,bet,folded,allIn,dealer,toAct,me,cards:[{r,s}|null,null],faceUp,win,label,face}], board:[{r,s}], pot, stage, handNo, legal, msg }` (`r` 2..14, `s` 0..3 = ♠♥♦♣)
- `{"t":"error","msg":"..."}`

Rules for the server
- It deals and judges the cards. Never send other players' hole cards before showdown.
- The engine in `hub-poker.js` (`Table`, `best7`, `sidePots`) is plain JavaScript and can be reused in Node.
- Coins are still settled in the browser: when the connection closes the extension returns the buy-in. Decide later how winnings are paid (they should be written by the server, not trusted from a client).
- Browsers on a Smartschool page may block `ws://` to other origins (page security policy); `wss://` to your own host and a `connect-src` check are TO VERIFY once the server exists.

# Random Chess

Chess where every move type is random, with a card system (Barricade, Abracadabra, Bring Me My Legs, Risen from the Dead, Wanderer), a points shop, and online play. English and Turkish.

- **Play the computer**, **two players on one device**, or **online** with invite links.
- **Online:** the server runs the game and rolls the dice. Each player only receives what they're allowed to see (the opponent's cards, hidden mines and respawn spots stay on the server).
- **Players:** choose a name, see who's online, invite them (they get a pop-up to accept), join open games from the lobby. Wins are worth 3 points and draws 1, and there's a leaderboard.
- **Game settings:** cards on/off, timed draw frequency, starting points, point cap, turn timer, random sides, and sudden death: after a set number of full turns each player gets a short clock, so long games always end.
- **Replays:** every finished game gets a shareable replay link (`/#replay-<id>`). Games played in the browser can be shared too.
- Sound effects, animations, a tutorial and the full rule book are built in.

## Run it

You need Node.js 18 or newer.

```
npm install
npm start
```

Open http://localhost:1828. To use another port, set `PORT` (for example `PORT=8080 npm start`).

Games, players and points are saved to `data.json.gz` next to `server.js`, so they survive a restart; replays are saved in `replays/`. Games nobody has touched for 14 days are deleted. A `games.json` from the older version is moved over on the first start.

## Files

- `server.js` serves the page and runs online games over WebSockets at `/ws`.
- `public/shared.js` holds all game rules, including the cards, timers, the computer player and what each player may see. Both the page and the server run it.
- `public/sound.js` makes the sound effects with the Web Audio API (no sound files).
- `public/rulebook.js` is the full rule book in English and Turkish.
- `public/i18n.js` holds all text in English and Turkish.
- `public/index.html` is the board, panels and online play.

## Put it on your domain

Run the server on your machine (it listens on port 1828). Then point your web server at it. The WebSocket upgrade headers are required, or online play won't connect.

### nginx

```nginx
server {
    server_name chess.example.com;

    location / {
        proxy_pass http://127.0.0.1:1828;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

Add HTTPS with `sudo certbot --nginx -d chess.example.com`. The page switches to `wss://` automatically when it's loaded over HTTPS.

### Caddy (HTTPS and WebSockets work automatically)

```
chess.example.com {
    reverse_proxy 127.0.0.1:1828
}
```

## Keep it running

With pm2:

```
npm install -g pm2
pm2 start server.js --name random-chess
pm2 save
pm2 startup
```

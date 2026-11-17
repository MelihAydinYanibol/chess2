# Random Chess

Chess where every move type is random, with a card system (Barricade, Abracadabra, Bring Me My Legs, Risen from the Dead, Wanderer), a points shop, and online games with invite links. The page has English and Turkish; the button in the top panel switches between them.

## Run it

You need Node.js 18 or newer.

```
npm install
npm start
```

Open http://localhost:1828. To use another port, set `PORT` (for example `PORT=8080 npm start`).

Games are saved to `games.json` next to `server.js`, so they survive a restart. Games nobody has touched for 14 days are deleted.

## Files

- `server.js` serves the page and runs online games over WebSockets at `/ws`.
- `public/shared.js` holds all game rules, including the cards. Both the page and the server load it, so the server checks states with the same rules.
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

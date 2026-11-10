# MyTube PWA (iPhone, personal use)
Folders: `web/` = the app, `server/` = backend that also serves `web/`. Run only `server/`.

## Run (needs Node 18+)
cd server && npm install && ACCESS_KEY=pick-a-secret npm start   # http://localhost:3000

## Put it on your iPhone (needs https)
Easiest, free: keep it running on a PC/Mac at home, then in another terminal:
  cloudflared tunnel --url http://localhost:3000
Open the https://….trycloudflare.com address in Safari -> Share -> Add to Home Screen.
Enter your access key on first launch. (The address changes each time you restart the tunnel.)
Home internet is more reliable than a cloud host: YouTube often blocks datacenter IPs.

## If search/playback fails
cd server && npm install youtubei.js@latest   (YouTube changes often; open /api/health, then the terminal log)


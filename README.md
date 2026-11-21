# Clanker Router — deploy guide

## Files
- `index.html` — the whole site (all tabs)
- `clanker-sdk.js` — Clanker SDK + viem, loaded only when someone deploys a token
- `og-image.png` — link preview image
- `api/tokens.js` — backup proxy for the live token list (used automatically if Clanker blocks the browser)
- `api/upload.js` — uploads token images to IPFS (Pinata)

## Deploy on Vercel (free)
1. Put this folder in a GitHub repo (or drag it into vercel.com/new).
2. Import it on Vercel → Deploy. No build settings needed.
3. Image upload: create a free account at pinata.cloud → API Keys → copy the JWT.
   Vercel → Project → Settings → Environment Variables → add `PINATA_JWT` = your JWT → Redeploy.
   (Without it, people can still paste an image link.)
4. In `index.html`, replace `clankerouter.xyz` (og tags + docs) with your domain.

## Optional
- Platform cut: `INTEGRATOR` in `index.html` sends 15% of every launched token's tax to 0xEAE6B9Cd34253850ce3c3Bbb637dAD093E8b4685. Change `share` to adjust (0–100).
- X / Telegram links: search `[HANDLE]` and `[GROUP]` in `index.html`.

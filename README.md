# Clanker Router — deploy guide

## Files
- `index.html` — the whole site (all tabs)
- `clanker-sdk.js` — Clanker SDK + viem, loaded only when someone deploys a token
- `og-image.png` — link preview image
- `api/tokens.js` — backup proxy for the live token list (used automatically if Clanker blocks the browser)

## Deploy on Vercel (free)
1. Put this folder in a GitHub repo (or drag it into vercel.com/new).
2. Import it on Vercel → Deploy. No build settings needed.
4. In `index.html`, replace `clankerouter.xyz` (og tags + docs) with your domain.

## Optional
- Platform cut: `INTEGRATOR` in `index.html` sends 15% of every launched token's tax to 0xEAE6B9Cd34253850ce3c3Bbb637dAD093E8b4685. Change `share` to adjust (0–100).
- X / Telegram links: search `[HANDLE]` and `[GROUP]` in `index.html`.

## WalletConnect (PC users scanning with their phone wallet)
1. Create a free project at https://dashboard.reown.com and copy the Project ID.
2. In the project settings, add your domains (e.g. clankerouter.vercel.app, clankerouter.xyz) to the allowlist.
3. In `index.html`, set `var WC_PROJECT_ID='...'` to your Project ID.
`walletconnect.js` must sit next to `index.html`. Until the ID is set, the WalletConnect option stays hidden.

## Auto-claim platform fees (daily)
`api/claim-fees.js` runs every day at 20:00 UTC (03:00 WIB) via `vercel.json` and claims the platform fees into FEE_WALLET.
1. Make a NEW wallet just for gas. Send it ~$1–2 of ETH on Base.
2. Vercel → Settings → Environment Variables (type: Secret):
   - `GAS_WALLET_KEY` = that wallet's private key (0x…)
   - `CRON_SECRET` = any long random text
3. Redeploy. Test it in Vercel → Settings → Cron Jobs → Run.
It only claims when at least 0.0005 ETH (or 1 USDC) is waiting, so gas isn't wasted.

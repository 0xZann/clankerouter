// Vercel cron: claims Clanker Router's platform fees from Clanker's fee escrow once a day.
// The claim is paid by a small "gas wallet"; the fees always go to FEE_WALLET.
//
// Vercel → Settings → Environment Variables:
//   GAS_WALLET_KEY  (Secret)  private key of a NEW wallet holding a little ETH on Base for gas
//   CRON_SECRET     (Secret)  any long random text — Vercel sends it so only the cron can run this
// Optional: FEE_WALLET, MIN_CLAIM_ETH (default 0.0005), MIN_CLAIM_USDC (default 1), BASE_RPC_URL
import { Clanker } from 'clanker-sdk/v5';
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const FEE_WALLET = process.env.FEE_WALLET || '0xEAE6B9Cd34253850ce3c3Bbb637dAD093E8b4685';
const TOKENS_API = 'https://www.clanker.world/api/tokens';

async function launchedTokens() {
  const p = new URLSearchParams({ chainId: '8453', socialInterface: 'Clanker Router', limit: '20' });
  const r = await fetch(`${TOKENS_API}?${p}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Clanker API ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.data) ? j.data : [];
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let key = (process.env.GAS_WALLET_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(key)) key = '0x' + key;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return res.status(500).json({ error: 'GAS_WALLET_KEY is missing or invalid' });
  }

  const transport = http(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({ chain: base, transport });
  const wallet = createWalletClient({ account, chain: base, transport });
  const clanker = new Clanker({ wallet, publicClient });

  const results = [];
  try {
    const tokens = await launchedTokens();
    const byPair = {};
    for (const t of tokens) {
      const pair = String(t.pair || 'ETH').toUpperCase();
      if (!byPair[pair]) byPair[pair] = t;
    }
    for (const [pair, t] of Object.entries(byPair)) {
      const isUsdc = /USDC/.test(pair);
      const dec = isUsdc ? 6 : 18;
      const min = parseUnits(isUsdc ? (process.env.MIN_CLAIM_USDC || '1') : (process.env.MIN_CLAIM_ETH || '0.0005'), dec);
      try {
        const owed = await clanker.availableRewards({ token: t.contract_address, rewardRecipient: FEE_WALLET });
        const row = { pair, owed: formatUnits(owed, dec) };
        if (owed >= min) {
          const out = await clanker.claimRewards({ token: t.contract_address, rewardRecipient: FEE_WALLET });
          if (out.error) throw out.error;
          row.claimed = true; row.txHash = out.txHash;
        } else {
          row.claimed = false; row.reason = 'below minimum';
        }
        results.push(row);
      } catch (e) {
        results.push({ pair, error: e.shortMessage || e.message || String(e) });
      }
    }
    if (!Object.keys(byPair).length) results.push({ note: 'No tokens launched on Clanker Router yet' });
    const gas = await publicClient.getBalance({ address: account.address });
    return res.status(200).json({ feeWallet: FEE_WALLET, gasWallet: account.address, gasLeftEth: formatUnits(gas, 18), results });
  } catch (e) {
    return res.status(500).json({ error: e.shortMessage || e.message || String(e), results });
  }
}

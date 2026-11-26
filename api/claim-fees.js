// Vercel cron: claims Clanker Router's platform fees from Clanker's fee escrow once a day,
// on every chain the launchpad supports (Base and Robinhood Chain).
// The claim is paid by a small "gas wallet"; the fees always go to FEE_WALLET.
//
// Vercel → Settings → Environment Variables:
//   GAS_WALLET_KEY  (Secret)  private key of a NEW wallet holding a little ETH for gas
//                             (on Base, and on Robinhood Chain once tokens launch there)
//   CRON_SECRET     (Secret)  any long random text — Vercel sends it so only the cron can run this
// Optional: FEE_WALLET, MIN_CLAIM_ETH (default 0.0005), MIN_CLAIM_USDC (default 1),
//           BASE_RPC_URL, ROBINHOOD_RPC_URL
import { Clanker } from 'clanker-sdk/v5';
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const FEE_WALLET = process.env.FEE_WALLET || '0xEAE6B9Cd34253850ce3c3Bbb637dAD093E8b4685';
const TOKENS_API = 'https://www.clanker.world/api/tokens';

const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

const CHAINS = [
  { name: 'Base', chain: base, rpc: process.env.BASE_RPC_URL || 'https://mainnet.base.org' },
  { name: 'Robinhood Chain', chain: robinhood, rpc: process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com' },
];

async function launchedTokens(chainId) {
  const p = new URLSearchParams({ chainId: String(chainId), socialInterface: 'Clanker Router', limit: '20' });
  const r = await fetch(`${TOKENS_API}?${p}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Clanker API ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.data) ? j.data : [];
}

async function claimOnChain(c, account) {
  const transport = http(c.rpc);
  const publicClient = createPublicClient({ chain: c.chain, transport });
  const wallet = createWalletClient({ account, chain: c.chain, transport });
  const clanker = new Clanker({ wallet, publicClient });
  const out = { chain: c.name, results: [] };

  const tokens = await launchedTokens(c.chain.id);
  const byPair = {};
  for (const t of tokens) {
    const pair = String(t.pair || 'ETH').toUpperCase();
    if (!byPair[pair]) byPair[pair] = t;
  }
  if (!Object.keys(byPair).length) {
    out.results.push({ note: 'No tokens launched here yet' });
    return out;
  }
  for (const [pair, t] of Object.entries(byPair)) {
    const isUsdc = /USDC/.test(pair);
    const dec = isUsdc ? 6 : 18;
    const min = parseUnits(isUsdc ? (process.env.MIN_CLAIM_USDC || '1') : (process.env.MIN_CLAIM_ETH || '0.0005'), dec);
    try {
      const owed = await clanker.availableRewards({ token: t.contract_address, rewardRecipient: FEE_WALLET });
      const row = { pair, owed: formatUnits(owed, dec) };
      if (owed >= min) {
        const tx = await clanker.claimRewards({ token: t.contract_address, rewardRecipient: FEE_WALLET });
        if (tx.error) throw tx.error;
        row.claimed = true; row.txHash = tx.txHash;
      } else {
        row.claimed = false; row.reason = 'below minimum';
      }
      out.results.push(row);
    } catch (e) {
      out.results.push({ pair, error: e.shortMessage || e.message || String(e) });
    }
  }
  const gas = await publicClient.getBalance({ address: account.address });
  out.gasLeftEth = formatUnits(gas, 18);
  return out;
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
  const account = privateKeyToAccount(key);

  // one chain failing (no gas, RPC down) never stops the others
  const chains = [];
  for (const c of CHAINS) {
    try {
      chains.push(await claimOnChain(c, account));
    } catch (e) {
      chains.push({ chain: c.name, error: e.shortMessage || e.message || String(e) });
    }
  }
  return res.status(200).json({ feeWallet: FEE_WALLET, gasWallet: account.address, chains });
}

// Shared: look a token up on every chain Clanker Router supports.
const API = 'https://www.clanker.world/api/tokens';
export const CHAINS = [
  { key: 'base', id: 8453, name: 'Base' },
  { key: 'robinhood', id: 4663, name: 'Robinhood Chain' },
];

export async function withTimeout(p, ms) {
  let t; const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); });
  try { return await Promise.race([p, timer]); } finally { clearTimeout(t); }
}
// Tokens launched outside Clanker (keep in sync with EXTERNAL_TOKENS in index.html)
const EXTERNAL = {
  '0x96723d7e7e468c8a38d160873021c7c35d10bb7b': { contract_address: '0x96723d7e7e468c8a38d160873021c7c35d10bb7b', name: 'Clanker Router', symbol: 'CLRTR', img_url: 'https://www.clankerouter.xyz/logo.png', description: 'The official token of Clanker Router, launched on Pons on Robinhood Chain.', related: { market: {} }, chain: 'robinhood' },
};

export async function findToken(addr) {
  if (EXTERNAL[addr]) { const e = EXTERNAL[addr]; return { ...e, _chain: CHAINS.find((c) => c.key === e.chain) }; }
  const hits = await Promise.all(CHAINS.map(async (c) => {
    try {
      const p = new URLSearchParams({ chainId: String(c.id), q: addr, limit: '1', includeMarket: 'true' });
      const r = await withTimeout(fetch(`${API}?${p}`, { headers: { accept: 'application/json' } }), 4000);
      if (!r.ok) return null;
      const j = await r.json();
      const t = (j.data || []).find((x) => String(x.contract_address || '').toLowerCase() === addr);
      return t ? { ...t, _chain: c } : null;
    } catch { return null; }
  }));
  return hits.find(Boolean) || null;
}

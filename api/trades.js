// Live buys & sells for a token, from GeckoTerminal's free public API.
// GET /api/trades?chain=base|robinhood&addr=0x…
// Returns the token's main pool, 24h buy/sell counts and volume, and the latest trades.
export const config = { runtime: 'edge' };

const GT = 'https://api.geckoterminal.com/api/v2';
const NET = { base: 'base', robinhood: 'robinhood' };
const HEAD = { accept: 'application/json;version=20230302' };

function json(body, status = 200, cache = 's-maxage=10, stale-while-revalidate=30') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=0, ${cache}`, 'access-control-allow-origin': '*' },
  });
}
async function get(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { headers: HEAD, signal: ctl.signal });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GeckoTerminal ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const lc = (s) => String(s || '').toLowerCase();

export default async function handler(req) {
  const u = new URL(req.url);
  const net = NET[u.searchParams.get('chain')] || 'base';
  const addr = lc(u.searchParams.get('addr'));
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return json({ error: 'Bad address' }, 400, 's-maxage=0');
  try {
    const pools = await get(`${GT}/networks/${net}/tokens/${addr}/pools?page=1`);
    const list = (pools && pools.data) || [];
    if (!list.length) return json({ pool: null, h24: { buys: 0, sells: 0, volume: 0 }, trades: [] });
    // the busiest pool is the one Clanker created at launch
    list.sort((a, b) => num(b.attributes.volume_usd && b.attributes.volume_usd.h24) - num(a.attributes.volume_usd && a.attributes.volume_usd.h24));
    const p = list[0], a = p.attributes || {};
    const tx = (a.transactions && a.transactions.h24) || {};
    const tr = await get(`${GT}/networks/${net}/pools/${a.address}/trades`);
    const trades = ((tr && tr.data) || []).slice(0, 40).map((t) => {
      const x = t.attributes || {};
      // decide buy/sell from OUR token's side, not the pool's base token
      const side = lc(x.to_token_address) === addr ? 'buy' : lc(x.from_token_address) === addr ? 'sell' : x.kind;
      const amount = side === 'buy' ? num(x.to_token_amount) : num(x.from_token_amount);
      return { side, usd: num(x.volume_in_usd), amount, wallet: x.tx_from_address || '', tx: x.tx_hash || '', at: x.block_timestamp || '' };
    });
    return json({
      pool: a.address, dex: p.relationships && p.relationships.dex && p.relationships.dex.data && p.relationships.dex.data.id,
      priceUsd: num(lc((p.relationships && p.relationships.base_token && p.relationships.base_token.data && p.relationships.base_token.data.id) || '').endsWith(addr) ? a.base_token_price_usd : a.quote_token_price_usd),
      h24: { buys: tx.buys || 0, sells: tx.sells || 0, buyers: tx.buyers || 0, sellers: tx.sellers || 0, volume: num(a.volume_usd && a.volume_usd.h24) },
      trades,
    });
  } catch (e) {
    return json({ error: e.message || 'Trades unavailable' }, 502, 's-maxage=5');
  }
}

// Read-only RPC relay for the browser: /api/rpc?chain=base|robinhood
// Some chains' public RPCs block calls made straight from a web page (CORS),
// so the site sends its reads here and this server forwards them.
// Writes never pass through here: transactions are signed and sent by the user's wallet.
export const config = { runtime: 'edge' };

const UPSTREAM = {
  base: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
  robinhood: ['https://rpc.mainnet.chain.robinhood.com'],
};
const ALLOWED = new Set([
  'eth_chainId', 'net_version', 'eth_blockNumber', 'eth_call', 'eth_estimateGas', 'eth_gasPrice',
  'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getBalance', 'eth_getCode', 'eth_getStorageAt',
  'eth_getTransactionCount', 'eth_getTransactionByHash', 'eth_getTransactionReceipt',
  'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getLogs',
]);
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const chain = new URL(req.url).searchParams.get('chain');
  const ups = UPSTREAM[chain];
  if (!ups) return reply({ error: 'Unknown chain' }, 400);
  let body;
  try { body = await req.json(); } catch { return reply({ error: 'Bad JSON' }, 400); }
  const calls = Array.isArray(body) ? body : [body];
  if (!calls.length || calls.length > 20 || calls.some((c) => !c || !ALLOWED.has(c.method))) {
    return reply({ jsonrpc: '2.0', id: (calls[0] && calls[0].id) || null, error: { code: -32601, message: 'Method not allowed here' } }, 400);
  }
  let last = null;
  for (const url of ups) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) { last = `upstream ${r.status}`; continue; }
      return new Response(await r.text(), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
    } catch (e) { last = e.message; }
  }
  return reply({ jsonrpc: '2.0', id: calls[0].id || null, error: { code: -32603, message: `RPC unavailable (${last})` } }, 502);
}

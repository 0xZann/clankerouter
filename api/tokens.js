// Vercel serverless function: GET /api/tokens?… → forwards to Clanker's public token API.
// Used automatically by index.html if the browser can't call Clanker directly (CORS).
const UPSTREAM = 'https://www.clanker.world/api/tokens';
const ALLOWED = new Set(['q','sort','sortBy','cursor','limit','offset','chainId','includeMarket','includeUser','pair','type','startDate','champagne','fid','fids','msgSender','socialInterface']);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (ALLOWED.has(k) && typeof v === 'string' && v.length <= 200) params.set(k, v);
  }
  try {
    const r = await fetch(`${UPSTREAM}?${params}`, { headers: { accept: 'application/json' } });
    const body = await r.text();
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 's-maxage=3, stale-while-revalidate=10');
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: 'Upstream unavailable' });
  }
}

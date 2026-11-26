// Serves the site for /token/0x… with that token's name, description and share image
// in the <head>, so links shared on X / Telegram / Discord show the token itself.
// The page itself is the normal index.html; only the meta tags change.
import { findToken } from './_lib/tokens.js';

export const config = { runtime: 'edge' };

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  return re.test(html) ? html.replace(re, `$1${esc(value)}$2`) : html.replace('</head>', `<meta ${attr}="${key}" content="${esc(value)}">\n</head>`);
}

export default async function handler(req) {
  const u = new URL(req.url);
  const origin = `${u.protocol}//${u.host}`;
  const addr = String(u.searchParams.get('addr') || '').toLowerCase();
  const pageRes = await fetch(`${origin}/index.html`);
  let html = await pageRes.text();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const t = await findToken(addr);
  const url = `${origin}/token/${addr}`;
  const image = `${origin}/api/og?addr=${addr}`;
  const title = t ? `${t.name} ($${t.symbol}) · Clanker Router` : 'Token · Clanker Router';
  const chain = t ? t._chain.name : 'Base';
  const desc = t
    ? (String((t.description || (t.metadata && t.metadata.description) || '')).trim().slice(0, 160) ||
       `$${t.symbol} on ${chain}. Buy on Uniswap, see live market cap and volume, and claim holder rewards on Clanker Router.`)
    : 'Launch and trade tokens on Base and Robinhood Chain with Clanker Router.';

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = setMeta(html, 'name', 'description', desc);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', desc);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:image', image);
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', desc);
  html = setMeta(html, 'name', 'twitter:image', image);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}

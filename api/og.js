// Share image for a token page: /api/og?addr=0x…  (1200×630 PNG)
// X, Telegram and Discord show this when someone shares clankerouter.xyz/token/0x…
import { ImageResponse } from '@vercel/og';
import { CHAINS, findToken, withTimeout } from './_lib/tokens.js';

// Runs on the Node.js runtime: the Edge runtime blocks the WebAssembly this renderer needs.

const C = { bg: '#0A0A0C', panel: '#17141F', line: '#2E2840', purple: '#9B6BFF', white: '#F4F4F6', muted: '#9A97A6', green: '#4ADE80', red: '#FF6B5E' };

// tiny element helper so this file needs no JSX build step
function h(type, style, ...children) {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
}
function img(src, style) { return { type: 'img', props: { src, style } }; }

function toDataUrl(buf, type) {
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}
async function tokenImage(url) {
  if (!url) return null;
  url = String(url).replace(/^ipfs:\/\//, 'https://ipfs.io/ipfs/');
  if (!/^https:\/\//.test(url)) return null;
  try {
    const r = await withTimeout(fetch(url), 3500);
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!r.ok || !/^image\/(png|jpe?g|gif)$/.test(type)) return null; // the renderer can't draw webp/svg
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 1.5 * 1024 * 1024) return null;
    return toDataUrl(buf, type);
  } catch { return null; }
}
function money(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(n < 1 ? 4 : 0);
}
function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function fontOpt(list) {
  const ok = list.filter((f) => f.data);
  return ok.length ? { fonts: ok } : {};
}

export async function GET(req) {
  const u = new URL(req.url);
  const addr = String(u.searchParams.get('addr') || '').toLowerCase();
  const origin = `${u.protocol}//${u.host}`;
  // a missing font never breaks the image: it just falls back to the built-in font
  const font = (f) => fetch(`${origin}/fonts/${f}`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  const [unb, i5, i7, mono, t] = await Promise.all([
    font('unbounded-800.ttf'), font('inter-500.ttf'), font('inter-700.ttf'), font('mono-500.ttf'),
    /^0x[0-9a-f]{40}$/.test(addr) ? findToken(addr) : Promise.resolve(null),
  ]);
  // fetch every picture ourselves so a slow or odd image can never break the render
  const [pic, logo, rh] = await Promise.all([t ? tokenImage(t.img_url) : null, tokenImage(`${origin}/logo.png`), tokenImage(`${origin}/robinhood.png`)]);
  const chain = t ? t._chain : CHAINS[0];
  const m = (t && t.related && t.related.market) || {};
  const ch = m.priceChangePercent24h;
  const name = t ? clip(t.name || 'Unnamed', 22) : 'Token not found';
  const nameSize = name.length > 16 ? 58 : name.length > 11 ? 70 : 84;
  const letter = ((t && (t.symbol || t.name)) || '?').charAt(0).toUpperCase();

  const build = (im) => {
    const chainPill = h('div', { alignItems: 'center', gap: 12, padding: '10px 20px', borderRadius: 999, border: `2px solid ${C.line}`, background: '#121018', fontFamily: 'Inter', fontWeight: 500, fontSize: 26, color: '#fff' },
      chain.key === 'robinhood'
        ? (im.rh ? img(im.rh, { width: 30, height: 30, borderRadius: 7 }) : h('div', { width: 28, height: 28, background: '#CCFF00', borderRadius: 7 }))
        : h('div', { width: 26, height: 26, background: '#0000FF', borderRadius: 3 }),
      chain.name);
    const stat = (label, value, color) => h('div', { flexDirection: 'column', gap: 8, padding: '18px 24px', borderRadius: 20, background: C.panel, border: `2px solid ${C.line}`, minWidth: 220 },
      h('div', { fontFamily: 'Mono', fontSize: 18, letterSpacing: 1, color: C.muted }, label),
      h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 42, letterSpacing: -1, color: color || C.white }, value));

    return h('div', { width: 1200, height: 630, background: C.bg, position: 'relative', flexDirection: 'column', padding: '56px 64px', fontFamily: 'Inter', color: C.white },
      h('div', { position: 'absolute', right: -170, top: -210, width: 560, height: 560, borderRadius: 999, border: `44px solid #2D2540` }),
      // brand
      h('div', { alignItems: 'center', gap: 16 },
        (im.logo ? img(im.logo, { width: 52, height: 52, borderRadius: 14 }) : h('div', { width: 52, height: 52, borderRadius: 14, background: C.purple })),
        h('div', { fontFamily: 'Unbounded', fontSize: 28, letterSpacing: -0.5 }, 'CLANKER ROUTER')),
      // token
      h('div', { alignItems: 'center', gap: 40, marginTop: 52 },
        im.pic
          ? img(im.pic, { width: 200, height: 200, borderRadius: 48, objectFit: 'cover' })
          : h('div', { width: 200, height: 200, borderRadius: 48, background: C.purple, alignItems: 'center', justifyContent: 'center', fontFamily: 'Unbounded', fontSize: 96, color: C.bg }, letter),
        h('div', { flexDirection: 'column', gap: 14, maxWidth: 760 },
          h('div', { fontFamily: 'Unbounded', fontSize: nameSize, lineHeight: 1.05, letterSpacing: -2 }, name),
          h('div', { alignItems: 'center', gap: 22 },
            t ? h('div', { fontFamily: 'Mono', fontSize: 36, color: '#B79BFF' }, '$' + clip(t.symbol, 12)) : null,
            t ? chainPill : null))),
      // stats
      t ? h('div', { gap: 16, marginTop: 'auto' },
        stat('MARKET CAP', money(m.marketCap)),
        stat('VOLUME 24H', money(m.volume24h)),
        stat('24H', typeof ch === 'number' ? (ch > 0 ? '+' : '') + ch.toFixed(1) + '%' : '—', typeof ch === 'number' ? (ch > 0 ? C.green : ch < 0 ? C.red : null) : null),
        h('div', { marginLeft: 'auto', alignSelf: 'flex-end', alignItems: 'center', padding: '20px 34px', borderRadius: 999, background: C.purple, color: C.bg, fontFamily: 'Unbounded', fontSize: 28 }, 'BUY NOW'))
        : h('div', { marginTop: 'auto', fontFamily: 'Mono', fontSize: 26, color: C.muted }, 'clankerouter.xyz'));

  };
  const opts = {
    width: 1200, height: 630,
    ...fontOpt([
      { name: 'Unbounded', data: unb, weight: 800, style: 'normal' },
      { name: 'Inter', data: i5, weight: 500, style: 'normal' },
      { name: 'Inter', data: i7, weight: 700, style: 'normal' },
      { name: 'Mono', data: mono, weight: 500, style: 'normal' },
    ]),
  };
  // Render fully before answering: if something fails, try again with fewer pictures
  // instead of sending a blank page.
  const tries = [{ pic, logo, rh }, { pic: null, logo, rh }, { pic: null, logo: null, rh: null }];
  let lastErr = null;
  for (const im of tries) {
    try {
      const buf = await new ImageResponse(build(im), opts).arrayBuffer();
      if (buf.byteLength < 1000) throw new Error('empty image');
      return new Response(buf, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' } });
    } catch (e) { lastErr = e; }
  }
  return new Response('Share image failed: ' + ((lastErr && lastErr.message) || 'unknown error'), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

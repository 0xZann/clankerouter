// Vercel serverless function: POST /api/upload (raw image body) → pins to IPFS via Pinata, returns { url: "ipfs://CID" }.
// Setup: Vercel → Settings → Environment Variables → PINATA_JWT (Pinata → API Keys → JWT, with Files: Write).
export const config = { api: { bodyParser: false } };

const MAX = 2 * 1024 * 1024;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX) throw new Error('too_big'); chunks.push(c); }
  return Buffer.concat(chunks);
}

function hint(status) {
  if (status === 401) return 'Pinata rejected the key (401). Check PINATA_JWT in Vercel and redeploy.';
  if (status === 403) return 'Pinata key has no upload permission (403). Make a key with Files: Write.';
  if (status === 429) return 'Pinata rate limit reached (429). Try again in a minute.';
  return `Pinata error ${status}.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const jwt = (process.env.PINATA_JWT || '').trim().replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(500).json({ error: 'PINATA_JWT is not set in Vercel. Paste an image link instead.' });
  const type = (req.headers['content-type'] || '').split(';')[0];
  if (!TYPES.has(type)) return res.status(415).json({ error: 'Use a PNG, JPG, GIF or WEBP image.' });
  let buf;
  try { buf = await readBody(req); } catch { return res.status(413).json({ error: 'Image must be 2 MB or smaller.' }); }
  const name = decodeURIComponent(req.headers['x-filename'] || 'token-image').slice(0, 80) || 'token-image';

  // 1) Pinata v3 Files API (scoped keys from the new dashboard)
  let lastStatus = 0;
  try {
    const form = new FormData();
    form.append('file', new Blob([buf], { type }), name);
    form.append('network', 'public');
    form.append('name', name);
    const r = await fetch('https://uploads.pinata.cloud/v3/files', { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form });
    lastStatus = r.status;
    const j = await r.json().catch(() => ({}));
    const cid = j && j.data && j.data.cid;
    if (r.ok && cid) return res.status(200).json({ url: `ipfs://${cid}` });
  } catch (e) { /* fall through */ }

  // 2) Legacy pinning API (older keys)
  try {
    const form = new FormData();
    form.append('file', new Blob([buf], { type }), name);
    const r = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.IpfsHash) return res.status(200).json({ url: `ipfs://${j.IpfsHash}` });
    lastStatus = lastStatus && lastStatus !== 200 ? lastStatus : r.status;
  } catch (e) { /* fall through */ }

  return res.status(502).json({ error: `Image upload failed — ${hint(lastStatus)} You can paste an image link instead.` });
}

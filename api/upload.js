// Vercel serverless function: POST /api/upload (raw image body) → pins to IPFS via Pinata, returns { url: "ipfs://CID" }.
// Setup: in Vercel → Project → Settings → Environment Variables, add PINATA_JWT (from pinata.cloud → API Keys).
export const config = { api: { bodyParser: false } };

const MAX = 2 * 1024 * 1024;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX) throw new Error('too_big'); chunks.push(c); }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.PINATA_JWT) return res.status(500).json({ error: 'Image upload is not set up yet. Paste an image link instead.' });
  const type = (req.headers['content-type'] || '').split(';')[0];
  if (!TYPES.has(type)) return res.status(415).json({ error: 'Use a PNG, JPG, GIF or WEBP image.' });
  let buf;
  try { buf = await readBody(req); } catch { return res.status(413).json({ error: 'Image must be 2 MB or smaller.' }); }
  const name = decodeURIComponent(req.headers['x-filename'] || 'token-image').slice(0, 80);
  const form = new FormData();
  form.append('file', new Blob([buf], { type }), name);
  form.append('network', 'public');
  try {
    const r = await fetch('https://uploads.pinata.cloud/v3/files', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` }, body: form,
    });
    const j = await r.json();
    const cid = j && j.data && j.data.cid;
    if (!r.ok || !cid) return res.status(502).json({ error: 'Upload to IPFS failed. Try again or paste an image link.' });
    return res.status(200).json({ url: `ipfs://${cid}` });
  } catch {
    return res.status(502).json({ error: 'Upload to IPFS failed. Try again or paste an image link.' });
  }
}

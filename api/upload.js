// Vercel serverless function: POST /api/upload (raw image body) → stores it in Vercel Blob, returns { url }.
// Setup (no extra account): Vercel → Storage → Create → Blob → connect it to this project → Redeploy.
// Vercel adds BLOB_READ_WRITE_TOKEN automatically.
import { put } from '@vercel/blob';
export const config = { api: { bodyParser: false } };

const MAX = 2 * 1024 * 1024;
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX) throw new Error('too_big'); chunks.push(c); }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: 'Image storage is not connected yet (Vercel → Storage → Blob).' });
  const type = (req.headers['content-type'] || '').split(';')[0];
  const ext = TYPES[type];
  if (!ext) return res.status(415).json({ error: 'Use a PNG, JPG, GIF or WEBP image.' });
  let buf;
  try { buf = await readBody(req); } catch { return res.status(413).json({ error: 'Image must be 2 MB or smaller.' }); }
  try {
    const blob = await put(`tokens/image.${ext}`, buf, { access: 'public', contentType: type, addRandomSuffix: true });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    return res.status(502).json({ error: 'Image upload failed: ' + (e.message || 'storage error') + '. Try again.' });
  }
}

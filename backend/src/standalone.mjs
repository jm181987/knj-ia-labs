import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

async function serveFile(res, file, cache = false) {
  const data = await fs.readFile(file);
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': String(data.length),
    'Cache-Control': cache ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(data);
}

async function serveFrontend(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { pathname = '/'; }
  const clean = path.normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/, '');
  const candidate = path.join(dist, clean);
  if (candidate.startsWith(dist) && clean && !clean.endsWith('/')) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return serveFile(res, candidate, pathname.startsWith('/assets/') || /\.[a-f0-9]{8,}\./i.test(pathname));
    } catch { /* SPA fallback */ }
  }
  return serveFile(res, path.join(dist, 'index.html'));
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) return handler(req, res);
    return await serveFrontend(req, res);
  } catch (error) {
    console.error('[standalone]', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => console.log(`[knj-ia-labs] listening on :${port}`));

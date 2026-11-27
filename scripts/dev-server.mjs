// Zero-dependency static server with live reload for local development.
// Usage: node scripts/dev-server.mjs [port]   (default 8000)
// Watches the repository and tells connected pages to reload via Server-Sent Events.
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {watch} from 'node:fs';
import {extname, join, normalize, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8000);
const types = {'.html':'text/html; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json', '.md':'text/plain; charset=utf-8'};
const clients = new Set();
const snippet = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'), path = decodeURIComponent(url.pathname);
  if (path === '/__reload') {
    res.writeHead(200, {'content-type':'text/event-stream', 'cache-control':'no-cache', connection:'keep-alive'});
    res.write(': connected\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  const file = normalize(join(root, path.endsWith('/') ? path + 'index.html' : path));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    let body = await readFile(file);
    // ?noreload skips the live-reload hook (headless screenshots wait for network idle).
    if (extname(file) === '.html' && !url.searchParams.has('noreload')) body = body.toString().replace('</html>', snippet + '</html>');
    res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control':'no-store'}).end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Dev server: http://localhost:${port}/ (live reload on)`));

let timer;
watch(root, {recursive:true}, (_, name) => {
  if (!name || name.startsWith('.git') || name.includes('node_modules')) return;
  clearTimeout(timer);
  timer = setTimeout(() => { for (const c of clients) c.write('data: reload\n\n'); console.log('changed:', name); }, 80);
});

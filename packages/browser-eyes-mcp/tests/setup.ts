import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let server: Server | null = null;
let baseUrl = '';

const PAGES_DIR = join(__dirname, 'fixtures', 'pages');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function getContentType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return MIME[ext] || 'application/octet-stream';
}

function requestHandler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://localhost`);
  let filePath = join(PAGES_DIR, url.pathname);

  if (url.pathname === '/' || url.pathname === '') {
    filePath = join(PAGES_DIR, 'blank.html');
  }

  // Simulate slow response
  if (url.pathname === '/api/slow') {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }, 2000);
    return;
  }

  // Simulate 500 error
  if (url.pathname === '/api/fail') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
    return;
  }

  // Simulate 302 redirect
  if (url.pathname === '/old-path') {
    res.writeHead(302, { Location: '/new-path' });
    res.end();
    return;
  }

  // Simulate auth redirect
  if (url.pathname === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Login Page</body></html>');
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const content = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': getContentType(filePath) });
  res.end(content);
}

export async function startFixtureServer(port = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    server = createServer(requestHandler);
    server.listen(port, () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://localhost:${addr.port}`;
        resolve(baseUrl);
      } else {
        reject(new Error('Failed to get server address'));
      }
    });
    server.on('error', reject);
  });
}

export async function stopFixtureServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        baseUrl = '';
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function getFixtureUrl(path: string): string {
  if (!baseUrl) throw new Error('Fixture server not started');
  return `${baseUrl}${path}`;
}

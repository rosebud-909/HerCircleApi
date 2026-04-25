/**
 * Ensures postman.json includes every Express route (and warns on extra Postman-only routes).
 * Run: npm run postman:check
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const ROUTER_METHOD_RE =
  /router\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]/g;
const APP_GET_RE = /app\.get\(\s*['"]([^'"]+)['"]/g;

const V1_MOUNTS = [
  { mount: '/auth', file: 'routes/auth.routes.js' },
  { mount: '/users', file: 'routes/users.routes.js' },
  { mount: '/verification', file: 'routes/verification.routes.js' },
  { mount: '/requests', file: 'routes/requests.routes.js' },
  { mount: '/chats', file: 'routes/chats.routes.js' },
  { mount: '/community', file: 'routes/community.routes.js' },
  { mount: '/sos', file: 'routes/sos.routes.js' },
];

function parseRouterRoutes(filePath) {
  const src = readFileSync(join(root, filePath), 'utf8');
  const out = [];
  let m;
  while ((m = ROUTER_METHOD_RE.exec(src)) !== null) {
    out.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return out;
}

function parseAppGetPaths(filePath) {
  const src = readFileSync(join(root, filePath), 'utf8');
  const paths = [];
  let m;
  while ((m = APP_GET_RE.exec(src)) !== null) paths.push(m[1]);
  return paths;
}

function normalizePathForCompare(path) {
  return path
    .split('/')
    .map((seg) => {
      if (!seg) return '';
      if (seg.startsWith('{{') && seg.endsWith('}}')) return ':param';
      if (seg.startsWith(':')) return ':param';
      return seg;
    })
    .join('/');
}

function expectedApiRoutes() {
  const keys = new Set();
  for (const p of parseAppGetPaths('app.js')) {
    keys.add(`GET ${normalizePathForCompare(p)}`);
  }
  for (const { mount, file } of V1_MOUNTS) {
    for (const { method, path: suffix } of parseRouterRoutes(file)) {
      const full = `/api/v1${mount}${suffix === '/' ? '' : suffix}`;
      keys.add(`${method} ${normalizePathForCompare(full)}`);
    }
  }
  return keys;
}

function* walkPostmanItems(items) {
  if (!items) return;
  for (const item of items) {
    if (item.request) yield item;
    if (item.item) yield* walkPostmanItems(item.item);
  }
}

function rawUrlToPathname(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  const q = s.indexOf('?');
  if (q !== -1) s = s.slice(0, q);
  s = s.replace(/^\{\{baseUrl\}\}/, '');
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      s = new URL(s).pathname;
    } catch {
      return null;
    }
  }
  if (!s.startsWith('/')) s = `/${s}`;
  return s;
}

function postmanUrlToPathname(url) {
  if (typeof url === 'string') return rawUrlToPathname(url);
  if (url && typeof url === 'object') {
    if (url.raw) return rawUrlToPathname(url.raw);
    if (Array.isArray(url.path)) {
      const joined = '/' + url.path.filter(Boolean).join('/');
      return rawUrlToPathname(joined.replace(/^\{\{baseUrl\}\}\/?/, '/'));
    }
  }
  return null;
}

function collectPostmanApiRoutes(collection) {
  const keys = new Set();
  for (const item of walkPostmanItems(collection.item)) {
    const req = item.request;
    if (!req?.method) continue;
    const raw =
      typeof req.url === 'string' ? req.url : req.url?.raw ?? '';
    if (
      raw.includes('identitytoolkit.googleapis.com') ||
      raw.includes('googleapis.com/v1/accounts')
    ) {
      continue;
    }
    const pathname = postmanUrlToPathname(req.url);
    if (!pathname) continue;
    if (pathname !== '/health' && !pathname.startsWith('/api/v1')) continue;
    keys.add(`${req.method} ${normalizePathForCompare(pathname)}`);
  }
  return keys;
}

function main() {
  const collection = JSON.parse(readFileSync(join(root, 'postman.json'), 'utf8'));
  const expected = expectedApiRoutes();
  const inPostman = collectPostmanApiRoutes(collection);

  const missing = [...expected].filter((k) => !inPostman.has(k)).sort();
  const extra = [...inPostman].filter((k) => !expected.has(k)).sort();

  if (missing.length === 0 && extra.length === 0) {
    console.log(
      `postman:check ok (${expected.size} API routes match postman.json).`,
    );
    process.exit(0);
  }

  if (missing.length) {
    console.error('postman.json is missing requests for these routes:');
    for (const line of missing) console.error(`  - ${line}`);
  }
  if (extra.length) {
    console.error(
      'postman.json has API requests with no matching Express route (update script mounts or remove stale requests):',
    );
    for (const line of extra) console.error(`  - ${line}`);
  }
  process.exit(1);
}

main();

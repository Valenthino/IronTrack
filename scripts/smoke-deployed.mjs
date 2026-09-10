// Read-only HTTP smoke check. Node 22+, no dependencies or browser profile needed.
import assert from 'node:assert/strict';

try {
  const base = new URL(process.argv[2] ?? '');
  assert(['http:', 'https:'].includes(base.protocol), 'Use an HTTP(S) URL');
  assert(!base.username && !base.password, 'Do not include credentials in the URL');
  assert(base.pathname === '/' && !base.search && !base.hash, 'Use the root deployment URL');
  const get = async (path) => {
    const response = await fetch(new URL(path, base), {
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    assert.equal(response.status, 200, `${path}: expected HTTP 200`);
    return response;
  };
  const health = await get('/health.json');
  assert.match(health.headers.get('content-type') ?? '', /application\/json/);
  assert.deepEqual(await health.json(), { status: 'ok', app: 'irontrack' });
  let home;
  for (const path of ['/', '/auth', '/onboarding', '/history', '/settings']) {
    const response = await get(path);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/, `${path}: HTML required`);
    const html = await response.text();
    assert.match(html, /<html[\s>]/i, `${path}: HTML document required`);
    assert.match(html, /<script\b[^>]*src=/i, `${path}: application script required`);
    if (path === '/') home = html;
  }
  const scripts = [...home.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)];
  assert(scripts.length > 0, 'No application bundles found');
  for (const [, src] of scripts) {
    const asset = new URL(src, base);
    assert.equal(asset.origin, base.origin, 'Expected same-origin application bundle');
    const response = await get(asset.pathname + asset.search);
    assert.match(response.headers.get('content-type') ?? '', /(?:javascript|ecmascript)/);
    assert((await response.arrayBuffer()).byteLength > 0, 'Empty application bundle');
  }
  const missing = await fetch(new URL('/_expo/static/missing-smoke-test.js', base), {
    signal: AbortSignal.timeout(15_000), redirect: 'error',
  });
  assert.equal(missing.status, 404, 'Missing assets must return 404');
  console.log('PASS: health, five routes, application bundles, and missing-asset handling');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  console.error('Usage: npm run smoke:deployed -- https://your-deployed-host');
  process.exitCode = 1;
}

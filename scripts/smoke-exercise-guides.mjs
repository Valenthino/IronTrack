// Optional local-browser smoke test. Start the static server on 8087 and Chromium
// with --remote-debugging-port=9337 using a disposable browser profile first.
// This clears local storage for the test origin. Never use your normal profile.
import assert from 'node:assert/strict';
const page = await (await fetch('http://127.0.0.1:9337/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if (message.id) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  }
});
function call(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(expression + ': ' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
  return result.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${expression}; runtime errors: ${JSON.stringify(errors)}`);
}
const contains = text => `document.body?.innerText.includes(${JSON.stringify(text)})`;
async function click(text, role = 'button') {
  const selector = `[role="${role}"]`;
  const expression = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.getClientRects().length && el.textContent === ${JSON.stringify(text)})`;
  await waitFor(`!!(${expression}) && (${expression}).getAttribute('aria-disabled') !== 'true'`);
  await evaluate(`(${expression}).click()`);
}
async function storage() { return JSON.parse(await evaluate("localStorage.getItem('irontrack.training.v1')")); }
try {
  await call('Storage.clearDataForOrigin', { origin: 'http://127.0.0.1:8087', storageTypes: 'local_storage' });
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['https://*'] });
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Page.navigate', { url: 'http://127.0.0.1:8087/onboarding' });
  await waitFor(contains('1 / 5'));
  for (let i = 0; i < 3; i++) await click('Continue →');
  await waitFor(contains('4 / 5'));
  await evaluate(`(() => { const input = document.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '12.5'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  async function guide(name, escape = false) {
    const before = await storage();
    await waitFor(`!!document.querySelector('[aria-label="Open ${name} exercise guide"]')`);
    await evaluate(`document.querySelector('[aria-label="Open ${name} exercise guide"]').click()`);
    await waitFor(contains('EXERCISE GUIDE'));
    await waitFor(contains('Form cues'));
    await waitFor(`!!document.querySelector('[role=dialog]')`);
    await waitFor(`!document.querySelector('[role=dialog] img')`);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    assert.equal(await evaluate(`!!document.querySelector('[role="link"][aria-label*="YouTube"]')`), true);
    assert.equal(await evaluate(`[...document.querySelectorAll('[role="button"]')].find(e => e.textContent === 'Close guide').getBoundingClientRect().bottom <= window.innerHeight`), true);
    if (escape) {
      await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    } else await click('Close guide');
    await waitFor(`!(${contains('EXERCISE GUIDE')})`);
    assert.deepEqual(await storage(), before);
  }
  for (const name of ['Squat', 'Bench press', 'Overhead press', 'Barbell row', 'Deadlift']) await guide(name);
  assert.equal(await evaluate("document.querySelector('input').value"), '12.5');
  await click('Continue →');
  await guide('Squat', true);
  await click('Done — build my plan');
  await waitFor(contains('Start workout A'));
  await guide('Squat');
  await click('Start workout A');
  await waitFor(contains('Rest timer'));
  await evaluate(`document.querySelector('[aria-label="Squat, set 1, not logged. Edit reps."]').click()`);
  await click('5 reps');
  await guide('Bench press', true);
  const data = await storage();
  assert.equal(data.draft.reps.squat[0], 5);
  assert.ok(data.draft.restDeadline);
  await call('Page.reload');
  await waitFor(contains('Rest timer'));
  assert.deepEqual(await storage(), data);
  assert.deepEqual(errors, []);
  console.log('PASS: all five offline onboarding guides, review, Today, active set/timer preservation, reload, close/Escape, and 320px layout.');
} finally { socket.close(); }

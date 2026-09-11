// Optional local-browser smoke test. Start the static server on 8084 and Chromium
// with --remote-debugging-port=9334 using a disposable browser profile first.
// This clears local storage for the test origin. Never use your normal profile.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const page = await (await fetch('http://127.0.0.1:9334/json/new?about:blank', { method: 'PUT' })).json();
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
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
  await call('Storage.clearDataForOrigin', { origin: 'http://127.0.0.1:8084', storageTypes: 'local_storage' });
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['https://*'] });
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Page.navigate', { url: 'http://127.0.0.1:8084/onboarding' });
  await waitFor(contains('1 / 5'));
  async function choice(text) {
    await evaluate(`[...document.querySelectorAll('[role=radio]')].find(el => el.textContent.startsWith(${JSON.stringify(text)})).click()`);
  }
  async function layout() {
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    assert.equal(await evaluate("[...document.querySelectorAll('[role=button], [role=radio], input')].every(el => el.getBoundingClientRect().height >= 48)"), true);
  }
  await layout();
  await choice('Getting back');
  await click('Continue →');
  await choice('Build muscle');
  await click('Continue →');
  await choice('4');
  await choice('Tue · Wed');
  await layout();
  await click('Continue →');
  await waitFor(contains('4 / 5'));
  await layout();
  const setWeight = async value => {
    await evaluate(`(() => { const input = document.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  };
  await setWeight('-1');
  await click('Continue →');
  await waitFor(contains('Enter a finite weight'));
  assert.ok(await evaluate(contains('4 / 5')));
  await setWeight('12.5');
  await click('← Back');
  await choice('kg');
  await click('Continue →');
  assert.equal(await evaluate("document.querySelector('input').value"), '');
  await click('← Back');
  await choice('lb');
  await click('Continue →');
  assert.equal(await evaluate("document.querySelector('input').value"), '12.5');
  const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile('/tmp/irontrack-r2-weights.png', Buffer.from(screenshot.data, 'base64'));
  await click('Continue →');
  await waitFor(contains('5 / 5'));
  assert.ok(await evaluate(contains('12.5 lb')));
  await layout();
  await click('Done — build my plan');
  await waitFor(contains('Start workout A'));
  const data = await storage();
  assert.deepEqual(data.profile, { experience: 'returning', goal: 'size', schedule: { daysPerWeek: 4, trainingDays: [1, 2, 4, 6] } });
  assert.equal(data.training.lifts.squat.weight, 12.5);
  assert.equal(data.training.lifts.deadlift.weight, 45);
  await call('Page.reload');
  await waitFor(contains('Start workout A'));
  assert.deepEqual(await storage(), data);
  assert.deepEqual(errors, []);
  console.log('PASS: five steps, back navigation, unit input retention, inline validation, review, persistence/reload, 320px layout and 48px targets.');
} finally { socket.close(); }

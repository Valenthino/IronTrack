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
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const f = require('../.test-build/flows.js');
const p = require('../.test-build/progress.js');
const now = new Date();
let seed = f.initialData();
seed.profile = { experience: 'new', goal: 'strength' };
seed.draft = f.startDraft(seed.training, 'r5-session');
for (const lift of Object.keys(seed.draft.reps)) seed.draft.reps[lift].fill(4);
seed = f.finishWorkout(seed, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12).toISOString());
seed.reminder = { enabled: true, days: [0,1,2,3,4,5,6], time: '00:00' };
const input = async (label, value) => evaluate(`(() => { const el = document.querySelector('[aria-label="${label}"]'); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
async function layout() {
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'no horizontal page overflow');
  assert.equal(await evaluate("[...document.querySelectorAll('[role=button], input, textarea')].filter(el => el.getClientRects().length).every(el => el.getBoundingClientRect().height >= 48 && el.getBoundingClientRect().width >= 48)"), true, '48px controls');
}
try {
  await call('Storage.clearDataForOrigin', { origin: 'http://127.0.0.1:8087', storageTypes: 'local_storage' });
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['https://*'] });
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Page.navigate', { url: 'http://127.0.0.1:8087/history' });
  await waitFor(contains('Set up my training'));
  await evaluate(`localStorage.setItem('irontrack.training.v1', ${JSON.stringify(JSON.stringify(seed))})`);
  await call('Page.reload');
  await waitFor(contains('week streak'));
  await waitFor(contains('Time to lift.'));
  await layout();
  assert.ok(await evaluate(contains('All-time PR')));
  assert.ok(await evaluate(contains('Stall 1/3')));
  await click('Dismiss for today');
  await waitFor(`!(${contains('Time to lift.')})`);
  await input('Bodyweight (lb)', '180');
  await click('Save bodyweight');
  await waitFor(contains('Bodyweight saved.'));
  assert.equal((await storage()).bodyweight[0].weight, 180);
  await evaluate(`[...document.querySelectorAll('[role=button]')].find(el => el.getAttribute('aria-label')?.startsWith(${JSON.stringify(p.dateKey(now))})).click()`);
  await waitFor(contains('Bodyweight · 180 lb'));
  await click('Show all sessions');
  await evaluate("[...document.querySelectorAll('[role=button]')].find(el => el.textContent.startsWith('Workout A ·')).click()");
  await waitFor(contains('Save notes'));
  await input('Session notes (optional)', 'R5 browser verified');
  await click('Save notes');
  await waitFor(contains('Notes saved on this device.'));
  assert.equal((await storage()).history[0].notes, 'R5 browser verified');
  await call('Page.reload');
  await waitFor(contains('R5 browser verified'));
  await layout();
  await call('Page.navigate', { url: 'http://127.0.0.1:8087/settings' });
  await waitFor(contains('Workout reminders'));
  await layout();
  await input('Reminder time (HH:MM, local time)', '25:00');
  await click('Save reminders');
  await waitFor(contains('Choose at least one day'));
  await input('Reminder time (HH:MM, local time)', '23:59');
  await click('Save reminders');
  await waitFor(contains('Reminder settings saved.'));
  assert.equal((await storage()).reminder.time, '23:59');
  await call('Page.reload');
  await waitFor(contains('Workout reminders'));
  assert.equal(await evaluate(`document.querySelector('[aria-label="Reminder time (HH:MM, local time)"]').value`), '23:59');
  assert.deepEqual(errors, []);
  console.log('R5 mobile smoke passed: graphs/PR/stalls, calendar, notes+reload, bodyweight, reminder banner/dismiss/settings+reload, 320px layout and 48px controls.');
} finally { await call('Page.close'); socket.close(); }

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
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Page.navigate', { url: 'http://127.0.0.1:8084/' });
  await waitFor(contains('Set up my training'));
  await click('Sign in with email');
  await waitFor(contains('Email sign-in is not configured'));
  await click('Continue to training');
  await click('Set up my training');
  await waitFor(contains('STEP 1 OF 3'));
  await click('Continue');
  await waitFor(contains('STEP 2 OF 3'));
  await click('Confidence');
  await click('Continue');
  await waitFor(contains('STEP 3 OF 3'));
  assert.ok(await evaluate(contains('empty 45 lb bar')));
  await click('kg');
  await click('Build my plan');
  await waitFor(contains('Start workout A'));
  assert.equal((await storage()).profile.goal, 'confidence');
  assert.ok(await evaluate(contains('Plates per side: None')));
  await click('Workout B');
  await waitFor(contains('Preview only.'));
  await click('Start workout A');
  await waitFor(contains('Let’s lift. Workout A.'));
  const unfinished = "[...document.querySelectorAll('[role=button]')].find(el => el.getClientRects().length && el.getAttribute('aria-label')?.includes('not logged'))";
  for (let i = 0; i < 15; i++) {
    await waitFor(`!!(${unfinished}) && (${unfinished}).getAttribute('aria-disabled') !== 'true'`);
    await evaluate(`(${unfinished}).click()`);
    await click(i === 0 ? '4 reps' : '5 reps');
    await waitFor(`!${contains('reps completed')}`);
    if (i === 0) {
      assert.ok((await storage()).draft.restDeadline > Date.now() + 170000);
      await click('Settings', 'link');
      await waitFor(contains('Finish your active workout to change units.'));
      await click('Today', 'link');
      await waitFor(contains('Let’s lift. Workout A.'));
      await call('Page.reload');
      await waitFor(contains('Let’s lift. Workout A.'));
      assert.equal((await storage()).draft.reps.squat[0], 4);
      assert.ok((await storage()).draft.restDeadline > Date.now());
    }
  }
  await click('Finish & save workout');
  await waitFor(contains('Workout saved.'));
  const completed = await storage();
  assert.equal(completed.history.length, 1);
  assert.equal(completed.training.nextWorkout, 'B');
  assert.equal(completed.training.lifts.squat.weight, 20);
  assert.equal(completed.training.lifts.bench_press.weight, 22.5);
  await click('History', 'link');
  await waitFor(contains('Workout history · 1'));
  assert.ok(await evaluate(contains('4 / 5 / 5 / 5 / 5 reps')));
  await click('Settings', 'link');
  await click('Pounds');
  await waitFor(contains('✓ Pounds'));
  assert.equal((await storage()).training.lifts.bench_press.weight, 50);
  assert.equal((await storage()).history[0].training.unit, 'kg');
  await click('Today', 'link');
  await waitFor(contains('Start workout B'));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await click('Start workout B');
  await waitFor(contains('Let’s lift. Workout B.'));
  for (let i = 0; i < 11; i++) {
    await waitFor(`!!(${unfinished}) && (${unfinished}).getAttribute('aria-disabled') !== 'true'`);
    await evaluate(`(${unfinished}).click()`);
    await click('5 reps');
    await waitFor(`!${contains('reps completed')}`);
  }
  await click('Finish & save workout');
  await waitFor(contains('Workout saved.'));
  assert.equal((await storage()).history.length, 2);
  assert.equal((await storage()).training.nextWorkout, 'A');
  assert.equal((await storage()).training.lifts.deadlift.weight, 50);
  assert.ok(await evaluate(contains('1 × 2.5 lb')));
  for (const width of [320, 1280]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile('/tmp/irontrack-round4-mobile.png', Buffer.from(screenshot.data, 'base64'));
  await call('Page.navigate', { url: 'http://127.0.0.1:8084/auth#refresh_token=synthetic-test-value' });
  await waitFor(contains('This sign-in link is invalid or expired.'));
  assert.equal(await evaluate('location.hash'), '');
  assert.equal((await storage()).history.length, 2);
  assert.deepEqual(errors, []);
  console.log('PASS: mobile onboarding, unconfigured auth, A/B preview, A and B completion, plate guidance, 320/390/1280px layouts, failed-lift hold, rest/draft reload, history, unit conversion; no runtime exceptions.');
} finally { socket.close(); }

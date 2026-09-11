import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXERCISE_GUIDES, guideThumbnailUrl } from '../.test-build/exerciseGuides.js';
import { lifts, liftNames } from '../.test-build/flows.js';

test('guides cover exactly the supported lifts with complete editorial content', () => {
  assert.deepEqual(Object.keys(EXERCISE_GUIDES).sort(), [...lifts].sort());
  for (const lift of lifts) {
    const guide = EXERCISE_GUIDES[lift];
    assert.equal(guide.lift, lift);
    assert.equal(guide.name, liftNames[lift]);
    for (const field of ['description', 'title', 'source']) assert.ok(guide[field].trim().length > 10);
    assert.ok(guide.cues.length >= 3 && guide.cues.length <= 5);
    assert.equal(new Set(guide.cues).size, guide.cues.length);
    for (const cue of guide.cues) assert.ok(cue.trim().length > 10);
    assert.ok(guide.image === null || /^assets\/exercise-images\/[a-z_]+\.(png|jpg|webp)$/.test(guide.image));
  }
});

test('curated videos use canonical HTTPS YouTube URLs and matching thumbnails', () => {
  const urls = new Set();
  for (const guide of Object.values(EXERCISE_GUIDES)) {
    const url = new URL(guide.videoUrl);
    assert.equal(url.origin, 'https://www.youtube.com');
    assert.equal(url.pathname, '/watch');
    assert.match(url.search, /^\?v=[A-Za-z0-9_-]{11}$/);
    assert.equal(url.hash, '');
    assert.equal(guideThumbnailUrl(guide), `https://i.ytimg.com/vi/${url.searchParams.get('v')}/hqdefault.jpg`);
    urls.add(guide.videoUrl);
  }
  assert.equal(urls.size, lifts.length);
});

test('media table mirrors every guide field and reserved image path', () => {
  const doc = readFileSync(new URL('../docs/exercise-media.md', import.meta.url), 'utf8');
  for (const guide of Object.values(EXERCISE_GUIDES)) {
    const row = doc.split('\n').find(line => line.startsWith(`| \`${guide.lift}\` |`));
    assert.ok(row, guide.lift);
    for (const value of [guide.name, guide.description, ...guide.cues, guide.videoUrl, guide.title, guide.source]) {
      assert.ok(row.includes(value.replaceAll('|', '\\|')), value);
    }
    assert.ok(row.includes(`assets/exercise-images/${guide.lift}.png`));
    assert.ok(row.includes('null'));
  }
});

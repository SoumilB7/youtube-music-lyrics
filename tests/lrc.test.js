const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLRC, plainToLines, estimateTimings, lineIndexAt } = require('../src/lrc.js');

test('parses LRC with multiple tags, word tags and offset', () => {
  const lines = parseLRC([
    '[ar:Someone]',
    '[offset:+500]',
    '[00:10.50][00:40.00]Chorus <00:10.60>line',
    '[00:20.00]',
    '[00:21.00]',
    '[00:25.120]Verse',
  ].join('\n'));
  assert.deepEqual(lines, [
    { t: 0, text: '' }, // intro placeholder
    { t: 10, text: 'Chorus line' },
    { t: 19.5, text: '' }, // consecutive gaps collapsed
    { t: 24.62, text: 'Verse' },
    { t: 39.5, text: 'Chorus line' },
  ]);
});

test('estimated timings stay within the track and are increasing', () => {
  const lines = estimateTimings(plainToLines('\nOne\nTwo two two\n\nThree\n'), 200);
  const texts = lines.map((l) => l.text);
  assert.deepEqual(texts, ['', 'One', 'Two two two', '', 'Three']);
  for (let i = 1; i < lines.length; i++) assert.ok(lines[i].t > lines[i - 1].t);
  assert.ok(lines[lines.length - 1].t < 200);
});

test('lineIndexAt', () => {
  const lines = [{ t: 0 }, { t: 5 }, { t: 9 }];
  assert.equal(lineIndexAt(lines, -1), -1);
  assert.equal(lineIndexAt(lines, 0), 0);
  assert.equal(lineIndexAt(lines, 7), 1);
  assert.equal(lineIndexAt(lines, 100), 2);
});

const { offsetAt, playbackTimeFor, nudgePoints } = require('../src/lrc.js');

test('early presses shift the whole song', () => {
  // First line at 12s; song is 2s late, noticed at 0:30.
  let p = nudgePoints([], 30, 0.5, 12);
  for (let i = 0; i < 3; i++) p = nudgePoints(p, 32 + i, 0.5, 12);
  assert.deepEqual(p, [{ at: 30, offset: 2 }]);
  assert.equal(offsetAt(p, 0), 2);
  assert.equal(offsetAt(p, 200), 2);
});

test('a late first press stretches from the start instead of shifting it', () => {
  // Lyrics fine at the start, 17s off by 3:00.
  const p = nudgePoints([], 180, -17, 12);
  assert.deepEqual(p, [{ at: 12, offset: 0 }, { at: 180, offset: -17 }]);
  assert.equal(offsetAt(p, 12), 0);
  assert.equal(offsetAt(p, 96), -8.5); // halfway: half the correction
  assert.equal(offsetAt(p, 180), -17);
  // Past the last point the drift continues, capped at MAX_DRIFT.
  assert.ok(offsetAt(p, 200) < -17 && offsetAt(p, 200) >= -17 - 0.25 * 20);
});

test('presses near an existing point fine-tune it; adding points keeps them sorted', () => {
  let p = [{ at: 12, offset: 0 }, { at: 180, offset: -17 }];
  p = nudgePoints(p, 185, 0.5, 12);
  assert.deepEqual(p, [{ at: 12, offset: 0 }, { at: 180, offset: -16.5 }]);
  p = nudgePoints(p, 100, -0.5, 12);
  assert.deepEqual(p.map((x) => x.at), [12, 100, 180]);
});

test('back to zero clears the correction', () => {
  const p = nudgePoints([{ at: 30, offset: 0.5 }], 31, -0.5, 12);
  assert.deepEqual(p, []);
});

test('playbackTimeFor inverts the correction (for click-to-seek)', () => {
  const p = [{ at: 12, offset: 0 }, { at: 180, offset: -17 }];
  for (const lyricT of [20, 90, 150]) {
    const t = playbackTimeFor(p, lyricT);
    assert.ok(Math.abs(t + offsetAt(p, t) - lyricT) < 0.01);
  }
});

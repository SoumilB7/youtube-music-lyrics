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

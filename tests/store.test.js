const test = require('node:test');
const assert = require('node:assert/strict');

// Minimal chrome.storage stand-in: two areas, and a switch to make sync "full".
function fakeArea() {
  const data = {};
  return {
    data,
    full: false,
    async get(keys) {
      if (keys == null) return { ...data };
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out = typeof keys === 'object' && !Array.isArray(keys) ? { ...keys } : {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(obj) {
      if (this.full) throw new Error('QUOTA_BYTES quota exceeded');
      Object.assign(data, JSON.parse(JSON.stringify(obj)));
    },
    async remove(keys) {
      for (const k of [].concat(keys)) delete data[k];
    },
  };
}
function freshChrome() {
  global.chrome = { storage: { sync: fakeArea(), local: fakeArea() } };
  return global.chrome.storage;
}

const store = require('../src/store.js');
console.warn = () => {}; // quota warnings are expected in one test

test('saves go to both sync and local, and survive a full sync quota', async () => {
  const s = freshChrome();
  await store.setTiming('offset:abc', { points: [{ at: 0, offset: -8 }], title: 'West Coast', artist: 'OneRepublic' });
  assert.ok(s.sync.data['offset:abc'] && s.local.data['offset:abc']);

  s.sync.full = true;
  await store.setTiming('offset:def', { points: [{ at: 0, offset: 2 }], title: 'Kesariya', artist: 'Pritam' });
  assert.equal(s.sync.data['offset:def'], undefined);
  assert.deepEqual((await store.getTiming('offset:def')).points, [{ at: 0, offset: 2 }]);
});

test('the oldest single-offset format still loads', async () => {
  const s = freshChrome();
  s.sync.data['offset:old'] = { offset: -1.5, title: 'Old', artist: 'Save', savedAt: 5 };
  assert.deepEqual((await store.getTiming('offset:old')).points, [{ at: 0, offset: -1.5 }]);
});

test('migrate upgrades old saves, backs them up locally, and runs once', async () => {
  const s = freshChrome();
  s.sync.data['offset:old'] = { offset: 3, title: 'Old', savedAt: 5 };
  s.sync.data.fontSize = 30;
  s.local.data['lrc:stale|x|200'] = { at: 1, result: {} };
  await store.migrate();
  assert.deepEqual(s.sync.data['offset:old'].points, [{ at: 0, offset: 3 }]);
  assert.deepEqual(s.local.data['offset:old'].points, [{ at: 0, offset: 3 }]);
  assert.equal(s.sync.data.fontSize, 30); // settings untouched
  assert.equal(s.local.data['lrc:stale|x|200'], undefined);
  assert.equal(s.local.data.schema, store.SCHEMA);
});

test('export then import into an empty install restores everything', async () => {
  let s = freshChrome();
  s.sync.data.fontSize = 34;
  await store.setTiming('offset:abc', { points: [{ at: 12, offset: 0 }, { at: 90, offset: -2 }], title: 'A', artist: 'B' });
  const backup = JSON.parse(JSON.stringify(await store.exportData()));

  s = freshChrome(); // e.g. the Chrome Web Store install
  assert.equal(await store.importData(backup), 1);
  assert.deepEqual((await store.getTiming('offset:abc')).points, [{ at: 12, offset: 0 }, { at: 90, offset: -2 }]);
  assert.equal(s.sync.data.fontSize, 34);
  assert.equal(await store.importData(backup), 0); // importing again changes nothing
});

test('import keeps the newer fix when both have the same song', async () => {
  const s = freshChrome();
  s.sync.data['offset:x'] = { points: [{ at: 0, offset: 1 }], savedAt: 200 };
  await store.importData({ app: 'lyricly', timings: { 'offset:x': { points: [{ at: 0, offset: 9 }], savedAt: 100 } } });
  assert.deepEqual((await store.getTiming('offset:x')).points, [{ at: 0, offset: 1 }]);
  await assert.rejects(store.importData({ hello: 'world' }), /isn't a Lyricly backup/);
});

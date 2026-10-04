// Saved timings page: list, forget, export and import timing fixes.
const { store } = globalThis.Lyricly;
const $ = (id) => document.getElementById(id);

const fmtOffset = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} s`;
const describe = (points) => (points.length > 1 ? `Stretched, ${points.length} points` : fmtOffset(points[0].offset));
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function status(text, isError) {
  $('status').textContent = text;
  $('status').classList.toggle('error', !!isError);
}

async function render() {
  const timings = Object.entries(await store.allTimings()).sort((a, b) => b[1].savedAt - a[1].savedAt);
  const rows = $('rows');
  rows.textContent = '';
  if (!timings.length) {
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty';
    td.textContent = 'No saved timings yet. In the lyrics panel, adjust the timing with − / + and tap the bookmark.';
    rows.append(document.createElement('tr')).append(td);
    return;
  }
  for (const [key, t] of timings) {
    const tr = document.createElement('tr');
    const song = document.createElement('td');
    song.append(t.title || key.slice(store.TIMING_PREFIX.length));
    if (t.artist) {
      const a = document.createElement('div');
      a.className = 'artist';
      a.textContent = t.artist;
      song.append(a);
    }
    const fix = document.createElement('td');
    fix.className = 'fix';
    fix.textContent = describe(t.points);
    const date = document.createElement('td');
    date.className = 'date';
    date.textContent = fmtDate(t.savedAt);
    const act = document.createElement('td');
    const forget = document.createElement('button');
    forget.type = 'button';
    forget.textContent = 'Forget';
    forget.addEventListener('click', async () => {
      await store.removeTiming(key);
      status(`Forgot the timing for ${t.title || 'that song'}.`);
      render();
    });
    act.append(forget);
    tr.append(song, fix, date, act);
    rows.append(tr);
  }
}

$('export').addEventListener('click', async () => {
  const data = await store.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lyricly-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  const n = Object.keys(data.timings).length;
  status(`Exported ${n} saved timing${n === 1 ? '' : 's'} and your settings.`);
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const n = await store.importData(JSON.parse(await file.text()));
    status(n ? `Imported ${n} saved timing${n === 1 ? '' : 's'}.` : 'Everything in that backup was already here.');
    render();
  } catch (err) {
    status(err instanceof SyntaxError ? "That file isn't a Lyricly backup." : err.message, true);
  }
});

chrome.storage.onChanged.addListener(render);
render();

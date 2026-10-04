// Toolbar popup: switches bound to chrome.storage.sync. The content script
// listens for changes and applies them to open YouTube Music tabs.
const DEFAULTS = { autoOpenLyrics: true, visible: true };

document.getElementById('saved').addEventListener('click', () => chrome.runtime.openOptionsPage());
globalThis.Lyricly.store.allTimings().then((t) => {
  const n = Object.keys(t).length;
  if (n) document.getElementById('saved-count').textContent = `${n} song${n === 1 ? '' : 's'} saved. Back up or restore them.`;
});

chrome.storage.sync.get(DEFAULTS).then((settings) => {
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    input.checked = !!settings[key];
    input.addEventListener('change', () => chrome.storage.sync.set({ [key]: input.checked }));
  }
});

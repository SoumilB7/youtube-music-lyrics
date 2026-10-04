// Toolbar popup: switches bound to chrome.storage.sync. The content script
// listens for changes and applies them to open YouTube Music tabs.
const DEFAULTS = { autoOpenLyrics: true, visible: true };

chrome.storage.sync.get(DEFAULTS).then((settings) => {
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    input.checked = !!settings[key];
    input.addEventListener('change', () => chrome.storage.sync.set({ [key]: input.checked }));
  }
});

# Lyricly

A Chrome extension that shows large, time-synced lyrics on [YouTube Music](https://music.youtube.com) and converts Hindi (Devanagari) lyrics into romanised Hindi.

## Install

1. Clone this repo.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the folder.
3. Play a song on music.youtube.com and open the player. Lyrics appear in the **Lyrics** tab.

## Controls

- **Aa / Both / अ:** romanised, both, or original script
- **A− / A+:** text size
- **− / +:** shift timing by 0.5 s
- **⤢:** full screen (<kbd>Esc</kbd> to exit)
- **Click a line:** seek to it
- **<kbd>Alt</kbd>+<kbd>L</kbd>:** show or hide the lyrics
- **Toolbar icon:** settings (auto-open Lyrics tab, show Lyricly lyrics)

## How it works

- **Lyrics:** comes from [LRCLIB](https://lrclib.net), with YouTube Music's own lyrics as a fallback. Lyrics without timestamps are spread across the song's length.
- **Transliteration:** works offline using rules. Letters are mapped to Roman, Hindi schwa-deletion rules drop the silent "a" sounds (धड़कन → *dhadkan*), and common words use their usual spellings (नहीं → *nahi*).

## Development

```sh
node --test tests/
```

No build step. Reload the extension in `chrome://extensions` after changes.

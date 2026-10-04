# Lyricly: Synced Lyrics for YouTube Music

Lyricly is a Chrome extension that shows large, time-synchronised lyrics on [YouTube Music](https://music.youtube.com). Lyrics in Hindi (Devanagari script) are automatically transliterated into romanised Hindi ("Hinglish"), so listeners can read along without knowing the script.

> तू मेरा कोई ना होके भी कुछ लागे → *Tu mera koi na hoke bhi kuch laage*

## Features

- **Synchronised lyrics.** The current line is highlighted and kept centred as the song plays.
- **Readable display.** A side panel and a full-screen mode with large, adjustable text over the album artwork.
- **Hindi transliteration.** Devanagari lyrics are converted to romanised Hindi on the device, with no external service.
- **Display modes.** Romanised only, romanised with the original script below, or original script only.
- **Timing controls.** Adjust the sync in 0.5-second steps, and click any line to seek to it.
- **Fallback for unsynced lyrics.** When no timestamped lyrics exist, line timings are estimated across the track.

## Installation

Lyricly is not yet on the Chrome Web Store. To install it from source:

1. Clone this repository:
   ```sh
   git clone https://github.com/SoumilB7/youtube-music-lyrics.git
   ```
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right corner).
4. Click **Load unpacked** and select the cloned folder.
5. Open [music.youtube.com](https://music.youtube.com) and start playback.

To apply changes, click the reload icon on the extension's card in `chrome://extensions`, then refresh the YouTube Music tab.

## Usage

| Control | Action |
| --- | --- |
| Floating button, toolbar icon, or <kbd>Alt</kbd>+<kbd>L</kbd> | Show or hide the lyrics panel |
| **Aa** / **Both** / **अ** | Romanised / romanised with original / original script |
| **A−** / **A+** | Decrease or increase text size |
| **−** / **+** | Shift lyric timing by 0.5 s (later / earlier) |
| Expand icon, <kbd>Esc</kbd> to exit | Full-screen mode |
| Click a line | Seek playback to that line |

Scrolling the lyrics manually pauses auto-scrolling for a few seconds. The panel footer shows where the lyrics came from and whether the timing is exact or estimated.

## How It Works

### Lyrics sources

1. **[LRCLIB](https://lrclib.net).** This is the primary source: an open lyrics database that serves timestamped LRC files and needs no API key. The extension cleans the track title (removing suffixes such as `(From "…")`, `(Official Video)` or `| Movie | Cast`), searches by title and artist, and scores candidates by:
   - title match
   - artist match
   - difference in track length
   - whether timestamps are available

   When candidates are otherwise similar, it prefers lyrics that someone already romanised by hand. Results are cached locally for 30 days.
2. **YouTube Music.** If LRCLIB has no match, the extension requests the lyrics YouTube Music shows in its own Lyrics tab, using the signed-in session. These lyrics have no timestamps.

### Synchronisation

Playback position is read from the page's media element. For timestamped lyrics, the active line is found by binary search on every animation frame, and each line is shown slightly ahead of time so it can be read before it is sung.

For lyrics without timestamps, the extension sets aside a typical intro and outro. It then spreads the remaining time across the lines in proportion to their length, with stanza breaks counting as short pauses. This keeps the highlighted line close to the vocals. The timing controls can correct any remaining drift.

### Transliteration

[`src/translit.js`](src/translit.js) is a rule-based Devanagari-to-Roman transliterator built for how Hindi lyrics are normally written in Latin script:

1. **Lexicon.** Very common words with conventional spellings are looked up directly. For example: है → *hai*, नहीं → *nahi*, क्यों → *kyun*, में → *mein*.
2. **Phoneme segmentation.** Each word is split into consonants and vowels. A consonant without a vowel sign or virama carries an inherent vowel (schwa).
3. **Schwa deletion.** Spoken Hindi drops most inherent vowels, so the standard rules are applied:
   - The final schwa is removed: कमल → *kamal*.
   - Moving right to left, a schwa in the context V C _ C V is removed: धड़कन → *dhadkan*, समझना → *samajhna*.
   - Sanskrit-style final clusters keep their schwa (मित्र → *mitra*). Perso-Arabic words written with nukta letters do not (ज़िक्र → *zikr*).
4. **Orthographic rendering.** Spelling follows everyday conventions:
   - Long vowels are shortened at the end of a word: *tera*, *teri*.
   - Nasalised endings become *-ein*, *-ain*, *-on*: *aankhein*, *hain*.
   - Nukta letters map to *z*, *q*, *f*.
   - Common clusters get their usual spelling: अच्छा → *accha*, ज्ञान → *gyaan*.

## Project Structure

```
manifest.json            Extension manifest (Manifest V3)
src/background.js        Service worker: LRCLIB search, match scoring, caching
src/content.js           Lyrics panel, track detection, synchronisation loop
src/ytm.js               YouTube Music integration: player metadata, lyrics fallback
src/lrc.js               LRC parsing and timing estimation
src/translit.js          Devanagari to romanised Hindi transliteration
tests/                   Unit tests (Node.js built-in test runner)
scripts/make_icons.py    Icon generator (Python standard library only)
icons/                   Extension icons
```

## Development

The extension is plain JavaScript and needs no build step.

Run the unit tests (requires Node.js 18 or later):

```sh
node --test tests/
```

Regenerate the icons:

```sh
python3 scripts/make_icons.py
```

## Permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Save display preferences and cache lyrics lookups |
| `https://lrclib.net/*` | Fetch lyrics from LRCLIB |
| `https://music.youtube.com/*` (content script) | Display the lyrics panel and read playback state |

The extension collects no personal data, and the only external service it contacts is LRCLIB.

## Known Limitations

- **Spelling.** Romanised Hindi has no standard spelling, so output may differ from your preferred spelling. For example, the extension writes *deewaana* where some write *deewana*.
- **Compound words.** These can produce incorrect schwa deletion. Such words can be added to the `COMMON` lexicon in `src/translit.js`.
- **Other scripts.** Only Devanagari is transliterated. Gurmukhi (Punjabi) and Perso-Arabic (Urdu) lyrics are shown as provided.
- **YouTube Music fallback.** It depends on an undocumented internal API and may stop working if that API changes.
- **Estimated timing.** Timing for lyrics without timestamps is approximate.

## Acknowledgements

Lyrics are provided by [LRCLIB](https://lrclib.net), a free, community-maintained lyrics database.

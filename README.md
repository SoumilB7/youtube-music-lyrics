# Lyricly

A Chrome extension that shows large, time-synced lyrics on [YouTube Music](https://music.youtube.com) and shows lyrics in other scripts in English letters: Hindi, Punjabi, Bengali, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam and Korean.

## Install

1. Clone this repo.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the folder.
3. Play a song on music.youtube.com and open the player. Lyrics appear in the **Lyrics** tab.

## Controls

- **Aa / Both / अ:** English letters, both, or the original script (the button shows the song's own script, e.g. ਪ for Punjabi, 한 for Korean)
- **A− / A+:** text size
- **− / +:** fix timing by 0.5 s at the current point in the song, or click the number to type an exact value. Fixes at different points stretch the lyrics between them, so lyrics that drift line up throughout. **↺** resets the timing.
- **Bookmark:** saves the timing fix for this song and applies it automatically next time.
- **⤢:** full screen (<kbd>Esc</kbd> to exit)
- **Click a line:** seek to it
- **<kbd>Alt</kbd>+<kbd>L</kbd>:** show or hide the lyrics
- **Toolbar icon:** settings (auto-open Lyrics tab, show Lyricly lyrics) and **Saved timings**, where you can back up, restore or forget saved fixes. Saves are kept through every update, and even through removing and reinstalling Lyricly (a copy lives in YouTube Music's site storage).

## How it works

- **Lyrics:** comes from [LRCLIB](https://lrclib.net), with YouTube Music's own lyrics as a fallback. Lyrics without timestamps are spread across the song's length.
- **Transliteration:** works offline using rules, one file per language in [src/scripts/](src/scripts/) plus Hindi and Punjabi in [translit.js](src/translit.js). Each follows how that language is usually written in English letters: Hindi drops silent "a" sounds (धड़कन → *dhadkan*), Tamil spells sounds by position (காதல் → *kaadhal*), Bengali uses "o" (মন → *mon*), Korean uses Revised Romanization (사랑해 → *saranghae*). Common words use their usual spellings (नहीं → *nahi*, ਨੂੰ → *nu*).

## Credits

Lyrics come from [LRCLIB](https://lrclib.net) ([source](https://github.com/tranxuanthang/lrclib)), a free, open-source lyrics database created by Thang Tran and filled by its community. If Lyricly is useful to you, consider contributing lyrics there.

## Development

```sh
node --test tests/
```

No build step. Reload the extension in `chrome://extensions` after changes.

`./scripts/package.sh` builds the Chrome Web Store zip. Release steps and listing text are in [store/](store/README.md). Privacy policy: [PRIVACY.md](PRIVACY.md).

# Lyricly privacy policy

Last updated: October 2026

Lyricly is a Chrome extension that shows synced lyrics on YouTube Music. It has no servers of its own, no analytics and no ads, and the developer never receives any of your data.

## What Lyricly uses, and why

**The song you're playing.** Lyricly reads the title, artist, album and length of the current song from the YouTube Music page. It sends the title, artist and length to [LRCLIB](https://lrclib.net), a free, open-source lyrics database, to find the lyrics. As with any web request, LRCLIB also sees your IP address. LRCLIB's handling of requests is covered by its own terms.

**YouTube Music's own lyrics.** If LRCLIB has no lyrics for a song, Lyricly asks YouTube Music for the lyrics it shows in its own Lyrics tab. This request goes only to music.youtube.com and uses your existing YouTube sign-in. To sign the request the way YouTube Music itself does, Lyricly reads your YouTube session cookie. The cookie is used for that request only. Lyricly never stores it and never sends it anywhere except YouTube.

**Playback position.** Lyricly reads how far into the song you are so it can highlight the current line. This never leaves your browser.

## What Lyricly stores

All of this is stored in your browser:

- **Settings:** display mode, text size, layout, and the two switches in the settings popup.
- **Saved timing fixes:** for songs where you saved a timing fix, the YouTube video ID, song title, artist, the fix itself and when you saved it. A backup copy is kept in local storage so a full sync quota can't lose a save.
- **Lyrics cache:** lyrics already found, kept for up to 30 days so they aren't fetched again.

Settings and saved timing fixes use Chrome's sync storage. If Chrome Sync is turned on, Chrome syncs them across your devices through your Google account. The lyrics cache and the backup copies stay on this device.

**Backup files.** If you choose **Export backup** on the Saved timings page, Lyricly saves a file with your settings and saved fixes to your computer. The file goes nowhere else unless you move it yourself.

## What Lyricly doesn't do

Lyricly doesn't sell or share your data, doesn't track what you browse, and doesn't use your data for anything other than showing lyrics. It only runs on music.youtube.com.

## Removing your data

Uninstalling Lyricly deletes everything it stored. To clear saved timing fixes without uninstalling, use **Forget** on the Saved timings page, or press the bookmark on a song with a saved fix.

## Contact

Questions or concerns: [open an issue on GitHub](https://github.com/SoumilB7/youtube-music-lyrics/issues).

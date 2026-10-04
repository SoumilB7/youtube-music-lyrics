# Privacy practices

Answers for the **Privacy practices** tab of the developer dashboard. They match [PRIVACY.md](../PRIVACY.md); keep the two in sync.

## Single purpose

```
Lyricly shows large, time-synced lyrics for the song playing on YouTube Music, and romanises Hindi lyrics into Latin script.
```

## Permission justifications

**storage**
```
Saves the user's display settings (text size, script mode, layout), the timing fixes they choose to save for individual songs, and a cache of lyrics already found so they aren't requested again.
```

**Host permissions** (`https://lrclib.net/*`, plus the content script on `https://music.youtube.com/*`)
```
music.youtube.com: the content script reads the current song's title, artist and playback position from the page and shows the lyrics panel there. Lyricly runs on no other site.
lrclib.net: the extension looks up lyrics for the current song in LRCLIB's free lyrics API (title, artist and song length only).
```

## Remote code

**No**, I am not using remote code. All JavaScript ships in the package; nothing is loaded or evaluated from elsewhere.

## Data usage

Tick these and leave the rest unticked:

| Category | Why |
| --- | --- |
| **Authentication information** | When LRCLIB has no lyrics, Lyricly reads the YouTube session cookie to sign a request to YouTube Music for its own lyrics. It's sent only to music.youtube.com and never stored. |
| **Website content** | The song title, artist and length read from the YouTube Music page are sent to LRCLIB to find lyrics. |

Not collected: personally identifiable info, health, financial, personal communications, location, web history, user activity. Playback position is read but never leaves the browser.

Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/SoumilB7/youtube-music-lyrics/blob/main/PRIVACY.md

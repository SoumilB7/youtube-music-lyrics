# Releasing to the Chrome Web Store

## First release

1. **Build the zip.** `./scripts/package.sh` runs the tests and writes `dist/lyricly-<version>.zip` with only the runtime files.
2. **Create a developer account** at the [developer dashboard](https://chrome.google.com/webstore/devconsole). There's a one-time $5 fee, and you'll need to verify your contact email.
3. **Add a new item** and upload the zip.
4. **Store listing:** fill it in from [listing.md](listing.md) and upload the images in `assets/`.
5. **Privacy practices:** fill it in from [privacy-practices.md](privacy-practices.md). The privacy policy URL only works once `PRIVACY.md` is pushed to `main`.
6. **Distribution:** free, public, all regions.
7. **Submit for review.** Reviews usually take a few days.

Reviewers sometimes object to another company's trademark in an extension's name. If they ask, rename it to "Lyricly: Synced Lyrics" in `manifest.json` and keep "for YouTube Music" in the description.

## Updates

1. Bump `version` in `manifest.json`. The store rejects a version it has already seen.
   If the update changes how anything is saved, follow the rules at the top of `src/store.js` (bump `SCHEMA`, add a migration step and a test), so users keep their settings and saved timings.
2. Run `./scripts/package.sh`.
3. In the dashboard, open the item, go to **Package**, upload the new zip and submit.

Before your first store upload, export a backup from **Saved timings** in your developer copy. The store version is a separate install with empty storage, so import the backup there.

If an update adds a permission, also update the justifications in `privacy-practices.md` and in the dashboard. Chrome disables the extension for existing users until they accept the new permission.

## Images

The screenshots are rendered from the real extension code with headless Chrome, using lyrics from LRCLIB. Each one is 1280×800 and saved as a 24-bit PNG with no transparency, as the store requires. If the panel's look changes, retake them so the listing matches what users get.

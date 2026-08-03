# Noizes Gallery for Android TV

Noizes Gallery is an offline-first, collector-owned viewer for portable `.nz` music objects. The first build intentionally concentrates on local import, package validation, museum-style collection presentation, native audio, and secure `experience.html` playback.

## Build and run

Open this directory in Android Studio (JDK 17, Android SDK 35), or run:

```sh
./gradlew testDebugUnitTest assembleDebug
```

Install `app/build/outputs/apk/debug/app-debug.apk` on an API 26+ Android TV emulator. Navigate with D-pad/center/back and media keys. On first launch choose a directory using the system folder picker, or skip and use **Add Folder** later. **Open .nz** imports one object.

The app recursively scans selected folders, retains read permission, and never changes or deletes source packages. It works without an account or internet connection.

## Supported first-build fields

`title`, `artist`, `release_id`, `cover`, `experience.entry`, `experience.playback_mode`, ordered `tracks`, `edition`, and `authenticity` are indexed. Unknown JSON fields are retained in the package and safely ignored by this version. Root or `cover/` artwork and common local audio formats are discovered as fallbacks.

## Current limitations

- The first build plays the first ordered track in native audio mode; full queue, lyrics, video, ambient mode, exhibition authoring, and deep cultural-metadata screens are next-phase work.
- Optional web resources are blocked. A consent ledger/UI will precede any network access.
- Archive entries are read on demand; Media3 assets are copied to an app cache before playback.
- SMB, Exchange purchases, cloud sync, and online registries are deliberately absent.

For a fixture, run `sh scripts/build-fixture.sh` and import `app/src/test/resources/fixtures/valid.nz`.

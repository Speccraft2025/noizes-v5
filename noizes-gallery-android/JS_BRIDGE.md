# Noizes host bridge 1.0

Experiences receive `window.NoizesHost` with `ready()`, `play()`, `pause()`, `seekTo(milliseconds)`, `getPlaybackState()`, `getObjectMetadata()`, `openSection(name)`, `exitExperience()`, and `requestOnlineResource(url)`. The last method always returns `false` in this offline build.

Remote presses produce `noizes:remote` custom events with a numeric `detail.keyCode`. Media keys also control host playback when `experience.playback_mode` is `host`. Metadata and playback responses are JSON strings to keep the JavaScript interface narrow and versionable.

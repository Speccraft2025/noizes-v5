# Immersive timeline schema 0.1

An album timeline names the audio master clock, track timeline paths, room binding, and transitions. A track timeline has `track_id`, `duration_ms`, and ordered `cues`. Every cue requires `time` (seconds), `action`, and `target`; it may add `value`, `duration`, and `easing`.

Supported demonstration actions are `scene.enter`, `light.fade`, `object.reveal`, `camera.move`, and `environment.change`. Unknown actions are ignored for forward compatibility. On seek, the renderer resets to the track base scene and reapplies the last relevant value of each action category at or before the current audio time.

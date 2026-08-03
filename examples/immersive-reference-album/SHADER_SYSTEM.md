# Shader system

The full-world slice uses Three.js physically informed shader programs with ACES filmic tone mapping, exponential depth fog, shadow mapping and a separate Canvas film/dust layer. Material parameters are authored by the audio clock. The previous custom outline shader remains preserved in `masterpiece-v1-motion-backup/` but is not the production world.

Context creation failure selects Essential mode. Context restoration reconstructs scene state from audio time rather than from prior frame history.


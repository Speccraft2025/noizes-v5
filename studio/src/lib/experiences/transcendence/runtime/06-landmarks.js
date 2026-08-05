/* Lyric landmarks — the signature technique.
 *
 * A line is not typeset over the image and it does not float above the world.
 * It is cut into the ridge the singer's own voice raised, at the frequency the
 * singer was actually strongest in, at the second the phrase actually began.
 * Both coordinates are measured at build time and shipped in the analysis file:
 *
 *   z = -aligned_seconds * TIME_SCALE      the moment the phrase starts
 *   x = band position of terrain_band      the singer's own dominant partial
 *
 * The landmark mesh evaluates the same terrain function as the ground, so it
 * follows the rock exactly and cannot hover above it.
 *
 * Typography: an old-style serif from the reader's own system. Nothing is
 * downloaded and no font file is redistributed.
 */

const LANDMARK_FONT = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Times New Roman",Georgia,serif';

class LandmarkField {
  /**
   * @param {object[]} lines   analysis lyric records for the lines in the slice
   * @param {object} options   world scale and layout
   */
  constructor(lines, options = {}) {
    this.lines = lines;
    this.timeScale = options.timeScale;
    this.bandWidth = options.bandWidth;
    this.bands = options.bands ?? 128;
    this.marks = [];
  }

  build() {
    const RASTER_W = 2048;
    const RASTER_H = 384;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const canvas = document.createElement('canvas');
      canvas.width = RASTER_W;
      canvas.height = RASTER_H;
      const ctx = canvas.getContext('2d');

      let size = 232;
      const fit = () => { ctx.font = `${size}px ${LANDMARK_FONT}`; return ctx.measureText(line.text).width; };
      let width = fit();
      const maxWidth = RASTER_W * 0.97;
      if (width > maxWidth) { size = Math.floor(size * maxWidth / width); width = fit(); }

      ctx.clearRect(0, 0, RASTER_W, RASTER_H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line.text, RASTER_W / 2, RASTER_H * 0.55);

      // The line runs *along* the flight, so its long axis is time. A phrase of
      // this length occupies roughly the seconds it takes to sing it, which is
      // why the words pass the viewer at the speed they are sung.
      const seconds = (line.phrase_end_seconds ?? line.aligned_seconds + 4) - line.aligned_seconds;
      const depth = Math.max(60, seconds * this.timeScale * 0.94);
      // The raster's aspect is preserved exactly, or the letterforms would be
      // stretched along whichever axis happened to be longer.
      const worldWidth = depth * (RASTER_H / RASTER_W);

      const band = line.terrain_band ?? Math.round(this.bands * 0.45);
      this.marks.push({
        canvas,
        text: line.text,
        // Rotated: uv.x runs along −Z (time), uv.y across the frequency axis.
        x: (band / (this.bands - 1) - 0.5) * this.bandWidth,
        z: -(line.aligned_seconds + seconds / 2) * this.timeScale,
        width: worldWidth,
        depth,
        band,
        hz: line.terrain_band_hz,
        seconds: line.aligned_seconds,
      });
    }
    return this;
  }
}

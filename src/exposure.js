(function (root) {
  function analyseFlashPixels(data, width, height) {
    const values = [];
    const x0 = Math.floor(width * .23), x1 = Math.ceil(width * .77);
    const y0 = Math.floor(height * .12), y1 = Math.ceil(height * .76);
    const step = Math.max(2, Math.floor(Math.min(width, height) / 120));
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
      const i = (y * width + x) * 4;
      values.push((data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722) / 255);
    }
    if (!values.length) return { mean: 0, p85: 0, clearlyUnderlit: false };
    values.sort((a, b) => a - b);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const p85 = values[Math.min(values.length - 1, Math.floor(values.length * .85))];
    // Deliberately conservative: flag only frames whose portrait area has
    // neither useful midtones nor highlights. The photo is still kept; this
    // signal only warns the host that the flash may need attention.
    return { mean, p85, clearlyUnderlit: mean < .16 && p85 < .28 };
  }

  function analyseFlashCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    return analyseFlashPixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  }

  function ambientFallbackISO(mean) {
    const safeMean = Math.max(.01, Math.min(1, Number(mean) || .01));
    // The first JPEG used 1/80 s, f/5.6 and ISO 400. The fallback gains about
    // 2.4 stops from 1/60 s and f/2.8; estimate only the remaining gain needed
    // to place the portrait around a restrained midtone.
    const target = .28, gamma = 2.2;
    const apertureAndShutterGain = Math.pow(2, 2 + Math.log2(80 / 60));
    const raw = 400 * Math.pow(target / safeMean, gamma) / apertureAndShutterGain;
    return [100, 200, 400, 800, 1600, 3200, 6400].reduce((best, value) => Math.abs(value - raw) < Math.abs(best - raw) ? value : best);
  }

  const api = { analyseFlashPixels, analyseFlashCanvas, ambientFallbackISO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.partyExposure = api;
})(typeof window === 'undefined' ? globalThis : window);

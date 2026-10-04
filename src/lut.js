/* Small .cube reader and trilinear sampler for the booth's finished JPEG. */
(() => {
  function parse(text) {
    const values = [];
    let size = 0;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) continue;
      const match = /^LUT_3D_SIZE\s+(\d+)/i.exec(line);
      if (match) { size = Number(match[1]); continue; }
      if (/^(TITLE|DOMAIN_MIN|DOMAIN_MAX)/i.test(line)) continue;
      const parts = line.split(/\s+/).map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) values.push(parts[0], parts[1], parts[2]);
    }
    if (!size || values.length !== size * size * size * 3) throw new Error('Invalid photo LUT.');
    return { size, values };
  }
  function createRenderer(lut, out = document.createElement('canvas')) {
    const gl = out.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    const vertex = `#version 300 es\nin vec2 position; in vec2 texcoord; out vec2 uv; void main(){gl_Position=vec4(position,0.0,1.0);uv=texcoord;}`;
    const fragment = `#version 300 es\nprecision highp float; precision highp sampler3D; in vec2 uv; out vec4 color; uniform sampler2D source; uniform sampler3D lut; uniform float grain; void main(){vec3 c=texture(source,uv).rgb; float nL=float(textureSize(lut,0).x); c=texture(lut,(clamp(c,0.0,1.0)*(nL-1.0)+0.5)/nL).rgb; float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5; color=vec4(clamp(c+n*grain/255.0,0.0,1.0),1.0);}`;
    const make = (type, sourceCode) => { const shader = gl.createShader(type); gl.shaderSource(shader, sourceCode); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); return shader; };
    const program = gl.createProgram(); gl.attachShader(program, make(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, make(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not initialise LUT shader.'); gl.useProgram(program);
    const vertices = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]); const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const stride = 4 * Float32Array.BYTES_PER_ELEMENT; for (const [name, offset] of [['position', 0], ['texcoord', 2]]) { const loc = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, stride, offset * Float32Array.BYTES_PER_ELEMENT); }
    const sourceTexture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sourceTexture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.uniform1i(gl.getUniformLocation(program, 'source'), 0);
    const lutTexture = gl.createTexture(), rgba = new Uint8Array(lut.size * lut.size * lut.size * 4); for (let i = 0; i < lut.size ** 3; i++) { rgba[i * 4] = Math.round(lut.values[i * 3] * 255); rgba[i * 4 + 1] = Math.round(lut.values[i * 3 + 1] * 255); rgba[i * 4 + 2] = Math.round(lut.values[i * 3 + 2] * 255); rgba[i * 4 + 3] = 255; }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, lutTexture); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, lut.size, lut.size, lut.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba); gl.uniform1i(gl.getUniformLocation(program, 'lut'), 1); const grainLocation = gl.getUniformLocation(program, 'grain');
    return {
      canvas: out,
      draw(source, grain = 0) {
        if (gl.isContextLost()) throw new Error('Preview graphics context lost.');
        const width = source.videoWidth || source.naturalWidth || source.width, height = source.videoHeight || source.naturalHeight || source.height;
        if (out.width !== width || out.height !== height) { out.width = width; out.height = height; }
        gl.useProgram(program); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.uniform1f(grainLocation, grain); gl.viewport(0, 0, width, height); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return out;
      },
      dispose() { gl.deleteTexture(sourceTexture); gl.deleteTexture(lutTexture); gl.deleteBuffer(buffer); gl.deleteProgram(program); }
    };
  }
  function apply(canvas, lut, grain = 0) {
    try { const renderer = createRenderer(lut); if (renderer) { const output = renderer.draw(canvas, grain); renderer.dispose(); return output; } } catch (e) { console.warn('GPU LUT unavailable; using slower fallback.', e); }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data, n = lut.size, table = lut.values;
    const sample = (r, g, b, channel) => {
      const x = r * (n - 1), y = g * (n - 1), z = b * (n - 1);
      const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), z1 = Math.min(n - 1, z0 + 1);
      const tx = x - x0, ty = y - y0, tz = z - z0;
      const at = (xx, yy, zz) => table[((zz * n * n + yy * n + xx) * 3) + channel];
      const c00 = at(x0, y0, z0) * (1 - tx) + at(x1, y0, z0) * tx;
      const c10 = at(x0, y1, z0) * (1 - tx) + at(x1, y1, z0) * tx;
      const c01 = at(x0, y0, z1) * (1 - tx) + at(x1, y0, z1) * tx;
      const c11 = at(x0, y1, z1) * (1 - tx) + at(x1, y1, z1) * tx;
      return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
    };
    let seed = 0x9e3779b9;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      data[i] = Math.max(0, Math.min(255, Math.round(sample(r, g, b, 0) * 255)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(sample(r, g, b, 1) * 255)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(sample(r, g, b, 2) * 255)));
      if (grain) { seed = (Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6d2b79f5) | 0; const noise = (((seed ^ (seed >>> 7)) >>> 0) / 4294967295 - 0.5) * grain; data[i] = Math.max(0, Math.min(255, data[i] + noise)); data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); }
    }
    ctx.putImageData(image, 0, 0); return canvas;
  }
  window.partyLut = { parse, apply, createRenderer };
})();

// Host for the unmodified GPL-2.0-or-later CRT-Royale shaders in crt-royale/.
let preservationUsers = 0;
let originalGetContext;
export async function preserveFramesDuring(load) {
  // Ruffle creates its WebGL canvas while detached, before its shadow host can identify it.
  if (!preservationUsers++) {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, options) {
      return originalGetContext.call(this, type, /^webgl2?$/.test(type) ? { ...options, preserveDrawingBuffer: true } : options);
    };
  }
  try { return await load(); }
  finally { if (!--preservationUsers) HTMLCanvasElement.prototype.getContext = originalGetContext; }
}

export function findGameCanvas(root) {
  const direct = root.querySelector("canvas:not([data-crt-output])");
  if (direct) return direct;
  for (const element of root.querySelectorAll("*")) {
    if (element.shadowRoot) {
      const found = findGameCanvas(element.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

/** Sample illumination before the shader: downsampling its RGB mask and scanlines causes colour bands. */
export function findFrameCanvas(root) {
  return findGameCanvas(root);
}

/** Royale's untilted spherical projection, shared by input, the glass outline and reflections. */
export function createRoyaleProjection(aspect, radius, viewDistance = 2) {
  const ratio = Math.min(aspect, 4 / 3);
  const diagonal = Math.hypot(ratio, 1);
  const ax = ratio / diagonal, ay = 1 / diagonal;
  let eye = radius;
  for (const sx of [-0.5, 0, 0.5]) {
    for (const sy of [-0.5, 0, 0.5]) {
      const x = sx * ax, y = sy * ay;
      const arc = Math.hypot(x, y);
      const scale = arc ? radius * Math.sin(arc / radius) / arc : 1;
      const z = radius * Math.cos(arc / radius);
      eye = Math.max(eye, z + 2 * viewDistance * Math.max(Math.abs(x * scale) / ax, Math.abs(y * scale) / ay));
    }
  }
  return {
    sourcePoint(u, v) {
      const x = (u - 0.5) * ax, y = (v - 0.5) * ay;
      const a = x * x + y * y + viewDistance * viewDistance;
      const b = -viewDistance * eye;
      const discriminant = b * b - a * (eye * eye - radius * radius);
      if (discriminant <= 0.005) return { u: -1, v: -1 };
      const t = (-b - Math.sqrt(discriminant)) / a;
      const px = t * x, py = t * y, pz = eye - t * viewDistance;
      const distance = Math.hypot(px, py);
      const scale = distance ? radius * Math.atan2(distance, pz) / distance : 1;
      return { u: 0.5 + px * scale / ax, v: 0.5 + py * scale / ay };
    },
    screenPoint(u, v) {
      const x = (u - 0.5) * ax, y = (v - 0.5) * ay;
      const arc = Math.hypot(x, y);
      const scale = arc ? radius * Math.sin(arc / radius) / arc : 1;
      const z = radius * Math.cos(arc / radius);
      return {
        u: 0.5 + viewDistance * x * scale / (ax * (eye - z)),
        v: 0.5 + viewDistance * y * scale / (ay * (eye - z)),
      };
    },
  };
}

export function royaleSourcePoint(u, v, aspect, radius, viewDistance = 2) {
  return createRoyaleProjection(aspect, radius, viewDistance).sourcePoint(u, v);
}

function mapCurvedInput(source, getParameters) {
  const types = ["pointerdown", "pointermove", "pointerup", "pointercancel", "mousedown", "mousemove", "mouseup", "click", "dblclick", "contextmenu", "wheel"];
  const remap = event => {
    if (!event.composedPath().includes(source)) return;
    const parameters = getParameters();
    if (parameters.geom_mode_runtime !== 1) return;
    const rect = source.getBoundingClientRect();
    if (!rect.width || !rect.height || !source.clientWidth || !source.clientHeight) return;
    let matrix = new DOMMatrix();
    for (let node = source; node; node = node.parentElement ?? node.getRootNode().host) {
      const transform = getComputedStyle(node).transform;
      if (transform !== "none") matrix = new DOMMatrix(transform).multiply(matrix);
    }
    const inverse = matrix.inverse();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const x = inverse.a * dx + inverse.c * dy;
    const y = inverse.b * dx + inverse.d * dy;
    const point = royaleSourcePoint(0.5 + x / source.clientWidth, 0.5 + y / source.clientHeight,
      source.width / source.height, parameters.geom_radius, parameters.geom_view_dist ?? 2);
    const localX = (point.u - 0.5) * source.clientWidth - x;
    const localY = (point.v - 0.5) * source.clientHeight - y;
    const shiftX = matrix.a * localX + matrix.c * localY;
    const shiftY = matrix.b * localX + matrix.d * localY;
    // Keep native/trusted events and pointer capture; only the game's coordinates change.
    for (const [key, value] of Object.entries({
      clientX: event.clientX + shiftX, clientY: event.clientY + shiftY,
      x: event.clientX + shiftX, y: event.clientY + shiftY,
      pageX: event.pageX + shiftX, pageY: event.pageY + shiftY,
      offsetX: point.u * source.clientWidth, offsetY: point.v * source.clientHeight,
    })) Object.defineProperty(event, key, { value, configurable: true });
  };
  for (const type of types) source.ownerDocument.addEventListener(type, remap, true);
  return () => { for (const type of types) source.ownerDocument.removeEventListener(type, remap, true); };
}

export async function attachRoyale(source, baseUrl, getParameters, failed, inputSize, inputSmoothing = () => true, signal, ready = () => {}) {
  if (signal?.aborted) return () => {};
  const output = document.createElement("canvas");
  output.dataset.crtOutput = "true";
  Object.assign(output.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "1", visibility: "hidden" });
  const parent = source.parentElement;
  if (!parent) throw new Error("CRT-Royale: game canvas has no container.");
  const oldPosition = parent.style.position;
  const oldOpacity = source.style.opacity;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  parent.append(output);
  const restore = () => {
    source.style.opacity = oldOpacity;
    output.remove();
    parent.style.position = oldPosition;
    signal?.removeEventListener("abort", abort);
  };
  let dispose = restore;
  const abort = () => dispose();
  signal?.addEventListener("abort", abort, { once: true });
  let runtime;
  try { runtime = await createRoyale(output, baseUrl); }
  catch (error) { if (!signal?.aborted) restore(); throw error; }
  if (signal?.aborted) { runtime.dispose(); return () => {}; }
  let frame = 0;
  let presented = false;
  let stopped = false;
  let restoreInput;
  const input = document.createElement("canvas");
  const context = inputSize ? input.getContext("2d", { alpha: false }) : null;
  if (inputSize && !context) { runtime.dispose(); restore(); throw new Error("CRT-Royale: input resampling unavailable."); }
  dispose = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame);
    restoreInput?.();
    restore(); runtime.dispose();
    output.removeEventListener("webglcontextlost", lost);
  };
  const lost = event => { event.preventDefault(); dispose(); failed(new Error("CRT-Royale: GPU context lost. Restart the game to retry.")); };
  output.addEventListener("webglcontextlost", lost);
  // Flash is effectively capped at 60 fps, so re-filtering per vsync on faster displays only
  // builds GPU backpressure that stalls the main thread and delays game audio.
  let lastDraw = -Infinity;
  const draw = time => {
    if (stopped) return;
    try {
      const paced = typeof time === "number";
      if (paced && time - lastDraw < 15.5) { frame = requestAnimationFrame(draw); return; }
      if (!document.hidden && source.width && source.height) {
        if (!runtime.canRender()) { frame = requestAnimationFrame(draw); return; }
        const parameters = getParameters();
        if (output.width !== source.width) output.width = source.width;
        if (output.height !== source.height) output.height = source.height;
        let textureSource = source;
        if (inputSize) {
          if (input.width !== inputSize.width) input.width = inputSize.width;
          if (input.height !== inputSize.height) input.height = inputSize.height;
          // Resizing resets context state, so request quality downscaling on every draw.
          context.imageSmoothingQuality = inputSmoothing() ? "high" : "low";
          context.drawImage(source, 0, 0, input.width, input.height);
          textureSource = input;
        }
        if (runtime.render(textureSource, parameters) === false) { frame = requestAnimationFrame(draw); return; }
        if (paced) lastDraw = Math.max(lastDraw + 1000 / 60, time - 50);
        if (parameters.geom_mode_runtime === 1 && !restoreInput) restoreInput = mapCurvedInput(source, getParameters);
        output.style.visibility = "visible";
        source.style.opacity = "0";
        if (!presented) { presented = true; ready(); }
      }
      frame = requestAnimationFrame(draw);
    } catch (error) { dispose(); failed(error); }
  };
  frame = requestAnimationFrame(draw);
  return dispose;
}

export async function createRoyale(output, baseUrl) {
  const gl = output.getContext("webgl2", { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("CRT-Royale requires WebGL 2.");
  const resources = new Map();
  const own = (value, remove) => {
    if (!value) throw new Error("CRT-Royale: GPU allocation failed.");
    resources.set(value, () => remove.call(gl, value));
    return value;
  };
  let disposed = false;
  let pendingFrame = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const release of resources.values()) release();
    resources.clear();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  const getText = async file => {
    const response = await fetch(new URL(file, baseUrl));
    if (!response.ok) throw new Error(`CRT-Royale ${file}: HTTP ${response.status}`);
    return response.text();
  };
  try {
    const preset = Object.fromEntries([...(await getText("crt-royale.glslp")).matchAll(/^(\w+)\s*=\s*"([^"]*)"/gm)].map(match => [match[1], match[2]]));
    const compile = (source, stage, file) => {
      const shader = own(gl.createShader(stage), gl.deleteShader);
      let converted = source.replace(/^#version[^\n]*\n/, "")
        .replace(/(static const bool interlace_detect\s*=\s*)true;/g, "$1false;");
      // The upstream Gaussian resize has one tap at a fixed corner instead of its local kernel position.
      if (file === "crt-royale-bloom-approx.glsl") converted = converted.replace(
        "float3 sample2 = tex2D_linearize(tex, dx).rgb;",
        "float3 sample2 = tex2D_linearize(tex, sample2_uv).rgb;",
      );
      gl.shaderSource(shader, `#version 300 es\n#define PARAMETER_UNIFORM\n#define ${stage === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT"}\n${converted}`);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`CRT-Royale ${file}: ${gl.getShaderInfoLog(shader)}`);
      return shader;
    };
    const makeTexture = (width, height, srgb = false) => {
      const texture = own(gl.createTexture(), gl.deleteTexture);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return { texture, width, height };
    };
    const luts = {};
    for (const name of preset.textures.split(";")) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = new URL(preset[name].split("/").pop(), baseUrl).href;
      await image.decode();
      const target = makeTexture(image.width, image.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      if (preset[`${name}_mipmap`] === "true") {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      }
      luts[name] = target;
    }
    const passes = [];
    const defaults = {
      crt_gamma: 2.5, lcd_gamma: 2.2, levels_contrast: 1,
      halation_weight: 0, diffusion_weight: 0.075, bloom_underestimate_levels: 0.8, bloom_excess: 0,
      beam_min_sigma: 0.02, beam_max_sigma: 0.3, beam_spot_power: 1 / 3,
      beam_min_shape: 2, beam_max_shape: 4, beam_shape_power: 0.25, beam_horiz_filter: 0,
      beam_horiz_sigma: 0.35, beam_horiz_linear_rgb_weight: 1,
      convergence_offset_x_r: 0.1, convergence_offset_y_r: 0.2,
      convergence_offset_x_g: 0.3, convergence_offset_y_g: 0.4,
      convergence_offset_x_b: 0.5, convergence_offset_y_b: 0.6,
      mask_type: 1, mask_specify_num_triads: 0, mask_triad_size_desired: 3, mask_sample_mode_desired: 0,
      mask_num_triads_desired: 480, aa_subpixel_r_offset_x_runtime: -1 / 3, aa_subpixel_r_offset_y_runtime: 0,
      aa_cubic_c: 0.5, aa_gauss_sigma: 0.5, geom_mode_runtime: 0, geom_radius: 2, geom_view_dist: 2,
      geom_tilt_angle_x: 0, geom_tilt_angle_y: 0, geom_aspect_ratio_x: 4 / 3, geom_aspect_ratio_y: 1,
      geom_overscan_x: 1, geom_overscan_y: 1, border_size: 0.015, border_darkness: 2, border_compress: 2.5,
      interlace_bff: 0, interlace_1080i: 0,
    };
    for (let index = 0; index < Number(preset.shaders); index++) {
      const file = preset[`shader${index}`].split("/").pop();
      const source = await getText(file);
      const program = own(gl.createProgram(), gl.deleteProgram);
      gl.attachShader(program, compile(source, gl.VERTEX_SHADER, file));
      gl.attachShader(program, compile(source, gl.FRAGMENT_SHADER, file));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`CRT-Royale ${file}: ${gl.getProgramInfoLog(program)}`);
      const uniforms = [];
      for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
        const info = gl.getActiveUniform(program, i);
        uniforms.push({ name: info.name, type: info.type, location: gl.getUniformLocation(program, info.name) });
      }
      const attributes = ["VertexCoord", "TexCoord"].map((name, index) => ({ location: gl.getAttribLocation(program, name), offset: index * 8 }));
      passes.push({ program, uniforms, attributes, framebuffer: own(gl.createFramebuffer(), gl.deleteFramebuffer), target: null });
    }
    const vao = own(gl.createVertexArray(), gl.deleteVertexArray);
    gl.bindVertexArray(vao);
    const buffer = own(gl.createBuffer(), gl.deleteBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]), gl.STATIC_DRAW);
    const input = makeTexture(1, 1);
    const identity = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    let frame = 0;
    const canRender = () => {
      if (disposed || gl.isContextLost()) throw new Error("CRT-Royale: GPU context unavailable.");
      if (pendingFrame) {
        const status = gl.clientWaitSync(pendingFrame, 0, 0);
        if (status === gl.WAIT_FAILED) throw new Error("CRT-Royale: GPU frame completion check failed.");
        if (status === gl.TIMEOUT_EXPIRED) return false;
        gl.deleteSync(pendingFrame);
        resources.delete(pendingFrame);
        pendingFrame = null;
      }
      return true;
    };
    const render = (source, parameters = {}) => {
      if (!source.width || !source.height) throw new Error("CRT-Royale: source unavailable.");
      if (!canRender()) return false;
      gl.bindVertexArray(vao);
      gl.bindTexture(gl.TEXTURE_2D, input.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      if (input.width !== source.width || input.height !== source.height) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        input.width = source.width; input.height = source.height;
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      const textures = { ...luts, OrigTexture: input, ORIGtexture: input };
      let previous = input;
      for (let index = 0; index < passes.length; index++) {
        const pass = passes[index];
        const dimension = axis => {
          const type = preset[`scale_type_${axis}${index}`] ?? preset[`scale_type${index}`] ?? "viewport";
          const factor = Number(preset[`scale_${axis}${index}`] ?? preset[`scale${index}`] ?? 1);
          return Math.max(1, Math.round(factor * (type === "absolute" ? 1 : type === "source" ? previous[axis === "x" ? "width" : "height"] : output[axis === "x" ? "width" : "height"])));
        };
        const width = dimension("x"), height = dimension("y");
        const last = index === passes.length - 1;
        let resized = false;
        if (!last && (!pass.target || pass.target.width !== width || pass.target.height !== height)) {
          if (pass.target) { gl.deleteTexture(pass.target.texture); resources.delete(pass.target.texture); }
          pass.target = makeTexture(width, height, preset[`srgb_framebuffer${index}`] === "true");
          resized = true;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, last ? null : pass.framebuffer);
        if (resized) {
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pass.target.texture, 0);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`CRT-Royale pass ${index}: unsupported framebuffer.`);
        }
        gl.viewport(0, 0, width, height);
        gl.useProgram(pass.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        for (const { location, offset } of pass.attributes) {
          if (location >= 0) { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 16, offset); }
        }
        textures.Texture = previous;
        for (let n = 1; n <= index + 1; n++) textures[`PassPrev${n}Texture`] = n === index + 1 ? input : passes[index - n].target;
        let unit = 0;
        for (const uniform of pass.uniforms) {
          const { name, location, type } = uniform;
          if (type === gl.SAMPLER_2D) {
            const target = textures[name];
            if (!target) throw new Error(`CRT-Royale pass ${index}: missing texture ${name}.`);
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, target.texture);
            if (target === previous) {
              const filter = preset[`filter_linear${index}`] === "true" ? gl.LINEAR : gl.NEAREST;
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            }
            gl.uniform1i(location, unit++);
          } else if (name === "MVPMatrix") gl.uniformMatrix4fv(location, false, identity);
          else if (name === "FrameCount") gl.uniform1i(location, frame);
          else if (name === "FrameDirection") gl.uniform1i(location, 1);
          else if (name === "OutputSize") gl.uniform2f(location, width, height);
          else if (name === "TextureSize" || name === "InputSize") gl.uniform2f(location, previous.width, previous.height);
          else if (type === gl.FLOAT_VEC2 && /(?:TextureSize|InputSize)$/.test(name)) {
            const prefix = name.replace(/(?:TextureSize|InputSize)$/, "");
            const target = textures[`${prefix}texture`] ?? textures[`${prefix}Texture`];
            if (!target) throw new Error(`CRT-Royale pass ${index}: missing size ${name}.`);
            gl.uniform2f(location, target.width, target.height);
          } else if (type === gl.FLOAT && Object.hasOwn(defaults, name)) gl.uniform1f(location, parameters[name] ?? defaults[name]);
          else throw new Error(`CRT-Royale pass ${index}: unsupported uniform ${name}.`);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!last) {
          previous = pass.target;
          textures[`Pass${index + 1}Texture`] = previous;
          if (preset[`alias${index}`]) textures[`${preset[`alias${index}`]}texture`] = previous;
        }
      }
      frame++;
      // getError drains the GPU pipeline, so frequent checks stall the main thread and
      // delay game audio. Setup failures surface in the first frames; later we spot-check.
      if (frame <= 3 || frame % 300 === 0) {
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error(`CRT-Royale GPU error ${error}.`);
      }
      // Never queue another twelve-pass frame while the GPU is still processing the last one.
      pendingFrame = own(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), gl.deleteSync);
      gl.flush();
      return true;
    };
    return { canRender, render, dispose };
  } catch (error) { dispose(); throw error; }
}

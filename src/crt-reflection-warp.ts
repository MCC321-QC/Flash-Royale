/** Samples the precomputed reflection coordinates without reading the lighting canvas back to the CPU. */
export function createReflectionWarp(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const releases: (() => void)[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const release of releases) release();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  const own = <T,>(value: T | null, remove: (resource: T) => void): T => {
    if (!value) throw new Error("CRT reflection: GPU allocation failed.");
    releases.push(() => remove(value));
    return value;
  };
  try {
    const compile = (type: number, source: string) => {
      const shader = own(gl.createShader(type), value => gl.deleteShader(value));
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`CRT reflection: ${gl.getShaderInfoLog(shader)}`);
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
void main() {
  vec2 positions[3] = vec2[3](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
  gl_Position = vec4(positions[gl_VertexID], 0, 1);
}`);
    const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
uniform sampler2D Coordinates;
uniform sampler2D SourceFrame;
uniform vec2 FrameSize;
out vec4 color;
void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  pixel.y = textureSize(Coordinates, 0).y - 1 - pixel.y;
  vec2 source = texelFetch(Coordinates, pixel, 0).rg;
  vec2 uv = (source + 0.5) / FrameSize;
  color = vec4(texture(SourceFrame, vec2(uv.x, 1.0 - uv.y)).rgb, 1);
}`);
    const program = own(gl.createProgram(), value => gl.deleteProgram(value));
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`CRT reflection: ${gl.getProgramInfoLog(program)}`);
    const uniform = (name: string) => {
      const location = gl.getUniformLocation(program, name);
      if (!location) throw new Error(`CRT reflection: missing ${name} uniform.`);
      return location;
    };
    const coordinates = uniform("Coordinates"), sourceFrame = uniform("SourceFrame"), frameSize = uniform("FrameSize");
    const vao = own(gl.createVertexArray(), value => gl.deleteVertexArray(value));
    const texture = (filter: number) => {
      const value = own(gl.createTexture(), entry => gl.deleteTexture(entry));
      gl.bindTexture(gl.TEXTURE_2D, value);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return value;
    };
    const map = texture(gl.NEAREST), image = texture(gl.LINEAR);
    let imageWidth = 0, imageHeight = 0, checkDraw = true;
    const available = () => {
      if (disposed || gl.isContextLost()) throw new Error("CRT reflection: GPU context unavailable.");
    };
    return {
      setCoordinates(sources: Float32Array, width: number, height: number) {
        available();
        if (sources.length !== width * height * 2) throw new RangeError("CRT reflection: invalid coordinate map.");
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, map);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, sources);
        checkDraw = true;
      },
      render(frame: HTMLCanvasElement) {
        available();
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, map);
        gl.uniform1i(coordinates, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, image);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        if (imageWidth !== frame.width || imageHeight !== frame.height) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
          imageWidth = frame.width;
          imageHeight = frame.height;
        } else {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, frame);
        }
        gl.uniform1i(sourceFrame, 1);
        gl.uniform2f(frameSize, frame.width, frame.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (checkDraw) {
          const error = gl.getError();
          if (error !== gl.NO_ERROR) throw new Error(`CRT reflection: GPU error ${error}.`);
          checkDraw = false;
        }
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

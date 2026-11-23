import type { Rgb } from '../../../../lib/cover-palette';
import fragmentSource from './scene-material.glsl?raw';

const transparentFragmentSource = fragmentSource
  .replace('gl_FragColor=vec4(0.0,0.0,0.0,1.0);', 'gl_FragColor=vec4(0.0);')
  .replace(
    'gl_FragColor=vec4(color,1.0);',
    `vec3 lightOnly = clamp(color, 0.0, 1.0);
    float lightAlpha = max(lightOnly.r, max(lightOnly.g, lightOnly.b));
    gl_FragColor = vec4(lightOnly / max(lightAlpha, 0.0001), lightAlpha);`,
  );

const vertexSource = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }
`;

export type SceneColors = [ink: Rgb, primary: Rgb, secondary: Rgb, highlight: Rgb];

export type SceneReaction = {
  energy: number;
  bass: number;
  pulse: number;
  flux: number;
  available: boolean;
};

export const stillReaction: SceneReaction = {
  energy: 0,
  bass: 0,
  pulse: 0,
  flux: 0,
  available: false,
};

export type AmbientMatter = {
  setColors: (colors: SceneColors) => void;
  draw: (phase: number, reaction: SceneReaction, blend: number, exposure?: number) => void;
  destroy: () => void;
};

const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (x: number) => x * x * (3 - 2 * x);

export function sceneScale(reaction: SceneReaction, playback: number) {
  if (!reaction.available) return 1;
  const bass = unit((reaction.bass - 0.04) / 0.96);
  return 1 + playback * (reaction.energy * 0.13 + smooth(bass) * 0.53 + reaction.pulse * 0.3);
}

function contour(reaction: SceneReaction, playback: number) {
  if (!reaction.available) return 0.65 + 0.15 * playback;
  const strength = unit(
    (reaction.energy * 0.58 + reaction.bass * 0.28 + reaction.pulse * 0.38 - 0.055) / 0.6,
  );
  return 0.65 + 0.35 * smooth(strength) * playback;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

export function createAmbientMatter(canvas: HTMLCanvasElement): AmbientMatter | null {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(
    gl,
    gl.FRAGMENT_SHADER,
    `#define DOPPO_DESKTOP\n${transparentFragmentSource}`,
  );

  const destroy = () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
  };

  if (!program || !buffer || !vertex || !fragment) {
    destroy();
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    destroy();
    return null;
  }

  gl.useProgram.call(gl, program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const resolution = uniform('resolution');
  const time = uniform('time');
  const response = uniform('reaction');
  const lineExposure = uniform('lineExposure');
  const verticalOffset = uniform('verticalOffset');
  const playback = uniform('playback');
  const fieldScale = uniform('fieldScale');
  const contourLevel = uniform('contour');
  const colorUniforms = ['ink', 'primary', 'secondary', 'highlight'].map(uniform);

  return {
    setColors(colors) {
      colors.forEach(([r, g, b], index) => {
        gl.uniform3f(colorUniforms[index], r / 255, g / 255, b / 255);
      });
    },
    draw(phase, reaction, blend, exposure = 1) {
      const aspect = canvas.width / canvas.height;
      const portrait = 1 - smooth(unit((aspect - 0.78) / 0.37));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, phase);
      gl.uniform4f(response, reaction.energy, reaction.bass, reaction.pulse, reaction.flux);
      gl.uniform1f(lineExposure, exposure);
      gl.uniform1f(verticalOffset, 0.1 + 0.04 * portrait);
      gl.uniform1f(playback, blend);
      gl.uniform1f(fieldScale, sceneScale(reaction, blend));
      gl.uniform1f(contourLevel, contour(reaction, blend));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy,
  };
}

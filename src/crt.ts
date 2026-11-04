import type { CrtConfig } from "./types";

export const defaultCrt: CrtConfig = {
  enabled: false, bezelEnabled: false, inheritShader: false, inheritBezel: false, mask: 1, gamma: 2.2, bloom: 0.075, smoothing: true, resolution: 1,
  bezel: "none", left: 8, top: 7, width: 84, height: 80,
  reflection: false, bezelThickness: 5, background: false, innerBorder: true, cornerRadius: 4, curvature: 0,
};

/** The shader input is the Flash stage size times this scale; invalid values fall back to 1×. */
export function crtResolution(config: Pick<CrtConfig, "resolution">) {
  const scale = config.resolution;
  return Number.isFinite(scale) && scale >= 1 && scale <= 3 ? Math.round(scale * 2) / 2 : defaultCrt.resolution;
}

/** Shader input size for a stage, never larger than the rendered game canvas or 4096 pixels. */
export function crtInputSize(config: Pick<CrtConfig, "resolution">, stageWidth: number, stageHeight: number, canvasWidth = Infinity, canvasHeight = Infinity) {
  const scale = Math.max(1, Math.min(crtResolution(config), canvasWidth / stageWidth, canvasHeight / stageHeight));
  const size = (value: number) => Math.max(1, Math.min(4096, Math.round(value * scale)));
  return { width: size(stageWidth), height: size(stageHeight) };
}

/** Inner bezel thickness is saved as a level from 1 to 10; anything else (including older percentages) uses the default. */
function crtThicknessLevel(config: Pick<CrtConfig, "bezelThickness">) {
  const level = config.bezelThickness;
  return Number.isInteger(level) && level >= 1 && level <= 10 ? level : defaultCrt.bezelThickness;
}

/** Level 1 is a 2% border, the default level 5 is the 3.5% middle and level 10 is 5%, measured against the whole monitor. */
export function crtThicknessPercent(config: Pick<CrtConfig, "bezelThickness">) {
  const level = crtThicknessLevel(config);
  return level <= 5 ? 2 + (level - 1) * 0.375 : 3.5 + (level - 5) * 0.3;
}

export function normalizeCrt(config: CrtConfig | undefined): CrtConfig {
  const merged = { ...defaultCrt, ...config };
  if (config?.bezelEnabled === undefined) merged.bezelEnabled = merged.enabled && (merged.bezel !== "none" || merged.background);
  return { ...merged, bezelThickness: crtThicknessLevel(merged), resolution: crtResolution(merged) };
}

export function crtShaderSettings(config: CrtConfig) {
  const { enabled, mask, gamma, bloom, smoothing, resolution } = config;
  return { enabled, mask, gamma, bloom, smoothing, resolution };
}

export function crtBezelSettings(config: CrtConfig) {
  const { bezelEnabled, bezel, left, top, width, height, reflection, bezelThickness, background, innerBorder, cornerRadius, curvature } = config;
  return { bezelEnabled, bezel, left, top, width, height, reflection, bezelThickness, background, innerBorder, cornerRadius, curvature };
}

export function resolveCrtSections(global: CrtConfig, saved?: CrtConfig): CrtConfig {
  const defaults = normalizeCrt(global);
  const config = normalizeCrt(saved ?? defaults);
  return {
    ...config,
    ...(saved?.inheritShader ? crtShaderSettings(defaults) : {}),
    ...(saved?.inheritBezel ? crtBezelSettings(defaults) : {}),
  };
}

export function restoreCrtSection(global: CrtConfig, saved: CrtConfig, section: "shader" | "bezel"): CrtConfig {
  const defaults = normalizeCrt(global);
  return section === "shader"
    ? { ...saved, ...crtShaderSettings(defaults), inheritShader: true }
    : { ...saved, ...crtBezelSettings(defaults), inheritBezel: true };
}

export function resetCrtSection(config: CrtConfig, section: "shader" | "bezel"): CrtConfig {
  return {
    ...config,
    ...(section === "shader" ? crtShaderSettings(defaultCrt) : crtBezelSettings(defaultCrt)),
  };
}

/** Reflections and the ambient backdrop sample the game image, so the player must keep readable frames. */
export function crtNeedsFrames(config: CrtConfig) {
  return (config.innerBorder && config.reflection && config.bezel !== "none") || config.background;
}

export function crtNeedsCapture(config: CrtConfig) {
  return config.enabled || crtNeedsFrames(config);
}

/** Any shader, bezel or lighting effect keeps the launch hidden until it can appear fully composed. */
export function crtHidesLaunch(config: CrtConfig) {
  return crtNeedsCapture(config) || config.bezel !== "none";
}

export const crtPresets = {
  balanced: { mask: 1, gamma: 2.2, bloom: 0.075 },
  crisp: { mask: 0, gamma: 2.2, bloom: 0.025 },
  arcade: { mask: 1, gamma: 2.1, bloom: 0.15 },
  desktop: { mask: 2, gamma: 2.2, bloom: 0.05 },
} satisfies Record<string, Pick<CrtConfig, "mask" | "gamma" | "bloom">>;

type CrtPreset = keyof typeof crtPresets;

export function matchingCrtPreset(config: CrtConfig): CrtPreset | "custom" {
  return (Object.keys(crtPresets) as CrtPreset[]).find(key => {
    const preset = crtPresets[key];
    return config.mask === preset.mask && config.gamma === preset.gamma && config.bloom === preset.bloom;
  }) ?? "custom";
}

// In a landscape monitor the home surround spans 2.5%–97.5% of the width and 2.5%–80% of the height. Portrait monitors
// scale the top margin and the lower control panel by the aspect, so they keep the proportions of a square monitor.
const HOME_SURROUND_WIDTH = 95;

export function crtHomeLayout(config: Pick<CrtConfig, "bezel">) {
  return config.bezel === "home" || config.bezel.startsWith("home-");
}

/** Vertical scale of the home monitor's top margin and control panel: 1 for landscape, the aspect for portrait. */
export function crtHomeScale(frameAspect: number) {
  return Math.min(1, frameAspect);
}

/**
 * Monitor width/height for a game shown at `gameAspect` (width/height). The home opening's top and bottom
 * borders depend on this aspect, so it is solved for directly instead of from a fixed-percentage opening.
 */
export function crtFrameAspect(config: CrtConfig, gameAspect: number) {
  const outer = crtSurroundConfig(config);
  const thickness = config.innerBorder ? Math.min(crtThicknessPercent(config), outer.width / 4) : 0;
  if (crtHomeLayout(config)) {
    const sides = HOME_SURROUND_WIDTH - 2 * thickness + 2 * thickness * gameAspect;
    const landscape = (100 - 22.5) * gameAspect / sides;
    return landscape >= 1 ? landscape : 100 * gameAspect / (sides + 22.5 * gameAspect);
  }
  const opening = crtSurroundConfig(config);
  return config.bezel === "none" ? gameAspect : gameAspect * opening.height / (opening.width - 2 * thickness + 2 * thickness * gameAspect);
}

/** Outer aperture in the monitor cabinet, before adding the optional inner border. */
export function crtSurroundConfig(config: CrtConfig, frameAspect = 4 / 3): CrtConfig {
  if (crtHomeLayout(config)) {
    const scale = crtHomeScale(frameAspect);
    return {
      ...config,
      left: 2.5, top: 2.5 * scale,
      width: HOME_SURROUND_WIDTH, height: 100 - 22.5 * scale,
    };
  }
  return config.bezel !== "none" && config.bezel !== "custom" ? { ...config, left: 3, top: 3, width: 94, height: 89 } : config;
}

/** All inner borders have equal pixel thickness, including on portrait monitors. */
export function crtBezelConfig(config: CrtConfig, frameAspect = 4 / 3): CrtConfig {
  const outer = crtSurroundConfig(config, frameAspect);
  if (!config.innerBorder || config.bezel === "none") return outer;
  const horizontal = Math.min(crtThicknessPercent(config), outer.width / 4, outer.height / frameAspect / 2 - 0.0001);
  const vertical = horizontal * frameAspect;
  return { ...outer, left: outer.left + horizontal, top: outer.top + vertical,
    width: outer.width - 2 * horizontal, height: outer.height - 2 * vertical };
}

/** Radius in monitor-width units; both the CSS mask and reflection use this geometry. */
export function crtRadius(config: CrtConfig, frameAspect: number) {
  const opening = crtBezelConfig(config, frameAspect);
  return config.cornerRadius / 100 * Math.min(
    config.bezel === "none" ? 100 : opening.width,
    (config.bezel === "none" ? 100 : opening.height) / frameAspect);
}

export function effectiveCrt(global: CrtConfig, saved?: CrtConfig, disabled?: boolean, bezelDisabled?: boolean,
  session: { shader: boolean | null; bezel: boolean | null } = { shader: null, bezel: null }): CrtConfig {
  const defaults = normalizeCrt(global);
  const source = resolveCrtSections(defaults, saved);
  const config = sessionCrtConfig(source, session.shader, session.bezel);
  const optedOut = session.shader === null
    ? disabled ?? (saved ? !source.enabled : false) : !session.shader;
  const bezelOptedOut = session.bezel === null
    ? bezelDisabled ?? (saved ? !source.bezelEnabled : false) : !session.bezel;
  const bezelEnabled = defaults.bezelEnabled && !bezelOptedOut;
  const hasBezel = bezelEnabled && config.bezel !== "none";
  return {
    ...config, enabled: defaults.enabled && !optedOut, bezelEnabled,
    bezel: hasBezel ? config.bezel : "none", innerBorder: hasBezel && source.innerBorder,
    reflection: hasBezel && source.innerBorder && source.reflection,
    background: bezelEnabled && source.background,
  };
}

export function sessionCrtConfig(saved: CrtConfig, shader: boolean | null, bezel: boolean | null): CrtConfig {
  return {
    ...saved,
    enabled: shader ?? saved.enabled,
    bezelEnabled: bezel ?? saved.bezelEnabled,
    bezel: bezel === false ? "none" : bezel === true && saved.bezel === "none" ? "builtin" : saved.bezel,
  };
}

/** Built-in bezels draw the dark tube edge themselves so it follows their rounded opening. */
export function crtBezelDrawsEdge(config: Pick<CrtConfig, "bezel">) {
  return config.bezel !== "none" && config.bezel !== "custom";
}

export function crtCurvature(config: Pick<CrtConfig, "curvature" | "innerBorder" | "bezel">) {
  return config.innerBorder && config.bezel !== "none" ? config.curvature : 0;
}

export function crtParameters(config: CrtConfig, aspect: number) {
  const curvature = crtCurvature(config);
  return {
    crt_gamma: config.gamma, lcd_gamma: 2.2, mask_type: config.mask,
    diffusion_weight: config.bloom, geom_mode_runtime: curvature > 0 ? 1 : 0,
    geom_radius: curvature > 0 ? 10 / curvature : 2,
    geom_aspect_ratio_x: aspect, geom_aspect_ratio_y: 1,
    // CSS draws flat edges; curved geometry needs a fine falloff along its bowed silhouette.
    border_size: curvature > 0 ? 0.003 : 0.0000001,
  };
}

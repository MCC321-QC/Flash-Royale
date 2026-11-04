import { ChevronDown, Copy, Download, ImageUp, Palette, PencilRuler, RotateCcw, SwatchBook, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SettingsSection } from "./SettingsSections";
import { useControllerNavigation } from "./ControllerNavigation";
import type { Language } from "./i18n";
import { themeLabels, type ThemeColorGroup } from "./i18n-theme";
import {
  MAX_CUSTOM_THEMES, ROUNDNESS_RANGE, SHADOW_RANGE, activeTheme, bodyFonts, builtinThemeIds, builtinThemes, currentThemeSettings, duplicateTheme,
  importWallpaperImage, isBuiltinTheme, parseThemeFile, previewThemeLocally, sanitizeThemeDefinition, saveThemeSettings, serializeThemeFile,
  themeFileName, themeSkins, titleFonts, useThemeSettings, wallpaperCss, wallpaperKinds,
  type ThemeColorRole, type ThemeDefinition, type ThemeSettings,
} from "./theme";

const colorGroups: Record<ThemeColorGroup, ThemeColorRole[]> = {
  backgrounds: ["bg", "surface", "surface-2", "raised", "border", "depth", "shadow"],
  text: ["text", "text-soft", "text-muted", "text-dim", "overlay", "on-accent"],
  accents: ["accent", "accent-bright", "highlight", "info", "info-text"],
  status: ["danger", "danger-text", "success", "success-text", "warning"],
};
const EDIT_SAVE_DELAY = 350;

function previewBackground(theme: ThemeDefinition) {
  const { wallpaper, colors } = theme;
  if (wallpaper.kind === "image" && wallpaper.image) return `url("${wallpaper.image}") center / cover no-repeat, ${wallpaper.color}`;
  if (wallpaper.kind === "dots") return `radial-gradient(circle, rgb(from ${colors.text} r g b / 0.22) 1.2px, transparent 1.8px) 0 0 / 8px 8px, ${wallpaper.color}`;
  if (wallpaper.kind === "solid") return wallpaper.color;
  // Pattern wallpapers read their colors from variables, which ThemePreview scopes onto the preview.
  const pattern = wallpaperCss(wallpaper);
  if (pattern) return pattern;
  return `linear-gradient(160deg, ${colors.surface}, ${colors.bg})`;
}

/** Mini panel per skin: panel fill, frame, text lines and the primary button. */
function previewParts(theme: ThemeDefinition) {
  const { colors, shadows } = theme;
  const glow = (color: string, size: number) => `0 0 ${size * shadows}px ${color}`;
  switch (theme.skin) {
    case "retro-royale":
      return { panel: colors.text, frame: colors.bg, width: 2, shadow: `${2 * shadows}px ${2 * shadows}px 0 ${colors.shadow}`, line: colors.bg, short: colors["text-dim"],
        button: colors.accent, outline: `1.5px solid ${colors.bg}` };
    case "card-suits":
      return { panel: colors.surface, frame: colors.accent, width: 1, line: colors.text, short: colors["text-muted"], button: colors.text, outline: `1px solid ${colors.border}` };
    case "casino":
      return { panel: colors.surface, frame: colors.accent, width: 1, outline: undefined, line: colors.accent, short: colors["text-muted"],
        button: `linear-gradient(180deg, ${colors["accent-bright"]}, ${colors.accent})`, shadow: glow(`rgb(from ${colors.accent} r g b / 0.4)`, 6) };
    case "neon":
      return { panel: colors.surface, frame: colors.accent, width: 1, line: colors.text, short: colors.highlight, button: colors.accent,
        shadow: glow(`rgb(from ${colors.accent} r g b / 0.55)`, 8) };
    case "classic-flash":
      return { panel: `linear-gradient(180deg, ${colors.raised}, ${colors.surface})`, frame: colors.border, width: 1, line: colors.text, short: colors["text-muted"],
        button: `linear-gradient(180deg, ${colors["accent-bright"]} 0 50%, ${colors.accent} 50%)`, outline: `1px solid rgb(from ${colors.depth} r g b / 0.6)` };
    default:
      return { panel: colors.surface, frame: colors.border, width: 1, line: colors.text, short: colors["text-muted"], button: colors.accent };
  }
}

function ThemePreview({ theme }: { theme: ThemeDefinition }) {
  const { colors } = theme;
  const parts = previewParts(theme);
  const radius = (px: number) => `${px * theme.roundness}px`;
  const scope = { "--fr-wallpaper-color": theme.wallpaper.color, "--fr-text": colors.text, "--fr-accent": colors.accent, "--fr-highlight": colors.highlight } as CSSProperties;
  return (
    <span className="theme-preview" aria-hidden="true" style={{ ...scope, background: previewBackground(theme) }}>
      <span className="theme-preview-panel" style={{
        background: parts.panel, borderColor: parts.frame, borderWidth: parts.width, borderRadius: radius(6), boxShadow: parts.shadow,
      }}>
        <span className="theme-preview-line" style={{ background: parts.line }} />
        <span className="theme-preview-line short" style={{ background: parts.short }} />
        <span className="theme-preview-accent" style={{ background: parts.button, borderRadius: radius(4), outline: parts.outline }} />
      </span>
    </span>
  );
}

export function ThemeSettingsPanel({ language }: { language: Language }) {
  const text = themeLabels[language];
  const navigation = useControllerNavigation();
  const { settings, active } = useThemeSettings();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [nameDraft, setNameDraft] = useState(active.name);
  const draft = useRef<ThemeDefinition | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const displayName = (theme: ThemeDefinition) => isBuiltinTheme(theme) ? text.builtinNames[theme.id as keyof typeof text.builtinNames] : theme.name;
  const editable = !isBuiltinTheme(active);

  // Edits preview live in this window and are saved (and broadcast to the other windows) once the user pauses.
  const commit = () => {
    window.clearTimeout(timer.current);
    const theme = draft.current;
    if (!theme) return;
    draft.current = null;
    const latest = currentThemeSettings();
    void saveThemeSettings({ ...latest, custom: latest.custom.map((entry) => entry.id === theme.id ? theme : entry) });
    previewThemeLocally(null);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => () => commitRef.current(), []);
  useEffect(() => { if (!draft.current) setNameDraft(active.name); }, [active.id, active.name]);

  const edit = (change: (theme: ThemeDefinition) => ThemeDefinition) => {
    const base = draft.current ?? activeTheme();
    if (isBuiltinTheme(base)) return;
    const next = sanitizeThemeDefinition(change(base), base.id);
    if (!next) return;
    draft.current = next;
    previewThemeLocally(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commit, EDIT_SAVE_DELAY);
  };

  const save = (change: (latest: ThemeSettings) => ThemeSettings) => {
    commit();
    setConfirmRemove(false);
    setStatus("");
    setError("");
    void saveThemeSettings(change(currentThemeSettings()));
  };

  const run = async (action: () => Promise<void>) => {
    commit();
    setError("");
    setStatus("");
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  };

  const addTheme = (theme: ThemeDefinition) => {
    if (currentThemeSettings().custom.length >= MAX_CUSTOM_THEMES) {
      setError(text.tooMany.replace("{n}", String(MAX_CUSTOM_THEMES)));
      return false;
    }
    save((latest) => ({ active: theme.id, custom: [...latest.custom, theme] }));
    return true;
  };

  const duplicate = () => {
    setError("");
    setStatus("");
    addTheme(duplicateTheme(activeTheme(), text.copyName.replace("{name}", displayName(activeTheme()))));
  };

  const importTheme = () => run(async () => {
    try {
      const files = await navigation.chooseFiles("json");
      if (!files?.length || !window.flashApi.readThemeFile) return;
      const theme = parseThemeFile(await window.flashApi.readThemeFile(files[0]));
      if (!theme) { setError(text.importFailed); return; }
      if (addTheme(theme)) setStatus(text.imported.replace("{name}", theme.name));
    } catch {
      setError(text.importFailed);
    }
  });

  const exportTheme = () => run(async () => {
    try {
      const theme = activeTheme();
      const folder = await navigation.chooseFiles("folder");
      if (!folder?.length || !window.flashApi.exportThemeFile) return;
      const shared = isBuiltinTheme(theme) ? { ...theme, name: displayName(theme) } : theme;
      const path = await window.flashApi.exportThemeFile(themeFileName(shared), serializeThemeFile(shared), folder[0]);
      if (path) setStatus(text.exported.replace("{path}", path));
    } catch {
      setError(text.exportFailed);
    }
  });

  const remove = () => {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    const theme = activeTheme();
    save((latest) => ({ active: theme.skin, custom: latest.custom.filter((entry) => entry.id !== theme.id) }));
  };

  const chooseWallpaper = () => run(async () => {
    try {
      const files = await navigation.chooseFiles("image");
      if (!files?.length || !window.flashApi.readThemeWallpaper) return;
      const image = await importWallpaperImage(await window.flashApi.readThemeWallpaper(files[0]));
      edit((theme) => ({ ...theme, wallpaper: { ...theme.wallpaper, kind: "image", image } }));
    } catch {
      setError(text.imageFailed);
    }
  });

  const pickColor = (label: string, value: string, apply: (theme: ThemeDefinition, color: string) => ThemeDefinition) =>
    navigation.pickColor({ value, label, onPick: (color) => edit((theme) => apply(theme, color)) });

  const themes = [...builtinThemeIds.map((id) => builtinThemes[id]), ...settings.custom];
  const percent = (value: number) => `${Math.round(value * 100)}%`;

  const select = <T extends string>(label: string, value: T, options: readonly T[], names: Record<T, string>, onChange: (value: T) => void) => (
    <label className="settings-controller-row theme-settings-row">
      <span>{label}</span>
      <div className="settings-select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => <option key={option} value={option}>{names[option]}</option>)}
        </select>
        <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
      </div>
    </label>
  );

  const slider = (label: string, value: number, [min, max]: readonly [number, number], onChange: (value: number) => void) => (
    <label className="remap-slider theme-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output>{percent(value)}</output>
    </label>
  );

  return (
    <details className="settings-controller-collapse theme-settings" open>
      <summary>
        <span className="controller-summary-title">
          <Palette size={15} aria-hidden="true" />
          <span>{text.title}</span>
        </span>
      </summary>
      <section className="settings-controller-subsection" aria-label={text.title}>
        <small className="theme-settings-description">{text.description}</small>
        <SettingsSection title={text.choose} icon={SwatchBook}>
          <div className="cursor-style-grid theme-grid" role="radiogroup" aria-label={text.choose} data-controller-navigation="grid">
            {themes.map((theme) => (
              <button key={theme.id} type="button" role="radio" aria-checked={settings.active === theme.id} className="cursor-style-option theme-option"
                onClick={() => { if (settings.active !== theme.id) save((latest) => ({ ...latest, active: theme.id })); }}>
                <ThemePreview theme={theme.id === active.id ? active : theme} />
                <span className="cursor-style-name">{displayName(theme)}</span>
              </button>
            ))}
          </div>
          {active.skin === "retro-royale" && <small>{text.retroCredit}</small>}
          {!editable && <small>{text.builtinHint}</small>}
          <div className="cursor-custom-actions">
            <button type="button" className="secondary" disabled={busy} onClick={duplicate}>
              <Copy size={15} aria-hidden="true" />
              <span>{text.duplicate}</span>
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => void importTheme()}>
              <Upload size={15} aria-hidden="true" />
              <span>{text.importTheme}</span>
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => void exportTheme()}>
              <Download size={15} aria-hidden="true" />
              <span>{text.exportTheme}</span>
            </button>
            {editable && (
              <button type="button" className={`secondary theme-delete${confirmRemove ? " confirming" : ""}`} disabled={busy}
                onBlur={() => setConfirmRemove(false)} onClick={remove}>
                <Trash2 size={15} aria-hidden="true" />
                <span>{confirmRemove ? text.confirmRemove : text.remove}</span>
              </button>
            )}
          </div>
          {status && <p role="status" className="cursor-pack-status">{status}</p>}
          {error && <p role="alert" className="remap-error">{error}</p>}
        </SettingsSection>
        {editable && <SettingsSection title={text.edit} icon={PencilRuler}>
          <label className="settings-field theme-name-field">
            <span>{text.name}</span>
            <input type="text" value={nameDraft} maxLength={48} spellCheck={false} autoComplete="off"
              onChange={(event) => {
                setNameDraft(event.target.value);
                const name = event.target.value.trim();
                if (name) edit((theme) => ({ ...theme, name }));
              }}
              onBlur={() => { if (!nameDraft.trim()) setNameDraft(activeTheme().name); }} />
          </label>
          {select(text.style, active.skin, themeSkins, text.styles, (skin) => edit((theme) => ({ ...theme, skin })))}
          {select(text.scheme, active.scheme, ["dark", "light"] as const, text.schemes, (scheme) => edit((theme) => ({ ...theme, scheme })))}

          <h4 className="theme-group-title">{text.colors}</h4>
          {(Object.keys(colorGroups) as ThemeColorGroup[]).map((group) => (
            <div key={group} className="theme-color-group" role="group" aria-label={text.colorGroups[group]}>
              <span className="theme-color-group-name">{text.colorGroups[group]}</span>
              <div className="theme-color-list" data-controller-navigation="grid">
                {colorGroups[group].map((role) => (
                  <button key={role} type="button" className="secondary theme-color-button"
                    onClick={() => pickColor(text.roles[role], active.colors[role], (theme, color) => ({ ...theme, colors: { ...theme.colors, [role]: color } }))}>
                    <span className="theme-color-swatch" style={{ "--swatch": active.colors[role] } as CSSProperties} aria-hidden="true" />
                    <span className="theme-color-name">{text.roles[role]}</span>
                    <code dir="ltr">{active.colors[role]}</code>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {select(text.wallpaper, active.wallpaper.kind, wallpaperKinds, text.wallpapers, (kind) => {
            if (kind === "image" && !activeTheme().wallpaper.image) { void chooseWallpaper(); return; }
            edit((theme) => ({ ...theme, wallpaper: { ...theme.wallpaper, kind } }));
          })}
          <div className="cursor-custom-actions theme-wallpaper-actions">
            {active.wallpaper.kind !== "gradient" && (
              <button type="button" className="secondary theme-color-button"
                onClick={() => pickColor(text.wallpaperColor, active.wallpaper.color, (theme, color) => ({ ...theme, wallpaper: { ...theme.wallpaper, color } }))}>
                <span className="theme-color-swatch" style={{ "--swatch": active.wallpaper.color } as CSSProperties} aria-hidden="true" />
                <span className="theme-color-name">{text.wallpaperColor}</span>
                <code dir="ltr">{active.wallpaper.color}</code>
              </button>
            )}
            {active.wallpaper.kind === "image" && (
              <button type="button" className="secondary" disabled={busy} onClick={() => void chooseWallpaper()}>
                <ImageUp size={15} aria-hidden="true" />
                <span>{text.chooseImage}</span>
              </button>
            )}
          </div>

          {select(text.bodyFont, active.font.body, bodyFonts, text.bodyFonts, (body) => edit((theme) => ({ ...theme, font: { ...theme.font, body } })))}
          {select(text.titleFont, active.font.titles, titleFonts, text.titleFonts, (titles) => edit((theme) => ({ ...theme, font: { ...theme.font, titles } })))}
          {slider(text.roundness, active.roundness, ROUNDNESS_RANGE, (roundness) => edit((theme) => ({ ...theme, roundness })))}
          {slider(text.shadows, active.shadows, SHADOW_RANGE, (shadows) => edit((theme) => ({ ...theme, shadows })))}

          <div className="cursor-custom-actions">
            <button type="button" className="secondary" onClick={() => edit((theme) => {
              const base = builtinThemes[theme.skin];
              return { ...structuredClone(base), id: theme.id, name: theme.name };
            })}>
              <RotateCcw size={15} aria-hidden="true" />
              <span>{text.reset.replace("{style}", text.builtinNames[active.skin])}</span>
            </button>
          </div>
        </SettingsSection>}
      </section>
    </details>
  );
}

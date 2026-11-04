import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import type { SteamRemapText } from "./i18n-steam";
import { DEFAULT_TRACKPAD } from "./steam-trackpad";
import type { TrackpadTuning } from "./types";

/** Steam Controller trackpad sliders shared by the remap window (per player) and Settings (app UI pointer). */
export function TrackpadTuningEditor({ text, hint, tuning, disabled, onChange, descriptions, showTitle = true, className = "", children, onReset, resetDisabled }: {
  text: SteamRemapText;
  hint: ReactNode;
  tuning: TrackpadTuning;
  disabled?: boolean;
  onChange: (change: Partial<TrackpadTuning>) => void;
  descriptions?: { sensitivity: string; acceleration: string; haptics: string; trackball: string };
  showTitle?: boolean;
  className?: string;
  children?: ReactNode;
  onReset?: () => void;
  resetDisabled?: boolean;
}) {
  const slider = (key: "sensitivity" | "acceleration" | "haptics", label: string, min: number, max: number, step: number) => {
    const control = <label className="remap-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={tuning[key]} disabled={disabled}
        onChange={(event) => onChange({ [key]: Number(event.target.value) })} />
      <output>{tuning[key]}%</output>
    </label>;
    return descriptions ? <div className="settings-option">{control}<small>{descriptions[key]}</small></div> : control;
  };
  return (
    <div className={`remap-options remap-trackpad ${className}`.trim()}>
      <div className="remap-options-title">
        {showTitle && <strong>{text.trackpadTitle}</strong>}
        <small>{hint}</small>
      </div>
      {children}
      <label className="settings-toggle">
        <input type="checkbox" checked={tuning.trackball} disabled={disabled} onChange={(event) => onChange({ trackball: event.target.checked })} />
        <span>{text.trackball}</span>
      </label>
      {descriptions && <small>{descriptions.trackball}</small>}
      {slider("sensitivity", text.trackpadSensitivity, 10, 400, 5)}
      {slider("acceleration", text.trackpadAcceleration, 0, 300, 10)}
      {slider("haptics", text.haptics, 0, 100, 5)}
      <div className="remap-capture-actions">
        <button type="button" className="secondary" disabled={disabled || (resetDisabled ?? JSON.stringify(tuning) === JSON.stringify(DEFAULT_TRACKPAD))}
          onClick={() => onReset ? onReset() : onChange({ ...DEFAULT_TRACKPAD })}>
          <RotateCcw size={14} aria-hidden="true" />{text.resetTrackpad}
        </button>
      </div>
    </div>
  );
}

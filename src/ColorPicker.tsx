import { useId, useLayoutEffect, useRef, useState } from "react";
import type { Language } from "./i18n";
import { colorPickerLabels } from "./i18n-color";
import { navigationLabels } from "./i18n-navigation";
import { focusControl, navigationControls } from "./controller-navigation";

export interface ColorPickerRequest {
  value: string;
  label: string;
  onPick: (color: string) => void;
}

const presets = ["#ffffff", "#cbd5e1", "#64748b", "#05070a", "#ef4444", "#f59e0b", "#facc15", "#9fe8b1", "#22c55e", "#73d2de", "#3b82f6", "#a855f7"];
export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
export const colorChannels = (value: string) => [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16));
export const channelColor = (values: number[]) => `#${values.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0")).join("")}`;

export function ColorPicker({ value, label, onPick, language, onClose }: ColorPickerRequest & { language: Language; onClose: () => void }) {
  const text = colorPickerLabels[language];
  const common = navigationLabels[language];
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const [color, setColor] = useState(value);
  const [hex, setHex] = useState(value);
  const valid = isHexColor(hex);
  const channels = colorChannels(color);
  const choose = (next: string) => { setColor(next); setHex(next); };
  useLayoutEffect(() => {
    const first = panel.current?.querySelector<HTMLElement>("[data-controller-autofocus]");
    if (first) focusControl(first);
  }, []);
  return <section ref={panel} className="controller-panel color-picker" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
    onKeyDown={event => {
      if (event.key !== "Tab" || !panel.current) return;
      const controls = navigationControls(panel.current);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <h2 id={`${id}-title`}>{label}</h2>
    <div className="color-picker-preview" style={{ backgroundColor: color }} aria-hidden="true" />
    <div className="color-picker-presets" data-controller-navigation="grid">
      {presets.map(preset => <button key={preset} type="button" className="color-swatch"
        aria-label={preset} aria-pressed={preset === color} style={{ backgroundColor: preset }} onClick={() => choose(preset)} />)}
    </div>
    {[text.red, text.green, text.blue].map((name, index) => <label key={name} className="remap-slider">
      <span>{name}</span>
      <input type="range" min={0} max={255} step={1} value={channels[index]} data-controller-autofocus={index === 0 ? "" : undefined}
        onChange={event => {
          const next = [...channels];
          next[index] = Number(event.target.value);
          choose(channelColor(next));
        }} />
      <output>{channels[index]}</output>
    </label>)}
    <label className="settings-field color-picker-hex" htmlFor={`${id}-hex`}>{text.hex}
      <input id={`${id}-hex`} type="text" value={hex} maxLength={7} spellCheck={false} autoComplete="off" dir="ltr"
        data-controller-no-keyboard="true" aria-invalid={!valid} aria-describedby={!valid ? `${id}-error` : undefined}
        onChange={event => {
          setHex(event.target.value);
          if (isHexColor(event.target.value)) setColor(event.target.value.toLowerCase());
        }} />
    </label>
    {!valid && <small id={`${id}-error`} role="alert" className="remap-error">{text.invalid}</small>}
    <div className="color-picker-actions">
      <button type="button" className="secondary" data-controller-back="" onClick={onClose}>{common.cancel}</button>
      <button type="button" disabled={!valid} onClick={() => { onPick(hex.toLowerCase()); onClose(); }}>{common.done}</button>
    </div>
  </section>;
}

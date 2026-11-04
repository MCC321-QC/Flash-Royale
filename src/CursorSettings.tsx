import { ChevronDown, Download, ImageUp, MonitorCog, MousePointer2, RotateCcw, Upload } from "lucide-react";
import { useState } from "react";
import { SettingsSection } from "./SettingsSections";
import { settingsHelp } from "./i18n-settings";
import { settingsSectionLabels } from "./i18n";
import { useControllerNavigation } from "./ControllerNavigation";
import {
  builtinCursorIds, builtinSlotArt, cursorIdleOptions, cursorSizes, cursorSlotFileName, cursorSlotForFileName, cursorSlots,
  currentCursorSettings, exportCursorPackFiles, importCursorImage, saveCursorSettings, svgDataUrl, useCursorSettings,
  type BuiltinCursorId, type CursorHotspotMode, type CursorSettings, type CursorSize, type CursorSlot, type CursorStyleId,
  type CustomCursorImage, type CustomCursorPack,
} from "./cursor-theme";
import type { Language } from "./i18n";
import { cursorLabels, cursorPackLabels } from "./i18n-cursor";

const isBuiltin = (style: CursorStyleId): style is BuiltinCursorId => (builtinCursorIds as readonly string[]).includes(style);

export function CursorSettingsPanel({ language, expanded = false }: { language: Language; expanded?: boolean }) {
  const text = cursorLabels[language];
  const packText = cursorPackLabels[language];
  const navigation = useControllerNavigation();
  const settings = useCursorSettings();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // Async actions merge into the latest settings so a change made while a dialog was open is kept.
  const update = (patch: Partial<CursorSettings>) => saveCursorSettings({ ...currentCursorSettings(), ...patch });
  const newPack = (): CustomCursorPack => ({ base: isBuiltin(settings.style) ? settings.style : "royal", images: {} });
  const pack = settings.custom;
  const updatePack = (change: (pack: CustomCursorPack) => CustomCursorPack) => {
    const latest = currentCursorSettings();
    update({ style: "custom", custom: change(latest.custom ?? newPack()) });
  };
  const setImages = (images: Partial<Record<CursorSlot, CustomCursorImage | undefined>>) =>
    updatePack((current) => {
      const next = { ...current.images, ...images };
      for (const slot of cursorSlots) if (!next[slot]) delete next[slot];
      return { ...current, images: next };
    });

  const run = async (action: () => Promise<void>) => {
    setError("");
    setStatus("");
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  };

  const replaceSlot = (slot: CursorSlot) => run(async () => {
    try {
      const files = await navigation.chooseFiles("cursor");
      if (!files?.length) return;
      const picked = await window.flashApi.chooseCursorImage(text.dialogTitle, text.filterName, files[0]);
      if (picked) setImages({ [slot]: await importCursorImage(picked.dataUrl) });
    } catch {
      setError(text.importFailed);
    }
  });

  const importFiles = () => run(async () => {
    let picked: { dataUrl: string; name: string }[] | null;
    try {
      const files = await navigation.chooseFiles("cursor", { multiple: true });
      if (!files?.length) return;
      picked = await window.flashApi.chooseCursorImages?.(packText.filesDialogTitle, text.filterName, files) ?? null;
    } catch {
      setError(text.importFailed);
      return;
    }
    if (!picked?.length) return;
    const images: Partial<Record<CursorSlot, CustomCursorImage>> = {};
    const applied: string[] = [];
    const ignored: string[] = [];
    const failed: string[] = [];
    for (const file of picked) {
      const slot = cursorSlotForFileName(file.name);
      if (!slot) { ignored.push(file.name); continue; }
      try {
        images[slot] = await importCursorImage(file.dataUrl);
        applied.push(file.name);
      } catch {
        failed.push(file.name);
      }
    }
    if (applied.length) setImages(images);
    setStatus([
      applied.length ? packText.applied.replace("{names}", applied.join(", ")) : "",
      ignored.length ? packText.ignored.replace("{names}", ignored.join(", ")) : "",
    ].filter(Boolean).join("\n"));
    if (failed.length) setError(`${text.importFailed} ${failed.join(", ")}`);
  });

  const exportPack = () => run(async () => {
    try {
      const current = currentCursorSettings().custom ?? newPack();
      const files = await exportCursorPackFiles(current.base, current.images);
      const folder = await navigation.chooseFiles("folder");
      if (!folder?.length) return;
      const result = await window.flashApi.exportCursorPack?.(packText.exportDialogTitle, files, folder[0]);
      if (result) setStatus(packText.exported.replace("{n}", String(result.count)).replace("{folder}", result.folder));
    } catch {
      setError(packText.exportFailed);
    }
  });

  const customPreview = pack?.images.default?.dataUrl ?? svgDataUrl(builtinSlotArt(pack?.base ?? newPack().base, "default").markup);

  const option = (id: CursorStyleId, preview: React.ReactNode) => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={settings.style === id}
      className="cursor-style-option"
      onClick={() => id === "custom" ? updatePack((current) => current) : update({ style: id })}
    >
      <span className="cursor-style-preview" aria-hidden="true">{preview}</span>
      <span className="cursor-style-name">{text.styles[id]}</span>
    </button>
  );

  const hotspotOptions = (image: CustomCursorImage) => (
    <>
      <option value="auto">{packText.hotspotAuto}</option>
      <option value="topLeft">{text.hotspotTopLeft}</option>
      <option value="center">{text.hotspotCenter}</option>
      {image.fileHotspot && <option value="file">{text.hotspotFile}</option>}
    </>
  );

  return (
    <details className="settings-controller-collapse cursor-settings" open={expanded || undefined}>
      <summary>
        <span className="controller-summary-title">
          <MousePointer2 size={15} aria-hidden="true" />
          <span>{text.title}</span>
        </span>
      </summary>
      <section className="settings-controller-subsection" aria-label={text.title}>
        <small className="cursor-settings-description">{text.description}</small>
        <SettingsSection title={text.title} icon={MousePointer2}>
        <small>{settingsHelp[language].cursorStyle}</small>
        <div className="cursor-style-grid" role="radiogroup" aria-label={text.title}>
          {option("system", <MonitorCog size={22} />)}
          {builtinCursorIds.map((id) => option(id, <img src={svgDataUrl(builtinSlotArt(id, "default").markup)} alt="" draggable={false} />))}
          {option("custom", <img src={customPreview} alt="" draggable={false} />)}
        </div>
        {settings.style === "custom" && pack && <>
          <label className="settings-controller-row cursor-settings-row">
            <span>{packText.base}</span>
            <div className="settings-select-wrap">
              <select value={pack.base} onChange={(event) => updatePack((current) => ({ ...current, base: event.target.value as BuiltinCursorId }))}>
                {builtinCursorIds.map((id) => <option key={id} value={id}>{text.styles[id]}</option>)}
              </select>
              <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
            </div>
          </label>
          <small>{packText.baseHint}</small>
          {Object.keys(pack.images).length > 0 && <small>{settingsHelp[language].cursorHotspot}</small>}
          <ul className="cursor-pack-list" aria-label={text.styles.custom}>
            {cursorSlots.map((slot) => {
              const image = pack.images[slot];
              const name = packText.slots[slot];
              return (
                <li key={slot} className={`cursor-pack-slot${image ? " replaced" : ""}`}>
                  <span className="cursor-pack-preview" aria-hidden="true">
                    <img src={image?.dataUrl ?? svgDataUrl(builtinSlotArt(pack.base, slot).markup)} alt="" draggable={false} />
                  </span>
                  <span className="cursor-pack-name">
                    <strong>{name}</strong>
                    <code>{cursorSlotFileName(slot)}</code>
                    {image && (
                      <span className="settings-select-wrap cursor-pack-hotspot">
                        <select
                          aria-label={`${name}: ${text.hotspot}`}
                          title={text.hotspot}
                          value={image.hotspot}
                          onChange={(event) => setImages({ [slot]: { ...image, hotspot: event.target.value as CursorHotspotMode } })}
                        >
                          {hotspotOptions(image)}
                        </select>
                        <ChevronDown className="settings-select-chevron" size={14} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <button type="button" className="icon cursor-pack-button" disabled={busy} aria-label={`${name}: ${packText.replace}`} title={packText.replace} onClick={() => void replaceSlot(slot)}>
                    <ImageUp size={16} aria-hidden="true" />
                  </button>
                  {image && (
                    <button type="button" className="icon cursor-pack-button" aria-label={`${name}: ${packText.resetSlot}`} title={packText.resetSlot} onClick={() => setImages({ [slot]: undefined })}>
                      <RotateCcw size={16} aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="cursor-custom-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => void importFiles()}>
              <Upload size={15} aria-hidden="true" />
              <span>{packText.importFiles}</span>
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => void exportPack()}>
              <Download size={15} aria-hidden="true" />
              <span>{packText.exportPack}</span>
            </button>
            {Object.keys(pack.images).length > 0 && (
              <button type="button" className="secondary" onClick={() => updatePack((current) => ({ ...current, images: {} }))}>
                <RotateCcw size={15} aria-hidden="true" />
                <span>{packText.resetPack}</span>
              </button>
            )}
          </div>
          <small>{packText.hint}</small>
          {status && <p role="status" className="cursor-pack-status">{status}</p>}
          {error && <p role="alert" className="remap-error">{error}</p>}
        </>}
        {settings.style !== "system" && <>
          <label className="settings-controller-row cursor-settings-row">
            <span>{text.size}</span>
            <div className="settings-select-wrap">
              <select value={settings.size} onChange={(event) => update({ size: Number(event.target.value) as CursorSize })}>
                {cursorSizes.map((size, index) => (
                  <option key={size} value={size}>{[text.sizeSmall, text.sizeMedium, text.sizeLarge][index]}</option>
                ))}
              </select>
              <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
            </div>
          </label>
          <small>{settingsHelp[language].cursorSize}</small>
          {settings.size > 32 && <small>{text.largeHint}</small>}
        </>}
        </SettingsSection>
        <SettingsSection title={settingsSectionLabels[language].behavior} icon={MonitorCog}>
        <label className="settings-controller-row cursor-settings-row">
          <span>{text.hideAfter}</span>
          <div className="settings-select-wrap">
            <select value={settings.hideAfter} onChange={(event) => update({ hideAfter: Number(event.target.value) })}>
              {cursorIdleOptions.map((seconds) => (
                <option key={seconds} value={seconds}>{seconds ? text.seconds.replace("{n}", String(seconds)) : text.never}</option>
              ))}
            </select>
            <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
          </div>
        </label>
        <small>{settingsHelp[language].cursorIdle}</small>
        </SettingsSection>
      </section>
    </details>
  );
}

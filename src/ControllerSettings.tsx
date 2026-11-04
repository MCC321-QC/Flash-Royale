import { ChevronDown, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { Language } from "./i18n";
import { detectedControllersLabels, remapLabels } from "./i18n-remap";
import { MAX_PLAYERS, createDefaultAssignments, resolveControllers, useConnectedGamepads, controllerName, namedController, useControllerNames } from "./remap";
import type { ControllerAssignment } from "./types";

function assignmentValue(assignment: ControllerAssignment) {
  return assignment.mode === "device" ? `device:${assignment.ordinal}:${assignment.id}` : assignment.mode;
}

function parseAssignmentValue(value: string): ControllerAssignment {
  if (value === "none") return { mode: "none" };
  const match = /^device:(\d+):([\s\S]+)$/.exec(value);
  return match ? { mode: "device", ordinal: Number(match[1]), id: match[2] } : { mode: "auto" };
}

export function NativeControllerInputSetting({ language }: { language: Language }) {
  const text = remapLabels[language];
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [steamInput, setSteamInput] = useState(false);

  useEffect(() => {
    if (!window.flashApi.getNativeControllerInputEnabled) return;
    let disposed = false;
    window.flashApi.getNativeControllerInputEnabled().then((value) => {
      if (!disposed) {
        setEnabled(value);
        setReady(true);
      }
    }).catch((error: unknown) => { if (!disposed) setError(String(error)); });
    window.flashApi.getSteamInputActive?.().then((value) => { if (!disposed) setSteamInput(value); }).catch(() => {});
    const stop = window.flashApi.onNativeControllerInputEnabledChanged(setEnabled);
    return () => { disposed = true; stop(); };
  }, []);

  return <>
    <label className="settings-toggle">
      <input type="checkbox" checked={enabled && !steamInput} disabled={!ready || saving || steamInput || !window.flashApi.setNativeControllerInputEnabled} onChange={(event) => {
        setSaving(true);
        setError("");
        void window.flashApi.setNativeControllerInputEnabled(event.target.checked).then(setEnabled)
          .catch((error: unknown) => setError(String(error))).finally(() => setSaving(false));
      }} />
      <span>{text.nativeInput}</span>
    </label>
    <small>{steamInput ? text.nativeInputSteamInput : text.nativeInputHint}</small>
    {error && <p role="alert" className="remap-error">{text.saveFailed}: {error}</p>}
  </>;
}

function useSavedAssignments(active = true) {
  const [savedAssignments, setAssignments] = useState<ControllerAssignment[]>(createDefaultAssignments);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!active) return;
    setLoaded(false);
    let disposed = false;
    window.flashApi.getControllerAssignments().then((saved) => {
      if (!disposed) {
        setAssignments(saved);
        setLoaded(true);
      }
    }).catch((error: unknown) => { if (!disposed) setError(String(error)); });
    const stopListening = window.flashApi.onControllerAssignmentsChanged(setAssignments);
    return () => {
      disposed = true;
      stopListening();
    };
  }, [active]);

  return { savedAssignments, setAssignments, error, setError, loaded };
}

export function ControllerAssignmentsSettings({ language, assignments: overrides, onChange, disabled = false }: {
  language: Language;
  assignments?: ControllerAssignment[];
  onChange?: (assignments: ControllerAssignment[]) => void;
  disabled?: boolean;
}) {
  const text = remapLabels[language];
  const pads = useConnectedGamepads();
  const { savedAssignments, setAssignments, error, setError, loaded } = useSavedAssignments(!overrides);
  const assignments = overrides ?? savedAssignments;
  const { names, error: namesError } = useControllerNames();
  const [saving, setSaving] = useState(false);

  const save = (next: ControllerAssignment[]) => {
    if (onChange) { onChange(next); return; }
    setError("");
    setSaving(true);
    void window.flashApi.setControllerAssignments(next).then(setAssignments)
      .catch((error: unknown) => setError(String(error))).finally(() => setSaving(false));
  };

  const updatePlayer = (player: number, value: string) => {
    const selected = parseAssignmentValue(value);
    save(assignments.map((assignment, index) => {
      if (index === player) return selected;
      const takenElsewhere = selected.mode === "device" && assignment.mode === "device" && assignment.id === selected.id && assignment.ordinal === selected.ordinal;
      return takenElsewhere ? { mode: "auto" } : assignment;
    }));
  };

  const autoAssign = () => {
    save(Array.from({ length: MAX_PLAYERS }, (_value, index): ControllerAssignment => {
      const pad = pads[index];
      return pad ? { mode: "device", id: pad.id, ordinal: pad.ordinal } : { mode: "auto" };
    }));
  };

  const resolved = resolveControllers(assignments, pads);
  return (
    <section className={`settings-general settings-controllers${disabled ? " is-disabled" : ""}`}
      aria-label={text.controllers} aria-disabled={disabled || undefined}>
      {(error || namesError) && <p role="alert" className="remap-error">{text.saveFailed}: {error || namesError}</p>}
      <small className="settings-controllers-hint">{text.controllersHint}</small>
      {pads.some((pad) => pad.id.includes("(Native SDL:")) && <small className="settings-controllers-hint">{text.nativeHint}</small>}
      {Array.from({ length: MAX_PLAYERS }, (_value, player) => {
        const assignment = assignments[player] ?? { mode: "auto" };
        const assignedMissing = assignment.mode === "device" && !pads.some((pad) => pad.id === assignment.id && pad.ordinal === assignment.ordinal);
        const autoPad = assignment.mode === "auto" ? resolved[player] : null;
        return (
          <div className="settings-option" key={player}>
          <label className="settings-controller-row">
            <span>
              <span className={`settings-controller-dot${resolved[player] ? " connected" : ""}`} aria-hidden="true" />
              {text.player} {player + 1}
            </span>
            <div className="settings-select-wrap">
              <select disabled={disabled || saving || (!overrides && !loaded)} value={assignmentValue(assignment)} onChange={(event) => updatePlayer(player, event.target.value)}>
                <option value="auto">{autoPad ? `${text.automatic} — ${autoPad.name}` : text.automatic}</option>
                <option value="none">{text.none}</option>
                {pads.map((pad) => (
                  <option key={`${pad.index}:${pad.id}`} value={`device:${pad.ordinal}:${pad.id}`}>
                    {`#${pad.displayIndex + 1} ${pad.name}`}
                  </option>
                ))}
                {assignedMissing && assignment.mode === "device" && (
                  <option value={assignmentValue(assignment)}>{`${namedController(assignment.id, assignment.ordinal, names)} (${text.disconnected})`}</option>
                )}
              </select>
              <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
            </div>
          </label>
          </div>
        );
      })}
      <div className="settings-controllers-footer">
        <div className="settings-detected-controllers">
        <strong>{detectedControllersLabels[language]}</strong>
        <small>{pads.length ? pads.map((pad) => `#${pad.displayIndex + 1} ${pad.name}`).join(" · ") : text.detectHint}</small>
        </div>
        <button type="button" className="secondary" disabled={disabled || saving || (!overrides && !loaded) || !pads.length} onClick={autoAssign}>
          {text.autoAssign}
        </button>
      </div>
    </section>
  );
}

export function ControllerNamesSettings({ language }: { language: Language }) {
  const text = remapLabels[language];
  const pads = useConnectedGamepads();
  const { names, error: namesError } = useControllerNames();
  const { savedAssignments: assignments, setAssignments, error, setError } = useSavedAssignments();
  const [forgetting, setForgetting] = useState<{ id: string; ordinal: number } | null>(null);
  const canForget = typeof window.flashApi.forgetController === "function";
  const isAssigned = (device: { id: string; ordinal: number }) =>
    assignments.some((assignment) => assignment.mode === "device" && assignment.id === device.id && assignment.ordinal === device.ordinal);
  const forgettableAssigned = assignments.flatMap((assignment) => assignment.mode === "device"
    && !pads.some((pad) => pad.id === assignment.id && pad.ordinal === assignment.ordinal) ? [{ id: assignment.id, ordinal: assignment.ordinal }] : [])
    .filter((device, index, list) => list.findIndex((entry) => entry.id === device.id && entry.ordinal === device.ordinal) === index);
  return (
    <section className="settings-general settings-controller-names" aria-label={text.controllerNames}>
        {(error || namesError) && <p role="alert" className="remap-error">{text.saveFailed}: {error || namesError}</p>}
        <small className="controller-names-description">{text.controllerNamesHint}</small>
        {[
          ...pads.map((pad) => ({ id: pad.id, ordinal: pad.ordinal })),
          ...names.filter((entry) => !pads.some((pad) => pad.id === entry.id && pad.ordinal === entry.ordinal)),
          ...forgettableAssigned.filter((entry) => !names.some((name) => name.id === entry.id && name.ordinal === entry.ordinal)),
        ].map((device) => {
          const name = names.find((entry) => entry.id === device.id && entry.ordinal === device.ordinal)?.name ?? "";
          const remembered = Boolean(name) || isAssigned(device);
          return (
            <ControllerNameEditor
              key={`${device.ordinal}:${device.id}`}
              id={device.id}
              ordinal={device.ordinal}
              name={name}
              language={language}
              onForget={canForget && remembered ? () => setForgetting(device) : undefined}
            />
          );
        })}
      {forgetting && <ConfirmationDialog
        message={text.forgetConfirm.replace("{name}", namedController(forgetting.id, forgetting.ordinal, names))}
        confirmLabel={text.forgetController}
        cancelLabel={text.cancel}
        onResolve={(confirmed) => {
          const device = forgetting;
          setForgetting(null);
          if (!confirmed || !window.flashApi.forgetController) return;
          setError("");
          void window.flashApi.forgetController(device.id, device.ordinal).then((result) => setAssignments(result.assignments))
            .catch((error: unknown) => setError(String(error)));
        }}
      />}
    </section>
  );
}

function ControllerNameEditor({ id, ordinal, name, language, onForget }: {
  id: string; ordinal: number; name: string; language: Language; onForget?: () => void;
}) {
  const text = remapLabels[language];
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    if (!editing && wasEditing.current) pill.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const cancel = () => {
    setDraft(name);
    setError("");
    setEditing(false);
  };
  return (
    <form className="controller-name-editor" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      setSaving(true);
      window.flashApi.setControllerName(id, ordinal, draft).then(() => {
        setDraft(draft.trim());
        setEditing(false);
      })
        .catch((error: unknown) => setError(String(error))).finally(() => setSaving(false));
    }}>
      <span className="controller-name-device" title={id}>{text.controllerName} — {controllerName(id)} #{ordinal + 1}</span>
      {editing ? <>
        <input autoFocus aria-label={`${text.controllerName} — ${controllerName(id)} #${ordinal + 1}`} value={draft} maxLength={80} disabled={saving} placeholder={controllerName(id)} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) {
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }
        }} />
        <div className="controller-name-actions">
          <button className="secondary" type="submit" disabled={saving || draft === name}>{text.saveName}</button>
          <button className="secondary" type="button" data-controller-back disabled={saving} onClick={cancel}>{text.cancel}</button>
        </div>
      </> : <div className="controller-name-row">
        <button ref={pill} className="controller-name-pill" type="button" aria-label={`${text.controllerName}: ${name || `${controllerName(id)} #${ordinal + 1}`}`} onClick={() => {
          setDraft(name);
          setError("");
          setEditing(true);
        }}>{name || `${controllerName(id)} #${ordinal + 1}`}</button>
        {onForget && <button className="secondary controller-forget" type="button" onClick={onForget}>
          <Trash2 size={14} aria-hidden="true" />{text.forgetController}
        </button>}
      </div>}
      {error && <p role="alert" className="remap-error">{text.saveFailed}: {error}</p>}
    </form>
  );
}

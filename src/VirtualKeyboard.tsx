import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Keyboard, X } from "lucide-react";
import { messages, type Language } from "./i18n";
import { navigationLabels, panelResizeLabels } from "./i18n-navigation";
import { keyboardLabels } from "./i18n-keyboard";
import { ControllerHintsSlot, useControllerCustomHints, useControllerNavigation } from "./ControllerNavigation";
import { PanelHeader } from "./WindowTitleBar";
import { PanelResizeGrip, WindowResizeGrip } from "./ResizeGrip";
import { errorText } from "./remote-error";
import { caretBoundary, keyboardComposition, type KeyboardDictionary, type KeyboardKey, type KeyboardLayout } from "./virtual-keyboard";
import { selectedKeyboardLayout, type KeyboardLayoutId } from "./keyboard-layouts";
import { loadKeyboardLayout } from "./keyboard-layout-loader";
import { createKeyboardDictionaryLoader } from "./keyboard-dictionary";
import { availableKeyboardShortcuts, type KeyboardShortcut } from "./virtual-keyboard-navigation";
import type { VirtualKeyboardInput, VirtualKeyboardRequest, VirtualKeyboardResult } from "./types";

const punctuationCodes: Record<string, string> = {
  "-": "Minus", "_": "Minus", "=": "Equal", "+": "Equal", ",": "Comma", ".": "Period",
  ":": "Semicolon", ";": "Semicolon", "'": "Quote", '"': "Quote", "?": "Slash", "/": "Slash",
  "[": "BracketLeft", "]": "BracketRight", "{": "BracketLeft", "}": "BracketRight", "\\": "Backslash", "|": "Backslash",
  "!": "Digit1", "@": "Digit2", "#": "Digit3", "$": "Digit4", "%": "Digit5", "^": "Digit6", "&": "Digit7", "*": "Digit8", "(": "Digit9", ")": "Digit0", "<": "Comma", ">": "Period", "`": "Backquote", "~": "Backquote",
};
const specialKeys: [string, string][] = [
  ["Space", " "], ["Enter", "Enter"], ["Tab", "Tab"], ["Escape", "Escape"], ["Backspace", "Backspace"],
  ["ArrowUp", "ArrowUp"], ["ArrowDown", "ArrowDown"], ["ArrowLeft", "ArrowLeft"], ["ArrowRight", "ArrowRight"],
  ["ShiftLeft", "Shift"], ["ShiftRight", "Shift"], ["ControlLeft", "Control"], ["ControlRight", "Control"],
  ["AltLeft", "Alt"], ["AltRight", "Alt"], ["MetaLeft", "Meta"], ["MetaRight", "Meta"],
  ["Home", "Home"], ["End", "End"], ["PageUp", "PageUp"], ["PageDown", "PageDown"], ["Insert", "Insert"], ["Delete", "Delete"],
  ["CapsLock", "CapsLock"], ["NumLock", "NumLock"], ["ScrollLock", "ScrollLock"], ["PrintScreen", "PrintScreen"], ["Pause", "Pause"],
  ...Array.from({ length: 12 }, (_, index): [string, string] => [`F${index + 1}`, `F${index + 1}`]),
  ...Array.from({ length: 10 }, (_, index): [string, string] => [`Numpad${index}`, String(index)]),
  ["NumpadAdd", "+"], ["NumpadSubtract", "-"], ["NumpadMultiply", "*"], ["NumpadDivide", "/"], ["NumpadDecimal", "."], ["NumpadEnter", "Enter"],
];
interface VirtualKeyboardProps {
  request: VirtualKeyboardRequest; onFinish: (result: VirtualKeyboardResult) => void | Promise<void>; onClose: () => void | Promise<void>; native?: boolean;
}

export function VirtualKeyboard(props: VirtualKeyboardProps) {
  const navigation = useControllerNavigation();
  const selected = useRef<KeyboardLayoutId | undefined>(props.request.layout);
  const [layout, setLayout] = useState<KeyboardLayout | null>(null);
  const [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const language = props.request.language;
  useEffect(() => {
    if (!navigation.ready && !selected.current) return;
    const id = selected.current ?? selectedKeyboardLayout(navigation.config.virtualKeyboardLayout, language);
    selected.current = id;
    let active = true;
    setError("");
    void loadKeyboardLayout(id).then(value => { if (active) setLayout(value); }).catch(cause => {
      if (!active) return;
      console.error("Loading the selected keyboard layout failed", cause);
      setError(errorText(cause));
    });
    return () => { active = false; };
  }, [navigation.ready, retry, language]);
  if (layout) return <LoadedVirtualKeyboard {...props} layout={layout} />;
  return <section className="controller-panel controller-keyboard" role="dialog" aria-label={navigationLabels[language].text}>
    <PanelHeader language={language} className="keyboard-header" showCloseButton={false}>
      <h2><Keyboard size={18} aria-hidden="true" />{keyboardLabels[language].layout}</h2>
      <button className="icon keyboard-close" type="button" aria-label={navigationLabels[language].cancel} onClick={() => void Promise.resolve().then(props.onClose).catch(cause => setError(errorText(cause)))}><X size={18} /></button>
    </PanelHeader>
    <p role={error ? "alert" : "status"}>{error || messages[language].initializing}</p>
    {error && <button type="button" onClick={() => setRetry(value => value + 1)}>{keyboardLabels[language].retry}</button>}
  </section>;
}

function LoadedVirtualKeyboard({ request, onFinish, onClose, layout, native = false }: VirtualKeyboardProps & { layout: KeyboardLayout }) {
  const language = request.language, labels = keyboardLabels[language], common = navigationLabels[language];
  const navigation = useControllerNavigation();
  const panel = useRef<HTMLElement>(null);
  const [shift, setShift] = useState(false), [symbols, setSymbols] = useState(false);
  const shiftRef = useRef(false);
  const [error, setError] = useState(""), [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const [composition, setComposition] = useState(""), [candidatePage, setCandidatePage] = useState(0);
  const compositionRef = useRef("");
  const [dictionary, setDictionary] = useState<{ lookup: string; data: KeyboardDictionary } | null>(null);
  const dictionaryRef = useRef(dictionary);
  const [loadDictionary] = useState(createKeyboardDictionaryLoader);
  const [loading, setLoading] = useState(false), [dictionaryError, setDictionaryError] = useState(""), [retry, setRetry] = useState(0);
  const initial = request.kind === "text" ? { value: request.value, start: request.selectionStart, end: request.selectionEnd } : { value: "", start: 0, end: 0 };
  const [editor, setEditor] = useState(initial);
  const editorRef = useRef(editor);
  const gameQueue = useRef(Promise.resolve());
  const lookup = useMemo(() => keyboardComposition(layout, composition, null).lookup, [layout, composition]);
  const currentDictionary = dictionary?.lookup === lookup ? dictionary.data : null;
  const converted = useMemo(() => keyboardComposition(layout, composition, currentDictionary), [layout, composition, currentDictionary]);
  const candidates = converted.candidates;
  const hasComposition = Boolean(composition);
  const conversionPending = request.kind !== "key" && hasComposition && (layout.ime === "zh" || layout.ime === "ja") && !currentDictionary;
  const password = request.kind === "text" && request.attributes.type === "password";
  const preview = password ? "•".repeat(editor.value.length) : editor.value;
  const updateEditor = (next: typeof editor) => { editorRef.current = next; setEditor(next); };
  const updateComposition = (value: string) => { compositionRef.current = value; setComposition(value); setCandidatePage(0); };
  const toggleShift = () => { shiftRef.current = !shiftRef.current; setShift(shiftRef.current); };
  const showError = (cause: unknown) => setError(errorText(cause));

  useEffect(() => {
    if (request.kind === "key" || !hasComposition || layout.ime !== "zh" && layout.ime !== "ja") {
      dictionaryRef.current = null; setDictionary(null); setLoading(false); setDictionaryError(""); return;
    }
    const ime = layout.ime;
    const controller = new AbortController();
    dictionaryRef.current = null; setDictionary(null); setLoading(true); setDictionaryError("");
    void (async () => {
      const base = window.flashApi ? await window.flashApi.getAssetBaseUrl() : window.location.origin;
      const data = await loadDictionary(base, ime, lookup, controller.signal);
      if (!controller.signal.aborted) {
        dictionaryRef.current = { lookup, data };
        setDictionary(dictionaryRef.current);
        setError(current => current === labels.loading ? "" : current);
      }
    })().catch(cause => {
      if (controller.signal.aborted) return;
      console.error("Loading the offline keyboard dictionary failed", cause);
      setDictionaryError(`${labels.failed} ${errorText(cause)}`);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [layout.ime, request.kind, hasComposition, lookup, retry, labels.failed, labels.loading, loadDictionary]);

  const enqueue = (input: VirtualKeyboardInput) => {
    const type = window.flashApi.typeVirtualKeyboard;
    if (!type) { const failure = Promise.reject(new Error(common.failed)); void failure.catch(showError); return failure; }
    const next = gameQueue.current.then(() => type(input), () => type(input));
    gameQueue.current = next;
    void next.catch(showError);
    return next;
  };
  const insert = (value: string) => {
    if (request.kind === "game") { void enqueue({ type: "text", text: value }); return true; }
    const current = editorRef.current;
    const limit = request.kind === "text" && request.attributes.maxlength !== undefined ? Number.parseInt(request.attributes.maxlength, 10) : Infinity;
    if (limit >= 0 && current.value.length - (current.end - current.start) + value.length > limit) {
      setError(common.lengthError.replace("{count}", String(limit)));
      return false;
    }
    updateEditor({ value: current.value.slice(0, current.start) + value + current.value.slice(current.end), start: current.start + value.length, end: current.start + value.length });
    setError("");
    return true;
  };
  const commitComposition = (value?: string) => {
    const raw = compositionRef.current;
    if (!raw) return true;
    const reading = keyboardComposition(layout, raw, null).lookup;
    const data = dictionaryRef.current?.lookup === reading ? dictionaryRef.current.data : null;
    if ((layout.ime === "zh" || layout.ime === "ja") && !data) { setError(dictionaryError || labels.loading); return false; }
    const current = keyboardComposition(layout, raw, data);
    if (!insert(value ?? current.candidates[0] ?? current.display)) return false;
    updateComposition("");
    return true;
  };
  const chooseKey = async (value: string, code: string) => {
    finishingRef.current = true; setFinishing(true);
    try { await onFinish({ kind: "key", key: { kind: "key", key: value, code } }); }
    catch (cause) { showError(cause); }
    finally { finishingRef.current = false; setFinishing(false); }
  };
  const pick = (key: KeyboardKey, applyShift = true) => {
    if (finishingRef.current) return;
    const value = applyShift && shiftRef.current ? key.shifted ?? key.value.toUpperCase() : key.value;
    if (request.kind === "key") { void chooseKey(value, key.code); return; }
    const raw = compositionRef.current;
    if (!symbols && layout.ime && (layout.ime === "ko" ? /^[ㄱ-ㅎㅏ-ㅣ]$/.test(value) : /^[a-z'ü-]$/i.test(value))) {
      if (raw.length + value.length > 128) { setError(common.lengthError.replace("{count}", "128")); return; }
      updateComposition(raw + value.toLowerCase());
    } else {
      const reading = keyboardComposition(layout, raw, null).lookup;
      const data = dictionaryRef.current?.lookup === reading ? dictionaryRef.current.data : null;
      const current = keyboardComposition(layout, raw, data);
      if (raw && /^[1-9]$/.test(value) && current.candidates[Number(value) - 1]) { commitComposition(current.candidates[Number(value) - 1]); return; }
      if (commitComposition()) insert(value);
    }
  };
  const erase = (forward = false) => {
    const raw = compositionRef.current;
    if (raw) { updateComposition(raw.slice(0, caretBoundary(raw, raw.length, -1))); return; }
    if (request.kind === "game") { void enqueue({ type: "key", key: forward ? "Delete" : "Backspace" }); return; }
    const current = editorRef.current;
    const start = current.start === current.end && !forward ? caretBoundary(current.value, current.start, -1) : current.start;
    const end = current.start === current.end && forward ? caretBoundary(current.value, current.end, 1) : current.end;
    updateEditor({ value: current.value.slice(0, start) + current.value.slice(end), start, end: start });
  };
  const move = (direction: -1 | 1) => {
    if (!commitComposition()) return;
    if (request.kind === "game") { void enqueue({ type: "key", key: direction < 0 ? "ArrowLeft" : "ArrowRight" }); return; }
    const current = editorRef.current;
    const offset = current.start !== current.end ? direction < 0 ? current.start : current.end
      : caretBoundary(current.value, direction < 0 ? current.start : current.end, direction);
    updateEditor({ ...current, start: offset, end: offset });
  };
  const finish = async () => {
    if (finishingRef.current || !commitComposition()) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      if (request.kind === "game") { await gameQueue.current; await onFinish({ kind: "game" }); return; }
      if (request.kind !== "text") return;
      const current = editorRef.current;
      const minimum = Number.parseInt(request.attributes.minlength, 10);
      if (current.value && minimum > current.value.length) { setError(labels.minimum.replace("{count}", String(minimum))); return; }
      const probe = document.createElement(request.multiline ? "textarea" : "input");
      for (const [name, value] of Object.entries(request.attributes)) probe.setAttribute(name, value);
      probe.value = current.value;
      if (current.value && !probe.value || !probe.checkValidity()) { setError(probe.validationMessage || labels.invalid); return; }
      await onFinish({ kind: "text", value: current.value, selectionStart: current.start, selectionEnd: current.end });
    } catch (cause) { showError(cause); }
    finally { finishingRef.current = false; setFinishing(false); }
  };
  const close = async () => {
    await onClose();
  };
  const back = () => {
    if (compositionRef.current) updateComposition("");
    else void close().catch(showError);
  };
  const space = () => { if (compositionRef.current) commitComposition(); else insert(" "); };
  const enter = () => {
    if (compositionRef.current) { commitComposition(); return; }
    if (request.kind === "game") void enqueue({ type: "key", key: "Enter" });
    else if (request.kind === "text" && request.multiline) insert("\n");
    else void finish();
  };
  const shortcutRef = useRef<(action: KeyboardShortcut) => void>(() => {});
  shortcutRef.current = action => {
    if (finishingRef.current) return;
    if (action === "erase") erase();
    else if (action === "space") space();
    else if (action === "left" || action === "right") move(action === "left" ? -1 : 1);
    else if (action === "shift") toggleShift();
    else void finish();
  };
  useEffect(() => {
    const element = panel.current;
    const handle = (event: Event) => shortcutRef.current((event as CustomEvent<KeyboardShortcut>).detail);
    element?.addEventListener("virtual-keyboard-shortcut", handle);
    return () => element?.removeEventListener("virtual-keyboard-shortcut", handle);
  }, []);
  const shortcutLabels: Record<KeyboardShortcut, string> = { erase: common.erase, space: common.space, left: labels.caret, right: labels.caret, shift: common.shift, done: common.done };
  const shortcuts = availableKeyboardShortcuts(navigation.config);
  const pairedCaret = shortcuts.some(([action]) => action === "left") && shortcuts.some(([action]) => action === "right");
  useControllerCustomHints([
    { control: "move", label: common.navigate }, { control: "confirm", label: common.confirm }, { control: "back", label: composition ? common.cancel : common.back },
    ...(request.kind === "key" ? [] : shortcuts
      .filter(([action]) => !pairedCaret || action !== "right")
      .map(([action, button]) => ({ control: pairedCaret && action === "left" ? "bumpers" as const : button, label: shortcutLabels[action] }))),
  ]);
  const uniqueSymbols = [...new Set([...layout.symbols])];
  const symbolRows = Array.from({ length: Math.ceil(uniqueSymbols.length / 12) }, (_, index) =>
    uniqueSymbols.slice(index * 12, index * 12 + 12).map(value => ({ value, code: punctuationCodes[value] ?? "" })));
  const keyRows = symbols ? symbolRows : layout.rows;
  const actionColumns = layout.rows[layout.rows.length - 1].length;
  const actionCount = request.kind === "key" ? 3 : 7 + (request.kind === "game" || request.multiline ? 1 : 0) + (request.kind === "game" ? 1 : 0);
  const actionRows = Math.ceil(actionCount / actionColumns);
  const remainder = actionCount % actionColumns;
  const actionSpan = remainder || 1;
  const actionCellStyle = (index: number): CSSProperties | undefined => remainder && index >= actionCount - remainder
    ? { gridColumn: `span ${actionColumns}` } : undefined;
  // Wrapped action rows get the same height share as individual letter rows.
  const rowStyle: CSSProperties & { "--keyboard-action-columns": number; "--keyboard-action-span": number; "--keyboard-action-rows": number; "--keyboard-action-basis": string } = {
    "--keyboard-action-columns": actionColumns * actionSpan, "--keyboard-action-span": actionSpan, "--keyboard-action-rows": actionRows,
    "--keyboard-action-basis": `${34 * actionRows + 5 * (actionRows - 1)}px`,
  };
  const keyButton = (key: KeyboardKey, index: number, row: number): ReactNode => <button type="button" key={`${index}:${key.code}:${key.value}`}
    data-controller-autofocus={row === 1 && index === 0 ? "" : undefined}
    disabled={finishing || request.kind === "key" && !key.code}
    onClick={() => pick(key)}>{shift ? key.shifted ?? key.value.toUpperCase() : key.value}</button>;
  return <section ref={panel} className="controller-panel controller-keyboard" role="dialog" aria-modal={request.kind !== "game"}
    aria-label={request.kind === "key" ? common.keys : common.text} data-virtual-keyboard="" data-keyboard-layout={layout.id} data-keyboard-shortcuts={request.kind !== "key" ? "" : undefined}>
    <PanelHeader language={language} className="keyboard-header" showCloseButton={false}>
      <h2><Keyboard size={18} aria-hidden="true" />{request.kind === "key" ? common.keys : common.text}</h2>
      <ControllerHintsSlot className="remap-controller-hints keyboard-controller-hints" />
      <button type="button" className="icon keyboard-close" aria-label={common.cancel} title={common.cancel} onClick={() => void close().catch(showError)}><X size={18} aria-hidden="true" /></button>
    </PanelHeader>
    <fieldset className="keyboard-body" disabled={finishing}>
        {request.kind === "text" && <output className="controller-keyboard-preview" aria-live={password ? "off" : "polite"} dir="auto">
          {preview.slice(0, editor.start)}<mark>{preview.slice(editor.start, editor.end) || "\u200b"}</mark>{preview.slice(editor.end)}
        </output>}
        {(layout.ime === "ja" || layout.ime === "zh") && <small className="keyboard-game-hint">{labels.phoneticHint}</small>}
        {loading && <small role="status">{labels.loading}</small>}
        {dictionaryError && <div role="alert" className="remap-error">{dictionaryError}<button type="button" onClick={() => setRetry(value => value + 1)}>{labels.retry}</button></div>}
        {composition && <div className="keyboard-composition">
          <output aria-label={labels.composition}>{converted.display}</output>
          <div className="keyboard-candidates" aria-label={labels.candidates}>
            <button type="button" className="icon" aria-label={labels.previous} disabled={candidatePage === 0} onClick={() => setCandidatePage(value => value - 1)}><ChevronLeft size={16} /></button>
            {candidates.slice(candidatePage * 6, candidatePage * 6 + 6).map((value, index) => <button key={value} type="button" disabled={conversionPending} onClick={() => commitComposition(value)}><small>{candidatePage * 6 + index + 1}</small>{value}</button>)}
            <button type="button" className="icon" aria-label={labels.next} disabled={(candidatePage + 1) * 6 >= candidates.length} onClick={() => setCandidatePage(value => value + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>}
        <div className="controller-keyboard-rows" dir={layout.rtl ? "rtl" : "ltr"} lang={layout.language}
          style={rowStyle}>
          {keyRows.map((row, index) => <div className="controller-keyboard-row" key={index}>{row.map((key, column) => keyButton(key, column, index))}</div>)}
          <div className="controller-keyboard-actions">
            <button type="button" style={actionCellStyle(0)} aria-pressed={symbols} disabled={conversionPending} onClick={() => { if (commitComposition()) setSymbols(value => !value); }}>{labels.symbols}</button>
            <button type="button" style={actionCellStyle(1)} aria-pressed={shift} onClick={toggleShift}>{common.shift}</button>
            <button type="button" style={actionCellStyle(2)} disabled={conversionPending} onClick={() => request.kind === "key" ? pick({ value: " ", code: "Space" }) : space()}>{common.space}</button>
            {request.kind !== "key" && <>
              <button type="button" style={actionCellStyle(3)} disabled={conversionPending} aria-label={`${labels.caret} ←`} onClick={() => move(-1)}>←</button>
              <button type="button" style={actionCellStyle(4)} disabled={conversionPending} aria-label={`${labels.caret} →`} onClick={() => move(1)}>→</button>
              <button type="button" style={actionCellStyle(5)} onClick={() => erase()}>{common.erase}</button>
              <button type="button" style={actionCellStyle(6)} onClick={() => erase(true)}>{labels.delete}</button>
              {(request.kind === "game" || request.multiline) && <button type="button" style={actionCellStyle(7)} disabled={conversionPending} onClick={enter}>{labels.enter}</button>}
              {request.kind === "game" && <button type="button" style={actionCellStyle(8)} disabled={conversionPending} onClick={() => { if (commitComposition()) void enqueue({ type: "key", key: "Tab" }); }}>{labels.tab}</button>}
            </>}
          </div>
        </div>
        {request.kind === "key" && <div className="controller-keyboard-special">{specialKeys.map(([code, value]) => <button type="button" key={code} onClick={() => pick({ value, code }, false)}>{code === "Space" ? common.space : code}</button>)}</div>}
      {error && <p role="alert" className="remap-error">{error}</p>}
    </fieldset>
    <footer className="keyboard-footer">
      <div className="keyboard-footer-actions">
        {request.kind !== "key" && <button type="button" className="primary" disabled={finishing || conversionPending} onClick={() => void finish()}>{common.done}</button>}
        <button type="button" className="secondary" data-controller-back="" data-controller-back-step={composition ? "" : undefined} onClick={back}>{request.kind === "game" ? messages[language].close : common.cancel}</button>
      </div>
    </footer>
    {native ? <WindowResizeGrip label={panelResizeLabels[language].resize} centerWhenCentered />
      : <PanelResizeGrip label={panelResizeLabels[language].resize} target={panel} centered contained />}
  </section>;
}

export function VirtualKeyboardWindow({ language }: { language: Language }) {
  const [request, setRequest] = useState<VirtualKeyboardRequest | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const get = window.flashApi.getVirtualKeyboard;
    if (!get) { setError(navigationLabels[language].restart); return; }
    void get().then(value => { if (active) setRequest(value); }).catch(cause => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [language]);
  const finish = async (result: VirtualKeyboardResult | null) => {
    const send = window.flashApi.finishVirtualKeyboard;
    if (!send) throw new Error(navigationLabels[language].restart);
    await send(result);
  };
  return <main className="keyboard-window">
    {request ? <VirtualKeyboard request={request} native={Boolean(window.flashApi.windowControls?.isPanel)} onFinish={finish} onClose={() => finish(null)} />
      : <section className="controller-panel"><p role={error ? "alert" : "status"}>{error || keyboardLabels[language].loading}</p></section>}
  </main>;
}

import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { Copy, Minus, Move, Square, X } from "lucide-react";
import { messages, windowControlLabels } from "./i18n";
import type { Language } from "./i18n";
import { panelMoveLabels } from "./i18n-navigation";

interface WindowState {
  maximized: boolean;
  fullscreen: boolean;
  focused: boolean;
  panel?: boolean;
}

/** Moves the window while the pointer drags the element. The main process follows the cursor, so the page
 *  keeps the themed cursor (an `-webkit-app-region: drag` area always shows the system arrow). */
export function useWindowDrag(ignore = "button, a, input, select, textarea, [data-no-window-drag]", allowDoubleClickMaximize = true) {
  const dragging = useRef<number | null>(null);
  const controls = window.flashApi?.windowControls;
  useEffect(() => () => { if (dragging.current !== null) controls?.endDrag(); }, [controls]);
  const end = (event: PointerEvent<HTMLElement>) => {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    controls?.endDrag();
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!controls || event.button !== 0 || (event.target as Element).closest(ignore)) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = event.pointerId;
      controls.startDrag();
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onDoubleClick: (event: MouseEvent<HTMLElement>) => {
      if (!allowDoubleClickMaximize || !controls || (event.target as Element).closest(ignore)) return;
      controls.toggleMaximize();
    },
  };
}

export function useWindowState(): WindowState {
  const [state, setState] = useState<WindowState>({ maximized: false, fullscreen: false, focused: document.hasFocus() });
  useEffect(() => {
    const controls = window.flashApi?.windowControls;
    let disposed = false;
    const update = (next: Partial<WindowState>) => { if (!disposed) setState((previous) => ({ ...previous, ...next })); };
    void controls?.getState().then(update).catch(() => {});
    const stop = controls?.onStateChanged(update);
    const onFocus = () => update({ focused: true });
    const onBlur = () => update({ focused: false });
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      disposed = true;
      stop?.();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  return state;
}

export function PanelCloseButton({ language }: { language: Language }) {
  const label = windowControlLabels[language].close;
  return <button type="button" className="icon panel-close" title={label} aria-label={label} onClick={() => window.close()}>
    <X size={18} aria-hidden="true" />
  </button>;
}

function addMovableTitle(children: ReactNode, language: Language): ReactNode {
  type MoveTitleProps = HTMLAttributes<HTMLElement> & {
    children?: ReactNode;
    "data-controller-move"?: string;
  };
  let decorated = false;
  const label = panelMoveLabels[language];
  const handleMoveKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!event.currentTarget.hasAttribute("data-controller-resizing")) return;
    const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    window.flashApi?.windowControls?.moveBy?.(delta[0], delta[1]);
  };
  const visit = (child: ReactNode): ReactNode => {
    if (!isValidElement<MoveTitleProps>(child)) return child;
    if (!decorated && typeof child.type === "string" && /^h[1-2]$/.test(child.type)) {
      decorated = true;
      const onKeyDown = child.props.onKeyDown;
      return cloneElement(child, {
        role: "button",
        tabIndex: 0,
        "data-controller-move": "",
        "aria-label": label,
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) handleMoveKey(event);
        },
        children: <><Move className="panel-move-icon" size={16} aria-hidden="true" />{child.props.children}</>,
      });
    }
    if (!child.props.children) return child;
    return cloneElement(child, undefined, Children.map(child.props.children, visit));
  };
  return Children.map(children, visit);
}

/** Reuses the panel's content header without adding a separate title-bar row. Only the title moves the panel. */
export function PanelHeader({ language, className = "", showCloseButton = true, children }: {
  language: Language; className?: string; showCloseButton?: boolean; children: ReactNode;
}) {
  const drag = useWindowDrag(undefined, false);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const title = header.current?.querySelector<HTMLElement>("[data-controller-move]");
    const controls = window.flashApi?.windowControls;
    if (!title || !controls?.isPanel || !controls.getPosition || !controls.setPosition) return;
    const { getPosition, setPosition } = controls;
    let original: Promise<{ x: number; y: number }> | null = null;
    const start = () => { original = getPosition(); void original.catch(error => console.error("Reading panel position failed", error)); };
    const cancel = () => {
      const position = original;
      original = null;
      if (position) void position.then(value => {
        if (header.current?.isConnected) return setPosition(value.x, value.y);
      }).catch(error => console.error("Restoring panel position failed", error));
    };
    title.addEventListener("controller-resize-start", start);
    title.addEventListener("controller-resize-cancel", cancel);
    return () => { title.removeEventListener("controller-resize-start", start); title.removeEventListener("controller-resize-cancel", cancel); };
  }, []);
  return <header ref={header} className={`${className} panel-header`} {...drag}
    onPointerDown={(event) => {
      if (!(event.target as Element).closest("[data-controller-move]")) return;
      drag.onPointerDown(event);
    }}>
    {addMovableTitle(children, language)}
    {showCloseButton && <PanelCloseButton language={language} />}
  </header>;
}

export function PanelResizeHandles() {
  const state = useWindowState();
  const dragging = useRef<number | null>(null);
  const controls = window.flashApi?.windowControls;
  const end = (event: PointerEvent<HTMLElement>) => {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    controls?.endDrag();
  };
  useEffect(() => () => { if (dragging.current !== null) controls?.endDrag(); }, [controls]);
  if (!(state.panel || controls?.isPanel) || state.maximized || state.fullscreen) return null;
  return <div className="panel-resize-handles" aria-hidden="true">
    <div className="panel-resize-edge panel-resize-se"
      onPointerDown={(event) => {
        if (event.button !== 0 || !controls) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = event.pointerId;
        controls.startResize("se");
      }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
  </div>;
}

function useDocumentTitle() {
  const [title, setTitle] = useState(document.title);
  useEffect(() => {
    const observer = new MutationObserver(() => setTitle(document.title));
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return title;
}

function useUiLanguage(initial: Language) {
  const [language, setLanguage] = useState(initial);
  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<unknown>).detail;
      if (typeof next === "string" && next in messages) setLanguage(next as Language);
    };
    window.addEventListener("controller-ui-language", onChange);
    return () => window.removeEventListener("controller-ui-language", onChange);
  }, []);
  return language;
}

/** Minimal app-styled replacement for the system title bar (windows use `titleBarStyle: "hidden"`). */
export function WindowTitleBar({ icon, language: initialLanguage }: { icon: string; language: Language }) {
  const labels = windowControlLabels[useUiLanguage(initialLanguage)];
  const title = useDocumentTitle();
  const state = useWindowState();
  const drag = useWindowDrag();
  const controls = window.flashApi?.windowControls;
  useEffect(() => {
    document.documentElement.classList.toggle("window-fullscreen", state.fullscreen);
  }, [state.fullscreen]);
  useEffect(() => {
    let active = true;
    let received = false;
    const update = (enabled: boolean) => {
      received = true;
      document.documentElement.classList.toggle("titlebar-controller-mode", enabled);
    };
    const stop = window.flashApi.onControllerActivityChanged(update);
    void window.flashApi.getControllerActivity().then((next) => {
      if (active && !received) update(next.active);
    }).catch(console.error);
    return () => { active = false; stop(); };
  }, []);
  return (
    <header className={`window-titlebar${state.focused ? "" : " inactive"}`} {...drag}>
      <img className="window-titlebar-icon" src={icon} alt="" draggable={false} />
      <span className="window-titlebar-title">{title}</span>
      <div className="window-titlebar-controls">
        <button type="button" tabIndex={-1} title={labels.minimize} aria-label={labels.minimize} onClick={() => controls?.minimize()}>
          <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          title={state.maximized ? labels.restore : labels.maximize}
          aria-label={state.maximized ? labels.restore : labels.maximize}
          onClick={() => controls?.toggleMaximize()}
        >
          {state.maximized ? <Copy size={13} strokeWidth={1.75} aria-hidden="true" /> : <Square size={13} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <button type="button" tabIndex={-1} className="close" title={labels.close} aria-label={labels.close} onClick={() => controls?.close()}>
          <X size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

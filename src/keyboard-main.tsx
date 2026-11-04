import ReactDOM from "react-dom/client";
import { messages, readLanguage, type Language } from "./i18n";
import { keyboardUiLabels } from "./i18n-navigation";
import { ControllerNavigationProvider } from "./ControllerNavigation";
import { VirtualKeyboardWindow } from "./VirtualKeyboard";
import { installCursorTheme } from "./cursor-theme";
import { installTheme } from "./theme";
import { startControllerReporter } from "./remap";
import { installKeyboardFocusTracking, installPanelWindowControls } from "./renderer-chrome";
import "./styles.css";

const value = new URLSearchParams(window.location.search).get("language");
function isLanguage(value: string | null): value is Language {
  return value !== null && Object.prototype.hasOwnProperty.call(messages, value);
}
if (value !== null && !isLanguage(value)) console.warn("Unsupported keyboard UI language; using the saved app language.");
const language = isLanguage(value) ? value : readLanguage();
document.title = keyboardUiLabels[language].open;
document.documentElement.classList.add("remap-window-transparent");
document.body.classList.add("keyboard-window-body", "explore-window-body");
const host = document.getElementById("root");
if (!host) throw new Error("The keyboard renderer root is missing.");
const root = ReactDOM.createRoot(host);
if (!window.flashApi) {
  root.render(<main className="keyboard-window"><section className="controller-panel"><p role="alert">{keyboardUiLabels[language].unavailable}</p></section></main>);
} else {
  installPanelWindowControls();
  installKeyboardFocusTracking();
  installTheme();
  installCursorTheme();
  startControllerReporter();
  root.render(<ControllerNavigationProvider language={language} showWindowResizeGrip={false}>
    <VirtualKeyboardWindow language={language} />
  </ControllerNavigationProvider>);
}

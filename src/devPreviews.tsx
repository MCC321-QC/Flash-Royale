import { useCallback, useEffect, useState } from "react";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { runFlashpointImport } from "./FlashpointImport";
import { openMetadataSearch, runFlashpointMetadata } from "./FlashpointMetadata";
import { messages, readLanguage } from "./i18n";
import type { Language } from "./i18n";
import { createDefaultAssignments } from "./remap";
import { ShowcasePicker } from "./ShowcaseScreenshots";
import type { ActivityEntry, AntivirusProviderId, AntivirusSettings, AntivirusStatus, AntivirusThreat, ExploreImportProgressState, FlashApi, Game, GameScreenshot, GameStorageMigrationProgress, GuideFormat, ImportProgress, ImportResult, SecurityStatus, SecurityThreat, SourcesStatus, UpdateCheckResult } from "./types";

/**
 * Browser preview switches, all in one place. Run `npm run dev`, then open e.g. http://127.0.0.1:5173/?musicImportDemo.
 * Each switch opens a real panel or dialog with sample data. They only work in the dev server and never in the
 * Electron app, which has its own `window.flashApi`. Callers check `import.meta.env.DEV` before `demoParam` so
 * production builds drop the sample data. See docs/maintenance/PANEL-REVIEW-CHECKLIST.md for the full list of preview URLs.
 */
export function demoParam(name: string) {
  return new URLSearchParams(location.search).has(name);
}

type DevPreviewActions = {
  language: Language;
  renameMessage: string;
  showUpdateDialog: (dialog: UpdateCheckResult) => void;
  openMusicImport: () => void;
  showImportSummary: (summary: { imported: Game[]; skipped: NonNullable<ImportResult["skipped"]>; cancelled: boolean }) => void;
  showCloseBlocked: (reason: "game" | "explore") => void;
  requestTextPrompt: (message: string, value: string) => Promise<string | null>;
};

function previewGame(id: string, title: string, format: "swf" | "dcr" = "swf"): Game {
  return {
    id, title, originalFileName: `${title}.${format}`, filePath: `C:\\Games\\${title}.${format}`,
    coverPath: "", coverUrl: "", swfUrl: "", format, tags: [], category: "", favorite: false,
    notes: "", createdAt: "", updatedAt: "", playCount: 0, lastPlayedAt: null, hash: "",
    coverStatus: "fallback", stageWidth: null, stageHeight: null,
  };
}

/** Library window: opens the dialog requested by the page URL once, after the Library has mounted. */
export function useDevPreviews(actions: DevPreviewActions) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(location.search);
    const timers: number[] = [];
    const later = (open: () => void) => timers.push(window.setTimeout(open, 300));
    let active = true;

    const update = params.get("updateDemo");
    if (update !== null) {
      const current = update === "current";
      actions.showUpdateDialog({
        status: current ? "current" : "available",
        currentVersion: current ? "1.1.0" : "1.0.0",
        latestVersion: "1.1.0",
        changelog: "## What's new\n- Improved controller navigation and dialog handling.\n- Added clearer update options and release notes.\n\n## Fixes\n- Fixed several layout and stability issues.",
        releaseUrl: "https://github.com/MCC321-QC/Flash-Royale/releases/tag/v1.1.0",
        automaticUpdateAvailable: !current,
      });
    }
    if (params.has("flashpointImportDemo")) void runFlashpointImport(actions.language, true).catch(console.error);
    if (params.has("metadataImportDemo")) later(() => void runFlashpointMetadata(actions.language, true).catch(console.error));
    if (params.has("metadataSearchDemo")) later(() => void openMetadataSearch("preview-search-game", "Bloons Tower Defense 4"));
    if (params.has("musicImportDemo")) later(actions.openMusicImport);
    if (params.has("importSummaryDemo")) later(() => actions.showImportSummary({
      imported: [previewGame("import-summary-demo-1", "Bloons Tower Defense 4"), previewGame("import-summary-demo-2", "The Fancy Pants Adventure")],
      skipped: [
        { path: "C:\\Games\\Already in Library.swf", reason: "This game is already in your library." },
        { path: "C:\\Games\\unsupported-file.txt", reason: "Unsupported file type." },
      ],
      cancelled: false,
    }));
    if (params.has("closeBlockedDemo")) later(() => actions.showCloseBlocked(params.get("reason") === "explore" ? "explore" : "game"));
    // The rename prompt reopens after each answer so it can be reviewed repeatedly.
    if (params.has("renameDemo")) {
      const open = () => {
        if (!active) return;
        void actions.requestTextPrompt(actions.renameMessage, "Action").then((value) => {
          console.info(`Rename preview: ${value === null ? "cancelled" : `renamed to ${value}`}`);
          window.setTimeout(open, 800);
        });
      };
      open();
    }
    return () => {
      active = false;
      timers.forEach(window.clearTimeout);
    };
  }, []);
}

/** "?confirmDemo": the real confirmation dialog over the library, reopened after each answer. */
export function ConfirmationPreview() {
  const [open, setOpen] = useState(() => import.meta.env.DEV && demoParam("confirmDemo"));
  const resolve = useCallback((confirmed: boolean) => {
    console.info(`Confirmation preview: ${confirmed ? "confirmed" : "cancelled"}`);
    setOpen(false);
    window.setTimeout(() => setOpen(true), 800);
  }, []);
  return open ? (
    <ConfirmationDialog message={"Delete \u201cAlien Hominid\u201d? Its game files and saves will be removed from this computer."}
      confirmLabel="Delete" cancelLabel="Cancel" onResolve={resolve} />
  ) : null;
}

/** "?explore&explorePromptDemo": the Explore duplicate import notice. */
export function useExplorePromptPreview(show: (notice: { title: string; duplicateOf: string }) => void) {
  useEffect(() => {
    if (import.meta.env.DEV && demoParam("explorePromptDemo")) show({ title: "Bloons TD 4", duplicateOf: "Bloons Tower Defense 4" });
  }, []);
}

function previewScreenshot(index: number, title: string, colors: [string, string, string], showcased: boolean): GameScreenshot {
  const [background, accent, detail] = colors;
  const image = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#111820"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/><path d="M0 265h480v95H0z" fill="${detail}"/><path d="M0 292h480v8H0z" fill="${accent}"/><circle cx="${75 + index * 47}" cy="${92 + index * 17}" r="34" fill="${accent}" opacity=".9"/><rect x="235" y="214" width="72" height="78" rx="8" fill="${accent}"/><path d="M210 216h122v15H210z" fill="${detail}"/><text x="24" y="42" fill="#fff" font-family="sans-serif" font-size="18">${title}</text><text x="24" y="68" fill="#dce6f3" font-family="sans-serif" font-size="12">LEVEL ${index + 1} · SCORE ${12500 + index * 3200}</text></svg>`;
  return {
    name: `preview-${index + 1}.png`,
    url: `data:image/svg+xml,${encodeURIComponent(image)}`,
    takenAt: new Date(Date.UTC(2025, 3, 10 + index, 17, 24 - index * 3)).toISOString(),
    size: 640000 + index * 18400,
    width: 1280,
    height: 720,
    showcased,
  };
}

/** "?showcasePickerDemo": the showcase screenshot picker with sample screenshots (main.tsx routes to it). */
export function ShowcasePickerPreview({ language }: { language: Language }) {
  const [open, setOpen] = useState(true);
  const [screenshots, setScreenshots] = useState<GameScreenshot[]>([
    previewScreenshot(0, "GREEN HILLS", ["#256b70", "#f5cf54", "#447545"], true),
    previewScreenshot(1, "NIGHT RUN", ["#342850", "#f08c62", "#25203a"], false),
    previewScreenshot(2, "SKY FORTRESS", ["#346189", "#e7d36b", "#3c5868"], false),
    previewScreenshot(3, "BOSS BATTLE", ["#773b47", "#76d5ce", "#392938"], true),
    previewScreenshot(4, "BONUS STAGE", ["#8b683f", "#96d36f", "#4b5a3c"], false),
    previewScreenshot(5, "FINAL LEVEL", ["#494c78", "#f1a4c4", "#35354e"], false),
  ]);
  if (!open) return null;
  return (
    <ShowcasePicker
      gameId="preview-showcase"
      language={language}
      screenshots={screenshots}
      onClose={() => setOpen(false)}
      onPreviewToggle={(shot) => setScreenshots((current) => current.map((item) => item.name === shot.name ? { ...item, showcased: !item.showcased } : item))}
    />
  );
}

/** Browser preview of the activity history; "?historyDemo" fills it with sample entries. */
function previewHistory(): ActivityEntry[] {
  if (!import.meta.env.DEV || !demoParam("historyDemo")) return [];
  const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  return [
    { id: "6", kind: "flashpointImport", status: "running", startedAt: at(1), progress: { current: 12, total: 40, label: "Bloons Tower Defense 4" } },
    { id: "5", kind: "notice", status: "info", startedAt: at(3), text: "Cover saved for Fancy Pants Adventure." },
    { id: "4", kind: "exploreImport", status: "done", startedAt: at(12), endedAt: at(11), title: "Super Mario 63", count: 1 },
    { id: "3", kind: "antivirusScan", status: "cancelled", startedAt: at(60), endedAt: at(58), count: 24 },
    { id: "2", kind: "sourcesCheck", status: "failed", startedAt: at(180), endedAt: at(180), detail: "GitHub answered HTTP 503." },
    { id: "1", kind: "securityAlert", status: "alert", startedAt: at(1440), count: 2 },
  ];
}

/** Browser preview of the source definitions settings; "?sourcesDemo" shows a failed check and a broken file. */
export function previewSourcesApi() {
  const demo = import.meta.env.DEV && demoParam("sourcesDemo");
  const base = "https://github.com/MCC321-QC/Flash-Royale";
  const file = (kind: string, id: string, name: string) => ({ id, name, file: `${kind}-${id}.json`, url: `${base}/blob/main/sources/enabled/${kind}-${id}.json`, problem: "" });
  let autoUpdate = true;
  const enabled: Record<string, boolean> = { silvergames: true, y8: true };
  const status = (): SourcesStatus => ({
    autoUpdate,
    blocked: false,
    origin: { from: "github", signedAt: "2026-05-01T12:00:00.000Z", keyId: "preview", checkedAt: Date.now() - 3_600_000, error: demo ? "GitHub answered HTTP 503." : "" },
    folderUrl: `${base}/tree/main/sources`,
    catalogs: [file("catalog", "silvergames", "Silvergames.com"), file("catalog", "y8", "Y8.com"), file("catalog", "andkon", "Andkon.com")]
      .map((entry) => ({ ...entry, enabled: enabled[entry.id] ?? localStorage.getItem("flashroyale.andkonEnabled") === "true", problem: demo && entry.id === "y8" ? "Needs Flash Royale 9.0.0 or later." : "" })),
    metadata: ["flashpointLocal", "flashpointOnline", "newgrounds", "silvergames", "y8", "armorgames", "andkon", "flashgames247"].map((id) => file("metadata", id, id)),
    problems: demo ? [{ file: "catalog-y8.json", message: "Needs Flash Royale 9.0.0 or later.", url: `${base}/blob/main/sources/enabled/catalog-y8.json` }] : [],
  });
  return {
    getSourcesStatus: async () => status(),
    setSourcesAutoUpdate: async (value: boolean) => { autoUpdate = value; return status(); },
    checkSourcesNow: async () => status(),
    importSourceFiles: async (): Promise<{ changed: boolean; files: number; signedAt: string; status: SourcesStatus }> => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    setCatalogEnabled: async (id: string, value: boolean) => {
      if (id === "andkon") localStorage.setItem("flashroyale.andkonEnabled", String(value));
      else enabled[id] = value;
      return status();
    },
    openSourcesGithub: async () => {},
  };
}

/** Browser preview of the web link warning; "?linkDemo" asks to open a link shortly after load. */
export function previewLinkApi() {
  const demoUrl = "https://github.com/MCC321-QC/Flash-Royale/releases";
  return {
    onExternalLinkRequest: (callback: (request: { id: string; url: string }) => void) => {
      const timer = import.meta.env.DEV && demoParam("linkDemo") ? window.setTimeout(() => callback({ id: "demo", url: demoUrl }), 800) : 0;
      return () => window.clearTimeout(timer);
    },
    getExternalLinkRequest: async () => demoUrl,
    resolveExternalLink: async (_id: string, confirmed: boolean) => console.info("link confirmed:", confirmed),
  };
}

/** Browser preview of the antivirus settings; "?antivirusDemo" shows a quarantined game and a scan problem. */
export function previewAntivirusApi() {
  const alertDemo = import.meta.env.DEV && demoParam("antivirusAlertDemo");
  const demo = (import.meta.env.DEV && demoParam("antivirusDemo")) || alertDemo;
  let settings: AntivirusSettings = { enabled: true, providers: { defender: true, virustotal: false, metadefender: false }, upload: false, minDetections: 3 };
  const keys: Partial<Record<AntivirusProviderId, string>> = demo ? { virustotal: "a1b2" } : {};
  let threats: AntivirusStatus["threats"] = demo ? [{
    gameId: "demo-threat",
    title: "Suspicious Game",
    fileName: "suspicious-game.swf",
    at: "2026-05-01T12:00:00.000Z",
    quarantined: true,
    removed: false,
    quarantineError: "",
    results: [
      { provider: "defender", malicious: 1, total: 1, names: ["Trojan:SWF/Demo"], link: "" },
      { provider: "virustotal", malicious: 12, total: 62, names: ["SWF.Exploit", "Trojan.Generic"], link: "https://www.virustotal.com/gui/file/0000/detection" },
    ],
  }] : [];
  const provider = (id: AntivirusProviderId, name: string, online: boolean) => ({
    id, name, online, available: true, hasKey: !online || Boolean(keys[id]), keyHint: keys[id] ?? "",
    keyPage: id === "virustotal" ? "https://www.virustotal.com/gui/my-apikey" : "https://metadefender.opswat.com/account",
    enabled: settings.providers[id] && (!online || Boolean(keys[id])),
  });
  const status = (): AntivirusStatus => ({
    settings,
    blocked: false,
    uploadLimitMb: 32,
    detectionChoices: [1, 2, 3, 5],
    providers: [provider("defender", "Microsoft Defender", false), provider("virustotal", "VirusTotal", true), provider("metadefender", "MetaDefender", true)],
    scan: { running: false, done: 0, total: 0, current: "" },
    counts: { games: 24, scanned: demo ? 24 : 0, pending: demo ? 1 : 0 },
    threats,
    problems: demo ? [{ gameId: "demo-problem", title: "Big Game", provider: "virustotal", message: "Daily limit reached.", at: "2026-05-01T12:00:00.000Z" }] : [],
  });
  return {
    getAntivirusStatus: async () => status(),
    setAntivirusSettings: async (patch: Partial<Omit<AntivirusSettings, "providers">> & { providers?: Partial<AntivirusSettings["providers"]> }) => {
      settings = { ...settings, ...patch, providers: { ...settings.providers, ...patch.providers } };
      return status();
    },
    setAntivirusKey: async (id: AntivirusProviderId, key: string) => {
      if (key) {
        keys[id] = key.slice(-4);
        settings.providers[id] = true;
      } else delete keys[id];
      return { verified: false, status: status() };
    },
    scanLibraryForViruses: async () => status(),
    cancelVirusScan: async () => status(),
    restoreQuarantinedGame: async (id: string) => { threats = threats.filter((threat) => threat.gameId !== id); return status(); },
    deleteQuarantinedGame: async (id: string) => { threats = threats.filter((threat) => threat.gameId !== id); return status(); },
    openAntivirusKeyPage: async () => {},
    openAntivirusReport: async () => {},
    onAntivirusChanged: () => () => {},
    onAntivirusThreat: (callback: (threat: AntivirusThreat) => void) => {
      if (alertDemo && threats[0]) callback(threats[0]);
      return () => {};
    },
  };
}

/** Browser preview of the security settings; "?securityDemo" starts blocked with a sample alert. */
export function previewSecurityApi() {
  const demo = import.meta.env.DEV && demoParam("securityDemo");
  const threat: SecurityThreat = {
    id: "CVE-2026-0001",
    ids: ["CVE-2026-0001"],
    title: "Example: type confusion in V8",
    summary: "Preview data. A remote attacker could run code through a crafted web page.",
    severity: "high",
    exploited: true,
    affects: "yes",
    estimated: false,
    unsupported: demo,
    published: "2026-09-09",
    component: "Google Chromium V8",
    installed: "Electron 42.2.0 (Chromium 148.0.7778.97)",
    fixedIn: "Electron 42.11.3",
    sources: ["kev"],
    links: [{ source: "kev", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog" }, { source: "nvd", url: "https://nvd.nist.gov/vuln/detail/CVE-2026-0001" }],
    blocking: true,
    overridden: false,
  };
  let status: SecurityStatus = {
    blocked: demo,
    reason: demo ? "threat" : "",
    prompt: demo ? [threat.id] : [],
    threats: demo ? [threat, {
      ...threat,
      id: "GHSA-demo-0002",
      ids: ["GHSA-demo-0002"],
      title: "Example: denial of service in a dependency",
      summary: "Preview data. Not exploited and not blocking.",
      severity: "medium",
      exploited: false,
      unsupported: false,
      sources: ["github"],
      links: [{ source: "github", url: "https://github.com/advisories" }],
      blocking: false,
    }] : [],
    checkedAt: Date.now(),
    nextCheckAt: Date.now() + 6 * 3600 * 1000,
    checking: false,
    errors: {},
    override: false,
    versions: { electron: "42.2.0", chromium: "148.0.7778.97", node: "24.0.0", "@ruffle-rs/ruffle": "0.7.1", Ruffle: "0.7.1", DirPlayer: "0.8.1" },
    electronSupport: demo ? { supported: false, major: 42, oldestSupported: 43 } : { supported: true, major: 42, oldestSupported: 42 },
    sources: { from: "bundled", signedAt: "", keyId: "", checkedAt: 0 },
  };
  const listeners = new Set<(next: SecurityStatus) => void>();
  const update = (patch: Partial<SecurityStatus>) => {
    status = { ...status, ...patch };
    for (const listener of listeners) listener(status);
    return status;
  };
  const withOverride = (overridden: boolean) => status.threats.map((entry) => ({ ...entry, overridden: entry.blocking && overridden }));
  return {
    getSecurityStatus: async () => status,
    checkSecurity: async () => update({ checkedAt: Date.now() }),
    securityKeepOffline: async () => update({ prompt: [] }),
    securityGoOnline: async () => update({ blocked: false, reason: "", prompt: [], override: status.threats.some((entry) => entry.blocking), threats: withOverride(true) }),
    securityBlockNow: async () => update({ blocked: true, reason: "manual" }),
    setSecurityAlertHidden: async (id: string, hidden: boolean) => update({ threats: status.threats.map((entry) => entry.id === id ? { ...entry, hidden } : entry) }),
    openSecurityLink: async (url: string) => {
      window.open(url, "_blank", "noopener");
    },
    onSecurityChanged: (callback: (next: SecurityStatus) => void) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}

/** Remembered controller for "?controllersDemo", which can be forgotten in Settings. */
const demoController = { id: "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)", ordinal: 0 };

/** Cover sample for "?crop=demo". */
const cropDemoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
        <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#214e78"/><stop offset="1" stop-color="#a7dbdf"/></linearGradient></defs>
        <path fill="url(#sky)" d="M0 0h1200v900H0z"/>
        <circle cx="950" cy="180" r="85" fill="#ffda75"/>
        <path fill="#527e80" d="M0 580 250 270 490 580 760 320 1200 650v250H0z"/>
        <path fill="#7fae6b" d="M0 630q300-210 600 0t600 0v270H0z"/>
        <path fill="#426d4e" d="M0 770q370-220 700-20t500-60v210H0z"/>
        <path fill="#e1c68e" d="m520 900 60-170 180-130-110 150 100 150z"/>
        <text x="60" y="115" fill="#fff" font-family="sans-serif" font-size="54" font-weight="bold">Adventure Valley</text>
        <text x="60" y="165" fill="#def1f3" font-family="sans-serif" font-size="26">Cover crop preview</text>
      </svg>`;

/**
 * Demo versions of browser flashApi calls, spread last over the plain browser mock in main.tsx.
 * Only the calls whose switch is in the page URL are replaced.
 */
export function previewApiOverrides(): Partial<FlashApi> {
  if (!import.meta.env.DEV) return {};
  const params = new URLSearchParams(location.search);
  const api: Partial<FlashApi> = {};
  const electronOnly = () => new Error(messages[readLanguage()].electronOnlyEdit);
  const repeat = (emit: () => void, delay: number, interval: number) => {
    const start = window.setTimeout(emit, delay);
    const timer = window.setInterval(emit, interval);
    return () => { window.clearTimeout(start); window.clearInterval(timer); };
  };

  if (params.has("aboutDemo")) {
    api.getAppInfo = async () => ({ version: "1.0.0", author: "MCC321-QC", repository: "https://github.com/MCC321-QC/Flash-Royale", ruffleVersion: "0.2.0", dirplayerVersion: "0.4.0", foliateVersion: "1.0.1", pdfjsVersion: "6.4.299" });
  }

  if (params.has("musicImportDemo")) {
    api.readLibrary = async () => ({
      libraryRoot: "Electron IPC preview unavailable in browser",
      games: ["Bloons Tower Defense 4", "Fancy Pants Adventure", "Super Mario 63", "Learn to Fly 2", "Papa's Pizzeria", "Age of War"]
        .map((title, index) => previewGame(`music-demo-${index}`, title)),
    });
  }

  if (params.has("historyDemo")) {
    api.listHistory = async () => previewHistory();
    api.getTaskProgress = async () => {
      const running = previewHistory().find((entry) => entry.status === "running");
      return running ? { ...running, cancellable: true } : null;
    };
    api.openHistory = async () => { window.open(`?history=1&historyDemo&language=${readLanguage()}`, "_blank"); };
  }

  if (params.has("sourcesDemo")) {
    api.listExploreGames = async () => { throw new Error("The catalog answered HTTP 500."); };
    api.searchMetadata = async () => ({ results: [], errors: [{ source: "newgrounds", message: "HTTP 404" }] });
  }

  if (params.has("controllersDemo")) {
    api.getControllerAssignments = async () => [{ mode: "device", ...demoController }, ...createDefaultAssignments().slice(1)];
    api.getControllerNames = async () => [{ ...demoController, name: "Living room pad" }];
    api.forgetController = async () => ({ names: [], assignments: createDefaultAssignments() });
  }

  if (params.has("importProgressDemo")) {
    api.onImportProgress = (callback: (progress: ImportProgress) => void) => {
      const files = ["Bloons Tower Defense 4.swf", "The Fancy Pants Adventure World 3.swf", "Directors Cut.dcr", "Alien Hominid.swf", "A game with a very long file name that should be truncated nicely in the dialog.swf"];
      let index = 0;
      return repeat(() => {
        const fileName = files[index % files.length];
        callback({ current: (index % files.length) + 1, total: files.length, fileName, filePath: `C:\\Users\\Player\\Downloads\\Flash games\\Collections\\2011\\${fileName}` });
        index += 1;
      }, 300, 1800);
    };
  }

  if (params.has("exploreImport")) {
    api.onExploreImportProgress = (callback: (progress: ExploreImportProgressState) => void) => {
      const total = 8.4 * 1024 * 1024;
      const title = "The Fancy Pants Adventure: World 3";
      let step = 0;
      return repeat(() => {
        const phase = step % 12;
        if (phase === 0) callback({ title, stage: "preparing", percent: null, receivedBytes: 0, totalBytes: null });
        else if (phase < 11) callback({ title, stage: "downloading", percent: phase * 10, receivedBytes: (total * phase) / 10, totalBytes: total });
        else callback({ title, stage: "saving", percent: null, receivedBytes: total, totalBytes: total });
        step += 1;
      }, 300, 900);
    };
  }

  if (params.has("libraryMigration")) {
    api.onGameStorageMigrationProgress = (callback: (progress: GameStorageMigrationProgress) => void) => {
      const titles = ["Bloons Tower Defense 4", "The Fancy Pants Adventure: World 3", "Director's Cut", "Alien Hominid", "A game with a very long title that should be truncated nicely in the window"];
      let step = 0;
      return repeat(() => {
        const index = step % titles.length;
        callback({ current: index + 1, total: titles.length, gameTitle: titles[index], percent: Math.round(((index + 0.5) / titles.length) * 100) });
        step += 1;
      }, 600, 1800);
    };
  }

  if (params.has("flashpointImportDemo")) {
    api.scanFlashpointDownloads = async () => ({
      status: "ok" as const,
      games: [
        { key: "preview-game-1", title: "Bloons Tower Defense 4", format: "swf" as const, developer: "Ninja Kiwi", publisher: "Ninja Kiwi", releaseDate: "2011-07-14", cover: "" },
        { key: "preview-game-2", title: "The Fancy Pants Adventure: World 3", format: "swf" as const, developer: "Brad Borne", publisher: "Armor Games", releaseDate: "2012-04-04", cover: "" },
        { key: "preview-game-3", title: "Director's Cut", format: "dcr" as const, developer: "Example Studio", publisher: "Flashpoint", releaseDate: "2004-10-01", cover: "" },
      ],
    });
  }

  if (params.has("metadataImportDemo")) {
    api.scanFlashpointMetadata = async () => ({
      status: "ok" as const,
      games: [
        {
          gameId: "preview-meta-1", title: "Bloons Tower Defense 4", coverUrl: "", logo: "",
          matches: [
            { source: "flashpointOnline" as const, id: "fp-1", title: "Bloons Tower Defense 4", score: 1, matchedBy: "id" as const, platform: "Flash", url: "https://flashpointproject.github.io/flashpoint-database/", sourceUrl: "https://ninjakiwi.com" },
            { source: "newgrounds" as const, id: "ng-1", title: "Bloons TD 4", score: 0.82, matchedBy: "fuzzy" as const, platform: "Flash", url: "https://www.newgrounds.com/portal/view/1", sourceUrl: "" },
          ],
          fields: [
            { field: "developer" as const, kind: "fill" as const, current: "", value: "Ninja Kiwi", source: "flashpointOnline" as const, fuzzy: false },
            { field: "releaseDate" as const, kind: "fill" as const, current: "", value: "2011-07-14", source: "flashpointOnline" as const, fuzzy: false },
            { field: "tags" as const, kind: "merge" as const, current: ["Strategy"], value: ["Strategy", "Tower Defense", "Balloons"], source: "flashpointOnline" as const, fuzzy: false },
            { field: "description" as const, kind: "overwrite" as const, current: "Old description.", value: "Pop the bloons before they reach the end of the track.", source: "newgrounds" as const, fuzzy: true },
          ],
        },
        {
          gameId: "preview-meta-2", title: "The Fancy Pants Adventure: World 3", coverUrl: "", logo: "",
          matches: [{ source: "armorgames" as const, id: "ag-1", title: "Fancy Pants Adventure World 3", score: 0.93, matchedBy: "title" as const, platform: "Flash", url: "https://armorgames.com", sourceUrl: "" }],
          fields: [
            { field: "publisher" as const, kind: "fill" as const, current: "", value: "Armor Games", source: "armorgames" as const, fuzzy: false },
            { field: "sourceRating:armorgames" as const, kind: "fill" as const, current: "", value: "4.6 / 5", source: "armorgames" as const, fuzzy: false },
          ],
        },
      ],
      unmatched: [{ gameId: "preview-meta-3", title: "Director's Cut", coverUrl: "" }],
    });
  }

  if (params.has("metadataSearchDemo")) {
    api.searchMetadata = async (query) => ({
      results: [
        { source: "newgrounds", id: "ng-bloons-4", title: "Bloons Tower Defense 4", platform: "Flash", year: "2011", developer: "Ninja Kiwi", imageUrl: "", url: "https://www.newgrounds.com/portal/view/000001", score: 0.96 },
        { source: "armorgames", id: "ag-bloons-4", title: "Bloons Tower Defense 4", platform: "Flash", year: "2011", developer: "Ninja Kiwi", imageUrl: "", url: "https://armorgames.com", score: 0.91 },
        { source: "y8", id: "y8-bloons-4", title: `Bloons Tower Defense 4 - ${query}`, platform: "Flash", year: "2011", developer: "Ninja Kiwi", imageUrl: "", url: "https://www.y8.com", score: 0.78 },
      ],
      errors: [],
    });
    api.proposeMetadata = async (gameId, source, id) => ({
      gameId, title: "Bloons Tower Defense 4", coverUrl: "", logo: "",
      matches: [{ source, id, title: "Bloons Tower Defense 4", score: source === "newgrounds" ? 0.96 : 0.91, matchedBy: "manual", platform: "Flash", url: source === "newgrounds" ? "https://www.newgrounds.com/portal/view/000001" : "https://armorgames.com", sourceUrl: "https://ninjakiwi.com" }],
      fields: [
        { field: "developer", kind: "fill", current: "", value: "Ninja Kiwi", source, fuzzy: false },
        { field: "publisher", kind: "fill", current: "", value: "Ninja Kiwi", source, fuzzy: false },
        { field: "releaseDate", kind: "fill", current: "", value: "2011-07-14", source, fuzzy: false },
        { field: "tags", kind: "merge", current: ["Strategy"], value: ["Strategy", "Tower Defense", "Balloons"], source, fuzzy: false },
        { field: "description", kind: "overwrite", current: "A classic tower defense game.", value: "Build towers and pop the bloons before they reach the end of the track.", source, fuzzy: false },
      ],
    });
    api.applyMetadataFrom = async (_language, gameId) => ({ status: "ok", updated: [gameId === "preview-search-game" ? "Bloons Tower Defense 4" : gameId] });
  }

  // `?reader=demo&guide=guide_0000000000000000&demoUrl=/file.pdf&demoFormat=pdf` opens a sample file.
  if (params.has("demoUrl")) {
    api.loadGuide = async (gameId, guideId) => {
      const url = params.get("demoUrl") || "";
      const format = (params.get("demoFormat") || "txt") as GuideFormat;
      const source = params.get("demoEmbed") ? { type: "embed" as const, url } : format === "web" ? { type: "web" as const, url } : { type: "file" as const, url, name: url.split("/").pop() || "guide" };
      return { gameId, gameTitle: "Preview game", guide: { id: guideId, kind: "file" as const, format, title: params.get("demoTitle") || "Sample guide" }, state: null, source };
    };
  }

  if (params.get("crop") === "demo") {
    api.getCropSource = async (requestId) => {
      if (requestId !== "demo") throw electronOnly();
      return { gameId: "crop-demo", mode: "cover", source: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cropDemoSvg)}` };
    };
    api.completeCropWindow = async (requestId, status) => {
      if (requestId !== "demo") throw electronOnly();
      console.info(`Cover crop preview: ${status} (no files changed).`);
      location.assign(location.pathname);
    };
  }

  return api;
}

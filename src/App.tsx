import Fuse from "fuse.js";
import { libraryMusicLabels, libraryMusicPlaybackLabels } from "./i18n-library-music";
import { defaultMusicLabels } from "./i18n-default-music";
import { createPlayerPlayback } from "./player-playback";
import { createSessionClock } from "../electron/session-clock.mjs";
import { gamePausedLabels, playbackLabels, playerVolumeLabels, playerResetConfirmLabels, playerCloseConfirmLabels } from "./i18n-playback";
import { softwareInfoLabels } from "./i18n";
import { sourcesLabels } from "./i18n-sources";
import { securityLabels } from "./i18n-security";
import { outsideControllerApp } from "./controller-external";
import { manualUpdateLabels, manualUpdateTitles, portableUpdateLabels, showOnlineOnlyGamesLabels, startupUpdateCheckLabels, unblockUpdateDescriptions, updateScriptExecutionLabels } from "./i18n";
import { BoundedCache } from "./boundedCache";
import { ResizableTextarea } from "./ResizableTextarea";
import { useWindowDrag } from "./WindowTitleBar";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowLeft,
  ArrowUp,
  Ban,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Compass,
  Copy,
  ContactRound,
  Crop,
  Download,
  ExternalLink,
  FolderOpen,
  Frame,
  Gamepad2,
  Github,
  Hand,
  Heart,
  History,
  ImagePlus,
  Images,
  Info,
  Gauge,
  Layers,
  Maximize,
  Minimize,
  Move,
  Music,
  MonitorPlay,
  Paintbrush,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Pin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ScanSearch,
  ScanLine,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  SquareDashedMousePointer,
  SquareMousePointer,
  Star,
  Tags,
  Trash2,
  Upload,
  Users,
  Volume2,
  Keyboard,
  VolumeX,
  FileText,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import flashRoyaleLogo from "../assets/new-flash-royale-logo.webp";
import { formatFileSize } from "./file-size";
import { VirtualGameGrid, type GameGridHandle } from "./VirtualGameGrid";
import { coverThumbnailUrl, coverThumbnailWidth, requestCoverThumbnail } from "./cover-thumbnails";
import { GameCardSettings } from "./GameCardSettings";
import { gameCardSettingsLabels } from "./i18n-game-cards";
import { gameCardFieldRows, useGameCardPreferences, type GameCardFieldId, type GameCardPreferences } from "./game-card-preferences";
import { useLibraryLocationLayout, useLibraryPathVisibility } from "./library-toolbar";
import { libraryPathLabels } from "./i18n";
import { StarRating } from "./StarRating";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { MusicImportDialog } from "./MusicImportDialog";
import { ControllerAssignmentsSettings, ControllerNamesSettings, NativeControllerInputSetting } from "./ControllerSettings";
import { CursorSettingsPanel } from "./CursorSettings";
import { ThemeSettingsPanel } from "./ThemeSettings";
import { ControllerChordGlyph, ControllerHintsSlot, ControllerNavigationSettings, ControllerNavigationToggle, useControllerNavigation } from "./ControllerNavigation";
import { focusControl, navigationControls, navigationScope, touchModeEnabled } from "./controller-navigation";
import { wineTouch } from "./wine-touch";
import { nativeControllerFailedLabels, navigationLabels, panelMoveLabels, panelResizeLabels } from "./i18n-navigation";
import { PanelResizeGrip } from "./ResizeGrip";
import { remapLabels } from "./i18n-remap";
import { useControllerRemap } from "./remap";
import { OnscreenGamepad, OnscreenSettings, OnscreenEditorButton } from "./OnscreenGamepad";
import { onscreenLabels } from "./i18n-onscreen";
import { exploreCloseBlockedLabels } from "./i18n";
import { compatibilitySettingsLabels, gameOptionHints, gamePanelLabels, scalingPerformanceHints } from "./i18n";
import shockwaveLabels from "../electron/shockwave-labels.json";
import { effectiveGamePlayer, gameCapabilities, GamePlayerSelect, isExternalGamePlayer, PlayersSettingsSection, refreshPlayers, usePlayers, useAllGamesFullscreen } from "./PlayersSettings";
import { CompatibilityPill, GameCompatibility } from "./GameCompatibility";
import { flashpointImportLabels, playerLabels } from "./i18n-players";
import { FlashpointImportPrompt, runFlashpointImport } from "./FlashpointImport";
import { SecurityAlert, SecuritySettingsSection } from "./Security";
import { SourcesSettingsSection } from "./SourcesSettings";
import { AntivirusSettingsSection, AntivirusThreatAlert } from "./AntivirusSettings";
import { antivirusLabels } from "./i18n-antivirus";
import { FlashpointMetadataPrompt, MetadataSearchHost, openMetadataSearch, runFlashpointMetadata } from "./FlashpointMetadata";
import { useDevPreviews } from "./devPreviews";
import { manualImportLabels } from "./i18n";
import { fullscreenOverrideLabels } from "./i18n-settings";
import { fpsCounterLabels } from "./i18n-settings";
import { usePanelWidth } from "./panel-width";
import { FpsOverlay, useShowFpsCounter, useFpsCounterStyle } from "./FpsCounter";
import { addScreenshotImages, ShowcaseScreenshots, useUserScreenshots } from "./ShowcaseScreenshots";
import { showcaseLabels } from "./i18n-showcase";
import { metadataSourceLabels } from "./i18n-metadata-sources";
import { DesktopShortcut } from "./DesktopShortcut";
import { Changelog } from "./Changelog";
import { cachedDateTimeFormat, cachedNumberFormat } from "./intl-cache";
import { GameGuidesEditor, GameGuidesInfo, PlayerGuidesMenu } from "./GameGuides";
import { CrtSettings, CrtBezel, GlobalCrtSettings } from "./CrtSettings";
import { keyboardUiLabels } from "./i18n-navigation";
import { effectiveCrt, crtRadius, crtParameters, crtBezelConfig, crtBezelDrawsEdge, crtFrameAspect, crtHidesLaunch, crtInputSize, crtNeedsCapture, crtNeedsFrames } from "./crt";
import { useGlobalCrt } from "./GlobalCrt";
import { crtLabels, crtSessionLabels, crtEffectLabels } from "./i18n-crt";
import { attachRoyale, findFrameCanvas, findGameCanvas, preserveFramesDuring } from "../public/crt-runtime.js";
import { CrtAmbientBackground, useCrtFrameFeed } from "./CrtEffects";
import { screenshotLabels } from "./i18n-screenshots";
import { backgroundLabels, historyLabels } from "./i18n-history";
import { SettingsSection, SettingsSectionLinks, SettingsSections, SettingsSectionTab } from "./SettingsSections";
import { settingsOverviewLabels, settingsSectionLabels } from "./i18n";
import { settingsHelp } from "./i18n-settings";
import { SettingsSidebar } from "./SettingsSidebar";
import { MusicNormalizationSettings } from "./MusicNormalizationSettings";
import { aboutLinkLabels, importGameLabels, cardSizeLabels, cardSizeToggleLabels, confirmationActionLabels, datePlaceholderLabels, detailPanelLabels, exploreCoverLabels, exploreSettingsLabels, gameSettingsLabels, generalSettingsLabels, importCountLabels, messages, playerControlLabels, playTimeLabels, readLanguage, renameActionLabels, settingsInfoLabels, sortLabels, sourceMetadataLabels, stopPlayingLabels, themeLabels, toastLabels, translateError, importProgressLabels, musicLabels, coverCaptureLabels, closeBlockedLabels, updateActionLabels, updateCurrentTitles, updateLabels, userRatingLabels, type Language } from "./i18n";
import type { ActivityEntry, AppInfo, FlashApi, Game, GamePatch, ImportProgress, ImportResult, LibraryState, PlayerWindowData, SwfMetadata, UpdateCheckResult } from "./types";
import { currentActivity, describeActivity } from "./activity";

type Filter =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "category"; value: string }
  | { type: "tag"; value: string };

type PlayerResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ToastMessage =
  | string
  | { type: "importSummary"; imported: number; skipped: number }
  | { type: "exploreImported"; title: string }
  | { type: "appStarted" }
  | { type: "coversFinished" }
  | { type: "gameStarted" | "gameStopped" | "coverCreated"; title: string };

type ConfirmationRequest = {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  resolve: (confirmed: boolean) => void;
};

type TextPromptRequest = {
  message: string;
  value: string;
  resolve: (value: string | null) => void;
};

type DetailsDraft = {
  title: string;
  category: string;
  releaseDate: string;
  developer: string;
  publisher: string;
  version: string;
  fullscreenByDefault: boolean;
  showFps: boolean;
  standaloneCompatibility: boolean;
  fixScaling: boolean;
  allowOnlineFeatures: boolean;
  repeatMusic: boolean;
  tags: string;
  description: string;
  notes: string;
};

const emptyLibrary: LibraryState = {
  libraryRoot: "",
  games: [],
};

const gameCardWidths = [140, 160, 180, 200, 220, 300, 400, 500] as const;

/** Most used tags in the library first; ties keep alphabetical order. */
function tagsByUsage(tags: string[], usage: Map<string, number>) {
  return [...tags].sort((left, right) => (usage.get(right) || 0) - (usage.get(left) || 0) || left.localeCompare(right, "en-US"));
}

function formatDate(value: string | null, language: Language) {
  if (!value) return messages[language].never;
  return cachedDateTimeFormat(language === "zh" ? "zh-CN" : language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPlayDuration(value: number, language: Language) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const units = playTimeLabels[language];
  if (hours > 0) return `${hours} ${units.hour} ${minutes} ${units.minute}`;
  if (minutes > 0) return `${minutes} ${units.minute}`;
  return `${seconds}${units.second}`;
}

function formatSessionDuration(value: number, language: Language) {
  const seconds = Math.max(0, Math.floor(value));
  const formatter = cachedNumberFormat(language === "zh" ? "zh-CN" : language, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${formatter.format(hours)}:${formatter.format(minutes)}:${formatter.format(seconds % 60)}`;
}

function normalizeTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function createDetailsDraft(game: Game | null): DetailsDraft {
  return {
    title: game?.title || "",
    category: game?.category || "",
    releaseDate: game?.releaseDate || "",
    developer: game?.developer || "",
    publisher: game?.publisher || "",
    version: game?.version || "",
    fullscreenByDefault: Boolean(game?.fullscreenByDefault),
    showFps: Boolean(game?.showFps),
    standaloneCompatibility: Boolean(game?.standaloneCompatibility),
    fixScaling: Boolean(game?.fixScaling),
    allowOnlineFeatures: game?.allowOnlineFeatures !== false,
    repeatMusic: game?.repeatMusic !== false,
    tags: game?.tags.join(", ") || "",
    description: game?.description || "",
    notes: game?.notes || "",
  };
}

function detailsDraftToPatch(draft: DetailsDraft): GamePatch {
  return {
    title: draft.title,
    category: draft.category,
    releaseDate: draft.releaseDate,
    developer: draft.developer,
    publisher: draft.publisher,
    version: draft.version,
    fullscreenByDefault: draft.fullscreenByDefault,
    showFps: draft.showFps,
    standaloneCompatibility: draft.standaloneCompatibility,
    fixScaling: draft.fixScaling,
    allowOnlineFeatures: draft.allowOnlineFeatures,
    repeatMusic: draft.repeatMusic,
    tags: normalizeTags(draft.tags),
    description: draft.description,
    notes: draft.notes,
  };
}

async function loadRuffleScript(language: Language) {
  if (window.RufflePlayer) return;
  const assetBaseUrl = window.flashApi ? await window.flashApi.getAssetBaseUrl() : window.location.origin;
  const scriptUrl = await window.flashApi?.getRuffleRuntime?.().then((runtime) => runtime.scriptUrl).catch(() => "") || `${assetBaseUrl}/ruffle/ruffle.js`;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-ruffle]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(messages[language].ruffleLoadFailed)), { once: true });
      return;
    }

    (window as unknown as { RufflePlayer?: Record<string, unknown> }).RufflePlayer = {
      config: {
        autoplay: "on",
        unmuteOverlay: "hidden",
        splashScreen: false,
      },
    };

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.dataset.ruffle = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(messages[language].ruffleMissing));
    document.head.appendChild(script);
  });
}

function findCanvas(root: HTMLElement | ShadowRoot): HTMLCanvasElement | null {
  const direct = root.querySelector("canvas");
  if (direct) return direct;
  const elements = Array.from(root.querySelectorAll<HTMLElement>("*"));
  for (const element of elements) {
    if (element.shadowRoot) {
      const nested = findCanvas(element.shadowRoot);
      if (nested) return nested;
    }
  }
  return null;
}

function ruffleApi(player: HTMLElement) {
  return (player as HTMLElement & {
    ruffle(): {
      suspend(): void;
      resume(): void;
      volume: number;
      load(options: string | (({ url: string } | { data: ArrayBuffer; swfFileName: string; base: string }) & { base?: string; upgradeToHttps?: boolean; preferredRenderer?: "wgpu-webgl"; volume?: number; allowScriptAccess?: boolean; salign?: string; forceAlign?: boolean; scale?: string; forceScale?: boolean; allowNetworking?: "all" | "none"; urlRewriteRules?: [RegExp | string, string][] })): Promise<void> | void;
    };
  }).ruffle();
}

function coverStatusLabel(status: Game["coverStatus"], language: Language) {
  const text = messages[language];
  if (status === "captured") return text.coverCaptured;
  if (status === "custom") return text.coverCustom;
  if (status === "explore") return exploreCoverLabels[language];
  return text.coverFallback;
}

function displayCategory(category: string, language: Language) {
  if (Object.values(messages).some((text) => text.uncategorized === category)) {
    return messages[language].uncategorized;
  }
  return category;
}

function sourceRatingLabel(game: Pick<Game, "sourceRatingSource">, language: Language) {
  const label = sourceMetadataLabels[language].rating;
  const source = game.sourceRatingSource;
  const name = source ? Object.entries(metadataSourceLabels[language].sourceNames).find(([id]) => id === source)?.[1] ?? source : "Silvergames";
  return label.replace(/silvergames/i, name);
}

function gameSourceRatings(game: Game) {
  const ratings = { ...game.sourceRatings };
  if (game.sourceRating !== undefined) {
    const source = game.sourceRatingSource || "silvergames";
    if (!ratings[source]) ratings[source] = { rating: game.sourceRating, count: game.sourceRatingCount };
  }
  return Object.entries(ratings).map(([source, value]) => ({
    source,
    sourceRatingSource: source,
    sourceRating: value.rating,
    sourceRatingCount: value.count,
  }));
}

function cardSourceRating(game: Game) {
  return gameSourceRatings(game).reduce<ReturnType<typeof gameSourceRatings>[number] | undefined>((popular, rating) =>
    !popular || (rating.sourceRatingCount ?? -1) > (popular.sourceRatingCount ?? -1) ? rating : popular, undefined);
}

function formatReleaseDate(value: string, language: Language) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return cachedDateTimeFormat(language === "zh" ? "zh-CN" : language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
}

const musicFadeMs = 600;

// Uses a timer rather than requestAnimationFrame so fades still finish while the window is minimized.
function fadeAudioVolume(audio: HTMLAudioElement, getTarget: () => number, onDone?: () => void) {
  const startVolume = audio.volume;
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    const progress = Math.min(1, (Date.now() - startedAt) / musicFadeMs);
    audio.volume = Math.min(1, Math.max(0, startVolume + (getTarget() - startVolume) * progress));
    if (progress >= 1) {
      window.clearInterval(timer);
      onDone?.();
    }
  }, 30);
  return () => window.clearInterval(timer);
}

function fadeManagedAudio(
  audio: HTMLAudioElement,
  getTarget: () => number,
  activeFadeRef: { current: { audio: HTMLAudioElement; cancel: () => void } | null },
  onDone?: () => void,
) {
  if (activeFadeRef.current?.audio === audio) activeFadeRef.current.cancel();
  let cancel = () => {};
  cancel = fadeAudioVolume(audio, getTarget, () => {
    if (activeFadeRef.current?.cancel === cancel) activeFadeRef.current = null;
    onDone?.();
  });
  activeFadeRef.current = { audio, cancel };
}

function formatTrackDuration(seconds: number) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function createCoverDataUrl(canvas: HTMLCanvasElement, language: Language) {
  const text = messages[language];
  if (canvas.width < 16 || canvas.height < 16) {
    throw new Error(text.coverTooSmall);
  }

  try {
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 36;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    if (probeContext) {
      probeContext.drawImage(canvas, 0, 0, probe.width, probe.height);
      const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
      let visiblePixels = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 8) visiblePixels += 1;
      }
      if (visiblePixels < probe.width * probe.height * 0.02) {
        throw new Error(text.coverNotRendered);
      }
    }
  } catch (error) {
    if (error instanceof Error && ([text.coverTooSmall, text.coverNotRendered] as string[]).includes(error.message)) {
      throw error;
    }
  }

  const output = document.createElement("canvas");
  output.width = 960;
  output.height = 540;
  const context = output.getContext("2d");
  if (!context) {
    throw new Error(text.canvasUnavailable);
  }
  context.fillStyle = "#0b0f14";
  context.fillRect(0, 0, output.width, output.height);

  const sourceRatio = canvas.width / canvas.height;
  const targetRatio = output.width / output.height;
  let sx = 0;
  let sy = 0;
  let sw = canvas.width;
  let sh = canvas.height;
  if (sourceRatio > targetRatio) {
    sw = canvas.height * targetRatio;
    sx = (canvas.width - sw) / 2;
  } else if (sourceRatio < targetRatio) {
    sh = canvas.width / targetRatio;
    sy = (canvas.height - sh) / 2;
  }
  context.drawImage(canvas, sx, sy, sw, sh, 0, 0, output.width, output.height);

  const dataUrl = output.toDataURL("image/png");
  if (dataUrl.length < 1600) {
    throw new Error(text.coverDataInvalid);
  }
  return dataUrl;
}

function CoverImage({ game, className, language, cardWidth }: { game: Game; className?: string; language: Language; cardWidth?: number }) {
  const [failed, setFailed] = useState(false);
  const thumbnailWidth = cardWidth && game.coverStatus !== "fallback" ? coverThumbnailWidth(cardWidth) : 0;

  useEffect(() => {
    setFailed(false);
  }, [game.coverUrl]);

  if (failed) {
    return (
      <div className={className ? `${className} cover-fallback` : "cover-fallback"}>
        <Gamepad2 size={28} />
        <span>{game.title}</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={coverThumbnailUrl(game.coverUrl, thumbnailWidth)}
      loading="lazy"
      decoding="async"
      alt={`${game.title} ${messages[language].coverAlt}`}
      onLoad={(event) => requestCoverThumbnail(game.id, game.coverUrl, thumbnailWidth, event.currentTarget)}
      onError={() => setFailed(true)}
    />
  );
}

function Sidebar({
  games,
  filter,
  setFilter,
  onRenameTag,
  onDeleteTag,
  onRenameCategory,
  onOpenSettings,
  language,
}: {
  games: Game[];
  filter: Filter;
  setFilter: (filter: Filter) => void;
  onRenameTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
  onRenameCategory: (category: string) => void;
  onOpenSettings: () => void;
  language: Language;
}) {
  const text = messages[language];
  const [categoriesExpanded, setCategoriesExpanded] = useState(() => readStoredFlag("flashmanager.categoriesExpanded"));
  const [tagsExpanded, setTagsExpanded] = useState(() => readStoredFlag("flashmanager.tagsExpanded"));
  useEffect(() => {
    try {
      localStorage.setItem("flashmanager.categoriesExpanded", String(categoriesExpanded));
      localStorage.setItem("flashmanager.tagsExpanded", String(tagsExpanded));
    } catch (error) {
      console.error("Could not save sidebar expansion preferences", error);
    }
  }, [categoriesExpanded, tagsExpanded]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of games) counts.set(game.category, (counts.get(game.category) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "en-US"));
  }, [games]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of games) {
      for (const tag of game.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "en-US"));
  }, [games]);

  return (
    <aside className="sidebar" data-controller-region="" data-controller-navigation="rows">
      <div className="brand">
        <div className="brand-mark">
          <img src={flashRoyaleLogo} alt="" />
        </div>
        <div>
          <strong>Flash Royale</strong>
          <span>{text.localLibrary}</span>
        </div>
      </div>

      <nav className="nav-section">
        <button className={filter.type === "all" ? "active" : ""} onClick={() => setFilter({ type: "all" })}>
          <FolderOpen size={17} />
          {text.allGames}
          <span>{games.length}</span>
        </button>
        <button
          className={filter.type === "favorites" ? "active" : ""}
          onClick={() => setFilter({ type: "favorites" })}
        >
          <Star size={17} />
          {text.favorites}
          <span>{games.filter((game) => game.favorite).length}</span>
        </button>
      </nav>

      <button className="side-heading side-heading-toggle" type="button" aria-expanded={categoriesExpanded} onClick={() => setCategoriesExpanded(!categoriesExpanded)}>
        <span>{text.categories}</span><ChevronDown className={categoriesExpanded ? "is-expanded" : undefined} size={14} aria-hidden="true" />
      </button>
      {categoriesExpanded && (categories.length > 0
        ? <div className="side-list">
          {categories.map(([category, count]) => (
            <div className="side-row" key={category}>
              <button
                className={filter.type === "category" && filter.value === category ? "active" : ""}
                onClick={() => setFilter({ type: "category", value: category })}
                title={displayCategory(category, language)}
              >
                <span>{displayCategory(category, language)}</span>
                <em>{count}</em>
              </button>
              <button className="icon small rename-button" title={text.renameCategory} onClick={() => onRenameCategory(category)}>
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>
        : <div className="side-empty">{sourceMetadataLabels[language].noCategories}</div>)}

      <button className="side-heading side-heading-toggle" type="button" aria-expanded={tagsExpanded} onClick={() => setTagsExpanded(!tagsExpanded)}>
        <span>{text.tags}</span><ChevronDown className={tagsExpanded ? "is-expanded" : undefined} size={14} aria-hidden="true" />
      </button>
      {tagsExpanded && (tags.length > 0
        ? <div className="tag-list">
          {tags.map(([tag, count]) => (
            <div className="tag-row" key={tag}>
              <button
                className={filter.type === "tag" && filter.value === tag ? "active tag-pill" : "tag-pill"}
                onClick={() => setFilter({ type: "tag", value: tag })}
                title={tag}
              >
                <Tags size={13} />
                <span>{tag}</span>
                <em>{count}</em>
              </button>
              <button className="icon small rename-button" title={text.renameTag} onClick={() => onRenameTag(tag)}>
                <Pencil size={14} />
              </button>
              <button className="icon small danger hover-reveal" title={text.deleteTag} onClick={() => onDeleteTag(tag)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        : <div className="side-empty">{sourceMetadataLabels[language].noTags}</div>)}

      <button className="settings-trigger" data-controller-action="appSettings" onClick={onOpenSettings}>
        <Settings size={17} />
        {text.settings}
      </button>
    </aside>
  );
}

function GameCard({
  game,
  selected,
  onSelect,
  language,
  showFavoriteBadge,
  preferences,
  tagUsage,
  cardWidth,
}: {
  game: Game;
  selected: boolean;
  onSelect: () => void;
  language: Language;
  showFavoriteBadge: boolean;
  preferences: GameCardPreferences;
  tagUsage: Map<string, number>;
  cardWidth: number;
}) {
  const text = messages[language];
  const sourceRating = cardSourceRating(game);
  const visibleRating = game.userRating ?? sourceRating?.sourceRating;
  const category = displayCategory(game.category, language);
  const hasCategory = Boolean(category) && category !== text.uncategorized;
  const enabled = (id: GameCardFieldId) => preferences.fields.some(field => field.id === id && field.enabled);
  const showTags = enabled("tags");
  const showPill = enabled("compatibility") && !game.onlineOnly;
  const hasTagRow = showPill || (showTags && game.tags.length > 0);
  const sortedTags = showTags ? tagsByUsage(game.tags, tagUsage) : [];
  const shownTags = preferences.maxTags ? sortedTags.slice(0, preferences.maxTags) : sortedTags;
  const hiddenTags = sortedTags.slice(shownTags.length);
  const metadata: Record<Exclude<GameCardFieldId, "tags" | "compatibility">, string | null> = {
    category: hasCategory ? category : null,
    releaseDate: enabled("releaseDate") && game.releaseDate ? `${text.release}: ${formatReleaseDate(game.releaseDate, language)}` : null,
    developer: game.developer ? `${text.developer}: ${game.developer}` : null,
    publisher: game.publisher ? `${text.publisher}: ${game.publisher}` : null,
    version: game.version ? `${sourceMetadataLabels[language].version}: ${game.version}` : null,
    playTime: `${gameCardSettingsLabels[language].timePlayed}: ${game.totalPlaySeconds ? formatPlayDuration(game.totalPlaySeconds, language) : text.notPlayed}`,
    playedTimes: `${gameCardSettingsLabels[language].playedTimes}: ${cachedNumberFormat(language, { maximumFractionDigits: 0 }).format(game.playCount ?? 0)}`,
  };
  const rows = gameCardFieldRows(preferences.fields).flatMap(fields => {
    const id = fields[0];
    if (id === "tags" || id === "compatibility") {
      if (!hasTagRow) return [];
      return [{ height: "auto", content: <div className="mini-tags" key="pills" data-card-row="pills">
        {fields.map(field => field === "compatibility"
          ? showPill && <CompatibilityPill key={field} game={game} language={language} />
          : <Fragment key={field}>
            {shownTags.map(tag => <em key={tag} title={tag}>{tag}</em>)}
            {hiddenTags.length > 0 && <em className="mini-tags-more" title={hiddenTags.join(", ")}>+{hiddenTags.length}</em>}
          </Fragment>)}
      </div> }];
    }
    const value = metadata[id];
    return value ? [{ height: "16px", content: <span key={id} className={id === "category" ? undefined : "game-card-metadata"} title={value} data-card-row={id}>{value}</span> }] : [];
  });

  return (
    <button
      className={`${selected ? "game-card selected" : "game-card"}${game.onlineOnly ? " online-only" : ""}${rows.length ? "" : " metadata-empty"}`}
      data-game-id={game.id}
      onClick={onSelect}
    >
      <div className="cover-wrap">
        <CoverImage game={game} language={language} cardWidth={cardWidth} />
        {game.favorite && showFavoriteBadge && (
          <span className="fav-badge" title={messages[language].selectedFavorite}>
            <Heart size={15} fill="currentColor" />
          </span>
        )}
        {game.quarantined && (
          <span className="quarantine-badge" title={antivirusLabels[language].badge}>
            <ShieldAlert size={13} aria-hidden="true" />
            <span>{antivirusLabels[language].badge}</span>
          </span>
        )}
        {preferences.showRating && visibleRating !== undefined && Number.isFinite(visibleRating) && (
          <span className="cover-rating">
            <StarRating rating={visibleRating} label={game.userRating !== undefined ? userRatingLabels[language].title : sourceRatingLabel(sourceRating ?? game, language)} language={language} compact />
          </span>
        )}
      </div>
      <div
        className="game-card-body"
        style={{ gridTemplateRows: [rows.length ? "34px" : "auto", ...rows.map(row => row.height)].join(" ") }}
      >
        <strong title={game.title}>{game.title}</strong>
        {rows.map(row => row.content)}
      </div>
    </button>
  );
}

function PlayToggleButton({
  isRunning,
  onClick,
  disabled,
  className,
  language,
  fixedWidth = false,
}: {
  isRunning: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  language: Language;
  fixedWidth?: boolean;
}) {
  const playFace = (
    <>
      <Play size={17} fill="currentColor" />
      {messages[language].run}
    </>
  );
  const stopFace = (
    <>
      <Square size={15} fill="currentColor" />
      {stopPlayingLabels[language]}
    </>
  );
  return (
    <button
      className={`primary${className ? ` ${className}` : ""}${isRunning ? " stop-playing" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {fixedWidth ? (
        <span className="play-toggle-faces">
          <span className={isRunning ? "play-toggle-face inactive" : "play-toggle-face"}>{playFace}</span>
          <span className={isRunning ? "play-toggle-face" : "play-toggle-face inactive"}>{stopFace}</span>
        </span>
      ) : isRunning ? (
        stopFace
      ) : (
        playFace
      )}
    </button>
  );
}

/** Opens the game's screenshots, or when it has none yet, offers to add images from elsewhere. */
function ScreenshotsButton({ game, language }: { game: Game; language: Language }) {
  const { chooseFiles } = useControllerNavigation();
  const screenshots = useUserScreenshots(game.id, !game.onlineOnly);
  const [adding, setAdding] = useState(false);
  if (game.onlineOnly || screenshots === null) return null;
  if (!screenshots.length) {
    const text = showcaseLabels[language];
    const add = async () => {
      setAdding(true);
      try {
        const message = await addScreenshotImages(game.id, language, chooseFiles);
        if (message) window.dispatchEvent(new CustomEvent("flash-royale-toast", { detail: message }));
      } catch (error) {
        window.dispatchEvent(new CustomEvent("flash-royale-toast", { detail: error instanceof Error ? error.message : String(error) }));
      } finally {
        setAdding(false);
      }
    };
    return (
      <button className="icon" type="button" disabled={adding} title={`${text.addScreenshots}\n${text.formats}`} aria-label={text.addScreenshots} onClick={() => void add()}>
        <ImagePlus size={18} />
      </button>
    );
  }
  return (
    <button className="icon" type="button" title={screenshotLabels[language].open} aria-label={screenshotLabels[language].open} onClick={() => void window.flashApi.openScreenshotsWindow(game.id, language).catch(() => {})}>
      <Images size={18} />
    </button>
  );
}

function DetailsPanel({
  game,
  categories,
  onPatch,
  onDelete,
  onPlay,
  isRunning,
  onManualCover,
  onChooseMusic,
  onRemoveMusic,
  onMusicChanged,
  musicDescription,
  hasMusic,
  libraryMusicEnabled,
  musicTracks,
  onSelectDefaultMusic,
  onRecaptureCover,
  isCapturingCover,
  language,
  onBack,
}: {
  game: Game | null;
  categories: string[];
  onPatch: (gameId: string, patch: GamePatch) => void;
  onDelete: (game: Game) => void;
  onPlay: (game: Game) => void;
  isRunning: boolean;
  onManualCover: (game: Game) => void;
  onChooseMusic: (game: Game) => void;
  onRemoveMusic: (game: Game) => void;
  onMusicChanged: (gameId: string) => void;
  musicDescription: string;
  hasMusic: boolean;
  libraryMusicEnabled: boolean;
  musicTracks: number[];
  onSelectDefaultMusic: (game: Game, index: number) => void;
  onRecaptureCover: (game: Game) => void;
  isCapturingCover: boolean;
  language: Language;
  onBack: () => void;
}) {
  const text = messages[language];
  const reopenTooltip = isRunning ? compatibilitySettingsLabels[language].reopen : undefined;
  const categoryComboRef = useRef<HTMLDivElement>(null);
  const releaseDateInputRef = useRef<HTMLInputElement>(null);
  const { pickDate, chooseFiles } = useControllerNavigation();
  const publicResourcesListRef = useRef<HTMLUListElement>(null);
  const [publicResourcesHaveScrollbar, setPublicResourcesHaveScrollbar] = useState(false);
  const [copiedPublicResourceUrl, setCopiedPublicResourceUrl] = useState<string | null>(null);
  const copiedPublicResourceTimerRef = useRef<number | null>(null);
  const [draft, setDraft] = useState(() => createDetailsDraft(game));
  const draftRef = useRef(draft);
  const saveTimerRef = useRef<number | null>(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const players = usePlayers();
  const [copyingAssets, setCopyingAssets] = useState(false);
  const [assetsMessage, setAssetsMessage] = useState("");

  useEffect(() => {
    const initialDraft = createDetailsDraft(game);
    draftRef.current = initialDraft;
    setDraft(initialDraft);
    setIsCategoryMenuOpen(false);
    setAssetsMessage("");
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (game) onPatch(game.id, detailsDraftToPatch(draftRef.current));
      }
    };
  }, [game?.id]);

  useEffect(() => {
    setCopiedPublicResourceUrl(null);
    if (copiedPublicResourceTimerRef.current !== null) {
      window.clearTimeout(copiedPublicResourceTimerRef.current);
      copiedPublicResourceTimerRef.current = null;
    }
    return () => {
      if (copiedPublicResourceTimerRef.current !== null) window.clearTimeout(copiedPublicResourceTimerRef.current);
    };
  }, [game?.id]);

  const updateDraft = (patch: Partial<DetailsDraft>) => {
    const nextDraft = { ...draftRef.current, ...patch };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    if (!game) return;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      onPatch(game.id, detailsDraftToPatch(nextDraft));
    }, 350);
  };

  const copyPublicResource = async (url: string) => {
    if (!game) return;
    try {
      await window.flashApi.copyPublicResourceUrl(game.id, url);
      setCopiedPublicResourceUrl(url);
      if (copiedPublicResourceTimerRef.current !== null) window.clearTimeout(copiedPublicResourceTimerRef.current);
      copiedPublicResourceTimerRef.current = window.setTimeout(() => {
        copiedPublicResourceTimerRef.current = null;
        setCopiedPublicResourceUrl(null);
      }, 1600);
    } catch {
      setCopiedPublicResourceUrl(null);
    }
  };

  useEffect(() => {
    const list = publicResourcesListRef.current;
    if (!list) {
      setPublicResourcesHaveScrollbar(false);
      return;
    }
    const updateScrollbarState = () => {
      setPublicResourcesHaveScrollbar(list.scrollHeight > list.clientHeight + 1);
    };
    updateScrollbarState();
    const resizeObserver = new ResizeObserver(updateScrollbarState);
    resizeObserver.observe(list);
    for (const row of list.children) resizeObserver.observe(row);
    const mutationObserver = new MutationObserver(updateScrollbarState);
    mutationObserver.observe(list, { childList: true, subtree: true, characterData: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [game?.id, game?.publicResourceUrls?.length]);

  useEffect(() => {
    const closeCategoryMenu = (event: MouseEvent) => {
      if (!categoryComboRef.current?.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeCategoryMenu);
    return () => document.removeEventListener("mousedown", closeCategoryMenu);
  }, []);

  useEffect(() => {
    if (!game || document.activeElement?.closest(".details input, .details textarea")) return;
    const latestDraft = createDetailsDraft(game);
    draftRef.current = latestDraft;
    setDraft(latestDraft);
  }, [game]);

  if (!game) {
    return (
      <aside className="details empty">
        <Gamepad2 size={34} />
        <strong>{text.emptySelected}</strong>
        <span>{text.emptySelectedHint}</span>
      </aside>
    );
  }

  const categoryMenuOpen = isCategoryMenuOpen && categories.length > 0;
  const capabilities = gameCapabilities(game, players);
  const allGamesFullscreen = useAllGamesFullscreen();
  const showFpsGlobal = useShowFpsCounter();
  const canOpenCrtSettings = !game.onlineOnly && capabilities.has("remap");
  const gameSettingsCollapsibleMenus = (
    <div className="game-settings-collapsible-menus">
      <GameCompatibility key={`compatibility-${game.id}`} game={game} language={language} onPatch={onPatch} />
      <ShowcaseScreenshots key={`showcase-${game.id}`} gameId={game.id} language={language} enabled={!game.onlineOnly} editable chooseFiles={chooseFiles} />
      <GameGuidesEditor key={`guides-${game.id}`} gameId={game.id} guides={game.guides} language={language} />
    </div>
  );

  return (
    <aside className="details" data-controller-region="" data-controller-navigation="rows">
      <header className="game-panel-heading">
        <button className="icon" type="button" data-game-panel-back="" title={gamePanelLabels[language].back} aria-label={gamePanelLabels[language].back} onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h2>{gamePanelLabels[language].settings}</h2>
      </header>
      <CoverImage className="detail-cover" game={game} language={language} />
      <div className="detail-actions">
        <PlayToggleButton isRunning={isRunning} onClick={() => onPlay(game)} language={language} />
        <div className="detail-icon-actions">
          <button className="icon" title={text.selectedFavorite} onClick={() => onPatch(game.id, { favorite: !game.favorite })}>
            <Heart size={18} fill={game.favorite ? "currentColor" : "none"} />
          </button>
          <ScreenshotsButton game={game} language={language} />
          <button className="icon danger" title={text.delete} onClick={() => onDelete(game)}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {game.onlineOnly
        ? <div className="game-settings-section-title" role="presentation" />
        : <h3 className="game-settings-section-title" id="game-player-title">{playerLabels[language].gamePlayer}</h3>}
      <GamePlayerSelect game={game} language={language} onPatch={onPatch} labelledBy="game-player-title" />

      {!game.onlineOnly && capabilities.has("remap") && (
        <button
          className="secondary remap-open-button"
          type="button"
          onClick={() => void window.flashApi.openRemapWindow(game.id, language).catch(() => {})}
        >
          <Gamepad2 size={16} aria-hidden="true" />
          {remapLabels[language].open}
        </button>
      )}

      {canOpenCrtSettings ? <CrtSettings key={`crt-${game.id}`} game={game} language={language} onPatch={onPatch}>
        {(button, toggle) => <OnscreenSettings key={`onscreen-${game.id}`} gameId={game.id} language={language}
          afterEditor={<>{button}{gameSettingsCollapsibleMenus}</>} afterGameSetting={toggle} />}
      </CrtSettings> : gameSettingsCollapsibleMenus}

      <div className="game-playback-settings">
        {capabilities.has("fullscreen") && <>
        <label className="fullscreen-setting">
          <input
            type="checkbox"
            checked={allGamesFullscreen || draft.fullscreenByDefault}
            disabled={allGamesFullscreen}
            aria-describedby="fullscreen-hint"
            onChange={(event) => updateDraft({ fullscreenByDefault: event.target.checked })}
          />
          <span>{gameSettingsLabels[language].fullscreenByDefault}</span>
        </label>
        <small className="scaling-performance-hint" id="fullscreen-hint">{allGamesFullscreen ? fullscreenOverrideLabels[language].globalEnabledDescription : gameOptionHints[language].fullscreen}</small>
        </>}
        <label className="fullscreen-setting">
          <input
            type="checkbox"
            checked={showFpsGlobal || draft.showFps}
            disabled={showFpsGlobal}
            aria-describedby="show-fps-hint"
            onChange={(event) => updateDraft({ showFps: event.target.checked })}
          />
          <span>{fpsCounterLabels[language].perGame}</span>
        </label>
        <small className="scaling-performance-hint" id="show-fps-hint">{showFpsGlobal ? fpsCounterLabels[language].globalEnabledDescription : fpsCounterLabels[language].perGameHint}</small>
        {!game.onlineOnly && <>
          {capabilities.has("fixScaling") && <>
          <label className="fullscreen-setting" title={reopenTooltip}>
            <input type="checkbox" checked={draft.fixScaling} aria-describedby="scaling-performance-hint" onChange={(event) => updateDraft({ fixScaling: event.target.checked })} />
            <span>{compatibilitySettingsLabels[language].fixScaling}</span>
          </label>
          <small className="scaling-performance-hint" id="scaling-performance-hint">{scalingPerformanceHints[language]}</small>
          </>}
          {capabilities.has("standalone") && <>
          <label className="fullscreen-setting" title={reopenTooltip}>
            <input type="checkbox" checked={draft.standaloneCompatibility} aria-describedby="standalone-hint" onChange={(event) => updateDraft({ standaloneCompatibility: event.target.checked })} />
            <span>{compatibilitySettingsLabels[language].standalone}</span>
          </label>
          <small className="scaling-performance-hint" id="standalone-hint">{gameOptionHints[language].standalone}</small>
          </>}
          {capabilities.has("online") && <>
          <label className="fullscreen-setting" title={reopenTooltip}>
            <input type="checkbox" checked={draft.allowOnlineFeatures} aria-describedby="online-hint" onChange={(event) => updateDraft({ allowOnlineFeatures: event.target.checked })} />
            <span>{compatibilitySettingsLabels[language].online}</span>
          </label>
          <small className="scaling-performance-hint" id="online-hint">{gameOptionHints[language].online}</small>
          </>}
          {capabilities.has("pinCursor") && <>
          <label className="fullscreen-setting">
            <input
              type="checkbox"
              checked={Boolean(game.pinCursor)}
              aria-describedby="pin-cursor-hint"
              onChange={(event) => void window.flashApi.setGamePinCursor(game.id, event.target.checked).catch(() => {})}
            />
            <span>{remapLabels[language].pinCursor}</span>
          </label>
          <small className="scaling-performance-hint" id="pin-cursor-hint">{gameOptionHints[language].pinCursor}</small>
          </>}
        </>}
      </div>
      {game.format === "dcr" && <div className="shockwave-settings">
        <strong>{shockwaveLabels[language].experimental}</strong>
        <small>{shockwaveLabels[language].assetsHint}</small>
        <button className="secondary" type="button" disabled={isRunning || copyingAssets} onClick={async () => {
          setCopyingAssets(true);
          setAssetsMessage("");
          try {
            const folder = await chooseFiles("folder");
            if (!folder?.length) return;
            const result = await window.flashApi.chooseShockwaveAssets(game.id, language, folder[0]);
            if (result.copied) {
              setAssetsMessage(shockwaveLabels[language].assetsSaved);
              onMusicChanged(game.id);
            }
          } catch (error) {
            setAssetsMessage(error instanceof Error ? error.message : text.saveFailed);
          } finally {
            setCopyingAssets(false);
          }
        }}>
          <FolderOpen size={16} aria-hidden="true" />
          {shockwaveLabels[language].chooseAssets}
        </button>
        {assetsMessage && <small role="status">{assetsMessage}</small>}
      </div>}
      {!game.onlineOnly && capabilities.has("resources") && <div className="public-resources">
        <strong>{compatibilitySettingsLabels[language].resources}</strong>
        {game.publicResourceUrls?.length ? (
          <ul ref={publicResourcesListRef} className={publicResourcesHaveScrollbar ? "has-scrollbar-gap" : undefined}>
            {game.publicResourceUrls.map((url) => {
              const blocked = game.blockedPublicResourceUrls?.includes(url) || false;
              return (
                <li className={blocked ? "blocked" : ""} key={url}>
                  <button
                    className={`public-resource-copy${copiedPublicResourceUrl === url ? " copied" : ""}`}
                    type="button"
                    title={`${copiedPublicResourceUrl === url ? compatibilitySettingsLabels[language].resourceCopied : compatibilitySettingsLabels[language].copyResource}: ${url}`}
                    aria-label={`${copiedPublicResourceUrl === url ? compatibilitySettingsLabels[language].resourceCopied : compatibilitySettingsLabels[language].copyResource}: ${url}`}
                    onClick={() => void copyPublicResource(url)}
                  >
                    <span>{url}</span>
                    {copiedPublicResourceUrl === url ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  </button>
                  <button
                    className="icon"
                    type="button"
                    title={blocked ? compatibilitySettingsLabels[language].unblockResource : compatibilitySettingsLabels[language].blockResource}
                    aria-label={`${blocked ? compatibilitySettingsLabels[language].unblockResource : compatibilitySettingsLabels[language].blockResource}: ${url}`}
                    onClick={() => {
                      const current = new Set(game.blockedPublicResourceUrls || []);
                      if (blocked) current.delete(url);
                      else current.add(url);
                      onPatch(game.id, { blockedPublicResourceUrls: Array.from(current) });
                    }}
                  >
                    {blocked ? <Check size={16} /> : <Ban size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <span className="public-resources-empty">{compatibilitySettingsLabels[language].noResources}</span>
        )}
      </div>}
      <h3 className="game-settings-section-title">{sourceMetadataLabels[language].gameDetails}</h3>
      {!game.onlineOnly && (
        <button className="secondary remap-open-button" type="button" onClick={() => void openMetadataSearch(game.id, game.title)}>
          <Search size={16} aria-hidden="true" />
          {metadataSourceLabels[language].findMetadata}
        </button>
      )}
      <fieldset className="user-rating-field">
        <legend>{userRatingLabels[language].title}{game.userRating !== undefined && `: ${game.userRating.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`}</legend>
        <div className="user-rating-options">
          {[1, 2, 3, 4, 5].map((value) => {
            const fill = Math.max(0, Math.min(1, (game.userRating ?? 0) - value + 1));
            return (
              <span className="user-rating-star" key={value}>
                <span className="user-rating-star-glyph" aria-hidden="true">
                  <Star size={18} />
                  <span className="user-rating-star-fill" style={{ width: `${fill * 100}%` }}>
                    <Star size={18} fill="currentColor" />
                  </span>
                </span>
                {[value - 0.5, value].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className="user-rating-hitbox"
                    onClick={() => onPatch(game.id, { userRating: rating })}
                    aria-label={`${userRatingLabels[language].title}: ${rating.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`}
                    aria-pressed={game.userRating === rating}
                    title={`${userRatingLabels[language].title}: ${rating.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`}
                  />
                ))}
              </span>
            );
          })}
          <button
            type="button"
            className="icon user-rating-clear"
            onClick={(event) => {
              const options = event.currentTarget.closest(".user-rating-options");
              const restoreFocus = document.documentElement.classList.contains("controller-navigation-active") ||
                document.documentElement.classList.contains("keyboard-focus");
              onPatch(game.id, { userRating: null });
              // Clearing disables this button, so controller/keyboard focus moves to the first half star.
              if (restoreFocus) {
                const first = options?.querySelector<HTMLElement>(".user-rating-hitbox");
                if (first) focusControl(first);
              }
            }}
            disabled={game.userRating === undefined}
            aria-label={userRatingLabels[language].clear}
            title={userRatingLabels[language].clear}
          >
            <X size={16} />
          </button>
        </div>
      </fieldset>
      <label>
        {text.title}
        <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
      </label>
      <label>
        {text.category}
        <div className={categoryMenuOpen ? "category-combo open" : "category-combo"} ref={categoryComboRef}>
          <input
            value={displayCategory(draft.category, language)}
            onChange={(event) => updateDraft({ category: event.target.value })}
            placeholder={text.uncategorized}
          />
          <button
            type="button"
            className="category-trigger"
            aria-label={text.chooseRecentCategory}
            aria-expanded={categoryMenuOpen}
            disabled={categories.length === 0}
            onClick={() => setIsCategoryMenuOpen((open) => !open)}
          >
            <ChevronDown size={19} strokeWidth={3.2} />
          </button>
          {categoryMenuOpen && (
            <div className="category-menu" role="listbox">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === draft.category ? "category-option active" : "category-option"}
                  role="option"
                  aria-selected={item === draft.category}
                  title={item}
                  onClick={() => {
                    updateDraft({ category: item });
                    setIsCategoryMenuOpen(false);
                  }}
                >
                  <span>{item}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </label>
      <label>
        {text.releaseDate}
        <div className={draft.releaseDate ? "date-combo has-date" : "date-combo"}>
          <input
            ref={releaseDateInputRef}
            type="date"
            value={draft.releaseDate}
            onChange={(event) => updateDraft({ releaseDate: event.target.value })}
          />
          {!draft.releaseDate && <span className="date-placeholder" aria-hidden="true">{datePlaceholderLabels[language]}</span>}
          <button
            type="button"
            className="category-trigger date-trigger"
            aria-label={text.releaseDate}
            onClick={() => {
              const input = releaseDateInputRef.current;
              if (input) pickDate(input);
            }}
          >
            <CalendarDays size={19} strokeWidth={3.2} />
          </button>
        </div>
      </label>
      <label>
        {text.developer}
        <input value={draft.developer} onChange={(event) => updateDraft({ developer: event.target.value })} />
      </label>
      <label>
        {text.publisher}
        <input value={draft.publisher} onChange={(event) => updateDraft({ publisher: event.target.value })} />
      </label>
      <label>
        {sourceMetadataLabels[language].version}
        <input value={draft.version} onChange={(event) => updateDraft({ version: event.target.value })} />
      </label>
      <label>
        {text.tags}
        <input value={draft.tags} onChange={(event) => updateDraft({ tags: event.target.value })} placeholder={text.tagsPlaceholder} />
      </label>
      <label className="description-field">
        {sourceMetadataLabels[language].description}
        <ResizableTextarea value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} />
      </label>
      <label>
        {text.notes}
        <ResizableTextarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} />
      </label>

      {libraryMusicEnabled && musicTracks.length > 1 && (
        <fieldset className="music-tracks">
          <legend>{musicLabels[language].defaultMusic}</legend>
          {musicTracks.map((duration, index) => (
            <label key={index} className="music-track-option">
              <input
                type="radio"
                name={`default-music-${game.id}`}
                checked={index === (game.defaultMusicIndex ?? 0)}
                onChange={() => onSelectDefaultMusic(game, index)}
              />
              <span>
                {musicLabels[language].track.replace("{n}", String(index + 1))} · {formatTrackDuration(duration)}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {libraryMusicEnabled && hasMusic && <div className="game-playback-settings music-playback-settings">
        <label className="fullscreen-setting music-playback-toggle">
          <input type="checkbox" checked={game.musicEnabled !== false} onChange={(event) => onPatch(game.id, { musicEnabled: event.target.checked })} />
          <span>{libraryMusicLabels[language].game}</span>
        </label>
        <small className="scaling-performance-hint">{libraryMusicLabels[language].gameHelp}</small>
        <label className="fullscreen-setting music-playback-toggle">
          <input
            type="checkbox"
            checked={draft.repeatMusic}
            onChange={(event) => updateDraft({ repeatMusic: event.target.checked })}
          />
          <span>{gameSettingsLabels[language].repeatMusic}</span>
        </label>
        <small className="scaling-performance-hint">{gameSettingsLabels[language].repeatMusicHelp}</small>
      </div>}

      {window.flashApi.inputRuntime?.gameShortcuts !== null && <DesktopShortcut key={`shortcut-${game.id}`} gameId={game.id} language={language} />}
      {libraryMusicEnabled && <div className="music-actions">
        <button className="secondary" onClick={() => onChooseMusic(game)}>
          <Music size={16} />
          {musicLabels[language].choose}
        </button>
        {game.customMusic && (
          <button className="secondary remove-music" onClick={() => onRemoveMusic(game)}>
            <Trash2 size={16} />
            {musicLabels[language].remove}
          </button>
        )}
      </div>}

      <div className="music-actions">
        <button className="secondary" title={text.chooseCover} onClick={() => onManualCover(game)}>
          <Upload size={16} />
          {coverCaptureLabels[language].chooseImage}
        </button>
        <button className="secondary recapture-cover" title={game.format === "dcr" ? shockwaveLabels[language].captureUnavailable : undefined} onClick={() => onRecaptureCover(game)} disabled={isCapturingCover || game.format === "dcr"}>
          <Camera size={16} />
          {isCapturingCover ? coverCaptureLabels[language].capturing : coverCaptureLabels[language].recapture}
        </button>
      </div>

      <div className="meta">
        <span className="meta-file-row">
          {text.file}:
          <button className="meta-file-link" type="button" title={sourceMetadataLabels[language].openGameFolder.replace("{title}", game.title)} onClick={() => void outsideControllerApp(() => window.flashApi.openGameFolder(game.id)).catch(console.error)}>
            <span className="meta-file-name">{game.storageFileName || game.originalFileName}</span>
            <ExternalLink size={12} aria-hidden="true" />
          </button>
        </span>
        <span>{text.plays}: {game.playCount ? `${game.playCount} ${text.times}` : text.never}</span>
        <span>{playTimeLabels[language].playTime}: {game.totalPlaySeconds ? formatPlayDuration(game.totalPlaySeconds, language) : text.notPlayed}</span>
        <span>{text.cover}: {coverStatusLabel(game.coverStatus, language)}</span>
        {libraryMusicEnabled && <span title={musicDescription}>{musicLabels[language].music}: {musicDescription}</span>}
        {gameSourceRatings(game).map((rating) => (
          <span key={rating.source}>{sourceRatingLabel(rating, language)}: {rating.sourceRating.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5{rating.sourceRatingCount !== undefined && ` (${rating.sourceRatingCount.toLocaleString(language)} ${sourceMetadataLabels[language].votes})`}</span>
        ))}
        <span>{text.lastPlayed}: {formatDate(game.lastPlayedAt, language)}</span>
        <span>{sortLabels[language].dateAdded}: {formatDate(game.createdAt, language)}</span>
        <span className="meta-flash-royale-id">Flash Royale ID: {game.id}</span>
      </div>
    </aside>
  );
}

function GameInfoPanel({ game, language, isRunning, onPlay, onPatch, setFilter, musicDescription, hasMusic, libraryMusicEnabled, onSettings }: {
  game: Game;
  language: Language;
  isRunning: boolean;
  onPlay: (game: Game) => void;
  onPatch: (gameId: string, patch: GamePatch) => void;
  setFilter: (filter: Filter) => void;
  musicDescription: string;
  hasMusic: boolean;
  libraryMusicEnabled: boolean;
  onSettings: () => void;
}) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [visibleTagCount, setVisibleTagCount] = useState(game.tags.length);
  const tagsRef = useRef<HTMLDivElement>(null);
  const [swfMetadata, setSwfMetadata] = useState<SwfMetadata | null>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const text = messages[language];
  const labels = gamePanelLabels[language];
  const stateLabel = (enabled: boolean) => enabled ? labels.on : labels.off;
  const facts = [
    [text.category, displayCategory(game.category, language) || text.uncategorized],
    ...(game.releaseDate ? [[text.releaseDate, formatReleaseDate(game.releaseDate, language)]] : []),
    ...(game.developer ? [[text.developer, game.developer]] : []),
    ...(game.publisher ? [[text.publisher, game.publisher]] : []),
    ...(game.version ? [[sourceMetadataLabels[language].version, game.version]] : []),
    [text.plays, game.playCount ? `${game.playCount} ${text.times}` : text.never],
    [playTimeLabels[language].playTime, game.totalPlaySeconds ? formatPlayDuration(game.totalPlaySeconds, language) : text.notPlayed],
    [text.lastPlayed, formatDate(game.lastPlayedAt, language)],
    [sortLabels[language].dateAdded, formatDate(game.createdAt, language)],
    [text.cover, coverStatusLabel(game.coverStatus, language)],
    ...(libraryMusicEnabled ? [[musicLabels[language].music, musicDescription]] : []),
  ];
  const swfMetadataChips: { value: string; title: string }[] = [];
  if (swfMetadata?.swfVersion !== null && swfMetadata?.swfVersion !== undefined) {
    const value = `SWF ${swfMetadata.swfVersion}`;
    swfMetadataChips.push({ value, title: `${sourceMetadataLabels[language].swfVersion}: ${swfMetadata.swfVersion}` });
  }
  if (swfMetadata?.stageWidth && swfMetadata.stageHeight) {
    const value = `${swfMetadata.stageWidth} × ${swfMetadata.stageHeight} px`;
    swfMetadataChips.push({ value, title: `${sourceMetadataLabels[language].dimensions}: ${value}` });
  }
  if (swfMetadata?.frameRate !== null && swfMetadata?.frameRate !== undefined) {
    const value = `${swfMetadata.frameRate.toLocaleString(language, { maximumFractionDigits: 2 })} FPS`;
    swfMetadataChips.push({ value, title: `${sourceMetadataLabels[language].frameRate}: ${value}` });
  }
  if (swfMetadata?.fileSizeBytes) {
    const value = formatFileSize(swfMetadata.fileSizeBytes, language);
    swfMetadataChips.push({ value, title: `${sourceMetadataLabels[language].fileSize}: ${value}` });
  }
  const players = usePlayers();
  const sourceRatings = gameSourceRatings(game);
  const capabilities = gameCapabilities(game, players);
  const activePlayer = effectiveGamePlayer(game, players).player;
  const settings = [
    ...(activePlayer && !game.onlineOnly ? [[playerLabels[language].gamePlayer, activePlayer.name]] : []),
    ...(capabilities.has("fullscreen") ? [[gameSettingsLabels[language].fullscreenByDefault, stateLabel(Boolean(game.fullscreenByDefault))]] : []),
    ...(!game.onlineOnly ? [
      ...(capabilities.has("fixScaling") ? [[compatibilitySettingsLabels[language].fixScaling, stateLabel(Boolean(game.fixScaling))]] : []),
      ...(capabilities.has("standalone") ? [[compatibilitySettingsLabels[language].standalone, stateLabel(Boolean(game.standaloneCompatibility))]] : []),
      ...(capabilities.has("online") ? [[compatibilitySettingsLabels[language].online, stateLabel(game.allowOnlineFeatures !== false)]] : []),
      ...(capabilities.has("pinCursor") ? [[remapLabels[language].pinCursor, stateLabel(Boolean(game.pinCursor))]] : []),
    ] : []),
    ...(libraryMusicEnabled && hasMusic ? [
      [libraryMusicLabels[language].game, stateLabel(game.musicEnabled !== false)],
      [gameSettingsLabels[language].repeatMusic, stateLabel(game.repeatMusic !== false)],
    ] : []),
  ];

  useEffect(() => {
    let active = true;
    setSwfMetadata(null);
    void window.flashApi.getSwfMetadata(game.id)
      .then((metadata) => { if (active) setSwfMetadata(metadata); })
      .catch(() => { if (active) setSwfMetadata(null); });
    return () => { active = false; };
  }, [game.id]);

  useEffect(() => {
    const paragraph = descriptionRef.current;
    if (!paragraph) {
      setDescriptionOverflows(false);
      return;
    }
    if (descriptionExpanded) return;

    const updateOverflow = () => setDescriptionOverflows(paragraph.scrollHeight > paragraph.clientHeight + 1);
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [game.description, descriptionExpanded]);

  useLayoutEffect(() => {
    const container = tagsRef.current;
    if (!container) return;
    const measure = () => {
      const tags = [...container.querySelectorAll<HTMLButtonElement>(".game-info-tag-filter")];
      tags.forEach(tag => { tag.hidden = false; });
      const rowPosition = (element: HTMLElement) => Math.round(element.offsetTop + element.offsetHeight / 2);
      const rows = [...new Set([...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement).map(rowPosition))].sort((a, b) => a - b);
      const cutoff = rows[3] ?? Infinity;
      const count = tags.filter(tag => rowPosition(tag) < cutoff).length;
      tags.forEach((tag, index) => { tag.hidden = !tagsExpanded && index >= count; });
      setVisibleTagCount(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [game.tags, tagsExpanded]);

  return (
    <aside className="details game-info-panel" data-controller-region="" data-controller-navigation="rows" aria-label={labels.info}>
      <header className="game-panel-heading">
        <h2 title={game.title}>{game.title}</h2>
        <button className="icon" type="button" data-game-panel-settings="" title={labels.settings} aria-label={labels.settings} onClick={onSettings}><Settings size={18} /></button>
      </header>
      <CoverImage className="detail-cover" game={game} language={language} />
      <div className="detail-actions">
        <PlayToggleButton isRunning={isRunning} onClick={() => onPlay(game)} language={language} />
        <div className="detail-icon-actions">
          <button className="icon" type="button" title={text.selectedFavorite} aria-label={text.selectedFavorite} aria-pressed={game.favorite} onClick={() => onPatch(game.id, { favorite: !game.favorite })}>
            <Heart size={18} fill={game.favorite ? "currentColor" : "none"} />
          </button>
          <ScreenshotsButton game={game} language={language} />
          <button className="icon" type="button" title={sourceMetadataLabels[language].openGameFolder.replace("{title}", game.title)} aria-label={sourceMetadataLabels[language].openGameFolder.replace("{title}", game.title)} onClick={() => void outsideControllerApp(() => window.flashApi.openGameFolder(game.id)).catch(console.error)}><FolderOpen size={18} /></button>
        </div>
      </div>
      {(game.userRating !== undefined || sourceRatings.length > 0 || game.tags.length > 0 || game.description || !game.onlineOnly) && (
        <section className="game-info-section game-info-rating-description">
          {(game.userRating !== undefined || sourceRatings.length > 0) && <div className="game-info-ratings" data-source-rating-count={sourceRatings.length >= 3 ? "3+" : sourceRatings.length}>
            {game.userRating !== undefined && <div className="game-info-user-rating"><h3>{userRatingLabels[language].title}</h3><StarRating rating={game.userRating} label={userRatingLabels[language].title} language={language} /></div>}
            {sourceRatings.map((rating, index) => <div key={rating.source} data-source-rating-index={index}>
              <h3>{sourceRatingLabel(rating, language)}</h3>
              <StarRating rating={rating.sourceRating} label={sourceRatingLabel(rating, language)} language={language} />
              {rating.sourceRatingCount !== undefined && <span>{rating.sourceRatingCount.toLocaleString(language)} {sourceMetadataLabels[language].votes}</span>}
            </div>)}
          </div>}
          {(game.tags.length > 0 || !game.onlineOnly) && <div ref={tagsRef} className="mini-tags game-info-panel-tags">
            <CompatibilityPill game={game} language={language} />
            {game.tags.map((tag, index) => <button className="game-info-tag-filter" hidden={!tagsExpanded && index >= visibleTagCount} key={tag} type="button" title={tag} onClick={() => setFilter({ type: "tag", value: tag })}>{tag}</button>)}
          </div>}
          {game.tags.length > visibleTagCount && <button className="game-info-disclosure" type="button" aria-expanded={tagsExpanded} onClick={() => setTagsExpanded(!tagsExpanded)}>
            {tagsExpanded ? sourceMetadataLabels[language].showLess : sourceMetadataLabels[language].showMore}
            <ChevronDown className={tagsExpanded ? "is-expanded" : undefined} size={14} aria-hidden="true" />
          </button>}
          {game.description && <div className="game-info-description">
            <h3>{sourceMetadataLabels[language].description}</h3>
            <p ref={descriptionRef} className={descriptionExpanded ? "game-info-description-text" : "game-info-description-text is-collapsed"}>{game.description}</p>
            {(descriptionOverflows || descriptionExpanded) && <button className="game-info-disclosure" type="button" onClick={() => setDescriptionExpanded(!descriptionExpanded)}>
              {descriptionExpanded ? sourceMetadataLabels[language].showLess : sourceMetadataLabels[language].showMore}
              <ChevronDown className={descriptionExpanded ? "is-expanded" : undefined} size={14} aria-hidden="true" />
            </button>}
          </div>}
          <ShowcaseScreenshots key={`showcase-${game.id}`} gameId={game.id} language={language} enabled={!game.onlineOnly} />
        </section>
      )}
      <GameGuidesInfo gameId={game.id} guides={game.guides} language={language} />
      <section className="game-info-section">
        <h3>{sourceMetadataLabels[language].gameDetails}</h3>
        <dl className="game-info-facts">
        {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === text.category
          ? <button className="game-info-filter-link" type="button" onClick={() => setFilter({ type: "category", value: game.category })}>{value}</button>
          : value}</dd></div>)}
        {!game.onlineOnly && <div><dt>{text.file}</dt><dd>
          <button className="game-info-file" type="button" title={sourceMetadataLabels[language].openGameFolder.replace("{title}", game.title)} onClick={() => void outsideControllerApp(() => window.flashApi.openGameFolder(game.id)).catch(console.error)}>
            <span>{game.storageFileName || game.originalFileName}</span><ExternalLink size={12} aria-hidden="true" />
          </button>
        </dd></div>}
        </dl>
        {swfMetadataChips.length > 0 && <div className="game-info-metadata">{swfMetadataChips.map(({ value, title }) => <span key={value} title={title}>{value}</span>)}</div>}
      </section>
      {game.notes && <section className="game-info-section"><h3>{text.notes}</h3><p>{game.notes}</p></section>}
      <section className="game-info-section"><h3>{labels.settings}</h3><dl className="game-info-facts">{settings.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      {!game.onlineOnly && Boolean(game.publicResourceUrls?.length) && <section className="game-info-section"><h3>{compatibilitySettingsLabels[language].resources}</h3><ul className="game-info-resources">{game.publicResourceUrls?.map(url => <li key={url}><span title={url}>{url}</span><span>{stateLabel(!game.blockedPublicResourceUrls?.includes(url))}</span></li>)}</ul></section>}
    </aside>
  );
}

function GameDetailsSidebar(props: Omit<Parameters<typeof DetailsPanel>[0], "onBack"> & { setFilter: (filter: Filter) => void; onClosePanel: (gameId: string) => void }) {
  const [showSettings, setShowSettings] = useState(false);
  const sidebar = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef({ info: 0, settings: 0 });
  const focusPositions = useRef<{ info?: { index: number; offset: number }; settings?: { index: number; offset: number } }>({});
  useLayoutEffect(() => {
    const panel = sidebar.current?.querySelector("aside.details");
    if (panel) panel.scrollTop = scrollPositions.current[showSettings ? "settings" : "info"];
    const memory = focusPositions.current[showSettings ? "settings" : "info"];
    if (sidebar.current) {
      if (memory) {
        sidebar.current.dataset.focusIndex = String(memory.index);
        sidebar.current.dataset.focusOffset = String(memory.offset);
      } else {
        delete sidebar.current.dataset.focusIndex;
        delete sidebar.current.dataset.focusOffset;
      }
    }
  }, [props.game?.id, showSettings]);
  const pendingFocus = useRef<string | null>(null);
  // Only switching between info and settings hands focus over; opening the sidebar never steals focus.
  useLayoutEffect(() => {
    const selector = pendingFocus.current;
    pendingFocus.current = null;
    if (!selector || !document.documentElement.classList.contains("controller-navigation-active")) return;
    const target = document.querySelector<HTMLElement>(selector);
    if (target) focusControl(target);
  }, [showSettings]);
  const switchPanel = (settings: boolean) => {
    pendingFocus.current = settings ? "[data-game-panel-back]" : "[data-game-panel-settings]";
    setShowSettings(settings);
  };
  const controllerBack = useRef(() => {});
  controllerBack.current = () => {
    if (!props.game) return;
    if (showSettings) switchPanel(false);
    else props.onClosePanel(props.game.id);
  };
  useEffect(() => {
    // Controller B inside the sidebar: settings → game info → close the panel.
    const back = (event: Event) => {
      if (!(event.target instanceof HTMLElement) || !event.target.closest("aside.details")) return;
      event.preventDefault();
      controllerBack.current();
    };
    window.addEventListener("controller-panel-back", back);
    return () => window.removeEventListener("controller-panel-back", back);
  }, []);
  return <div ref={sidebar} className="game-details-sidebar" style={{ display: "contents" }} onFocusCapture={event => {
    if (!document.documentElement.classList.contains("controller-navigation-active")) return;
    const panel = event.target.closest<HTMLElement>("aside.details");
    if (!panel) return;
    const index = navigationControls(panel).indexOf(event.target);
    if (index < 0) return;
    const offset = event.target.getBoundingClientRect().top - panel.getBoundingClientRect().top;
    focusPositions.current[showSettings ? "settings" : "info"] = { index, offset };
    event.currentTarget.dataset.focusIndex = String(index);
    event.currentTarget.dataset.focusOffset = String(offset);
  }} onScrollCapture={event => {
    if (event.target instanceof HTMLElement && event.target.matches("aside.details") && props.game) {
      scrollPositions.current[showSettings ? "settings" : "info"] = event.target.scrollTop;
    }
  }}>
    {!props.game || showSettings ? <DetailsPanel key={props.game?.id || "empty"} {...props} onBack={() => switchPanel(false)} />
      : <GameInfoPanel key={props.game.id} game={props.game} language={props.language} isRunning={props.isRunning} onPlay={props.onPlay} onPatch={props.onPatch}
        setFilter={props.setFilter} musicDescription={props.musicDescription} hasMusic={props.hasMusic} libraryMusicEnabled={props.libraryMusicEnabled} onSettings={() => switchPanel(true)} />}
  </div>;
}

export function PlayerModal({
  game,
  onClose,
  language,
  standalone = false,
}: {
  game: PlayerWindowData | null;
  onClose: () => void;
  language: Language;
  standalone?: boolean;
}) {
  const modalRef = useRef<HTMLElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const remapCursorRef = useRef<HTMLDivElement>(null);
  const isChromePinnedRef = useRef(false);
  const isPointerInChromeZoneRef = useRef(false);
  const playerMenuDismissPointer = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    baseLeft: number;
    baseTop: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    direction: PlayerResizeDirection;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const text = messages[language];
  const controls = playerControlLabels[language];
  const timeText = playTimeLabels[language];
  const [status, setStatus] = useState<string>(text.readyToLoad);
  const [paused, setPaused] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [presentationReady, setPresentationReady] = useState(false);
  const [launchRevealed, setLaunchRevealed] = useState(false);
  const [launchFramesSeen, setLaunchFramesSeen] = useState(false);
  const [launchBezelLoaded, setLaunchBezelLoaded] = useState(false);
  const [volume, setVolume] = useState(game?.volume ?? 1);
  const [showPlayerVolume, setShowPlayerVolume] = useState(false);
  const playerVolumeId = useId();
  const volumeRef = useRef(game?.volume ?? 1);
  const volumeRuntimeRef = useRef<((volume: number) => void) | null>(null);
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const playbackRef = useRef<ReturnType<typeof createPlayerPlayback> | null>(null);
  const screenshotViewingRef = useRef(false);
  const playbackError = (error: unknown) => {
    console.error("Game playback:", error);
    setStatus(error instanceof Error ? error.message : text.gameLoadFailed);
  };
  const togglePlayback = () => {
    try {
      const playback = playbackRef.current;
      if (playback?.toggle() === false) {
        setShowOptionsBar(false);
        // React must remove the paused stage's inert flag before restoring game focus.
        requestAnimationFrame(() => {
          if (playbackRef.current === playback) navigation.returnToGame();
        });
      }
    } catch (error) { playbackError(error); }
  };
  const changePlayerVolume = (value: number) => {
    if (!game) return;
    volumeRef.current = value;
    setVolume(value);
    setVolumeError(null);
    try { volumeRuntimeRef.current?.(value); } catch (error) {
      console.error("Set game volume:", error);
      setVolumeError(error instanceof Error ? error.message : text.gameLoadFailed);
    }
    void window.flashApi.setPlayerVolume(game.id, value).catch((error) => {
      console.error("Save game volume:", error);
      setVolumeError(error instanceof Error ? error.message : text.gameLoadFailed);
    });
  };
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(() =>
    game?.sessionStartedAt ? Math.max(0, Math.floor((Date.now() - game.sessionStartedAt) / 1000)) : 0,
  );
  const sessionClockRef = useRef(createSessionClock(game?.sessionStartedAt));
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingPlayerAction, setPendingPlayerAction] = useState<"reset" | "close" | null>(null);
  const resetPending = pendingPlayerAction === "reset";
  const closePending = pendingPlayerAction === "close";
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const confirmPlayerAction = (action: "reset" | "close") => {
    if (pendingPlayerAction !== action) { setPendingPlayerAction(action); return; }
    setPendingPlayerAction(null);
    if (action === "reset") setReloadKey(key => key + 1);
    else onClose();
  };
  const playerActionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
  };
  const [capturing, setCapturing] = useState(false);
  const [coverSource, setCoverSource] = useState<string | null>(null);
  const [screenshotNotice, setScreenshotNotice] = useState<{ message: string; shot?: string; id: number } | null>(null);
  const shotText = screenshotLabels[language];
  const [isFullscreen, setIsFullscreen] = useState(standalone && Boolean(game?.fullscreenByDefault));
  const [isChromePinned, setIsChromePinned] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(!(standalone && game?.fullscreenByDefault));
  const [showOptionsBar, setShowOptionsBar] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [playerSize, setPlayerSize] = useState<{ width: number; height: number } | null>(null);
  const [runtimeStageSize, setRuntimeStageSize] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = runtimeStageSize?.width ?? (game && Number(game.stageWidth) > 0 ? Number(game.stageWidth) : 4);
  const stageHeight = runtimeStageSize?.height ?? (game && Number(game.stageHeight) > 0 ? Number(game.stageHeight) : 3);
  const remapText = remapLabels[language];
  const [pinCursor, setPinCursor] = useState(Boolean(game?.pinCursor));
  const navigation = useControllerNavigation();
  useEffect(() => { setPendingPlayerAction(null); }, [game?.id, navigation.playerMenu, isChromeVisible]);
  useEffect(() => {
    if (!pendingPlayerAction) return;
    const button = pendingPlayerAction === "reset" ? resetButtonRef : closeButtonRef;
    const cancel = () => setPendingPlayerAction(null);
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !button.current?.contains(event.target)) cancel();
    };
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", cancel);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", cancel);
    };
  }, [pendingPlayerAction]);
  const globalCrt = useGlobalCrt();
  const [savedCrtConfig, setSavedCrtConfig] = useState(game?.crt);
  const [crtDisabled, setCrtDisabled] = useState(game?.crtDisabled);
  const [crtBezelDisabled, setCrtBezelDisabled] = useState(game?.crtBezelDisabled);
  const [sessionCrt, setSessionCrt] = useState<boolean | null>(null);
  const [sessionBezel, setSessionBezel] = useState<boolean | null>(null);
  const showFpsGlobal = useShowFpsCounter();
  const fpsStyle = useFpsCounterStyle();
  const [sessionFps, setSessionFps] = useState<boolean | null>(null);
  const showFps = sessionFps ?? (showFpsGlobal || game?.showFps === true);
  const crtConfig = useMemo(() => {
    return effectiveCrt(globalCrt.config, savedCrtConfig, crtDisabled, crtBezelDisabled, { shader: sessionCrt, bezel: sessionBezel });
  }, [globalCrt.config, savedCrtConfig, crtDisabled, crtBezelDisabled, sessionCrt, sessionBezel]);
  // The monitor stays upright and takes the shape of the game as displayed, so quarter turns give a portrait monitor.
  const crtFrameRatio = crtFrameAspect(crtConfig, rotation % 180 ? stageHeight / stageWidth : stageWidth / stageHeight);
  const bezelConfig = crtBezelConfig(crtConfig, crtFrameRatio);
  const [crtError, setCrtError] = useState("");
  const [crtBezelError, setCrtBezelError] = useState("");
  const [shockwaveWarning, setShockwaveWarning] = useState("");
  const [crtBezelVersion, setCrtBezelVersion] = useState(0);
  const crtRef = useRef(crtConfig);
  const crtCaptureReady = useRef(false);
  const [crtRendererVersion, setCrtRendererVersion] = useState(0);
  const [crtFrameWarning, setCrtFrameWarning] = useState("");
  const crtFrameFeed = useCrtFrameFeed();
  crtRef.current = crtConfig;
  useEffect(() => { setSavedCrtConfig(game?.crt); setCrtDisabled(game?.crtDisabled); setCrtBezelDisabled(game?.crtBezelDisabled); }, [game?.id, game?.crt, game?.crtDisabled, game?.crtBezelDisabled]);
  useEffect(() => { setSessionCrt(null); setSessionBezel(null); setSessionFps(null); }, [game?.id]);
  useEffect(() => { setCrtBezelError(""); }, [game?.id, crtConfig.bezel, crtBezelVersion]);
  useEffect(() => {
    if (!game || !window.flashApi.onGameCrtChanged) return;
    return window.flashApi.onGameCrtChanged((id, config, bezelChanged, disabled, bezelDisabled) => {
      if (id !== game.id) return;
      if (bezelChanged) setCrtBezelVersion(version => version + 1);
      else { setSavedCrtConfig(config); setCrtDisabled(disabled); setCrtBezelDisabled(bezelDisabled); }
    });
  }, [game?.id]);
  useEffect(() => {
    const stage = containerRef.current;
    if (!game || !stage || !playbackReady) return;
    setCrtError("");
    const revealPlayer = () => {
      const player = stage.querySelector<HTMLElement>(".ruffle-player");
      if (player) player.style.opacity = "";
    };
    const failed = (error: unknown) => { revealPlayer(); setPresentationReady(true); console.error("CRT-Royale:", error); setCrtError(String(error)); };
    if (game.format === "dcr") {
      const frame = stage.querySelector("iframe");
      frame?.contentWindow?.postMessage({ type: "flashroyale-crt", config: crtConfig }, new URL(game.swfUrl).origin);
      return;
    }
    if (!crtConfig.enabled) { revealPlayer(); setPresentationReady(true); return; }
    if (!crtCaptureReady.current) { revealPlayer(); setPresentationReady(true); setCrtError(crtLabels[language].restart); return; }
    const controller = new AbortController();
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const source = findGameCanvas(stage);
    if (!source) { failed(new Error("CRT-Royale: game canvas unavailable.")); return; }
    const base = new URL("/crt-royale/", game.swfUrl);
    const stageW = game.stageWidth, stageH = game.stageHeight;
    const inputSize = stageW && stageH ? {
      get width() { return crtInputSize(crtRef.current, stageW, stageH, source.width, source.height).width; },
      get height() { return crtInputSize(crtRef.current, stageW, stageH, source.width, source.height).height; },
    } : undefined;
    void attachRoyale(source, base, () => crtParameters(crtRef.current, stageWidth / stageHeight), failed, inputSize, () => crtRef.current.smoothing ?? true, controller.signal, () => setPresentationReady(true))
      .then(stop => { if (cancelled) stop(); else dispose = stop; }).catch(error => { if (!cancelled) failed(error); });
    revealPlayer();
    return () => { cancelled = true; controller.abort(); dispose?.(); };
  }, [game?.id, game?.format, playbackReady, crtConfig.enabled, crtRendererVersion, language]);
  useEffect(() => {
    if (game?.format !== "dcr" || !playbackReady) return;
    const frame = containerRef.current?.querySelector("iframe");
    frame?.contentWindow?.postMessage({ type: "flashroyale-crt", config: crtConfig }, new URL(game.swfUrl).origin);
  }, [crtConfig, playbackReady, game?.format, game?.swfUrl]);
  const wantsCrtFrames = crtNeedsFrames(crtConfig);
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  useEffect(() => {
    setCrtFrameWarning("");
    const stage = containerRef.current;
    if (!game || !stage || !playbackReady || !wantsCrtFrames || game.format === "dcr") return;
    if (!crtCaptureReady.current) { setCrtFrameWarning(crtEffectLabels[language].restart); return; }
    let animation = 0;
    let last = 0;
    let pending = false;
    let stopped = false;
    const tick = (time: number) => {
      animation = requestAnimationFrame(tick);
      if (time - last < 33 || pending || document.hidden) return;
      const source = findFrameCanvas(stage);
      if (!source?.width || !source.height) return;
      last = time;
      pending = true;
      const { width, height } = source;
      const rotation = rotationRef.current;
      // An asynchronous snapshot: reading the live game canvas directly would stall on its queued GPU work.
      createImageBitmap(source, { resizeWidth: 320, resizeHeight: Math.max(1, Math.round((320 * height) / width)), resizeQuality: "high" })
        .then((bitmap) => {
          pending = false;
          if (!stopped) crtFrameFeed.push(bitmap, width, height, rotation);
          bitmap.close();
        })
        .catch(() => { pending = false; });
    };
    animation = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(animation); };
  }, [game?.id, game?.format, playbackReady, wantsCrtFrames, crtRendererVersion, language, crtFrameFeed]);

  useEffect(() => {
    if (launchFramesSeen) return;
    let seen = false;
    const unsubscribe = crtFrameFeed.subscribe(() => {
      if (seen) return;
      seen = true;
      setLaunchFramesSeen(true);
    });
    return unsubscribe;
  }, [crtFrameFeed, launchFramesSeen]);
  const launchWaiting = (wantsCrtFrames && !launchFramesSeen && !crtFrameWarning)
    || (crtConfig.bezel === "custom" && !launchBezelLoaded && !crtBezelError);
  useEffect(() => {
    if (!presentationReady || launchRevealed) return;
    if (!launchWaiting) { setLaunchRevealed(true); return; }
    // Lighting or a custom bezel that never arrives must not leave the game hidden.
    const timeout = window.setTimeout(() => setLaunchRevealed(true), 1500);
    return () => window.clearTimeout(timeout);
  }, [presentationReady, launchRevealed, launchWaiting]);
  const revealed = presentationReady && launchRevealed;

  useEffect(() => {
    volumeRef.current = game?.volume ?? 1;
    setVolume(volumeRef.current);
    setVolumeError(null);
  }, [game?.id, game?.volume]);

  useEffect(() => { setShowPlayerVolume(false); }, [game?.id]);

  const playerMenuWasOpen = useRef(false);
  useLayoutEffect(() => {
    const wasOpen = playerMenuWasOpen.current;
    playerMenuWasOpen.current = navigation.playerMenu;
    if (!navigation.playerMenu) {
      playerMenuDismissPointer.current = null;
      if (wasOpen) {
        isPointerInChromeZoneRef.current = false;
        setShowOptionsBar(false);
        setIsChromeVisible(!isFullscreen || isChromePinnedRef.current);
      }
      return;
    }
    setIsChromeVisible(true);
    const focusArrow = () => {
      const arrow = modalRef.current?.querySelector<HTMLElement>(".menu-toggle");
      if (!arrow || document.documentElement.dataset.controllerPlayerMenu !== "true" ||
          !document.documentElement.classList.contains("controller-hide-pointer")) return;
      document.documentElement.classList.add("controller-navigation-active");
      focusControl(arrow);
    };
    focusArrow();
  }, [navigation.playerMenu, isFullscreen]);

  const remapEngineRef = useControllerRemap(game && !game.onlineOnly ? game.id : undefined, containerRef, remapCursorRef);

  useEffect(() => {
    if (!game) return;
    return window.flashApi.onGamePinCursorChanged((updatedGame) => {
      if (updatedGame.id === game.id) setPinCursor(Boolean(updatedGame.pinCursor));
    });
  }, [game?.id]);

  const togglePinCursor = () => {
    if (!game) return;
    const next = !pinCursor;
    setPinCursor(next);
    window.flashApi.setGamePinCursor(game.id, next).catch(() => setPinCursor(!next));
  };

  useEffect(() => {
    if (standalone) {
      return window.flashApi.onPlayerFullscreenChange((fullscreen) => {
        setIsFullscreen(fullscreen);
      });
    }
    const updateFullscreenState = () => {
      const fullscreen = document.fullscreenElement === modalRef.current;
      setIsFullscreen(fullscreen);
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, [standalone]);

  useEffect(() => {
    isChromePinnedRef.current = isChromePinned;
    if (!isFullscreen) {
      isPointerInChromeZoneRef.current = false;
      setIsChromeVisible(true);
      return;
    }
    setIsChromeVisible(isChromePinned || isPointerInChromeZoneRef.current);
  }, [isChromePinned, isFullscreen]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setShowOptionsBar(false);
    setDragOffset({ x: 0, y: 0 });
    setPlayerSize(null);
  }, [game]);

  useEffect(() => {
    if (!screenshotNotice) return;
    const timeout = window.setTimeout(() => setScreenshotNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [screenshotNotice]);

  useLayoutEffect(() => {
    sessionClockRef.current = createSessionClock(game?.sessionStartedAt);
    if (!game?.sessionStartedAt) {
      setSessionSeconds(0);
      return;
    }
    const updateSessionTime = () => {
      if (document.hidden) return;
      setSessionSeconds(Math.floor(sessionClockRef.current.seconds()));
    };
    setSessionSeconds(Math.floor(sessionClockRef.current.seconds()));
    const intervalId = window.setInterval(updateSessionTime, 1000);
    document.addEventListener("visibilitychange", updateSessionTime);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", updateSessionTime);
    };
  }, [game?.id, game?.sessionStartedAt]);

  useEffect(() => {
    let cancelled = false;
    let player: HTMLElement | null = null;
    let removeShockwaveListener: (() => void) | undefined;
    setPaused(false);
    setPlaybackReady(false);
    // Effects wait for the game and every effect to be ready, so the launch appears fully composed at once.
    setPresentationReady(!crtHidesLaunch(crtRef.current));
    setLaunchRevealed(false);
    setLaunchFramesSeen(false);
    setLaunchBezelLoaded(false);
    crtCaptureReady.current = false;
    setShockwaveWarning("");
    setRuntimeStageSize(null);
    const attachPlayback = (runtime: { pause(): void; resume(): void }) => {
      playbackRef.current = createPlayerPlayback({
        ...runtime,
        focus() {
          if (!player || document.documentElement.dataset.controllerPlayerMenu === "true") return;
          const target = player.shadowRoot?.getElementById("container") ?? player;
          target.focus({ preventScroll: true });
        },
      }, setPaused);
      playbackRef.current.setViewing(screenshotViewingRef.current);
      setPlaybackReady(true);
      setCrtRendererVersion(version => version + 1);
    };

    async function run() {
      if (!game || !containerRef.current) return;
      if (game.format === "dcr") {
        const labels = shockwaveLabels[language];
        setStatus(labels.loading);
        const frame = document.createElement("iframe");
        const host = new URL("/shockwave-player.html", game.swfUrl);
        host.searchParams.set("movie", game.swfUrl);
        host.searchParams.set("engine", game.player === "libreshockwave" ? "libreshockwave" : "dirplayer");
        host.searchParams.set("volume", String(volumeRef.current));
        host.searchParams.set("crt", JSON.stringify(crtRef.current));
        frame.src = host.href;
        frame.title = game.title;
        frame.className = "shockwave-player";
        frame.tabIndex = 0;
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
        const timeout = window.setTimeout(() => {
          if (!cancelled) { setPresentationReady(true); setStatus(text.gameLoadFailed); }
        }, 30000);
        const onMessage = (event: MessageEvent) => {
          if (event.source !== frame.contentWindow || event.origin !== host.origin || !event.data || typeof event.data !== "object") return;
          if (event.data.type === "shockwave-initialized") {
            frame.focus();
          } else if (event.data.type === "shockwave-playback-ready") {
            window.clearTimeout(timeout);
            setStatus(text.running);
            const send = (paused: boolean) => frame.contentWindow?.postMessage({ type: "flashroyale-playback", paused }, host.origin);
            attachPlayback({ pause: () => send(true), resume: () => send(false) });
            volumeRuntimeRef.current = (volume: number) => frame.contentWindow?.postMessage({ type: "flashroyale-volume", volume }, host.origin);
            volumeRuntimeRef.current(volumeRef.current);
          } else if (event.data.type === "shockwave-error") {
            window.clearTimeout(timeout);
            setPlaybackReady(false);
            setPresentationReady(true);
            setStatus(typeof event.data.message === "string" ? event.data.message : text.gameLoadFailed);
          } else if (event.data.type === "shockwave-crt-error") {
            setPresentationReady(true);
            setCrtError(String(event.data.message));
          } else if (event.data.type === "shockwave-crt-ready") {
            setPresentationReady(true);
          } else if (event.data.type === "shockwave-frame") {
            const image = event.data.frame;
            if (image instanceof ImageBitmap) {
              crtFrameFeed.push(image, image.width, image.height, rotationRef.current);
              image.close();
            }
          } else if (event.data.type === "shockwave-warning") {
            setShockwaveWarning(String(event.data.message));
          } else if (event.data.type === "shockwave-stage-size") {
            const { width, height } = event.data;
            if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 8192 && height <= 8192) {
              setRuntimeStageSize({ width, height });
            }
          }
        };
        window.addEventListener("message", onMessage);
        removeShockwaveListener = () => {
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
        };
        player = frame;
        containerRef.current.replaceChildren(frame);
        return;
      }
      setStatus(text.loadingRuffle);
      try {
        await loadRuffleScript(language);
        if (cancelled || !window.RufflePlayer || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        const ruffle = window.RufflePlayer.newest();
        player = ruffle.createPlayer();
        player.className = "ruffle-player";
        if (crtRef.current.enabled) player.style.opacity = "0";
        containerRef.current.appendChild(player);
        setStatus(text.loadingGame);
        let movieSource: { url: string } | { data: ArrayBuffer; swfFileName: string; base: string } = { url: game.flashpointLaunchUrl || game.swfUrl };
        if (!game.flashpointLaunchUrl && game.standaloneCompatibility && window.location.protocol === "file:") {
          const response = await fetch(game.swfUrl);
          if (!response.ok) throw new Error(text.gameLoadFailed);
          movieSource = { data: await response.arrayBuffer(), swfFileName: game.originalFileName || "game.swf", base: new URL("./", game.swfUrl).href };
          if (cancelled) return;
        }
        const publicResourceRules: [RegExp | string, string][] = [];
        if (game.allowOnlineFeatures !== false) {
          for (const [index, url] of (game.publicResourceUrls || []).entries()) {
            const relay = game.publicResourceRelayUrls?.[index];
            if (relay && url !== game.flashpointLaunchUrl) publicResourceRules.push([new RegExp(`^${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), relay]);
          }
        }
        const loadMovie = () => ruffleApi(player!).load({
          ...movieSource,
          ...(game.flashpointLaunchUrl ? { base: new URL("./", game.flashpointLaunchUrl).href, upgradeToHttps: false } : {}),
          volume: volumeRef.current,
          allowScriptAccess: false,
          salign: "",
          forceAlign: true,
          scale: "showAll",
          forceScale: game.fixScaling === true,
          allowNetworking: game.allowOnlineFeatures === false ? "none" : "all",
          urlRewriteRules: publicResourceRules,
          ...(crtNeedsCapture(crtRef.current) ? { preferredRenderer: "wgpu-webgl" as const } : {}),
        });
        if (crtNeedsCapture(crtRef.current)) {
          await preserveFramesDuring(loadMovie);
          crtCaptureReady.current = true;
        } else await loadMovie();
        if (cancelled) return;
        if (player.shadowRoot) {
          const style = document.createElement("style");
          style.textContent = ':host([data-app-paused]) #play-button { display: none !important; }';
          player.shadowRoot.appendChild(style);
        }
        setStatus(text.running);
        attachPlayback({ pause: () => ruffleApi(player!).suspend(), resume: () => ruffleApi(player!).resume() });
        volumeRuntimeRef.current = (volume: number) => { ruffleApi(player!).volume = volume; };
        volumeRuntimeRef.current(volumeRef.current);
      } catch (error) {
        if (player) player.style.opacity = "";
        if (!cancelled) setPresentationReady(true);
        setStatus(error instanceof Error ? error.message : text.gameLoadFailed);
      }
    }

    run();
    return () => {
      cancelled = true;
      playbackRef.current = null;
      volumeRuntimeRef.current = null;
      removeShockwaveListener?.();
      player?.remove();
    };
  }, [game, language, reloadKey, text.gameLoadFailed, text.loadingGame, text.loadingRuffle, text.running]);

  useLayoutEffect(() => {
    document.documentElement.dataset.playerPaused = String(paused);
    sessionClockRef.current.setPaused(paused);
    if (game?.sessionStartedAt) setSessionSeconds(Math.floor(sessionClockRef.current.seconds()));
    if (game) {
      void window.flashApi.setPlayerPaused(game.id, paused).catch((error) => {
        console.error("Update paused play time:", error);
        setStatus(error instanceof Error ? error.message : text.gameLoadFailed);
      });
    }
    const stage = containerRef.current;
    if (stage) {
      stage.inert = paused;
      stage.firstElementChild?.toggleAttribute("data-app-paused", paused);
    }
    return () => { delete document.documentElement.dataset.playerPaused; };
  }, [paused, playbackReady, game?.id, game?.sessionStartedAt, text.gameLoadFailed]);

  useEffect(() => {
    const toggle = () => {
      try { playbackRef.current?.toggle(); } catch (error) {
        console.error("Game playback:", error);
        setStatus(error instanceof Error ? error.message : text.gameLoadFailed);
      }
    };
    const stop = window.flashApi.onScreenshotViewingChanged((viewing) => {
      screenshotViewingRef.current = viewing;
      try { playbackRef.current?.setViewing(viewing); } catch (error) {
        console.error("Screenshot playback:", error);
        setStatus(error instanceof Error ? error.message : text.gameLoadFailed);
      }
    });
    const focus = () => {
      if (screenshotViewingRef.current) return;
      try { playbackRef.current?.setViewing(false); } catch (error) {
        console.error("Restore game playback:", error);
        setStatus(error instanceof Error ? error.message : text.gameLoadFailed);
      }
    };
    window.addEventListener("controller-pause", toggle);
    window.addEventListener("focus", focus);
    return () => {
      stop();
      window.removeEventListener("controller-pause", toggle);
      window.removeEventListener("focus", focus);
    };
  }, [text.gameLoadFailed]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!game || !surface) {
      setFitSize(null);
      return;
    }

    const updateFitSize = () => {
      const style = window.getComputedStyle(surface);
      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = Math.max(1, surface.offsetWidth - horizontalPadding);
      const availableHeight = Math.max(1, surface.offsetHeight - verticalPadding);
      const ratio = crtFrameRatio;

      let width = availableWidth;
      let height = width / ratio;
      if (height > availableHeight) {
        height = availableHeight;
        width = height * ratio;
      }

      setFitSize({
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      });
    };

    updateFitSize();
    const observer = new ResizeObserver(updateFitSize);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [game, crtFrameRatio]);

  const screenshotShortcut = useRef<() => void>(() => {});
  useEffect(() => {
    const onShortcut = () => screenshotShortcut.current();
    window.addEventListener("controller-screenshot", onShortcut);
    return () => window.removeEventListener("controller-screenshot", onShortcut);
  }, []);

  if (!game) return null;

  const turned = rotation % 180 !== 0;
  const openingWidth = bezelConfig.bezel === "none" ? 100 : bezelConfig.width;
  const openingHeight = bezelConfig.bezel === "none" ? 100 : bezelConfig.height;
  const screenRadius = crtRadius(crtConfig, crtFrameRatio);
  const radiusX = 100 * screenRadius / openingWidth;
  const radiusY = 100 * screenRadius * crtFrameRatio / openingHeight;
  const playerStageStyle = {
    aspectRatio: `${stageWidth} / ${stageHeight}`,
    width: fitSize ? `${Math.round((turned ? fitSize.height * openingHeight : fitSize.width * openingWidth) * zoom / 100)}px` : "100%",
    height: fitSize ? `${Math.round((turned ? fitSize.width * openingWidth : fitSize.height * openingHeight) * zoom / 100)}px` : "100%",
    left: bezelConfig.bezel === "none" ? "50%" : `${bezelConfig.left + bezelConfig.width / 2}%`,
    top: bezelConfig.bezel === "none" ? "50%" : `${bezelConfig.top + bezelConfig.height / 2}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    clipPath: crtConfig.enabled || crtConfig.bezel !== "none"
      ? `inset(0 round ${turned ? radiusY : radiusX}% / ${turned ? radiusX : radiusY}%)` : undefined,
    borderRadius: `${turned ? radiusY : radiusX}% / ${turned ? radiusX : radiusY}%`,
  };
  const playerMonitorStyle = {
    width: fitSize ? `${Math.round(fitSize.width * zoom)}px` : "100%",
    height: fitSize ? `${Math.round(fitSize.height * zoom)}px` : "100%",
    transform: "translate(-50%, -50%)",
  };

  const changeZoom = (amount: number) => {
    setZoom((current) => Math.min(2.5, Math.max(0.5, Math.round((current + amount) * 100) / 100)));
  };

  // Only the visible part of the game stage is captured, with the player controls hidden for that frame.
  const captureGameArea = async <T,>(capture: (rect: { x: number; y: number; width: number; height: number }) => Promise<T>) => {
    setCapturing(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const stage = containerRef.current?.getBoundingClientRect();
      const surface = surfaceRef.current?.getBoundingClientRect();
      if (!stage || !surface) throw new Error(shotText.failed);
      const left = Math.ceil(Math.max(stage.left, surface.left, 0));
      const top = Math.ceil(Math.max(stage.top, surface.top, 0));
      const right = Math.floor(Math.min(stage.right, surface.right, window.innerWidth));
      const bottom = Math.floor(Math.min(stage.bottom, surface.bottom, window.innerHeight));
      if (right - left < 2 || bottom - top < 2) throw new Error(shotText.failed);
      return await capture({ x: left, y: top, width: right - left, height: bottom - top });
    } finally {
      setCapturing(false);
    }
  };

  const takeScreenshot = async () => {
    try {
      const shot = await captureGameArea((rect) => window.flashApi.takeScreenshot(game.id, rect));
      setScreenshotNotice({ message: shotText.saved, shot: shot.name, id: Date.now() });
    } catch {
      setScreenshotNotice({ message: shotText.failed, id: Date.now() });
    }
  };

  const openScreenshot = (name: string) => {
    setScreenshotNotice(null);
    void window.flashApi.openScreenshotsWindow(game.id, language, name).catch((error) => {
      console.error("Open screenshot:", error);
      setScreenshotNotice({ message: shotText.failed, id: Date.now() });
    });
  };

  // Controller screenshot chord: opens the screenshot whose notice is still shown, otherwise takes a new one.
  screenshotShortcut.current = () => {
    if (!game || game.onlineOnly || capturing || coverSource) return;
    if (screenshotNotice?.shot) openScreenshot(screenshotNotice.shot);
    else void takeScreenshot();
  };

  const chooseCoverFromGame = async () => {
    try {
      const source = await captureGameArea((rect) => window.flashApi.captureGameImage(game.id, rect));
      setCoverSource(source);
      if (!window.flashApi.openCropWindow) throw new Error(shotText.failed);
      await window.flashApi.openCropWindow({
        gameId: game.id,
        language,
        mode: "cover",
        source,
      });
    } catch {
      setCoverSource(null);
      setScreenshotNotice({ message: shotText.failed, id: Date.now() });
    }
  };
  useEffect(() => window.flashApi.onCropResult?.((result) => {
    if (result.gameId !== game.id || result.mode !== "cover") return;
    setCoverSource(null);
    if (result.status === "applied") {
      setScreenshotNotice({ message: shotText.coverApplied, id: Date.now() });
    }
  }), [game.id, shotText.coverApplied]);

  const toggleFullscreen = async () => {
    try {
      if (standalone) {
        const fullscreen = await window.flashApi.setPlayerFullscreen(!isFullscreen);
        setIsFullscreen(fullscreen);
        setIsChromeVisible(!fullscreen || isChromePinned);
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await modalRef.current?.requestFullscreen();
      }
    } catch {}
  };

  const isInPlayerChromeZone = (event: React.MouseEvent<HTMLElement>) => {
    const top = event.clientY - event.currentTarget.getBoundingClientRect().top;
    return top <= 112 ||
      event.target instanceof Element && Boolean(event.target.closest(".player-chrome"));
  };

  const handlePlayerTouch = (event: ReactPointerEvent<HTMLElement>) => {
    if (!wineTouch.isTouchPointer(event) || !event.isPrimary || event.button !== 0 ||
        !navigation.config.enabled || !touchModeEnabled(navigation.config) || navigation.playerMenu ||
        !(event.target instanceof Element) || event.target.closest(".onscreen-overlay")) return;
    const inChrome = event.target.closest(".player-chrome");
    if (!inChrome && (!isFullscreen || !isInPlayerChromeZone(event))) return;
    if (!inChrome) {
      event.preventDefault();
      event.stopPropagation();
    }
    navigation.openPlayerMenu();
  };

  const handleFullscreenPointerMove = (event: React.MouseEvent<HTMLElement>) => {
    if (!isFullscreen) return;
    isPointerInChromeZoneRef.current = isInPlayerChromeZone(event);
    setIsChromeVisible(isChromePinnedRef.current || isPointerInChromeZoneRef.current);
  };

  const handlePlayerMouseLeave = () => {
    isPointerInChromeZoneRef.current = false;
    if (isFullscreen && !isChromePinnedRef.current) setIsChromeVisible(false);
  };

  const windowDrag = useWindowDrag("button, a, input, select, textarea, [data-controller-hints], .player-controller-hints");
  const startPlayerDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (standalone || isFullscreen || !event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest("button")) {
      return;
    }
    const modal = modalRef.current;
    if (!modal) return;
    const bounds = modal.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: dragOffset.x,
      startOffsetY: dragOffset.y,
      baseLeft: bounds.left - dragOffset.x,
      baseTop: bounds.top - dragOffset.y,
      width: bounds.width,
      height: bounds.height,
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePlayerDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const minX = 16 - drag.baseLeft;
    const minY = 16 - drag.baseTop;
    const maxX = Math.max(minX, window.innerWidth - 160 - drag.baseLeft);
    const maxY = Math.max(minY, window.innerHeight - 56 - drag.baseTop);
    setDragOffset({
      x: Math.min(maxX, Math.max(minX, drag.startOffsetX + event.clientX - drag.startX)),
      y: Math.min(maxY, Math.max(minY, drag.startOffsetY + event.clientY - drag.startY)),
    });
  };

  const stopPlayerDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const startPlayerResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isFullscreen || !event.isPrimary || event.button !== 0) return;
    const modal = modalRef.current;
    const direction = event.currentTarget.dataset.direction as PlayerResizeDirection | undefined;
    if (!modal || !direction) return;
    const bounds = modal.getBoundingClientRect();
    resizeRef.current = {
      pointerId: event.pointerId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: bounds.width,
      startHeight: bounds.height,
      startLeft: bounds.left,
      startTop: bounds.top,
    };
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePlayerResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    const minWidth = Math.min(560, window.innerWidth - 32);
    const minHeight = Math.min(360, window.innerHeight - 32);
    const maxWidth = Math.max(minWidth, window.innerWidth - 32);
    const maxHeight = Math.max(minHeight, window.innerHeight - 32);
    const deltaX = event.clientX - resize.startX;
    const deltaY = event.clientY - resize.startY;
    const fromWest = resize.direction.includes("w");
    const fromEast = resize.direction.includes("e");
    const fromNorth = resize.direction.includes("n");
    const fromSouth = resize.direction.includes("s");

    let width = resize.startWidth;
    let height = resize.startHeight;
    if (fromWest) width -= deltaX;
    if (fromEast) width += deltaX;
    if (fromNorth) height -= deltaY;
    if (fromSouth) height += deltaY;
    width = Math.min(maxWidth, Math.max(minWidth, width));
    height = Math.min(maxHeight, Math.max(minHeight, height));

    let left = fromWest ? resize.startLeft + resize.startWidth - width : resize.startLeft;
    let top = fromNorth ? resize.startTop + resize.startHeight - height : resize.startTop;
    left = Math.min(window.innerWidth - 160, Math.max(16, left));
    top = Math.min(window.innerHeight - 56, Math.max(16, top));

    if (fromWest) width = Math.min(maxWidth, resize.startLeft + resize.startWidth - left);
    if (fromNorth) height = Math.min(maxHeight, resize.startTop + resize.startHeight - top);

    setPlayerSize({ width, height });
    setDragOffset({
      x: left - (window.innerWidth - width) / 2,
      y: top - (window.innerHeight - height) / 2,
    });
  };

  const stopPlayerResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };

  return (
    <div className={standalone ? "player-window-shell" : "modal-backdrop"}>
      <section
        className={`player-modal${standalone ? " standalone-player" : ""}${standalone && isFullscreen ? " fullscreen-player" : ""}${isChromeVisible || navigation.playerMenu ? "" : " chrome-hidden"}${capturing ? " capturing" : ""}`}
        ref={modalRef}
        style={
          !isFullscreen && !standalone
            ? {
                transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
                width: playerSize ? `${playerSize.width}px` : undefined,
                height: playerSize ? `${playerSize.height}px` : undefined,
              }
            : undefined
        }
        onPointerDownCapture={handlePlayerTouch}
        onMouseMove={handleFullscreenPointerMove}
        onMouseLeave={handlePlayerMouseLeave}
      >
        <div className="player-chrome" data-controller-menu={String(navigation.playerMenu)}>
          <header
            {...(standalone ? windowDrag : {
              onPointerDown: startPlayerDrag,
              onPointerMove: movePlayerDrag,
              onPointerUp: stopPlayerDrag,
              onPointerCancel: stopPlayerDrag,
            })}
          >
            <div>
              <strong>{game.title}</strong>
              <span>
                {status === text.running
                  ? `${timeText.activeSession}: ${formatSessionDuration(sessionSeconds, language)}`
                  : status}
              </span>
            </div>
            <ControllerHintsSlot className="player-controller-hints" />
            <div className="modal-actions">
              <button type="button" className="icon" onClick={togglePlayback} disabled={!playbackReady}
                title={paused ? playbackLabels[language].resume : playbackLabels[language].pause}
                aria-label={paused ? playbackLabels[language].resume : playbackLabels[language].pause}
                aria-pressed={paused}>
                {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
              </button>
              <button type="button" ref={resetButtonRef} className={resetPending ? "icon player-reset-button confirming" : "icon player-reset-button"}
                onClick={() => confirmPlayerAction("reset")} onBlur={() => setPendingPlayerAction(null)}
                onKeyDown={playerActionKeyDown}
                title={resetPending ? playerResetConfirmLabels[language] : controls.reloadGame}
                aria-label={resetPending ? playerResetConfirmLabels[language] : controls.reloadGame}>
                {resetPending ? <Check size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
              </button>
              {!game.onlineOnly && <>
                <button className="icon" onClick={() => void takeScreenshot()} disabled={capturing} title={shotText.take} aria-label={shotText.take}>
                  <Camera size={18} />
                </button>
                <button className="icon" onClick={() => void chooseCoverFromGame()} disabled={capturing || Boolean(coverSource)} title={shotText.useAsCover} aria-label={shotText.useAsCover}>
                  <Crop size={18} />
                </button>
              </>}
              <button type="button" className="icon player-keyboard-button"
                title={keyboardUiLabels[language].open} aria-label={keyboardUiLabels[language].open}
                aria-pressed={navigation.keyboardOpen} disabled={!playbackReady}
                onPointerDown={event => event.preventDefault()} onClick={() => navigation.openGameKeyboard(game.id)}>
                <Keyboard size={18} aria-hidden="true" />
              </button>
              <button
                className={`icon menu-toggle${showOptionsBar ? " open" : ""}`}
                data-controller-autofocus=""
                onClick={() => {
                  if (!showOptionsBar && navigation.config.enabled &&
                      document.documentElement.classList.contains("controller-hide-pointer")) navigation.openPlayerMenu();
                  setShowOptionsBar((visible) => !visible);
                }}
                title={showOptionsBar ? controls.hideOptionsBar : controls.showOptionsBar}
                aria-label={showOptionsBar ? controls.hideOptionsBar : controls.showOptionsBar}
                aria-pressed={showOptionsBar}
              >
                <ChevronDown className="menu-chevron" size={18} aria-hidden="true" />
              </button>
              {isFullscreen && (
                <button
                  className={isChromePinned ? "icon pinned" : "icon"}
                  onClick={() => {
                    const nextPinned = !isChromePinnedRef.current;
                    isChromePinnedRef.current = nextPinned;
                    setIsChromePinned(nextPinned);
                    setIsChromeVisible(nextPinned || isPointerInChromeZoneRef.current);
                  }}
                  title={isChromePinned ? controls.unpinControls : controls.pinControls}
                  aria-label={isChromePinned ? controls.unpinControls : controls.pinControls}
                  aria-pressed={isChromePinned}
                >
                  <Pin size={18} />
                </button>
              )}
              <button type="button" ref={closeButtonRef} className={closePending ? "icon player-close-button confirming" : "icon player-close-button"}
                onClick={() => confirmPlayerAction("close")} onBlur={() => setPendingPlayerAction(null)}
                onKeyDown={playerActionKeyDown}
                title={closePending ? playerCloseConfirmLabels[language] : text.close}
                aria-label={closePending ? playerCloseConfirmLabels[language] : text.close}>
                {closePending ? <Check size={18} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
              </button>
            </div>
          </header>
          {showOptionsBar && (
            <div className="player-toolbar" role="toolbar" aria-label={controls.playerControls}>
              <div className="zoom-controls">
                {navigation.playerMenu && <button type="button" className="secondary player-return-button" data-controller-back="" onClick={navigation.returnToGame}
                  aria-label={navigationLabels[language].returnToGame} title={navigationLabels[language].returnToGame}>
                  <ArrowLeft size={16} aria-hidden="true" /><span>{navigationLabels[language].returnToGame}</span>
                </button>}
                <button className="icon" onClick={() => changeZoom(-0.25)} title={controls.zoomOut} aria-label={controls.zoomOut} disabled={zoom <= 0.5}>
                  <ZoomOut size={18} />
                </button>
                <button className="zoom-level" onClick={() => setZoom(1)} title={controls.resetZoom} aria-label={controls.resetZoom}>
                  <RotateCcw size={14} />
                  {Math.round(zoom * 100)}%
                </button>
                <button className="icon" onClick={() => changeZoom(0.25)} title={controls.zoomIn} aria-label={controls.zoomIn} disabled={zoom >= 2.5}>
                  <ZoomIn size={18} />
                </button>
                <button type="button" className="secondary" onClick={() => setRotation(value => (value + 90) % 360)}
                  title={onscreenLabels(language).rotate} aria-label={onscreenLabels(language).rotate}>
                  <RotateCcw size={18} /> {rotation}°
                </button>
              </div>
              <div className="zoom-controls player-toolbar-actions">
                <div className="player-volume-control" data-expanded={showPlayerVolume}>
                {showPlayerVolume && <label className="player-volume" id={playerVolumeId}>
                  <input type="range" min="0" max="1" step="0.01" value={volume}
                    aria-label={playerVolumeLabels[language].volume} aria-valuetext={`${Math.round(volume * 100)}%`}
                    title={`${playerVolumeLabels[language].volume}: ${Math.round(volume * 100)}%`}
                    onChange={(event) => changePlayerVolume(Number(event.target.value))} />
                  <output>{Math.round(volume * 100)}%</output>
                </label>}
                <button type="button" className={showPlayerVolume ? "icon active" : "icon"}
                  onClick={() => setShowPlayerVolume(visible => !visible)}
                  aria-label={playerVolumeLabels[language].volume}
                  title={`${playerVolumeLabels[language].volume}: ${Math.round(volume * 100)}%`}
                  aria-expanded={showPlayerVolume} aria-controls={showPlayerVolume ? playerVolumeId : undefined}>
                  {volume === 0 ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
                </button>
                </div>
                {volumeError && <span role="alert" className="remap-error">{playerVolumeLabels[language].failed}: {volumeError}</span>}
                {!game.onlineOnly && (
                  <button
                    className="icon"
                    onClick={() => void window.flashApi.openRemapWindow(game.id, language).catch(() => {})}
                    title={remapText.open}
                    aria-label={remapText.open}
                  >
                    <Gamepad2 size={18} />
                  </button>
                )}
                {!game.onlineOnly && <OnscreenEditorButton gameId={game.id} language={language} />}
                {!game.onlineOnly && (globalCrt.config.enabled || globalCrt.config.bezelEnabled) && <>
                  {globalCrt.config.enabled && <button type="button" className={crtConfig.enabled ? "icon active" : "icon"}
                    title={crtSessionLabels[language].crt} aria-label={crtSessionLabels[language].crt}
                    aria-pressed={crtConfig.enabled} onClick={() => setSessionCrt(!crtConfig.enabled)}>
                    <ScanLine size={18} aria-hidden="true" />
                  </button>}
                  {globalCrt.config.bezelEnabled && <button type="button" className={crtConfig.bezel !== "none" ? "icon active" : "icon"}
                    title={crtSessionLabels[language].bezel} aria-label={crtSessionLabels[language].bezel}
                    aria-pressed={crtConfig.bezel !== "none"} onClick={() => setSessionBezel(crtConfig.bezel === "none")}>
                    <Frame size={18} aria-hidden="true" />
                  </button>}
                  <CrtSettings game={{ ...game, crt: savedCrtConfig, crtDisabled, crtBezelDisabled }} language={language} toolbar onPatch={(id, patch) => {
                    void window.flashApi.updateGame(id, patch, language).then(result => {
                      setSavedCrtConfig(result.game.crt);
                      setCrtDisabled(result.game.crtDisabled);
                      setCrtBezelDisabled(result.game.crtBezelDisabled);
                    }).catch(error => { console.error("Save CRT settings:", error); setCrtError(String(error)); });
                  }} />
                </>}
                <PlayerGuidesMenu gameId={game.id} language={language} />
                <button
                  type="button"
                  className={showFps ? "icon active" : "icon"}
                  onClick={() => setSessionFps(!showFps)}
                  title={fpsCounterLabels[language].session}
                  aria-label={fpsCounterLabels[language].session}
                  aria-pressed={showFps}
                >
                  <Gauge size={18} aria-hidden="true" />
                </button>
                {standalone && !game.onlineOnly && (
                  <button
                    className={pinCursor ? "icon active" : "icon"}
                    onClick={togglePinCursor}
                    title={pinCursor ? remapText.unpinCursor : remapText.pinCursor}
                    aria-label={remapText.pinCursor}
                    aria-pressed={pinCursor}
                  >
                    {pinCursor ? <SquareMousePointer size={18} /> : <SquareDashedMousePointer size={18} />}
                  </button>
                )}
                <button
                  className="icon"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? controls.exitFullscreen : controls.fullscreen}
                  aria-label={isFullscreen ? controls.exitFullscreen : controls.fullscreen}
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className={crtConfig.background ? "player-surface-wrap crt-ambient-on" : "player-surface-wrap"}>
          {showFps && <FpsOverlay style={fpsStyle} />}
          {crtConfig.background && <CrtAmbientBackground feed={crtFrameFeed} hidden={!revealed} />}
          <div className={zoom > 1 ? "player-surface zoomed" : "player-surface"} ref={surfaceRef}>
            <div className="player-rotation-frame" style={{ width: fitSize ? `${Math.round(fitSize.width * zoom)}px` : "100%", height: fitSize ? `${Math.round(fitSize.height * zoom)}px` : "100%" }}>
              {/* Opacity too: Ruffle's player sets its own visibility, so an inherited "hidden" alone leaves the game showing. */}
              <div className="player-monitor" style={{ ...playerMonitorStyle, ...(revealed ? {} : { visibility: "hidden", opacity: 0 }) }}>
                <div className={crtConfig.enabled && crtConfig.innerBorder && !crtBezelDrawsEdge(crtConfig) ? "player-stage crt-stage-edge" : "player-stage"} ref={containerRef} style={playerStageStyle} data-game-rotation={rotation} />
                <CrtBezel config={crtConfig} frameAspect={crtFrameRatio} rotation={rotation} feed={crtFrameFeed} imageUrl={new URL(`${savedCrtConfig && !savedCrtConfig.inheritBezel ? `/crt-bezel/${encodeURIComponent(game.id)}` : "/crt-global-bezel"}?v=${crtBezelVersion}-${globalCrt.version}`, game.swfUrl).href} loaded={() => setLaunchBezelLoaded(true)} failed={() => setCrtBezelError(crtLabels[language].instructions)} />
              </div>
            </div>
          </div>
          {!game.onlineOnly && <OnscreenGamepad gameId={game.id} engineRef={remapEngineRef}
            blocked={paused || !playbackReady || capturing || navigation.playerMenu || navigation.keyboardOpen} language={language}
            menuLabel={controls.showOptionsBar} onMenu={() => {
              if (navigation.config.enabled) navigation.openPlayerMenu();
              setIsChromeVisible(true);
              setShowOptionsBar(true);
            }} />}
          {navigation.playerMenu && !navigation.keyboardOpen && touchModeEnabled(navigation.config) && <button type="button"
            className="player-menu-dismiss" tabIndex={-1} aria-label={navigationLabels[language].returnToGame}
            onPointerDown={event => {
              event.preventDefault();
              if (event.isPrimary && event.button === 0) playerMenuDismissPointer.current = event.pointerId;
            }}
            onPointerCancel={() => { playerMenuDismissPointer.current = null; }}
            onClick={event => {
              const matchingPointer = "pointerId" in event.nativeEvent &&
                event.nativeEvent.pointerId === playerMenuDismissPointer.current;
              playerMenuDismissPointer.current = null;
              if (event.detail !== 0 && !matchingPointer) return;
              const scope = navigationScope();
              if (scope === document.body || scope.matches(".player-chrome")) navigation.returnToGame();
            }} />}
          {paused && <div className="player-paused-overlay" role="status" onContextMenu={(event) => event.preventDefault()}>
            <strong>{gamePausedLabels[language]}</strong>
          </div>}
          {(crtError || crtBezelError || shockwaveWarning || crtFrameWarning) && <div className="crt-player-error" role="alert">{crtError || crtBezelError || shockwaveWarning || crtFrameWarning}</div>}
        </div>
        {screenshotNotice && (
          <div className="player-screenshot-notice" role="status" key={screenshotNotice.id}>
            <span>{screenshotNotice.message}</span>
            {screenshotNotice.shot && (
              <button type="button" className="secondary" onClick={() => openScreenshot(screenshotNotice.shot!)}>
                <Images size={14} aria-hidden="true" />{shotText.view}
              </button>
            )}
            {screenshotNotice.shot && navigation.config.enabled && navigation.config.showHints && (
              <span className={`player-screenshot-notice-hint controller-style-${navigation.style}`}>
                <ControllerChordGlyph buttons={navigation.config.screenshotButtons} style={navigation.style} />{shotText.view}
              </span>
            )}
          </div>
        )}
        {createPortal(<div className="remap-cursor" ref={remapCursorRef} hidden aria-hidden="true" />, document.body)}
        {!standalone && !isFullscreen &&
          (["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((direction) => (
            <div
              key={direction}
              className={`player-resize-handle ${direction}`}
              data-direction={direction}
              aria-hidden="true"
              onPointerDown={startPlayerResize}
              onPointerMove={movePlayerResize}
              onPointerUp={stopPlayerResize}
              onPointerCancel={stopPlayerResize}
            />
          ))}
      </section>
    </div>
  );
}

function CoverCapture({
  game,
  onDone,
  language,
}: {
  game: Game | null;
  onDone: (gameId: string, updated?: Game) => void;
  language: Language;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: HTMLElement | null = null;

    async function capture() {
      if (!game || !ref.current) return;
      if (game.format === "dcr") {
        onDone(game.id);
        return;
      }
      try {
        await loadRuffleScript(language);
        if (cancelled || !window.RufflePlayer || !ref.current) return;
        const ruffle = window.RufflePlayer.newest();
        player = ruffle.createPlayer();
        player.className = "ruffle-player";
        ref.current.innerHTML = "";
        ref.current.appendChild(player);
        await ruffleApi(player).load({ url: game.swfUrl, allowScriptAccess: false });
        await new Promise((resolve) => window.setTimeout(resolve, 2600));
        if (cancelled || !ref.current) return;
        const canvas = findCanvas(ref.current);
        if (!canvas) {
          onDone(game.id);
          return;
        }
        const updated = await window.flashApi.saveCover(game.id, createCoverDataUrl(canvas, language));
        onDone(game.id, updated);
      } catch {
        if (game) onDone(game.id);
      }
    }

    capture();
    return () => {
      cancelled = true;
      player?.remove();
    };
  }, [game, language, onDone]);

  return <div className="cover-capture" ref={ref} />;
}

const detailsWidthLimits = { min: 220, max: 1200, default: 300 };
// Small minimums keep both panels useful on 720p/900p handheld screens.
const sidebarWidthLimits = { min: 150, max: 480, default: 260 };

type GameTheme = NonNullable<Awaited<ReturnType<FlashApi["getGameTheme"]>>>;

function readStoredFlag(key: string) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

type SortMode = "dateAdded" | "name" | "lastPlayed" | "mostPlayed";
const sortModes: SortMode[] = ["dateAdded", "name", "lastPlayed", "mostPlayed"];

function readStoredSortMode(): SortMode {
  try {
    const stored = localStorage.getItem("flashmanager.sortMode");
    return sortModes.includes(stored as SortMode) ? (stored as SortMode) : "lastPlayed";
  } catch {
    return "lastPlayed";
  }
}

function readStoredSortAscending() {
  try {
    const stored = localStorage.getItem("flashmanager.sortAscending");
    return stored === null ? readStoredSortMode() === "name" : stored === "true";
  } catch {
    return readStoredSortMode() === "name";
  }
}

function clampDetailsWidth(width: number) {
  return Math.round(Math.min(detailsWidthLimits.max, Math.max(detailsWidthLimits.min, width)));
}

function AboutReleaseLink({ component, name, version, language }: { component: "app" | "ruffle" | "dirplayer" | "libreshockwave" | "crt-royale" | "electron"; name: string; version: string; language: Language }) {
  if (!version) return <>—</>;
  const label = component === "crt-royale" && /^[a-f0-9]{40}$/i.test(version) ? version.slice(0, 7) : `v${version.replace(/^v/i, "")}`;
  if (!window.flashApi.openComponentRelease) return <>{label}</>;
  return (
    <a
      href="#"
      title={aboutLinkLabels[language].openRelease.replace("{name}", name)}
      onClick={(event) => {
        event.preventDefault();
        void window.flashApi.openComponentRelease!(component).catch(console.error);
      }}
    >
      {label}
    </a>
  );
}

function clampSidebarWidth(width: number) {
  return Math.round(Math.min(sidebarWidthLimits.max, Math.max(sidebarWidthLimits.min, width)));
}

export function App() {
  const navigation = useControllerNavigation();
  const gamePlayers = usePlayers();
  const [library, setLibrary] = useState<LibraryState>(emptyLibrary);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [detailsWidth, setDetailsWidth] = usePanelWidth("flashmanager.detailsWidth", detailsWidthLimits.default, detailsWidthLimits.min, detailsWidthLimits.max);
  const [isResizingDetails, setIsResizingDetails] = useState(false);
  const [sidebarWidth, setSidebarWidth] = usePanelWidth("flashmanager.sidebarWidth", sidebarWidthLimits.default, sidebarWidthLimits.min, sidebarWidthLimits.max);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const [sortMode, setSortMode] = useState<SortMode>(readStoredSortMode);
  const [sortAscending, setSortAscending] = useState(readStoredSortAscending);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortControlRef = useRef<HTMLDivElement>(null);
  const [showCardSize, setShowCardSize] = useState(false);
  const [showLibraryPath, setShowLibraryPath] = useLibraryPathVisibility();
  const [gameCardPreferences, updateGameCardPreferences] = useGameCardPreferences();
  const [showOnlineOnlyGames, setShowOnlineOnlyGames] = useState(() => {
    try {
      const saved = localStorage.getItem("flashmanager.showOnlineOnlyGames");
      return saved === null ? localStorage.getItem("flashmanager.showOnlineOnlyOffline") !== "false" : saved !== "false";
    }
    catch { return true; }
  });

  const [cardSizeIndex, setCardSizeIndex] = useState(() => {
    try {
      const stored = localStorage.getItem("flashmanager.cardSizeIndex");
      if (stored === null) return 3;
      const saved = Number(stored);
      return Number.isInteger(saved) && saved >= 0 && saved < gameCardWidths.length ? saved : 3;
    } catch {
      return 3;
    }
  });
  const [captureQueue, setCaptureQueue] = useState<string[]>([]);
  const previousCaptureCountRef = useRef(0);
  const captureBatchSizeRef = useRef(0);
  const captureTaskRef = useRef<Promise<string> | null>(null);
  const captureCancelledRemainingRef = useRef<number | null>(null);

  useEffect(() => window.flashApi.onHistoryTaskCancelled(id => {
    void captureTaskRef.current?.then(current => {
      if (id !== current) return;
      setCaptureQueue(queue => {
        captureCancelledRemainingRef.current = Math.max(0, queue.length - 1);
        return queue.slice(0, 1);
      });
    }).catch(error => console.error("Could not cancel cover creation", error));
  }), []);

  useEffect(() => {
    captureBatchSizeRef.current = Math.max(captureBatchSizeRef.current, captureQueue.length);
    const total = captureBatchSizeRef.current;
    if (total > 0 && !captureTaskRef.current) {
      captureTaskRef.current = window.flashApi.beginHistoryTask("coverCapture", total);
    }
    const task = captureTaskRef.current;
    if (task && captureQueue.length > 0) {
      void task.then((id) => id ? window.flashApi.updateHistoryTask(id, total - captureQueue.length, total) : undefined).catch(console.error);
    }
    if (previousCaptureCountRef.current > 0 && captureQueue.length === 0) {
      const skipped = captureCancelledRemainingRef.current;
      if (total > 1 && skipped === null) setToast({ type: "coversFinished" });
      if (task) void task.then((id) => id ? window.flashApi.endHistoryTask(id, skipped === null ? "done" : "cancelled", { count: total - (skipped ?? 0) }) : undefined).catch(console.error);
      captureTaskRef.current = null;
      captureBatchSizeRef.current = 0;
      captureCancelledRemainingRef.current = null;
    }
    previousCaptureCountRef.current = captureQueue.length;
  }, [captureQueue.length]);
  const [language, setLanguage] = useState<Language>(readLanguage);
  const { locationRef, pathRef, pathVisible } = useLibraryLocationLayout(showCardSize, showLibraryPath, `${language}:${library.libraryRoot}`);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateDialog, setUpdateDialog] = useState<UpdateCheckResult | null>(null);
  const [unblockUpdate, setUnblockUpdate] = useState(false);
  const [enableUpdateScriptExecution, setEnableUpdateScriptExecution] = useState(() => {
    try { return localStorage.getItem("flashroyale.enableUpdateScriptExecution") === "true"; }
    catch (error) {
      console.warn("Could not read update script execution preference:", error);
      return false;
    }
  });
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateInstallError, setUpdateInstallError] = useState("");
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const updateCheckInFlightRef = useRef(false);
  const startupUpdateCheckRef = useRef(false);
  const [checkForUpdatesOnStart, setCheckForUpdatesOnStart] = useState<boolean | null>(null);
  const [isSavingStartupUpdateCheck, setIsSavingStartupUpdateCheck] = useState(false);
  const [runningGameIds, setRunningGameIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general");
  const [settingsMoved, setSettingsMoved] = useState(false);
  const settingsPanelRef = useRef<HTMLElement | null>(null);
  const settingsTitleRef = useRef<HTMLHeadingElement | null>(null);
  const settingsDrag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const settingsMovedRef = useRef(settingsMoved);
  settingsMovedRef.current = settingsMoved;
  useEffect(() => {
    if (settingsOpen) setSettingsTab("general");
    else setSettingsMoved(false);
  }, [settingsOpen]);
  const moveSettingsPanel = (left: number, top: number) => {
    const element = settingsPanelRef.current;
    const bounds = element?.parentElement?.getBoundingClientRect();
    if (!element || !bounds) return;
    const rect = element.getBoundingClientRect();
    element.style.position = "fixed";
    element.style.left = `${Math.max(bounds.left + 8, Math.min(left, bounds.right - rect.width - 8))}px`;
    element.style.top = `${Math.max(bounds.top + 8, Math.min(top, bounds.bottom - rect.height - 8))}px`;
  };
  const startSettingsDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    const rect = settingsPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    settingsDrag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    moveSettingsPanel(rect.left, rect.top);
    setSettingsMoved(true);
  };
  const dragSettingsPanel = (event: ReactPointerEvent<HTMLElement>) => {
    if (!settingsDrag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    moveSettingsPanel(settingsDrag.current.left + event.clientX - settingsDrag.current.x, settingsDrag.current.top + event.clientY - settingsDrag.current.y);
  };
  const endSettingsDrag = (event: ReactPointerEvent<HTMLElement>) => {
    settingsDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveSettingsByKeyboard = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
    const rect = settingsPanelRef.current?.getBoundingClientRect();
    if (!delta || !rect) return;
    event.preventDefault();
    event.stopPropagation();
    moveSettingsPanel(rect.left + delta[0], rect.top + delta[1]);
    setSettingsMoved(true);
  };
  useEffect(() => {
    if (!settingsOpen) return;
    const title = settingsTitleRef.current;
    let original: { position: string; left: string; top: string; moved: boolean } | null = null;
    const startMove = () => {
      const element = settingsPanelRef.current;
      if (!element) return;
      original = { position: element.style.position, left: element.style.left, top: element.style.top, moved: settingsMovedRef.current };
    };
    const cancelMove = () => {
      const element = settingsPanelRef.current;
      if (!original || !element) return;
      const { moved, ...style } = original;
      Object.assign(element.style, style);
      setSettingsMoved(moved);
      original = null;
    };
    title?.addEventListener("controller-resize-start", startMove);
    title?.addEventListener("controller-resize-cancel", cancelMove);
    const keepVisible = () => {
      const element = settingsPanelRef.current;
      if (element?.style.position !== "fixed") return;
      const rect = element.getBoundingClientRect();
      moveSettingsPanel(rect.left, rect.top);
    };
    const observer = new ResizeObserver(keepVisible);
    if (settingsPanelRef.current) observer.observe(settingsPanelRef.current);
    window.addEventListener("resize", keepVisible);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", keepVisible);
      settingsDrag.current = null;
      title?.removeEventListener("controller-resize-start", startMove);
      title?.removeEventListener("controller-resize-cancel", cancelMove);
    };
  }, [settingsOpen]);
  const [startInFullscreen, setStartInFullscreen] = useState(false);
  const [minimizeToTrayOnGameLaunch, setMinimizeToTrayOnGameLaunch] = useState(true);
  const [minimizeToTrayOnMinimize, setMinimizeToTrayOnMinimize] = useState(true);
  const preferenceRevisions = useRef({ fullscreen: 0, launchTray: 0, minimizeTray: 0, startupUpdates: 0 });
  const [exploreAvailability, setExploreAvailability] = useState({ enabled: true, online: false });
  const [checkingExplore, setCheckingExplore] = useState(true);
  const [explorePreferenceLoaded, setExplorePreferenceLoaded] = useState(false);
  const [manualImportEnabled, setManualImportEnabled] = useState(false);
  const [manualImportPreferenceLoaded, setManualImportPreferenceLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void window.flashApi.getManualImportEnabled().then((enabled) => {
      if (!active) return;
      setManualImportEnabled(enabled);
      setManualImportPreferenceLoaded(true);
    }).catch((error) => {
      console.error("Could not load manual import preference", error);
      if (active) setToast(text.saveFailed);
    });
    return () => { active = false; };
  }, []);
  const exploreCheckRef = useRef(0);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [textPrompt, setTextPrompt] = useState<TextPromptRequest | null>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const text = messages[language];
  const languageOptionsUnsorted: { value: Language; label: string }[] = [
    { value: "en", label: "English" },
    { value: "zh", label: "简体中文" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" },
    { value: "pt-BR", label: "Português (Brasil)" },
    { value: "ja", label: "日本語" },
    { value: "ko", label: "한국어" },
    { value: "hi", label: "हिन्दी" },
    { value: "ar", label: "العربية" },
    { value: "ru", label: "Русский" },
  ];
  const languageOptions = [...languageOptionsUnsorted].sort((first, second) =>
    new Intl.Collator(language).compare(first.label, second.label),
  );
  const [toast, setToast] = useState<ToastMessage>({ type: "appStarted" });
  const startupRecordedRef = useRef(false);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const load = async () => {
      const request = ++revision;
      try {
        const entries = await window.flashApi.listHistory();
        if (active && request === revision) setActivityEntries(entries);
      } catch (error) {
        console.error("Load library activity summary:", error);
      }
    };
    const unsubscribe = window.flashApi.onHistoryChanged(() => { void load(); });
    void load();
    return () => { active = false; unsubscribe(); };
  }, []);
  // Messages that only repeat the result of a task the activity history already records.
  const taskToastRef = useRef<ToastMessage | null>(null);
  const setTaskToast = (message: string) => {
    taskToastRef.current = message;
    setToast(message);
  };
  useEffect(() => {
    const onToast = (event: Event) => {
      const message = (event as CustomEvent<unknown>).detail;
      if (typeof message === "string" && message) setToast(message);
    };
    window.addEventListener("flash-royale-toast", onToast);
    return () => window.removeEventListener("flash-royale-toast", onToast);
  }, []);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importProgressHidden, setImportProgressHidden] = useState(false);
  const [isCancellingImport, setIsCancellingImport] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: Game[];
    skipped: NonNullable<ImportResult["skipped"]>;
    cancelled: boolean;
  } | null>(null);
  const libraryGamesRef = useRef(library.games);
  libraryGamesRef.current = library.games;
  const [isDragging, setIsDragging] = useState(false);
  const isTextPromptOpen = textPrompt !== null;

  const runUpdateCheck = async (manual: boolean) => {
    if (updateCheckInFlightRef.current) return;
    updateCheckInFlightRef.current = true;
    setIsCheckingForUpdates(true);
    try {
      const result = await window.flashApi.checkForUpdates();
      if (result.status === "available") {
        setUnblockUpdate(false);
        setUpdateInstallError("");
        setUpdateDialog(result);
        setToast(updateLabels[language].availableToast.replace("{version}", result.latestVersion));
      } else if (manual && result.status === "current") {
        // A manual check always shows the latest release notes, even when there is nothing to install.
        setUpdateInstallError("");
        setUpdateDialog(result);
      } else if (manual) {
        setToast(updateLabels[language].failedToast);
      }
    } catch {
      if (manual) setToast(updateLabels[language].failedToast);
    } finally {
      updateCheckInFlightRef.current = false;
      setIsCheckingForUpdates(false);
    }
  };

  useEffect(() => {
    window.flashApi.readLibrary().then((state) => {
      setLibrary(state);
    });
  }, []);

  useEffect(() => window.flashApi.onExploreImported((title) => {
    window.flashApi.readLibrary().then(setLibrary).catch(() => {});
    setToast({ type: "exploreImported", title });
  }), []);

  useEffect(() => window.flashApi.onExploreLibraryChanged(() => {
    window.flashApi.readLibrary().then(setLibrary).catch(() => {});
  }), []);

  const flashpointLanguageRef = useRef(language);
  flashpointLanguageRef.current = language;
  useEffect(() => {
    let lastScan = 0;
    const scan = (force = false) => {
      if (!force && Date.now() - lastScan < 30000) return;
      lastScan = Date.now();
      const lang = flashpointLanguageRef.current;
      void runFlashpointImport(lang).then((outcome) => {
        if (outcome.status !== "imported") return;
        setTaskToast(`${flashpointImportLabels[lang].toast} ${outcome.titles.join(", ")}`);
        return runFlashpointMetadata(flashpointLanguageRef.current).then((outcome) => {
          if (outcome.status === "updated") setTaskToast(`${metadataSourceLabels[flashpointLanguageRef.current].toast} ${outcome.titles.join(", ")}`);
        });
      }).catch(console.error);
    };
    const timer = window.setTimeout(() => scan(true), 4000);
    const onFocus = () => scan();
    window.addEventListener("focus", onFocus);
    const stopWatching = window.flashApi.onFlashpointDownloadsChanged(() => scan(true));
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      stopWatching();
    };
  }, []);

  useEffect(() => {
    window.flashApi.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
    return window.flashApi.onRuffleRuntimeChanged?.((runtime) => {
      setAppInfo((current) => (current ? { ...current, ruffleVersion: runtime.activeVersion } : current));
      void refreshPlayers().catch(() => {});
    });
  }, []);

  useEffect(() => {
    let active = true;
    const revision = preferenceRevisions.current.startupUpdates;
    void window.flashApi.getCheckForUpdatesOnStart().then((enabled) => {
      if (!active) return;
      if (revision === preferenceRevisions.current.startupUpdates) setCheckForUpdatesOnStart(enabled);
      if (startupUpdateCheckRef.current) return;
      startupUpdateCheckRef.current = true;
      if (enabled) void runUpdateCheck(false);
    }).catch((error) => {
      if (active) setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
    });
    return () => { active = false; };
  }, []);

  const refreshExploreAvailability = async () => {
    const request = ++exploreCheckRef.current;
    try {
      const availability = await window.flashApi.getExploreAvailability();
      if (request === exploreCheckRef.current) setExploreAvailability(availability);
    } catch {
      if (request === exploreCheckRef.current) setExploreAvailability((current) => ({ ...current, online: false }));
    } finally {
      if (request === exploreCheckRef.current) {
        setCheckingExplore(false);
        setExplorePreferenceLoaded(true);
      }
    }
  };

  useEffect(() => {
    void refreshExploreAvailability();
    const refresh = () => { void refreshExploreAvailability(); };
    // Hidden or minimized windows skip the periodic check; returning focus checks again.
    const interval = window.setInterval(() => { if (!document.hidden) refresh(); }, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      ++exploreCheckRef.current;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  useEffect(() => {
    let previousIds: string[] | null = null;
    const applyRunningIds = (ids: string[], notify: boolean) => {
      const before = previousIds;
      previousIds = ids;
      setRunningGameIds(ids);
      if (!notify || !before) return;
      const titleOf = (id: string) => libraryGamesRef.current.find((game) => game.id === id)?.title || id;
      const started = ids.find((id) => !before.includes(id));
      const stopped = before.find((id) => !ids.includes(id));
      if (started) setToast({ type: "gameStarted", title: titleOf(started) });
      else if (stopped) setToast({ type: "gameStopped", title: titleOf(stopped) });
    };
    window.flashApi
      .getRunningPlayers()
      .then((ids) => {
        if (!previousIds) applyRunningIds(ids, false);
      })
      .catch(() => {});
    return window.flashApi.onRunningPlayersChange((ids) => applyRunningIds(ids, true));
  }, []);

  useEffect(() => window.flashApi.onImportProgress(setImportProgress), []);

  const [isCloseBlockedOpen, setIsCloseBlockedOpen] = useState(false);
  const [closeBlockedReason, setCloseBlockedReason] = useState<"game" | "explore">("game");
  useEffect(() => window.flashApi.onCloseBlocked((reason) => {
    setCloseBlockedReason(reason);
    setIsCloseBlockedOpen(true);
  }), []);
  useEffect(() => window.flashApi.onAppNotice?.((notice) => {
    if (notice.kind === "nativeControllerFailed") setToast(nativeControllerFailedLabels[language].replace("{detail}", notice.detail));
    else if (notice.kind === "gameLaunchFailed") setToast(notice.detail);
  }), [language]);

  useEffect(() =>
    window.flashApi.onPlayTimeUpdated((updatedGame) => {
      setLibrary((current) => ({
        ...current,
        games: current.games.map((game) => (game.id === updatedGame.id ? updatedGame : game)),
      }));
    }),
  []);

  useEffect(() => window.flashApi.onGamePinCursorChanged((updatedGame) => {
    setLibrary((current) => ({
      ...current,
      games: current.games.map((game) => (game.id === updatedGame.id ? updatedGame : game)),
    }));
  }), []);

  useEffect(() => window.flashApi.onGameCrtChanged((id, config, bezelChanged, disabled, bezelDisabled) => {
    if (bezelChanged) return;
    setLibrary(current => ({
      ...current,
      games: current.games.map(game => game.id === id ? { ...game, crt: config, crtDisabled: disabled, crtBezelDisabled: bezelDisabled } : game),
    }));
  }), []);

  useEffect(() => window.flashApi.onGameCoverChanged((updatedGame) => {
    setLibrary((current) => ({
      ...current,
      games: current.games.map((game) => (game.id === updatedGame.id ? { ...game, coverUrl: updatedGame.coverUrl, coverStatus: updatedGame.coverStatus, updatedAt: updatedGame.updatedAt } : game)),
    }));
  }), []);

  useEffect(() => window.flashApi.onGameResourcesUpdated((updatedGame) => {
    setLibrary((current) => ({
      ...current,
      games: current.games.map((game) => (game.id === updatedGame.id ? updatedGame : game)),
    }));
  }), []);

  useEffect(() => window.flashApi.onGuidesChanged(({ gameId, guides }) => {
    setLibrary((current) => ({
      ...current,
      games: current.games.map((game) => (game.id === gameId ? { ...game, guides } : game)),
    }));
  }), []);

  useEffect(() => {
    try {
      localStorage.setItem("flashmanager.language", language);
    } catch {}
    window.dispatchEvent(new CustomEvent("controller-ui-language", { detail: language }));
  }, [language]);

  const escapeHandledElsewhere =
    settingsOpen || Boolean(confirmation) || Boolean(textPrompt) || Boolean(updateDialog) || sortMenuOpen || Boolean(importProgress && !importProgressHidden) || Boolean(importSummary) || isCloseBlockedOpen;
  useEffect(() => {
    if (!selectedId || escapeHandledElsewhere) return;
    const deselectOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const focused = document.activeElement;
      const themeControl = focused instanceof HTMLElement ? focused.closest<HTMLElement>(".theme-control") : null;
      if (themeControl) {
        // B/Escape on the volume slider closes its popup and returns to the music button; the selection stays.
        const button = themeControl.querySelector<HTMLElement>(":scope > button");
        if (focused?.closest(".theme-volume") && button) {
          event.preventDefault();
          themeControl.setAttribute("data-volume-dismissed", "");
          const reopen = (next: FocusEvent) => {
            if (next.target === button) return;
            themeControl.removeAttribute("data-volume-dismissed");
            document.removeEventListener("focusin", reopen, true);
          };
          document.addEventListener("focusin", reopen, true);
          if (document.documentElement.classList.contains("controller-navigation-active") ||
            document.documentElement.classList.contains("keyboard-focus")) focusControl(button);
          else button.focus();
        }
        return;
      }
      setSelectedId(null);
      if (focused instanceof HTMLElement && focused.closest(".game-card")) focused.blur();
    };
    document.addEventListener("keydown", deselectOnEscape);
    return () => document.removeEventListener("keydown", deselectOnEscape);
  }, [selectedId, escapeHandledElsewhere]);

  useEffect(() => {
    if (!settingsOpen) return;
    let isCurrent = true;
    const revisions = { ...preferenceRevisions.current };
    window.flashApi.getStartInFullscreen().then((enabled) => {
      if (isCurrent && revisions.fullscreen === preferenceRevisions.current.fullscreen) setStartInFullscreen(enabled);
    }).catch(() => {});
    window.flashApi.getMinimizeToTrayOnGameLaunch().then((enabled) => {
      if (isCurrent && revisions.launchTray === preferenceRevisions.current.launchTray) setMinimizeToTrayOnGameLaunch(enabled);
    }).catch(() => {});
    window.flashApi.getMinimizeToTrayOnMinimize().then((enabled) => {
      if (isCurrent && revisions.minimizeTray === preferenceRevisions.current.minimizeTray) setMinimizeToTrayOnMinimize(enabled);
    }).catch(() => {});
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      isCurrent = false;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);


  useEffect(() => {
    if (!isTextPromptOpen) return;
    promptInputRef.current?.focus();
    promptInputRef.current?.select();
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") resolveTextPrompt(null);
    };
    document.addEventListener("keydown", cancelOnEscape);
    return () => document.removeEventListener("keydown", cancelOnEscape);
  }, [isTextPromptOpen]);

  useEffect(() => {
    if (!updateDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isInstallingUpdate) setUpdateDialog(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [updateDialog, isInstallingUpdate]);

  useEffect(() => {
    if (!updateDialog) return;
    const initialAction = document.querySelector<HTMLElement>(".update-dialog [data-controller-back]");
    if (initialAction) focusControl(initialAction);
  }, [updateDialog]);

  const selectedGame = library.games.find((game) => game.id === selectedId) || null;
  useEffect(() => {
    if (!showOnlineOnlyGames && selectedGame?.onlineOnly) setSelectedId(null);
  }, [showOnlineOnlyGames, selectedGame?.onlineOnly]);
  const [isThemeEnabled, setIsThemeEnabled] = useState(() => {
    try { return localStorage.getItem("flashmanager.themeEnabled") !== "false"; } catch { return true; }
  });
  const [libraryMusicEnabled, setLibraryMusicEnabled] = useState(false);
  const [libraryMusicReady, setLibraryMusicReady] = useState(false);
  const [importDefaultMusic, setImportDefaultMusic] = useState(true);
  const [defaultMusicReady, setDefaultMusicReady] = useState(false);
  const [importingMusic, setImportingMusic] = useState(false);
  const [musicImportSelectionOpen, setMusicImportSelectionOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void window.flashApi.getImportDefaultMusic().then(enabled => {
      if (active) { setImportDefaultMusic(enabled); setDefaultMusicReady(true); }
    }).catch(error => {
      console.error("Load default music import preference:", error);
      if (active) setToast(messages[language].saveFailed);
    });
    return () => { active = false; };
  }, []);
  const importLibraryMusic = async (all: boolean, gameIds?: string[]) => {
    setImportingMusic(true);
    try {
      await window.flashApi.importDefaultMusic(all, gameIds);
    } catch (error) {
      console.error("Import library music:", error);
      setToast(`${musicLabels[language].failed}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      for (const game of library.games) {
        themeCacheRef.current.delete(game.id);
        musicCandidatesCacheRef.current.delete(game.id);
      }
      setThemeReloadKey(key => key + 1);
      setImportingMusic(false);
    }
  };
  useEffect(() => {
    let active = true;
    void window.flashApi.getLibraryMusicEnabled().then(enabled => {
      if (active) { setLibraryMusicEnabled(enabled); setLibraryMusicReady(true); }
    }).catch(error => {
      console.error("Load library music preference:", error);
      if (active) setToast(messages[language].saveFailed);
    });
    return () => { active = false; };
  }, []);
  const [isThemePlaying, setIsThemePlaying] = useState(false);
  const [themeVolume, setThemeVolume] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("flashmanager.themeVolume"));
      return localStorage.getItem("flashmanager.themeVolume") !== null && saved >= 0 && saved <= 1 ? saved : 0.75;
    } catch {
      return 0.75;
    }
  });
  const [themeInfo, setThemeInfo] = useState<{ gameId: string; theme: GameTheme | null } | null>(null);
  const [themeReloadKey, setThemeReloadKey] = useState(0);
  const themeCacheRef = useRef(new BoundedCache<string, GameTheme | null>(4, 16 * 1024 * 1024, (theme) => theme?.data.byteLength || 0));
  const [musicCandidates, setMusicCandidates] = useState<{ gameId: string; durations: number[] } | null>(null);
  const musicCandidatesCacheRef = useRef(new BoundedCache<string, number[]>(128, 64 * 1024, (durations) => durations.length * 8));
  const themeAudioRef = useRef<HTMLAudioElement | null>(null);
  const repeatMusicRef = useRef(selectedGame?.repeatMusic !== false);
  repeatMusicRef.current = selectedGame?.repeatMusic !== false;
  const themeFadeRef = useRef<{ audio: HTMLAudioElement; cancel: () => void } | null>(null);
  const [visibilityRefreshKey, setVisibilityRefreshKey] = useState(0);
  const isAppVisibleRef = useRef(true);
  const themeVolumeRef = useRef(themeVolume);
  themeVolumeRef.current = themeVolume;
  const isAnyGameRunning = runningGameIds.length > 0;
  const isThemeEnabledRef = useRef(isThemeEnabled);
  isThemeEnabledRef.current = isThemeEnabled && libraryMusicEnabled && selectedGame?.musicEnabled !== false;
  const themeSuspendedByGameRef = useRef(false);

  useEffect(() => {
    // Not persisted: the saved preference stays "on" so the app still starts with music.
    if (isAnyGameRunning) {
      if (isThemeEnabledRef.current) {
        themeSuspendedByGameRef.current = true;
        setIsThemeEnabled(false);
      }
    } else if (themeSuspendedByGameRef.current) {
      themeSuspendedByGameRef.current = false;
      setIsThemeEnabled(true);
    }
  }, [isAnyGameRunning]);
  const selectedTheme = themeInfo && themeInfo.gameId === selectedId ? themeInfo.theme : null;

  useEffect(() => {
    if (!selectedId) return;
    const cached = musicCandidatesCacheRef.current.get(selectedId);
    if (cached) {
      setMusicCandidates({ gameId: selectedId, durations: cached });
      return;
    }
    let cancelled = false;
    window.flashApi
      .getMusicCandidates(selectedId)
      .then((candidates) => {
        if (cancelled) return;
        const durations = candidates.map((candidate) => candidate.duration);
        musicCandidatesCacheRef.current.set(selectedId, durations);
        if (!cancelled) setMusicCandidates({ gameId: selectedId, durations });
      }).catch((error) => {
        console.error("Could not list game music", error);
        if (!cancelled) {
          setMusicCandidates(null);
          setToast(`${musicLabels[language].failed}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, themeReloadKey]);

  useEffect(() => {
    if (!selectedId) {
      setThemeInfo(null);
      return;
    }
    const cached = themeCacheRef.current.get(selectedId);
    if (cached !== undefined) {
      setThemeInfo({ gameId: selectedId, theme: cached });
      return;
    }
    let cancelled = false;
    window.flashApi
      .getGameTheme(selectedId)
      .then((theme) => {
        if (cancelled) return;
        themeCacheRef.current.set(selectedId, theme);
        if (!cancelled) setThemeInfo({ gameId: selectedId, theme });
      }).catch((error) => {
        console.error("Could not load game music", error);
        if (!cancelled) {
          setThemeInfo(null);
          setToast(`${musicLabels[language].failed}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, themeReloadKey]);

  useEffect(() => {
    // Stays paused while a game is running so the two soundtracks never overlap.
    if (!libraryMusicEnabled || selectedGame?.musicEnabled === false || !isThemeEnabled || !selectedTheme || isAnyGameRunning || !isAppVisibleRef.current) return;
    const audioUrl = URL.createObjectURL(new Blob([selectedTheme.data], { type: selectedTheme.mimeType }));
    const audio = new Audio(audioUrl);
    audio.loop = repeatMusicRef.current;
    audio.volume = 0;
    themeAudioRef.current = audio;
    const playing = () => setIsThemePlaying(true);
    const stopped = () => setIsThemePlaying(false);
    audio.addEventListener("playing", playing);
    audio.addEventListener("pause", stopped);
    audio.addEventListener("ended", stopped);
    audio.addEventListener("error", stopped);
    audio.addEventListener("waiting", stopped);
    void audio.play().catch(() => {});
    fadeManagedAudio(audio, () => themeVolumeRef.current, themeFadeRef);
    return () => {
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("pause", stopped);
      audio.removeEventListener("ended", stopped);
      audio.removeEventListener("error", stopped);
      audio.removeEventListener("waiting", stopped);
      setIsThemePlaying(false);
      if (themeAudioRef.current === audio) themeAudioRef.current = null;
      fadeManagedAudio(audio, () => 0, themeFadeRef, () => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        URL.revokeObjectURL(audioUrl);
      });
    };
  }, [libraryMusicEnabled, selectedGame?.musicEnabled, isThemeEnabled, selectedTheme, isAnyGameRunning, visibilityRefreshKey]);

  useEffect(() => {
    const audio = themeAudioRef.current;
    if (!audio) return;
    audio.loop = selectedGame?.repeatMusic !== false;
    if (audio.loop && audio.paused && isThemeEnabledRef.current && !isAnyGameRunning && isAppVisibleRef.current) {
      void audio.play().catch(error => console.error("Resume repeating library music:", error));
    }
  }, [selectedGame?.repeatMusic]);

  useEffect(() => window.flashApi.onWindowedChanged?.((windowed) => {
    document.documentElement.classList.toggle("main-window-windowed", windowed);
  }), []);

  useEffect(() => {
    const unsubscribe = window.flashApi.onAppVisibilityChanged((visible) => {
      isAppVisibleRef.current = visible;
      const audio = themeAudioRef.current;
      if (!visible) {
        if (audio) {
          fadeManagedAudio(audio, () => 0, themeFadeRef, () => {
            if (!isAppVisibleRef.current && themeAudioRef.current === audio) audio.pause();
          });
        }
        return;
      }
      if (audio && isThemeEnabledRef.current && !isAnyGameRunning) {
        void audio.play().then(() => {
          if (isAppVisibleRef.current && isThemeEnabledRef.current && !isAnyGameRunning && themeAudioRef.current === audio) {
            fadeManagedAudio(audio, () => themeVolumeRef.current, themeFadeRef);
          }
        }).catch(() => {});
      } else if (!audio) {
        setVisibilityRefreshKey((key) => key + 1);
      }
    });
    return unsubscribe;
  }, [isAnyGameRunning]);

  useEffect(() => {
    if (themeAudioRef.current) themeAudioRef.current.volume = themeVolume;
  }, [themeVolume]);

  const toggleTheme = () => {
    const next = !isThemeEnabled;
    themeSuspendedByGameRef.current = false;
    setIsThemeEnabled(next);
    try {
      localStorage.setItem("flashmanager.themeEnabled", String(next));
    } catch (error) {
      console.error("Save library music playback preference:", error);
      setToast(messages[language].saveFailed);
    }
  };

  const changeThemeVolume = (volume: number) => {
    setThemeVolume(volume);
    try {
      localStorage.setItem("flashmanager.themeVolume", String(volume));
    } catch {}
  };
  const captureGame = library.games.find((game) => game.id === captureQueue[0]) || null;
  const categoryOptions = useMemo(() => {
    const names = library.games.map((game) => game.category).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "en-US"));
  }, [library.games]);

  const tagUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of library.games) {
      for (const tag of game.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return counts;
  }, [library.games]);

  const fuse = useMemo(
    () =>
      new Fuse(library.games, {
        keys: ["title", "tags", "category", "notes", "originalFileName"],
        threshold: 0.34,
        ignoreLocation: true,
      }),
    [library.games],
  );

  const visibleGames = useMemo(() => {
    const source = query.trim() ? fuse.search(query.trim()).map((result) => result.item) : library.games;
    const filtered = source.filter((game) => {
      if (game.onlineOnly && !showOnlineOnlyGames) return false;
      if (filter.type === "favorites") return game.favorite;
      if (filter.type === "category") return game.category === filter.value;
      if (filter.type === "tag") return game.tags.includes(filter.value);
      return true;
    });
    const collator = new Intl.Collator(language, { numeric: true, sensitivity: "base" });
    const compareTitle = (first: Game, second: Game) => collator.compare(first.title, second.title);
    const direction = sortAscending ? 1 : -1;
    if (sortMode === "name") {
      return [...filtered].sort((first, second) => direction * compareTitle(first, second));
    }
    const sortValue = (game: Game) => {
      if (sortMode === "dateAdded") return Date.parse(game.createdAt) || 0;
      if (sortMode === "lastPlayed") return game.lastPlayedAt ? Date.parse(game.lastPlayedAt) || 0 : 0;
      return game.totalPlaySeconds || 0;
    };
    return [...filtered].sort(
      (first, second) => direction * (sortValue(first) - sortValue(second)) || compareTitle(first, second),
    );
  }, [filter, fuse, language, library.games, query, showOnlineOnlyGames, sortAscending, sortMode]);
  const hasOnlineOnlyGames = library.games.some((game) => game.onlineOnly);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!sortControlRef.current?.contains(event.target as Node)) setSortMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sortMenuOpen]);

  const chooseSortMode = (mode: SortMode) => {
    setSortMode(mode);
    setSortMenuOpen(false);
    try {
      localStorage.setItem("flashmanager.sortMode", mode);
    } catch {}
  };

  const toggleSortDirection = () => {
    setSortAscending((ascending) => {
      const next = !ascending;
      try {
        localStorage.setItem("flashmanager.sortAscending", String(next));
      } catch {}
      return next;
    });
  };

  const toggleCardSize = () => setShowCardSize((visible) => !visible);

  const applyLibrary = (state: LibraryState, preferredGameId?: string) => {
    setLibrary(state);
    if (preferredGameId) {
      setSelectedId(preferredGameId);
      return;
    }
    if (selectedId && !state.games.some((game) => game.id === selectedId)) {
      setSelectedId(state.games[0]?.id || null);
    }
  };

  const requestConfirmation = (message: string, confirmLabel: string, cancelLabel?: string) =>
    new Promise<boolean>((resolve) => setConfirmation({ message, confirmLabel, cancelLabel, resolve }));

  const resolveConfirmation = (confirmed: boolean) => {
    const current = confirmation;
    setConfirmation(null);
    current?.resolve(confirmed);
  };

  const requestTextPrompt = (message: string, value: string) =>
    new Promise<string | null>((resolve) => setTextPrompt({ message, value, resolve }));

  const resolveTextPrompt = (value: string | null) => {
    const current = textPrompt;
    setTextPrompt(null);
    current?.resolve(value);
  };

  useDevPreviews({
    language,
    renameMessage: text.newCategoryName,
    showUpdateDialog: setUpdateDialog,
    openMusicImport: () => setMusicImportSelectionOpen(true),
    showImportSummary: setImportSummary,
    showCloseBlocked: (reason) => {
      setCloseBlockedReason(reason);
      setIsCloseBlockedOpen(true);
    },
    requestTextPrompt,
  });

  const updateStartInFullscreen = async (enabled: boolean) => {
    const revision = ++preferenceRevisions.current.fullscreen;
    const previous = startInFullscreen;
    setStartInFullscreen(enabled);
    try {
      const saved = await window.flashApi.setStartInFullscreen(enabled);
      if (revision === preferenceRevisions.current.fullscreen) setStartInFullscreen(saved);
    } catch (error) {
      if (revision === preferenceRevisions.current.fullscreen) setStartInFullscreen(previous);
      setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
    }
  };

  const updateCheckForUpdatesOnStart = async (enabled: boolean) => {
    const revision = ++preferenceRevisions.current.startupUpdates;
    const previous = checkForUpdatesOnStart;
    setCheckForUpdatesOnStart(enabled);
    setIsSavingStartupUpdateCheck(true);
    try {
      const saved = await window.flashApi.setCheckForUpdatesOnStart(enabled);
      if (revision === preferenceRevisions.current.startupUpdates) setCheckForUpdatesOnStart(saved);
    } catch (error) {
      if (revision === preferenceRevisions.current.startupUpdates) setCheckForUpdatesOnStart(previous);
      setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
    } finally {
      if (revision === preferenceRevisions.current.startupUpdates) setIsSavingStartupUpdateCheck(false);
    }
  };

  const updateMinimizeToTrayOnGameLaunch = async (enabled: boolean) => {
    const revision = ++preferenceRevisions.current.launchTray;
    const previous = minimizeToTrayOnGameLaunch;
    setMinimizeToTrayOnGameLaunch(enabled);
    try {
      const saved = await window.flashApi.setMinimizeToTrayOnGameLaunch(enabled);
      if (revision === preferenceRevisions.current.launchTray) setMinimizeToTrayOnGameLaunch(saved);
    } catch (error) {
      if (revision === preferenceRevisions.current.launchTray) setMinimizeToTrayOnGameLaunch(previous);
      setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
    }
  };

  const updateMinimizeToTrayOnMinimize = async (enabled: boolean) => {
    const revision = ++preferenceRevisions.current.minimizeTray;
    const previous = minimizeToTrayOnMinimize;
    setMinimizeToTrayOnMinimize(enabled);
    try {
      const saved = await window.flashApi.setMinimizeToTrayOnMinimize(enabled);
      if (revision === preferenceRevisions.current.minimizeTray) setMinimizeToTrayOnMinimize(saved);
    } catch (error) {
      if (revision === preferenceRevisions.current.minimizeTray) setMinimizeToTrayOnMinimize(previous);
      setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
    }
  };

  const updateExploreEnabled = async (enabled: boolean) => {
    const previous = exploreAvailability;
    ++exploreCheckRef.current;
    setExploreAvailability({ enabled, online: false });
    setCheckingExplore(enabled);
    setExplorePreferenceLoaded(true);
    try {
      await window.flashApi.setExploreEnabled(enabled);
      if (enabled) void refreshExploreAvailability();
    } catch (error) {
      setExploreAvailability(previous);
      setCheckingExplore(false);
      setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
    }
  };

  const handleImportResult = (result: ImportResult) => {
    applyLibrary(result, result.imported?.[0]?.id);
    const imported = result.imported?.length || 0;
    const skipped = result.skipped?.length || 0;
    setToast({ type: "importSummary", imported, skipped });
    // A cancelled file picker returns the plain library, with no import lists.
    if (result.imported || result.skipped || result.cancelled) {
      setImportSummary({ imported: result.imported || [], skipped: result.skipped || [], cancelled: Boolean(result.cancelled) });
    }
  };

  const closeImportSummary = async () => {
    const hasImportedGames = Boolean(importSummary?.imported.length);
    let importedIds = importSummary?.imported.filter((game) => game.format !== "dcr").map((game) => game.id) || [];
    setImportSummary(null);
    try {
      if (hasImportedGames) {
        const settings = await window.flashApi.getFlashpointImportSettings();
        if (settings.metadataAuto) {
          const outcome = await runFlashpointMetadata(language);
          if (outcome.status === "updated") {
            setTaskToast(`${metadataSourceLabels[language].toast} ${outcome.titles.join(", ")}`);
          }
          const refreshed = await window.flashApi.readLibrary();
          setLibrary(refreshed);
          importedIds = importedIds.filter((id) => refreshed.games.some((game) => game.id === id && game.coverStatus === "fallback"));
        }
      }
    } catch (error) {
      console.error("Could not complete metadata after manual import", error);
      setToast(error instanceof Error ? error.message : String(error));
    } finally {
      if (importedIds.length > 0) setCaptureQueue((queue) => [...queue, ...importedIds]);
    }
  };

  const finishImport = () => {
    setImportProgress(null);
    setImportProgressHidden(false);
    setIsCancellingImport(false);
  };

  const cancelImport = () => {
    setIsCancellingImport(true);
    void window.flashApi.cancelImport().catch(() => {});
  };

  const chooseAndImport = async () => {
    if (importProgress) {
      setImportProgressHidden(false);
      return;
    }
    if (!manualImportEnabled) {
      setToast(manualImportLabels[language].disabled);
      return;
    }
    try {
      const files = await navigation.chooseFiles("swf");
      if (!files?.length) return;
      handleImportResult(await window.flashApi.importPaths(files, language));
    } catch (error) {
      setToast(translateError(error instanceof Error ? error.message : "", language, text.importFailed));
    } finally {
      finishImport();
    }
  };

  const updateGame = async (gameId: string, patch: GamePatch) => {
    try {
      const result = await window.flashApi.updateGame(gameId, patch, language);
      setLibrary((current) => ({
        ...current,
        games: current.games.map((game) => (game.id === gameId ? result.game : game)),
      }));
      setToast(text.saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setToast(/Invalid public resource URL|Too many public resource URLs/.test(message)
        ? compatibilitySettingsLabels[language].invalidResource
        : translateError(message, language, text.saveFailed));
    }
  };

  const deleteGame = async (game: Game) => {
    const removeFiles = await requestConfirmation(
      text.deleteConfirm.replace("{title}", game.title),
      confirmationActionLabels[language].delete,
    );
    if (!removeFiles) return;
    const alsoFiles = await requestConfirmation(
      text.deleteFilesConfirm,
      confirmationActionLabels[language].deleteFiles,
      confirmationActionLabels[language].keepFiles,
    );
    try {
      applyLibrary(await window.flashApi.deleteGame(game.id, alsoFiles));
      setToast(text.deleted);
    } catch (error) {
      setToast(translateError(error instanceof Error ? error.message : "", language, text.deleteFailed));
    }
  };

  const togglePlay = (game: Game) => {
    if (runningGameIds.includes(game.id)) {
      void window.flashApi.closePlayer(game.id).catch(() => {});
      return;
    }
    void playGame(game);
  };

  const detailsResizerRef = useRef<HTMLDivElement>(null);
  const gameGridRef = useRef<GameGridHandle>(null);
  useLayoutEffect(() => {
    if (!showDetailsPanel) return;
    if (selectedId) gameGridRef.current?.revealGame(selectedId);
  }, [showDetailsPanel]);

  useEffect(() => {
    const resizer = detailsResizerRef.current;
    if (!resizer) return;
    const restore = (event: Event) => {
      const width = clampDetailsWidth(Number((event as CustomEvent<number>).detail) || detailsWidthLimits.default);
      setDetailsWidth(width);
    };
    resizer.addEventListener("controller-resize-cancel", restore);
    return () => resizer.removeEventListener("controller-resize-cancel", restore);
  }, [showDetailsPanel]);

  const sidebarResizerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const resizer = sidebarResizerRef.current;
    if (!resizer) return;
    const restore = (event: Event) => {
      const width = clampSidebarWidth(Number((event as CustomEvent<number>).detail) || sidebarWidthLimits.default);
      setSidebarWidth(width);
    };
    resizer.addEventListener("controller-resize-cancel", restore);
    return () => resizer.removeEventListener("controller-resize-cancel", restore);
  }, []);

  useEffect(() => {
    const launch = () => {
      const focusedId = document.documentElement.classList.contains("controller-navigation-active")
        ? document.querySelector<HTMLElement>(".game-card[data-controller-focused]")?.dataset.gameId
        : undefined;
      const game = library.games.find(game => game.id === focusedId) ?? selectedGame;
      if (game) void playGame(game);
    };
    window.addEventListener("controller-launch-selected", launch);
    return () => window.removeEventListener("controller-launch-selected", launch);
  });

  const playGame = async (game: Game) => {
    try {
      const open = () => window.flashApi.openPlayer(
        {
          id: game.id,
          title: game.title,
          swfUrl: game.swfUrl,
          stageWidth: game.stageWidth,
          stageHeight: game.stageHeight,
          fullscreenByDefault: Boolean(game.fullscreenByDefault),
        },
        language,
      );
      const launched = game.onlineOnly
        ? await outsideControllerApp(() => window.flashApi.openOnlineOnlyGame(game.id, language), "onlineGame")
        : isExternalGamePlayer(game, gamePlayers)
          ? await outsideControllerApp(async () => { await open(); }, "externalPlayer")
          : (await open(), true);
      if (!launched) return;
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "") : "";
      if (message.includes("FLASH_ROYALE_QUARANTINED")) {
        setToast(antivirusLabels[language].launchBlocked.replace("{title}", game.title));
        void window.flashApi.readLibrary().then(setLibrary).catch(() => {});
        return;
      }
      setToast(translateError(message, language, text.gameLoadFailed));
      return;
    }
    try {
      const updated = await window.flashApi.recordPlay(game.id);
      setLibrary((state) => ({
        ...state,
        games: state.games.map((item) => (item.id === updated.id ? updated : item)),
      }));
    } catch {
      setToast(text.playRecordFailed);
    }
  };

  const renameTag = async (tag: string) => {
    const next = await requestTextPrompt(text.newTagName, tag);
    if (!next || next.trim() === tag) return;
    applyLibrary(await window.flashApi.renameTag(tag, next.trim()));
    setToast(text.tagRenamed);
  };

  const deleteTag = async (tag: string) => {
    const confirmed = await requestConfirmation(
      text.removeTagConfirm.replace("{tag}", tag),
      confirmationActionLabels[language].delete,
    );
    if (!confirmed) return;
    applyLibrary(await window.flashApi.deleteTag(tag));
    setToast(text.tagRemoved);
  };

  const renameCategory = async (category: string) => {
    const next = await requestTextPrompt(text.newCategoryName, category);
    if (!next || next.trim() === category) return;
    applyLibrary(await window.flashApi.renameCategory(category, next.trim(), language));
    setToast(text.categoryRenamed);
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (importProgress) {
      setImportProgressHidden(false);
      return;
    }
    if (!manualImportEnabled) {
      setToast(manualImportLabels[language].disabled);
      return;
    }
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.flashApi.getPathForFile(file))
      .filter((value): value is string => Boolean(value));
    if (paths.length === 0) {
      setToast(text.noDropPath);
      return;
    }
    try {
      handleImportResult(await window.flashApi.importPaths(paths, language));
    } catch (error) {
      setToast(translateError(error instanceof Error ? error.message : "", language, text.dragImportFailed));
    } finally {
      finishImport();
    }
  };

  const recaptureCover = (game: Game) => {
    setCaptureQueue((queue) => (queue.includes(game.id) ? queue : [...queue, game.id]));
  };

  const onCaptureDone = (gameId: string, updated?: Game) => {
    setCaptureQueue((queue) => queue.filter((id) => id !== gameId));
    if (updated) {
      setLibrary((state) => ({
        ...state,
        games: state.games.map((game) => (game.id === updated.id ? updated : game)),
      }));
      setToast({ type: "coverCreated", title: updated.title });
    }
  };

  const updateSavedCover = (updated: Game) => {
    setLibrary((state) => ({
      ...state,
      games: state.games.map((game) => (game.id === updated.id ? updated : game)),
    }));
  };

  const chooseManualCover = async (game: Game) => {
    try {
      const files = await navigation.chooseFiles("cover");
      if (!files?.length) return;
      const updated = await window.flashApi.chooseCoverImage(game.id, language, files[0]);
      updateSavedCover(updated);
      setToast(updated.coverStatus === "custom" ? text.customCoverUpdated : text.originalCoverKept);
    } catch (error) {
      setToast(translateError(error instanceof Error ? error.message : "", language, text.chooseCoverFailed));
    }
  };

  const applyCustomMusicChange = async (game: Game, change: () => Promise<Game>) => {
    try {
      const updated = await change();
      setLibrary((current) => ({
        ...current,
        games: current.games.map((item) => (item.id === updated.id ? updated : item)),
      }));
      themeCacheRef.current.delete(game.id);
      setThemeReloadKey((key) => key + 1);
    } catch (error) {
      setToast(translateError(error instanceof Error ? error.message : "", language, musicLabels[language].failed));
    }
  };

  const chooseCustomMusic = async (game: Game) => {
    const files = await navigation.chooseFiles("music");
    if (!files?.length) return;
    return applyCustomMusicChange(game, () => window.flashApi.chooseCustomMusic(game.id, language, files[0]));
  };

  const removeCustomMusic = (game: Game) => applyCustomMusicChange(game, () => window.flashApi.removeCustomMusic(game.id));

  const selectDefaultMusic = async (game: Game, index: number) => {
    try {
      const updated = await window.flashApi.setDefaultMusic(game.id, index);
      setLibrary((current) => ({
        ...current,
        games: current.games.map((item) => (item.id === updated.id ? updated : item)),
      }));
      // A custom file still takes priority, so only reload when the built-in track is what plays.
      if (!updated.customMusic) {
        themeCacheRef.current.delete(game.id);
        setThemeReloadKey((key) => key + 1);
      }
    } catch (error) {
      setToast(translateError(error instanceof Error ? error.message : "", language, musicLabels[language].failed));
    }
  };

  const selectedMusicTracks = musicCandidates && musicCandidates.gameId === selectedId ? musicCandidates.durations : [];

  const musicDescription = !selectedGame || themeInfo?.gameId !== selectedId
    ? "…"
    : !selectedTheme
      ? musicLabels[language].none
      : selectedTheme.source === "custom"
        ? selectedTheme.fileName || ""
        : `${musicLabels[language].builtIn.replace("{file}", selectedGame.originalFileName)}${
            selectedMusicTracks.length > 1
              ? ` · ${musicLabels[language].track.replace("{n}", String((selectedTheme.trackIndex ?? 0) + 1))}`
              : ""
          }`;

  const resizeDetailsFromPointer = (clientX: number) => {
    const bounds = appRef.current?.getBoundingClientRect();
    if (!bounds) return detailsWidth;
    const width = clampDetailsWidth(language === "ar" ? clientX - bounds.left : bounds.right - clientX);
    setDetailsWidth(width);
    return width;
  };

  const resizeSidebarFromPointer = (clientX: number) => {
    const bounds = appRef.current?.getBoundingClientRect();
    if (!bounds) return sidebarWidth;
    const width = clampSidebarWidth(language === "ar" ? bounds.right - clientX : clientX - bounds.left);
    setSidebarWidth(width);
    return width;
  };

  const toastText =
    typeof toast === "string"
      ? toast
      : toast.type === "exploreImported"
        ? `${importCountLabels[language].imported} ${toast.title}`
      : toast.type === "appStarted" || toast.type === "coversFinished"
        ? toastLabels[language][toast.type]
        : toast.type === "gameStarted" || toast.type === "gameStopped" || toast.type === "coverCreated"
          ? toastLabels[language][toast.type].replace("{title}", toast.title)
          : null;
  useEffect(() => {
    if (toastText === null || typeof toast === "object" && (toast.type === "exploreImported" || toast.type === "coversFinished")) return;
    if (typeof toast === "object" && toast.type === "appStarted") {
      if (startupRecordedRef.current) return;
      startupRecordedRef.current = true;
    }
    if (taskToastRef.current === toast) return;
    void window.flashApi.noteHistory(toastText).catch(() => {});
  }, [toast]);
  const attributionParts = settingsInfoLabels[language].originallyMadeBy.split("xevil3301");
  const activity = currentActivity(activityEntries);
  const activityDescription = activity ? describeActivity(activity, historyLabels[language]) : null;
  const activityText = activityDescription ? [
    activityDescription.name,
    activity?.title,
    activityDescription.summary,
    activity && activity.kind !== "notice" ? historyLabels[language].status[activity.status] : "",
  ].filter(Boolean).join(" · ") : null;
  const pillText = activityText ?? toastText;
  const exploreLabels = exploreSettingsLabels[language];
  const exploreTooltip = !exploreAvailability.enabled ? exploreLabels.disabled
    : checkingExplore ? exploreLabels.checking
    : exploreAvailability.online ? exploreLabels.open : exploreLabels.offline;

  return (
    <div
      ref={appRef}
      className={`app${isDragging ? " drag-active" : ""}${showDetailsPanel ? "" : " details-collapsed"}${isResizingDetails ? " resizing-details" : ""}${isResizingSidebar ? " resizing-sidebar" : ""}`}
      style={{ "--details-width": `${detailsWidth}px`, "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
      dir={language === "ar" ? "rtl" : "ltr"}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        if (!manualImportEnabled) {
          event.dataTransfer.dropEffect = "none";
          return;
        }
        event.dataTransfer.dropEffect = "copy";
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        // Moving onto a child also fires dragleave; only hide once the drag leaves the window.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
      }}
      onDrop={onDrop}
    >
      <Sidebar
        games={library.games}
        filter={filter}
        setFilter={setFilter}
        onRenameTag={renameTag}
        onDeleteTag={deleteTag}
        onRenameCategory={renameCategory}
        onOpenSettings={() => setSettingsOpen(true)}
        language={language}
      />

      <div
        className="panel-resizer sidebar-resizer"
        ref={sidebarResizerRef}
        role="separator"
        aria-orientation="vertical"
        aria-label={detailPanelLabels[language].resizeSidebar}
        aria-valuemin={sidebarWidthLimits.min}
        aria-valuemax={sidebarWidthLimits.max}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setIsResizingSidebar(true);
        }}
        onPointerMove={(event) => {
          if (isResizingSidebar) resizeSidebarFromPointer(event.clientX);
        }}
        onPointerUp={(event) => {
          if (!isResizingSidebar) return;
          setIsResizingSidebar(false);
          resizeSidebarFromPointer(event.clientX);
        }}
        onPointerCancel={() => {
          setIsResizingSidebar(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const grows = (event.key === "ArrowRight") !== (language === "ar");
          const width = clampSidebarWidth(sidebarWidth + (grows ? 16 : -16));
          setSidebarWidth(width);
        }}
      />

      <main className="content" data-controller-region="">
        <header className="topbar">
          <div className="searchbox">
            <Search size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.searchPlaceholder}
            />
            {query && (
              <button className="icon small" onClick={() => setQuery("")} title={text.clearSearch}>
                <X size={15} />
              </button>
            )}
          </div>
          <div className="topbar-actions">
            {manualImportEnabled && <button className="primary" onClick={chooseAndImport}>
              <Download size={18} />
              {importGameLabels[language].button}
            </button>}
            {explorePreferenceLoaded && exploreAvailability.enabled && (
              <span className="explore-action" title={exploreTooltip}>
                <button
                  className="primary explore-button"
                  data-controller-action="explore"
                  onClick={() => void window.flashApi.openExplore().catch((error) => {
                    setToast(String(error));
                    void refreshExploreAvailability();
                  })}
                  aria-label={exploreTooltip}
                  disabled={!exploreAvailability.online || checkingExplore}
                >
                  <Compass size={18} />
                  {exploreLabels.button}
                </button>
              </span>
            )}
            {!showDetailsPanel && (
              <PlayToggleButton
                className="play-selected"
                fixedWidth
                isRunning={Boolean(selectedGame && runningGameIds.includes(selectedGame.id))}
                onClick={() => selectedGame && togglePlay(selectedGame)}
                disabled={!selectedGame}
                language={language}
              />
            )}
            <button
              className="icon"
              onClick={(event) => {
                if (document.documentElement.classList.contains("controller-navigation-active")) {
                  // Opening with the controller's game info shortcut focuses the panel's Play button.
                  const focusPlay = () => {
                    if (!event.currentTarget.hasAttribute("data-controller-shortcut")) return;
                    requestAnimationFrame(() => {
                      const play = document.querySelector<HTMLElement>("aside.game-info-panel .detail-actions > button.primary");
                      if (play) focusControl(play);
                    });
                  };
                  const focusedId = document.querySelector<HTMLElement>(".game-card[data-controller-focused]")?.dataset.gameId;
                  if (focusedId && library.games.some(game => game.id === focusedId)) {
                    setSelectedId(focusedId);
                    if (focusedId !== selectedId) {
                      setShowDetailsPanel(true);
                      focusPlay();
                      return;
                    }
                  }
                  // Closing from inside the panel returns focus to its game, like B does.
                  if (showDetailsPanel && selectedId && document.activeElement?.closest("aside.details")) {
                    const gameId = selectedId;
                    setShowDetailsPanel(false);
                    gameGridRef.current?.revealGame(gameId, true);
                    return;
                  }
                  if (!showDetailsPanel) {
                    setShowDetailsPanel(true);
                    if (focusedId) focusPlay();
                    return;
                  }
                }
                setShowDetailsPanel((visible) => !visible);
              }}
              data-controller-action="gameInfo"
              title={showDetailsPanel ? detailPanelLabels[language].hide : detailPanelLabels[language].show}
              aria-label={showDetailsPanel ? detailPanelLabels[language].hide : detailPanelLabels[language].show}
              aria-pressed={showDetailsPanel}
            >
              {showDetailsPanel ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
            </button>
          </div>
        </header>

        <section className="library-info">
          <div className="library-stat" title={text.currentResults}>
            <strong>{visibleGames.length}</strong>
            <span>{text.currentResults}</span>
          </div>
          <div className="library-stat" title={text.gamesInLibrary}>
            <strong>{library.games.length}</strong>
            <span>{text.gamesInLibrary}</span>
          </div>
          <div className="sort-control" ref={sortControlRef}>
            <button
              className={sortMenuOpen ? "icon active" : "icon"}
              onClick={() => setSortMenuOpen((open) => !open)}
              title={`${sortLabels[language].sort}: ${sortLabels[language][sortMode]}`}
              aria-label={`${sortLabels[language].sort}: ${sortLabels[language][sortMode]}`}
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
            >
              <ArrowDownUp size={18} />
            </button>
            {sortMenuOpen && (
              <div className="sort-menu" role="menu" aria-label={sortLabels[language].sort}>
                {sortModes.map((mode) => (
                  <div className="sort-menu-option" role="none" key={mode}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={mode === sortMode}
                      className={mode === sortMode ? "category-option active" : "category-option"}
                      onClick={() => chooseSortMode(mode)}
                    >
                      <span>{sortLabels[language][mode]}</span>
                    </button>
                    {mode === sortMode && (
                      <button
                        type="button"
                        className="icon small sort-direction"
                        title={sortAscending ? sortLabels[language].ascending : sortLabels[language].descending}
                        aria-label={sortAscending ? sortLabels[language].ascending : sortLabels[language].descending}
                        onClick={toggleSortDirection}
                      >
                        {sortAscending ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                      </button>
                    )}
                  </div>
                ))}
                {hasOnlineOnlyGames && <>
                  <div className="sort-menu-divider" role="separator" />
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showOnlineOnlyGames}
                    className="category-option sort-menu-filter"
                    onClick={() => {
                      const enabled = !showOnlineOnlyGames;
                      setShowOnlineOnlyGames(enabled);
                      try { localStorage.setItem("flashmanager.showOnlineOnlyGames", String(enabled)); } catch {}
                    }}
                  >
                    <span className="sort-menu-checkbox" aria-hidden="true">{showOnlineOnlyGames && <Check size={13} />}</span>
                    <span>{showOnlineOnlyGamesLabels[language]}</span>
                  </button>
                </>}
              </div>
            )}
          </div>
          <div className="library-view-controls">
            {libraryMusicEnabled && <div className="theme-control">
              <button
                className={isThemeEnabled ? "icon active" : "icon"}
                onClick={toggleTheme}
                title={isThemeEnabled ? libraryMusicPlaybackLabels[language].pause : libraryMusicPlaybackLabels[language].resume}
                aria-label={isThemeEnabled ? libraryMusicPlaybackLabels[language].pause : libraryMusicPlaybackLabels[language].resume}
                aria-pressed={isThemeEnabled}
              >
                <Music size={18} />
              </button>
              {isThemeEnabled && isThemePlaying && selectedTheme && !isAnyGameRunning && (
                <div className="theme-volume">
                  <div className="theme-volume-panel">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(themeVolume * 100)}
                      aria-label={themeLabels[language].volume}
                      aria-valuetext={`${Math.round(themeVolume * 100)}%`}
                      title={`${themeLabels[language].volume}: ${Math.round(themeVolume * 100)}%`}
                      onChange={(event) => changeThemeVolume(Number(event.target.value) / 100)}
                    />
                    <output className="theme-volume-value">{Math.round(themeVolume * 100)}%</output>
                  </div>
                </div>
              )}
            </div>}
            <button
              className={showCardSize ? "icon active" : "icon"}
              onClick={toggleCardSize}
              title={showCardSize ? cardSizeToggleLabels[language].hide : cardSizeToggleLabels[language].show}
              aria-label={showCardSize ? cardSizeToggleLabels[language].hide : cardSizeToggleLabels[language].show}
              aria-pressed={showCardSize}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
          <div ref={locationRef} className={showCardSize ? "library-location-controls" : "library-location-controls centered"}>
            {showCardSize && (
            <label className="card-size-control">
              <span>{cardSizeLabels[language]}</span>
              <span className="card-size-range-row">
                <input
                  type="range"
                  min={0}
                  max={gameCardWidths.length - 1}
                  step={1}
                  value={cardSizeIndex}
                  aria-label={cardSizeLabels[language]}
                  aria-valuetext={`${gameCardWidths[cardSizeIndex]} px`}
                  onChange={(event) => {
                    const nextIndex = Number(event.target.value);
                    setCardSizeIndex(nextIndex);
                    try {
                      localStorage.setItem("flashmanager.cardSizeIndex", String(nextIndex));
                    } catch {}
                  }}
                />
                <output>{gameCardWidths[cardSizeIndex]} px</output>
              </span>
            </label>
            )}
            {showCardSize && pathVisible && <span className="library-controls-separator" aria-hidden="true" />}
            {pathVisible && <p ref={pathRef} title={library.libraryRoot}>{text.libraryDirectory}: {library.libraryRoot || text.initializing}</p>}
          </div>
          <button
            type="button"
            className="toast"
            title={[pillText, historyLabels[language].openHint].filter(Boolean).join("\n")}
            aria-label={[pillText, historyLabels[language].openHint].filter(Boolean).join(" — ")}
            onClick={() => void window.flashApi.openHistory(language).catch(() => {})}
          >
            <History className="toast-icon" size={14} aria-hidden="true" />
            {pillText !== null ? (
              <span className="toast-copy">{pillText}</span>
            ) : typeof toast === "object" && toast.type === "importSummary" ? (
              <>
                <span className="toast-segment">
                  <span className="toast-copy">{importCountLabels[language].imported} {toast.imported}</span>
                </span>
                <span className="toast-divider" aria-hidden="true" />
                <span className="toast-segment">
                  <span className="toast-copy">{importCountLabels[language].skipped} {toast.skipped}</span>
                </span>
              </>
            ) : null}
          </button>
        </section>

        <VirtualGameGrid
          ref={gameGridRef}
          games={visibleGames}
          cardWidth={gameCardWidths[cardSizeIndex]}
          measurementKey={`${language}:${JSON.stringify(gameCardPreferences)}`}
          selectedId={selectedId}
          onDeselect={() => setSelectedId(null)}
          renderGame={(game) => (
            <GameCard
              key={game.id}
              game={game}
              selected={game.id === selectedId}
              onSelect={() => {
                setSelectedId((current) =>
                  document.documentElement.classList.contains("controller-navigation-active") && current === game.id ? null : game.id
                );
              }}
              language={language}
              showFavoriteBadge={filter.type !== "favorites"}
              preferences={gameCardPreferences}
              tagUsage={tagUsage}
              cardWidth={gameCardWidths[cardSizeIndex]}
            />
          )}
          emptyState={
            <div className="empty-state">
              <Plus size={36} />
              <strong>{text.emptyLibrary}</strong>
              <span>{importGameLabels[language].emptyHint}</span>
            </div>
          }
        />
      </main>

      {showDetailsPanel && (
        <div
          className="panel-resizer details-resizer"
          ref={detailsResizerRef}
          role="separator"
          aria-orientation="vertical"
          aria-label={detailPanelLabels[language].resize}
          aria-valuemin={detailsWidthLimits.min}
          aria-valuemax={detailsWidthLimits.max}
          aria-valuenow={detailsWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsResizingDetails(true);
          }}
          onPointerMove={(event) => {
            if (isResizingDetails) resizeDetailsFromPointer(event.clientX);
          }}
          onPointerUp={(event) => {
            if (!isResizingDetails) return;
            setIsResizingDetails(false);
            resizeDetailsFromPointer(event.clientX);
          }}
          onPointerCancel={() => {
            setIsResizingDetails(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const grows = (event.key === "ArrowLeft") !== (language === "ar");
            const width = clampDetailsWidth(detailsWidth + (grows ? 16 : -16));
            setDetailsWidth(width);
          }}
        />
      )}

      {showDetailsPanel && (
        <GameDetailsSidebar
          game={selectedGame}
          categories={categoryOptions}
          onPatch={updateGame}
          onClosePanel={(gameId) => {
            setShowDetailsPanel(false);
            gameGridRef.current?.revealGame(gameId, true);
          }}
          onDelete={deleteGame}
          onPlay={togglePlay}
          isRunning={Boolean(selectedGame && runningGameIds.includes(selectedGame.id))}
          onManualCover={chooseManualCover}
          onChooseMusic={chooseCustomMusic}
          onRemoveMusic={removeCustomMusic}
          onMusicChanged={(gameId) => {
            themeCacheRef.current.delete(gameId);
            musicCandidatesCacheRef.current.delete(gameId);
            setThemeReloadKey(key => key + 1);
          }}
          musicDescription={musicDescription}
          hasMusic={Boolean(selectedTheme)}
          libraryMusicEnabled={libraryMusicEnabled}
          musicTracks={selectedMusicTracks}
          setFilter={setFilter}
          onSelectDefaultMusic={selectDefaultMusic}
          onRecaptureCover={recaptureCover}
          isCapturingCover={Boolean(selectedGame && captureQueue.includes(selectedGame.id))}
          language={language}
        />
      )}

      <CoverCapture game={captureGame} onDone={onCaptureDone} language={language} />
      {musicImportSelectionOpen && <MusicImportDialog
        games={library.games.filter(game => !game.onlineOnly)}
        language={language}
        onCancel={() => setMusicImportSelectionOpen(false)}
        onImport={gameIds => {
          setMusicImportSelectionOpen(false);
          void importLibraryMusic(true, gameIds);
        }}
      />}

      {settingsOpen && (
        <div
          className="modal-backdrop settings-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            ref={settingsPanelRef}
            className="settings-window settings-tabbed"
            data-controller-navigation="grid"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <header>
              <h2
                ref={settingsTitleRef}
                id="settings-title"
                className="settings-heading"
                role="button"
                data-controller-move=""
                tabIndex={0}
                aria-label={`${text.settings}. ${panelMoveLabels[language]}`}
                onKeyDown={moveSettingsByKeyboard}
                onPointerDown={startSettingsDrag}
                onPointerMove={dragSettingsPanel}
                onPointerUp={endSettingsDrag}
                onPointerCancel={endSettingsDrag}
                onLostPointerCapture={() => { settingsDrag.current = null; }}
              >
                <Move size={16} aria-hidden="true" />
                <span>{text.settings}</span>
              </h2>
              <ControllerHintsSlot className="player-controller-hints" />
              <button type="button" className="icon" data-controller-back="" onClick={() => setSettingsOpen(false)} title={text.close} aria-label={text.close}>
                <X size={19} />
              </button>
            </header>
            <SettingsSections activeTab={settingsTab}>
            <div className="settings-tab-layout">
            <SettingsSidebar label={detailPanelLabels[language].resizeSidebar}>
            <div className="settings-sidebar-scroll">
            <nav className="settings-tab-sidebar" role="tablist" aria-orientation="vertical" aria-label={text.settings}
              onKeyDown={(event) => {
                if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
                const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']"));
                const index = tabs.indexOf(event.target as HTMLButtonElement);
                if (index < 0) return;
                event.preventDefault();
                event.stopPropagation();
                const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
                  : (index + (event.key === "ArrowDown" ? 1 : -1) + tabs.length) % tabs.length;
                tabs[next].focus();
                tabs[next].click();
              }}>
              {[
                { id: "general", label: generalSettingsLabels[language].general, Icon: SlidersHorizontal },
                { id: "appearance", label: settingsSectionLabels[language].appearance, Icon: Paintbrush },
                { id: "controllers", label: remapLabels[language].controllers, Icon: Gamepad2 },
                { id: "players", label: playerLabels[language].title, Icon: MonitorPlay },
                { id: "sources", label: sourcesLabels[language].title, Icon: Layers },
                { id: "antivirus", label: antivirusLabels[language].title, Icon: ScanSearch },
                { id: "security", label: securityLabels[language].title, Icon: ShieldCheck },
                { id: "about", label: settingsInfoLabels[language].about, Icon: Info },
              ].map(({ id, label, Icon }) => <div key={id} className="settings-tab-entry">
              <button type="button" role="tab"
                id={`settings-tab-${id}`} aria-controls={`settings-page-${id}`}
                aria-selected={settingsTab === id} onClick={() => setSettingsTab(id)}>
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
              <SettingsSectionLinks tab={id} />
              </div>)}
            </nav>
            </div>
            <label className="settings-field settings-sidebar-language">
              <span>{text.language}</span>
              <div className={languageMenuOpen ? "settings-select-wrap open" : "settings-select-wrap"}>
                <select
                  value={language}
                  onMouseDown={() => setLanguageMenuOpen((open) => !open)}
                  onKeyDown={(event) => {
                    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) setLanguageMenuOpen(true);
                    if (["Escape", "Tab"].includes(event.key)) setLanguageMenuOpen(false);
                  }}
                  onBlur={() => setLanguageMenuOpen(false)}
                  onChange={(event) => {
                    setLanguage(event.target.value as Language);
                    setLanguageMenuOpen(false);
                  }}
                >
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value} lang={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
              </div>
            </label>
            <div className="settings-sidebar-actions" role="group" aria-labelledby="settings-actions-title">
              <span className="settings-sidebar-actions-title" id="settings-actions-title">{updateActionLabels[language]}</span>
              <button type="button" className="secondary update-check-button" disabled={isCheckingForUpdates} onClick={() => void runUpdateCheck(true)}>
                <RefreshCw size={18} aria-hidden="true" />
                {isCheckingForUpdates ? updateLabels[language].checking : updateLabels[language].check}
              </button>
              <button type="button" className="secondary settings-close-app" onClick={() => window.close()}>
                <X size={18} aria-hidden="true" />
                {text.close} Flash Royale
              </button>
            </div>
            </SettingsSidebar>
            <div className="settings-tab-content">
            <div className="settings-tab-page settings-general-page" role="tabpanel" id="settings-page-general" aria-labelledby="settings-tab-general" hidden={settingsTab !== "general"}>
            <SettingsSectionTab tab="general">
            <section className="settings-general settings-general-options" aria-label={text.settings}>
              <details className="settings-controller-collapse general-settings" open>
                <summary>
                  <span className="controller-summary-title">
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    <span>{generalSettingsLabels[language].general}</span>
                  </span>
                </summary>
                <section className="settings-controller-subsection" aria-label={generalSettingsLabels[language].general}>
              <SettingsSection title={settingsSectionLabels[language].startup} icon={MonitorPlay}>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={startInFullscreen}
                  onChange={(event) => void updateStartInFullscreen(event.target.checked)}
                />
                <span>{generalSettingsLabels[language].startInFullscreen}</span>
              </label>
              <small>{generalSettingsLabels[language].nextLaunch}</small>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={checkForUpdatesOnStart === true}
                  disabled={checkForUpdatesOnStart === null || isSavingStartupUpdateCheck}
                  onChange={(event) => void updateCheckForUpdatesOnStart(event.target.checked)}
                />
                <span>{startupUpdateCheckLabels[language]}</span>
              </label>
              <small>{settingsHelp[language].startupUpdate}</small>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={minimizeToTrayOnGameLaunch}
                  onChange={(event) => void updateMinimizeToTrayOnGameLaunch(event.target.checked)}
                />
                <span>{generalSettingsLabels[language].minimizeToTrayOnGameLaunch}</span>
              </label>
              <small>{settingsHelp[language].launchTray}</small>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={minimizeToTrayOnMinimize}
                  onChange={(event) => void updateMinimizeToTrayOnMinimize(event.target.checked)}
                />
                <span>{generalSettingsLabels[language].minimizeToTrayOnMinimize}</span>
              </label>
              <small>{settingsHelp[language].minimizeTray}</small>
              </SettingsSection>
              <SettingsSection title={settingsSectionLabels[language].library} icon={Layers}>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={manualImportEnabled}
                  disabled={!manualImportPreferenceLoaded}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    void window.flashApi.setManualImportEnabled(enabled).then((saved) => {
                      setManualImportEnabled(saved);
                      if (!saved) setIsDragging(false);
                    }).catch((error) => {
                      console.error("Could not save manual import preference", error);
                      setToast(text.saveFailed);
                    });
                  }}
                />
                <span>{manualImportLabels[language].enable}</span>
              </label>
              <small>{settingsHelp[language].manualImport}</small>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={exploreAvailability.enabled}
                  onChange={(event) => void updateExploreEnabled(event.target.checked)}
                />
                <span>{exploreLabels.enable}</span>
              </label>
              <small>{settingsHelp[language].explore}</small>
              <label className="settings-toggle">
                <input type="checkbox" checked={showLibraryPath} onChange={(event) => setShowLibraryPath(event.target.checked)} />
                <span>{libraryPathLabels[language].enable}</span>
              </label>
              <small>{libraryPathLabels[language].description}</small>
              <GameCardSettings language={language} preferences={gameCardPreferences} onChange={updateGameCardPreferences} />
              </SettingsSection>
              <SettingsSection title={defaultMusicLabels[language].title} icon={Music}>
              <label className="settings-toggle">
                <input type="checkbox" checked={libraryMusicEnabled} disabled={!libraryMusicReady} onChange={(event) => {
                  const enabled = event.target.checked;
                  setLibraryMusicReady(false);
                  void window.flashApi.setLibraryMusicEnabled(enabled).then(saved => setLibraryMusicEnabled(saved)).catch(error => {
                    console.error("Save library music preference:", error);
                    setToast(text.saveFailed);
                  }).finally(() => setLibraryMusicReady(true));
                }} />
                <span>{libraryMusicLabels[language].global}</span>
              </label>
              <small>{libraryMusicLabels[language].help}</small>
              <label className="settings-toggle">
                <input type="checkbox" checked={importDefaultMusic} disabled={!defaultMusicReady || importingMusic} onChange={(event) => {
                  const enabled = event.target.checked;
                  setDefaultMusicReady(false);
                  void window.flashApi.setImportDefaultMusic(enabled).then(setImportDefaultMusic).catch(error => {
                    console.error("Save default music import preference:", error);
                    setToast(text.saveFailed);
                  }).finally(() => setDefaultMusicReady(true));
                }} />
                <span>{defaultMusicLabels[language].enable}</span>
              </label>
              <small>{defaultMusicLabels[language].help}</small>
              <div className="music-actions">
                <button type="button" className="secondary" disabled={importingMusic} onClick={() => void importLibraryMusic(false)}>{defaultMusicLabels[language].missing}</button>
                <button type="button" className="secondary" disabled={importingMusic || !library.games.some(game => !game.onlineOnly)} onClick={() => setMusicImportSelectionOpen(true)}>{defaultMusicLabels[language].all}</button>
              </div>
              {/* Normalization relies on Windows-only Python/FFmpeg tools, and Proton's container cannot run Linux ones. */}
              {!window.flashApi.inputRuntime?.wine && <MusicNormalizationSettings language={language} onMusicChanged={() => {
                for (const game of library.games) themeCacheRef.current.delete(game.id);
                setThemeReloadKey(key => key + 1);
              }} />}
              </SettingsSection>
              <GlobalCrtSettings language={language} />
              <SettingsSection title={settingsSectionLabels[language].input} icon={Gamepad2}>
              <NativeControllerInputSetting language={language} />
              <ControllerNavigationToggle language={language} />
              </SettingsSection>
                </section>
              </details>
            </section>
            </SettingsSectionTab>
            </div>
            <div className="settings-tab-page" role="tabpanel" id="settings-page-appearance" aria-labelledby="settings-tab-appearance" hidden={settingsTab !== "appearance"}>
              <SettingsSectionTab tab="appearance">
              <ThemeSettingsPanel language={language} />
              <CursorSettingsPanel language={language} expanded />
              </SettingsSectionTab>
            </div>
            <div className="settings-tab-page" role="tabpanel" id="settings-page-controllers" aria-labelledby="settings-tab-controllers" hidden={settingsTab !== "controllers"}>
              <SettingsSectionTab tab="controllers">
                <SettingsSection title={remapLabels[language].playerAssignments} icon={Users}>
                  <ControllerAssignmentsSettings language={language} />
                </SettingsSection>
                <SettingsSection title={remapLabels[language].controllerNames} icon={ContactRound}>
                  <ControllerNamesSettings language={language} />
                </SettingsSection>
                <ControllerNavigationSettings language={language} />
                <SettingsSection title={onscreenLabels(language).title} icon={Hand}>
                  <OnscreenSettings language={language} />
                </SettingsSection>
              </SettingsSectionTab>
            </div>
            <div className="settings-tab-page" role="tabpanel" id="settings-page-players" aria-labelledby="settings-tab-players" hidden={settingsTab !== "players"}>
              <SettingsSectionTab tab="players">
              <PlayersSettingsSection language={language} expanded />
              </SettingsSectionTab>
            </div>
            <div className="settings-tab-page" role="tabpanel" id="settings-page-sources" aria-labelledby="settings-tab-sources" hidden={settingsTab !== "sources"}>
              <SettingsSectionTab tab="sources">
              <SourcesSettingsSection language={language} expanded />
              </SettingsSectionTab>
            </div>
            <div className="settings-tab-page" role="tabpanel" id="settings-page-antivirus" aria-labelledby="settings-tab-antivirus" hidden={settingsTab !== "antivirus"}>
              <SettingsSectionTab tab="antivirus">
              <AntivirusSettingsSection language={language} requestConfirmation={requestConfirmation} expanded />
              </SettingsSectionTab>
            </div>
            <div className="settings-tab-page" role="tabpanel" id="settings-page-security" aria-labelledby="settings-tab-security" hidden={settingsTab !== "security"}>
              <SettingsSectionTab tab="security">
              <SecuritySettingsSection language={language} expanded />
              </SettingsSectionTab>
            </div>
            <div className="settings-tab-page" role="tabpanel" id="settings-page-about" aria-labelledby="settings-tab-about" hidden={settingsTab !== "about"}>
              <SettingsSectionTab tab="about">
              <section className="settings-about" aria-label={settingsInfoLabels[language].about}>
                {appInfo && <>
                <SettingsSection title={settingsOverviewLabels[language]} icon={FileText}>
                <dl className="settings-info">
                  <div>
                    <dt>{settingsInfoLabels[language].author}</dt>
                    <dd>
                      {window.flashApi.openAuthorProfile ? <a
                        href={`https://github.com/${appInfo.author}`}
                        title={`https://github.com/${appInfo.author}`}
                        onClick={(event) => {
                          event.preventDefault();
                          void window.flashApi.openAuthorProfile!().catch(console.error);
                        }}
                      >
                        {appInfo.author}
                      </a> : appInfo.author}
                    </dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].version}</dt>
                    <dd><AboutReleaseLink component="app" name="Flash Royale" version={appInfo.version} language={language} /></dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].ruffleVersion}</dt>
                    <dd><AboutReleaseLink component="ruffle" name="Ruffle" version={appInfo.ruffleVersion} language={language} /></dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].ruffleVersion.replace("Ruffle", "DirPlayer")}</dt>
                    <dd><AboutReleaseLink component="dirplayer" name="DirPlayer" version={appInfo.dirplayerVersion ?? ""} language={language} /></dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].ruffleVersion.replace("Ruffle", "LibreShockwave")}</dt>
                    <dd><AboutReleaseLink component="libreshockwave" name="LibreShockwave" version={appInfo.softwareCredits?.find(credit => credit.id === "libreshockwave")?.version ?? ""} language={language} /></dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].ruffleVersion.replace("Ruffle", "CRT-Royale")}</dt>
                    <dd><AboutReleaseLink component="crt-royale" name="CRT-Royale" version={appInfo.softwareCredits?.find(credit => credit.id === "crt-royale")?.version ?? ""} language={language} /></dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].ruffleVersion.replace("Ruffle", "Electron")}</dt>
                    <dd><AboutReleaseLink component="electron" name="Electron" version={appInfo.electronVersion ?? ""} language={language} /></dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].github}</dt>
                    <dd>
                      <a
                        href={appInfo.repository}
                        title={appInfo.repository}
                        onClick={(event) => {
                          event.preventDefault();
                          void window.flashApi.openRepository().catch(console.error);
                        }}
                      >
                        {aboutLinkLabels[language].sourceCode}
                      </a>
                    </dd>
                  </div>
                </dl>
                </SettingsSection>
                </>}
                {appInfo && <>
                <div className="settings-about-extras">
                <SettingsSection title={softwareInfoLabels[language].thirdParty} icon={Layers}>
                  {appInfo.softwareCredits?.map((credit) => {
                    const version = credit.name === "CRT-Royale" && /^[a-f0-9]{40}$/i.test(credit.version)
                      ? credit.version.slice(0, 7)
                      : /^\d/.test(credit.version) ? `v${credit.version}` : credit.version;
                    return <details className="software-credit" key={credit.id}>
                      <summary>{credit.name}{credit.id !== "google-fonts" && <> · {version}</>} · {credit.license}</summary>
                      <a href={credit.repository} onClick={(event) => {
                        event.preventDefault();
                        void window.flashApi.openComponentRelease?.(credit.id).catch(console.error);
                      }}>{credit.repository}</a>
                      <pre tabIndex={0}>{credit.notice}</pre>
                    </details>;
                  })}
                </SettingsSection>
                <SettingsSection title={softwareInfoLabels[language].technical} icon={SlidersHorizontal}>
                  <dl className="settings-info">
                    <div><dt>Chromium</dt><dd>{appInfo.chromiumVersion ?? "—"}</dd></div>
                    <div><dt>Node.js</dt><dd>{appInfo.nodeVersion ?? "—"}</dd></div>
                  </dl>
                </SettingsSection>
                </div>
                </>}
              </section>
              </SettingsSectionTab>
            </div>
            </div>
            </div>
            </SettingsSections>
              {appInfo && <footer className="settings-about-footer">
                <span>
                  {attributionParts[0]}
                  <strong>xevil3301</strong>
                  {attributionParts[1]}
                </span>
                <button
                  type="button"
                  className="icon settings-about-github"
                  title={settingsInfoLabels[language].openOriginalAuthorRepository}
                  aria-label={settingsInfoLabels[language].openOriginalAuthorRepository}
                  onClick={() => void window.flashApi.openOriginalAuthorRepository().catch(console.error)}
                >
                  <Github size={15} />
                </button>
              </footer>}
              <PanelResizeGrip label={panelResizeLabels[language].resize} target={settingsPanelRef} centered={!settingsMoved} contained />
          </section>
        </div>
      )}

      <FlashpointImportPrompt language={language} />
      <SecurityAlert language={language} />
      <AntivirusThreatAlert language={language} />
      <FlashpointMetadataPrompt language={language} />
      <MetadataSearchHost language={language} onImported={(title) => setToast(`${metadataSourceLabels[language].imported} ${title}`)} />
      {confirmation && (
        <ConfirmationDialog message={confirmation.message} confirmLabel={confirmation.confirmLabel}
          cancelLabel={confirmation.cancelLabel ?? confirmationActionLabels[language].cancel} onResolve={resolveConfirmation} />
      )}

      {updateDialog && (updateDialog.status === "available" || updateDialog.status === "current") && (
        <div className="modal-backdrop confirm-backdrop">
          <section className="confirm-dialog update-dialog" role="alertdialog" aria-modal="true" aria-labelledby="update-dialog-title">
            <h2 id="update-dialog-title">{(updateDialog.status === "available" ? updateLabels[language].title : updateCurrentTitles[language]).replace("{version}", updateDialog.latestVersion)}</h2>
            <p className="update-current-version">{updateLabels[language].currentVersion.replace("{version}", updateDialog.currentVersion)}</p>
            <h3>{updateLabels[language].changelog}</h3>
            <Changelog text={updateDialog.changelog} releaseUrl={updateDialog.releaseUrl} emptyText={updateLabels[language].noChangelog}
              onOpenLink={(url) => void window.flashApi.openChangelogLink(url).catch(() => setToast(updateLabels[language].openFailed))} />
            {updateDialog.status === "available" && updateDialog.automaticUpdateAvailable && (
              <>
                <p>{portableUpdateLabels[language].warning}</p>
                <div>
                  <label className="settings-toggle">
                    <input type="checkbox" checked={unblockUpdate} disabled={isInstallingUpdate}
                      onChange={(event) => setUnblockUpdate(event.target.checked)} />
                    <span>{portableUpdateLabels[language].consent}</span>
                  </label>
                  <small className="update-option-description">{unblockUpdateDescriptions[language]}</small>
                </div>
                <div>
                  <label className="settings-toggle">
                    <input type="checkbox" checked={enableUpdateScriptExecution} disabled={isInstallingUpdate}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        try {
                          localStorage.setItem("flashroyale.enableUpdateScriptExecution", String(enabled));
                          setEnableUpdateScriptExecution(enabled);
                        } catch (error) {
                          console.error("Could not save update script execution preference:", error);
                          setUpdateInstallError(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
                        }
                      }} />
                    <span>{updateScriptExecutionLabels[language].label}</span>
                  </label>
                  <small className="update-option-description">{updateScriptExecutionLabels[language].hint}</small>
                </div>
                {isInstallingUpdate && <p role="status">{portableUpdateLabels[language].busy}</p>}
                {updateInstallError && <p role="alert">{portableUpdateLabels[language].failed}: {updateInstallError}</p>}
              </>
            )}
            {updateDialog.status === "available" && <small className="update-manual-description"><strong>{manualUpdateTitles[language]}</strong>{manualUpdateLabels[language].instructions}</small>}
            <div className="confirm-actions">
              <button type="button" className="secondary update-release-button" disabled={isInstallingUpdate}
                onClick={() => {
                  const releaseUrl = updateDialog.releaseUrl;
                  void window.flashApi.openUpdatePage(releaseUrl)
                    .catch(() => setToast(updateLabels[language].openFailed));
                }}>
                <ExternalLink size={16} aria-hidden="true" />
                <span>{manualUpdateLabels[language].openRelease}</span>
              </button>
              {updateDialog.status === "current" ? (
                <button type="button" className="primary" autoFocus data-controller-back="" onClick={() => setUpdateDialog(null)}>
                  {messages[language].close}
                </button>
              ) : <>
              <button type="button" className="secondary" autoFocus data-controller-back="" disabled={isInstallingUpdate} onClick={() => setUpdateDialog(null)}>
                {updateLabels[language].cancel}
              </button>
              <button
                type="button"
                className="primary"
                disabled={isInstallingUpdate}
                onClick={() => {
                  if (updateDialog.automaticUpdateAvailable) {
                    setIsInstallingUpdate(true);
                    setUpdateInstallError("");
                    const latestVersion = updateDialog.latestVersion;
                    void outsideControllerApp(() => window.flashApi.installUpdate(latestVersion, unblockUpdate, enableUpdateScriptExecution))
                      .catch((error) => setUpdateInstallError(error instanceof Error ? error.message : String(error)))
                      .finally(() => setIsInstallingUpdate(false));
                    return;
                  }
                  const releaseUrl = updateDialog.releaseUrl;
                  setUpdateDialog(null);
                  void window.flashApi.openUpdatePage(releaseUrl).catch(() => setToast(updateLabels[language].openFailed));
                }}
              >
                {updateDialog.automaticUpdateAvailable ? portableUpdateLabels[language].install : updateActionLabels[language]}
              </button>
              </>}
            </div>
          </section>
        </div>
      )}

      {textPrompt && (
        <div className="modal-backdrop confirm-backdrop">
          <form
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-prompt-label"
            onSubmit={(event) => {
              event.preventDefault();
              resolveTextPrompt(textPrompt.value);
            }}
          >
            <label className="confirm-prompt-field">
              <span id="rename-prompt-label">{textPrompt.message}</span>
              <input
                ref={promptInputRef}
                value={textPrompt.value}
                onChange={(event) => setTextPrompt((current) => current ? { ...current, value: event.target.value } : current)}
              />
            </label>
            <div className="confirm-actions">
              <button type="button" className="secondary" data-controller-back="" onClick={() => resolveTextPrompt(null)}>
                {confirmationActionLabels[language].cancel}
              </button>
              <button type="submit" className="primary" disabled={!textPrompt.value.trim()}>
                {renameActionLabels[language]}
              </button>
            </div>
          </form>
        </div>
      )}

      {importProgress && !importProgressHidden && (
        <div className="modal-backdrop confirm-backdrop">
          <section className="confirm-dialog import-progress" role="dialog" aria-modal="true" aria-busy="true" aria-labelledby="import-progress-title">
            <p id="import-progress-title" className="import-progress-title">{importProgressLabels[language].title}</p>
            <div
              className="import-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={importProgress.total}
              aria-valuenow={importProgress.current}
            >
              <div
                className="import-progress-fill"
                style={{ width: `${((importProgress.current - 0.5) / importProgress.total) * 100}%` }}
              />
            </div>
            <p className="import-progress-count">
              {importProgressLabels[language].fileCount
                .replace("{current}", String(importProgress.current))
                .replace("{total}", String(importProgress.total))}
            </p>
            <p className="import-progress-file" title={importProgress.fileName}>{importProgress.fileName}</p>
            <p className="import-progress-path" title={importProgress.filePath}>{importProgress.filePath}</p>
            <div className="confirm-actions">
              <button className="secondary" data-controller-back="" onClick={cancelImport} disabled={isCancellingImport}>
                {isCancellingImport ? importProgressLabels[language].cancelling : confirmationActionLabels[language].cancel}
              </button>
              <button className="secondary" onClick={() => setImportProgressHidden(true)}>{backgroundLabels[language]}</button>
            </div>
          </section>
        </div>
      )}

      {isCloseBlockedOpen && (
        <div className="modal-backdrop confirm-backdrop">
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-describedby="close-blocked-message">
            <p id="close-blocked-message">{closeBlockedReason === "explore" ? exploreCloseBlockedLabels[language] : closeBlockedLabels[language]}</p>
            <div className="confirm-actions">
              <button className="primary" autoFocus data-controller-back="" onClick={() => setIsCloseBlockedOpen(false)}>
                {importProgressLabels[language].ok}
              </button>
            </div>
          </section>
        </div>
      )}

      {importSummary && !importProgress && (
        <div className="modal-backdrop confirm-backdrop">
          <section className="confirm-dialog import-summary" role="dialog" aria-modal="true" aria-labelledby="import-summary-title">
            <p id="import-summary-title" className="import-progress-title">
              {importSummary.cancelled ? importProgressLabels[language].cancelled : importProgressLabels[language].done}
            </p>
            <h3 id="import-summary-added" className="import-summary-heading">
              {importProgressLabels[language].added.replace("{count}", String(importSummary.imported.length))}
            </h3>
            {importSummary.imported.length ? (
              <ul className="import-summary-list" aria-labelledby="import-summary-added">
                {importSummary.imported.map((game) => (
                  <li key={game.id} title={game.title} tabIndex={0}>
                    <span>{game.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="import-summary-empty">{importProgressLabels[language].none}</p>
            )}
            <h3 id="import-summary-skipped" className="import-summary-heading">
              {importProgressLabels[language].skipped.replace("{count}", String(importSummary.skipped.length))}
            </h3>
            {importSummary.skipped.length ? (
              <ul className="import-summary-list" aria-labelledby="import-summary-skipped">
                {importSummary.skipped.map((item, index) => (
                  <li key={`${item.path}-${index}`} title={item.path} tabIndex={0}>
                    <span>{item.path.split(/[\\/]/).pop() || item.path}</span>
                    <small>{item.reason}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="import-summary-empty">{importProgressLabels[language].none}</p>
            )}
            <div className="confirm-actions">
              <button className="primary" autoFocus data-controller-back="" onClick={closeImportSummary}>
                {importProgressLabels[language].ok}
              </button>
            </div>
          </section>
        </div>
      )}

      {isDragging && (
        <div className="drop-hint">
          <RefreshCw size={28} />
          <strong>{text.dropHint.replace(/SWF/g, "SWF / DCR")}</strong>
        </div>
      )}
    </div>
  );
}

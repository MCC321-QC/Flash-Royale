import Fuse from "fuse.js";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CalendarDays,
  Camera,
  ChevronDown,
  Download,
  FolderOpen,
  Gamepad2,
  Heart,
  Maximize,
  Minimize,
  Music,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Pin,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Square,
  Star,
  Tags,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import flashRoyaleLogo from "../assets/flash-royale-logo.png";
import { cardSizeLabels, cardSizeToggleLabels, confirmationActionLabels, detailPanelLabels, gameSettingsLabels, generalSettingsLabels, importCountLabels, messages, playerControlLabels, playTimeLabels, readLanguage, renameActionLabels, settingsInfoLabels, sortLabels, stopPlayingLabels, themeLabels, toastLabels, translateError, importProgressLabels, musicLabels, coverCaptureLabels, closeBlockedLabels, type Language } from "./i18n";
import type { AppInfo, FlashApi, Game, GamePatch, ImportProgress, ImportResult, LibraryState, PlayerWindowData } from "./types";

type Filter =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "category"; value: string }
  | { type: "tag"; value: string };

type PlayerResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ToastMessage =
  | string
  | { type: "importSummary"; imported: number; skipped: number }
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
  fullscreenByDefault: boolean;
  tags: string;
  notes: string;
};

const emptyLibrary: LibraryState = {
  libraryRoot: "",
  games: [],
};

const gameCardWidths = [140, 160, 180, 200, 220, 300, 400, 500] as const;

function formatDate(value: string | null, language: Language) {
  if (!value) return messages[language].never;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : language, {
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
  const formatter = new Intl.NumberFormat(language === "zh" ? "zh-CN" : language, {
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
    fullscreenByDefault: Boolean(game?.fullscreenByDefault),
    tags: game?.tags.join(", ") || "",
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
    fullscreenByDefault: draft.fullscreenByDefault,
    tags: normalizeTags(draft.tags),
    notes: draft.notes,
  };
}

async function loadRuffleScript(language: Language) {
  if (window.RufflePlayer) return;
  const assetBaseUrl = window.flashApi ? await window.flashApi.getAssetBaseUrl() : window.location.origin;
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
    script.src = `${assetBaseUrl}/ruffle/ruffle.js`;
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
      load(options: string | { url: string; allowScriptAccess?: boolean }): Promise<void> | void;
    };
  }).ruffle();
}

function coverStatusLabel(status: Game["coverStatus"], language: Language) {
  const text = messages[language];
  if (status === "captured") return text.coverCaptured;
  if (status === "custom") return text.coverCustom;
  return text.coverFallback;
}

function displayCategory(category: string, language: Language) {
  if (Object.values(messages).some((text) => text.uncategorized === category)) {
    return messages[language].uncategorized;
  }
  return category;
}

function formatReleaseDate(value: string, language: Language) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : language, {
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

function CoverImage({ game, className, language }: { game: Game; className?: string; language: Language }) {
  const [failed, setFailed] = useState(false);

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
      src={game.coverUrl}
      alt={`${game.title} ${messages[language].coverAlt}`}
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
    <aside className="sidebar">
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

      <div className="side-heading">
        <span>{text.categories}</span>
      </div>
      <div className="side-list">
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

      <div className="side-heading">
        <span>{text.tags}</span>
      </div>
      <div className="tag-list">
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

      <button className="settings-trigger" onClick={onOpenSettings}>
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
}: {
  game: Game;
  selected: boolean;
  onSelect: () => void;
  language: Language;
  showFavoriteBadge: boolean;
}) {
  const text = messages[language];
  const timeText = playTimeLabels[language];
  const metadata = [
    game.releaseDate ? `${text.release}: ${formatReleaseDate(game.releaseDate, language)}` : null,
    game.developer ? `${text.developer}: ${game.developer}` : null,
    game.publisher ? `${text.publisher}: ${game.publisher}` : null,
    `${timeText.playTime}: ${game.totalPlaySeconds ? formatPlayDuration(game.totalPlaySeconds, language) : text.notPlayed}`,
  ].filter((value): value is string => Boolean(value));

  return (
    <button
      className={selected ? "game-card selected" : "game-card"}
      onClick={onSelect}
    >
      <div className="cover-wrap">
        <CoverImage game={game} language={language} />
        {game.favorite && showFavoriteBadge && (
          <span className="fav-badge" title={messages[language].selectedFavorite}>
            <Heart size={15} fill="currentColor" />
          </span>
        )}
      </div>
      <div
        className="game-card-body"
        style={{ gridTemplateRows: `34px 16px repeat(${metadata.length}, 16px) auto` }}
      >
        <strong title={game.title}>{game.title}</strong>
        <span title={displayCategory(game.category, language)}>{displayCategory(game.category, language)}</span>
        {metadata.map((value) => (
          <span className="game-card-metadata" key={value} title={value}>{value}</span>
        ))}
        <div className="mini-tags">
          {game.tags.map((tag) => (
            <em key={tag} title={tag}>{tag}</em>
          ))}
        </div>
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
  musicDescription,
  musicTracks,
  onSelectDefaultMusic,
  onRecaptureCover,
  isCapturingCover,
  language,
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
  musicDescription: string;
  musicTracks: number[];
  onSelectDefaultMusic: (game: Game, index: number) => void;
  onRecaptureCover: (game: Game) => void;
  isCapturingCover: boolean;
  language: Language;
}) {
  const text = messages[language];
  const categoryComboRef = useRef<HTMLDivElement>(null);
  const releaseDateInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => createDetailsDraft(game));
  const draftRef = useRef(draft);
  const saveTimerRef = useRef<number | null>(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  useEffect(() => {
    const initialDraft = createDetailsDraft(game);
    draftRef.current = initialDraft;
    setDraft(initialDraft);
    setIsCategoryMenuOpen(false);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (game) onPatch(game.id, detailsDraftToPatch(draftRef.current));
      }
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

  return (
    <aside className="details">
      <CoverImage className="detail-cover" game={game} language={language} />
      <div className="detail-actions">
        <PlayToggleButton isRunning={isRunning} onClick={() => onPlay(game)} language={language} />
        <div className="detail-icon-actions">
          <button className="icon" title={text.selectedFavorite} onClick={() => onPatch(game.id, { favorite: !game.favorite })}>
            <Heart size={18} fill={game.favorite ? "currentColor" : "none"} />
          </button>
          <button className="icon danger" title={text.delete} onClick={() => onDelete(game)}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <label className="fullscreen-setting">
        <input
          type="checkbox"
          checked={draft.fullscreenByDefault}
          onChange={(event) => updateDraft({ fullscreenByDefault: event.target.checked })}
        />
        <span>{gameSettingsLabels[language].fullscreenByDefault}</span>
      </label>
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
          <button
            type="button"
            className="category-trigger date-trigger"
            aria-label={text.releaseDate}
            onClick={() => {
              const input = releaseDateInputRef.current;
              if (!input) return;
              if (typeof input.showPicker === "function") input.showPicker();
              else input.click();
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
        {text.tags}
        <input value={draft.tags} onChange={(event) => updateDraft({ tags: event.target.value })} placeholder={text.tagsPlaceholder} />
      </label>
      <label>
        {text.notes}
        <textarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} />
      </label>

      {musicTracks.length > 1 && (
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

      <div className="music-actions">
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
      </div>

      <div className="music-actions">
        <button className="secondary" title={text.chooseCover} onClick={() => onManualCover(game)}>
          <Upload size={16} />
          {coverCaptureLabels[language].chooseImage}
        </button>
        <button className="secondary recapture-cover" onClick={() => onRecaptureCover(game)} disabled={isCapturingCover}>
          <Camera size={16} />
          {isCapturingCover ? coverCaptureLabels[language].capturing : coverCaptureLabels[language].recapture}
        </button>
      </div>

      <div className="meta">
        <span>{text.file}: {game.originalFileName}</span>
        <span>{text.plays}: {game.playCount ? `${game.playCount} ${text.times}` : text.never}</span>
        <span>{playTimeLabels[language].playTime}: {game.totalPlaySeconds ? formatPlayDuration(game.totalPlaySeconds, language) : text.notPlayed}</span>
        <span>{text.lastPlayed}: {formatDate(game.lastPlayedAt, language)}</span>
        <span>{sortLabels[language].dateAdded}: {formatDate(game.createdAt, language)}</span>
        <span>{text.cover}: {coverStatusLabel(game.coverStatus, language)}</span>
        <span title={musicDescription}>{musicLabels[language].music}: {musicDescription}</span>
      </div>
    </aside>
  );
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
  const isChromePinnedRef = useRef(false);
  const isPointerInChromeZoneRef = useRef(false);
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
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(() =>
    game?.sessionStartedAt ? Math.max(0, Math.floor((Date.now() - game.sessionStartedAt) / 1000)) : 0,
  );
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(standalone && Boolean(game?.fullscreenByDefault));
  const [isChromePinned, setIsChromePinned] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(!(standalone && game?.fullscreenByDefault));
  const [showOptionsBar, setShowOptionsBar] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [playerSize, setPlayerSize] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = game && Number(game.stageWidth) > 0 ? Number(game.stageWidth) : 4;
  const stageHeight = game && Number(game.stageHeight) > 0 ? Number(game.stageHeight) : 3;

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
    setShowOptionsBar(false);
    setDragOffset({ x: 0, y: 0 });
    setPlayerSize(null);
  }, [game]);

  useEffect(() => {
    if (!game?.sessionStartedAt) {
      setSessionSeconds(0);
      return;
    }
    const updateSessionTime = () => {
      setSessionSeconds(Math.max(0, Math.floor((Date.now() - game.sessionStartedAt!) / 1000)));
    };
    updateSessionTime();
    const intervalId = window.setInterval(updateSessionTime, 1000);
    return () => window.clearInterval(intervalId);
  }, [game?.id, game?.sessionStartedAt]);

  useEffect(() => {
    let cancelled = false;
    let player: HTMLElement | null = null;

    async function run() {
      if (!game || !containerRef.current) return;
      setStatus(text.loadingRuffle);
      try {
        await loadRuffleScript(language);
        if (cancelled || !window.RufflePlayer || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        const ruffle = window.RufflePlayer.newest();
        player = ruffle.createPlayer();
        player.className = "ruffle-player";
        containerRef.current.appendChild(player);
        setStatus(text.loadingGame);
        await ruffleApi(player).load({ url: game.swfUrl, allowScriptAccess: false });
        setStatus(text.running);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : text.gameLoadFailed);
      }
    }

    run();
    return () => {
      cancelled = true;
      player?.remove();
    };
  }, [game, language, text.gameLoadFailed, text.loadingGame, text.loadingRuffle, text.running]);

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
      const availableWidth = Math.max(1, surface.clientWidth - horizontalPadding);
      const availableHeight = Math.max(1, surface.clientHeight - verticalPadding);
      const ratio = stageWidth / stageHeight;

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
  }, [game, stageHeight, stageWidth]);

  if (!game) return null;

  const playerStageStyle = {
    aspectRatio: `${stageWidth} / ${stageHeight}`,
    width: fitSize ? `${Math.round(fitSize.width * zoom)}px` : "100%",
    height: fitSize ? `${Math.round(fitSize.height * zoom)}px` : "100%",
  };

  const changeZoom = (amount: number) => {
    setZoom((current) => Math.min(2.5, Math.max(0.5, Math.round((current + amount) * 100) / 100)));
  };

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

  const handleFullscreenPointerMove = (event: React.MouseEvent<HTMLElement>) => {
    if (!isFullscreen) return;
    const top = event.clientY - event.currentTarget.getBoundingClientRect().top;
    isPointerInChromeZoneRef.current = top <= 112;
    setIsChromeVisible(isChromePinnedRef.current || isPointerInChromeZoneRef.current);
  };

  const handlePlayerMouseLeave = () => {
    isPointerInChromeZoneRef.current = false;
    if (isFullscreen && !isChromePinnedRef.current) setIsChromeVisible(false);
  };

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
        className={`player-modal${standalone ? " standalone-player" : ""}${standalone && isFullscreen ? " fullscreen-player" : ""}${isChromeVisible ? "" : " chrome-hidden"}`}
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
        onMouseMove={handleFullscreenPointerMove}
        onMouseLeave={handlePlayerMouseLeave}
      >
        <div className="player-chrome">
          <header
            onPointerDown={standalone ? undefined : startPlayerDrag}
            onPointerMove={standalone ? undefined : movePlayerDrag}
            onPointerUp={standalone ? undefined : stopPlayerDrag}
            onPointerCancel={standalone ? undefined : stopPlayerDrag}
          >
            <div>
              <strong>{game.title}</strong>
              <span>
                {status === text.running
                  ? `${timeText.activeSession}: ${formatSessionDuration(sessionSeconds, language)}`
                  : status}
              </span>
            </div>
            <div className="modal-actions">
              <button
                className={`icon menu-toggle${showOptionsBar ? " open" : ""}`}
                onClick={() => setShowOptionsBar((visible) => !visible)}
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
              <button className="icon" onClick={onClose} title={text.close} aria-label={text.close}>
                <X size={20} />
              </button>
            </div>
          </header>
          {showOptionsBar && (
            <div className="player-toolbar" role="toolbar" aria-label={controls.playerControls}>
              <div className="zoom-controls">
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
              </div>
              <div className="zoom-controls">
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
        <div className={zoom > 1 ? "player-surface zoomed" : "player-surface"} ref={surfaceRef}>
          <div className="player-stage" ref={containerRef} style={playerStageStyle} />
        </div>
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

const detailsWidthLimits = { min: 300, max: 1200, default: 300 };

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

export function App() {
  const [library, setLibrary] = useState<LibraryState>(emptyLibrary);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [detailsWidth, setDetailsWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("flashmanager.detailsWidth"));
      return saved > 0 ? clampDetailsWidth(saved) : detailsWidthLimits.default;
    } catch {
      return detailsWidthLimits.default;
    }
  });
  const [isResizingDetails, setIsResizingDetails] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const [sortMode, setSortMode] = useState<SortMode>(readStoredSortMode);
  const [sortAscending, setSortAscending] = useState(readStoredSortAscending);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortControlRef = useRef<HTMLDivElement>(null);
  const [showCardSize, setShowCardSize] = useState(false);
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

  useEffect(() => {
    captureBatchSizeRef.current = Math.max(captureBatchSizeRef.current, captureQueue.length);
    // A single capture already gets its own "cover created" message, so only announce multi-game batches.
    if (previousCaptureCountRef.current > 0 && captureQueue.length === 0) {
      if (captureBatchSizeRef.current > 1) setToast({ type: "coversFinished" });
      captureBatchSizeRef.current = 0;
    }
    previousCaptureCountRef.current = captureQueue.length;
  }, [captureQueue.length]);
  const [language, setLanguage] = useState<Language>(readLanguage);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [runningGameIds, setRunningGameIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startInFullscreen, setStartInFullscreen] = useState(false);
  const [minimizeToTrayOnGameLaunch, setMinimizeToTrayOnGameLaunch] = useState(true);
  const [minimizeToTrayOnMinimize, setMinimizeToTrayOnMinimize] = useState(true);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [textPrompt, setTextPrompt] = useState<TextPromptRequest | null>(null);
  const cancelConfirmationButtonRef = useRef<HTMLButtonElement>(null);
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
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
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

  useEffect(() => {
    window.flashApi.readLibrary().then((state) => {
      setLibrary(state);
    });
  }, []);

  useEffect(() => {
    window.flashApi.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
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
  useEffect(() => window.flashApi.onCloseBlocked(() => setIsCloseBlockedOpen(true)), []);

  useEffect(() =>
    window.flashApi.onPlayTimeUpdated((updatedGame) => {
      setLibrary((current) => ({
        ...current,
        games: current.games.map((game) => (game.id === updatedGame.id ? updatedGame : game)),
      }));
    }),
  []);

  useEffect(() => {
    try {
      localStorage.setItem("flashmanager.language", language);
    } catch {}
  }, [language]);

  const escapeHandledElsewhere =
    settingsOpen || Boolean(confirmation) || Boolean(textPrompt) || sortMenuOpen || Boolean(importProgress) || Boolean(importSummary) || isCloseBlockedOpen;
  useEffect(() => {
    if (!selectedId || escapeHandledElsewhere) return;
    const deselectOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setSelectedId(null);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.closest(".game-card")) focused.blur();
    };
    document.addEventListener("keydown", deselectOnEscape);
    return () => document.removeEventListener("keydown", deselectOnEscape);
  }, [selectedId, escapeHandledElsewhere]);

  useEffect(() => {
    if (!settingsOpen) return;
    let isCurrent = true;
    window.flashApi.getStartInFullscreen().then((enabled) => {
      if (isCurrent) setStartInFullscreen(enabled);
    }).catch(() => {});
    window.flashApi.getMinimizeToTrayOnGameLaunch().then((enabled) => {
      if (isCurrent) setMinimizeToTrayOnGameLaunch(enabled);
    }).catch(() => {});
    window.flashApi.getMinimizeToTrayOnMinimize().then((enabled) => {
      if (isCurrent) setMinimizeToTrayOnMinimize(enabled);
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
    if (!confirmation) return;
    cancelConfirmationButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") resolveConfirmation(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [confirmation]);

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

  const selectedGame = library.games.find((game) => game.id === selectedId) || null;
  const [isThemeEnabled, setIsThemeEnabled] = useState(() => readStoredFlag("flashmanager.themeEnabled"));
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
  const themeCacheRef = useRef(new Map<string, GameTheme | null>());
  const [musicCandidates, setMusicCandidates] = useState<{ gameId: string; durations: number[] } | null>(null);
  const musicCandidatesCacheRef = useRef(new Map<string, number[]>());
  const themeAudioRef = useRef<HTMLAudioElement | null>(null);
  const themeVolumeRef = useRef(themeVolume);
  themeVolumeRef.current = themeVolume;
  const isAnyGameRunning = runningGameIds.length > 0;
  const isThemeEnabledRef = useRef(isThemeEnabled);
  isThemeEnabledRef.current = isThemeEnabled;
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
      .catch(() => [])
      .then((candidates) => {
        const durations = candidates.map((candidate) => candidate.duration);
        musicCandidatesCacheRef.current.set(selectedId, durations);
        if (!cancelled) setMusicCandidates({ gameId: selectedId, durations });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

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
      .catch(() => null)
      .then((theme) => {
        themeCacheRef.current.set(selectedId, theme);
        if (!cancelled) setThemeInfo({ gameId: selectedId, theme });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, themeReloadKey]);

  useEffect(() => {
    // Stays paused while a game is running so the two soundtracks never overlap.
    if (!isThemeEnabled || !selectedTheme || isAnyGameRunning) return;
    const audioUrl = URL.createObjectURL(new Blob([selectedTheme.data], { type: selectedTheme.mimeType }));
    const audio = new Audio(audioUrl);
    audio.loop = true;
    audio.volume = 0;
    themeAudioRef.current = audio;
    void audio.play().catch(() => {});
    const stopFadeIn = fadeAudioVolume(audio, () => themeVolumeRef.current);
    return () => {
      stopFadeIn();
      if (themeAudioRef.current === audio) themeAudioRef.current = null;
      fadeAudioVolume(audio, () => 0, () => {
        audio.pause();
        URL.revokeObjectURL(audioUrl);
      });
    };
  }, [isThemeEnabled, selectedTheme, isAnyGameRunning]);

  useEffect(() => {
    if (themeAudioRef.current) themeAudioRef.current.volume = themeVolume;
  }, [themeVolume]);

  const toggleTheme = () => {
    const next = !isThemeEnabled;
    themeSuspendedByGameRef.current = false;
    setIsThemeEnabled(next);
    try {
      localStorage.setItem("flashmanager.themeEnabled", String(next));
    } catch {}
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
  }, [filter, fuse, language, library.games, query, sortAscending, sortMode]);

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

  const updateStartInFullscreen = async (enabled: boolean) => {
    const previous = startInFullscreen;
    setStartInFullscreen(enabled);
    try {
      setStartInFullscreen(await window.flashApi.setStartInFullscreen(enabled));
    } catch (error) {
      setStartInFullscreen(previous);
      setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
    }
  };

  const updateMinimizeToTrayOnGameLaunch = async (enabled: boolean) => {
    const previous = minimizeToTrayOnGameLaunch;
    setMinimizeToTrayOnGameLaunch(enabled);
    try {
      setMinimizeToTrayOnGameLaunch(await window.flashApi.setMinimizeToTrayOnGameLaunch(enabled));
    } catch (error) {
      setMinimizeToTrayOnGameLaunch(previous);
      setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
    }
  };

  const updateMinimizeToTrayOnMinimize = async (enabled: boolean) => {
    const previous = minimizeToTrayOnMinimize;
    setMinimizeToTrayOnMinimize(enabled);
    try {
      setMinimizeToTrayOnMinimize(await window.flashApi.setMinimizeToTrayOnMinimize(enabled));
    } catch (error) {
      setMinimizeToTrayOnMinimize(previous);
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

  const closeImportSummary = () => {
    const importedIds = importSummary?.imported.map((game) => game.id) || [];
    setImportSummary(null);
    if (importedIds.length > 0) setCaptureQueue((queue) => [...queue, ...importedIds]);
  };

  const finishImport = () => {
    setImportProgress(null);
    setIsCancellingImport(false);
  };

  const cancelImport = () => {
    setIsCancellingImport(true);
    void window.flashApi.cancelImport().catch(() => {});
  };

  const chooseAndImport = async () => {
    try {
      handleImportResult(await window.flashApi.chooseAndImport(language));
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
      setToast(translateError(error instanceof Error ? error.message : "", language, text.saveFailed));
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

  const playGame = async (game: Game) => {
    try {
      await window.flashApi.openPlayer(
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
    } catch {
      setToast(text.gameLoadFailed);
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
      const updated = await window.flashApi.chooseCoverImage(game.id, language);
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

  const chooseCustomMusic = (game: Game) =>
    applyCustomMusicChange(game, () => window.flashApi.chooseCustomMusic(game.id, language));

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

  const saveDetailsWidth = (width: number) => {
    try {
      localStorage.setItem("flashmanager.detailsWidth", String(width));
    } catch {}
  };

  const resizeDetailsFromPointer = (clientX: number) => {
    const bounds = appRef.current?.getBoundingClientRect();
    if (!bounds) return detailsWidth;
    const width = clampDetailsWidth(language === "ar" ? clientX - bounds.left : bounds.right - clientX);
    setDetailsWidth(width);
    return width;
  };

  const toastText =
    typeof toast === "string"
      ? toast
      : toast.type === "appStarted" || toast.type === "coversFinished"
        ? toastLabels[language][toast.type]
        : toast.type === "gameStarted" || toast.type === "gameStopped" || toast.type === "coverCreated"
          ? toastLabels[language][toast.type].replace("{title}", toast.title)
          : null;

  return (
    <div
      ref={appRef}
      className={`app${isDragging ? " drag-active" : ""}${showDetailsPanel ? "" : " details-collapsed"}${isResizingDetails ? " resizing-details" : ""}`}
      style={{ "--details-width": `${detailsWidth}px` } as React.CSSProperties}
      dir={language === "ar" ? "rtl" : "ltr"}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
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

      <main className="content">
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
            <button className="primary" onClick={chooseAndImport}>
              <Download size={18} />
              {text.importSwf}
            </button>
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
              onClick={() => setShowDetailsPanel((visible) => !visible)}
              title={showDetailsPanel ? detailPanelLabels[language].hide : detailPanelLabels[language].show}
              aria-label={showDetailsPanel ? detailPanelLabels[language].hide : detailPanelLabels[language].show}
              aria-pressed={showDetailsPanel}
            >
              {showDetailsPanel ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
            </button>
          </div>
        </header>

        <section className="library-info">
          <div>
            <strong>{visibleGames.length}</strong>
            <span>{text.currentResults}</span>
          </div>
          <div>
            <strong>{library.games.length}</strong>
            <span>{text.gamesInLibrary}</span>
          </div>
          <div className="library-view-controls">
            <div className="theme-control">
              <button
                className={isThemeEnabled ? "icon active" : "icon"}
                onClick={toggleTheme}
                disabled={!selectedTheme || isAnyGameRunning}
                title={
                  !selectedGame
                    ? themeLabels[language].selectFirst
                    : themeInfo?.gameId === selectedId && !selectedTheme
                      ? themeLabels[language].noMusic
                      : isAnyGameRunning
                        ? themeLabels[language].gameRunning
                        : isThemeEnabled
                          ? themeLabels[language].stop
                          : themeLabels[language].play
                }
                aria-label={isThemeEnabled ? themeLabels[language].stop : themeLabels[language].play}
                aria-pressed={isThemeEnabled}
              >
                <Music size={18} />
              </button>
              {selectedTheme && !isAnyGameRunning && (
                <div className="theme-volume">
                  <div className="theme-volume-panel">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(themeVolume * 100)}
                      aria-label={themeLabels[language].volume}
                      title={`${themeLabels[language].volume}: ${Math.round(themeVolume * 100)}%`}
                      onChange={(event) => changeThemeVolume(Number(event.target.value) / 100)}
                    />
                  </div>
                </div>
              )}
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
                </div>
              )}
            </div>
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
          <div className={showCardSize ? "library-location-controls" : "library-location-controls centered"}>
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
            {showCardSize && <span className="library-controls-separator" aria-hidden="true" />}
            <p title={library.libraryRoot}>{text.libraryDirectory}: {library.libraryRoot || text.initializing}</p>
          </div>
          <span className="toast" title={toastText ?? undefined}>
            {toastText !== null ? (
              <span className="toast-copy">{toastText}</span>
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
          </span>
        </section>

        <section
          className="game-grid"
          style={{
            gridTemplateColumns: visibleGames.length
              ? `repeat(auto-fill, ${gameCardWidths[cardSizeIndex]}px)`
              : "minmax(0, 1fr)",
          }}
          onClick={(event) => {
            if (!(event.target as HTMLElement).closest(".game-card")) setSelectedId(null);
          }}
        >
          {visibleGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              selected={game.id === selectedId}
              onSelect={() => setSelectedId(game.id)}
              language={language}
              showFavoriteBadge={filter.type !== "favorites"}
            />
          ))}
          {visibleGames.length === 0 && (
            <div className="empty-state">
              <Plus size={36} />
              <strong>{text.emptyLibrary}</strong>
              <span>{text.emptyLibraryHint}</span>
            </div>
          )}
        </section>
      </main>

      {showDetailsPanel && (
        <div
          className="details-resizer"
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
            saveDetailsWidth(resizeDetailsFromPointer(event.clientX));
          }}
          onPointerCancel={() => {
            setIsResizingDetails(false);
            saveDetailsWidth(detailsWidth);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const grows = (event.key === "ArrowLeft") !== (language === "ar");
            const width = clampDetailsWidth(detailsWidth + (grows ? 16 : -16));
            setDetailsWidth(width);
            saveDetailsWidth(width);
          }}
        />
      )}

      {showDetailsPanel && (
        <DetailsPanel
          game={selectedGame}
          categories={categoryOptions}
          onPatch={updateGame}
          onDelete={deleteGame}
          onPlay={togglePlay}
          isRunning={Boolean(selectedGame && runningGameIds.includes(selectedGame.id))}
          onManualCover={chooseManualCover}
          onChooseMusic={chooseCustomMusic}
          onRemoveMusic={removeCustomMusic}
          musicDescription={musicDescription}
          musicTracks={selectedMusicTracks}
          onSelectDefaultMusic={selectDefaultMusic}
          onRecaptureCover={recaptureCover}
          isCapturingCover={Boolean(selectedGame && captureQueue.includes(selectedGame.id))}
          language={language}
        />
      )}

      <CoverCapture game={captureGame} onDone={onCaptureDone} language={language} />

      {settingsOpen && (
        <div
          className="modal-backdrop settings-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section className="settings-window" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <header>
              <div className="settings-heading">
                <Settings size={19} />
                <strong id="settings-title">{text.settings}</strong>
              </div>
              <button className="icon" onClick={() => setSettingsOpen(false)} title={text.close}>
                <X size={19} />
              </button>
            </header>
            <label className="settings-field">
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
              <small>{text.settingsDescription}</small>
            </label>
            <section className="settings-general" aria-labelledby="settings-general-title">
              <h2 id="settings-general-title">{generalSettingsLabels[language].general}</h2>
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
                  checked={minimizeToTrayOnGameLaunch}
                  onChange={(event) => void updateMinimizeToTrayOnGameLaunch(event.target.checked)}
                />
                <span>{generalSettingsLabels[language].minimizeToTrayOnGameLaunch}</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={minimizeToTrayOnMinimize}
                  onChange={(event) => void updateMinimizeToTrayOnMinimize(event.target.checked)}
                />
                <span>{generalSettingsLabels[language].minimizeToTrayOnMinimize}</span>
              </label>
            </section>
            {appInfo && (
              <section className="settings-about" aria-labelledby="settings-about-title">
                <h2 id="settings-about-title">{settingsInfoLabels[language].about}</h2>
                <dl className="settings-info">
                  <div>
                    <dt>{settingsInfoLabels[language].version}</dt>
                    <dd>{appInfo.version}</dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].author}</dt>
                    <dd>{appInfo.author}</dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].ruffleVersion}</dt>
                    <dd>{appInfo.ruffleVersion}</dd>
                  </div>
                  <div>
                    <dt>{settingsInfoLabels[language].github}</dt>
                    <dd>
                      <a
                        href={appInfo.repository}
                        onClick={(event) => {
                          event.preventDefault();
                          void window.flashApi.openRepository().catch(() => {});
                        }}
                      >
                        {appInfo.repository}
                      </a>
                    </dd>
                  </div>
                </dl>
              </section>
            )}
          </section>
        </div>
      )}

      {confirmation && (
        <div
          className="modal-backdrop confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resolveConfirmation(false);
          }}
        >
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-describedby="confirm-message">
            <p id="confirm-message">{confirmation.message}</p>
            <div className="confirm-actions">
              <button ref={cancelConfirmationButtonRef} className="secondary" onClick={() => resolveConfirmation(false)}>
                {confirmation.cancelLabel ?? confirmationActionLabels[language].cancel}
              </button>
              <button className="confirm-destructive" onClick={() => resolveConfirmation(true)}>
                {confirmation.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}

      {textPrompt && (
        <div
          className="modal-backdrop confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resolveTextPrompt(null);
          }}
        >
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
              <button type="button" className="secondary" onClick={() => resolveTextPrompt(null)}>
                {confirmationActionLabels[language].cancel}
              </button>
              <button type="submit" className="primary" disabled={!textPrompt.value.trim()}>
                {renameActionLabels[language]}
              </button>
            </div>
          </form>
        </div>
      )}

      {importProgress && (
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
              <button className="secondary" onClick={cancelImport} disabled={isCancellingImport}>
                {isCancellingImport ? importProgressLabels[language].cancelling : confirmationActionLabels[language].cancel}
              </button>
            </div>
          </section>
        </div>
      )}

      {isCloseBlockedOpen && (
        <div
          className="modal-backdrop confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCloseBlockedOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsCloseBlockedOpen(false);
          }}
        >
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-describedby="close-blocked-message">
            <p id="close-blocked-message">{closeBlockedLabels[language]}</p>
            <div className="confirm-actions">
              <button className="primary" autoFocus onClick={() => setIsCloseBlockedOpen(false)}>
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
            <h3 className="import-summary-heading">
              {importProgressLabels[language].added.replace("{count}", String(importSummary.imported.length))}
            </h3>
            {importSummary.imported.length ? (
              <ul className="import-summary-list">
                {importSummary.imported.map((game) => (
                  <li key={game.id} title={game.title}>
                    <span>{game.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="import-summary-empty">{importProgressLabels[language].none}</p>
            )}
            <h3 className="import-summary-heading">
              {importProgressLabels[language].skipped.replace("{count}", String(importSummary.skipped.length))}
            </h3>
            {importSummary.skipped.length ? (
              <ul className="import-summary-list">
                {importSummary.skipped.map((item, index) => (
                  <li key={`${item.path}-${index}`} title={item.path}>
                    <span>{item.path.split(/[\\/]/).pop() || item.path}</span>
                    <small>{item.reason}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="import-summary-empty">{importProgressLabels[language].none}</p>
            )}
            <div className="confirm-actions">
              <button className="primary" autoFocus onClick={closeImportSummary}>
                {importProgressLabels[language].ok}
              </button>
            </div>
          </section>
        </div>
      )}

      {isDragging && (
        <div className="drop-hint">
          <RefreshCw size={28} />
          <strong>{text.dropHint}</strong>
        </div>
      )}
    </div>
  );
}

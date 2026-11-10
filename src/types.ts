import type { Language } from "./i18n";

type CoverStatus = "fallback" | "captured" | "custom" | "explore";

export interface MusicNormalizationSettings {
  enabled: boolean;
  normalizerPath: string;
  ffmpegPath: string;
}

export interface MusicBackupReport {
  entries: { id: string; title: string; gameId: string; gameTitle: string; fileName: string; sizeBytes: number }[];
  totalBytes: number;
}

export interface MusicNormalizationReport {
  cancelled?: boolean;
  normalizedCount?: number;
  tracks: {
    id: string;
    title: string;
    status: "normalized" | "needsNormalization" | "silent" | "error";
    loudness: number | null;
    truePeak: number | null;
    error?: string;
  }[];
}

export interface SwfMetadata {
  swfVersion: number | null;
  stageWidth: number | null;
  stageHeight: number | null;
  frameRate: number | null;
  fileSizeBytes: number | null;
}

interface FlashpointImportResult {
  status: "ok" | "disabled" | "notFound" | "ultimate";
  imported: string[];
}

export interface FlashpointImportSettings {
  autoImport: boolean;
  prompt: boolean;
  /** Fill in missing game metadata from Flashpoint at startup. */
  metadataAuto: boolean;
  /** Ask which metadata to apply; when off, only empty data is filled. */
  metadataPrompt: boolean;
  /** Metadata sources in priority order (first = highest). */
  metadataSources: MetadataSourceSetting[];
}

/** Built-in metadata sources; sources added through GitHub definitions use other ids. */
export type BuiltinMetadataSourceId = "flashpointLocal" | "flashpointOnline" | "newgrounds" | "silvergames" | "y8" | "armorgames" | "andkon" | "flashgames247";
export type MetadataSourceId = BuiltinMetadataSourceId | (string & {});

export interface MetadataSourceSetting {
  id: MetadataSourceId;
  enabled: boolean;
  /** Name from the source definition. */
  name?: string;
  /** Folder policy overrides the effective switch without replacing the user's saved choice. */
  remoteDisabled?: boolean;
}

export type FlashpointMetadataField = "developer" | "publisher" | "releaseDate" | "version" | "description" | "notes" | "tags" | "cover" | "icon" | "screenshot" | "sourceRating" | `sourceRating:${string}`;

export interface FlashpointMetadataItem {
  field: FlashpointMetadataField;
  /** fill: the game has no value yet; merge: adds tags to existing ones; overwrite: replaces existing data. */
  kind: "fill" | "merge" | "overwrite";
  current: string | string[];
  value: string | string[];
  source: MetadataSourceId;
  /** From a close (not exact) title match; never selected by default. */
  fuzzy: boolean;
}

export interface MetadataMatch {
  source: MetadataSourceId;
  id: string;
  title: string;
  /** Title similarity from 0 to 1. */
  score: number;
  matchedBy: "id" | "title" | "fuzzy" | "manual";
  platform: string;
  url: string;
  /** Where Flashpoint got the game from, when known. */
  sourceUrl: string;
}

export interface FlashpointMetadataGame {
  gameId: string;
  title: string;
  coverUrl: string;
  logo: string;
  matches: MetadataMatch[];
  fields: FlashpointMetadataItem[];
}

export interface MetadataUnmatchedGame {
  gameId: string;
  title: string;
  coverUrl: string;
}

interface FlashpointMetadataScanResult {
  status: "ok" | "disabled" | "notFound" | "noSources";
  games: FlashpointMetadataGame[];
  /** Games missing data that no source matched; they can be searched manually. */
  unmatched: MetadataUnmatchedGame[];
}

export interface MetadataSearchResult {
  source: MetadataSourceId;
  id: string;
  title: string;
  platform: string;
  year: string;
  developer: string;
  imageUrl: string;
  url: string;
  score: number;
}

export interface MetadataSearchResponse {
  results: MetadataSearchResult[];
  errors: { source: MetadataSourceId; message: string; status?: number; retryAt?: number }[];
}

interface FlashpointMetadataResult {
  status: FlashpointMetadataScanResult["status"];
  updated: string[];
}

export interface ShowcaseScreenshot {
  name: string;
  url: string;
  /** "flashpoint": imported from a metadata source; "user": from the game's own screenshots folder. */
  source: "flashpoint" | "user";
  importedAt: string;
  size: number;
}

interface AddScreenshotsResult {
  added: string[];
  skipped: number;
}

export interface FlashpointPendingGame {
  key: string;
  title: string;
  format: GameFormat;
  developer: string;
  publisher: string;
  releaseDate: string;
  cover: string;
}

interface FlashpointScanResult {
  status: FlashpointImportResult["status"];
  games: FlashpointPendingGame[];
}

export type GuideFormat = "pdf" | "epub" | "mobi" | "azw3" | "fb2" | "fbz" | "cbz" | "txt" | "md" | "html" | "image" | "video" | "web";

/** A local file copied into the game's `guides` folder, or an online link. */
export interface GameGuide {
  id: string;
  kind: "file" | "link";
  format: GuideFormat;
  title: string;
  fileName?: string;
  url?: string;
  addedAt?: string;
}

export interface GuideVideoPointerInput {
  type: "move" | "click";
  x: number;
  y: number;
}

/** Where a guide was left in the reader. */
export interface GuideReaderState {
  location?: string | number;
  zoom?: number;
  flow?: "paginated" | "scrolled";
  fit?: "width" | "page" | "";
  /** One page, two pages side by side, or two pages with the first (cover) page alone. */
  spread?: "single" | "double" | "cover";
  updatedAt?: string;
}

export interface LoadedGuide {
  gameId: string;
  gameTitle: string;
  guide: GameGuide;
  state: GuideReaderState | null;
  source: { type: "file"; url: string; name: string } | { type: "embed"; url: string } | { type: "web"; url: string };
}

export interface CrtConfig {
  enabled: boolean;
  bezelEnabled: boolean;
  inheritShader: boolean;
  inheritBezel: boolean;
  mask: number;
  gamma: number;
  bloom: number;
  smoothing: boolean;
  /** Shader input scale relative to the Flash stage size (1 to 3 in 0.5 steps). */
  resolution: number;
  bezel: "none" | "builtin" | "beige" | "studio" | "arcade" | "vintage" | "home-builtin" | "home" | "home-studio" | "home-arcade" | "home-vintage" | "custom";
  left: number;
  top: number;
  width: number;
  height: number;
  reflection: boolean;
  bezelThickness: number;
  innerBorder: boolean;
  cornerRadius: number;
  curvature: number;
  background: boolean;
}

export interface Game {
  crt?: CrtConfig;
  crtDisabled?: boolean;
  crtBezelDisabled?: boolean;
  hasIcon?: boolean;
  iconSource?: string;
  shortcutIconCustom?: boolean;
  id: string;
  title: string;
  originalFileName: string;
  storageFileName?: string;
  filePath: string;
  coverPath: string;
  coverUrl: string;
  swfUrl: string;
  format?: GameFormat;
  player?: PlayerId;
  playerVersion?: string;
  compatibility?: Partial<Record<PlayerId, CompatibilityRating>>;
  /** Guides, manuals, e-books and videos attached to the game (electron/guides.cjs). */
  guides?: GameGuide[];
  onlineOnly?: boolean;
  /** Set while an antivirus scan has moved the game file to quarantine. */
  quarantined?: boolean;
  onlineUrl?: string;
  tags: string[];
  category: string;
  description?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  version?: string;
  fullscreenByDefault?: boolean;
  showFps?: boolean;
  standaloneCompatibility?: boolean;
  fixScaling?: boolean;
  pinCursor?: boolean;
  allowOnlineFeatures?: boolean;
  publicResourceUrls?: string[];
  blockedPublicResourceUrls?: string[];
  repeatMusic?: boolean;
  musicEnabled?: boolean;
  customMusic?: { fileName: string; ext: string };
  defaultMusicIndex?: number;
  totalPlaySeconds?: number;
  favorite: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  playCount: number;
  lastPlayedAt: string | null;
  hash: string;
  silvergamesId?: number;
  silvergamesIds?: number[];
  silvergamesDuplicateIds?: number[];
  andkonPagePath?: string;
  y8Slug?: string;
  flashpointId?: string;
  flashpointLaunchUrl?: string;
  y8Slugs?: string[];
  y8DuplicateSlugs?: string[];
  sourceRatingSource?: ExploreSource;
  sourceRating?: number;
  sourceRatingCount?: number;
  sourceRatings?: Record<string, { rating: number; count?: number }>;
  userRating?: number;
  coverStatus: CoverStatus;
  stageWidth: number | null;
  stageHeight: number | null;
}

export type PlayerWindowData = Pick<Game, "id" | "title" | "swfUrl" | "stageWidth" | "stageHeight" | "fullscreenByDefault" | "showFps" | "format" | "player"> & {
  crt?: CrtConfig;
  crtDisabled?: boolean;
  crtBezelDisabled?: boolean;
  volume?: number;
  sessionStartedAt?: number;
  standaloneCompatibility?: boolean;
  fixScaling?: boolean;
  pinCursor?: boolean;
  allowOnlineFeatures?: boolean;
  originalFileName?: string;
  flashpointLaunchUrl?: string | null;
  flashpointContent?: boolean;
  publicResourceUrls?: string[];
  publicResourceRelayUrls?: string[];
  onlineOnly?: boolean;
};

export interface AppInfo {
  version: string;
  author: string;
  repository: string;
  ruffleVersion: string;
  dirplayerVersion?: string;
  foliateVersion?: string;
  pdfjsVersion?: string;
  electronVersion?: string;
  chromiumVersion?: string;
  nodeVersion?: string;
  softwareCredits?: { id: "react" | "lucide-react" | "marked" | "foliate" | "pdfjs" | "ruffle" | "dirplayer" | "electron" | "sdl" | "libreshockwave" | "crt-royale" | "selawik" | "google-fonts"; name: string; repository: string; version: string; license: string; notice: string }[];
}

export type RuffleChannel = "stable" | "nightly";

export interface InputRuntime { wine: boolean; gamescope: boolean; gameShortcuts?: "desktop" | "steam" | null }
export type ShortcutTarget = "desktop" | "steam";
export interface GameShortcuts {
  desktop: { exists: boolean } | null;
  steam: {
    available: boolean; reason: "notInstalled" | "unsupported" | "unreadable" | null; exists: boolean; name: string | null;
    renamed?: boolean; running: boolean;
  } | null;
}

export interface RuffleRuntimeState {
  channel: RuffleChannel;
  activeChannel: RuffleChannel;
  activeVersion: string;
  stableVersion: string;
  nightlyVersion: string;
  installing: boolean;
  scriptUrl: string;
}

export type GameFormat = "swf" | "dcr";
export type CustomPlayerId = "custom" | `custom-${number}`;
export type PlayerId = "ruffle" | "dirplayer" | "libreshockwave" | "flashpoint-flash" | "flashpoint-shockwave" | "flash-projector" | "newgrounds" | CustomPlayerId;
export type PlayerCapability = "fullscreen" | "fixScaling" | "standalone" | "online" | "resources" | "remap" | "pinCursor";
export type CompatibilityRating = "works" | "issues" | "broken";

interface FlashpointCompatibility {
  id: string;
  title: string;
  matchedBy: "id" | "title";
  /** Flashpoint status parts, e.g. ["Playable"], ["Partial", "Playable"], ["Not Working"]. */
  status: string[];
  /** Non-empty (e.g. "standalone") when Flashpoint curators verified the game in Ruffle. */
  ruffleSupport: string;
}

export interface GameCompatibilityInfo {
  actionScript3: boolean | null;
  swfVersion: number | null;
  flashpointInstalled: boolean;
  flashpoint: FlashpointCompatibility | null;
}

interface PlayerVariant {
  id: string;
  label: string;
  version: string;
}

export interface PlayerState {
  id: PlayerId;
  kind: "builtin" | "flashpoint" | "exe";
  formats: GameFormat[];
  name: string;
  author: string;
  homepage: string;
  downloadUrl: string;
  license: string;
  capabilities: PlayerCapability[];
  path: string;
  manual: boolean;
  available: boolean;
  version: string;
  variants: PlayerVariant[];
}

export interface CustomPlayerConfig {
  name: string;
  args: string;
  formats: GameFormat[];
}

export interface UpdateCheckResult {
  status: "available" | "current" | "error";
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  releaseUrl: string;
  automaticUpdateAvailable?: boolean;
}

export interface UpdateCheckResult {
  status: "available" | "current" | "error";
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  releaseUrl: string;
}

export interface LibraryState {
  libraryRoot: string;
  games: Game[];
}
export interface ImportResult extends LibraryState {
  imported?: Game[];
  skipped?: Array<{ path: string; reason: string; game?: Game }>;
  cancelled?: boolean;
}

export interface ImportProgress {
  current: number;
  total: number;
  fileName: string;
  filePath: string;
}

/** What the activity history records (electron/activity-history.cjs). */
export type ActivityKind =
  | "notice" | "appUpdate" | "ruffleNightly" | "flashpointScan" | "flashpointImport" | "flashpointMetadata" | "antivirusScan" | "antivirusThreat"
  | "localImport" | "exploreImport" | "storageMigration" | "metadataApply" | "sourcesCheck" | "securityCheck" | "securityAlert"
  | "coverCapture" | "guideAdd" | "guideDownload" | "musicCheck" | "musicNormalize" | "musicImport";

export type ActivityStatus = "running" | "done" | "failed" | "cancelled" | "interrupted" | "info" | "alert";

export type OnscreenMode = "auto" | "enabled" | "disabled";
export type OnscreenTarget = { kind: "key"; code: string; key: string } | { kind: "mouseButton"; button: 0 | 1 | 2 };
export interface OnscreenControl {
  id: string;
  visible: boolean;
  mouse: boolean;
  targets: OnscreenTarget[];
}
export interface OnscreenConfig {
  version: 3;
  style: ControllerStyle | "global";
  enabled: boolean;
  configured: boolean;
  opacity: number;
  sensitivity: number;
  deadzone: number;
  controls: OnscreenControl[];
  layouts: Record<"portrait" | "landscape", Record<string, { x: number; y: number; size: number }>>;
}

export interface ActivityEntry {
  suppressWhileRunning?: boolean;
  id: string;
  kind: ActivityKind;
  status: ActivityStatus;
  startedAt: string;
  endedAt?: string;
  title?: string;
  text?: string;
  detail?: string;
  count?: number;
  skipped?: number;
  progress?: { current?: number; total?: number; percent?: number; label?: string; stage?: string };
}

export interface TaskProgressState extends ActivityEntry {
  cancellable?: boolean;
}

export interface ExploreImportProgressState {
  title: string;
  stage: "preparing" | "downloading" | "saving";
  percent: number | null;
  receivedBytes: number;
  totalBytes: number | null;
}

export interface GameStorageMigrationProgress {
  current: number;
  total: number;
  gameTitle: string;
  percent: number;
}

type BuiltinExploreSource = "silvergames" | "andkon" | "y8";
/** An Explore catalog id; catalogs added through GitHub definitions use other ids. */
export type ExploreSource = BuiltinExploreSource | (string & {});

export interface ExploreSourceInfo {
  id: ExploreSource;
  name: string;
  builtin: boolean;
  /** Read from a data definition rather than the app's own code for that site. */
  generic: boolean;
  siteUrl: string;
}

interface ExploreGame {
  id: number | string;
  source: ExploreSource;
  slug: string;
  title: string;
  imageUrl: string;
  tags: string[];
  sourceRating: number | null;
  imported: boolean;
  duplicateOf: string | null;
  likes?: string | null;
  onlineOnly?: boolean;
  onlineUrl?: string;
  category?: string;
}

export interface ExplorePage {
  games: ExploreGame[];
  page: number;
  totalPages: number;
  total: number;
  categories?: Array<{ slug: string; name: string }>;
  totalIsPageCount?: boolean;
  hasNext?: boolean;
}

export interface ExploreDetailsGame extends Pick<ExploreGame, "id" | "source" | "slug" | "title" | "imageUrl" | "tags" | "imported" | "sourceRating" | "duplicateOf" | "onlineOnly" | "onlineUrl">, SwfMetadata {
  fallbackImageUrl: string;
  libraryGameId: string | null;
  libraryGameTitle: string | null;
  description: string;
  instructions: string;
  authorInfo: string;
  sourceRatingCount: number | null;
  ageRating: string | null;
  uploadDate: string | null;
  siteRating?: number | null;
  ratingScale?: number;
  sitePlayCount?: number | null;
  likes?: string | null;
  category?: string;
  developer?: string;
  addedDate?: string | null;
  /** Catalogs from data definitions: catalog name and the game's page. */
  siteName?: string;
  siteUrl?: string;
}

export type ExploreSortMode = "rating" | "name" | "popularity" | "date";

export interface GamePatch {
  crt?: CrtConfig | null;
  crtDisabled?: boolean;
  crtBezelDisabled?: boolean;
  /** Copy inherited artwork when creating a per-game custom-bezel override. Not persisted. */
  crtBezelFromGlobal?: boolean;
  musicEnabled?: boolean;
  title?: string;
  tags?: string[];
  category?: string;
  description?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  version?: string;
  fullscreenByDefault?: boolean;
  showFps?: boolean;
  standaloneCompatibility?: boolean;
  fixScaling?: boolean;
  allowOnlineFeatures?: boolean;
  player?: PlayerId | null;
  playerVersion?: string | null;
  compatibility?: Partial<Record<PlayerId, CompatibilityRating | null>>;
  publicResourceUrls?: string[];
  blockedPublicResourceUrls?: string[];
  repeatMusic?: boolean;
  totalPlaySeconds?: number;
  favorite?: boolean;
  userRating?: number | null;
  notes?: string;
}

export type RemapSource =
  | { kind: "button"; index: number }
  | { kind: "axis"; index: number; direction: 1 | -1 }
  /** Whole surface of a Steam Controller trackpad (0 = left, 1 = right). */
  | { kind: "trackpad"; index: 0 | 1 };

export type RemapTarget =
  | { kind: "key"; code: string; key: string }
  | { kind: "mouseButton"; button: 0 | 1 | 2 }
  | { kind: "mouseMove"; direction: "up" | "down" | "left" | "right" }
  | { kind: "mouseWheel"; direction: "up" | "down" }
  /** Trackpad surface as a Steam-style trackball mouse. */
  | { kind: "trackpadMouse" }
  /** Trackpad surface as a Steam-style swipe scroll wheel. */
  | { kind: "trackpadScroll" };

export interface TrackpadTuning {
  /** Percent of Steam's default pointer speed. */
  sensitivity: number;
  /** Percent of Steam's default pointer acceleration (0 = linear). */
  acceleration: number;
  trackball: boolean;
  /** Haptic tick strength in percent (0 = off). */
  haptics: number;
}

export interface DesktopTrackpadMapping {
  motion: "pointer" | "scroll" | "none";
  click: Extract<RemapTarget, { kind: "key" | "mouseButton" }> | { kind: "none" };
}

export interface RemapBinding {
  source: RemapSource;
  target: RemapTarget;
}

export interface PlayerRemap {
  enabled: boolean;
  deadzone: number;
  mouseSpeed: number;
  trackpad: TrackpadTuning;
  bindings: RemapBinding[];
}

export interface GameRemapConfig {
  version: 1;
  players: PlayerRemap[];
  touchLongPressRightClick?: boolean;
  assignments?: ControllerAssignment[];
}

export interface ControllerPreset {
  id: string;
  name: string;
  player: PlayerRemap;
}

export interface ControllerNickname {
  id: string;
  ordinal: number;
  name: string;
}

interface GameRemapData {
  gameId: string;
  title: string;
  configPath: string;
  config: GameRemapConfig;
}

export type ControllerAssignment =
  | { mode: "auto" }
  | { mode: "none" }
  | { mode: "device"; id: string; ordinal: number };

/** A controller seen by any app window (`index` is the browser-wide gamepad index). */
interface KnownController {
  index: number;
  id: string;
}

export interface NativeController extends KnownController {
  buttons: GamepadButton[];
  axes: number[];
}

export type NavigationAction = "up" | "down" | "left" | "right" | "confirm" | "back" | "previous" | "next" | "keyboard" | "gameInfo" | "launch" | "explore" | "previousPanel" | "nextPanel";
export type ControllerStyle = "xbox" | "playstation" | "switch" | "steam" | "generic";
export interface ControllerNavigationConfig {
  version: 1;
  enabled: boolean;
  showHints: boolean;
  /** Keep controller mode active while tapping with touch (useful on handheld PCs). */
  touchControllerMode?: "off" | "auto" | "always";
  keepControllerModeOnTouch?: boolean;
  /** Opens the on-screen keyboard when a text field is confirmed with a controller. */
  virtualKeyboardController: boolean;
  /** Opens the on-screen keyboard when a text field is clicked with the mouse. */
  virtualKeyboardMouse: boolean;
  virtualKeyboardTouch?: boolean;
  virtualKeyboardLayout?: import("./keyboard-layouts").KeyboardLayoutId;
  style: ControllerStyle | "auto";
  playerMenuButtons: [number, number];
  /** Held together in a game: takes a screenshot, or opens the last one while its notice is shown. */
  screenshotButtons: [number, number];
  pauseButtons?: [number, number] | null;
  buttons: Record<NavigationAction, number>;
  /** Native Steam Controller trackpads driving the Windows pointer outside games. */
  trackpad: TrackpadTuning;
  /** Left/right trackpad mappings shared by the app and background desktop input, not games. */
  desktopTrackpads: [DesktopTrackpadMapping, DesktopTrackpadMapping];
}

export type ControllerFileKind = "swf" | "cover" | "music" | "cursor" | "image" | "exe" | "json" | "guide" | "folder";
export type VirtualKeyboardRequest = { layout?: import("./keyboard-layouts").KeyboardLayoutId } & (
  | { kind: "text"; language: Language; value: string; selectionStart: number; selectionEnd: number; multiline: boolean; attributes: Record<string, string> }
  | { kind: "key"; language: Language }
  | { kind: "game"; language: Language; gameId: string });
export type VirtualKeyboardResult =
  | { kind: "text"; value: string; selectionStart: number; selectionEnd: number }
  | { kind: "key"; key: Extract<RemapTarget, { kind: "key" }> }
  | { kind: "game" };
export type VirtualKeyboardInput =
  | { type: "text"; text: string }
  | { type: "key"; key: "Backspace" | "Delete" | "Tab" | "Enter" | "Escape" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End" };
export interface ControllerFileListing {
  directory: string;
  parent: string | null;
  locations: string[];
  entries: { name: string; path: string; directory: boolean }[];
}

interface CaptureRect { x: number; y: number; width: number; height: number }

export interface GameScreenshot {
  name: string;
  url: string;
  takenAt: string;
  size?: number;
  width?: number;
  height?: number;
  /** Shown in the game's showcase screenshots. */
  showcased?: boolean;
}

export interface GameScreenshotList {
  gameId: string;
  title: string;
  coverUrl: string;
  screenshots: GameScreenshot[];
}

type SecurityFeed = "github" | "osv" | "kev" | "nvd" | "repos";

export interface SecurityThreat {
  id: string;
  ids: string[];
  title: string;
  summary: string;
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  exploited: boolean;
  /** "yes" when the installed version is affected; `estimated` when judged from release dates. */
  affects: "yes" | "no" | "unknown";
  estimated?: boolean;
  /** The installed Electron line no longer gets security fixes. */
  unsupported?: boolean;
  published: string;
  component: string;
  installed: string;
  fixedIn: string;
  sources: SecurityFeed[];
  links: { source: SecurityFeed; url: string }[];
  blocking: boolean;
  overridden: boolean;
  /** Hidden from the Settings list by the user; shown again if the alert gets worse. */
  hidden?: boolean;
}

export interface SecurityStatus {
  blocked: boolean;
  /** Why online features are paused: an alert, the user, or an earlier alert awaiting a new check. */
  reason: "" | "threat" | "manual" | "pending";
  /** Alert ids the warning window should show. */
  prompt: string[];
  threats: SecurityThreat[];
  checkedAt: number;
  nextCheckAt: number;
  checking: boolean;
  errors: Partial<Record<"github" | "osv" | "kev" | "nvd" | "repos", string>>;
  override: boolean;
  versions: Record<string, string>;
  /** Electron fixes only its latest three major versions. */
  electronSupport?: { supported: boolean; major: number; oldestSupported: number } | null;
  sources: SourcesOrigin | null;
}

interface SourcesOrigin {
  from: "bundled" | "github" | "local";
  signedAt: string;
  keyId: string;
  checkedAt: number;
  /** Why the last check for new source definitions failed, if it did. */
  error?: string;
}

interface SourceFileInfo {
  id: string;
  name: string;
  /** File name in the sources/enabled or sources/disabled folder on GitHub. */
  file: string;
  url: string;
  /** Why this file could not be used, if it could not. */
  problem: string;
  remoteDisabled?: boolean;
}

export interface SourcesStatus {
  autoUpdate: boolean;
  blocked: boolean;
  origin: SourcesOrigin;
  folderUrl: string;
  catalogs: Array<SourceFileInfo & { enabled: boolean }>;
  metadata: SourceFileInfo[];
  problems: Array<{ file: string; message: string; url: string }>;
}

export type AntivirusProviderId = "defender" | "virustotal" | "metadefender";

export interface AntivirusSettings {
  enabled: boolean;
  providers: Record<AntivirusProviderId, boolean>;
  /** Uploads files the online sources don't know yet. */
  upload: boolean;
  /** Online sources: engines that must flag a file before it counts as a threat. */
  minDetections: number;
}

export interface AntivirusThreat {
  gameId: string;
  metadata?: boolean;
  title: string;
  fileName: string;
  at: string;
  quarantined: boolean;
  /** Another antivirus removed the file before Flash Royale could quarantine it. */
  removed: boolean;
  quarantineError: string;
  results: Array<{ provider: AntivirusProviderId; malicious: number; total: number; names: string[]; link: string }>;
}

export interface AntivirusStatus {
  settings: AntivirusSettings;
  blocked: boolean;
  uploadLimitMb: number;
  detectionChoices: number[];
  providers: Array<{ id: AntivirusProviderId; name: string; online: boolean; available: boolean; hasKey: boolean; keyHint: string; keyPage: string; enabled: boolean }>;
  scan: { running: boolean; done: number; total: number; current: string };
  counts: { games: number; scanned: number; pending: number };
  threats: AntivirusThreat[];
  problems: Array<{ gameId: string; title: string; provider: AntivirusProviderId; message: string; at: string }>;
}

type AppNotice = { kind: "nativeControllerFailed" | "gameLaunchFailed"; detail: string };
export type ExternalLinkRequest = { id: string; url: string };

export interface FlashApi {
  listControllerFiles(directory: string | null, kind: ControllerFileKind): Promise<ControllerFileListing>;
  getControllerNavigation(): Promise<ControllerNavigationConfig>;
  setControllerNavigation(config: ControllerNavigationConfig): Promise<ControllerNavigationConfig>;
  onControllerNavigationChanged(callback: (config: ControllerNavigationConfig) => void): () => void;
  getPathForFile(file: File): string;
  inputRuntime?: InputRuntime;
  getAssetBaseUrl(): Promise<string>;
  openVirtualKeyboard?(request: VirtualKeyboardRequest): Promise<VirtualKeyboardResult | null>;
  getVirtualKeyboard?(): Promise<VirtualKeyboardRequest>;
  finishVirtualKeyboard?(result: VirtualKeyboardResult | null): Promise<void>;
  typeVirtualKeyboard?(input: VirtualKeyboardInput): Promise<void>;
  focusVirtualKeyboard?(): Promise<void>;
  cancelVirtualKeyboard?(): Promise<void>;
  getAppInfo(): Promise<AppInfo | null>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  openUpdatePage(releaseUrl: string): Promise<void>;
  /** Opens a link from the release notes (after the external link warning). */
  openChangelogLink(url: string): Promise<boolean>;
  installUpdate(version: string, unblock: boolean, enableScriptExecution?: boolean): Promise<void>;
  getCheckForUpdatesOnStart(): Promise<boolean>;
  setCheckForUpdatesOnStart(enabled: boolean): Promise<boolean>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  openUpdatePage(releaseUrl: string): Promise<void>;
  getStartInFullscreen(): Promise<boolean>;
  chooseCursorImage(title: string, filterName: string, selectedPath?: string): Promise<{ dataUrl: string; name: string } | null>;
  chooseCursorImages?(title: string, filterName: string, selectedPaths?: string[]): Promise<{ dataUrl: string; name: string }[] | null>;
  exportCursorPack?(title: string, files: { name: string; dataUrl: string }[], selectedFolder?: string): Promise<{ folder: string; count: number } | null>;
  /** Raw stored cursor settings (validated by cursor-theme.ts), or null when never saved. */
  getCursorSettings?(): Promise<unknown>;
  setCursorSettings?(settings: unknown): Promise<unknown>;
  onCursorSettingsChanged?(callback: (settings: unknown) => void): () => void;
  /** Raw stored theme settings (validated by theme.ts), or null when never saved. */
  getThemeSettings?(): Promise<unknown>;
  /** `windowLook` is the active theme's background color and scheme, for native window backgrounds. */
  setThemeSettings?(settings: unknown, windowLook: { background: string; scheme: "dark" | "light" }): Promise<unknown>;
  onThemeSettingsChanged?(callback: (settings: unknown) => void): () => void;
  /** Text of a theme file chosen in the in-app file browser (at most 8 MB). */
  readThemeFile?(selectedPath: string): Promise<string>;
  /** A chosen wallpaper image as a data URL (PNG, JPEG, WebP, GIF or BMP, at most 20 MB); theme.ts scales it down. */
  readThemeWallpaper?(selectedPath: string): Promise<string>;
  /** Writes a theme file into the chosen folder; returns the written path. */
  exportThemeFile?(fileName: string, text: string, selectedFolder: string): Promise<string | null>;
  /** Custom title bar controls for windows created with `titleBarStyle: "hidden"`. */
  windowControls?: {
    readonly isPanel?: boolean;
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    startDrag(): void;
    startResize(edge: string): void;
    moveBy(x: number, y: number): void;
    getPosition?(): Promise<{ x: number; y: number }>;
    setPosition?(x: number, y: number): Promise<void>;
    endDrag(): void;
    getState(): Promise<{ maximized: boolean; fullscreen: boolean; panel?: boolean }>;
    onStateChanged(callback: (state: { maximized: boolean; fullscreen: boolean; panel?: boolean }) => void): () => void;
  };
  setPanelBackdropDismissible?(enabled: boolean): void;
  onPanelBackdropChanged?(callback: (state: { id: number; dismissible: boolean } | null) => void): () => void;
  onPanelVisibilityChanged?(callback: (visible: boolean) => void): () => void;
  closePanelFromBackdrop?(id: number): void;
  setStartInFullscreen(enabled: boolean): Promise<boolean>;
  getMinimizeToTrayOnGameLaunch(): Promise<boolean>;
  setMinimizeToTrayOnGameLaunch(enabled: boolean): Promise<boolean>;
  getMinimizeToTrayOnMinimize(): Promise<boolean>;
  setMinimizeToTrayOnMinimize(enabled: boolean): Promise<boolean>;
  getExploreAvailability(): Promise<{ enabled: boolean; online: boolean; blocked?: boolean }>;
  getAndkonEnabled(): Promise<boolean>;
  setAndkonEnabled(enabled: boolean): Promise<boolean>;
  setExploreEnabled(enabled: boolean): Promise<boolean>;
  getMusicNormalization(): Promise<MusicNormalizationSettings>;
  cancelExploreImport(): Promise<void>;
  hideExploreImportProgress(): Promise<void>;
  cancelGameStorageMigration(): Promise<void>;
  onHistoryTaskCancelled(callback: (id: string) => void): () => void;
  musicNormalizationAvailable(): Promise<boolean>;
  checkMusicNormalization(): Promise<MusicNormalizationReport>;
  getMusicNormalizationReport(): Promise<MusicNormalizationReport | null>;
  normalizeLibraryMusic(): Promise<MusicNormalizationReport>;
  listMusicBackups(): Promise<MusicBackupReport>;
  restoreMusicBackup(id: string): Promise<MusicBackupReport>;
  deleteMusicBackup(id: string): Promise<MusicBackupReport>;
  setMusicNormalization(settings: MusicNormalizationSettings): Promise<MusicNormalizationSettings>;
  getManualImportEnabled(): Promise<boolean>;
  getAllGamesFullscreen(): Promise<boolean>;
  getLibraryMusicEnabled(): Promise<boolean>;
  getImportDefaultMusic(): Promise<boolean>;
  setImportDefaultMusic(enabled: boolean): Promise<boolean>;
  importDefaultMusic(all: boolean, gameIds?: string[]): Promise<{ count: number; cancelled: boolean }>;
  getOnscreenMode(): Promise<OnscreenMode>;
  getOnscreenStyle(): Promise<ControllerStyle>;
  getOnscreenToolbarArrow(): Promise<boolean>;
  setOnscreenToolbarArrow(enabled: boolean): Promise<boolean>;
  onOnscreenToolbarArrowChanged(callback: (enabled: boolean) => void): () => void;
  setOnscreenStyle(style: ControllerStyle): Promise<ControllerStyle>;
  onOnscreenStyleChanged(callback: (style: ControllerStyle) => void): () => void;
  setOnscreenMode(mode: OnscreenMode): Promise<OnscreenMode>;
  getOnscreenGamepad(gameId: string): Promise<{ title: string; config: OnscreenConfig }>;
  saveOnscreenGamepad(gameId: string, config: OnscreenConfig): Promise<OnscreenConfig>;
  openOnscreenGamepad(gameId: string, language: string): Promise<void>;
  onOnscreenModeChanged(callback: (mode: OnscreenMode) => void): () => void;
  onOnscreenGamepadChanged(callback: (gameId: string, config: OnscreenConfig) => void): () => void;
  setLibraryMusicEnabled(enabled: boolean): Promise<boolean>;
  setAllGamesFullscreen(enabled: boolean): Promise<boolean>;
  onAllGamesFullscreenChanged(callback: (enabled: boolean) => void): () => void;
  getShowFpsCounter(): Promise<boolean>;
  setShowFpsCounter(enabled: boolean): Promise<boolean>;
  onShowFpsCounterChanged(callback: (enabled: boolean) => void): () => void;
  getFpsCounterStyle(): Promise<unknown>;
  setFpsCounterStyle(style: unknown): Promise<unknown>;
  onFpsCounterStyleChanged(callback: (style: unknown) => void): () => void;
  setManualImportEnabled(enabled: boolean): Promise<boolean>;
  onAppVisibilityChanged(callback: (visible: boolean) => void): () => void;
  /** Main window only: true when neither maximized nor fullscreen. */
  onWindowedChanged?(callback: (windowed: boolean) => void): () => void;
  getWindowResizeState?(): Promise<{ windowed: boolean; resizable: boolean; width: number; height: number; centered?: boolean } | null>;
  setWindowSize?(width: number, height: number, centerWhenCentered?: boolean): void;
  centerWindow(): Promise<void>;
  copyPublicResourceUrl(gameId: string, url: string): Promise<void>;
  openGameFolder(gameId: string): Promise<void>;
  getSwfMetadata(gameId: string): Promise<SwfMetadata | null>;
  getCompatibilities(gameIds: string[]): Promise<Record<string, GameCompatibilityInfo>>;
  chooseShockwaveAssets(gameId: string, language: string, selectedFolder?: string): Promise<{ copied: boolean }>;
  getPlayers(rescan?: boolean): Promise<PlayerState[]>;
  choosePlayerPath(playerId: PlayerId, selectedPath?: string): Promise<PlayerState[]>;
  resetPlayerPath(playerId: PlayerId): Promise<PlayerState[]>;
  getCustomPlayer(playerId?: CustomPlayerId): Promise<CustomPlayerConfig>;
  getFlashpointImportSettings(): Promise<FlashpointImportSettings>;
  setFlashpointImportSettings(patch: Partial<FlashpointImportSettings>): Promise<FlashpointImportSettings>;
  scanFlashpointDownloads(manual?: boolean): Promise<FlashpointScanResult>;
  importFlashpointDownloads(language: Language, selectedKeys: string[], shownKeys: string[], manual?: boolean): Promise<FlashpointImportResult>;
  onFlashpointDownloadsChanged(callback: () => void): () => void;
  scanFlashpointMetadata(manual?: boolean): Promise<FlashpointMetadataScanResult>;
  /** `selections` maps game IDs to the fields to apply; null applies only the "fill" items of every game. */
  applyFlashpointMetadata(language: Language, selections: Record<string, FlashpointMetadataField[]> | null, shownIds: string[], manual?: boolean): Promise<FlashpointMetadataResult>;
  openMetadataLink(url: string): Promise<void>;
  /** Searches every enabled metadata source; sources that fail are listed in `errors`. */
  searchMetadata(query: string): Promise<MetadataSearchResponse>;
  /** What a picked search result can add to a library game. */
  proposeMetadata(gameId: string, source: MetadataSourceId, id: string): Promise<FlashpointMetadataGame>;
  applyMetadataFrom(language: Language, gameId: string, source: MetadataSourceId, id: string, fields: FlashpointMetadataField[]): Promise<FlashpointMetadataResult>;
  setCustomPlayer(custom: Partial<CustomPlayerConfig>, playerId?: CustomPlayerId): Promise<{ custom: CustomPlayerConfig; players: PlayerState[] }>;
  addCustomPlayer(): Promise<PlayerState[]>;
  removeCustomPlayer(playerId: CustomPlayerId): Promise<PlayerState[]>;
  openPlayerLink(playerId: PlayerId, kind: "homepage" | "download"): Promise<void>;
  openRepository(): Promise<void>;
  /** Opens the GitHub release page of a bundled component's current version. */
  openComponentRelease?(component: "app" | NonNullable<AppInfo["softwareCredits"]>[number]["id"]): Promise<void>;
  openOriginalAuthorRepository(): Promise<void>;
  openAuthorProfile?(): Promise<void>;
  listHistory(): Promise<ActivityEntry[]>;
  clearHistory(): Promise<void>;
  openHistory(language: string): Promise<void>;
  noteHistory(message: string, level?: "info" | "alert"): Promise<void>;
  beginHistoryTask(kind: ActivityKind, total: number): Promise<string>;
  updateHistoryTask(id: string, current: number, total: number, label?: string): Promise<void>;
  endHistoryTask(id: string, status: "done" | "failed" | "cancelled", values?: { count?: number; detail?: string }): Promise<void>;
  onHistoryChanged(callback: (summary: { running: number }) => void): () => void;
  getTaskProgress(): Promise<TaskProgressState | null>;
  hideTaskProgress(): Promise<void>;
  cancelTask(): Promise<void>;
  onTaskProgress(callback: (task: TaskProgressState) => void): () => void;
  openExplore(): Promise<void>;
  listExploreGames(query: string, page: number, pageSize: number, sortMode: ExploreSortMode, ascending: boolean, source?: ExploreSource, category?: string, refresh?: boolean, showOnlineOnlyGames?: boolean): Promise<ExplorePage>;
  cancelExploreList(): void;
  openExploreSite(source?: ExploreSource): Promise<void>;
  getExploreSources(): Promise<ExploreSourceInfo[]>;
  onSourcesChanged(callback: () => void): () => void;
  getSourcesStatus(): Promise<SourcesStatus>;
  setSourcesAutoUpdate(enabled: boolean): Promise<SourcesStatus>;
  checkSourcesNow(): Promise<SourcesStatus>;
  importSourceFiles(paths: string[]): Promise<{ changed: boolean; files: number; signedAt: string; status: SourcesStatus }>;
  setCatalogEnabled(id: string, enabled: boolean): Promise<SourcesStatus>;
  /** Opens the sources folder on GitHub, or a file in its current enabled/disabled folder. */
  openSourcesGithub(file?: string): Promise<void>;
  getAntivirusStatus?(): Promise<AntivirusStatus>;
  setAntivirusSettings(patch: Partial<Omit<AntivirusSettings, "providers">> & { providers?: Partial<Record<AntivirusProviderId, boolean>> }): Promise<AntivirusStatus>;
  /** Saves (or with "" removes) an online source's API key; the key is checked with the source first when possible. */
  setAntivirusKey(provider: AntivirusProviderId, key: string): Promise<{ verified: boolean; status: AntivirusStatus }>;
  scanLibraryForViruses(force?: boolean): Promise<AntivirusStatus>;
  cancelVirusScan(): Promise<AntivirusStatus>;
  restoreQuarantinedGame(gameId: string): Promise<AntivirusStatus>;
  deleteQuarantinedGame(gameId: string): Promise<AntivirusStatus>;
  openAntivirusKeyPage(provider: AntivirusProviderId): Promise<void>;
  openAntivirusReport(url: string): Promise<void>;
  onAntivirusChanged?(callback: () => void): () => void;
  onAntivirusThreat?(callback: (threat: AntivirusThreat) => void): () => void;
  getSecurityStatus?(): Promise<SecurityStatus>;
  checkSecurity?(): Promise<SecurityStatus>;
  /** Stays offline and stops showing the warning for the current alerts. */
  securityKeepOffline?(): Promise<SecurityStatus>;
  /** Re-enables online features despite the current alerts. */
  securityGoOnline?(): Promise<SecurityStatus>;
  securityBlockNow?(): Promise<SecurityStatus>;
  setSecurityAlertHidden?(id: string, hidden: boolean): Promise<SecurityStatus>;
  openSecurityLink?(url: string): Promise<void>;
  onSecurityChanged?(callback: (status: SecurityStatus) => void): () => void;
  openExploreDetails(id: ExploreGame["id"], source?: ExploreSource, controller?: boolean): Promise<void>;
  getExploreGameDetails(id: ExploreGame["id"], source?: ExploreSource): Promise<ExploreDetailsGame>;
  importExploreGame(id: ExploreGame["id"], language: Language, source?: ExploreSource): Promise<{ imported: boolean; alreadyInLibrary: boolean; title: string; duplicateOf?: string | null }>;
  getExploreImportProgress(): Promise<ExploreImportProgressState>;
  onExploreImportProgress(callback: (progress: ExploreImportProgressState) => void): () => void;
  getGameStorageMigrationProgress(): Promise<GameStorageMigrationProgress>;
  onGameStorageMigrationProgress(callback: (progress: GameStorageMigrationProgress) => void): () => void;
  onExploreImported(callback: (title: string) => void): () => void;
  onExploreLibraryChanged(callback: () => void): () => void;
  openPlayer(game: PlayerWindowData, language: Language): Promise<void>;
  openOnlineOnlyGame(gameId: string, language: Language): Promise<void>;
  closePlayer(gameId: string): Promise<void>;
  getRunningPlayers(): Promise<string[]>;
  onCloseBlocked(callback: (reason: "game" | "explore") => void): () => void;
  /** Messages that used to be native message boxes (for example a native controller input failure). */
  onAppNotice?(callback: (notice: AppNotice) => void): () => void;
  /** Main asks this window to confirm a web link before it opens in the browser. */
  onExternalLinkRequest?(callback: (request: ExternalLinkRequest) => void): () => void;
  getExternalLinkRequest?(id: string): Promise<string | null>;
  resolveExternalLink?(id: string, confirmed: boolean): Promise<void>;
  onRunningPlayersChange(callback: (gameIds: string[]) => void): () => void;
  setPlayerFullscreen(fullscreen: boolean): Promise<boolean>;
  openRemapWindow(gameId: string, language: Language): Promise<void>;
  listGuides(gameId: string): Promise<GameGuide[]>;
  /** `filePath` comes from the in-app file browser; null means nothing was chosen. */
  addGuideFile(gameId: string, filePath: string | null, title?: string): Promise<Game>;
  addGuideLink(gameId: string, url: string, title?: string): Promise<Game>;
  updateGuide(gameId: string, guideId: string, patch: { title?: string; url?: string }): Promise<Game>;
  removeGuide(gameId: string, guideId: string): Promise<Game>;
  reorderGuides(gameId: string, ids: string[]): Promise<Game>;
  /** Web pages open in the browser after the link warning ("browser"/"cancelled"); the rest in a reader window. */
  openGuide(gameId: string, guideId: string, language: Language, options?: { beside?: boolean }): Promise<"reader" | "browser" | "cancelled">;
  focusGuideReader(gameId: string): Promise<boolean>;
  loadGuide(gameId: string, guideId: string): Promise<LoadedGuide>;
  guideVideoPointer(input: GuideVideoPointerInput): Promise<void>;
  guideVideoCursor(hidden: boolean, cursors?: Partial<Record<"default" | "pointer" | "text", string>>): Promise<void>;
  onGuideVideoMouseMoved?(callback: () => void): () => void;
  saveGuideState(gameId: string, guideId: string, state: GuideReaderState): Promise<void>;
  openGuideLink(url: string): Promise<boolean>;
  onGuidesChanged(callback: (change: { gameId: string; guides: GameGuide[] }) => void): () => void;
  onGuideDownloadProgress(callback: (progress: { guideId: string; received: number; total: number }) => void): () => void;
  takeScreenshot(gameId: string, rect: CaptureRect): Promise<GameScreenshot>;
  captureGameImage(gameId: string, rect: CaptureRect): Promise<string>;
  listScreenshots(gameId: string): Promise<GameScreenshotList>;
  deleteScreenshot(gameId: string, name: string): Promise<void>;
  openScreenshotsFolder(gameId: string): Promise<void>;
  /** Opens the gallery; with `screenshotName`, that screenshot is shown in the viewer. */
  openScreenshotsWindow(gameId: string, language: Language, screenshotName?: string, shortcutIcon?: boolean | ShortcutTarget): Promise<void>;
  openCropWindow?(options: {
    gameId: string;
    language: Language;
    mode: "cover" | "shortcut";
    source: string;
    ratio?: number;
    title?: string;
    hint?: string;
    applyLabel?: string;
  }): Promise<string>;
  getCropSource?(requestId: string): Promise<{
    gameId: string;
    mode: "cover" | "shortcut";
    source: string;
    ratio?: number;
    title?: string;
    hint?: string;
    applyLabel?: string;
  }>;
  completeCropWindow?(
    requestId: string,
    status: "cancelled" | "applied" | "created"
  ): Promise<void>;
  onCropResult?(callback: (result: {
    requestId: string;
    gameId: string;
    mode: "cover" | "shortcut";
    status: "cancelled" | "applied" | "created";
  }) => void): () => void;
  createDesktopShortcut(gameId: string, image?: { path?: string; dataUrl?: string; source?: "default" | "custom"; target?: ShortcutTarget }): Promise<{ status: "needsIcon" } | { status: "created"; path: string | null; steamRunning?: boolean; live?: boolean }>;
  getGameShortcuts(gameId: string): Promise<GameShortcuts>;
  deleteGameShortcut(gameId: string, target: ShortcutTarget): Promise<{ status: "deleted"; steamRunning?: boolean }>;
  previewShortcutIcon(gameId: string, image?: { path?: string; source?: "default" | "custom" }): Promise<string | null>;
  onShortcutIconRequested(callback: (target: ShortcutTarget) => void): () => void;
  onShowScreenshot?(callback: (name: string) => void): () => void;
  setCoverFromScreenshot(gameId: string, dataUrl: string): Promise<Game>;
  onScreenshotsChanged(callback: (gameId: string) => void): () => void;
  listShowcaseScreenshots(gameId: string): Promise<ShowcaseScreenshot[]>;
  /** Adds a screenshot from the game's screenshots folder to its showcase, or removes it (the file is kept). */
  setScreenshotShowcased(gameId: string, name: string, showcased: boolean): Promise<void>;
  /** Copies images from elsewhere into the game's screenshots folder and showcases them. */
  addScreenshots(gameId: string, filePaths: string[]): Promise<AddScreenshotsResult>;
  readImageThumbnail(filePath: string): Promise<string | null>;
  readControllerFileIcon(filePath: string): Promise<string>;
  deleteImportedScreenshot(gameId: string, name: string): Promise<void>;
  onShowcaseScreenshotsChanged(callback: (gameId: string) => void): () => void;
  onGameCoverChanged(callback: (game: Game) => void): () => void;
  getRuffleRuntime?(): Promise<RuffleRuntimeState>;
  setRuffleChannel?(channel: RuffleChannel): Promise<RuffleRuntimeState>;
  updateRuffleNightly?(): Promise<RuffleRuntimeState & { updated: boolean }>;
  onRuffleRuntimeChanged?(callback: (state: RuffleRuntimeState) => void): () => void;
  getGameRemap(gameId: string): Promise<GameRemapData>;
  saveGameRemap(gameId: string, config: GameRemapConfig): Promise<GameRemapConfig>;
  getControllerPresets(): Promise<ControllerPreset[]>;
  createControllerPreset(name: string, player: PlayerRemap): Promise<ControllerPreset[]>;
  renameControllerPreset(id: string, name: string): Promise<ControllerPreset[]>;
  deleteControllerPreset(id: string): Promise<ControllerPreset[]>;
  onControllerPresetsChanged(callback: (presets: ControllerPreset[]) => void): () => void;
  onGameRemapChanged(callback: (gameId: string, config: GameRemapConfig) => void): () => void;
  getControllerAssignments(): Promise<ControllerAssignment[]>;
  getControllerNames(): Promise<ControllerNickname[]>;
  setControllerName(id: string, ordinal: number, name: string): Promise<ControllerNickname[]>;
  forgetController?(id: string, ordinal: number): Promise<{ names: ControllerNickname[]; assignments: ControllerAssignment[] }>;
  onControllerNamesChanged(callback: (names: ControllerNickname[]) => void): () => void;
  setControllerAssignments(assignments: ControllerAssignment[]): Promise<ControllerAssignment[]>;
  onControllerAssignmentsChanged(callback: (assignments: ControllerAssignment[]) => void): () => void;
  reportControllers(controllers: KnownController[]): void;
  reportControllerActivity(active: boolean, id?: string): void;
  onSteamDesktopInput(callback: (input: { kind: "move" | "button" | "wheel" | "key"; code?: string; button?: number; down?: boolean }) => void): () => void;
  getControllerActivity(): Promise<{ active: boolean; id: string }>;
  onControllerActivityChanged(callback: (active: boolean) => void): () => void;
  getNativeControllers(): Promise<NativeController[]>;
  /** Short haptic tick on a native Steam Controller trackpad side (strength 0-1). */
  pulseController(id: string, side: "left" | "right", strength: number, durationMs: number, effect?: "tick" | "click", gainDb?: number): void;
  /** Drives the real system pointer from Steam Controller trackpads in the focused app window. */
  /** Whether trackpads may drive the Windows pointer while this window is focused (outside games/capture). */
  setDesktopMouseAllowed(allowed: boolean): void;
  getAppFocused(): Promise<boolean>;
  /** Fires when focus moves between Flash Royale and other applications (not between app windows). */
  onAppFocusChanged(callback: (focused: boolean) => void): () => void;
  getNativeControllerInputEnabled(): Promise<boolean>;
  /** Whether Steam launched Flash Royale with Steam Input handling its controllers (native input is then unavailable). */
  getSteamInputActive?(): Promise<boolean>;
  setNativeControllerInputEnabled(enabled: boolean): Promise<boolean>;
  onNativeControllerInputEnabledChanged(callback: (enabled: boolean) => void): () => void;
  onNativeControllersChanged(callback: (controllers: NativeController[]) => void): () => void;
  /** Saves the game's "pin cursor to window" setting and applies it immediately to its running player window. */
  setGamePinCursor(gameId: string, pinned: boolean): Promise<Game>;
  setPlayerVolume(gameId: string, volume: number): Promise<void>;
  setPlayerPaused(gameId: string, paused: boolean): Promise<void>;
  onGamePinCursorChanged(callback: (game: Game) => void): () => void;
  getKnownControllers(): Promise<KnownController[]>;
  onKnownControllersChanged(callback: (controllers: KnownController[]) => void): () => void;
  onPlayerFullscreenChange(callback: (fullscreen: boolean) => void): () => void;
  onScreenshotViewingChanged(callback: (viewing: boolean) => void): () => void;
  onPlayTimeUpdated(callback: (game: Game) => void): () => void;
  onGameResourcesUpdated(callback: (game: Game) => void): () => void;
  readLibrary(): Promise<LibraryState>;
  getGameTheme(gameId: string): Promise<{
    mimeType: string;
    data: Uint8Array<ArrayBuffer>;
    source: "custom" | "default";
    fileName?: string;
    trackIndex?: number;
  } | null>;
  chooseCustomMusic(gameId: string, language: Language, selectedPath?: string): Promise<Game>;
  removeCustomMusic(gameId: string): Promise<Game>;
  getMusicCandidates(gameId: string): Promise<Array<{ duration: number }>>;
  setDefaultMusic(gameId: string, index: number): Promise<Game>;
  cancelImport(): Promise<void>;
  onImportProgress(callback: (progress: ImportProgress) => void): () => void;
  importPaths(filePaths: string[], language: Language): Promise<ImportResult>;
  updateGame(gameId: string, patch: GamePatch, language: Language): Promise<{ games: Game[]; game: Game }>;
  importCrtBezel(gameId: string, bytes: Uint8Array): Promise<void>;
  getGlobalCrt(): Promise<CrtConfig>;
  setGlobalCrt(config: CrtConfig): Promise<CrtConfig>;
  onGlobalCrtChanged(callback: (config: CrtConfig) => void): () => void;
  importGlobalCrtBezel(bytes: Uint8Array): Promise<void>;
  saveCrtBezelTemplate?(dataUrl: string, folder: string): Promise<string>;
  onGameCrtChanged(callback: (gameId: string, config: CrtConfig | undefined, bezelChanged?: boolean, disabled?: boolean, bezelDisabled?: boolean) => void): () => void;
  deleteGame(gameId: string, removeFiles: boolean): Promise<LibraryState>;
  recordPlay(gameId: string): Promise<Game>;
  saveCover(gameId: string, dataUrl: string): Promise<Game>;
  saveCoverThumbnail?(gameId: string, version: string, width: number, data: Uint8Array): Promise<boolean>;
  chooseCoverImage(gameId: string, language: Language, selectedPath?: string): Promise<Game>;
  renameTag(oldTag: string, newTag: string): Promise<LibraryState>;
  deleteTag(tag: string): Promise<LibraryState>;
  renameCategory(oldCategory: string, newCategory: string, language: Language): Promise<LibraryState>;
}

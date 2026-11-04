import { Archive, ChevronDown, Clapperboard, Download, ExternalLink, Flame, FolderOpen, MonitorPlay, Plus, Puzzle, RefreshCw, RotateCcw, Settings2, SlidersHorizontal, Trash2, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SettingsSection } from "./SettingsSections";
import { settingsHelp } from "./i18n-settings";
import { useControllerNavigation } from "./ControllerNavigation";
import { generalSettingsLabels, type Language } from "./i18n";
import { FlashpointImportFields } from "./FlashpointImport";
import { addCustomPlayerLabels, deleteCustomPlayerLabels, libreShockwaveHints, playerLabels } from "./i18n-players";
import { ruffleChannelLabels } from "./i18n-ruffle";
import { fullscreenOverrideLabels, fpsCounterLabels, fpsStyleLabels } from "./i18n-settings";
import { useShowFpsCounter, useFpsCounterStyle, type FpsCorner, type FpsCounterStyle } from "./FpsCounter";
import type { CustomPlayerConfig, CustomPlayerId, Game, GameFormat, GamePatch, PlayerCapability, PlayerId, PlayerState, RuffleChannel, RuffleRuntimeState } from "./types";

export function isCustomPlayerId(id: PlayerId): id is CustomPlayerId {
  return id === "custom" || id.startsWith("custom-");
}

const defaultPlayerForFormat: Record<GameFormat, PlayerId> = { swf: "ruffle", dcr: "dirplayer" };
const playerIcons: Record<Exclude<PlayerId, `custom-${number}`>, LucideIcon> = {
  ruffle: Zap,
  dirplayer: Puzzle,
  libreshockwave: Puzzle,
  "flashpoint-flash": Archive,
  "flashpoint-shockwave": Archive,
  "flash-projector": Clapperboard,
  newgrounds: Flame,
  custom: Settings2,
};
const builtInCapabilities: Record<GameFormat, PlayerCapability[]> = {
  swf: ["fullscreen", "fixScaling", "standalone", "online", "resources", "remap", "pinCursor"],
  dcr: ["fullscreen", "online", "remap", "pinCursor"],
};

let cachedPlayers: PlayerState[] | null = null;
let pendingPlayers: Promise<PlayerState[]> | null = null;
const playerListeners = new Set<(players: PlayerState[]) => void>();

function publishPlayers(players: PlayerState[]) {
  cachedPlayers = players;
  for (const listener of playerListeners) listener(players);
  return players;
}

export function refreshPlayers(rescan = false) {
  if (pendingPlayers && !rescan) return pendingPlayers;
  const request = window.flashApi.getPlayers(rescan).then(publishPlayers);
  pendingPlayers = request;
  void request.catch(() => {}).finally(() => { if (pendingPlayers === request) pendingPlayers = null; });
  return request;
}

export function usePlayers() {
  const [players, setPlayers] = useState(cachedPlayers);
  useEffect(() => {
    playerListeners.add(setPlayers);
    if (!cachedPlayers) void refreshPlayers().catch(() => {});
    return () => { playerListeners.delete(setPlayers); };
  }, []);
  return players;
}

export function useAllGamesFullscreen() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    let received = false;
    const stop = window.flashApi.onAllGamesFullscreenChanged((value) => {
      received = true;
      setEnabled(value);
    });
    void window.flashApi.getAllGamesFullscreen().then((value) => {
      if (active && !received) setEnabled(value);
    }).catch(console.error);
    return () => { active = false; stop(); };
  }, []);
  return enabled;
}

export function gameFormat(game: Pick<Game, "format">): GameFormat {
  return game.format === "dcr" ? "dcr" : "swf";
}

/** Mirrors `resolveGamePlayer` in electron/players.cjs. */
export function effectiveGamePlayer(game: Game, players: PlayerState[] | null) {
  const format = gameFormat(game);
  const chosen = players?.find((player) => player.id === game.player);
  if (chosen && chosen.available && chosen.formats.includes(format) && (chosen.kind === "builtin" || !game.onlineOnly)) return { player: chosen, unavailable: null };
  const fallback = players?.find((player) => player.id === defaultPlayerForFormat[format]) ?? null;
  return { player: fallback, unavailable: game.player && game.player !== fallback?.id ? chosen ?? null : null };
}

export function gameCapabilities(game: Game, players: PlayerState[] | null): Set<PlayerCapability> {
  const { player } = effectiveGamePlayer(game, players);
  return new Set(player ? player.capabilities : builtInCapabilities[gameFormat(game)]);
}

export function isExternalGamePlayer(game: Game, players: PlayerState[] | null) {
  const { player } = effectiveGamePlayer(game, players);
  return Boolean(player && player.kind !== "builtin");
}

function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function openLink(playerId: PlayerId, kind: "homepage" | "download") {
  void window.flashApi.openPlayerLink(playerId, kind).catch(console.error);
}

export function GamePlayerSelect({ game, language, onPatch, labelledBy }: { game: Game; language: Language; onPatch: (id: string, patch: GamePatch) => void; labelledBy?: string }) {
  const text = playerLabels[language];
  const players = usePlayers();
  if (!players || game.onlineOnly) return null;
  const formatId = gameFormat(game);
  const options = players.filter((player) => player.formats.includes(formatId)
    && (!isCustomPlayerId(player.id) || player.path || game.player === player.id));
  const defaultPlayer = options.find((player) => player.id === defaultPlayerForFormat[formatId]);
  const { player: effective, unavailable } = effectiveGamePlayer(game, players);
  const variants = effective?.kind === "flashpoint" ? effective.variants : [];
  const selectedVariant = variants.find((variant) => variant.id === game.playerVersion)?.id
    ?? variants.find((variant) => /^(flashplayer_32_sa\.exe|PJ12)$/i.test(variant.id))?.id ?? variants[0]?.id ?? "";
  return (
    <div className="game-player-settings">
      <label className="game-player-row">
        {!labelledBy && <span>{text.gamePlayer}</span>}
        <span className="settings-select-wrap">
          <select
            aria-labelledby={labelledBy}
            value={game.player && game.player !== defaultPlayer?.id ? game.player : ""}
            onChange={(event) => onPatch(game.id, { player: (event.target.value || null) as PlayerId | null, playerVersion: null })}
          >
            <option value="">{format(text.defaultPlayer, { name: defaultPlayer?.name ?? "" })}</option>
            {options.filter((player) => player.id !== defaultPlayer?.id).map((player) => (
              <option key={player.id} value={player.id} disabled={!player.available && player.id !== game.player}>
                {player.available ? player.name : `${player.name} (${text.notInstalled})`}
              </option>
            ))}
          </select>
          <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
        </span>
      </label>
      {variants.length > 1 && (
        <label className="game-player-row">
          <span>{text.gamePlayerVersion}</span>
          <span className="settings-select-wrap">
            <select value={selectedVariant} onChange={(event) => onPatch(game.id, { playerVersion: event.target.value })}>
              {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
            </select>
            <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
          </span>
        </label>
      )}
      {unavailable && effective && <small className="game-player-warning" role="status">{format(text.fallback, { name: unavailable.name, fallback: effective.name })}</small>}
      {effective && effective.kind !== "builtin" && <small className="game-player-hint">{text.externalHint}</small>}
      {effective?.id === "libreshockwave" && <small className="game-player-hint">{libreShockwaveHints[language]}</small>}
    </div>
  );
}

function mergedStatusText(group: PlayerState[], language: Language) {
  const text = playerLabels[language];
  const installed = group.filter((entry) => entry.available);
  if (!installed.length) return text.notFound;
  const versions = [...new Set(installed.map((entry) => entry.version).filter(Boolean))];
  return versions.length ? `${text.installed} · ${versions.join(" / ")}` : text.installed;
}

function statusText(player: PlayerState, language: Language) {
  const text = playerLabels[language];
  if (player.kind === "builtin") return player.version ? `${text.builtin} · ${player.version}` : text.builtin;
  if (!player.available) return text.notFound;
  return player.version ? `${text.installed} · ${player.version}` : text.installed;
}

function RuffleChannelFields({ language }: { language: Language }) {
  const text = ruffleChannelLabels[language];
  const [runtime, setRuntime] = useState<RuffleRuntimeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void window.flashApi.getRuffleRuntime?.().then(setRuntime).catch(() => {});
    return window.flashApi.onRuffleRuntimeChanged?.(setRuntime);
  }, []);
  if (!runtime || !window.flashApi.setRuffleChannel) return null;
  const working = busy || runtime.installing;
  const act = async (action: () => Promise<RuffleRuntimeState & { updated?: boolean }>, describe: (state: RuffleRuntimeState & { updated?: boolean }) => string) => {
    setBusy(true);
    setMessage("");
    try {
      const state = await action();
      setRuntime(state);
      setMessage(describe(state));
    } catch (error) {
      setMessage(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(error));
    } finally {
      setBusy(false);
    }
  };
  const changeChannel = (channel: RuffleChannel) => void act(
    () => window.flashApi.setRuffleChannel!(channel),
    (state) => format(text.switched, { version: state.activeVersion }),
  );
  const updateNightly = () => void act(
    () => window.flashApi.updateRuffleNightly!(),
    (state) => format(state.updated ? text.updated : text.upToDate, { version: state.nightlyVersion }),
  );
  return (
    <div className="player-ruffle-channel">
      <label className="game-player-row">
        <span>{text.channel}</span>
        <span className="settings-select-wrap">
          <select value={runtime.channel} disabled={working} onChange={(event) => changeChannel(event.target.value as RuffleChannel)}>
            <option value="stable">{format(text.stable, { version: runtime.stableVersion })}</option>
            <option value="nightly">{format(text.nightly, { version: runtime.nightlyVersion ? runtime.nightlyVersion.replace(/^.*-nightly\.(\d{4})\.(\d{1,2})\.(\d{1,2})$/, (_, year: string, month: string, day: string) => `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`) : text.notDownloaded })}</option>
          </select>
          <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
        </span>
      </label>
      <small>{text.hint}</small>
      {runtime.channel === "nightly" && (
        <div className="player-entry-actions">
          <button type="button" className="secondary" disabled={working} onClick={updateNightly}>
            <RefreshCw size={15} aria-hidden="true" className={working ? "spin" : undefined} />
            <span>{working ? text.downloading : text.update}</span>
          </button>
        </div>
      )}
      {working && runtime.channel !== "nightly" && <small role="status">{text.downloading}</small>}
      {message && !working && <small role="status">{message}</small>}
    </div>
  );
}

function CustomPlayerFields({ playerId, language, disabled, onPlayers }: { playerId: CustomPlayerId; language: Language; disabled: boolean; onPlayers: (players: PlayerState[]) => void }) {
  const text = playerLabels[language];
  const [custom, setCustom] = useState<CustomPlayerConfig | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void window.flashApi.getCustomPlayer(playerId).then((value) => { if (active) setCustom(value); }).catch((error) => {
      console.error(error);
      if (active) setError(String(error));
    });
    return () => { active = false; };
  }, [playerId]);
  if (!custom) return error ? <small role="alert">{error}</small> : null;
  const save = (patch: Partial<CustomPlayerConfig>) => {
    const next = { ...custom, ...patch };
    setCustom(next);
    setError("");
    void window.flashApi.setCustomPlayer(next, playerId).then((result) => {
      setCustom(result.custom);
      onPlayers(result.players);
    }).catch((error) => { console.error(error); setError(String(error)); });
  };
  return (
    <div className="player-custom-fields">
      <label>
        <span>{text.customName}</span>
        <input type="text" disabled={disabled} maxLength={60} value={custom.name} onChange={(event) => setCustom({ ...custom, name: event.target.value })} onBlur={() => save({})} />
      </label>
      <small>{settingsHelp[language].customName}</small>
      <label>
        <span>{text.customArgs}</span>
        <input type="text" disabled={disabled} maxLength={500} spellCheck={false} value={custom.args} onChange={(event) => setCustom({ ...custom, args: event.target.value })} onBlur={() => save({})} />
      </label>
      <small>{text.customArgsHint}</small>
      <div className="player-custom-formats" role="group" aria-label={text.customFormats}>
        <span>{text.customFormats}</span>
        {(["swf", "dcr"] as const).map((formatId) => (
          <label key={formatId} className="settings-toggle">
            <input
              type="checkbox"
              checked={custom.formats.includes(formatId)}
              disabled={disabled || (custom.formats.length === 1 && custom.formats.includes(formatId))}
              onChange={(event) => save({ formats: event.target.checked ? [...custom.formats, formatId] : custom.formats.filter((entry) => entry !== formatId) })}
            />
            <span>{formatId.toUpperCase()}</span>
          </label>
        ))}
      </div>
      <small>{settingsHelp[language].customFormats}</small>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

export function PlayersSettingsSection({ language, expanded = false }: { language: Language; expanded?: boolean }) {
  const text = playerLabels[language];
  const players = usePlayers();
  const allGamesFullscreen = useAllGamesFullscreen();
  const [fullscreenError, setFullscreenError] = useState("");
  const showFpsCounter = useShowFpsCounter();
  const [fpsError, setFpsError] = useState("");
  const savedFpsStyle = useFpsCounterStyle();
  const [fpsStyle, setFpsStyle] = useState(savedFpsStyle);
  const latestFpsStyle = useRef(fpsStyle);
  const styleSaves = useRef(Promise.resolve());
  const pendingStyleSaves = useRef(0);
  useEffect(() => {
    if (pendingStyleSaves.current) return;
    latestFpsStyle.current = savedFpsStyle;
    setFpsStyle(savedFpsStyle);
  }, [savedFpsStyle]);
  const styleText = fpsStyleLabels[language];
  const saveFpsStyle = (patch: Partial<FpsCounterStyle>) => {
    setFpsError("");
    const next = { ...latestFpsStyle.current, ...patch };
    latestFpsStyle.current = next;
    setFpsStyle(next);
    pendingStyleSaves.current++;
    // Slider events can arrive before IPC finishes; preserve every field and write in order.
    styleSaves.current = styleSaves.current.then(() => window.flashApi.setFpsCounterStyle(next)).then(() => {}).catch((error) => {
      console.error("Could not save the FPS counter style", error);
      setFpsError(error instanceof Error ? error.message : String(error));
    }).finally(() => { pendingStyleSaves.current--; });
  };
  const navigation = useControllerNavigation();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<PlayerId | "add-custom" | null>(null);
  const [playerError, setPlayerError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<PlayerId | null>(null);
  const run = async (playerId: PlayerId | "add-custom", action: () => Promise<PlayerState[]>) => {
    setBusy(playerId);
    setPlayerError("");
    try { publishPlayers(await action()); } catch (error) {
      console.error(error);
      setPlayerError(error instanceof Error ? error.message : String(error));
    } finally { setBusy(null); }
  };
  const browse = (player: PlayerState) => void run(player.id, async () => {
    const picked = await navigation.chooseFiles(player.kind === "flashpoint" ? "folder" : "exe");
    if (!picked?.length) return window.flashApi.getPlayers();
    return window.flashApi.choosePlayerPath(player.id, picked[0]);
  });
  // Flashpoint's Flash and Shockwave players share one install, so they are shown as a single card.
  const groups: PlayerState[][] = [];
  for (const player of players ?? []) {
    const flashpointGroup = player.kind === "flashpoint" ? groups.find((group) => group[0].kind === "flashpoint") : undefined;
    if (flashpointGroup) flashpointGroup.push(player);
    else groups.push([player]);
  }
  return (
    <details className="settings-controller-collapse players-settings" open={expanded || undefined}>
      <summary>
        <span className="controller-summary-title">
          <MonitorPlay size={15} aria-hidden="true" />
          <span>{text.title}</span>
        </span>
      </summary>
      <section className="settings-controller-subsection" aria-label={text.title}>
        <SettingsSection title={generalSettingsLabels[language].general} icon={SlidersHorizontal} className="players-general-settings">
        <small className="players-overview">{text.description}</small>
        <label className="settings-toggle">
          <input type="checkbox" checked={allGamesFullscreen} onChange={(event) => {
            setFullscreenError("");
            void window.flashApi.setAllGamesFullscreen(event.target.checked).catch((error) => {
              console.error("Could not save game fullscreen preference", error);
              setFullscreenError(error instanceof Error ? error.message : String(error));
            });
          }} />
          <span>{fullscreenOverrideLabels[language].enable}</span>
        </label>
        <small className="players-fullscreen-description">{fullscreenOverrideLabels[language].description}</small>
        {fullscreenError && <small role="alert">{fullscreenError}</small>}
        <label className="settings-toggle fps-global-toggle">
          <input type="checkbox" checked={showFpsCounter} onChange={(event) => {
            setFpsError("");
            void window.flashApi.setShowFpsCounter(event.target.checked).catch((error) => {
              console.error("Could not save the FPS counter preference", error);
              setFpsError(error instanceof Error ? error.message : String(error));
            });
          }} />
          <span>{fpsCounterLabels[language].enable}</span>
        </label>
        <small className="players-fullscreen-description">{fpsCounterLabels[language].description}</small>
        {fpsError && <small role="alert">{fpsError}</small>}
          <fieldset className="settings-option fps-style-settings" disabled={!showFpsCounter}>
          <label className="settings-field fps-corner-field">{styleText.corner}<div className="settings-select-wrap"><select value={fpsStyle.corner} onChange={(event) => saveFpsStyle({ corner: event.target.value as FpsCorner })}>
            <option value="top-left">{styleText.topLeft}</option>
            <option value="top-right">{styleText.topRight}</option>
            <option value="bottom-left">{styleText.bottomLeft}</option>
            <option value="bottom-right">{styleText.bottomRight}</option>
          </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div></label>
          <label className="remap-slider fps-size-slider">
              <span>{styleText.size}</span>
              <input type="range" min={10} max={32} value={fpsStyle.size} onChange={(event) => saveFpsStyle({ size: Number(event.target.value) })} aria-label={styleText.size} />
              <output>{fpsStyle.size}px</output>
          </label>
          {(["color", "background"] as const).map(field => {
            const label = field === "color" ? styleText.text : styleText.background;
            const opacity = field === "color" ? "colorOpacity" : "backgroundOpacity";
            return <fieldset key={field} className="fps-color-setting">
              <legend>{field === "color" ? styleText.numberTitle : styleText.backgroundTitle}</legend>
              <button type="button" className="secondary color-picker-trigger" aria-label={label}
                onClick={() => navigation.pickColor({ value: latestFpsStyle.current[field], label, onPick: color => saveFpsStyle({ [field]: color }) })}>
                <span className="color-swatch" style={{ backgroundColor: fpsStyle[field] }} aria-hidden="true" />
                <span>{label}</span>
                <code>{fpsStyle[field]}</code>
              </button>
              <label className="remap-slider">
                <span>{styleText.opacity}</span>
                <input type="range" min={0} max={100} value={fpsStyle[opacity]}
                  onChange={event => saveFpsStyle({ [opacity]: Number(event.target.value) })} aria-label={`${label}: ${styleText.opacity}`} />
                <output>{fpsStyle[opacity]}%</output>
              </label>
            </fieldset>;
          })}
          </fieldset>
        </SettingsSection>
        <ul className="players-list">
          {groups.map((group) => {
            const player = group[0];
            const merged = group.length > 1;
            const available = group.some((entry) => entry.available);
            const pathOwner = group.find((entry) => entry.path) ?? player;
            const manual = group.some((entry) => entry.manual);
            const formats = [...new Set(group.flatMap((entry) => entry.formats))];
            return (
            <li key={player.id} className={`player-entry${available ? " available" : ""}`}>
              <SettingsSection title={merged ? "Flashpoint" : player.name} icon={isCustomPlayerId(player.id) ? Settings2 : playerIcons[player.id]}>
              <div className="player-entry-heading">
                <strong>{merged ? "Flashpoint" : player.name}</strong>
                <span className="player-entry-formats">{formats.map((entry) => entry.toUpperCase()).join(" / ")}</span>
                <span className={`player-status${available ? " available" : ""}`}>{merged ? mergedStatusText(group, language) : statusText(player, language)}</span>
              </div>
              {player.id === "libreshockwave" && <small className="game-player-hint">{libreShockwaveHints[language]}</small>}
              {player.kind !== "builtin" && (
                <div className="player-entry-path" title={pathOwner.path || undefined}>
                  {pathOwner.path ? <code>{pathOwner.path}</code> : <span>{text.notFound}</span>}
                  {pathOwner.path && <em>{pathOwner.manual ? text.manual : text.detected}</em>}
                </div>
              )}
              {group.filter((entry) => entry.kind === "flashpoint" && entry.available).map((entry) => (
                <details key={entry.id} className="player-version-list">
                  <summary>
                    {merged && <strong>{entry.formats.includes("dcr") ? "Shockwave" : "Flash"} · </strong>}
                    {format(text.versions, { n: String(entry.variants.length) })}
                  </summary>
                  <ul>
                    {entry.variants.map((variant) => <li key={variant.id}>{variant.label}</li>)}
                  </ul>
                </details>
              ))}
              <div className="player-entry-actions">
                {player.kind !== "builtin" && (
                  <button type="button" className="secondary" disabled={busy !== null} onClick={() => browse(player)}>
                    <FolderOpen size={15} aria-hidden="true" />
                    <span>{text.browse}</span>
                  </button>
                )}
                {manual && !isCustomPlayerId(player.id) && (
                  <button type="button" className="secondary" disabled={busy !== null} onClick={() => void run(player.id, () => window.flashApi.resetPlayerPath(player.id))}>
                    <RotateCcw size={15} aria-hidden="true" />
                    <span>{text.reset}</span>
                  </button>
                )}
                {isCustomPlayerId(player.id) && (
                  <button
                    type="button"
                    className={`secondary player-delete${confirmDelete === player.id ? " confirming" : ""}`}
                    disabled={busy !== null}
                    onBlur={() => setConfirmDelete(null)}
                    onClick={() => {
                      if (confirmDelete !== player.id) return setConfirmDelete(player.id);
                      setConfirmDelete(null);
                      void run(player.id, () => window.flashApi.removeCustomPlayer(player.id as CustomPlayerId));
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span>{confirmDelete === player.id ? deleteCustomPlayerLabels[language].confirm : deleteCustomPlayerLabels[language].remove}</span>
                  </button>
                )}
                {!available && player.downloadUrl && (
                  <button type="button" className="secondary" onClick={() => openLink(player.id, "download")}>
                    <Download size={15} aria-hidden="true" />
                    <span>{text.download}</span>
                  </button>
                )}
                {player.homepage && (available || !player.downloadUrl) && (
                  <button type="button" className="secondary" onClick={() => openLink(player.id, "homepage")}>
                    <ExternalLink size={15} aria-hidden="true" />
                    <span>{text.homepage}</span>
                  </button>
                )}
              </div>
              {player.id === "ruffle" && <RuffleChannelFields language={language} />}
              {isCustomPlayerId(player.id) && <CustomPlayerFields playerId={player.id} language={language} disabled={busy !== null} onPlayers={publishPlayers} />}
              {player.kind === "flashpoint" && available && <FlashpointImportFields language={language} />}
              </SettingsSection>
            </li>
            );
          })}
        </ul>
        {playerError && <small role="alert">{playerError}</small>}
        <div className="players-settings-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy !== null || !players}
            onClick={() => void run("add-custom", () => window.flashApi.addCustomPlayer())}
          >
            <Plus size={15} aria-hidden="true" />
            <span>{addCustomPlayerLabels[language]}</span>
          </button>
          <button
            type="button"
            className="secondary players-rescan"
            disabled={scanning}
            onClick={() => {
              setScanning(true);
              void refreshPlayers(true).catch(console.error).finally(() => setScanning(false));
            }}
          >
            <RefreshCw size={15} aria-hidden="true" className={scanning ? "spinning" : undefined} />
            <span>{scanning ? text.scanning : text.rescan}</span>
          </button>
        </div>
      </section>
    </details>
  );
}

import Fuse from "fuse.js";
import {
  ChevronDown,
  Download,
  FolderOpen,
  Gamepad2,
  Heart,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Star,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Game, GamePatch, ImportResult, LibraryState } from "./types";

type Filter =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "category"; value: string }
  | { type: "tag"; value: string };

const emptyLibrary: LibraryState = {
  libraryRoot: "",
  games: [],
};

function formatDate(value: string | null) {
  if (!value) return "从未";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

async function loadRuffleScript() {
  if (window.RufflePlayer) return;
  const assetBaseUrl = window.flashApi ? await window.flashApi.getAssetBaseUrl() : window.location.origin;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-ruffle]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Ruffle 加载失败")), { once: true });
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
    script.onerror = () => reject(new Error("Ruffle 资源不存在，请先运行 npm.cmd install"));
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

function coverStatusLabel(status: Game["coverStatus"]) {
  if (status === "captured") return "截图";
  if (status === "custom") return "自定义";
  return "自动占位";
}

function createCoverDataUrl(canvas: HTMLCanvasElement) {
  if (canvas.width < 16 || canvas.height < 16) {
    throw new Error("画面尺寸太小，已保留原封面");
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
        throw new Error("画面还没渲染出来，已保留原封面");
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("已保留原封面")) {
      throw error;
    }
  }

  const output = document.createElement("canvas");
  output.width = 960;
  output.height = 540;
  const context = output.getContext("2d");
  if (!context) {
    throw new Error("无法创建封面画布");
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
    throw new Error("截图数据异常，已保留原封面");
  }
  return dataUrl;
}

function CoverImage({ game, className }: { game: Game; className?: string }) {
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

  return <img className={className} src={game.coverUrl} alt={`${game.title} 封面`} onError={() => setFailed(true)} />;
}

function Sidebar({
  games,
  filter,
  setFilter,
  onRenameTag,
  onDeleteTag,
  onRenameCategory,
}: {
  games: Game[];
  filter: Filter;
  setFilter: (filter: Filter) => void;
  onRenameTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
  onRenameCategory: (category: string) => void;
}) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of games) counts.set(game.category, (counts.get(game.category) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "zh-CN"));
  }, [games]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of games) {
      for (const tag of game.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "zh-CN"));
  }, [games]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Gamepad2 size={22} />
        </div>
        <div>
          <strong>FlashManager</strong>
          <span>本地游戏库</span>
        </div>
      </div>

      <nav className="nav-section">
        <button className={filter.type === "all" ? "active" : ""} onClick={() => setFilter({ type: "all" })}>
          <FolderOpen size={17} />
          全部游戏
          <span>{games.length}</span>
        </button>
        <button
          className={filter.type === "favorites" ? "active" : ""}
          onClick={() => setFilter({ type: "favorites" })}
        >
          <Star size={17} />
          收藏
          <span>{games.filter((game) => game.favorite).length}</span>
        </button>
      </nav>

      <div className="side-heading">
        <span>分类</span>
      </div>
      <div className="side-list">
        {categories.map(([category, count]) => (
          <div className="side-row" key={category}>
            <button
              className={filter.type === "category" && filter.value === category ? "active" : ""}
              onClick={() => setFilter({ type: "category", value: category })}
              title={category}
            >
              <span>{category}</span>
              <em>{count}</em>
            </button>
            <button className="icon small" title="重命名分类" onClick={() => onRenameCategory(category)}>
              <Pencil size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="side-heading">
        <span>标签</span>
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
            <button className="icon small" title="重命名标签" onClick={() => onRenameTag(tag)}>
              <Pencil size={14} />
            </button>
            <button className="icon small danger" title="删除标签" onClick={() => onDeleteTag(tag)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function GameCard({ game, selected, onSelect }: { game: Game; selected: boolean; onSelect: () => void }) {
  return (
    <button className={selected ? "game-card selected" : "game-card"} onClick={onSelect}>
      <div className="cover-wrap">
        <CoverImage game={game} />
        {game.favorite && (
          <span className="fav-badge" title="收藏">
            <Heart size={15} fill="currentColor" />
          </span>
        )}
      </div>
      <div className="game-card-body">
        <strong title={game.title}>{game.title}</strong>
        <span title={game.category}>{game.category}</span>
        <div className="mini-tags">
          {game.tags.slice(0, 3).map((tag) => (
            <em key={tag}>{tag}</em>
          ))}
        </div>
      </div>
    </button>
  );
}

function DetailsPanel({
  game,
  categories,
  onPatch,
  onDelete,
  onPlay,
  onManualCover,
}: {
  game: Game | null;
  categories: string[];
  onPatch: (gameId: string, patch: GamePatch) => void;
  onDelete: (game: Game) => void;
  onPlay: (game: Game) => void;
  onManualCover: (game: Game) => void;
}) {
  const categoryComboRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  useEffect(() => {
    setTitle(game?.title || "");
    setCategory(game?.category || "");
    setTags(game?.tags.join(", ") || "");
    setNotes(game?.notes || "");
    setIsCategoryMenuOpen(false);
  }, [game]);

  useEffect(() => {
    const closeCategoryMenu = (event: MouseEvent) => {
      if (!categoryComboRef.current?.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeCategoryMenu);
    return () => document.removeEventListener("mousedown", closeCategoryMenu);
  }, []);

  if (!game) {
    return (
      <aside className="details empty">
        <Gamepad2 size={34} />
        <strong>还没有选中游戏</strong>
        <span>导入 SWF 后，在这里编辑标签、分类和备注。</span>
      </aside>
    );
  }

  const save = () => {
    onPatch(game.id, {
      title,
      category,
      tags: normalizeTags(tags),
      notes,
    });
  };
  const categoryMenuOpen = isCategoryMenuOpen && categories.length > 0;

  return (
    <aside className="details">
      <CoverImage className="detail-cover" game={game} />
      <div className="detail-actions">
        <button className="primary" onClick={() => onPlay(game)}>
          <Play size={17} fill="currentColor" />
          运行
        </button>
        <button className="icon" title="收藏" onClick={() => onPatch(game.id, { favorite: !game.favorite })}>
          <Heart size={18} fill={game.favorite ? "currentColor" : "none"} />
        </button>
        <button className="icon" title="选择本地图片作为封面" onClick={() => onManualCover(game)}>
          <Upload size={18} />
        </button>
        <button className="icon danger" title="删除" onClick={() => onDelete(game)}>
          <Trash2 size={18} />
        </button>
      </div>

      <label>
        标题
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        分类
        <div className={categoryMenuOpen ? "category-combo open" : "category-combo"} ref={categoryComboRef}>
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="未分类" />
          <button
            type="button"
            className="category-trigger"
            aria-label="选择历史分类"
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
                  className={item === category ? "category-option active" : "category-option"}
                  role="option"
                  aria-selected={item === category}
                  title={item}
                  onClick={() => {
                    setCategory(item);
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
        标签
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="动作, 解谜, 童年" />
      </label>
      <label>
        备注
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button className="save" onClick={save}>
        保存修改
      </button>

      <div className="meta">
        <span>文件：{game.originalFileName}</span>
        <span>游玩：{game.playCount} 次</span>
        <span>最近：{formatDate(game.lastPlayedAt)}</span>
        <span>封面：{coverStatusLabel(game.coverStatus)}</span>
      </div>
    </aside>
  );
}

function PlayerModal({
  game,
  onClose,
}: {
  game: Game | null;
  onClose: () => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("准备加载");
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = game && Number(game.stageWidth) > 0 ? Number(game.stageWidth) : 4;
  const stageHeight = game && Number(game.stageHeight) > 0 ? Number(game.stageHeight) : 3;

  useEffect(() => {
    let cancelled = false;
    let player: HTMLElement | null = null;

    async function run() {
      if (!game || !containerRef.current) return;
      setStatus("加载 Ruffle");
      try {
        await loadRuffleScript();
        if (cancelled || !window.RufflePlayer || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        const ruffle = window.RufflePlayer.newest();
        player = ruffle.createPlayer();
        player.className = "ruffle-player";
        containerRef.current.appendChild(player);
        setStatus("载入游戏");
        await ruffleApi(player).load({ url: game.swfUrl, allowScriptAccess: false });
        setStatus("运行中");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "游戏加载失败");
      }
    }

    run();
    return () => {
      cancelled = true;
      player?.remove();
    };
  }, [game]);

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
    width: fitSize ? `${fitSize.width}px` : "100%",
    height: fitSize ? `${fitSize.height}px` : "100%",
  };

  return (
    <div className="modal-backdrop">
      <section className="player-modal">
        <header>
          <div>
            <strong>{game.title}</strong>
            <span>{status}</span>
          </div>
          <div className="modal-actions">
            <button className="icon" onClick={onClose} title="关闭">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="player-surface" ref={surfaceRef}>
          <div className="player-stage" ref={containerRef} style={playerStageStyle} />
        </div>
      </section>
    </div>
  );
}

function CoverCapture({
  game,
  onDone,
}: {
  game: Game | null;
  onDone: (gameId: string, updated?: Game) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: HTMLElement | null = null;

    async function capture() {
      if (!game || !ref.current) return;
      try {
        await loadRuffleScript();
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
        const updated = await window.flashApi.saveCover(game.id, createCoverDataUrl(canvas));
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
  }, [game, onDone]);

  return <div className="cover-capture" ref={ref} />;
}

export function App() {
  const [library, setLibrary] = useState<LibraryState>(emptyLibrary);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playerGame, setPlayerGame] = useState<Game | null>(null);
  const [captureQueue, setCaptureQueue] = useState<string[]>([]);
  const [toast, setToast] = useState("准备就绪");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    window.flashApi.readLibrary().then((state) => {
      setLibrary(state);
      setSelectedId(state.games[0]?.id || null);
    });
  }, []);

  const selectedGame = library.games.find((game) => game.id === selectedId) || null;
  const captureGame = library.games.find((game) => game.id === captureQueue[0]) || null;
  const categoryOptions = useMemo(() => {
    const names = library.games.map((game) => game.category).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "zh-CN"));
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
    return source.filter((game) => {
      if (filter.type === "favorites") return game.favorite;
      if (filter.type === "category") return game.category === filter.value;
      if (filter.type === "tag") return game.tags.includes(filter.value);
      return true;
    });
  }, [filter, fuse, library.games, query]);

  const applyLibrary = (state: LibraryState, preferredGameId?: string) => {
    setLibrary(state);
    if (preferredGameId) {
      setSelectedId(preferredGameId);
      return;
    }
    if (!state.games.some((game) => game.id === selectedId)) {
      setSelectedId(state.games[0]?.id || null);
    }
  };

  const handleImportResult = (result: ImportResult) => {
    applyLibrary(result, result.imported?.[0]?.id);
    const imported = result.imported?.length || 0;
    const skipped = result.skipped?.length || 0;
    if (imported > 0) {
      setCaptureQueue((queue) => [...queue, ...(result.imported || []).map((game) => game.id)]);
    }
    setToast(`导入 ${imported} 个，跳过 ${skipped} 个`);
  };

  const chooseAndImport = async () => {
    try {
      handleImportResult(await window.flashApi.chooseAndImport());
    } catch (error) {
      setToast(error instanceof Error ? error.message : "导入失败");
    }
  };

  const updateGame = async (gameId: string, patch: GamePatch) => {
    try {
      const result = await window.flashApi.updateGame(gameId, patch);
      applyLibrary({ ...library, games: result.games }, result.game.id);
      setToast("修改已保存");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "保存失败");
    }
  };

  const deleteGame = async (game: Game) => {
    const removeFiles = window.confirm(`删除《${game.title}》？\n\n确定：删除记录并询问是否删除文件。`);
    if (!removeFiles) return;
    const alsoFiles = window.confirm("是否同时删除库目录里的 SWF 和封面文件？");
    try {
      applyLibrary(await window.flashApi.deleteGame(game.id, alsoFiles));
      setToast("游戏已删除");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "删除失败");
    }
  };

  const playGame = async (game: Game) => {
    setPlayerGame(game);
    try {
      const updated = await window.flashApi.recordPlay(game.id);
      setLibrary((state) => ({
        ...state,
        games: state.games.map((item) => (item.id === updated.id ? updated : item)),
      }));
    } catch {
      setToast("游玩记录更新失败，但游戏仍会尝试运行");
    }
  };

  const renameTag = async (tag: string) => {
    const next = window.prompt("新的标签名称", tag);
    if (!next || next.trim() === tag) return;
    applyLibrary(await window.flashApi.renameTag(tag, next.trim()));
    setToast("标签已重命名");
  };

  const deleteTag = async (tag: string) => {
    if (!window.confirm(`从所有游戏中移除标签「${tag}」？`)) return;
    applyLibrary(await window.flashApi.deleteTag(tag));
    setToast("标签已移除");
  };

  const renameCategory = async (category: string) => {
    const next = window.prompt("新的分类名称", category);
    if (!next || next.trim() === category) return;
    applyLibrary(await window.flashApi.renameCategory(category, next.trim()));
    setToast("分类已重命名");
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => file.path)
      .filter((value): value is string => Boolean(value));
    if (paths.length === 0) {
      setToast("当前 Electron 没有暴露拖拽文件路径，请使用导入按钮");
      return;
    }
    try {
      handleImportResult(await window.flashApi.importPaths(paths));
    } catch (error) {
      setToast(error instanceof Error ? error.message : "拖拽导入失败");
    }
  };

  const onCaptureDone = (gameId: string, updated?: Game) => {
    setCaptureQueue((queue) => queue.filter((id) => id !== gameId));
    if (updated) {
      setLibrary((state) => ({
        ...state,
        games: state.games.map((game) => (game.id === updated.id ? updated : game)),
      }));
      setToast("自动封面已生成");
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
      const updated = await window.flashApi.chooseCoverImage(game.id);
      updateSavedCover(updated);
      setToast(updated.coverStatus === "custom" ? "自定义封面已更新" : "已保留原封面");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "选择封面失败");
    }
  };

  return (
    <div
      className={isDragging ? "app drag-active" : "app"}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      <Sidebar
        games={library.games}
        filter={filter}
        setFilter={setFilter}
        onRenameTag={renameTag}
        onDeleteTag={deleteTag}
        onRenameCategory={renameCategory}
      />

      <main className="content">
        <header className="topbar">
          <div className="searchbox">
            <Search size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="一键搜索标题、标签、分类、备注、文件名"
            />
            {query && (
              <button className="icon small" onClick={() => setQuery("")} title="清空搜索">
                <X size={15} />
              </button>
            )}
          </div>
          <button className="primary" onClick={chooseAndImport}>
            <Download size={18} />
            导入 SWF
          </button>
        </header>

        <section className="library-info">
          <div>
            <strong>{visibleGames.length}</strong>
            <span>当前结果</span>
          </div>
          <div>
            <strong>{library.games.length}</strong>
            <span>库内游戏</span>
          </div>
          <p title={library.libraryRoot}>库目录：{library.libraryRoot || "初始化中"}</p>
          <span className="toast">{toast}</span>
        </section>

        <section className="game-grid">
          {visibleGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              selected={game.id === selectedId}
              onSelect={() => setSelectedId(game.id)}
            />
          ))}
          {visibleGames.length === 0 && (
            <div className="empty-state">
              <Plus size={36} />
              <strong>这里还没有游戏</strong>
              <span>点击“导入 SWF”，或者把文件拖进窗口。</span>
            </div>
          )}
        </section>
      </main>

      <DetailsPanel
        game={selectedGame}
        categories={categoryOptions}
        onPatch={updateGame}
        onDelete={deleteGame}
        onPlay={playGame}
        onManualCover={chooseManualCover}
      />

      <PlayerModal game={playerGame} onClose={() => setPlayerGame(null)} />
      <CoverCapture game={captureGame} onDone={onCaptureDone} />

      {isDragging && (
        <div className="drop-hint">
          <RefreshCw size={28} />
          <strong>松手导入 SWF</strong>
        </div>
      )}
    </div>
  );
}

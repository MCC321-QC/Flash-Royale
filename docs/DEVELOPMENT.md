# FlashManager 开发文档

本文档面向 FlashManager 的后续维护、二次开发和打包发布。

## 目标

FlashManager 的目标是成为一个免安装、本地优先的 SWF 游戏管理器。第一版只处理 `.swf` 文件，不做网页刮削，不依赖 Adobe Flash Player，也不要求用户配置数据库或后端服务。

核心原则：

- 本地优先：游戏文件、封面和元数据都保存在应用目录下。
- 易分享：打包后可以压缩整个文件夹并发给别人。
- 低依赖：使用 JSON 文件持久化，避免 SQLite 原生依赖带来的安装和编译问题。
- 不联网找图：封面来自本地截图、fallback 封面或用户手动选择的本地图片。

## 运行流程

开发启动：

```powershell
npm.cmd install
npm.cmd run dev
```

构建检查：

```powershell
npm.cmd run build
```

打包快速启动版：

```powershell
npm.cmd run package:fast
```

打包分享压缩包：

```powershell
npm.cmd run package:share
```

## 目录职责

```text
electron/main.cjs       主进程：窗口、文件系统、数据读写、本地资源服务、IPC
electron/preload.cjs    安全暴露给前端的 API
src/App.tsx             主要 React UI 和交互
src/styles.css          全局 UI 样式
src/types.ts            前端类型定义
scripts/copy-ruffle.cjs 安装后复制 Ruffle Web/WASM 资源
scripts/prepare-fast-package.cjs
                        生成根目录快速启动版和 ReadyToRun 压缩包
scripts/package-share-folder.cjs
                        生成可发给朋友的 flashmanager.zip
```

## 数据模型

主数据保存在 `library/db.json`。核心结构：

```ts
type CoverStatus = "fallback" | "captured" | "custom";

interface Game {
  id: string;
  title: string;
  originalFileName: string;
  filePath: string;
  coverPath: string;
  tags: string[];
  category: string;
  favorite: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  playCount: number;
  lastPlayedAt: string | null;
  hash: string;
  coverStatus: CoverStatus;
  stageWidth: number | null;
  stageHeight: number | null;
}
```

`stageWidth` 和 `stageHeight` 来自 SWF Header 的 RECT 信息，用来让播放器按原始比例显示游戏。

## 主进程职责

`electron/main.cjs` 负责：

- 创建 Electron 窗口。
- 创建和维护 `library/`、`games/`、`covers/`。
- 读取和写入 `db.json`、`config.json`。
- 导入 SWF，计算 SHA-256，按 hash 去重。
- 复制 SWF 到 `library/games/{gameId}/game.swf`。
- 生成 fallback 封面。
- 保存截图封面或手动选择的封面。
- 读取 SWF 舞台尺寸。
- 启动本地 `127.0.0.1` 资源服务，提供 SWF、封面和 Ruffle 文件。
- 暴露 IPC handler 给 preload。

本地资源服务用于避免直接通过 `file://` 加载 WASM 和 SWF。Ruffle 在 Electron 内加载资源时更适合使用 HTTP 源。

## Preload API

`electron/preload.cjs` 暴露 `window.flashApi`：

```ts
readLibrary()
chooseAndImport()
importPaths(filePaths)
updateGame(gameId, patch)
deleteGame(gameId, removeFiles)
recordPlay(gameId)
saveCover(gameId, dataUrl)
chooseCoverImage(gameId)
renameTag(oldTag, newTag)
deleteTag(tag)
renameCategory(oldCategory, newCategory)
getAssetBaseUrl()
```

前端不直接访问 Node.js 文件系统，只通过这些 API 与主进程通信。

## 前端职责

`src/App.tsx` 负责：

- 游戏列表、搜索、分类/标签筛选。
- 拖拽导入和按钮导入。
- 详情面板编辑标题、分类、标签、备注、收藏。
- 分类历史下拉菜单。
- 游戏卡片网格和滚动布局。
- Ruffle 播放器弹窗。
- 自动封面截图队列。
- 手动封面选择入口。

搜索使用 Fuse.js，默认搜索字段包括标题、标签、分类、备注和原文件名。

## 封面策略

导入游戏后先生成 fallback 封面，然后前端尝试使用 Ruffle 隐藏加载游戏并截图。

封面状态：

- `fallback`：本地生成的标题封面。
- `captured`：Ruffle 截图封面。
- `custom`：用户手动选择的本地图片。

保存封面时会先写入临时文件并校验大小，再替换正式文件，避免失败时破坏旧封面。

## 打包策略

`electron-builder` 输出到 `release/win-unpacked`。

`package:fast` 会：

1. 构建前端。
2. 运行 electron-builder。
3. 把运行时复制到项目根目录，生成根目录 `FlashManager.exe`。
4. 生成 `release/FlashManager-ReadyToRun/`。
5. 生成 `release/FlashManager-ReadyToRun.zip`。

`package:share` 会：

1. 构建前端。
2. 运行 electron-builder。
3. 复制 `release/win-unpacked` 到 `release/flashmanager/`。
4. 复制当前 `library/` 到分享文件夹。
5. 生成 `D:\Alaboratory\flashmanager.zip`。

## Git 规则

以下内容不提交：

- `node_modules/`
- `dist/`
- `release/`
- `library/`
- `public/ruffle/`
- 根目录 Electron 运行时文件，例如 `FlashManager.exe`、DLL、PAK、DAT 等。
- 压缩包和日志。

`public/ruffle/` 由 `npm.cmd install` 后的 `postinstall` 自动生成。

## 发布检查清单

发布前建议执行：

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run package:fast
```

手动检查：

- 应用能启动。
- 导入 SWF 能写入 `library/db.json`。
- 重复导入会跳过。
- 搜索能命中标题、标签、分类、备注、原文件名。
- 分类历史菜单不遮挡文字。
- 游戏网格标题和分类布局稳定。
- 播放器按游戏比例显示横版和竖版 SWF。
- 手动封面选择可用。

## 后续可改进方向

- 支持修改库目录。
- 支持 HTML 游戏包。
- 支持批量编辑标签/分类。
- 增加导入错误详情面板。
- 增加自动更新或版本检查。
- 增加 GitHub Actions 自动构建 Windows 包。

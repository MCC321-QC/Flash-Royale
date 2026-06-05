# FlashManager

FlashManager 是一个本地 Flash 游戏管理器，使用 Electron、Vite、React、TypeScript 和 Ruffle 构建。它专注管理本机 `.swf` 游戏库：导入、去重、封面、搜索、分类、标签、收藏和内置播放。

## 功能

- 导入 `.swf` 文件，并按 SHA-256 自动去重。
- 将游戏复制到本地库目录，避免原始文件移动后失效。
- 使用 Ruffle Web/WASM 在应用内运行 SWF。
- 自动生成本地封面，支持手动选择 PNG/JPG/WEBP 封面。
- 本地搜索标题、标签、分类、备注和原文件名。
- 支持分类、标签、收藏、备注、游玩次数和最近游玩时间。
- 播放器会读取 SWF 舞台尺寸，尽量按原始比例显示横版和竖版游戏。
- 支持生成免安装 Windows 文件夹，方便压缩后分享。

## 技术栈

- Electron
- Vite
- React
- TypeScript
- Fuse.js
- Ruffle
- electron-builder

## 开发环境

需要 Windows 和 Node.js。PowerShell 中建议使用 `npm.cmd`，避免脚本别名或执行策略造成干扰。

```powershell
npm.cmd install
npm.cmd run dev
```

安装依赖后，`postinstall` 会把 `@ruffle-rs/ruffle` 的 Web 资源复制到 `public/ruffle/`。该目录是生成产物，不提交到 Git。

## 构建

```powershell
npm.cmd run build
```

## 打包

生成 Electron 解包目录：

```powershell
npm.cmd run package:win
```

生成根目录快速启动版和 `release/FlashManager-ReadyToRun.zip`：

```powershell
npm.cmd run package:fast
```

生成适合直接发给朋友的 `D:\Alaboratory\flashmanager.zip`：

```powershell
npm.cmd run package:share
```

分享时请发送完整压缩包或完整文件夹，不要只发送单独的 `FlashManager.exe`。

## 本地数据

默认库目录位于应用所在目录下：

```text
library/
  games/       # 导入后的 SWF
  covers/      # 封面文件
  db.json      # 游戏元数据
  config.json  # 本地配置
```

`library/` 保存用户个人数据和游戏文件，不应该提交到 GitHub。

## 项目结构

```text
electron/             Electron 主进程和 preload
src/                  React 前端
scripts/              Ruffle 复制和打包脚本
public/               静态资源入口
docs/                 开发文档
```

## 文档

开发和维护说明见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 兼容性说明

Flash 运行依赖 Ruffle。部分复杂 AS3 游戏、依赖外部资源的 SWF 或 Ruffle 尚未完整支持的游戏，可能无法完美运行。

## 版权与内容提醒

本仓库只包含 FlashManager 程序源码。请不要把第三方 SWF 游戏、封面图片或个人游戏库提交到仓库，除非你确认自己拥有分享权利。

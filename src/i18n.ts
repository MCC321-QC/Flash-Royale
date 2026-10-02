import { majorMessages, type MajorLanguage } from "./i18n-major";

export type Language = "en" | "zh" | MajorLanguage;

export const datePlaceholderLabels: Record<Language, string> = {
  en: "YYYY-MM-DD",
  zh: "YYYY-MM-DD",
  es: "AAAA-MM-DD",
  fr: "AAAA-MM-JJ",
  de: "JJJJ-MM-TT",
  "pt-BR": "AAAA-MM-DD",
  ja: "YYYY-MM-DD",
  ko: "YYYY-MM-DD",
  hi: "YYYY-MM-DD",
  ar: "YYYY-MM-DD",
  ru: "ГГГГ-ММ-ДД",
};

const baseMessages = {
  zh: {
    never: "从未",
    notPlayed: "未玩过",
    ruffleLoadFailed: "Ruffle 加载失败",
    ruffleMissing: "Ruffle 资源不存在，请先运行 npm.cmd install",
    coverCaptured: "截图",
    coverCustom: "自定义",
    coverFallback: "自动占位",
    coverTooSmall: "画面尺寸太小，已保留原封面",
    coverNotRendered: "画面还没渲染出来，已保留原封面",
    canvasUnavailable: "无法创建封面画布",
    coverDataInvalid: "截图数据异常，已保留原封面",
    coverAlt: "封面",
    localLibrary: "本地游戏库",
    allGames: "全部游戏",
    favorites: "收藏",
    categories: "分类",
    tags: "标签",
    renameCategory: "重命名分类",
    renameTag: "重命名标签",
    deleteTag: "删除标签",
    selectedFavorite: "收藏",
    emptySelected: "还没有选中游戏",
    emptySelectedHint: "导入 SWF 后，在这里编辑标签、分类和备注。",
    run: "运行",
    chooseCover: "选择本地图片作为封面",
    delete: "删除",
    title: "标题",
    category: "分类",
    releaseDate: "发行日期",
    developer: "开发商",
    publisher: "发行商",
    release: "发行",
    uncategorized: "未分类",
    chooseRecentCategory: "选择历史分类",
    tagsPlaceholder: "动作, 解谜, 童年",
    notes: "备注",
    saveChanges: "保存修改",
    file: "文件",
    plays: "游玩",
    times: "次",
    lastPlayed: "最近",
    cover: "封面",
    readyToLoad: "准备加载",
    loadingRuffle: "加载 Ruffle",
    loadingGame: "载入游戏",
    running: "运行中",
    gameLoadFailed: "游戏加载失败",
    close: "关闭",
    settings: "设置",
    language: "语言",
    settingsDescription: "选择 Flash Royale 的显示语言。",
    english: "English",
    simplifiedChinese: "简体中文",
    spanish: "西班牙语",
    french: "法语",
    german: "德语",
    brazilianPortuguese: "巴西葡萄牙语",
    japanese: "日语",
    korean: "韩语",
    hindi: "印地语",
    arabic: "阿拉伯语",
    russian: "俄语",
    searchPlaceholder: "搜索标题、标签、分类、备注或文件名",
    clearSearch: "清空搜索",
    importSwf: "导入 SWF",
    currentResults: "当前结果",
    gamesInLibrary: "库内游戏",
    libraryDirectory: "库目录",
    initializing: "初始化中",
    emptyLibrary: "这里还没有游戏",
    emptyLibraryHint: "点击“导入 SWF”，或者把文件拖进窗口。",
    dropHint: "松手导入 SWF",
    importSummary: "导入 {imported} 个，跳过 {skipped} 个",
    importFailed: "导入失败",
    saved: "修改已保存",
    saveFailed: "保存失败",
    deleteConfirm: "删除《{title}》？\n\n确定：删除记录并询问是否删除文件。",
    deleteFilesConfirm: "是否同时删除库目录里的 SWF 和封面文件？",
    deleted: "游戏已删除",
    deleteFailed: "删除失败",
    playRecordFailed: "游玩记录更新失败，但游戏仍会尝试运行",
    newTagName: "新的标签名称",
    tagRenamed: "标签已重命名",
    removeTagConfirm: "从所有游戏中移除标签「{tag}」？",
    tagRemoved: "标签已移除",
    newCategoryName: "新的分类名称",
    categoryRenamed: "分类已重命名",
    noDropPath: "当前 Electron 没有暴露拖拽文件路径，请使用导入按钮",
    dragImportFailed: "拖拽导入失败",
    automaticCoverCreated: "自动封面已生成",
    customCoverUpdated: "自定义封面已更新",
    originalCoverKept: "已保留原封面",
    chooseCoverFailed: "选择封面失败",
    gameNotFound: "找不到游戏",
    dataUrlInvalid: "只接受 PNG、JPG、WEBP data URL",
    coverDataTooSmall: "封面图片数据太小，已保留原封面",
    coverTypeUnsupported: "仅支持 PNG、JPG、WEBP 封面",
    coverImageInvalid: "封面图片无效，已保留原封面",
    notSwf: "不是 SWF 文件",
    alreadyInLibrary: "已在库中",
    electronOnlyEdit: "请在 Electron 应用中编辑游戏",
    electronOnlyPlay: "请在 Electron 应用中运行游戏",
    electronOnlySaveCover: "请在 Electron 应用中保存封面",
    electronOnlyChooseCover: "请在 Electron 应用中选择封面",
  },
  en: {
    never: "Never",
    notPlayed: "Not Played",
    ruffleLoadFailed: "Ruffle failed to load",
    ruffleMissing: "Ruffle assets are missing. Run npm.cmd install first.",
    coverCaptured: "Captured",
    coverCustom: "Custom",
    coverFallback: "Placeholder",
    coverTooSmall: "The rendered image is too small; the original cover was kept.",
    coverNotRendered: "The game has not rendered yet; the original cover was kept.",
    canvasUnavailable: "Could not create a cover canvas.",
    coverDataInvalid: "Screenshot data is invalid; the original cover was kept.",
    coverAlt: "cover",
    localLibrary: "Local game library",
    allGames: "All games",
    favorites: "Favorites",
    categories: "Categories",
    tags: "Tags",
    renameCategory: "Rename category",
    renameTag: "Rename tag",
    deleteTag: "Delete tag",
    selectedFavorite: "Favorite",
    emptySelected: "No game selected",
    emptySelectedHint: "Import an SWF to edit its tags, category, and notes here.",
    run: "Play",
    chooseCover: "Choose a local image for the cover",
    delete: "Delete",
    title: "Title",
    category: "Category",
    releaseDate: "Release date",
    developer: "Developer",
    publisher: "Publisher",
    release: "Release",
    uncategorized: "Uncategorized",
    chooseRecentCategory: "Choose a recent category",
    tagsPlaceholder: "Action, Puzzle, Childhood",
    notes: "Notes",
    saveChanges: "Save changes",
    file: "File",
    plays: "Played",
    times: "times",
    lastPlayed: "Last played",
    cover: "Cover",
    readyToLoad: "Preparing to load",
    loadingRuffle: "Loading Ruffle",
    loadingGame: "Loading game",
    running: "Running",
    gameLoadFailed: "Failed to load game",
    close: "Close",
    settings: "Settings",
    language: "Language",
    settingsDescription: "Choose the display language for Flash Royale.",
    english: "English",
    simplifiedChinese: "Simplified Chinese",
    spanish: "Spanish",
    french: "French",
    german: "German",
    brazilianPortuguese: "Brazilian Portuguese",
    japanese: "Japanese",
    korean: "Korean",
    hindi: "Hindi",
    arabic: "Arabic",
    russian: "Russian",
    searchPlaceholder: "Search titles, tags, categories, notes, or file names",
    clearSearch: "Clear search",
    importSwf: "Import SWF",
    currentResults: "Results",
    gamesInLibrary: "In library",
    libraryDirectory: "Library",
    initializing: "Initializing",
    emptyLibrary: "No games here yet",
    emptyLibraryHint: "Select “Import SWF” or drop files into the window.",
    dropHint: "Drop to import SWF",
    importSummary: "Imported {imported}, skipped {skipped}",
    importFailed: "Import failed",
    saved: "Changes saved",
    saveFailed: "Failed to save changes",
    deleteConfirm: "Delete “{title}”?\n\nThis removes the library entry and asks whether to delete its files.",
    deleteFilesConfirm: "Also delete the SWF and cover files from the library folder?",
    deleted: "Game deleted",
    deleteFailed: "Failed to delete game",
    playRecordFailed: "Could not update play history. The game will still try to run.",
    newTagName: "New tag name",
    tagRenamed: "Tag renamed",
    removeTagConfirm: "Remove the tag “{tag}” from all games?",
    tagRemoved: "Tag removed",
    newCategoryName: "New category name",
    categoryRenamed: "Category renamed",
    noDropPath: "Electron did not provide dropped file paths. Use the Import button instead.",
    dragImportFailed: "Failed to import dropped files",
    automaticCoverCreated: "Automatic cover created",
    customCoverUpdated: "Custom cover updated",
    originalCoverKept: "Original cover kept",
    chooseCoverFailed: "Failed to choose a cover",
    gameNotFound: "Game not found",
    dataUrlInvalid: "Only PNG, JPG, and WEBP data URLs are accepted.",
    coverDataTooSmall: "Cover image data is too small; the original cover was kept.",
    coverTypeUnsupported: "Only PNG, JPG, and WEBP covers are supported.",
    coverImageInvalid: "Cover image is invalid; the original cover was kept.",
    notSwf: "Not an SWF file",
    alreadyInLibrary: "Already in library",
    electronOnlyEdit: "Game editing is only available in the Electron app.",
    electronOnlyPlay: "Game playback is only available in the Electron app.",
    electronOnlySaveCover: "Saving covers is only available in the Electron app.",
    electronOnlyChooseCover: "Choosing covers is only available in the Electron app.",
  },
} as const;

type LocaleMessages = { [Key in keyof typeof baseMessages.en]: string };

const automaticCoverCapturedLabels: Record<Language, string> = {
  en: "Captured automatically",
  zh: "自动截图",
  es: "Capturada automáticamente",
  fr: "Capturée automatiquement",
  de: "Automatisch erfasst",
  "pt-BR": "Capturada automaticamente",
  ja: "自動キャプチャ",
  ko: "자동 캡처됨",
  hi: "स्वचालित रूप से कैप्चर किया गया",
  ar: "لقطة تلقائية",
  ru: "Создана автоматически",
};

export const messages = Object.fromEntries(
  Object.entries({ ...baseMessages, ...majorMessages }).map(([language, locale]) => [
    language,
    { ...locale, coverCaptured: automaticCoverCapturedLabels[language as Language] },
  ]),
) as Record<Language, LocaleMessages>;

export const importCountLabels: Record<Language, { imported: string; skipped: string }> = {
  en: { imported: "Imported:", skipped: "Skipped:" },
  zh: { imported: "导入：", skipped: "跳过：" },
  es: { imported: "Importados:", skipped: "Omitidos:" },
  fr: { imported: "Importés :", skipped: "Ignorés :" },
  de: { imported: "Importiert:", skipped: "Übersprungen:" },
  "pt-BR": { imported: "Importados:", skipped: "Ignorados:" },
  ja: { imported: "インポート：", skipped: "スキップ：" },
  ko: { imported: "가져옴:", skipped: "건너뜀:" },
  hi: { imported: "आयात:", skipped: "छोड़े गए:" },
  ar: { imported: "تم الاستيراد:", skipped: "تم التخطي:" },
  ru: { imported: "Импортировано:", skipped: "Пропущено:" },
};

export const playerControlLabels: Record<Language, {
  playerControls: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  zoomLevel: string;
  fullscreen: string;
  exitFullscreen: string;
  showOptionsBar: string;
  hideOptionsBar: string;
  pinControls: string;
  unpinControls: string;
}> = {
  en: { playerControls: "Player controls", zoomIn: "Zoom in", zoomOut: "Zoom out", resetZoom: "Reset zoom", zoomLevel: "Zoom level", fullscreen: "Enter fullscreen", exitFullscreen: "Exit fullscreen", showOptionsBar: "Show player options", hideOptionsBar: "Hide player options", pinControls: "Keep controls visible", unpinControls: "Unpin controls" },
  zh: { playerControls: "播放器控制", zoomIn: "放大", zoomOut: "缩小", resetZoom: "重置缩放", zoomLevel: "缩放级别", fullscreen: "进入全屏", exitFullscreen: "退出全屏", showOptionsBar: "显示播放器选项", hideOptionsBar: "隐藏播放器选项", pinControls: "保持控制栏显示", unpinControls: "取消固定控制栏" },
  es: { playerControls: "Controles del reproductor", zoomIn: "Ampliar", zoomOut: "Reducir", resetZoom: "Restablecer zoom", zoomLevel: "Nivel de zoom", fullscreen: "Entrar en pantalla completa", exitFullscreen: "Salir de pantalla completa", showOptionsBar: "Mostrar opciones del reproductor", hideOptionsBar: "Ocultar opciones del reproductor", pinControls: "Mantener visibles los controles", unpinControls: "Desfijar controles" },
  fr: { playerControls: "Commandes du lecteur", zoomIn: "Agrandir", zoomOut: "Réduire", resetZoom: "Réinitialiser le zoom", zoomLevel: "Niveau de zoom", fullscreen: "Passer en plein écran", exitFullscreen: "Quitter le plein écran", showOptionsBar: "Afficher les options du lecteur", hideOptionsBar: "Masquer les options du lecteur", pinControls: "Garder les commandes visibles", unpinControls: "Détacher les commandes" },
  de: { playerControls: "Player-Steuerung", zoomIn: "Vergrößern", zoomOut: "Verkleinern", resetZoom: "Zoom zurücksetzen", zoomLevel: "Zoomstufe", fullscreen: "Vollbild aktivieren", exitFullscreen: "Vollbild beenden", showOptionsBar: "Player-Optionen anzeigen", hideOptionsBar: "Player-Optionen ausblenden", pinControls: "Steuerung eingeblendet lassen", unpinControls: "Steuerung lösen" },
  "pt-BR": { playerControls: "Controles do player", zoomIn: "Aumentar zoom", zoomOut: "Diminuir zoom", resetZoom: "Redefinir zoom", zoomLevel: "Nível de zoom", fullscreen: "Entrar em tela cheia", exitFullscreen: "Sair da tela cheia", showOptionsBar: "Mostrar opções do player", hideOptionsBar: "Ocultar opções do player", pinControls: "Manter controles visíveis", unpinControls: "Desafixar controles" },
  ja: { playerControls: "プレイヤー操作", zoomIn: "拡大", zoomOut: "縮小", resetZoom: "ズームをリセット", zoomLevel: "ズーム倍率", fullscreen: "全画面表示", exitFullscreen: "全画面表示を終了", showOptionsBar: "プレイヤーオプションを表示", hideOptionsBar: "プレイヤーオプションを非表示", pinControls: "操作バーを表示したままにする", unpinControls: "操作バーの固定を解除" },
  ko: { playerControls: "플레이어 컨트롤", zoomIn: "확대", zoomOut: "축소", resetZoom: "확대/축소 초기화", zoomLevel: "확대 비율", fullscreen: "전체 화면", exitFullscreen: "전체 화면 종료", showOptionsBar: "플레이어 옵션 표시", hideOptionsBar: "플레이어 옵션 숨기기", pinControls: "컨트롤 항상 표시", unpinControls: "컨트롤 고정 해제" },
  hi: { playerControls: "प्लेयर नियंत्रण", zoomIn: "ज़ूम बढ़ाएँ", zoomOut: "ज़ूम घटाएँ", resetZoom: "ज़ूम रीसेट करें", zoomLevel: "ज़ूम स्तर", fullscreen: "पूर्ण स्क्रीन करें", exitFullscreen: "पूर्ण स्क्रीन से बाहर आएँ", showOptionsBar: "प्लेयर विकल्प दिखाएँ", hideOptionsBar: "प्लेयर विकल्प छिपाएँ", pinControls: "नियंत्रण हमेशा दिखाएँ", unpinControls: "नियंत्रण अनपिन करें" },
  ar: { playerControls: "عناصر تحكم المشغل", zoomIn: "تكبير", zoomOut: "تصغير", resetZoom: "إعادة ضبط التكبير", zoomLevel: "مستوى التكبير", fullscreen: "ملء الشاشة", exitFullscreen: "إنهاء ملء الشاشة", showOptionsBar: "إظهار خيارات المشغل", hideOptionsBar: "إخفاء خيارات المشغل", pinControls: "إبقاء عناصر التحكم ظاهرة", unpinControls: "إلغاء تثبيت عناصر التحكم" },
  ru: { playerControls: "Управление проигрывателем", zoomIn: "Увеличить", zoomOut: "Уменьшить", resetZoom: "Сбросить масштаб", zoomLevel: "Масштаб", fullscreen: "На весь экран", exitFullscreen: "Выйти из полноэкранного режима", showOptionsBar: "Показать настройки проигрывателя", hideOptionsBar: "Скрыть настройки проигрывателя", pinControls: "Оставить панель видимой", unpinControls: "Открепить панель" },
};

export const gameSettingsLabels: Record<Language, { fullscreenByDefault: string; repeatMusic: string }> = {
  en: { fullscreenByDefault: "Start this game in fullscreen", repeatMusic: "Repeat this game's music" },
  zh: { fullscreenByDefault: "默认全屏启动此游戏", repeatMusic: "循环播放此游戏的音乐" },
  es: { fullscreenByDefault: "Iniciar este juego en pantalla completa", repeatMusic: "Repetir la música de este juego" },
  fr: { fullscreenByDefault: "Démarrer ce jeu en plein écran", repeatMusic: "Répéter la musique de ce jeu" },
  de: { fullscreenByDefault: "Dieses Spiel standardmäßig im Vollbild starten", repeatMusic: "Musik dieses Spiels wiederholen" },
  "pt-BR": { fullscreenByDefault: "Iniciar este jogo em tela cheia", repeatMusic: "Repetir a música deste jogo" },
  ja: { fullscreenByDefault: "このゲームを全画面で起動", repeatMusic: "このゲームの音楽を繰り返す" },
  ko: { fullscreenByDefault: "이 게임을 전체 화면으로 시작", repeatMusic: "이 게임의 음악 반복" },
  hi: { fullscreenByDefault: "इस गेम को पूर्ण स्क्रीन में शुरू करें", repeatMusic: "इस गेम का संगीत दोहराएँ" },
  ar: { fullscreenByDefault: "بدء هذه اللعبة بملء الشاشة", repeatMusic: "تكرار موسيقى هذه اللعبة" },
  ru: { fullscreenByDefault: "Запускать эту игру в полноэкранном режиме", repeatMusic: "Повторять музыку этой игры" },
};

export const playTimeLabels: Record<Language, { playTime: string; session: string; activeSession: string; hour: string; minute: string; second: string }> = {
  en: { playTime: "Play time", session: "Session", activeSession: "Current session", hour: "h", minute: "min", second: "s" },
  zh: { playTime: "游戏时间", session: "本次游戏", activeSession: "正在进行的游戏", hour: "小时", minute: "分", second: "s" },
  es: { playTime: "Tiempo de juego", session: "Sesión", activeSession: "Sesión en curso", hour: "h", minute: "min", second: "s" },
  fr: { playTime: "Temps de jeu", session: "Session", activeSession: "Session en cours", hour: "h", minute: "min", second: "s" },
  de: { playTime: "Spielzeit", session: "Sitzung", activeSession: "Aktuelle Sitzung", hour: "Std.", minute: "Min.", second: "s" },
  "pt-BR": { playTime: "Tempo de jogo", session: "Sessão", activeSession: "Sessão em andamento", hour: "h", minute: "min", second: "s" },
  ja: { playTime: "プレイ時間", session: "今回のプレイ", activeSession: "プレイ中", hour: "時間", minute: "分", second: "s" },
  ko: { playTime: "플레이 시간", session: "이번 세션", activeSession: "플레이 중", hour: "시간", minute: "분", second: "s" },
  hi: { playTime: "खेलने का समय", session: "वर्तमान सत्र", activeSession: "वर्तमान में खेल रहे हैं", hour: "घं.", minute: "मि.", second: "s" },
  ar: { playTime: "وقت اللعب", session: "الجلسة الحالية", activeSession: "الجلسة قيد التشغيل", hour: "س", minute: "د", second: "s" },
  ru: { playTime: "Время игры", session: "Текущий сеанс", activeSession: "Сеанс в процессе", hour: "ч", minute: "мин", second: "s" },
};

export const themeLabels: Record<Language, { play: string; stop: string; selectFirst: string; noMusic: string; gameRunning: string; volume: string }> = {
  en: { play: "Play game theme", stop: "Stop game theme", selectFirst: "Select a game to play its music", noMusic: "No music available for this game", gameRunning: "Music is paused while a game is running", volume: "Game music volume" },
  zh: { play: "播放游戏主题曲", stop: "停止游戏主题曲", selectFirst: "选择一个游戏以播放其音乐", noMusic: "此游戏没有可用的音乐", gameRunning: "游戏运行时音乐已暂停", volume: "游戏音乐音量" },
  es: { play: "Reproducir tema del juego", stop: "Detener tema del juego", selectFirst: "Selecciona un juego para reproducir su música", noMusic: "No hay música disponible para este juego", gameRunning: "La música se pausa mientras un juego está en ejecución", volume: "Volumen de la música del juego" },
  fr: { play: "Jouer le thème du jeu", stop: "Arrêter le thème du jeu", selectFirst: "Sélectionnez un jeu pour jouer sa musique", noMusic: "Aucune musique disponible pour ce jeu", gameRunning: "La musique est en pause pendant qu’un jeu est lancé", volume: "Volume de la musique du jeu" },
  de: { play: "Spielmusik abspielen", stop: "Spielmusik stoppen", selectFirst: "Wähle ein Spiel, um seine Musik abzuspielen", noMusic: "Für dieses Spiel ist keine Musik verfügbar", gameRunning: "Die Musik pausiert, während ein Spiel läuft", volume: "Lautstärke der Spielmusik" },
  "pt-BR": { play: "Tocar tema do jogo", stop: "Parar tema do jogo", selectFirst: "Selecione um jogo para tocar a música", noMusic: "Nenhuma música disponível para este jogo", gameRunning: "A música fica pausada enquanto um jogo está em execução", volume: "Volume da música do jogo" },
  ja: { play: "ゲームのテーマ曲を再生", stop: "ゲームのテーマ曲を停止", selectFirst: "ゲームを選択すると音楽を再生できます", noMusic: "このゲームには再生できる音楽がありません", gameRunning: "ゲーム実行中は音楽を一時停止しています", volume: "ゲーム音楽の音量" },
  ko: { play: "게임 테마 재생", stop: "게임 테마 정지", selectFirst: "음악을 재생할 게임을 선택하세요", noMusic: "이 게임에는 사용할 수 있는 음악이 없습니다", gameRunning: "게임이 실행 중일 때는 음악이 일시 중지됩니다", volume: "게임 음악 음량" },
  hi: { play: "गेम थीम चलाएँ", stop: "गेम थीम रोकें", selectFirst: "संगीत चलाने के लिए कोई गेम चुनें", noMusic: "इस गेम के लिए कोई संगीत उपलब्ध नहीं है", gameRunning: "गेम चलने के दौरान संगीत रुका रहता है", volume: "गेम संगीत वॉल्यूम" },
  ar: { play: "تشغيل موسيقى اللعبة", stop: "إيقاف موسيقى اللعبة", selectFirst: "اختر لعبة لتشغيل موسيقاها", noMusic: "لا توجد موسيقى متاحة لهذه اللعبة", gameRunning: "تتوقف الموسيقى مؤقتًا أثناء تشغيل لعبة", volume: "مستوى صوت موسيقى اللعبة" },
  ru: { play: "Включить музыку игры", stop: "Остановить музыку игры", selectFirst: "Выберите игру, чтобы включить её музыку", noMusic: "Для этой игры нет музыки", gameRunning: "Музыка приостановлена, пока запущена игра", volume: "Громкость музыки игры" },
};

export const musicLabels: Record<
  Language,
  { choose: string; remove: string; music: string; builtIn: string; none: string; failed: string; defaultMusic: string; track: string }
> = {
  en: { choose: "Select custom music file", remove: "Remove custom music", music: "Music", builtIn: "{file} (built-in)", none: "None", failed: "Could not change the music file", defaultMusic: "Default music", track: "Track {n}" },
  zh: { choose: "选择自定义音乐文件", remove: "移除自定义音乐", music: "音乐", builtIn: "{file}（内置）", none: "无", failed: "无法更改音乐文件", defaultMusic: "默认音乐", track: "曲目 {n}" },
  es: { choose: "Seleccionar archivo de música", remove: "Quitar música personalizada", music: "Música", builtIn: "{file} (integrada)", none: "Ninguna", failed: "No se pudo cambiar el archivo de música", defaultMusic: "Música predeterminada", track: "Pista {n}" },
  fr: { choose: "Choisir un fichier de musique", remove: "Supprimer la musique personnalisée", music: "Musique", builtIn: "{file} (intégrée)", none: "Aucune", failed: "Impossible de changer le fichier de musique", defaultMusic: "Musique par défaut", track: "Piste {n}" },
  de: { choose: "Eigene Musikdatei wählen", remove: "Eigene Musik entfernen", music: "Musik", builtIn: "{file} (integriert)", none: "Keine", failed: "Musikdatei konnte nicht geändert werden", defaultMusic: "Standardmusik", track: "Titel {n}" },
  "pt-BR": { choose: "Selecionar arquivo de música", remove: "Remover música personalizada", music: "Música", builtIn: "{file} (integrada)", none: "Nenhuma", failed: "Não foi possível alterar o arquivo de música", defaultMusic: "Música padrão", track: "Faixa {n}" },
  ja: { choose: "カスタム音楽ファイルを選択", remove: "カスタム音楽を削除", music: "音楽", builtIn: "{file}（内蔵）", none: "なし", failed: "音楽ファイルを変更できませんでした", defaultMusic: "既定の音楽", track: "トラック {n}" },
  ko: { choose: "사용자 음악 파일 선택", remove: "사용자 음악 제거", music: "음악", builtIn: "{file} (내장)", none: "없음", failed: "음악 파일을 변경할 수 없습니다", defaultMusic: "기본 음악", track: "트랙 {n}" },
  hi: { choose: "कस्टम संगीत फ़ाइल चुनें", remove: "कस्टम संगीत हटाएँ", music: "संगीत", builtIn: "{file} (अंतर्निहित)", none: "कोई नहीं", failed: "संगीत फ़ाइल नहीं बदली जा सकी", defaultMusic: "डिफ़ॉल्ट संगीत", track: "ट्रैक {n}" },
  ar: { choose: "اختيار ملف موسيقى مخصص", remove: "إزالة الموسيقى المخصصة", music: "الموسيقى", builtIn: "{file} (مدمجة)", none: "لا شيء", failed: "تعذر تغيير ملف الموسيقى", defaultMusic: "الموسيقى الافتراضية", track: "المسار {n}" },
  ru: { choose: "Выбрать свой файл музыки", remove: "Удалить свою музыку", music: "Музыка", builtIn: "{file} (встроенная)", none: "Нет", failed: "Не удалось изменить файл музыки", defaultMusic: "Музыка по умолчанию", track: "Дорожка {n}" },
};

export const closeBlockedLabels: Record<Language, string> = {
  en: "Flash Royale can’t be closed while a game is running. Stop the game first.",
  zh: "游戏运行时无法关闭 Flash Royale。请先停止游戏。",
  es: "No se puede cerrar Flash Royale mientras un juego está en ejecución. Detén el juego primero.",
  fr: "Impossible de fermer Flash Royale pendant qu’un jeu est lancé. Arrêtez d’abord le jeu.",
  de: "Flash Royale kann nicht geschlossen werden, solange ein Spiel läuft. Beende zuerst das Spiel.",
  "pt-BR": "Não é possível fechar o Flash Royale enquanto um jogo está em execução. Pare o jogo primeiro.",
  ja: "ゲームの実行中は Flash Royale を閉じられません。先にゲームを終了してください。",
  ko: "게임이 실행 중일 때는 Flash Royale를 닫을 수 없습니다. 먼저 게임을 종료하세요.",
  hi: "गेम चलते समय Flash Royale बंद नहीं किया जा सकता। पहले गेम बंद करें।",
  ar: "لا يمكن إغلاق Flash Royale أثناء تشغيل لعبة. أوقف اللعبة أولًا.",
  ru: "Нельзя закрыть Flash Royale, пока запущена игра. Сначала остановите игру.",
};

export const exploreCloseBlockedLabels: Record<Language, string> = {
  en: "Flash Royale cannot be closed while Explore is open. Close the Explore window first.",
  zh: "探索窗口打开时无法关闭 Flash Royale。请先关闭探索窗口。",
  es: "No se puede cerrar Flash Royale mientras Explorar está abierto. Cierra primero la ventana de Explorar.",
  fr: "Impossible de fermer Flash Royale tant qu’Explorer est ouvert. Fermez d’abord la fenêtre Explorer.",
  de: "Flash Royale kann nicht geschlossen werden, solange Explore geöffnet ist. Schließe zuerst das Explore-Fenster.",
  "pt-BR": "Não é possível fechar o Flash Royale enquanto Explorar está aberto. Feche primeiro a janela de Explorar.",
  ja: "探索が開いている間は Flash Royale を閉じられません。先に探索ウィンドウを閉じてください。",
  ko: "탐색 창이 열려 있으면 Flash Royale를 닫을 수 없습니다. 먼저 탐색 창을 닫으세요.",
  hi: "एक्सप्लोर खुला होने पर Flash Royale बंद नहीं किया जा सकता। पहले एक्सप्लोर विंडो बंद करें।",
  ar: "لا يمكن إغلاق Flash Royale أثناء فتح الاستكشاف. أغلق نافذة الاستكشاف أولًا.",
  ru: "Нельзя закрыть Flash Royale, пока открыт поиск игр. Сначала закройте окно поиска игр.",
};

export const toastLabels: Record<Language, { appStarted: string; gameStarted: string; gameStopped: string; coversFinished: string; coverCreated: string }> = {
  en: { appStarted: "App started", gameStarted: "Game started: {title}", gameStopped: "Game stopped: {title}", coversFinished: "Automatic cover creation finished", coverCreated: "Automatic cover created: {title}" },
  zh: { appStarted: "应用已启动", gameStarted: "游戏已启动：{title}", gameStopped: "游戏已停止：{title}", coversFinished: "自动封面生成已完成", coverCreated: "已自动生成封面：{title}" },
  es: { appStarted: "Aplicación iniciada", gameStarted: "Juego iniciado: {title}", gameStopped: "Juego detenido: {title}", coversFinished: "Creación automática de portadas terminada", coverCreated: "Portada automática creada: {title}" },
  fr: { appStarted: "Application démarrée", gameStarted: "Jeu lancé : {title}", gameStopped: "Jeu arrêté : {title}", coversFinished: "Création automatique des couvertures terminée", coverCreated: "Couverture automatique créée : {title}" },
  de: { appStarted: "App gestartet", gameStarted: "Spiel gestartet: {title}", gameStopped: "Spiel beendet: {title}", coversFinished: "Automatische Cover-Erstellung abgeschlossen", coverCreated: "Automatisches Cover erstellt: {title}" },
  "pt-BR": { appStarted: "App iniciado", gameStarted: "Jogo iniciado: {title}", gameStopped: "Jogo encerrado: {title}", coversFinished: "Criação automática de capas concluída", coverCreated: "Capa automática criada: {title}" },
  ja: { appStarted: "アプリを起動しました", gameStarted: "ゲームを開始：{title}", gameStopped: "ゲームを終了：{title}", coversFinished: "カバーの自動作成が完了しました", coverCreated: "カバーを自動作成しました：{title}" },
  ko: { appStarted: "앱이 시작되었습니다", gameStarted: "게임 시작: {title}", gameStopped: "게임 종료: {title}", coversFinished: "자동 커버 생성 완료", coverCreated: "자동 커버 생성됨: {title}" },
  hi: { appStarted: "ऐप शुरू हुआ", gameStarted: "गेम शुरू हुआ: {title}", gameStopped: "गेम बंद हुआ: {title}", coversFinished: "स्वचालित कवर निर्माण पूरा हुआ", coverCreated: "स्वचालित कवर बनाया गया: {title}" },
  ar: { appStarted: "تم تشغيل التطبيق", gameStarted: "بدأت اللعبة: {title}", gameStopped: "توقفت اللعبة: {title}", coversFinished: "اكتمل إنشاء الأغلفة تلقائيًا", coverCreated: "تم إنشاء غلاف تلقائي: {title}" },
  ru: { appStarted: "Приложение запущено", gameStarted: "Игра запущена: {title}", gameStopped: "Игра остановлена: {title}", coversFinished: "Автоматическое создание обложек завершено", coverCreated: "Обложка создана автоматически: {title}" },
};

export const coverCaptureLabels: Record<Language, { chooseImage: string; recapture: string; capturing: string }> = {
  en: { chooseImage: "Select cover image", recapture: "Redo automatic cover", capturing: "Capturing cover…" },
  zh: { chooseImage: "选择封面图片", recapture: "重新自动生成封面", capturing: "正在截取封面…" },
  es: { chooseImage: "Seleccionar imagen de portada", recapture: "Rehacer portada automática", capturing: "Capturando portada…" },
  fr: { chooseImage: "Choisir une image de couverture", recapture: "Refaire la couverture automatique", capturing: "Capture de la couverture…" },
  de: { chooseImage: "Coverbild auswählen", recapture: "Automatisches Cover neu erstellen", capturing: "Cover wird erfasst…" },
  "pt-BR": { chooseImage: "Selecionar imagem de capa", recapture: "Refazer capa automática", capturing: "Capturando capa…" },
  ja: { chooseImage: "カバー画像を選択", recapture: "カバーを自動で再作成", capturing: "カバーをキャプチャ中…" },
  ko: { chooseImage: "커버 이미지 선택", recapture: "자동 커버 다시 만들기", capturing: "커버 캡처 중…" },
  hi: { chooseImage: "कवर छवि चुनें", recapture: "स्वचालित कवर फिर से बनाएँ", capturing: "कवर कैप्चर हो रहा है…" },
  ar: { chooseImage: "اختيار صورة الغلاف", recapture: "إعادة إنشاء الغلاف تلقائيًا", capturing: "جارٍ التقاط الغلاف…" },
  ru: { chooseImage: "Выбрать обложку", recapture: "Пересоздать обложку автоматически", capturing: "Захват обложки…" },
};

export const importProgressLabels: Record<
  Language,
  { title: string; fileCount: string; cancelling: string; done: string; cancelled: string; added: string; skipped: string; none: string; ok: string }
> = {
  en: { title: "Importing games…", fileCount: "File {current} of {total}", cancelling: "Cancelling…", done: "Import complete", cancelled: "Import cancelled", added: "Added ({count})", skipped: "Skipped ({count})", none: "None", ok: "OK" },
  zh: { title: "正在导入游戏…", fileCount: "第 {current} / {total} 个文件", cancelling: "正在取消…", done: "导入完成", cancelled: "导入已取消", added: "已添加 ({count})", skipped: "已跳过 ({count})", none: "无", ok: "确定" },
  es: { title: "Importando juegos…", fileCount: "Archivo {current} de {total}", cancelling: "Cancelando…", done: "Importación completada", cancelled: "Importación cancelada", added: "Añadidos ({count})", skipped: "Omitidos ({count})", none: "Ninguno", ok: "Aceptar" },
  fr: { title: "Importation des jeux…", fileCount: "Fichier {current} sur {total}", cancelling: "Annulation…", done: "Importation terminée", cancelled: "Importation annulée", added: "Ajoutés ({count})", skipped: "Ignorés ({count})", none: "Aucun", ok: "OK" },
  de: { title: "Spiele werden importiert…", fileCount: "Datei {current} von {total}", cancelling: "Wird abgebrochen…", done: "Import abgeschlossen", cancelled: "Import abgebrochen", added: "Hinzugefügt ({count})", skipped: "Übersprungen ({count})", none: "Keine", ok: "OK" },
  "pt-BR": { title: "Importando jogos…", fileCount: "Arquivo {current} de {total}", cancelling: "Cancelando…", done: "Importação concluída", cancelled: "Importação cancelada", added: "Adicionados ({count})", skipped: "Ignorados ({count})", none: "Nenhum", ok: "OK" },
  ja: { title: "ゲームをインポート中…", fileCount: "ファイル {current} / {total}", cancelling: "キャンセル中…", done: "インポート完了", cancelled: "インポートをキャンセルしました", added: "追加 ({count})", skipped: "スキップ ({count})", none: "なし", ok: "OK" },
  ko: { title: "게임 가져오는 중…", fileCount: "파일 {current} / {total}", cancelling: "취소하는 중…", done: "가져오기 완료", cancelled: "가져오기 취소됨", added: "추가됨 ({count})", skipped: "건너뜀 ({count})", none: "없음", ok: "확인" },
  hi: { title: "गेम आयात हो रहे हैं…", fileCount: "फ़ाइल {current} / {total}", cancelling: "रद्द किया जा रहा है…", done: "आयात पूरा हुआ", cancelled: "आयात रद्द किया गया", added: "जोड़े गए ({count})", skipped: "छोड़े गए ({count})", none: "कोई नहीं", ok: "ठीक है" },
  ar: { title: "جارٍ استيراد الألعاب…", fileCount: "الملف {current} من {total}", cancelling: "جارٍ الإلغاء…", done: "اكتمل الاستيراد", cancelled: "تم إلغاء الاستيراد", added: "تمت الإضافة ({count})", skipped: "تم التخطي ({count})", none: "لا شيء", ok: "موافق" },
  ru: { title: "Импорт игр…", fileCount: "Файл {current} из {total}", cancelling: "Отмена…", done: "Импорт завершён", cancelled: "Импорт отменён", added: "Добавлено ({count})", skipped: "Пропущено ({count})", none: "Нет", ok: "OK" },
};

export const exploreImportStageLabels: Record<Language, { preparing: string; downloading: string; saving: string }> = {
  en: { preparing: "Preparing import...", downloading: "Downloading game...", saving: "Saving to library..." },
  zh: { preparing: "正在准备导入...", downloading: "正在下载游戏...", saving: "正在保存到游戏库..." },
  es: { preparing: "Preparando importación...", downloading: "Descargando juego...", saving: "Guardando en la biblioteca..." },
  fr: { preparing: "Préparation de l’importation...", downloading: "Téléchargement du jeu...", saving: "Enregistrement dans la bibliothèque..." },
  de: { preparing: "Import wird vorbereitet...", downloading: "Spiel wird heruntergeladen...", saving: "Spiel wird gespeichert..." },
  "pt-BR": { preparing: "Preparando importação...", downloading: "Baixando jogo...", saving: "Salvando na biblioteca..." },
  ja: { preparing: "インポートを準備中...", downloading: "ゲームをダウンロード中...", saving: "ライブラリに保存中..." },
  ko: { preparing: "가져오기 준비 중...", downloading: "게임 다운로드 중...", saving: "라이브러리에 저장 중..." },
  hi: { preparing: "आयात की तैयारी...", downloading: "गेम डाउनलोड हो रहा है...", saving: "लाइब्रेरी में सहेज रहे हैं..." },
  ar: { preparing: "جارٍ التحضير للاستيراد...", downloading: "جارٍ تنزيل اللعبة...", saving: "جارٍ الحفظ في المكتبة..." },
  ru: { preparing: "Подготовка импорта...", downloading: "Загрузка игры...", saving: "Сохранение в библиотеку..." },
};

export const exploreImportTitleLabels: Record<Language, string> = {
  en: "Importing {title}",
  zh: "正在导入 {title}",
  es: "Importando {title}",
  fr: "Importation de {title}",
  de: "{title} wird importiert",
  "pt-BR": "Importando {title}",
  ja: "{title} をインポート中",
  ko: "{title} 가져오는 중",
  hi: "{title} आयात हो रहा है",
  ar: "جارٍ استيراد {title}",
  ru: "Импорт {title}",
};

export const libraryMigrationLabels: Record<Language, { title: string; preparing: string; status: string }> = {
  en: { title: "Updating game folders", preparing: "Preparing your library...", status: "Game {current} of {total}: {title}" },
  zh: { title: "正在更新游戏文件夹", preparing: "正在准备游戏库...", status: "游戏 {current}/{total}：{title}" },
  es: { title: "Actualizando las carpetas de juegos", preparing: "Preparando la biblioteca...", status: "Juego {current} de {total}: {title}" },
  fr: { title: "Mise à jour des dossiers de jeux", preparing: "Préparation de la bibliothèque...", status: "Jeu {current} sur {total} : {title}" },
  de: { title: "Spieleordner werden aktualisiert", preparing: "Bibliothek wird vorbereitet...", status: "Spiel {current} von {total}: {title}" },
  "pt-BR": { title: "Atualizando pastas dos jogos", preparing: "Preparando sua biblioteca...", status: "Jogo {current} de {total}: {title}" },
  ja: { title: "ゲームフォルダーを更新中", preparing: "ライブラリを準備中...", status: "ゲーム {current}/{total}: {title}" },
  ko: { title: "게임 폴더 업데이트 중", preparing: "라이브러리 준비 중...", status: "게임 {current}/{total}: {title}" },
  hi: { title: "गेम फ़ोल्डर अपडेट हो रहे हैं", preparing: "आपकी लाइब्रेरी तैयार हो रही है...", status: "गेम {current}/{total}: {title}" },
  ar: { title: "جارٍ تحديث مجلدات الألعاب", preparing: "جارٍ تجهيز المكتبة...", status: "اللعبة {current} من {total}: {title}" },
  ru: { title: "Обновление папок игр", preparing: "Подготовка библиотеки...", status: "Игра {current} из {total}: {title}" },
};

export const stopPlayingLabels: Record<Language, string> = {
  en: "Stop Playing",
  zh: "停止游戏",
  es: "Dejar de jugar",
  fr: "Arrêter de jouer",
  de: "Spiel beenden",
  "pt-BR": "Parar de jogar",
  ja: "プレイを終了",
  ko: "플레이 중지",
  hi: "खेलना बंद करें",
  ar: "إيقاف اللعب",
  ru: "Остановить игру",
};

export const detailPanelLabels: Record<Language, { show: string; hide: string; resize: string }> = {
  en: { show: "Show game details", hide: "Hide game details", resize: "Resize game details panel" },
  zh: { show: "显示游戏详情", hide: "隐藏游戏详情", resize: "调整游戏详情面板宽度" },
  es: { show: "Mostrar detalles del juego", hide: "Ocultar detalles del juego", resize: "Cambiar el ancho del panel de detalles" },
  fr: { show: "Afficher les détails du jeu", hide: "Masquer les détails du jeu", resize: "Redimensionner le panneau des détails" },
  de: { show: "Spieldetails anzeigen", hide: "Spieldetails ausblenden", resize: "Breite des Detailbereichs ändern" },
  "pt-BR": { show: "Mostrar detalhes do jogo", hide: "Ocultar detalhes do jogo", resize: "Redimensionar o painel de detalhes" },
  ja: { show: "ゲームの詳細を表示", hide: "ゲームの詳細を非表示", resize: "詳細パネルの幅を変更" },
  ko: { show: "게임 정보 표시", hide: "게임 정보 숨기기", resize: "게임 정보 패널 너비 조절" },
  hi: { show: "गेम विवरण दिखाएँ", hide: "गेम विवरण छिपाएँ", resize: "गेम विवरण पैनल का आकार बदलें" },
  ar: { show: "إظهار تفاصيل اللعبة", hide: "إخفاء تفاصيل اللعبة", resize: "تغيير عرض لوحة تفاصيل اللعبة" },
  ru: { show: "Показать сведения об игре", hide: "Скрыть сведения об игре", resize: "Изменить ширину панели сведений" },
};

export const settingsInfoLabels: Record<Language, { about: string; version: string; author: string; github: string; ruffleVersion: string; originallyMadeBy: string; openOriginalAuthorRepository: string }> = {
  en: { about: "About this app", version: "Version", author: "Author", github: "GitHub repository", ruffleVersion: "Ruffle version", originallyMadeBy: "This app was originally made by xevil3301.", openOriginalAuthorRepository: "Open xevil3301's GitHub repository" },
  zh: { about: "关于此应用", version: "版本", author: "作者", github: "GitHub 仓库", ruffleVersion: "Ruffle 版本", originallyMadeBy: "此应用最初由 xevil3301 制作。", openOriginalAuthorRepository: "打开 xevil3301 的 GitHub 仓库" },
  es: { about: "Acerca de esta aplicación", version: "Versión", author: "Autor", github: "Repositorio de GitHub", ruffleVersion: "Versión de Ruffle", originallyMadeBy: "Esta aplicación fue creada originalmente por xevil3301.", openOriginalAuthorRepository: "Abrir el repositorio de GitHub de xevil3301" },
  fr: { about: "À propos de cette application", version: "Version", author: "Auteur", github: "Dépôt GitHub", ruffleVersion: "Version de Ruffle", originallyMadeBy: "Cette application a été créée à l’origine par xevil3301.", openOriginalAuthorRepository: "Ouvrir le dépôt GitHub de xevil3301" },
  de: { about: "Über diese App", version: "Version", author: "Autor", github: "GitHub-Repository", ruffleVersion: "Ruffle-Version", originallyMadeBy: "Diese App wurde ursprünglich von xevil3301 erstellt.", openOriginalAuthorRepository: "Das GitHub-Repository von xevil3301 öffnen" },
  "pt-BR": { about: "Sobre este aplicativo", version: "Versão", author: "Autor", github: "Repositório no GitHub", ruffleVersion: "Versão do Ruffle", originallyMadeBy: "Este aplicativo foi criado originalmente por xevil3301.", openOriginalAuthorRepository: "Abrir o repositório do GitHub de xevil3301" },
  ja: { about: "このアプリについて", version: "バージョン", author: "作者", github: "GitHubリポジトリ", ruffleVersion: "Ruffleバージョン", originallyMadeBy: "このアプリはもともとxevil3301によって作成されました。", openOriginalAuthorRepository: "xevil3301のGitHubリポジトリを開く" },
  ko: { about: "이 앱 정보", version: "버전", author: "제작자", github: "GitHub 저장소", ruffleVersion: "Ruffle 버전", originallyMadeBy: "이 앱은 원래 xevil3301이 만들었습니다.", openOriginalAuthorRepository: "xevil3301의 GitHub 저장소 열기" },
  hi: { about: "इस ऐप के बारे में", version: "संस्करण", author: "लेखक", github: "GitHub रिपॉज़िटरी", ruffleVersion: "Ruffle संस्करण", originallyMadeBy: "यह ऐप मूल रूप से xevil3301 द्वारा बनाया गया था।", openOriginalAuthorRepository: "xevil3301 की GitHub रिपॉज़िटरी खोलें" },
  ar: { about: "حول هذا التطبيق", version: "الإصدار", author: "المؤلف", github: "مستودع GitHub", ruffleVersion: "إصدار Ruffle", originallyMadeBy: "تم إنشاء هذا التطبيق في الأصل بواسطة xevil3301.", openOriginalAuthorRepository: "فتح مستودع GitHub الخاص بـ xevil3301" },
  ru: { about: "Об этом приложении", version: "Версия", author: "Автор", github: "Репозиторий GitHub", ruffleVersion: "Версия Ruffle", originallyMadeBy: "Это приложение изначально создано пользователем xevil3301.", openOriginalAuthorRepository: "Открыть репозиторий GitHub пользователя xevil3301" },
};

export const updateLabels: Record<Language, { check: string; checking: string; availableToast: string; currentToast: string; failedToast: string; title: string; currentVersion: string; changelog: string; noChangelog: string; cancel: string; ok: string; openFailed: string }> = {
  en: { check: "Check for updates", checking: "Checking for updates...", availableToast: "Flash Royale {version} is available", currentToast: "Flash Royale is up to date", failedToast: "Could not check for updates", title: "Flash Royale {version} is available", currentVersion: "Current version: {version}", changelog: "Changelog", noChangelog: "No release notes were provided.", cancel: "Cancel", ok: "OK", openFailed: "Could not open the release page" },
  zh: { check: "检查更新", checking: "正在检查更新...", availableToast: "Flash Royale {version} 已发布", currentToast: "Flash Royale 已是最新版本", failedToast: "无法检查更新", title: "Flash Royale {version} 已发布", currentVersion: "当前版本：{version}", changelog: "更新日志", noChangelog: "此版本没有发布说明。", cancel: "取消", ok: "确定", openFailed: "无法打开发布页面" },
  es: { check: "Buscar actualizaciones", checking: "Buscando actualizaciones...", availableToast: "Flash Royale {version} está disponible", currentToast: "Flash Royale está actualizado", failedToast: "No se pudieron buscar actualizaciones", title: "Flash Royale {version} está disponible", currentVersion: "Versión actual: {version}", changelog: "Cambios", noChangelog: "No se publicaron notas de esta versión.", cancel: "Cancelar", ok: "Aceptar", openFailed: "No se pudo abrir la página de la versión" },
  fr: { check: "Rechercher des mises à jour", checking: "Recherche de mises à jour...", availableToast: "Flash Royale {version} est disponible", currentToast: "Flash Royale est à jour", failedToast: "Impossible de rechercher des mises à jour", title: "Flash Royale {version} est disponible", currentVersion: "Version actuelle : {version}", changelog: "Journal des modifications", noChangelog: "Aucune note de version n’a été publiée.", cancel: "Annuler", ok: "OK", openFailed: "Impossible d’ouvrir la page de la version" },
  de: { check: "Nach Updates suchen", checking: "Suche nach Updates...", availableToast: "Flash Royale {version} ist verfügbar", currentToast: "Flash Royale ist auf dem neuesten Stand", failedToast: "Updates konnten nicht gesucht werden", title: "Flash Royale {version} ist verfügbar", currentVersion: "Aktuelle Version: {version}", changelog: "Änderungsprotokoll", noChangelog: "Für diese Version gibt es keine Versionshinweise.", cancel: "Abbrechen", ok: "OK", openFailed: "Versionsseite konnte nicht geöffnet werden" },
  "pt-BR": { check: "Verificar atualizações", checking: "Verificando atualizações...", availableToast: "Flash Royale {version} está disponível", currentToast: "Flash Royale está atualizado", failedToast: "Não foi possível verificar atualizações", title: "Flash Royale {version} está disponível", currentVersion: "Versão atual: {version}", changelog: "Novidades", noChangelog: "Não há notas para esta versão.", cancel: "Cancelar", ok: "OK", openFailed: "Não foi possível abrir a página da versão" },
  ja: { check: "更新を確認", checking: "更新を確認中...", availableToast: "Flash Royale {version} が利用できます", currentToast: "Flash Royale は最新です", failedToast: "更新を確認できませんでした", title: "Flash Royale {version} が利用できます", currentVersion: "現在のバージョン: {version}", changelog: "変更内容", noChangelog: "リリースノートはありません。", cancel: "キャンセル", ok: "OK", openFailed: "リリースページを開けませんでした" },
  ko: { check: "업데이트 확인", checking: "업데이트 확인 중...", availableToast: "Flash Royale {version}을(를) 사용할 수 있습니다", currentToast: "Flash Royale이 최신 버전입니다", failedToast: "업데이트를 확인할 수 없습니다", title: "Flash Royale {version}을(를) 사용할 수 있습니다", currentVersion: "현재 버전: {version}", changelog: "변경 사항", noChangelog: "릴리스 노트가 없습니다.", cancel: "취소", ok: "확인", openFailed: "릴리스 페이지를 열 수 없습니다" },
  hi: { check: "अपडेट जाँचें", checking: "अपडेट जाँचे जा रहे हैं...", availableToast: "Flash Royale {version} उपलब्ध है", currentToast: "Flash Royale नवीनतम है", failedToast: "अपडेट नहीं जाँचे जा सके", title: "Flash Royale {version} उपलब्ध है", currentVersion: "वर्तमान संस्करण: {version}", changelog: "बदलाव", noChangelog: "इस रिलीज़ के लिए कोई नोट उपलब्ध नहीं है।", cancel: "रद्द करें", ok: "ठीक है", openFailed: "रिलीज़ पेज नहीं खुल सका" },
  ar: { check: "التحقق من التحديثات", checking: "جارٍ التحقق من التحديثات...", availableToast: "يتوفر Flash Royale {version}", currentToast: "Flash Royale هو الإصدار الأحدث", failedToast: "تعذّر التحقق من التحديثات", title: "يتوفر Flash Royale {version}", currentVersion: "الإصدار الحالي: {version}", changelog: "سجل التغييرات", noChangelog: "لا توجد ملاحظات لهذا الإصدار.", cancel: "إلغاء", ok: "موافق", openFailed: "تعذّر فتح صفحة الإصدار" },
  ru: { check: "Проверить обновления", checking: "Проверка обновлений...", availableToast: "Доступна Flash Royale {version}", currentToast: "Flash Royale обновлена до последней версии", failedToast: "Не удалось проверить обновления", title: "Доступна Flash Royale {version}", currentVersion: "Текущая версия: {version}", changelog: "Список изменений", noChangelog: "Для этой версии нет примечаний.", cancel: "Отмена", ok: "ОК", openFailed: "Не удалось открыть страницу релиза" },
};

export const updateActionLabels: Record<Language, string> = {
  en: "Update",
  zh: "更新",
  es: "Actualizar",
  fr: "Mettre à jour",
  de: "Aktualisieren",
  "pt-BR": "Atualizar",
  ja: "更新",
  ko: "업데이트",
  hi: "अपडेट करें",
  ar: "تحديث",
  ru: "Обновить",
};

export const generalSettingsLabels: Record<Language, { general: string; startInFullscreen: string; minimizeToTrayOnGameLaunch: string; minimizeToTrayOnMinimize: string; nextLaunch: string }> = {
  en: { general: "General", startInFullscreen: "Start app in fullscreen", minimizeToTrayOnGameLaunch: "Minimize to notification area on game launch", minimizeToTrayOnMinimize: "Minimize main window to notification area", nextLaunch: "Fullscreen takes effect the next time the app starts." },
  zh: { general: "常规", startInFullscreen: "启动时全屏", minimizeToTrayOnGameLaunch: "启动游戏时最小化到通知区域", minimizeToTrayOnMinimize: "将主窗口最小化到通知区域", nextLaunch: "全屏设置将在下次启动应用时生效。" },
  es: { general: "General", startInFullscreen: "Iniciar la aplicación en pantalla completa", minimizeToTrayOnGameLaunch: "Minimizar al área de notificación al iniciar un juego", minimizeToTrayOnMinimize: "Minimizar la ventana principal al área de notificación", nextLaunch: "La pantalla completa se aplicará la próxima vez que se inicie la aplicación." },
  fr: { general: "Général", startInFullscreen: "Démarrer l’application en plein écran", minimizeToTrayOnGameLaunch: "Réduire dans la zone de notification au lancement d’un jeu", minimizeToTrayOnMinimize: "Réduire la fenêtre principale dans la zone de notification", nextLaunch: "Le plein écran s’appliquera au prochain lancement de l’application." },
  de: { general: "Allgemein", startInFullscreen: "App im Vollbild starten", minimizeToTrayOnGameLaunch: "Beim Spielstart in den Infobereich minimieren", minimizeToTrayOnMinimize: "Hauptfenster in den Infobereich minimieren", nextLaunch: "Die Vollbild-Einstellung gilt ab dem nächsten App-Start." },
  "pt-BR": { general: "Geral", startInFullscreen: "Iniciar o app em tela cheia", minimizeToTrayOnGameLaunch: "Minimizar para a área de notificação ao iniciar um jogo", minimizeToTrayOnMinimize: "Minimizar a janela principal para a área de notificação", nextLaunch: "A tela cheia será aplicada na próxima inicialização do app." },
  ja: { general: "一般", startInFullscreen: "アプリを全画面で開始", minimizeToTrayOnGameLaunch: "ゲーム起動時に通知領域へ最小化", minimizeToTrayOnMinimize: "メインウィンドウを通知領域へ最小化", nextLaunch: "全画面設定は次回の起動時に適用されます。" },
  ko: { general: "일반", startInFullscreen: "앱을 전체 화면으로 시작", minimizeToTrayOnGameLaunch: "게임 실행 시 알림 영역으로 최소화", minimizeToTrayOnMinimize: "메인 창을 알림 영역으로 최소화", nextLaunch: "전체 화면 설정은 다음 앱 실행 시 적용됩니다." },
  hi: { general: "सामान्य", startInFullscreen: "ऐप को पूर्ण स्क्रीन में शुरू करें", minimizeToTrayOnGameLaunch: "गेम शुरू होने पर सूचना क्षेत्र में छोटा करें", minimizeToTrayOnMinimize: "मुख्य विंडो को सूचना क्षेत्र में छोटा करें", nextLaunch: "पूर्ण स्क्रीन सेटिंग अगली बार ऐप शुरू होने पर लागू होगी।" },
  ar: { general: "عام", startInFullscreen: "بدء التطبيق بملء الشاشة", minimizeToTrayOnGameLaunch: "تصغير إلى منطقة الإعلام عند تشغيل لعبة", minimizeToTrayOnMinimize: "تصغير النافذة الرئيسية إلى منطقة الإعلام", nextLaunch: "سيتم تطبيق إعداد ملء الشاشة عند تشغيل التطبيق في المرة القادمة." },
  ru: { general: "Общие", startInFullscreen: "Запускать приложение в полноэкранном режиме", minimizeToTrayOnGameLaunch: "Сворачивать в область уведомлений при запуске игры", minimizeToTrayOnMinimize: "Сворачивать главное окно в область уведомлений", nextLaunch: "Полноэкранный режим будет включён при следующем запуске приложения." },
};

export const exploreSettingsLabels: Record<Language, { enable: string; disabled: string; offline: string; checking: string; open: string }> = {
  en: { enable: "Enable Explore (requires internet)", disabled: "Explore is disabled in settings", offline: "Explore unavailable: no internet connection to Silvergames", checking: "Checking Silvergames connection", open: "Explore Flash games" },
  zh: { enable: "启用探索（需要网络）", disabled: "探索已在设置中关闭", offline: "无法连接 Silvergames，请检查网络", checking: "正在检查 Silvergames 连接", open: "探索 Flash 游戏" },
  es: { enable: "Activar Explorar (requiere internet)", disabled: "Explorar está desactivado en ajustes", offline: "No hay conexión a Silvergames", checking: "Comprobando la conexión a Silvergames", open: "Explorar juegos Flash" },
  fr: { enable: "Activer Explorer (internet requis)", disabled: "Explorer est désactivé dans les paramètres", offline: "Impossible de se connecter à Silvergames", checking: "Vérification de la connexion à Silvergames", open: "Explorer les jeux Flash" },
  de: { enable: "Explore aktivieren (Internet erforderlich)", disabled: "Explore ist in den Einstellungen deaktiviert", offline: "Keine Verbindung zu Silvergames", checking: "Verbindung zu Silvergames wird geprüft", open: "Flash-Spiele entdecken" },
  "pt-BR": { enable: "Ativar Explorar (requer internet)", disabled: "Explorar está desativado nas configurações", offline: "Sem conexão com Silvergames", checking: "Verificando conexão com Silvergames", open: "Explorar jogos Flash" },
  ja: { enable: "探索を有効にする（インターネットが必要）", disabled: "設定で探索が無効です", offline: "Silvergames に接続できません", checking: "Silvergames への接続を確認中", open: "Flash ゲームを探す" },
  ko: { enable: "탐색 사용 (인터넷 필요)", disabled: "설정에서 탐색이 꺼져 있습니다", offline: "Silvergames에 연결할 수 없습니다", checking: "Silvergames 연결 확인 중", open: "Flash 게임 탐색" },
  hi: { enable: "एक्सप्लोर चालू करें (इंटरनेट आवश्यक)", disabled: "सेटिंग्स में एक्सप्लोर बंद है", offline: "Silvergames से कनेक्शन नहीं है", checking: "Silvergames कनेक्शन जाँच रहे हैं", open: "Flash गेम खोजें" },
  ar: { enable: "تفعيل الاستكشاف (يتطلب الإنترنت)", disabled: "الاستكشاف معطل في الإعدادات", offline: "لا يوجد اتصال بـ Silvergames", checking: "جارٍ التحقق من الاتصال بـ Silvergames", open: "استكشاف ألعاب Flash" },
  ru: { enable: "Включить поиск игр (нужен интернет)", disabled: "Поиск игр отключён в настройках", offline: "Нет соединения с Silvergames", checking: "Проверка соединения с Silvergames", open: "Поиск Flash-игр" },
};

export const sourceMetadataLabels: Record<Language, { description: string; rating: string; votes: string; ageRating: string; version: string; openGameFolder: string }> = {
  en: { description: "Description", rating: "Silvergames rating", votes: "votes", ageRating: "Age rating", version: "Version", openGameFolder: "Open the game folder for {title}" },
  zh: { description: "描述", rating: "Silvergames 评分", votes: "票", ageRating: "适龄", version: "版本", openGameFolder: "打开「{title}」的游戏文件夹" },
  es: { description: "Descripción", rating: "Valoración en Silvergames", votes: "votos", ageRating: "Edad recomendada", version: "Versión", openGameFolder: "Abrir la carpeta del juego {title}" },
  fr: { description: "Description", rating: "Note Silvergames", votes: "votes", ageRating: "Âge recommandé", version: "Version", openGameFolder: "Ouvrir le dossier du jeu {title}" },
  de: { description: "Beschreibung", rating: "Silvergames-Bewertung", votes: "Stimmen", ageRating: "Altersempfehlung", version: "Version", openGameFolder: "Den Spielordner von {title} öffnen" },
  "pt-BR": { description: "Descrição", rating: "Avaliação no Silvergames", votes: "votos", ageRating: "Faixa etária", version: "Versão", openGameFolder: "Abrir a pasta do jogo {title}" },
  ja: { description: "説明", rating: "Silvergames 評価", votes: "票", ageRating: "対象年齢", version: "バージョン", openGameFolder: "「{title}」のゲームフォルダーを開く" },
  ko: { description: "설명", rating: "Silvergames 평점", votes: "표", ageRating: "권장 연령", version: "버전", openGameFolder: "{title} 게임 폴더 열기" },
  hi: { description: "विवरण", rating: "Silvergames रेटिंग", votes: "वोट", ageRating: "आयु रेटिंग", version: "संस्करण", openGameFolder: "{title} का गेम फ़ोल्डर खोलें" },
  ar: { description: "الوصف", rating: "تقييم Silvergames", votes: "أصوات", ageRating: "التصنيف العمري", version: "الإصدار", openGameFolder: "فتح مجلد اللعبة {title}" },
  ru: { description: "Описание", rating: "Рейтинг Silvergames", votes: "голосов", ageRating: "Возрастной рейтинг", version: "Версия", openGameFolder: "Открыть папку игры «{title}»" },
};

export const exploreCoverLabels: Record<Language, string> = {
  en: "Imported from catalog",
  zh: "从游戏目录导入",
  es: "Importada del catálogo",
  fr: "Importée depuis le catalogue",
  de: "Aus dem Katalog importiert",
  "pt-BR": "Importada do catálogo",
  ja: "カタログからインポート",
  ko: "카탈로그에서 가져옴",
  hi: "कैटलॉग से आयातित",
  ar: "مستوردة من الكتالوج",
  ru: "Импортирована из каталога",
};

export const userRatingLabels: Record<Language, { title: string; clear: string }> = {
  en: { title: "Your rating", clear: "Clear rating" },
  zh: { title: "我的评分", clear: "清除评分" },
  es: { title: "Tu valoración", clear: "Borrar valoración" },
  fr: { title: "Votre note", clear: "Effacer la note" },
  de: { title: "Deine Bewertung", clear: "Bewertung löschen" },
  "pt-BR": { title: "Sua avaliação", clear: "Limpar avaliação" },
  ja: { title: "自分の評価", clear: "評価を消去" },
  ko: { title: "내 평점", clear: "평점 지우기" },
  hi: { title: "आपकी रेटिंग", clear: "रेटिंग हटाएँ" },
  ar: { title: "تقييمك", clear: "مسح التقييم" },
  ru: { title: "Ваша оценка", clear: "Сбросить оценку" },
};

export const compatibilitySettingsLabels: Record<Language, { standalone: string; fixScaling: string; online: string; resources: string; reopen: string; invalidResource: string; blockResource: string; unblockResource: string; copyResource: string; resourceCopied: string; noResources: string }> = {
  en: { standalone: "Standalone compatibility", fixScaling: "Fix scaling / zoom", online: "Allow online features", resources: "Discovered public resources", reopen: "Reopen this game's player to apply this setting", invalidResource: "Only public HTTP or HTTPS resources without credentials or query strings can be relayed.", blockResource: "Block", unblockResource: "Unblock", copyResource: "Copy link", resourceCopied: "Copied to clipboard", noResources: "Resources appear here as the game loads them." },
  zh: { standalone: "独立播放器兼容模式", fixScaling: "修复缩放比例", online: "允许在线功能", resources: "自动发现的公开资源", reopen: "重新打开此游戏的播放器以应用此设置", invalidResource: "仅可中继不含凭据或查询参数的公开 HTTP 或 HTTPS 资源。", blockResource: "屏蔽", unblockResource: "取消屏蔽", copyResource: "复制链接", resourceCopied: "已复制到剪贴板", noResources: "游戏加载资源后，资源会显示在这里。" },
  es: { standalone: "Compatibilidad con reproductor independiente", fixScaling: "Corregir escala / zoom", online: "Permitir funciones en línea", resources: "Recursos públicos detectados", reopen: "Vuelve a abrir el reproductor de este juego para aplicar este ajuste", invalidResource: "Solo se pueden retransmitir recursos HTTP o HTTPS públicos sin credenciales ni parámetros de consulta.", blockResource: "Bloquear", unblockResource: "Permitir", copyResource: "Copiar enlace", resourceCopied: "Copiado al portapapeles", noResources: "Los recursos aparecerán aquí cuando el juego los cargue." },
  fr: { standalone: "Compatibilité avec le lecteur autonome", fixScaling: "Corriger l’échelle / le zoom", online: "Autoriser les fonctions en ligne", resources: "Ressources publiques détectées", reopen: "Rouvrez le lecteur de ce jeu pour appliquer ce paramètre", invalidResource: "Seules les ressources HTTP ou HTTPS publiques sans identifiants ni paramètres peuvent être relayées.", blockResource: "Bloquer", unblockResource: "Débloquer", copyResource: "Copier le lien", resourceCopied: "Copié dans le presse-papiers", noResources: "Les ressources apparaîtront ici lorsque le jeu les chargera." },
  de: { standalone: "Kompatibilität mit eigenständigem Player", fixScaling: "Skalierung / Zoom korrigieren", online: "Online-Funktionen erlauben", resources: "Erkannte öffentliche Ressourcen", reopen: "Den Player dieses Spiels erneut öffnen, um diese Einstellung anzuwenden", invalidResource: "Nur öffentliche HTTP- oder HTTPS-Ressourcen ohne Zugangsdaten oder Abfrageparameter können weitergeleitet werden.", blockResource: "Blockieren", unblockResource: "Freigeben", copyResource: "Link kopieren", resourceCopied: "In die Zwischenablage kopiert", noResources: "Ressourcen werden hier angezeigt, sobald das Spiel sie lädt." },
  "pt-BR": { standalone: "Compatibilidade com player independente", fixScaling: "Corrigir escala / zoom", online: "Permitir funções online", resources: "Recursos públicos detectados", reopen: "Reabra o player deste jogo para aplicar esta configuração", invalidResource: "Somente recursos HTTP ou HTTPS públicos sem credenciais ou parâmetros podem ser retransmitidos.", blockResource: "Bloquear", unblockResource: "Desbloquear", copyResource: "Copiar link", resourceCopied: "Copiado para a área de transferência", noResources: "Os recursos aparecerão aqui quando o jogo carregá-los." },
  ja: { standalone: "単体プレイヤー互換モード", fixScaling: "拡大縮小を補正", online: "オンライン機能を許可", resources: "検出された公開リソース", reopen: "この設定を適用するには、このゲームのプレイヤーを開き直してください", invalidResource: "認証情報やクエリパラメーターのない公開 HTTP/HTTPS リソースのみ中継できます。", blockResource: "ブロック", unblockResource: "許可", copyResource: "リンクをコピー", resourceCopied: "クリップボードにコピーしました", noResources: "ゲームがリソースを読み込むと、ここに表示されます。" },
  ko: { standalone: "독립 플레이어 호환 모드", fixScaling: "배율 / 확대 보정", online: "온라인 기능 허용", resources: "검색된 공개 리소스", reopen: "이 설정을 적용하려면 이 게임의 플레이어를 다시 여세요", invalidResource: "인증 정보나 쿼리 문자열이 없는 공개 HTTP 또는 HTTPS 리소스만 중계할 수 있습니다.", blockResource: "차단", unblockResource: "허용", copyResource: "링크 복사", resourceCopied: "클립보드에 복사됨", noResources: "게임이 리소스를 불러오면 여기에 표시됩니다." },
  hi: { standalone: "स्वतंत्र प्लेयर संगतता", fixScaling: "स्केलिंग / ज़ूम ठीक करें", online: "ऑनलाइन सुविधाएँ अनुमति दें", resources: "पहचाने गए सार्वजनिक संसाधन", reopen: "यह सेटिंग लागू करने के लिए इस गेम का प्लेयर फिर खोलें", invalidResource: "केवल बिना प्रमाण-पत्र या क्वेरी वाले सार्वजनिक HTTP या HTTPS संसाधन रिले किए जा सकते हैं।", blockResource: "ब्लॉक करें", unblockResource: "अनब्लॉक करें", copyResource: "लिंक कॉपी करें", resourceCopied: "क्लिपबोर्ड पर कॉपी किया गया", noResources: "गेम द्वारा संसाधन लोड करने पर वे यहाँ दिखेंगे।" },
  ar: { standalone: "توافق المشغل المستقل", fixScaling: "إصلاح التحجيم / التكبير", online: "السماح بالميزات عبر الإنترنت", resources: "الموارد العامة المكتشفة", reopen: "أعد فتح مشغل هذه اللعبة لتطبيق هذا الإعداد", invalidResource: "يمكن ترحيل موارد HTTP أو HTTPS العامة فقط دون بيانات اعتماد أو معاملات استعلام.", blockResource: "حظر", unblockResource: "إلغاء الحظر", copyResource: "نسخ الرابط", resourceCopied: "تم النسخ إلى الحافظة", noResources: "ستظهر الموارد هنا عند تحميلها بواسطة اللعبة." },
  ru: { standalone: "Совместимость с автономным плеером", fixScaling: "Исправить масштабирование / масштаб", online: "Разрешить онлайн-функции", resources: "Обнаруженные общедоступные ресурсы", reopen: "Откройте плеер этой игры заново, чтобы применить эту настройку", invalidResource: "Можно передавать только общедоступные HTTP- или HTTPS-ресурсы без учётных данных и параметров запроса.", blockResource: "Заблокировать", unblockResource: "Разблокировать", copyResource: "Копировать ссылку", resourceCopied: "Скопировано в буфер обмена", noResources: "Ресурсы появятся здесь, когда игра их загрузит." },
};

export const confirmationActionLabels: Record<Language, { cancel: string; delete: string; deleteFiles: string; keepFiles: string }> = {
  en: { cancel: "Cancel", delete: "Delete", deleteFiles: "Delete files", keepFiles: "Keep files" },
  zh: { cancel: "取消", delete: "删除", deleteFiles: "删除文件", keepFiles: "保留文件" },
  es: { cancel: "Cancelar", delete: "Eliminar", deleteFiles: "Eliminar archivos", keepFiles: "Conservar archivos" },
  fr: { cancel: "Annuler", delete: "Supprimer", deleteFiles: "Supprimer les fichiers", keepFiles: "Garder les fichiers" },
  de: { cancel: "Abbrechen", delete: "Löschen", deleteFiles: "Dateien löschen", keepFiles: "Dateien behalten" },
  "pt-BR": { cancel: "Cancelar", delete: "Excluir", deleteFiles: "Excluir arquivos", keepFiles: "Manter arquivos" },
  ja: { cancel: "キャンセル", delete: "削除", deleteFiles: "ファイルを削除", keepFiles: "ファイルを残す" },
  ko: { cancel: "취소", delete: "삭제", deleteFiles: "파일 삭제", keepFiles: "파일 유지" },
  hi: { cancel: "रद्द करें", delete: "हटाएँ", deleteFiles: "फ़ाइलें हटाएँ", keepFiles: "फ़ाइलें रखें" },
  ar: { cancel: "إلغاء", delete: "حذف", deleteFiles: "حذف الملفات", keepFiles: "الاحتفاظ بالملفات" },
  ru: { cancel: "Отмена", delete: "Удалить", deleteFiles: "Удалить файлы", keepFiles: "Сохранить файлы" },
};

export const renameActionLabels: Record<Language, string> = {
  en: "Rename",
  zh: "重命名",
  es: "Renombrar",
  fr: "Renommer",
  de: "Umbenennen",
  "pt-BR": "Renomear",
  ja: "名前を変更",
  ko: "이름 변경",
  hi: "नाम बदलें",
  ar: "إعادة تسمية",
  ru: "Переименовать",
};

export const cardSizeLabels: Record<Language, string> = {
  en: "Card size", zh: "卡片大小", es: "Tamaño de las tarjetas", fr: "Taille des cartes", de: "Kartengröße",
  "pt-BR": "Tamanho dos cartões", ja: "カードサイズ", ko: "카드 크기", hi: "कार्ड का आकार", ar: "حجم البطاقة", ru: "Размер карточек",
};

export const cardSizeToggleLabels: Record<Language, { show: string; hide: string }> = {
  en: { show: "Show card size", hide: "Hide card size" },
  zh: { show: "显示卡片大小", hide: "隐藏卡片大小" },
  es: { show: "Mostrar tamaño de las tarjetas", hide: "Ocultar tamaño de las tarjetas" },
  fr: { show: "Afficher la taille des cartes", hide: "Masquer la taille des cartes" },
  de: { show: "Kartengröße anzeigen", hide: "Kartengröße ausblenden" },
  "pt-BR": { show: "Mostrar tamanho dos cartões", hide: "Ocultar tamanho dos cartões" },
  ja: { show: "カードサイズを表示", hide: "カードサイズを非表示" },
  ko: { show: "카드 크기 표시", hide: "카드 크기 숨기기" },
  hi: { show: "कार्ड का आकार दिखाएँ", hide: "कार्ड का आकार छिपाएँ" },
  ar: { show: "إظهار حجم البطاقة", hide: "إخفاء حجم البطاقة" },
  ru: { show: "Показать размер карточек", hide: "Скрыть размер карточек" },
};

export const sortLabels: Record<Language, { sort: string; dateAdded: string; name: string; lastPlayed: string; mostPlayed: string; ascending: string; descending: string }> = {
  en: { sort: "Sort games", dateAdded: "Date added", name: "Name (A–Z)", lastPlayed: "Last played", mostPlayed: "Most played", ascending: "Ascending", descending: "Descending" },
  zh: { sort: "游戏排序", dateAdded: "添加日期", name: "名称 (A–Z)", lastPlayed: "最近游玩", mostPlayed: "累计游玩时间最多", ascending: "升序", descending: "降序" },
  es: { sort: "Ordenar juegos", dateAdded: "Fecha de adición", name: "Nombre (A–Z)", lastPlayed: "Jugados recientemente", mostPlayed: "Más tiempo jugado", ascending: "Ascendente", descending: "Descendente" },
  fr: { sort: "Trier les jeux", dateAdded: "Date d’ajout", name: "Nom (A–Z)", lastPlayed: "Joués récemment", mostPlayed: "Temps de jeu le plus élevé", ascending: "Croissant", descending: "Décroissant" },
  de: { sort: "Spiele sortieren", dateAdded: "Hinzugefügt am", name: "Name (A–Z)", lastPlayed: "Zuletzt gespielt", mostPlayed: "Meiste Spielzeit", ascending: "Aufsteigend", descending: "Absteigend" },
  "pt-BR": { sort: "Ordenar jogos", dateAdded: "Data de adição", name: "Nome (A–Z)", lastPlayed: "Jogados recentemente", mostPlayed: "Mais tempo jogado", ascending: "Crescente", descending: "Decrescente" },
  ja: { sort: "ゲームを並べ替え", dateAdded: "追加日", name: "名前 (A–Z)", lastPlayed: "最近プレイした順", mostPlayed: "プレイ時間が長い順", ascending: "昇順", descending: "降順" },
  ko: { sort: "게임 정렬", dateAdded: "추가한 날짜", name: "이름 (A–Z)", lastPlayed: "최근 플레이", mostPlayed: "플레이 시간이 긴 순", ascending: "오름차순", descending: "내림차순" },
  hi: { sort: "गेम क्रमबद्ध करें", dateAdded: "जोड़ने की तारीख", name: "नाम (A–Z)", lastPlayed: "हाल ही में खेले गए", mostPlayed: "सबसे अधिक खेले गए", ascending: "आरोही", descending: "अवरोही" },
  ar: { sort: "ترتيب الألعاب", dateAdded: "تاريخ الإضافة", name: "الاسم (أ–ي)", lastPlayed: "آخر ما تم لعبه", mostPlayed: "الأكثر وقتًا في اللعب", ascending: "تصاعدي", descending: "تنازلي" },
  ru: { sort: "Сортировка игр", dateAdded: "Дата добавления", name: "Название (А–Я)", lastPlayed: "Недавно запущенные", mostPlayed: "Больше всего времени в игре", ascending: "По возрастанию", descending: "По убыванию" },
};

export type TranslationKey = keyof typeof messages.zh;

export function readLanguage(): Language {
  try {
    const storedLanguage = localStorage.getItem("flashmanager.language");
    return storedLanguage && storedLanguage in messages ? (storedLanguage as Language) : "en";
  } catch {
    return "en";
  }
}

export function translateError(message: string, language: Language, fallback: string) {
  const errorKeys: Record<string, TranslationKey> = {
    "找不到游戏": "gameNotFound",
    "只接受 PNG、JPG、WEBP data URL": "dataUrlInvalid",
    "封面图片数据太小，已保留原封面": "coverDataTooSmall",
    "仅支持 PNG、JPG、WEBP 封面": "coverTypeUnsupported",
    "封面图片无效，已保留原封面": "coverImageInvalid",
  };
  if (!(message in errorKeys)) return message || fallback;
  const key = errorKeys[message];
  return messages[language][key];
}
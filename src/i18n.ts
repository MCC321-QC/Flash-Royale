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
    notPlayed: "尚未玩过",
    ruffleLoadFailed: "无法加载 Ruffle",
    ruffleMissing: "缺少 Ruffle 资源。请先运行 npm.cmd install。",
    coverCaptured: "已截图",
    coverCustom: "自定义",
    coverFallback: "占位图",
    coverTooSmall: "渲染的图像太小，已保留原封面。",
    coverNotRendered: "游戏尚未渲染，已保留原封面。",
    canvasUnavailable: "无法创建封面画布。",
    coverDataInvalid: "截图数据无效，已保留原封面。",
    coverAlt: "封面",
    localLibrary: "掌控你的 Flash 游戏",
    allGames: "所有游戏",
    favorites: "收藏夹",
    categories: "分类",
    tags: "标签",
    renameCategory: "重命名分类",
    renameTag: "重命名标签",
    deleteTag: "删除标签",
    selectedFavorite: "收藏",
    emptySelected: "未选择游戏",
    emptySelectedHint: "导入并选择一个游戏，即可在此管理它。",
    run: "开始游戏",
    chooseCover: "选择本地图片作为封面",
    delete: "删除",
    title: "标题",
    category: "分类",
    releaseDate: "发行日期",
    developer: "开发者",
    publisher: "发行商",
    release: "发行",
    uncategorized: "未分类",
    chooseRecentCategory: "选择最近使用的分类",
    tagsPlaceholder: "动作、解谜、童年",
    notes: "备注",
    saveChanges: "保存更改",
    file: "文件",
    plays: "游玩次数",
    times: "次",
    lastPlayed: "上次游玩",
    cover: "封面",
    readyToLoad: "准备加载",
    loadingRuffle: "正在加载 Ruffle",
    loadingGame: "正在加载游戏",
    running: "运行中",
    gameLoadFailed: "无法加载游戏",
    close: "关闭",
    settings: "设置",
    language: "语言",
    settingsDescription: "选择 Flash Royale 的显示语言。",
    english: "英语",
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
    clearSearch: "清除搜索",
    importSwf: "导入 SWF",
    currentResults: "结果",
    gamesInLibrary: "库中游戏",
    libraryDirectory: "游戏库",
    initializing: "正在初始化",
    emptyLibrary: "这里还没有游戏",
    emptyLibraryHint: "选择“导入 SWF”，或将文件拖入窗口。",
    dropHint: "松开以导入 SWF",
    importSummary: "已导入 {imported} 个，跳过 {skipped} 个",
    importFailed: "导入失败",
    saved: "更改已保存",
    saveFailed: "无法保存更改",
    deleteConfirm: "删除“{title}”？\n\n这将移除游戏库记录，并询问是否删除其文件。",
    deleteFilesConfirm: "是否也从游戏库文件夹删除 SWF 和封面文件？",
    deleted: "游戏已删除",
    deleteFailed: "无法删除游戏",
    playRecordFailed: "无法更新游玩记录，仍将尝试运行游戏。",
    newTagName: "新标签名称",
    tagRenamed: "标签已重命名",
    removeTagConfirm: "从所有游戏中移除标签“{tag}”？",
    tagRemoved: "标签已移除",
    newCategoryName: "新分类名称",
    categoryRenamed: "分类已重命名",
    noDropPath: "Electron 未提供拖入文件的路径，请改用导入按钮。",
    dragImportFailed: "无法导入拖入的文件",
    automaticCoverCreated: "已生成自动封面",
    customCoverUpdated: "自定义封面已更新",
    originalCoverKept: "已保留原封面",
    chooseCoverFailed: "无法选择封面",
    gameNotFound: "找不到该游戏",
    dataUrlInvalid: "仅接受 PNG、JPG 和 WEBP 的 data URL。",
    coverDataTooSmall: "封面图像数据太小，已保留原封面。",
    coverTypeUnsupported: "仅支持 PNG、JPG 和 WEBP 格式的封面。",
    coverImageInvalid: "封面图像无效，已保留原封面。",
    notSwf: "不是 SWF 文件",
    alreadyInLibrary: "已在游戏库中",
    electronOnlyEdit: "仅可在 Electron 应用中编辑游戏。",
    electronOnlyPlay: "仅可在 Electron 应用中运行游戏。",
    electronOnlySaveCover: "仅可在 Electron 应用中保存封面。",
    electronOnlyChooseCover: "仅可在 Electron 应用中选择封面。",
  },
  en: {
    never: "Never",
    notPlayed: "Not Played",
    ruffleLoadFailed: "Ruffle failed to load",
    ruffleMissing: "Ruffle assets are missing. Run npm.cmd install first.",
    coverCaptured: "Captured",
    coverCustom: "Custom",
    coverFallback: "Placeholder",
    coverTooSmall: "The rendered image is too small, the original cover was kept.",
    coverNotRendered: "The game has not rendered yet, the original cover was kept.",
    canvasUnavailable: "Could not create a cover canvas.",
    coverDataInvalid: "Screenshot data is invalid, the original cover was kept.",
    coverAlt: "cover",
    localLibrary: "Dominate your flash games",
    allGames: "All games",
    favorites: "Favorites",
    categories: "Categories",
    tags: "Tags",
    renameCategory: "Rename category",
    renameTag: "Rename tag",
    deleteTag: "Delete tag",
    selectedFavorite: "Favorite",
    emptySelected: "No game selected",
    emptySelectedHint: "Import and select a game to manage it here.",
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
    coverDataTooSmall: "Cover image data is too small, the original cover was kept.",
    coverTypeUnsupported: "Only PNG, JPG, and WEBP covers are supported.",
    coverImageInvalid: "Cover image is invalid, the original cover was kept.",
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
  de: "Automatisch aufgenommen",
  "pt-BR": "Capturada automaticamente",
  ja: "自動キャプチャ済み",
  ko: "자동으로 캡처됨",
  hi: "अपने आप कैप्चर किया गया",
  ar: "تم الالتقاط تلقائيًا",
  ru: "Снято автоматически",
};

export const messages = Object.fromEntries(
  Object.entries({ ...baseMessages, ...majorMessages }).map(([language, locale]) => [
    language,
    { ...locale, coverCaptured: automaticCoverCapturedLabels[language as Language] },
  ]),
) as Record<Language, LocaleMessages>;

export const importCountLabels: Record<Language, { imported: string; skipped: string }> = {
  en: { imported: "Imported:", skipped: "Skipped:" },
  zh: { imported: "已导入：", skipped: "已跳过：" },
  es: { imported: "Importados:", skipped: "Omitidos:" },
  fr: { imported: "Importés :", skipped: "Ignorés :" },
  de: { imported: "Importiert:", skipped: "Übersprungen:" },
  "pt-BR": { imported: "Importados:", skipped: "Ignorados:" },
  ja: { imported: "インポート済み：", skipped: "スキップ：" },
  ko: { imported: "가져옴:", skipped: "건너뜀:" },
  hi: { imported: "आयात किए:", skipped: "छोड़े गए:" },
  ar: { imported: "تم الاستيراد:", skipped: "تم التخطي:" },
  ru: { imported: "Импортировано:", skipped: "Пропущено:" },
};

export const playerControlLabels: Record<Language, {
  playerControls: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  fullscreen: string;
  exitFullscreen: string;
  showOptionsBar: string;
  hideOptionsBar: string;
  pinControls: string;
  unpinControls: string;
  reloadGame: string;
}> = {
  en: { reloadGame: "Reload game", playerControls: "Player controls", zoomIn: "Zoom in", zoomOut: "Zoom out", resetZoom: "Reset zoom", fullscreen: "Enter fullscreen", exitFullscreen: "Exit fullscreen", showOptionsBar: "Show player options", hideOptionsBar: "Hide player options", pinControls: "Keep controls visible", unpinControls: "Unpin controls" },
  zh: { reloadGame: "重新加载游戏", playerControls: "播放器控制", zoomIn: "放大", zoomOut: "缩小", resetZoom: "重置缩放", fullscreen: "进入全屏", exitFullscreen: "退出全屏", showOptionsBar: "显示播放器选项", hideOptionsBar: "隐藏播放器选项", pinControls: "保持控制栏可见", unpinControls: "取消固定控制栏" },
  es: { reloadGame: "Volver a cargar el juego", playerControls: "Controles del reproductor", zoomIn: "Acercar", zoomOut: "Alejar", resetZoom: "Restablecer el zoom", fullscreen: "Activar pantalla completa", exitFullscreen: "Salir de pantalla completa", showOptionsBar: "Mostrar opciones del reproductor", hideOptionsBar: "Ocultar opciones del reproductor", pinControls: "Mantener visibles los controles", unpinControls: "Desanclar los controles" },
  fr: { reloadGame: "Recharger le jeu", playerControls: "Commandes du lecteur", zoomIn: "Zoom avant", zoomOut: "Zoom arrière", resetZoom: "Réinitialiser le zoom", fullscreen: "Passer en plein écran", exitFullscreen: "Quitter le plein écran", showOptionsBar: "Afficher les options du lecteur", hideOptionsBar: "Masquer les options du lecteur", pinControls: "Garder les commandes affichées", unpinControls: "Ne plus épingler les commandes" },
  de: { reloadGame: "Spiel erneut laden", playerControls: "Player-Steuerung", zoomIn: "Vergrößern", zoomOut: "Verkleinern", resetZoom: "Zoom zurücksetzen", fullscreen: "Vollbild einschalten", exitFullscreen: "Vollbild verlassen", showOptionsBar: "Player-Optionen anzeigen", hideOptionsBar: "Player-Optionen ausblenden", pinControls: "Steuerung sichtbar lassen", unpinControls: "Steuerung lösen" },
  "pt-BR": { reloadGame: "Recarregar jogo", playerControls: "Controles do player", zoomIn: "Ampliar", zoomOut: "Reduzir", resetZoom: "Redefinir zoom", fullscreen: "Entrar em tela cheia", exitFullscreen: "Sair da tela cheia", showOptionsBar: "Mostrar opções do player", hideOptionsBar: "Ocultar opções do player", pinControls: "Manter controles visíveis", unpinControls: "Desafixar controles" },
  ja: { reloadGame: "ゲームを再読み込み", playerControls: "プレイヤーの操作", zoomIn: "拡大", zoomOut: "縮小", resetZoom: "ズームをリセット", fullscreen: "全画面表示にする", exitFullscreen: "全画面表示を終了", showOptionsBar: "プレイヤーのオプションを表示", hideOptionsBar: "プレイヤーのオプションを隠す", pinControls: "操作バーを常に表示", unpinControls: "操作バーの固定を解除" },
  ko: { reloadGame: "게임 다시 불러오기", playerControls: "플레이어 조작", zoomIn: "확대", zoomOut: "축소", resetZoom: "확대/축소 초기화", fullscreen: "전체 화면으로 전환", exitFullscreen: "전체 화면 종료", showOptionsBar: "플레이어 옵션 표시", hideOptionsBar: "플레이어 옵션 숨기기", pinControls: "조작 표시줄을 계속 표시", unpinControls: "조작 표시줄 고정 해제" },
  hi: { reloadGame: "गेम फिर से लोड करें", playerControls: "प्लेयर नियंत्रण", zoomIn: "ज़ूम बढ़ाएँ", zoomOut: "ज़ूम घटाएँ", resetZoom: "ज़ूम रीसेट करें", fullscreen: "फ़ुलस्क्रीन में जाएँ", exitFullscreen: "फ़ुलस्क्रीन से बाहर आएँ", showOptionsBar: "प्लेयर विकल्प दिखाएँ", hideOptionsBar: "प्लेयर विकल्प छिपाएँ", pinControls: "नियंत्रण दिखाई देते रहें", unpinControls: "नियंत्रण अनपिन करें" },
  ar: { reloadGame: "إعادة تحميل اللعبة", playerControls: "عناصر تحكم المشغّل", zoomIn: "تكبير", zoomOut: "تصغير", resetZoom: "إعادة ضبط التكبير", fullscreen: "الدخول إلى وضع ملء الشاشة", exitFullscreen: "الخروج من وضع ملء الشاشة", showOptionsBar: "إظهار خيارات المشغّل", hideOptionsBar: "إخفاء خيارات المشغّل", pinControls: "إبقاء عناصر التحكم ظاهرة", unpinControls: "إلغاء تثبيت عناصر التحكم" },
  ru: { reloadGame: "Перезагрузить игру", playerControls: "Управление проигрывателем", zoomIn: "Приблизить", zoomOut: "Отдалить", resetZoom: "Сбросить масштаб", fullscreen: "Включить полный экран", exitFullscreen: "Выйти из полного экрана", showOptionsBar: "Показать параметры проигрывателя", hideOptionsBar: "Скрыть параметры проигрывателя", pinControls: "Всегда показывать элементы управления", unpinControls: "Открепить элементы управления" },
};

export const gameSettingsLabels: Record<Language, { fullscreenByDefault: string; repeatMusic: string; repeatMusicHelp: string }> = {
  en: { fullscreenByDefault: "Start in fullscreen", repeatMusic: "Repeat music", repeatMusicHelp: "Loop the selected track in the library." },
  zh: { fullscreenByDefault: "全屏启动", repeatMusic: "循环播放音乐", repeatMusicHelp: "在游戏库中循环播放所选曲目。" },
  es: { fullscreenByDefault: "Iniciar en pantalla completa", repeatMusic: "Repetir música", repeatMusicHelp: "Repite la pista seleccionada en la biblioteca." },
  fr: { fullscreenByDefault: "Lancer en plein écran", repeatMusic: "Répéter la musique", repeatMusicHelp: "Répète la piste sélectionnée dans la bibliothèque." },
  de: { fullscreenByDefault: "Im Vollbild starten", repeatMusic: "Musik wiederholen", repeatMusicHelp: "Wiederholt den ausgewählten Titel in der Bibliothek." },
  "pt-BR": { fullscreenByDefault: "Iniciar em tela cheia", repeatMusic: "Repetir música", repeatMusicHelp: "Repete a faixa selecionada na biblioteca." },
  ja: { fullscreenByDefault: "全画面で起動", repeatMusic: "音楽を繰り返す", repeatMusicHelp: "ライブラリで選択した曲を繰り返します。" },
  ko: { fullscreenByDefault: "전체 화면으로 시작", repeatMusic: "음악 반복", repeatMusicHelp: "라이브러리에서 선택한 트랙을 반복 재생합니다." },
  hi: { fullscreenByDefault: "फ़ुलस्क्रीन में शुरू करें", repeatMusic: "संगीत दोहराएँ", repeatMusicHelp: "लाइब्रेरी में चुने हुए ट्रैक को दोहराएँ।" },
  ar: { fullscreenByDefault: "بدء التشغيل بملء الشاشة", repeatMusic: "تكرار الموسيقى", repeatMusicHelp: "تكرار المقطع المحدد في المكتبة." },
  ru: { fullscreenByDefault: "Запускать в полноэкранном режиме", repeatMusic: "Повторять музыку", repeatMusicHelp: "Повторяет выбранную композицию в библиотеке." },
};

export const playTimeLabels: Record<Language, { playTime: string; session: string; activeSession: string; hour: string; minute: string; second: string }> = {
  en: { playTime: "Play time", session: "Session", activeSession: "Current session", hour: "h", minute: "min", second: "s" },
  zh: { playTime: "游玩时长", session: "本次游玩", activeSession: "当前游玩", hour: "小时", minute: "分钟", second: "秒" },
  es: { playTime: "Tiempo de juego", session: "Sesión", activeSession: "Sesión actual", hour: "h", minute: "min", second: "s" },
  fr: { playTime: "Temps de jeu", session: "Session", activeSession: "Session en cours", hour: "h", minute: "min", second: "s" },
  de: { playTime: "Spielzeit", session: "Sitzung", activeSession: "Aktuelle Sitzung", hour: "Std.", minute: "Min.", second: "Sek." },
  "pt-BR": { playTime: "Tempo de jogo", session: "Sessão", activeSession: "Sessão atual", hour: "h", minute: "min", second: "s" },
  ja: { playTime: "プレイ時間", session: "セッション", activeSession: "現在のセッション", hour: "時間", minute: "分", second: "秒" },
  ko: { playTime: "플레이 시간", session: "세션", activeSession: "현재 세션", hour: "시간", minute: "분", second: "초" },
  hi: { playTime: "खेलने का समय", session: "सत्र", activeSession: "वर्तमान सत्र", hour: "घं.", minute: "मि.", second: "से." },
  ar: { playTime: "وقت اللعب", session: "الجلسة", activeSession: "الجلسة الحالية", hour: "س", minute: "د", second: "ث" },
  ru: { playTime: "Время в игре", session: "Сеанс", activeSession: "Текущий сеанс", hour: "ч", minute: "мин", second: "с" },
};

export const themeLabels: Record<Language, { play: string; stop: string; selectFirst: string; noMusic: string; gameRunning: string; volume: string }> = {
  en: { play: "Play game theme", stop: "Stop game theme", selectFirst: "Select a game to play its music", noMusic: "No music available for this game", gameRunning: "Music is paused while a game is running", volume: "Game music volume" },
  zh: { play: "播放游戏主题音乐", stop: "停止游戏主题音乐", selectFirst: "选择游戏以播放其音乐", noMusic: "此游戏没有可用音乐", gameRunning: "游戏运行期间音乐已暂停", volume: "游戏音乐音量" },
  es: { play: "Reproducir el tema del juego", stop: "Detener el tema del juego", selectFirst: "Selecciona un juego para reproducir su música", noMusic: "No hay música disponible para este juego", gameRunning: "La música está en pausa mientras se ejecuta un juego", volume: "Volumen de la música del juego" },
  fr: { play: "Lire le thème musical du jeu", stop: "Arrêter le thème musical du jeu", selectFirst: "Sélectionnez un jeu pour écouter sa musique", noMusic: "Aucune musique disponible pour ce jeu", gameRunning: "La musique est en pause pendant l’exécution d’un jeu", volume: "Volume de la musique du jeu" },
  de: { play: "Spielmusik abspielen", stop: "Spielmusik stoppen", selectFirst: "Wähle ein Spiel aus, um seine Musik abzuspielen", noMusic: "Für dieses Spiel ist keine Musik verfügbar", gameRunning: "Die Musik ist während eines laufenden Spiels pausiert", volume: "Lautstärke der Spielmusik" },
  "pt-BR": { play: "Reproduzir tema do jogo", stop: "Parar tema do jogo", selectFirst: "Selecione um jogo para ouvir sua música", noMusic: "Não há música disponível para este jogo", gameRunning: "A música fica pausada enquanto um jogo está em execução", volume: "Volume da música do jogo" },
  ja: { play: "ゲームのテーマ曲を再生", stop: "ゲームのテーマ曲を停止", selectFirst: "音楽を再生するゲームを選択してください", noMusic: "このゲームには音楽がありません", gameRunning: "ゲームの実行中は音楽を一時停止します", volume: "ゲーム音楽の音量" },
  ko: { play: "게임 테마 음악 재생", stop: "게임 테마 음악 중지", selectFirst: "음악을 재생할 게임을 선택하세요", noMusic: "이 게임에는 사용 가능한 음악이 없습니다", gameRunning: "게임 실행 중에는 음악이 일시 중지됩니다", volume: "게임 음악 음량" },
  hi: { play: "गेम का थीम संगीत चलाएँ", stop: "गेम का थीम संगीत रोकें", selectFirst: "संगीत चलाने के लिए कोई गेम चुनें", noMusic: "इस गेम के लिए संगीत उपलब्ध नहीं है", gameRunning: "गेम चलते समय संगीत रुका रहता है", volume: "गेम संगीत की आवाज़" },
  ar: { play: "تشغيل موسيقى اللعبة", stop: "إيقاف موسيقى اللعبة", selectFirst: "اختر لعبة لتشغيل موسيقاها", noMusic: "لا توجد موسيقى متاحة لهذه اللعبة", gameRunning: "تُوقَف الموسيقى مؤقتًا أثناء تشغيل لعبة", volume: "مستوى صوت موسيقى اللعبة" },
  ru: { play: "Включить музыкальную тему игры", stop: "Выключить музыкальную тему игры", selectFirst: "Выберите игру, чтобы включить её музыку", noMusic: "Для этой игры нет музыки", gameRunning: "Музыка приостановлена, пока запущена игра", volume: "Громкость музыки игры" },
};

export const musicLabels: Record<
  Language,
  { choose: string; remove: string; music: string; builtIn: string; none: string; failed: string; defaultMusic: string; track: string }
> = {
  en: { choose: "Select custom music file", remove: "Remove custom music", music: "Music", builtIn: "{file} (built-in)", none: "None", failed: "Could not change the music file", defaultMusic: "Default music", track: "Track {n}" },
  zh: { choose: "选择自定义音乐文件", remove: "移除自定义音乐", music: "音乐", builtIn: "{file}（内置）", none: "无", failed: "无法更换音乐文件", defaultMusic: "默认音乐", track: "曲目 {n}" },
  es: { choose: "Seleccionar un archivo de música personalizado", remove: "Quitar la música personalizada", music: "Música", builtIn: "{file} (integrada)", none: "Ninguna", failed: "No se ha podido cambiar el archivo de música", defaultMusic: "Música predeterminada", track: "Pista {n}" },
  fr: { choose: "Choisir un fichier musical personnalisé", remove: "Retirer la musique personnalisée", music: "Musique", builtIn: "{file} (intégrée)", none: "Aucune", failed: "Impossible de changer le fichier musical", defaultMusic: "Musique par défaut", track: "Piste {n}" },
  de: { choose: "Eigene Musikdatei auswählen", remove: "Eigene Musik entfernen", music: "Musik", builtIn: "{file} (integriert)", none: "Keine", failed: "Musikdatei konnte nicht geändert werden", defaultMusic: "Standardmusik", track: "Titel {n}" },
  "pt-BR": { choose: "Selecionar arquivo de música personalizado", remove: "Remover música personalizada", music: "Música", builtIn: "{file} (integrada)", none: "Nenhuma", failed: "Não foi possível alterar o arquivo de música", defaultMusic: "Música padrão", track: "Faixa {n}" },
  ja: { choose: "カスタム音楽ファイルを選択", remove: "カスタム音楽を削除", music: "音楽", builtIn: "{file}（内蔵）", none: "なし", failed: "音楽ファイルを変更できませんでした", defaultMusic: "標準の音楽", track: "トラック {n}" },
  ko: { choose: "사용자 지정 음악 파일 선택", remove: "사용자 지정 음악 제거", music: "음악", builtIn: "{file} (내장)", none: "없음", failed: "음악 파일을 변경하지 못했습니다", defaultMusic: "기본 음악", track: "트랙 {n}" },
  hi: { choose: "कस्टम संगीत फ़ाइल चुनें", remove: "कस्टम संगीत हटाएँ", music: "संगीत", builtIn: "{file} (अंतर्निहित)", none: "कोई नहीं", failed: "संगीत फ़ाइल बदली नहीं जा सकी", defaultMusic: "डिफ़ॉल्ट संगीत", track: "ट्रैक {n}" },
  ar: { choose: "اختيار ملف موسيقى مخصص", remove: "إزالة الموسيقى المخصصة", music: "الموسيقى", builtIn: "{file} (مدمجة)", none: "لا شيء", failed: "تعذّر تغيير ملف الموسيقى", defaultMusic: "الموسيقى الافتراضية", track: "المقطع {n}" },
  ru: { choose: "Выбрать свой музыкальный файл", remove: "Убрать свою музыку", music: "Музыка", builtIn: "{file} (встроенная)", none: "Нет", failed: "Не удалось изменить музыкальный файл", defaultMusic: "Музыка по умолчанию", track: "Композиция {n}" },
};

export const closeBlockedLabels: Record<Language, string> = {
  en: "Flash Royale can’t be closed while a game is running. Stop the game first.",
  zh: "游戏运行时无法关闭 Flash Royale。请先停止游戏。",
  es: "No se puede cerrar Flash Royale mientras se ejecuta un juego. Detén el juego primero.",
  fr: "Impossible de fermer Flash Royale pendant l’exécution d’un jeu. Arrêtez d’abord le jeu.",
  de: "Flash Royale kann nicht geschlossen werden, solange ein Spiel läuft. Beende zuerst das Spiel.",
  "pt-BR": "Não é possível fechar o Flash Royale enquanto um jogo está em execução. Pare o jogo primeiro.",
  ja: "ゲームの実行中は Flash Royale を終了できません。先にゲームを停止してください。",
  ko: "게임 실행 중에는 Flash Royale을 닫을 수 없습니다. 먼저 게임을 중지하세요.",
  hi: "गेम चलते समय Flash Royale बंद नहीं किया जा सकता। पहले गेम रोकें।",
  ar: "لا يمكن إغلاق Flash Royale أثناء تشغيل لعبة. أوقف اللعبة أولًا.",
  ru: "Нельзя закрыть Flash Royale, пока запущена игра. Сначала остановите игру.",
};

export const exploreCloseBlockedLabels: Record<Language, string> = {
  en: "Flash Royale cannot be closed while Explore is open. Close the Explore window first.",
  zh: "探索窗口打开时无法关闭 Flash Royale。请先关闭探索窗口。",
  es: "No se puede cerrar Flash Royale mientras Explorar está abierto. Cierra primero la ventana de Explorar.",
  fr: "Impossible de fermer Flash Royale tant que la fenêtre Explorer est ouverte. Fermez-la d’abord.",
  de: "Flash Royale kann nicht geschlossen werden, solange Entdecken geöffnet ist. Schließe zuerst das Entdecken-Fenster.",
  "pt-BR": "Não é possível fechar o Flash Royale enquanto Explorar estiver aberto. Feche primeiro a janela Explorar.",
  ja: "探索ウィンドウが開いている間は Flash Royale を終了できません。先に探索ウィンドウを閉じてください。",
  ko: "탐색 창이 열려 있으면 Flash Royale을 닫을 수 없습니다. 먼저 탐색 창을 닫으세요.",
  hi: "खोजें विंडो खुली होने पर Flash Royale बंद नहीं किया जा सकता। पहले खोजें विंडो बंद करें।",
  ar: "لا يمكن إغلاق Flash Royale ما دامت نافذة الاستكشاف مفتوحة. أغلق نافذة الاستكشاف أولًا.",
  ru: "Нельзя закрыть Flash Royale, пока открыто окно обзора. Сначала закройте окно обзора.",
};

export const toastLabels: Record<Language, { appStarted: string; gameStarted: string; gameStopped: string; coversFinished: string; coverCreated: string }> = {
  en: { appStarted: "App started", gameStarted: "Game started: {title}", gameStopped: "Game stopped: {title}", coversFinished: "Automatic cover creation finished", coverCreated: "Automatic cover created: {title}" },
  zh: { appStarted: "应用已启动", gameStarted: "游戏已启动：{title}", gameStopped: "游戏已停止：{title}", coversFinished: "自动封面生成已完成", coverCreated: "已生成自动封面：{title}" },
  es: { appStarted: "Aplicación iniciada", gameStarted: "Juego iniciado: {title}", gameStopped: "Juego detenido: {title}", coversFinished: "Creación automática de portadas finalizada", coverCreated: "Portada automática creada: {title}" },
  fr: { appStarted: "Application démarrée", gameStarted: "Jeu lancé : {title}", gameStopped: "Jeu arrêté : {title}", coversFinished: "Création automatique des couvertures terminée", coverCreated: "Couverture automatique créée : {title}" },
  de: { appStarted: "App gestartet", gameStarted: "Spiel gestartet: {title}", gameStopped: "Spiel gestoppt: {title}", coversFinished: "Automatische Cover-Erstellung abgeschlossen", coverCreated: "Automatisches Cover erstellt: {title}" },
  "pt-BR": { appStarted: "Aplicativo iniciado", gameStarted: "Jogo iniciado: {title}", gameStopped: "Jogo interrompido: {title}", coversFinished: "Criação automática de capas concluída", coverCreated: "Capa automática criada: {title}" },
  ja: { appStarted: "アプリを起動しました", gameStarted: "ゲームを起動しました：{title}", gameStopped: "ゲームを停止しました：{title}", coversFinished: "カバーの自動作成が完了しました", coverCreated: "自動カバーを作成しました：{title}" },
  ko: { appStarted: "앱을 시작했습니다", gameStarted: "게임을 시작했습니다: {title}", gameStopped: "게임을 중지했습니다: {title}", coversFinished: "자동 표지 생성을 완료했습니다", coverCreated: "자동 표지를 만들었습니다: {title}" },
  hi: { appStarted: "ऐप शुरू हो गया", gameStarted: "गेम शुरू हुआ: {title}", gameStopped: "गेम रोका गया: {title}", coversFinished: "स्वचालित कवर बनाना पूरा हुआ", coverCreated: "स्वचालित कवर बनाया गया: {title}" },
  ar: { appStarted: "تم بدء التطبيق", gameStarted: "تم بدء اللعبة: {title}", gameStopped: "تم إيقاف اللعبة: {title}", coversFinished: "اكتمل إنشاء الأغلفة تلقائيًا", coverCreated: "تم إنشاء الغلاف تلقائيًا: {title}" },
  ru: { appStarted: "Приложение запущено", gameStarted: "Игра запущена: {title}", gameStopped: "Игра остановлена: {title}", coversFinished: "Автоматическое создание обложек завершено", coverCreated: "Автоматическая обложка создана: {title}" },
};

export const coverCaptureLabels: Record<Language, { chooseImage: string; recapture: string; capturing: string }> = {
  en: { chooseImage: "Select cover image", recapture: "Redo automatic cover", capturing: "Capturing cover…" },
  zh: { chooseImage: "选择封面图片", recapture: "重新生成自动封面", capturing: "正在截取封面…" },
  es: { chooseImage: "Seleccionar imagen de portada", recapture: "Volver a crear la portada automática", capturing: "Capturando portada…" },
  fr: { chooseImage: "Choisir une image de couverture", recapture: "Recréer la couverture automatique", capturing: "Capture de la couverture…" },
  de: { chooseImage: "Cover-Bild auswählen", recapture: "Automatisches Cover neu erstellen", capturing: "Cover wird aufgenommen…" },
  "pt-BR": { chooseImage: "Selecionar imagem de capa", recapture: "Refazer capa automática", capturing: "Capturando capa…" },
  ja: { chooseImage: "カバー画像を選択", recapture: "自動カバーを作り直す", capturing: "カバーをキャプチャ中…" },
  ko: { chooseImage: "표지 이미지 선택", recapture: "자동 표지 다시 만들기", capturing: "표지 캡처 중…" },
  hi: { chooseImage: "कवर छवि चुनें", recapture: "स्वचालित कवर फिर बनाएँ", capturing: "कवर कैप्चर हो रहा है…" },
  ar: { chooseImage: "اختيار صورة الغلاف", recapture: "إعادة إنشاء الغلاف التلقائي", capturing: "جارٍ التقاط الغلاف…" },
  ru: { chooseImage: "Выбрать изображение обложки", recapture: "Пересоздать автоматическую обложку", capturing: "Создание снимка для обложки…" },
};

export const importProgressLabels: Record<
  Language,
  { title: string; fileCount: string; cancelling: string; done: string; cancelled: string; added: string; skipped: string; none: string; ok: string }
> = {
  en: { title: "Importing games…", fileCount: "File {current} of {total}", cancelling: "Cancelling…", done: "Import complete", cancelled: "Import cancelled", added: "Added ({count})", skipped: "Skipped ({count})", none: "None", ok: "OK" },
  zh: { title: "正在导入游戏…", fileCount: "文件 {current} / {total}", cancelling: "正在取消…", done: "导入完成", cancelled: "导入已取消", added: "已添加（{count}）", skipped: "已跳过（{count}）", none: "无", ok: "确定" },
  es: { title: "Importando juegos…", fileCount: "Archivo {current} de {total}", cancelling: "Cancelando…", done: "Importación completada", cancelled: "Importación cancelada", added: "Añadidos ({count})", skipped: "Omitidos ({count})", none: "Ninguno", ok: "Aceptar" },
  fr: { title: "Importation des jeux…", fileCount: "Fichier {current} sur {total}", cancelling: "Annulation…", done: "Importation terminée", cancelled: "Importation annulée", added: "Ajoutés ({count})", skipped: "Ignorés ({count})", none: "Aucun", ok: "OK" },
  de: { title: "Spiele werden importiert…", fileCount: "Datei {current} von {total}", cancelling: "Wird abgebrochen…", done: "Import abgeschlossen", cancelled: "Import abgebrochen", added: "Hinzugefügt ({count})", skipped: "Übersprungen ({count})", none: "Keine", ok: "OK" },
  "pt-BR": { title: "Importando jogos…", fileCount: "Arquivo {current} de {total}", cancelling: "Cancelando…", done: "Importação concluída", cancelled: "Importação cancelada", added: "Adicionados ({count})", skipped: "Ignorados ({count})", none: "Nenhum", ok: "OK" },
  ja: { title: "ゲームをインポート中…", fileCount: "ファイル {current} / {total}", cancelling: "キャンセル中…", done: "インポート完了", cancelled: "インポートをキャンセルしました", added: "追加（{count}）", skipped: "スキップ（{count}）", none: "なし", ok: "OK" },
  ko: { title: "게임 가져오는 중…", fileCount: "파일 {current} / {total}", cancelling: "취소 중…", done: "가져오기 완료", cancelled: "가져오기가 취소되었습니다", added: "추가됨 ({count})", skipped: "건너뜀 ({count})", none: "없음", ok: "확인" },
  hi: { title: "गेम आयात हो रहे हैं…", fileCount: "फ़ाइल {current} / {total}", cancelling: "रद्द किया जा रहा है…", done: "आयात पूरा हुआ", cancelled: "आयात रद्द हुआ", added: "जोड़े गए ({count})", skipped: "छोड़े गए ({count})", none: "कोई नहीं", ok: "ठीक है" },
  ar: { title: "جارٍ استيراد الألعاب…", fileCount: "الملف {current} من {total}", cancelling: "جارٍ الإلغاء…", done: "اكتمل الاستيراد", cancelled: "تم إلغاء الاستيراد", added: "تمت الإضافة ({count})", skipped: "تم التخطي ({count})", none: "لا شيء", ok: "موافق" },
  ru: { title: "Импорт игр…", fileCount: "Файл {current} из {total}", cancelling: "Отмена…", done: "Импорт завершён", cancelled: "Импорт отменён", added: "Добавлено ({count})", skipped: "Пропущено ({count})", none: "Нет", ok: "ОК" },
};

export const exploreImportStageLabels: Record<Language, { preparing: string; downloading: string; saving: string }> = {
  en: { preparing: "Preparing import...", downloading: "Downloading game...", saving: "Saving to library..." },
  zh: { preparing: "正在准备导入...", downloading: "正在下载游戏...", saving: "正在保存到游戏库..." },
  es: { preparing: "Preparando la importación...", downloading: "Descargando el juego...", saving: "Guardando en la biblioteca..." },
  fr: { preparing: "Préparation de l’importation...", downloading: "Téléchargement du jeu...", saving: "Enregistrement dans la bibliothèque..." },
  de: { preparing: "Import wird vorbereitet...", downloading: "Spiel wird heruntergeladen...", saving: "Wird in der Bibliothek gespeichert..." },
  "pt-BR": { preparing: "Preparando a importação...", downloading: "Baixando o jogo...", saving: "Salvando na biblioteca..." },
  ja: { preparing: "インポートを準備中...", downloading: "ゲームをダウンロード中...", saving: "ライブラリに保存中..." },
  ko: { preparing: "가져오기 준비 중...", downloading: "게임 다운로드 중...", saving: "라이브러리에 저장 중..." },
  hi: { preparing: "आयात की तैयारी हो रही है...", downloading: "गेम डाउनलोड हो रहा है...", saving: "लाइब्रेरी में सहेजा जा रहा है..." },
  ar: { preparing: "جارٍ التحضير للاستيراد...", downloading: "جارٍ تنزيل اللعبة...", saving: "جارٍ الحفظ في المكتبة..." },
  ru: { preparing: "Подготовка к импорту...", downloading: "Скачивание игры...", saving: "Сохранение в библиотеку..." },
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
  ru: "Импорт: {title}",
};

export const libraryMigrationLabels: Record<Language, { title: string; preparing: string; status: string; cancelHint: string }> = {
  en: { title: "Updating game folders", preparing: "Preparing your library...", status: "Game {current} of {total}: {title}", cancelHint: "Cancel finishes the current game, then closes the app. Remaining games resume next time you open it." },
  zh: { title: "正在更新游戏文件夹", preparing: "正在准备游戏库...", status: "游戏 {current} / {total}：{title}", cancelHint: "取消后将完成当前游戏，然后关闭应用。下次打开时会继续处理剩余游戏。" },
  es: { title: "Actualizando carpetas de juegos", preparing: "Preparando tu biblioteca...", status: "Juego {current} de {total}: {title}", cancelHint: "Al cancelar, se termina el juego actual y se cierra la aplicación. Los demás se procesarán al abrirla de nuevo." },
  fr: { title: "Mise à jour des dossiers des jeux", preparing: "Préparation de votre bibliothèque...", status: "Jeu {current} sur {total} : {title}", cancelHint: "L'annulation termine le jeu en cours, puis ferme l'application. Les jeux restants seront traités au prochain lancement." },
  de: { title: "Spielordner werden aktualisiert", preparing: "Deine Bibliothek wird vorbereitet...", status: "Spiel {current} von {total}: {title}", cancelHint: "Abbrechen beendet das aktuelle Spiel und schließt dann die App. Die übrigen Spiele werden beim nächsten Start verarbeitet." },
  "pt-BR": { title: "Atualizando pastas dos jogos", preparing: "Preparando sua biblioteca...", status: "Jogo {current} de {total}: {title}", cancelHint: "Cancelar conclui o jogo atual e fecha o aplicativo. Os jogos restantes serão processados na próxima abertura." },
  ja: { title: "ゲームのフォルダーを更新中", preparing: "ライブラリを準備中...", status: "ゲーム {current} / {total}：{title}", cancelHint: "キャンセルすると現在のゲームの処理を完了してからアプリを閉じます。残りのゲームは次回起動時に再開します。" },
  ko: { title: "게임 폴더 업데이트 중", preparing: "라이브러리 준비 중...", status: "게임 {current} / {total}: {title}", cancelHint: "취소하면 현재 게임의 처리를 완료한 뒤 앱이 닫힙니다. 남은 게임은 다음 실행 시 이어서 처리합니다." },
  hi: { title: "गेम फ़ोल्डर अपडेट हो रहे हैं", preparing: "आपकी लाइब्रेरी तैयार हो रही है...", status: "गेम {current} / {total}: {title}", cancelHint: "रद्द करने पर मौजूदा गेम का काम पूरा करके ऐप बंद होगा। बाकी गेम का काम अगली बार ऐप खोलने पर जारी रहेगा।" },
  ar: { title: "جارٍ تحديث مجلدات الألعاب", preparing: "جارٍ تجهيز مكتبتك...", status: "اللعبة {current} من {total}: {title}", cancelHint: "يُكمل الإلغاء معالجة اللعبة الحالية ثم يغلق التطبيق. تُستأنف الألعاب المتبقية عند فتحه مجدداً." },
  ru: { title: "Обновление папок игр", preparing: "Подготовка библиотеки...", status: "Игра {current} из {total}: {title}", cancelHint: "При отмене обработка текущей игры завершится, затем приложение закроется. Остальные игры будут обработаны при следующем запуске." },
};

export const stopPlayingLabels: Record<Language, string> = {
  en: "Stop Playing",
  zh: "停止游戏",
  es: "Dejar de jugar",
  fr: "Arrêter le jeu",
  de: "Spiel beenden",
  "pt-BR": "Parar de jogar",
  ja: "プレイを停止",
  ko: "플레이 중지",
  hi: "खेलना रोकें",
  ar: "إيقاف اللعب",
  ru: "Остановить игру",
};

export const gamePanelLabels: Record<Language, { info: string; settings: string; back: string; on: string; off: string; stage: string }> = {
  en: { info: "Game info", settings: "Game settings", back: "Back to game info", on: "Enabled", off: "Disabled", stage: "Stage size" },
  zh: { info: "游戏信息", settings: "游戏设置", back: "返回游戏信息", on: "已启用", off: "已禁用", stage: "舞台尺寸" },
  es: { info: "Información del juego", settings: "Configuración del juego", back: "Volver a la información del juego", on: "Activado", off: "Desactivado", stage: "Tamaño del escenario" },
  fr: { info: "Informations du jeu", settings: "Paramètres du jeu", back: "Revenir aux informations du jeu", on: "Activé", off: "Désactivé", stage: "Taille de la scène" },
  de: { info: "Spielinformationen", settings: "Spieleinstellungen", back: "Zurück zu den Spielinformationen", on: "Aktiviert", off: "Deaktiviert", stage: "Bühnengröße" },
  "pt-BR": { info: "Informações do jogo", settings: "Configurações do jogo", back: "Voltar às informações do jogo", on: "Ativado", off: "Desativado", stage: "Tamanho do palco" },
  ja: { info: "ゲーム情報", settings: "ゲーム設定", back: "ゲーム情報に戻る", on: "有効", off: "無効", stage: "ステージサイズ" },
  ko: { info: "게임 정보", settings: "게임 설정", back: "게임 정보로 돌아가기", on: "사용", off: "사용 안 함", stage: "스테이지 크기" },
  hi: { info: "गेम की जानकारी", settings: "गेम सेटिंग", back: "गेम की जानकारी पर वापस जाएँ", on: "चालू", off: "बंद", stage: "स्टेज का आकार" },
  ar: { info: "معلومات اللعبة", settings: "إعدادات اللعبة", back: "العودة إلى معلومات اللعبة", on: "مفعّل", off: "معطّل", stage: "حجم المسرح" },
  ru: { info: "Информация об игре", settings: "Настройки игры", back: "Назад к информации об игре", on: "Включено", off: "Выключено", stage: "Размер сцены" },
};

export const detailPanelLabels: Record<Language, { show: string; hide: string; resize: string; resizeSidebar: string }> = {
  en: { show: "Show game details", hide: "Hide game details", resize: "Resize game details panel", resizeSidebar: "Resize sidebar" },
  zh: { show: "显示游戏详情", hide: "隐藏游戏详情", resize: "调整游戏详情面板大小", resizeSidebar: "调整侧边栏大小" },
  es: { show: "Mostrar detalles del juego", hide: "Ocultar detalles del juego", resize: "Cambiar el tamaño del panel de detalles del juego", resizeSidebar: "Cambiar el tamaño de la barra lateral" },
  fr: { show: "Afficher les détails du jeu", hide: "Masquer les détails du jeu", resize: "Redimensionner le panneau des détails du jeu", resizeSidebar: "Redimensionner la barre latérale" },
  de: { show: "Spieldetails anzeigen", hide: "Spieldetails ausblenden", resize: "Größe des Spieldetails-Bereichs ändern", resizeSidebar: "Größe der Seitenleiste ändern" },
  "pt-BR": { show: "Mostrar detalhes do jogo", hide: "Ocultar detalhes do jogo", resize: "Redimensionar painel de detalhes do jogo", resizeSidebar: "Redimensionar barra lateral" },
  ja: { show: "ゲームの詳細を表示", hide: "ゲームの詳細を隠す", resize: "ゲーム詳細パネルのサイズを変更", resizeSidebar: "サイドバーのサイズを変更" },
  ko: { show: "게임 상세 정보 표시", hide: "게임 상세 정보 숨기기", resize: "게임 상세 정보 패널 크기 조절", resizeSidebar: "사이드바 크기 조절" },
  hi: { show: "गेम का विवरण दिखाएँ", hide: "गेम का विवरण छिपाएँ", resize: "गेम विवरण पैनल का आकार बदलें", resizeSidebar: "साइडबार का आकार बदलें" },
  ar: { show: "إظهار تفاصيل اللعبة", hide: "إخفاء تفاصيل اللعبة", resize: "تغيير حجم لوحة تفاصيل اللعبة", resizeSidebar: "تغيير حجم الشريط الجانبي" },
  ru: { show: "Показать сведения об игре", hide: "Скрыть сведения об игре", resize: "Изменить размер панели сведений об игре", resizeSidebar: "Изменить размер боковой панели" },
};

export const softwareInfoLabels: Record<Language, { thirdParty: string; technical: string }> = {
  en: { thirdParty: "Third-party software", technical: "Technical information" },
  fr: { thirdParty: "Logiciels tiers", technical: "Informations techniques" },
  zh: { thirdParty: "第三方软件", technical: "技术信息" },
  es: { thirdParty: "Software de terceros", technical: "Información técnica" },
  de: { thirdParty: "Drittanbietersoftware", technical: "Technische Informationen" },
  "pt-BR": { thirdParty: "Software de terceiros", technical: "Informações técnicas" },
  ja: { thirdParty: "サードパーティ製ソフトウェア", technical: "技術情報" },
  ko: { thirdParty: "타사 소프트웨어", technical: "기술 정보" },
  hi: { thirdParty: "तृतीय-पक्ष सॉफ़्टवेयर", technical: "तकनीकी जानकारी" },
  ar: { thirdParty: "برامج الجهات الخارجية", technical: "معلومات تقنية" },
  ru: { thirdParty: "Стороннее ПО", technical: "Техническая информация" },
};

export const settingsOverviewLabels: Record<Language, string> = {
  en: "App overview",
  zh: "应用概览",
  es: "Resumen de la aplicación",
  fr: "Vue d’ensemble de l’application",
  de: "App-Übersicht",
  "pt-BR": "Visão geral do aplicativo",
  ja: "アプリの概要",
  ko: "앱 개요",
  hi: "ऐप का अवलोकन",
  ar: "نظرة عامة على التطبيق",
  ru: "Обзор приложения",
};

export const settingsSectionLabels: Record<Language, { startup: string; library: string; input: string; appearance: string; behavior: string; status: string }> = {
  en: { startup: "Startup and window", library: "Game library", input: "Input", appearance: "Appearance", behavior: "Behavior", status: "Status and updates" },
  zh: { startup: "启动与窗口", library: "游戏库", input: "输入", appearance: "外观", behavior: "行为", status: "状态与更新" },
  es: { startup: "Inicio y ventana", library: "Biblioteca de juegos", input: "Entrada", appearance: "Apariencia", behavior: "Comportamiento", status: "Estado y actualizaciones" },
  fr: { startup: "Démarrage et fenêtre", library: "Bibliothèque de jeux", input: "Entrée", appearance: "Apparence", behavior: "Comportement", status: "État et mises à jour" },
  de: { startup: "Start und Fenster", library: "Spielebibliothek", input: "Eingabe", appearance: "Darstellung", behavior: "Verhalten", status: "Status und Updates" },
  "pt-BR": { startup: "Inicialização e janela", library: "Biblioteca de jogos", input: "Entrada", appearance: "Aparência", behavior: "Comportamento", status: "Status e atualizações" },
  ja: { startup: "起動とウィンドウ", library: "ゲームライブラリ", input: "入力", appearance: "外観", behavior: "動作", status: "状態と更新" },
  ko: { startup: "시작 및 창", library: "게임 라이브러리", input: "입력", appearance: "모양", behavior: "동작", status: "상태 및 업데이트" },
  hi: { startup: "स्टार्टअप और विंडो", library: "गेम लाइब्रेरी", input: "इनपुट", appearance: "दिखावट", behavior: "व्यवहार", status: "स्थिति और अपडेट" },
  ar: { startup: "بدء التشغيل والنافذة", library: "مكتبة الألعاب", input: "الإدخال", appearance: "المظهر", behavior: "السلوك", status: "الحالة والتحديثات" },
  ru: { startup: "Запуск и окно", library: "Библиотека игр", input: "Ввод", appearance: "Внешний вид", behavior: "Поведение", status: "Состояние и обновления" },
};

export const settingsInfoLabels: Record<Language, { about: string; version: string; author: string; github: string; ruffleVersion: string; originallyMadeBy: string; openOriginalAuthorRepository: string }> = {
  en: { about: "About this app", version: "Version", author: "Author", github: "GitHub repository", ruffleVersion: "Ruffle version", originallyMadeBy: "This app was originally made by xevil3301.", openOriginalAuthorRepository: "Open xevil3301's GitHub repository" },
  zh: { about: "关于此应用", version: "版本", author: "作者", github: "GitHub 仓库", ruffleVersion: "Ruffle 版本", originallyMadeBy: "此应用最初由 xevil3301 制作。", openOriginalAuthorRepository: "打开 xevil3301 的 GitHub 仓库" },
  es: { about: "Acerca de esta aplicación", version: "Versión", author: "Autor", github: "Repositorio de GitHub", ruffleVersion: "Versión de Ruffle", originallyMadeBy: "Esta aplicación fue creada originalmente por xevil3301.", openOriginalAuthorRepository: "Abrir el repositorio de GitHub de xevil3301" },
  fr: { about: "À propos de cette application", version: "Version", author: "Auteur", github: "Dépôt GitHub", ruffleVersion: "Version de Ruffle", originallyMadeBy: "Cette application a été créée à l’origine par xevil3301.", openOriginalAuthorRepository: "Ouvrir le dépôt GitHub de xevil3301" },
  de: { about: "Über diese App", version: "Version", author: "Autor", github: "GitHub-Repository", ruffleVersion: "Ruffle-Version", originallyMadeBy: "Diese App wurde ursprünglich von xevil3301 entwickelt.", openOriginalAuthorRepository: "GitHub-Repository von xevil3301 öffnen" },
  "pt-BR": { about: "Sobre este aplicativo", version: "Versão", author: "Autor", github: "Repositório do GitHub", ruffleVersion: "Versão do Ruffle", originallyMadeBy: "Este aplicativo foi criado originalmente por xevil3301.", openOriginalAuthorRepository: "Abrir o repositório de xevil3301 no GitHub" },
  ja: { about: "このアプリについて", version: "バージョン", author: "作者", github: "GitHub リポジトリ", ruffleVersion: "Ruffle のバージョン", originallyMadeBy: "このアプリはもともと xevil3301 が作成しました。", openOriginalAuthorRepository: "xevil3301 の GitHub リポジトリを開く" },
  ko: { about: "이 앱 정보", version: "버전", author: "제작자", github: "GitHub 저장소", ruffleVersion: "Ruffle 버전", originallyMadeBy: "이 앱은 원래 xevil3301이 만들었습니다.", openOriginalAuthorRepository: "xevil3301의 GitHub 저장소 열기" },
  hi: { about: "इस ऐप के बारे में", version: "संस्करण", author: "लेखक", github: "GitHub रिपॉज़िटरी", ruffleVersion: "Ruffle संस्करण", originallyMadeBy: "यह ऐप मूल रूप से xevil3301 ने बनाया था।", openOriginalAuthorRepository: "xevil3301 की GitHub रिपॉज़िटरी खोलें" },
  ar: { about: "حول هذا التطبيق", version: "الإصدار", author: "المؤلف", github: "مستودع GitHub", ruffleVersion: "إصدار Ruffle", originallyMadeBy: "أنشأ xevil3301 هذا التطبيق في الأصل.", openOriginalAuthorRepository: "فتح مستودع xevil3301 على GitHub" },
  ru: { about: "Об этом приложении", version: "Версия", author: "Автор", github: "Репозиторий GitHub", ruffleVersion: "Версия Ruffle", originallyMadeBy: "Изначально это приложение создал xevil3301.", openOriginalAuthorRepository: "Открыть репозиторий xevil3301 на GitHub" },
};

export const importGameLabels: Record<Language, { button: string; emptyHint: string }> = {
  en: { button: "Import Game", emptyHint: "Select “Import Game” or drop SWF / DCR files into the window." },
  zh: { button: "导入游戏", emptyHint: "选择“导入游戏”，或将 SWF / DCR 文件拖入窗口。" },
  es: { button: "Importar juego", emptyHint: "Selecciona «Importar juego» o suelta archivos SWF / DCR en la ventana." },
  fr: { button: "Importer un jeu", emptyHint: "Choisissez « Importer un jeu » ou déposez des fichiers SWF / DCR dans la fenêtre." },
  de: { button: "Spiel importieren", emptyHint: "Wähle „Spiel importieren“ oder ziehe SWF- / DCR-Dateien in das Fenster." },
  "pt-BR": { button: "Importar jogo", emptyHint: "Selecione “Importar jogo” ou solte arquivos SWF / DCR na janela." },
  ja: { button: "ゲームをインポート", emptyHint: "「ゲームをインポート」を選ぶか、SWF / DCR ファイルをウィンドウにドロップしてください。" },
  ko: { button: "게임 가져오기", emptyHint: "“게임 가져오기”를 선택하거나 SWF / DCR 파일을 창에 놓으세요." },
  hi: { button: "गेम आयात करें", emptyHint: "“गेम आयात करें” चुनें या SWF / DCR फ़ाइलें विंडो में छोड़ें।" },
  ar: { button: "استيراد لعبة", emptyHint: "اختر «استيراد لعبة» أو أفلت ملفات SWF / DCR في النافذة." },
  ru: { button: "Импорт игры", emptyHint: "Выберите «Импорт игры» или перетащите файлы SWF / DCR в окно." },
};

export const aboutLinkLabels: Record<Language, { sourceCode: string; openRelease: string }> = {
  en: { sourceCode: "Source code", openRelease: "Open the {name} release page" },
  zh: { sourceCode: "源代码", openRelease: "打开 {name} 发布页面" },
  es: { sourceCode: "Código fuente", openRelease: "Abrir la página de la versión de {name}" },
  fr: { sourceCode: "Code source", openRelease: "Ouvrir la page de publication de {name}" },
  de: { sourceCode: "Quellcode", openRelease: "Veröffentlichungsseite von {name} öffnen" },
  "pt-BR": { sourceCode: "Código-fonte", openRelease: "Abrir a página de lançamento de {name}" },
  ja: { sourceCode: "ソースコード", openRelease: "{name} のリリースページを開く" },
  ko: { sourceCode: "소스 코드", openRelease: "{name} 릴리스 페이지 열기" },
  hi: { sourceCode: "स्रोत कोड", openRelease: "{name} का रिलीज़ पेज खोलें" },
  ar: { sourceCode: "الشيفرة المصدرية", openRelease: "فتح صفحة إصدار {name}" },
  ru: { sourceCode: "Исходный код", openRelease: "Открыть страницу выпуска {name}" },
};

export const updateLabels: Record<Language, { check: string; checking: string; availableToast: string; currentToast: string; failedToast: string; title: string; currentVersion: string; changelog: string; noChangelog: string; cancel: string; ok: string; openFailed: string }> = {
  en: { check: "Check for updates", checking: "Checking for updates...", availableToast: "Flash Royale {version} is available", currentToast: "Flash Royale is up to date", failedToast: "Could not check for updates", title: "Flash Royale {version} is available", currentVersion: "Current version: {version}", changelog: "Changelog", noChangelog: "No release notes were provided.", cancel: "Cancel", ok: "OK", openFailed: "Could not open the release page" },
  zh: { check: "检查更新", checking: "正在检查更新...", availableToast: "Flash Royale {version} 已发布", currentToast: "Flash Royale 已是最新版本", failedToast: "无法检查更新", title: "Flash Royale {version} 已发布", currentVersion: "当前版本：{version}", changelog: "更新日志", noChangelog: "未提供发行说明。", cancel: "取消", ok: "确定", openFailed: "无法打开发布页面" },
  es: { check: "Buscar actualizaciones", checking: "Buscando actualizaciones...", availableToast: "Flash Royale {version} está disponible", currentToast: "Flash Royale está actualizado", failedToast: "No se han podido buscar actualizaciones", title: "Flash Royale {version} está disponible", currentVersion: "Versión actual: {version}", changelog: "Registro de cambios", noChangelog: "No se han proporcionado notas de la versión.", cancel: "Cancelar", ok: "Aceptar", openFailed: "No se ha podido abrir la página de la versión" },
  fr: { check: "Rechercher des mises à jour", checking: "Recherche de mises à jour...", availableToast: "Flash Royale {version} est disponible", currentToast: "Flash Royale est à jour", failedToast: "Impossible de rechercher les mises à jour", title: "Flash Royale {version} est disponible", currentVersion: "Version actuelle : {version}", changelog: "Journal des modifications", noChangelog: "Aucune note de version n’a été fournie.", cancel: "Annuler", ok: "OK", openFailed: "Impossible d’ouvrir la page de publication" },
  de: { check: "Nach Updates suchen", checking: "Es wird nach Updates gesucht...", availableToast: "Flash Royale {version} ist verfügbar", currentToast: "Flash Royale ist auf dem neuesten Stand", failedToast: "Updates konnten nicht geprüft werden", title: "Flash Royale {version} ist verfügbar", currentVersion: "Aktuelle Version: {version}", changelog: "Änderungsprotokoll", noChangelog: "Es wurden keine Versionshinweise bereitgestellt.", cancel: "Abbrechen", ok: "OK", openFailed: "Veröffentlichungsseite konnte nicht geöffnet werden" },
  "pt-BR": { check: "Verificar atualizações", checking: "Verificando atualizações...", availableToast: "Flash Royale {version} está disponível", currentToast: "O Flash Royale está atualizado", failedToast: "Não foi possível verificar atualizações", title: "Flash Royale {version} está disponível", currentVersion: "Versão atual: {version}", changelog: "Registro de alterações", noChangelog: "Não foram fornecidas notas de versão.", cancel: "Cancelar", ok: "OK", openFailed: "Não foi possível abrir a página de lançamento" },
  ja: { check: "更新を確認", checking: "更新を確認中...", availableToast: "Flash Royale {version} が利用可能です", currentToast: "Flash Royale は最新です", failedToast: "更新を確認できませんでした", title: "Flash Royale {version} が利用可能です", currentVersion: "現在のバージョン：{version}", changelog: "変更履歴", noChangelog: "リリースノートは提供されていません。", cancel: "キャンセル", ok: "OK", openFailed: "リリースページを開けませんでした" },
  ko: { check: "업데이트 확인", checking: "업데이트 확인 중...", availableToast: "Flash Royale {version}을(를) 사용할 수 있습니다", currentToast: "Flash Royale이 최신 버전입니다", failedToast: "업데이트를 확인하지 못했습니다", title: "Flash Royale {version}을(를) 사용할 수 있습니다", currentVersion: "현재 버전: {version}", changelog: "변경 내역", noChangelog: "릴리스 노트가 제공되지 않았습니다.", cancel: "취소", ok: "확인", openFailed: "릴리스 페이지를 열지 못했습니다" },
  hi: { check: "अपडेट जाँचें", checking: "अपडेट जाँचे जा रहे हैं...", availableToast: "Flash Royale {version} उपलब्ध है", currentToast: "Flash Royale अप टू डेट है", failedToast: "अपडेट जाँचे नहीं जा सके", title: "Flash Royale {version} उपलब्ध है", currentVersion: "वर्तमान संस्करण: {version}", changelog: "बदलावों की सूची", noChangelog: "रिलीज़ नोट नहीं दिए गए हैं।", cancel: "रद्द करें", ok: "ठीक है", openFailed: "रिलीज़ पेज खोला नहीं जा सका" },
  ar: { check: "التحقق من وجود تحديثات", checking: "جارٍ التحقق من وجود تحديثات...", availableToast: "يتوفر Flash Royale {version}", currentToast: "Flash Royale محدّث", failedToast: "تعذّر التحقق من وجود تحديثات", title: "يتوفر Flash Royale {version}", currentVersion: "الإصدار الحالي: {version}", changelog: "سجل التغييرات", noChangelog: "لم تُقدَّم ملاحظات الإصدار.", cancel: "إلغاء", ok: "موافق", openFailed: "تعذّر فتح صفحة الإصدار" },
  ru: { check: "Проверить обновления", checking: "Проверка обновлений...", availableToast: "Доступен Flash Royale {version}", currentToast: "Flash Royale обновлён до последней версии", failedToast: "Не удалось проверить обновления", title: "Доступен Flash Royale {version}", currentVersion: "Текущая версия: {version}", changelog: "Список изменений", noChangelog: "Примечания к выпуску не предоставлены.", cancel: "Отмена", ok: "ОК", openFailed: "Не удалось открыть страницу выпуска" },
};

/** Title of the update window when a manual check finds no newer version; {version} is the latest release. */
export const updateCurrentTitles: Record<Language, string> = {
  en: "Flash Royale is up to date (latest version: {version})",
  zh: "Flash Royale 已是最新版本（最新版本：{version}）",
  es: "Flash Royale está actualizado (última versión: {version})",
  fr: "Flash Royale est à jour (dernière version : {version})",
  de: "Flash Royale ist aktuell (neueste Version: {version})",
  "pt-BR": "O Flash Royale está atualizado (versão mais recente: {version})",
  ja: "Flash Royale は最新です（最新バージョン：{version}）",
  ko: "Flash Royale이 최신 버전입니다(최신 버전: {version})",
  hi: "Flash Royale अप टू डेट है (नवीनतम संस्करण: {version})",
  ar: "Flash Royale محدّث (أحدث إصدار: {version})",
  ru: "Flash Royale обновлён (последняя версия: {version})",
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

export const updateScriptExecutionLabels: Record<Language, { label: string; hint: string }> = {
  en: { label: "Enable script execution (needed for auto update if blocked)", hint: "Allows the updater's PowerShell scripts to run without changing user or system policy. Organization policies may still block execution." },
  zh: { label: "启用脚本执行（自动更新被阻止时需要）", hint: "允许更新程序的 PowerShell 脚本运行，不更改用户或系统策略。组织策略仍可能阻止执行。" },
  es: { label: "Permitir la ejecución de scripts (necesaria si se bloquea la actualización automática)", hint: "Permite ejecutar los scripts de PowerShell del actualizador sin cambiar las directivas del usuario ni del sistema. Las directivas de la organización aún pueden impedir la ejecución." },
  fr: { label: "Autoriser l’exécution des scripts (nécessaire si la mise à jour automatique est bloquée)", hint: "Permet aux scripts PowerShell de l’outil de mise à jour de s’exécuter sans modifier les stratégies de l’utilisateur ou du système. Les stratégies de l’organisation peuvent toujours bloquer leur exécution." },
  de: { label: "Skriptausführung aktivieren (bei blockiertem automatischem Update erforderlich)", hint: "Ermöglicht die Ausführung der PowerShell-Skripte des Updaters, ohne Benutzer- oder Systemrichtlinien zu ändern. Organisationsrichtlinien können die Ausführung weiterhin blockieren." },
  "pt-BR": { label: "Permitir execução de scripts (necessário se a atualização automática for bloqueada)", hint: "Permite executar os scripts PowerShell do atualizador sem alterar as políticas do usuário ou do sistema. As políticas da organização ainda podem bloquear a execução." },
  ja: { label: "スクリプトの実行を有効化（自動更新がブロックされる場合に必要）", hint: "ユーザーやシステムのポリシーを変更せず、更新プログラムの PowerShell スクリプトを実行できるようにします。組織のポリシーによっては実行が引き続きブロックされます。" },
  ko: { label: "스크립트 실행 허용(자동 업데이트가 차단된 경우 필요)", hint: "사용자 또는 시스템 정책을 변경하지 않고 업데이트 도구의 PowerShell 스크립트를 실행하도록 허용합니다. 조직 정책에 따라 여전히 실행이 차단될 수 있습니다." },
  hi: { label: "स्क्रिप्ट चलाना चालू करें (स्वचालित अपडेट अवरुद्ध होने पर आवश्यक)", hint: "उपयोगकर्ता या सिस्टम की नीति बदले बिना अपडेटर की PowerShell स्क्रिप्ट चलाने देता है। संगठन की नीतियाँ फिर भी निष्पादन रोक सकती हैं।" },
  ar: { label: "تمكين تنفيذ البرامج النصية (مطلوب إذا حُظر التحديث التلقائي)", hint: "يسمح بتشغيل برامج PowerShell النصية الخاصة بالمحدّث دون تغيير سياسة المستخدم أو النظام. قد تظل سياسات المؤسسة تمنع التنفيذ." },
  ru: { label: "Разрешить выполнение скриптов (нужно, если автообновление заблокировано)", hint: "Разрешает запуск скриптов PowerShell средства обновления без изменения политик пользователя или системы. Политики организации по-прежнему могут блокировать выполнение." },
};

export const portableUpdateLabels: Record<Language, { install: string; busy: string; consent: string; warning: string; failed: string }> = {
  en: { install: "Install and restart", busy: "Downloading and verifying update...", consent: "Unblock the verified update files (remove Mark of the Web)", warning: "The app will close and restart. Your library is preserved. Close games and Explore first. Unblocking does not bypass Smart App Control or replace code signing.", failed: "Could not install the update" },
  zh: { install: "安装并重启", busy: "正在下载并验证更新...", consent: "解除已验证更新文件的阻止（移除 Mark of the Web）", warning: "应用将关闭并重启，游戏库会保留。请先关闭游戏和探索窗口。解除阻止不会绕过 Smart App Control，也不能替代代码签名。", failed: "无法安装更新" },
  es: { install: "Instalar y reiniciar", busy: "Descargando y verificando la actualización...", consent: "Desbloquear los archivos verificados de la actualización (quitar Mark of the Web)", warning: "La aplicación se cerrará y reiniciará. Tu biblioteca se conservará. Cierra primero los juegos y Explorar. El desbloqueo no elude Smart App Control ni sustituye la firma de código.", failed: "No se ha podido instalar la actualización" },
  fr: { install: "Installer et redémarrer", busy: "Téléchargement et vérification de la mise à jour...", consent: "Débloquer les fichiers vérifiés de la mise à jour (retirer Mark of the Web)", warning: "L’application va se fermer puis redémarrer. Votre bibliothèque sera conservée. Fermez d’abord les jeux et Explorer. Le déblocage ne contourne pas Smart App Control et ne remplace pas la signature du code.", failed: "Impossible d’installer la mise à jour" },
  de: { install: "Installieren und neu starten", busy: "Update wird heruntergeladen und überprüft...", consent: "Geprüfte Update-Dateien entsperren (Mark of the Web entfernen)", warning: "Die App wird geschlossen und neu gestartet. Deine Bibliothek bleibt erhalten. Schließe zuerst Spiele und Entdecken. Das Entsperren umgeht Smart App Control nicht und ersetzt keine Codesignatur.", failed: "Update konnte nicht installiert werden" },
  "pt-BR": { install: "Instalar e reiniciar", busy: "Baixando e verificando a atualização...", consent: "Desbloquear os arquivos verificados da atualização (remover Mark of the Web)", warning: "O aplicativo será fechado e reiniciado. Sua biblioteca será preservada. Feche os jogos e Explorar primeiro. O desbloqueio não ignora o Smart App Control nem substitui a assinatura de código.", failed: "Não foi possível instalar a atualização" },
  ja: { install: "インストールして再起動", busy: "更新をダウンロードして検証中...", consent: "検証済みの更新ファイルのブロックを解除（Mark of the Web を削除）", warning: "アプリを終了して再起動します。ライブラリは保持されます。先にゲームと探索ウィンドウを閉じてください。ブロックの解除は Smart App Control の回避やコード署名の代わりにはなりません。", failed: "更新をインストールできませんでした" },
  ko: { install: "설치 후 다시 시작", busy: "업데이트 다운로드 및 검증 중...", consent: "검증된 업데이트 파일 차단 해제(Mark of the Web 제거)", warning: "앱이 종료된 후 다시 시작됩니다. 라이브러리는 유지됩니다. 먼저 게임과 탐색 창을 닫으세요. 차단 해제는 Smart App Control을 우회하거나 코드 서명을 대체하지 않습니다.", failed: "업데이트를 설치하지 못했습니다" },
  hi: { install: "इंस्टॉल करें और फिर शुरू करें", busy: "अपडेट डाउनलोड और सत्यापित हो रहा है...", consent: "सत्यापित अपडेट फ़ाइलें अनब्लॉक करें (Mark of the Web हटाएँ)", warning: "ऐप बंद होकर फिर शुरू होगा। आपकी लाइब्रेरी सुरक्षित रहेगी। पहले गेम और खोजें विंडो बंद करें। अनब्लॉक करना Smart App Control को बायपास नहीं करता और न ही कोड साइनिंग की जगह लेता है।", failed: "अपडेट इंस्टॉल नहीं हो सका" },
  ar: { install: "التثبيت وإعادة التشغيل", busy: "جارٍ تنزيل التحديث والتحقق منه...", consent: "إلغاء حظر ملفات التحديث المتحقق منها (إزالة Mark of the Web)", warning: "سيُغلق التطبيق ويُعاد تشغيله. ستبقى مكتبتك محفوظة. أغلق الألعاب ونافذة الاستكشاف أولًا. إلغاء الحظر لا يتجاوز Smart App Control ولا يحل محل توقيع الشيفرة.", failed: "تعذّر تثبيت التحديث" },
  ru: { install: "Установить и перезапустить", busy: "Скачивание и проверка обновления...", consent: "Разблокировать проверенные файлы обновления (удалить Mark of the Web)", warning: "Приложение закроется и перезапустится. Библиотека сохранится. Сначала закройте игры и окно обзора. Разблокировка не обходит Smart App Control и не заменяет подпись кода.", failed: "Не удалось установить обновление" },
};

export const manualUpdateTitles: Record<Language, string> = {
  en: "Manual update:",
  zh: "手动更新：",
  es: "Actualización manual:",
  fr: "Mise à jour manuelle :",
  de: "Manuelles Update:",
  "pt-BR": "Atualização manual:",
  ja: "手動更新：",
  ko: "수동 업데이트:",
  hi: "मैन्युअल अपडेट:",
  ar: "التحديث اليدوي:",
  ru: "Обновление вручную:",
};

export const manualUpdateLabels: Record<Language, { openRelease: string; instructions: string }> = {
  en: { openRelease: "Open release page", instructions: " Open the release page and download the Windows ZIP archive. Make sure Flash Royal is closed and not in the notification area. Extract the archive into a temporary folder, then copy the all files into your current Flash Royale folder, replacing existing files. Keep your existing library and launch Flash Royale again." },
  zh: { openRelease: "打开发布页面", instructions: " 打开发布页面并下载 Windows ZIP 压缩包。确认 Flash Royal 已关闭且未留在通知区域。将压缩包解压到临时文件夹，再将所有文件复制到当前 Flash Royale 文件夹，替换现有文件。保留现有游戏库，然后重新启动 Flash Royale。" },
  es: { openRelease: "Abrir la página de la versión", instructions: " Abre la página de la versión y descarga el archivo ZIP para Windows. Asegúrate de que Flash Royal esté cerrado y no siga en el área de notificación. Extrae el archivo en una carpeta temporal y copia todos los archivos a tu carpeta actual de Flash Royale, reemplazando los existentes. Conserva tu biblioteca e inicia Flash Royale de nuevo." },
  fr: { openRelease: "Ouvrir la page de publication", instructions: " Ouvrez la page de publication et téléchargez l’archive ZIP pour Windows. Assurez-vous que Flash Royal est fermé et n’est plus dans la zone de notification. Extrayez l’archive dans un dossier temporaire, puis copiez tous les fichiers dans votre dossier Flash Royale actuel en remplaçant les fichiers existants. Conservez votre bibliothèque et relancez Flash Royale." },
  de: { openRelease: "Veröffentlichungsseite öffnen", instructions: " Öffne die Veröffentlichungsseite und lade das Windows-ZIP-Archiv herunter. Stelle sicher, dass Flash Royal geschlossen und nicht im Infobereich aktiv ist. Entpacke das Archiv in einen temporären Ordner und kopiere dann alle Dateien in deinen aktuellen Flash-Royale-Ordner. Ersetze dabei vorhandene Dateien. Behalte deine Bibliothek und starte Flash Royale erneut." },
  "pt-BR": { openRelease: "Abrir a página de lançamento", instructions: " Abra a página de lançamento e baixe o arquivo ZIP para Windows. Verifique se o Flash Royal está fechado e não permanece na área de notificação. Extraia o arquivo em uma pasta temporária e copie todos os arquivos para a pasta atual do Flash Royale, substituindo os existentes. Mantenha sua biblioteca e abra o Flash Royale novamente." },
  ja: { openRelease: "リリースページを開く", instructions: " リリースページを開き、Windows 用の ZIP アーカイブをダウンロードしてください。Flash Royal が終了し、通知領域にも残っていないことを確認してください。アーカイブを一時フォルダーに展開し、すべてのファイルを現在の Flash Royale フォルダーにコピーして既存のファイルを置き換えます。既存のライブラリは残して、Flash Royale を再起動してください。" },
  ko: { openRelease: "릴리스 페이지 열기", instructions: " 릴리스 페이지를 열고 Windows용 ZIP 압축 파일을 다운로드하세요. Flash Royal이 종료되었고 알림 영역에도 남아 있지 않은지 확인하세요. 임시 폴더에 압축을 푼 다음 모든 파일을 현재 Flash Royale 폴더에 복사하여 기존 파일을 덮어쓰세요. 기존 라이브러리를 유지하고 Flash Royale을 다시 실행하세요." },
  hi: { openRelease: "रिलीज़ पेज खोलें", instructions: " रिलीज़ पेज खोलें और Windows ZIP आर्काइव डाउनलोड करें। सुनिश्चित करें कि Flash Royal बंद है और सूचना क्षेत्र में भी नहीं है। आर्काइव को अस्थायी फ़ोल्डर में निकालें, फिर सभी फ़ाइलें अपने मौजूदा Flash Royale फ़ोल्डर में कॉपी करें और पुरानी फ़ाइलें बदलें। अपनी मौजूदा लाइब्रेरी बनाए रखें और Flash Royale फिर चलाएँ।" },
  ar: { openRelease: "فتح صفحة الإصدار", instructions: " افتح صفحة الإصدار ونزّل أرشيف ZIP الخاص بـ Windows. تأكد من إغلاق Flash Royal وعدم بقائه في منطقة الإعلام. استخرج الأرشيف إلى مجلد مؤقت، ثم انسخ جميع الملفات إلى مجلد Flash Royale الحالي مع استبدال الملفات الموجودة. احتفظ بمكتبتك الحالية ثم شغّل Flash Royale مجددًا." },
  ru: { openRelease: "Открыть страницу выпуска", instructions: " Откройте страницу выпуска и скачайте ZIP-архив для Windows. Убедитесь, что Flash Royal закрыт и не остаётся в области уведомлений. Распакуйте архив во временную папку, затем скопируйте все файлы в текущую папку Flash Royale с заменой существующих. Сохраните свою библиотеку и снова запустите Flash Royale." },
};

export const unblockUpdateDescriptions: Record<Language, string> = {
  en: "Windows can mark files downloaded from the internet with a security marker called Mark of the Web, which may trigger warnings or block them from running. This option removes that marker only from the verified update files. It does not turn off Windows security or guarantee that the app can run.",
  zh: "Windows 可能为从互联网下载的文件添加名为 Mark of the Web 的安全标记，导致警告或阻止运行。此选项仅移除已验证更新文件中的该标记，不会关闭 Windows 安全功能，也不保证应用能够运行。",
  es: "Windows puede añadir a los archivos descargados de Internet una marca de seguridad llamada Mark of the Web, que puede mostrar advertencias o impedir su ejecución. Esta opción quita esa marca solo de los archivos verificados de la actualización. No desactiva la seguridad de Windows ni garantiza que la aplicación pueda ejecutarse.",
  fr: "Windows peut appliquer aux fichiers téléchargés sur Internet un marqueur de sécurité nommé Mark of the Web, susceptible de déclencher des avertissements ou de bloquer leur exécution. Cette option retire ce marqueur uniquement des fichiers vérifiés de la mise à jour. Elle ne désactive pas la sécurité de Windows et ne garantit pas que l’application pourra s’exécuter.",
  de: "Windows kann aus dem Internet heruntergeladene Dateien mit der Sicherheitsmarkierung Mark of the Web versehen. Diese kann Warnungen auslösen oder die Ausführung blockieren. Diese Option entfernt die Markierung nur von den geprüften Update-Dateien. Sie deaktiviert weder die Windows-Sicherheit noch garantiert sie, dass die App ausgeführt werden kann.",
  "pt-BR": "O Windows pode aplicar aos arquivos baixados da internet um marcador de segurança chamado Mark of the Web, que pode gerar avisos ou impedir a execução. Esta opção remove esse marcador apenas dos arquivos verificados da atualização. Ela não desativa a segurança do Windows nem garante que o aplicativo possa ser executado.",
  ja: "Windows はインターネットからダウンロードしたファイルに Mark of the Web というセキュリティマーカーを付ける場合があり、警告や実行のブロックにつながることがあります。このオプションは検証済みの更新ファイルからのみマーカーを削除します。Windows のセキュリティを無効にするものではなく、アプリの実行を保証するものでもありません。",
  ko: "Windows는 인터넷에서 다운로드한 파일에 Mark of the Web이라는 보안 표시를 붙일 수 있으며, 이로 인해 경고가 표시되거나 실행이 차단될 수 있습니다. 이 옵션은 검증된 업데이트 파일에서만 해당 표시를 제거합니다. Windows 보안을 끄거나 앱 실행을 보장하지 않습니다.",
  hi: "Windows इंटरनेट से डाउनलोड की गई फ़ाइलों पर Mark of the Web नाम का सुरक्षा चिह्न लगा सकता है, जिससे चेतावनियाँ आ सकती हैं या उनका चलना रुक सकता है। यह विकल्प केवल सत्यापित अपडेट फ़ाइलों से वह चिह्न हटाता है। यह Windows सुरक्षा बंद नहीं करता और ऐप चलने की गारंटी नहीं देता।",
  ar: "قد يضع Windows على الملفات المنزّلة من الإنترنت علامة أمان تسمى Mark of the Web، وقد تؤدي إلى ظهور تحذيرات أو منع التشغيل. يزيل هذا الخيار العلامة من ملفات التحديث المتحقق منها فقط. ولا يعطّل أمان Windows ولا يضمن إمكانية تشغيل التطبيق.",
  ru: "Windows может помечать скачанные из интернета файлы меткой безопасности Mark of the Web, вызывающей предупреждения или блокировку запуска. Этот параметр удаляет метку только из проверенных файлов обновления. Он не отключает защиту Windows и не гарантирует запуск приложения.",
};

export const showOnlineOnlyGamesLabels: Record<Language, string> = {
  en: "Show online-only games",
  zh: "显示仅限联网的游戏",
  es: "Mostrar juegos solo en línea",
  fr: "Afficher les jeux uniquement en ligne",
  de: "Reine Online-Spiele anzeigen",
  "pt-BR": "Mostrar jogos somente online",
  ja: "オンライン専用ゲームを表示",
  ko: "온라인 전용 게임 표시",
  hi: "केवल ऑनलाइन वाले गेम दिखाएँ",
  ar: "إظهار الألعاب المتاحة عبر الإنترنت فقط",
  ru: "Показывать игры только для онлайна",
};

export const y8CategoryRequiredLabels: Record<Language, string> = {
  en: "Select a specific category to use this setting.",
  zh: "选择具体分类后才能使用此设置。",
  es: "Selecciona una categoría concreta para usar este ajuste.",
  fr: "Sélectionnez une catégorie précise pour utiliser ce paramètre.",
  de: "Wähle eine bestimmte Kategorie, um diese Einstellung zu verwenden.",
  "pt-BR": "Selecione uma categoria específica para usar esta configuração.",
  ja: "この設定を使うには、特定のカテゴリを選択してください。",
  ko: "이 설정을 사용하려면 특정 카테고리를 선택하세요.",
  hi: "यह सेटिंग इस्तेमाल करने के लिए कोई विशिष्ट श्रेणी चुनें।",
  ar: "اختر فئة محددة لاستخدام هذا الإعداد.",
  ru: "Выберите конкретную категорию, чтобы использовать этот параметр.",
};

export const exploreFilterLabels: Record<Language, { categories: string; allCategories: string; noMatches: string }> = {
  en: { categories: "Category", allCategories: "All categories", noMatches: "No games on this page match the selected filters." },
  zh: { categories: "分类", allCategories: "所有分类", noMatches: "此页没有符合所选筛选条件的游戏。" },
  es: { categories: "Categoría", allCategories: "Todas las categorías", noMatches: "Ningún juego de esta página coincide con los filtros seleccionados." },
  fr: { categories: "Catégorie", allCategories: "Toutes les catégories", noMatches: "Aucun jeu de cette page ne correspond aux filtres sélectionnés." },
  de: { categories: "Kategorie", allCategories: "Alle Kategorien", noMatches: "Auf dieser Seite entsprechen keine Spiele den ausgewählten Filtern." },
  "pt-BR": { categories: "Categoria", allCategories: "Todas as categorias", noMatches: "Nenhum jogo nesta página corresponde aos filtros selecionados." },
  ja: { categories: "カテゴリ", allCategories: "すべてのカテゴリ", noMatches: "このページには、選択したフィルターに一致するゲームがありません。" },
  ko: { categories: "카테고리", allCategories: "모든 카테고리", noMatches: "이 페이지에는 선택한 필터와 일치하는 게임이 없습니다." },
  hi: { categories: "श्रेणी", allCategories: "सभी श्रेणियाँ", noMatches: "इस पेज पर चुने गए फ़िल्टर से मेल खाने वाला कोई गेम नहीं है।" },
  ar: { categories: "الفئة", allCategories: "كل الفئات", noMatches: "لا توجد ألعاب في هذه الصفحة تطابق عوامل التصفية المحددة." },
  ru: { categories: "Категория", allCategories: "Все категории", noMatches: "На этой странице нет игр, соответствующих выбранным фильтрам." },
};

export const exploreRefreshLabels: Record<Language, { refresh: string; wait: string }> = {
  en: { refresh: "Refresh games", wait: "Refresh available in {seconds}s" },
  zh: { refresh: "刷新游戏", wait: "{seconds} 秒后可刷新" },
  es: { refresh: "Actualizar juegos", wait: "Podrás actualizar en {seconds}s" },
  fr: { refresh: "Actualiser les jeux", wait: "Actualisation possible dans {seconds}s" },
  de: { refresh: "Spiele aktualisieren", wait: "Aktualisierung in {seconds}s verfügbar" },
  "pt-BR": { refresh: "Atualizar jogos", wait: "Atualização disponível em {seconds}s" },
  ja: { refresh: "ゲーム一覧を更新", wait: "{seconds}秒後に更新できます" },
  ko: { refresh: "게임 목록 새로 고침", wait: "{seconds}초 후 새로 고침 가능" },
  hi: { refresh: "गेम सूची रीफ़्रेश करें", wait: "{seconds} सेकंड में रीफ़्रेश कर सकते हैं" },
  ar: { refresh: "تحديث الألعاب", wait: "يتاح التحديث بعد {seconds}ث" },
  ru: { refresh: "Обновить список игр", wait: "Обновление доступно через {seconds}с" },
};

export const gameCardTagLimitLabels: Record<Language, { title: string; all: string; hint: string }> = {
  en: { title: "Max number of tags in game cards", all: "All", hint: "Most used tags first, the rest are grouped in +N." },
  zh: { title: "游戏卡片的最大标签数", all: "全部", hint: "优先显示最常用的标签，其余归入 +N。" },
  es: { title: "Número máximo de etiquetas en las tarjetas de juego", all: "Todas", hint: "Las etiquetas más usadas aparecen primero, el resto se agrupa en +N." },
  fr: { title: "Nombre maximal d'étiquettes sur les fiches de jeu", all: "Toutes", hint: "Les étiquettes les plus utilisées apparaissent d’abord, les autres sont regroupées sous +N." },
  de: { title: "Maximale Anzahl von Tags auf Spielkarten", all: "Alle", hint: "Die häufigsten Tags stehen zuerst, die übrigen werden unter +N zusammengefasst." },
  "pt-BR": { title: "Número máximo de tags nos cartões de jogos", all: "Todas", hint: "As tags mais usadas aparecem primeiro, as demais são agrupadas em +N." },
  ja: { title: "ゲームカードの最大タグ数", all: "すべて", hint: "よく使われるタグを先に表示し、残りは +N にまとめます。" },
  ko: { title: "게임 카드의 최대 태그 수", all: "모두", hint: "가장 많이 쓰이는 태그를 먼저 표시하고 나머지는 +N으로 묶습니다." },
  hi: { title: "गेम कार्ड में टैग की अधिकतम संख्या", all: "सभी", hint: "सबसे अधिक इस्तेमाल होने वाले टैग पहले दिखते हैं, बाकी +N में समूहित होते हैं।" },
  ar: { title: "الحد الأقصى لعدد الوسوم في بطاقات الألعاب", all: "الكل", hint: "تظهر الوسوم الأكثر استخدامًا أولًا، وتُجمع البقية في +N." },
  ru: { title: "Максимальное число тегов на карточках игр", all: "Все", hint: "Сначала идут самые частые теги, остальные объединяются в +N." },
};

export const andkonSettingsLabels: Record<Language, { enable: string; warning: string }> = {
  en: { enable: "Enable Andkon.com catalogue", warning: "Low compatibility, many games are domain-locked." },
  zh: { enable: "启用 Andkon.com 目录", warning: "兼容性较低，许多游戏被限制在指定域名运行。" },
  es: { enable: "Activar el catálogo de Andkon.com", warning: "Compatibilidad baja: muchos juegos están restringidos a un dominio." },
  fr: { enable: "Activer le catalogue Andkon.com", warning: "Compatibilité faible : de nombreux jeux sont limités à un domaine." },
  de: { enable: "Andkon.com-Katalog aktivieren", warning: "Geringe Kompatibilität: Viele Spiele sind an eine Domain gebunden." },
  "pt-BR": { enable: "Ativar catálogo do Andkon.com", warning: "Baixa compatibilidade: muitos jogos são restritos a um domínio." },
  ja: { enable: "Andkon.com のカタログを有効化", warning: "互換性が低く、多くのゲームは特定のドメインに制限されています。" },
  ko: { enable: "Andkon.com 카탈로그 사용", warning: "호환성이 낮습니다. 많은 게임이 특정 도메인에서만 실행되도록 제한되어 있습니다." },
  hi: { enable: "Andkon.com कैटलॉग चालू करें", warning: "अनुकूलता कम है, कई गेम किसी विशेष डोमेन तक सीमित हैं।" },
  ar: { enable: "تمكين كتالوج Andkon.com", warning: "توافق منخفض، كثير من الألعاب مقيّدة بنطاق محدد." },
  ru: { enable: "Включить каталог Andkon.com", warning: "Низкая совместимость: многие игры привязаны к домену." },
};

export const silvergamesAddedDateLabels: Record<Language, string> = {
  en: "Added to SilverGames",
  zh: "添加至 SilverGames 的日期",
  es: "Añadido a SilverGames",
  fr: "Ajouté à SilverGames",
  de: "Zu SilverGames hinzugefügt",
  "pt-BR": "Adicionado ao SilverGames",
  ja: "SilverGames への追加日",
  ko: "SilverGames에 추가됨",
  hi: "SilverGames पर जोड़ा गया",
  ar: "أُضيفت إلى SilverGames",
  ru: "Добавлено на SilverGames",
};

export const andkonMetadataLabels: Record<Language, { added: string; author: string }> = {
  en: { added: "Added to Andkon", author: "Author" },
  zh: { added: "添加至 Andkon 的日期", author: "作者" },
  es: { added: "Añadido a Andkon", author: "Autor" },
  fr: { added: "Ajouté à Andkon", author: "Auteur" },
  de: { added: "Zu Andkon hinzugefügt", author: "Autor" },
  "pt-BR": { added: "Adicionado ao Andkon", author: "Autor" },
  ja: { added: "Andkon への追加日", author: "作者" },
  ko: { added: "Andkon에 추가됨", author: "제작자" },
  hi: { added: "Andkon पर जोड़ा गया", author: "लेखक" },
  ar: { added: "أُضيفت إلى Andkon", author: "المؤلف" },
  ru: { added: "Добавлено на Andkon", author: "Автор" },
};

export const y8MetadataLabels: Record<Language, { likes: string; added: string; onlineOnly: string; addOnlineOnly: string }> = {
  en: { likes: "Likes", added: "Added to Y8", onlineOnly: "Online only", addOnlineOnly: "Add online-only game" },
  zh: { likes: "赞", added: "添加至 Y8 的日期", onlineOnly: "仅限联网", addOnlineOnly: "添加仅限联网的游戏" },
  es: { likes: "Me gusta", added: "Añadido a Y8", onlineOnly: "Solo en línea", addOnlineOnly: "Añadir juego solo en línea" },
  fr: { likes: "Mentions J’aime", added: "Ajouté à Y8", onlineOnly: "En ligne uniquement", addOnlineOnly: "Ajouter un jeu uniquement en ligne" },
  de: { likes: "Gefällt mir", added: "Zu Y8 hinzugefügt", onlineOnly: "Nur online", addOnlineOnly: "Reines Online-Spiel hinzufügen" },
  "pt-BR": { likes: "Curtidas", added: "Adicionado ao Y8", onlineOnly: "Somente online", addOnlineOnly: "Adicionar jogo somente online" },
  ja: { likes: "いいね", added: "Y8 への追加日", onlineOnly: "オンライン専用", addOnlineOnly: "オンライン専用ゲームを追加" },
  ko: { likes: "좋아요", added: "Y8에 추가됨", onlineOnly: "온라인 전용", addOnlineOnly: "온라인 전용 게임 추가" },
  hi: { likes: "पसंद", added: "Y8 पर जोड़ा गया", onlineOnly: "केवल ऑनलाइन", addOnlineOnly: "केवल ऑनलाइन वाला गेम जोड़ें" },
  ar: { likes: "الإعجابات", added: "أُضيفت إلى Y8", onlineOnly: "عبر الإنترنت فقط", addOnlineOnly: "إضافة لعبة متاحة عبر الإنترنت فقط" },
  ru: { likes: "Отметки «Нравится»", added: "Добавлено на Y8", onlineOnly: "Только онлайн", addOnlineOnly: "Добавить игру только для онлайна" },
};

export const startupUpdateCheckLabels: Record<Language, string> = {
  en: "Check for updates on app start",
  zh: "应用启动时检查更新",
  es: "Buscar actualizaciones al iniciar la aplicación",
  fr: "Rechercher des mises à jour au démarrage",
  de: "Beim App-Start nach Updates suchen",
  "pt-BR": "Verificar atualizações ao iniciar o aplicativo",
  ja: "アプリ起動時に更新を確認",
  ko: "앱 시작 시 업데이트 확인",
  hi: "ऐप शुरू होने पर अपडेट जाँचें",
  ar: "التحقق من التحديثات عند بدء التطبيق",
  ru: "Проверять обновления при запуске приложения",
};

export const windowControlLabels: Record<Language, { minimize: string; maximize: string; restore: string; close: string }> = {
  en: { minimize: "Minimize", maximize: "Maximize", restore: "Restore down", close: "Close" },
  zh: { minimize: "最小化", maximize: "最大化", restore: "还原窗口", close: "关闭" },
  es: { minimize: "Minimizar", maximize: "Maximizar", restore: "Restaurar tamaño", close: "Cerrar" },
  fr: { minimize: "Réduire", maximize: "Agrandir", restore: "Restaurer la taille", close: "Fermer" },
  de: { minimize: "Minimieren", maximize: "Maximieren", restore: "Verkleinern", close: "Schließen" },
  "pt-BR": { minimize: "Minimizar", maximize: "Maximizar", restore: "Restaurar tamanho", close: "Fechar" },
  ja: { minimize: "最小化", maximize: "最大化", restore: "元のサイズに戻す", close: "閉じる" },
  ko: { minimize: "최소화", maximize: "최대화", restore: "이전 크기로 복원", close: "닫기" },
  hi: { minimize: "छोटा करें", maximize: "बड़ा करें", restore: "पिछले आकार में लाएँ", close: "बंद करें" },
  ar: { minimize: "تصغير", maximize: "تكبير", restore: "استعادة الحجم السابق", close: "إغلاق" },
  ru: { minimize: "Свернуть", maximize: "Развернуть", restore: "Восстановить размер", close: "Закрыть" },
};

export const generalSettingsLabels: Record<Language, { general: string; startInFullscreen: string; minimizeToTrayOnGameLaunch: string; minimizeToTrayOnMinimize: string; nextLaunch: string }> = {
  en: { general: "General", startInFullscreen: "Start app in fullscreen", minimizeToTrayOnGameLaunch: "Minimize to notification area on game launch", minimizeToTrayOnMinimize: "Minimize main window to notification area", nextLaunch: "Fullscreen takes effect the next time the app starts." },
  zh: { general: "常规", startInFullscreen: "以全屏启动应用", minimizeToTrayOnGameLaunch: "启动游戏时最小化至通知区域", minimizeToTrayOnMinimize: "将主窗口最小化至通知区域", nextLaunch: "全屏设置将在下次启动应用时生效。" },
  es: { general: "General", startInFullscreen: "Iniciar la aplicación en pantalla completa", minimizeToTrayOnGameLaunch: "Minimizar al área de notificación al iniciar un juego", minimizeToTrayOnMinimize: "Minimizar la ventana principal al área de notificación", nextLaunch: "La pantalla completa se aplicará la próxima vez que se inicie la aplicación." },
  fr: { general: "Général", startInFullscreen: "Démarrer l’application en plein écran", minimizeToTrayOnGameLaunch: "Réduire dans la zone de notification au lancement d’un jeu", minimizeToTrayOnMinimize: "Réduire la fenêtre principale dans la zone de notification", nextLaunch: "Le plein écran prendra effet au prochain démarrage de l’application." },
  de: { general: "Allgemein", startInFullscreen: "App im Vollbild starten", minimizeToTrayOnGameLaunch: "Beim Spielstart in den Infobereich minimieren", minimizeToTrayOnMinimize: "Hauptfenster in den Infobereich minimieren", nextLaunch: "Vollbild wird beim nächsten Start der App wirksam." },
  "pt-BR": { general: "Geral", startInFullscreen: "Iniciar aplicativo em tela cheia", minimizeToTrayOnGameLaunch: "Minimizar para a área de notificação ao iniciar um jogo", minimizeToTrayOnMinimize: "Minimizar janela principal para a área de notificação", nextLaunch: "A tela cheia terá efeito na próxima inicialização do aplicativo." },
  ja: { general: "全般", startInFullscreen: "アプリを全画面で起動", minimizeToTrayOnGameLaunch: "ゲーム起動時に通知領域へ最小化", minimizeToTrayOnMinimize: "メインウィンドウを通知領域へ最小化", nextLaunch: "全画面設定は、次回のアプリ起動時に適用されます。" },
  ko: { general: "일반", startInFullscreen: "앱을 전체 화면으로 시작", minimizeToTrayOnGameLaunch: "게임 시작 시 알림 영역으로 최소화", minimizeToTrayOnMinimize: "기본 창을 알림 영역으로 최소화", nextLaunch: "전체 화면 설정은 다음 앱 시작 시 적용됩니다." },
  hi: { general: "सामान्य", startInFullscreen: "ऐप फ़ुलस्क्रीन में शुरू करें", minimizeToTrayOnGameLaunch: "गेम शुरू होने पर सूचना क्षेत्र में छोटा करें", minimizeToTrayOnMinimize: "मुख्य विंडो को सूचना क्षेत्र में छोटा करें", nextLaunch: "फ़ुलस्क्रीन सेटिंग ऐप अगली बार शुरू होने पर लागू होगी।" },
  ar: { general: "عام", startInFullscreen: "بدء التطبيق بملء الشاشة", minimizeToTrayOnGameLaunch: "التصغير إلى منطقة الإعلام عند بدء لعبة", minimizeToTrayOnMinimize: "تصغير النافذة الرئيسية إلى منطقة الإعلام", nextLaunch: "يسري إعداد ملء الشاشة عند تشغيل التطبيق في المرة القادمة." },
  ru: { general: "Общие", startInFullscreen: "Запускать приложение на весь экран", minimizeToTrayOnGameLaunch: "Сворачивать в область уведомлений при запуске игры", minimizeToTrayOnMinimize: "Сворачивать главное окно в область уведомлений", nextLaunch: "Полноэкранный режим вступит в силу при следующем запуске приложения." },
};

export const manualImportLabels: Record<Language, { enable: string; disabled: string }> = {
  en: { enable: "Enable manual game import", disabled: "Manual game import is disabled in Settings." },
  zh: { enable: "启用手动导入游戏", disabled: "已在设置中禁用手动导入游戏。" },
  es: { enable: "Activar la importación manual de juegos", disabled: "La importación manual de juegos está desactivada en Ajustes." },
  fr: { enable: "Activer l'importation manuelle de jeux", disabled: "L’importation manuelle de jeux est désactivée dans les paramètres." },
  de: { enable: "Manuellen Spielimport aktivieren", disabled: "Der manuelle Spielimport ist in den Einstellungen deaktiviert." },
  "pt-BR": { enable: "Ativar importação manual de jogos", disabled: "A importação manual de jogos está desativada nas configurações." },
  ja: { enable: "ゲームの手動インポートを有効化", disabled: "設定でゲームの手動インポートが無効になっています。" },
  ko: { enable: "게임 수동 가져오기 사용", disabled: "설정에서 게임 수동 가져오기가 비활성화되어 있습니다." },
  hi: { enable: "गेम का मैन्युअल आयात चालू करें", disabled: "सेटिंग्स में गेम का मैन्युअल आयात बंद है।" },
  ar: { enable: "تمكين الاستيراد اليدوي للألعاب", disabled: "استيراد الألعاب يدويًا معطّل في الإعدادات." },
  ru: { enable: "Включить ручной импорт игр", disabled: "Ручной импорт игр отключён в настройках." },
};

export const exploreSettingsLabels: Record<Language, { enable: string; disabled: string; offline: string; checking: string; open: string; button: string }> = {
  en: { enable: "Enable explore catalogs (requires internet)", disabled: "Explore is disabled in settings", offline: "Explore unavailable: no internet connection", checking: "Checking internet connection", open: "Explore Flash games", button: "Explore" },
  zh: { enable: "启用探索目录（需要联网）", disabled: "探索已在设置中禁用", offline: "探索不可用：没有互联网连接", checking: "正在检查互联网连接", open: "探索 Flash 游戏", button: "探索" },
  es: { enable: "Activar catálogos de Explorar (requiere Internet)", disabled: "Explorar está desactivado en la configuración", offline: "Explorar no está disponible: sin conexión a Internet", checking: "Comprobando la conexión a Internet", open: "Explorar juegos Flash", button: "Explorar" },
  fr: { enable: "Activer les catalogues Explorer (connexion Internet requise)", disabled: "Explorer est désactivé dans les paramètres", offline: "Explorer indisponible : aucune connexion Internet", checking: "Vérification de la connexion Internet", open: "Explorer les jeux Flash", button: "Explorer" },
  de: { enable: "Entdecken-Kataloge aktivieren (Internet erforderlich)", disabled: "Entdecken ist in den Einstellungen deaktiviert", offline: "Entdecken nicht verfügbar: keine Internetverbindung", checking: "Internetverbindung wird geprüft", open: "Flash-Spiele entdecken", button: "Entdecken" },
  "pt-BR": { enable: "Ativar catálogos do Explorar (requer internet)", disabled: "Explorar está desativado nas configurações", offline: "Explorar indisponível: sem conexão com a internet", checking: "Verificando conexão com a internet", open: "Explorar jogos Flash", button: "Explorar" },
  ja: { enable: "探索カタログを有効化（インターネット接続が必要）", disabled: "探索は設定で無効になっています", offline: "探索を利用できません：インターネット接続がありません", checking: "インターネット接続を確認中", open: "Flash ゲームを探索", button: "探索" },
  ko: { enable: "탐색 카탈로그 사용(인터넷 연결 필요)", disabled: "설정에서 탐색이 비활성화되어 있습니다", offline: "탐색 사용 불가: 인터넷 연결 없음", checking: "인터넷 연결 확인 중", open: "Flash 게임 탐색", button: "탐색" },
  hi: { enable: "खोजें कैटलॉग चालू करें (इंटरनेट आवश्यक)", disabled: "सेटिंग में खोजें बंद है", offline: "खोजें उपलब्ध नहीं: इंटरनेट कनेक्शन नहीं है", checking: "इंटरनेट कनेक्शन जाँचा जा रहा है", open: "Flash गेम खोजें", button: "खोजें" },
  ar: { enable: "تمكين كتالوجات الاستكشاف (يتطلب الإنترنت)", disabled: "الاستكشاف معطّل في الإعدادات", offline: "الاستكشاف غير متاح: لا يوجد اتصال بالإنترنت", checking: "جارٍ التحقق من الاتصال بالإنترنت", open: "استكشاف ألعاب Flash", button: "استكشاف" },
  ru: { enable: "Включить каталоги обзора (нужен интернет)", disabled: "Обзор отключён в настройках", offline: "Обзор недоступен: нет подключения к интернету", checking: "Проверка подключения к интернету", open: "Обзор Flash-игр", button: "Обзор" },
};

export const libraryPathLabels: Record<Language, { enable: string; description: string }> = {
  en: { enable: "Enable library path visibility", description: "Show the library folder path in the library toolbar." },
  zh: { enable: "显示游戏库路径", description: "在游戏库工具栏中显示游戏库文件夹路径。" },
  es: { enable: "Activar la visibilidad de la ruta de la biblioteca", description: "Muestra la ruta de la carpeta de la biblioteca en su barra de herramientas." },
  fr: { enable: "Activer la visibilité du chemin de la bibliothèque", description: "Affiche le chemin du dossier de la bibliothèque dans sa barre d'outils." },
  de: { enable: "Bibliothekspfad anzeigen", description: "Zeigt den Bibliotheksordner in der Bibliotheksleiste an." },
  "pt-BR": { enable: "Ativar visibilidade do caminho da biblioteca", description: "Mostra o caminho da pasta da biblioteca na barra de ferramentas." },
  ja: { enable: "ライブラリパスの表示を有効化", description: "ライブラリのツールバーにフォルダーのパスを表示します。" },
  ko: { enable: "라이브러리 경로 표시 사용", description: "라이브러리 도구 모음에 라이브러리 폴더 경로를 표시합니다." },
  hi: { enable: "लाइब्रेरी पथ की दृश्यता चालू करें", description: "लाइब्रेरी टूलबार में लाइब्रेरी फ़ोल्डर का पथ दिखाएँ।" },
  ar: { enable: "تمكين عرض مسار المكتبة", description: "يعرض مسار مجلد المكتبة في شريط أدوات المكتبة." },
  ru: { enable: "Включить отображение пути к библиотеке", description: "Показывает путь к папке библиотеки на панели инструментов." },
};

export const sourceMetadataLabels: Record<Language, { description: string; instructionsControls: string; authorInfo: string; gameDetails: string; rating: string; votes: string; ageRating: string; uploadDate: string; version: string; swfVersion: string; dimensions: string; frameRate: string; fileSize: string; openGameFolder: string; noTags: string; noCategories: string; showMore: string; showLess: string }> = {
  en: { description: "Description", instructionsControls: "Instructions & Controls", authorInfo: "Author Info", gameDetails: "Game Details", rating: "Silvergames rating", votes: "votes", ageRating: "Age rating", uploadDate: "Upload date", version: "Version", swfVersion: "SWF version", dimensions: "Dimensions", frameRate: "Frame rate", fileSize: "File size", openGameFolder: "Open the game folder for {title}", noTags: "No tags", noCategories: "No categories", showMore: "Show more", showLess: "Show less" },
  zh: { description: "简介", instructionsControls: "玩法与操作", authorInfo: "作者信息", gameDetails: "游戏详情", rating: "Silvergames 评分", votes: "票", ageRating: "年龄分级", uploadDate: "上传日期", version: "版本", swfVersion: "SWF 版本", dimensions: "尺寸", frameRate: "帧率", fileSize: "文件大小", openGameFolder: "打开 {title} 的游戏文件夹", noTags: "没有标签", noCategories: "没有分类", showMore: "展开更多", showLess: "收起" },
  es: { description: "Descripción", instructionsControls: "Instrucciones y controles", authorInfo: "Información del autor", gameDetails: "Detalles del juego", rating: "Valoración de Silvergames", votes: "votos", ageRating: "Clasificación por edad", uploadDate: "Fecha de subida", version: "Versión", swfVersion: "Versión de SWF", dimensions: "Dimensiones", frameRate: "Tasa de fotogramas", fileSize: "Tamaño del archivo", openGameFolder: "Abrir la carpeta del juego {title}", noTags: "Sin etiquetas", noCategories: "Sin categorías", showMore: "Mostrar más", showLess: "Mostrar menos" },
  fr: { description: "Description", instructionsControls: "Instructions et commandes", authorInfo: "Informations sur l’auteur", gameDetails: "Détails du jeu", rating: "Note Silvergames", votes: "votes", ageRating: "Classification par âge", uploadDate: "Date de mise en ligne", version: "Version", swfVersion: "Version SWF", dimensions: "Dimensions", frameRate: "Fréquence d’images", fileSize: "Taille du fichier", openGameFolder: "Ouvrir le dossier du jeu {title}", noTags: "Aucune étiquette", noCategories: "Aucune catégorie", showMore: "Afficher plus", showLess: "Afficher moins" },
  de: { description: "Beschreibung", instructionsControls: "Anleitung und Steuerung", authorInfo: "Angaben zum Autor", gameDetails: "Spieldetails", rating: "Silvergames-Bewertung", votes: "Stimmen", ageRating: "Altersfreigabe", uploadDate: "Upload-Datum", version: "Version", swfVersion: "SWF-Version", dimensions: "Abmessungen", frameRate: "Bildrate", fileSize: "Dateigröße", openGameFolder: "Spielordner für {title} öffnen", noTags: "Keine Tags", noCategories: "Keine Kategorien", showMore: "Mehr anzeigen", showLess: "Weniger anzeigen" },
  "pt-BR": { description: "Descrição", instructionsControls: "Instruções e controles", authorInfo: "Informações do autor", gameDetails: "Detalhes do jogo", rating: "Avaliação do Silvergames", votes: "votos", ageRating: "Classificação etária", uploadDate: "Data de envio", version: "Versão", swfVersion: "Versão do SWF", dimensions: "Dimensões", frameRate: "Taxa de quadros", fileSize: "Tamanho do arquivo", openGameFolder: "Abrir a pasta do jogo {title}", noTags: "Sem tags", noCategories: "Sem categorias", showMore: "Mostrar mais", showLess: "Mostrar menos" },
  ja: { description: "説明", instructionsControls: "遊び方と操作", authorInfo: "作者情報", gameDetails: "ゲームの詳細", rating: "Silvergames の評価", votes: "票", ageRating: "年齢区分", uploadDate: "アップロード日", version: "バージョン", swfVersion: "SWF のバージョン", dimensions: "サイズ", frameRate: "フレームレート", fileSize: "ファイルサイズ", openGameFolder: "{title} のゲームフォルダーを開く", noTags: "タグなし", noCategories: "カテゴリなし", showMore: "もっと見る", showLess: "表示を減らす" },
  ko: { description: "설명", instructionsControls: "설명 및 조작법", authorInfo: "제작자 정보", gameDetails: "게임 상세 정보", rating: "Silvergames 평점", votes: "표", ageRating: "연령 등급", uploadDate: "업로드 날짜", version: "버전", swfVersion: "SWF 버전", dimensions: "크기", frameRate: "프레임 속도", fileSize: "파일 크기", openGameFolder: "{title} 게임 폴더 열기", noTags: "태그 없음", noCategories: "카테고리 없음", showMore: "더 보기", showLess: "간략히 보기" },
  hi: { description: "विवरण", instructionsControls: "निर्देश और नियंत्रण", authorInfo: "लेखक की जानकारी", gameDetails: "गेम का विवरण", rating: "Silvergames रेटिंग", votes: "वोट", ageRating: "आयु रेटिंग", uploadDate: "अपलोड की तारीख", version: "संस्करण", swfVersion: "SWF संस्करण", dimensions: "आयाम", frameRate: "फ़्रेम दर", fileSize: "फ़ाइल का आकार", openGameFolder: "{title} का गेम फ़ोल्डर खोलें", noTags: "कोई टैग नहीं", noCategories: "कोई श्रेणी नहीं", showMore: "और दिखाएँ", showLess: "कम दिखाएँ" },
  ar: { description: "الوصف", instructionsControls: "التعليمات وعناصر التحكم", authorInfo: "معلومات المؤلف", gameDetails: "تفاصيل اللعبة", rating: "تقييم Silvergames", votes: "أصوات", ageRating: "التصنيف العمري", uploadDate: "تاريخ الرفع", version: "الإصدار", swfVersion: "إصدار SWF", dimensions: "الأبعاد", frameRate: "معدل الإطارات", fileSize: "حجم الملف", openGameFolder: "فتح مجلد اللعبة {title}", noTags: "لا توجد وسوم", noCategories: "لا توجد فئات", showMore: "إظهار المزيد", showLess: "إظهار أقل" },
  ru: { description: "Описание", instructionsControls: "Инструкции и управление", authorInfo: "Информация об авторе", gameDetails: "Сведения об игре", rating: "Рейтинг Silvergames", votes: "голосов", ageRating: "Возрастной рейтинг", uploadDate: "Дата загрузки", version: "Версия", swfVersion: "Версия SWF", dimensions: "Размеры", frameRate: "Частота кадров", fileSize: "Размер файла", openGameFolder: "Открыть папку игры {title}", noTags: "Нет тегов", noCategories: "Нет категорий", showMore: "Показать больше", showLess: "Показать меньше" },
};

export const exploreCoverLabels: Record<Language, string> = {
  en: "Imported from catalogue",
  zh: "从目录导入",
  es: "Importado del catálogo",
  fr: "Importé du catalogue",
  de: "Aus dem Katalog importiert",
  "pt-BR": "Importado do catálogo",
  ja: "カタログからインポート",
  ko: "카탈로그에서 가져옴",
  hi: "कैटलॉग से आयात किया गया",
  ar: "تم الاستيراد من الكتالوج",
  ru: "Импортировано из каталога",
};

export const exploreDuplicateLabels: Record<Language, { badge: string; of: string; title: string; message: string }> = {
  en: { badge: "Duplicate", of: "Duplicate of {title}", title: "Game not added", message: "{title} was not added because it is a duplicate of {duplicate}, which is already in your library." },
  zh: { badge: "重复", of: "与 {title} 重复", title: "未添加游戏", message: "未添加 {title}，因为它与游戏库中已有的 {duplicate} 重复。" },
  es: { badge: "Duplicado", of: "Duplicado de {title}", title: "Juego no añadido", message: "No se ha añadido {title} porque es un duplicado de {duplicate}, que ya está en tu biblioteca." },
  fr: { badge: "Doublon", of: "Doublon de {title}", title: "Jeu non ajouté", message: "{title} n’a pas été ajouté, car il s’agit d’un doublon de {duplicate}, déjà présent dans votre bibliothèque." },
  de: { badge: "Duplikat", of: "Duplikat von {title}", title: "Spiel nicht hinzugefügt", message: "{title} wurde nicht hinzugefügt, da es ein Duplikat von {duplicate} ist. Dieses Spiel ist bereits in deiner Bibliothek." },
  "pt-BR": { badge: "Duplicado", of: "Duplicado de {title}", title: "Jogo não adicionado", message: "{title} não foi adicionado porque é um duplicado de {duplicate}, que já está na sua biblioteca." },
  ja: { badge: "重複", of: "{title} と重複", title: "ゲームを追加しませんでした", message: "{title} はライブラリにある {duplicate} と重複しているため、追加しませんでした。" },
  ko: { badge: "중복", of: "{title}의 중복 게임", title: "게임이 추가되지 않음", message: "{title}은(는) 이미 라이브러리에 있는 {duplicate}의 중복 게임이므로 추가되지 않았습니다." },
  hi: { badge: "डुप्लिकेट", of: "{title} की डुप्लिकेट", title: "गेम नहीं जोड़ा गया", message: "{title} नहीं जोड़ा गया क्योंकि यह {duplicate} की डुप्लिकेट है, जो आपकी लाइब्रेरी में पहले से है।" },
  ar: { badge: "مكررة", of: "نسخة مكررة من {title}", title: "لم تتم إضافة اللعبة", message: "لم تتم إضافة {title} لأنها نسخة مكررة من {duplicate} الموجودة بالفعل في مكتبتك." },
  ru: { badge: "Дубликат", of: "Дубликат игры {title}", title: "Игра не добавлена", message: "Игра {title} не добавлена, так как это дубликат игры {duplicate}, которая уже есть в библиотеке." },
};

export const userRatingLabels: Record<Language, { title: string; clear: string }> = {
  en: { title: "Your rating", clear: "Clear rating" },
  zh: { title: "你的评分", clear: "清除评分" },
  es: { title: "Tu valoración", clear: "Borrar valoración" },
  fr: { title: "Votre note", clear: "Effacer la note" },
  de: { title: "Deine Bewertung", clear: "Bewertung entfernen" },
  "pt-BR": { title: "Sua avaliação", clear: "Limpar avaliação" },
  ja: { title: "自分の評価", clear: "評価をクリア" },
  ko: { title: "내 평점", clear: "평점 지우기" },
  hi: { title: "आपकी रेटिंग", clear: "रेटिंग साफ़ करें" },
  ar: { title: "تقييمك", clear: "مسح التقييم" },
  ru: { title: "Ваша оценка", clear: "Сбросить оценку" },
};

export const scalingPerformanceHints: Record<Language, string> = {
  en: "May increase CPU/GPU usage and reduce performance.",
  zh: "可能增加 CPU/GPU 使用率并降低性能。",
  es: "Puede aumentar el uso de CPU/GPU y reducir el rendimiento.",
  fr: "Peut augmenter l’utilisation du CPU/GPU et réduire les performances.",
  de: "Kann die CPU/GPU-Auslastung erhöhen und die Leistung verringern.",
  "pt-BR": "Pode aumentar o uso de CPU/GPU e reduzir o desempenho.",
  ja: "CPU/GPU 使用率が上がり、パフォーマンスが低下する場合があります。",
  ko: "CPU/GPU 사용량이 늘고 성능이 저하될 수 있습니다.",
  hi: "CPU/GPU उपयोग बढ़ सकता है और प्रदर्शन कम हो सकता है।",
  ar: "قد يزيد استخدام CPU/GPU ويقلّل الأداء.",
  ru: "Может увеличить нагрузку на CPU/GPU и снизить производительность.",
};

export const compatibilitySettingsLabels: Record<Language, { standalone: string; fixScaling: string; online: string; resources: string; reopen: string; invalidResource: string; blockResource: string; unblockResource: string; copyResource: string; resourceCopied: string; noResources: string }> = {
  en: { standalone: "Standalone compatibility", fixScaling: "Fix scaling / zoom", online: "Allow online features", resources: "Discovered public resources", reopen: "Reopen this game's player to apply this setting", invalidResource: "Only public HTTP or HTTPS resources without credentials or query strings can be relayed.", blockResource: "Block", unblockResource: "Unblock", copyResource: "Copy link", resourceCopied: "Copied to clipboard", noResources: "Resources appear here as the game loads them." },
  zh: { standalone: "独立播放器兼容模式", fixScaling: "修复缩放", online: "允许在线功能", resources: "已发现的公共资源", reopen: "重新打开此游戏的播放器以应用此设置", invalidResource: "仅可中转不含凭据或查询字符串的公共 HTTP 或 HTTPS 资源。", blockResource: "阻止", unblockResource: "解除阻止", copyResource: "复制链接", resourceCopied: "已复制到剪贴板", noResources: "游戏加载资源时，它们会显示在此处。" },
  es: { standalone: "Compatibilidad con reproductor independiente", fixScaling: "Corregir escalado / zoom", online: "Permitir funciones en línea", resources: "Recursos públicos detectados", reopen: "Vuelve a abrir el reproductor de este juego para aplicar este ajuste", invalidResource: "Solo se pueden retransmitir recursos públicos HTTP o HTTPS sin credenciales ni cadenas de consulta.", blockResource: "Bloquear", unblockResource: "Desbloquear", copyResource: "Copiar enlace", resourceCopied: "Copiado al portapapeles", noResources: "Los recursos aparecen aquí a medida que el juego los carga." },
  fr: { standalone: "Compatibilité avec un lecteur autonome", fixScaling: "Corriger la mise à l’échelle / le zoom", online: "Autoriser les fonctionnalités en ligne", resources: "Ressources publiques détectées", reopen: "Rouvrez le lecteur de ce jeu pour appliquer ce paramètre", invalidResource: "Seules les ressources publiques HTTP ou HTTPS sans identifiants ni chaînes de requête peuvent être relayées.", blockResource: "Bloquer", unblockResource: "Débloquer", copyResource: "Copier le lien", resourceCopied: "Copié dans le presse-papiers", noResources: "Les ressources apparaissent ici à mesure que le jeu les charge." },
  de: { standalone: "Kompatibilität mit eigenständigem Player", fixScaling: "Skalierung / Zoom korrigieren", online: "Online-Funktionen erlauben", resources: "Gefundene öffentliche Ressourcen", reopen: "Öffne den Player dieses Spiels erneut, um diese Einstellung anzuwenden", invalidResource: "Es können nur öffentliche HTTP- oder HTTPS-Ressourcen ohne Zugangsdaten oder Abfragezeichenfolgen weitergeleitet werden.", blockResource: "Blockieren", unblockResource: "Entsperren", copyResource: "Link kopieren", resourceCopied: "In die Zwischenablage kopiert", noResources: "Ressourcen erscheinen hier, sobald das Spiel sie lädt." },
  "pt-BR": { standalone: "Compatibilidade com player independente", fixScaling: "Corrigir escala / zoom", online: "Permitir recursos online", resources: "Recursos públicos encontrados", reopen: "Reabra o player deste jogo para aplicar esta configuração", invalidResource: "Somente recursos públicos HTTP ou HTTPS sem credenciais ou parâmetros de consulta podem ser retransmitidos.", blockResource: "Bloquear", unblockResource: "Desbloquear", copyResource: "Copiar link", resourceCopied: "Copiado para a área de transferência", noResources: "Os recursos aparecem aqui conforme o jogo os carrega." },
  ja: { standalone: "スタンドアロン互換性", fixScaling: "スケーリング／ズームを修正", online: "オンライン機能を許可", resources: "検出した公開リソース", reopen: "この設定を適用するには、このゲームのプレイヤーを開き直してください", invalidResource: "認証情報やクエリ文字列を含まない公開 HTTP または HTTPS リソースのみ中継できます。", blockResource: "ブロック", unblockResource: "ブロックを解除", copyResource: "リンクをコピー", resourceCopied: "クリップボードにコピーしました", noResources: "ゲームがリソースを読み込むと、ここに表示されます。" },
  ko: { standalone: "독립 실행형 호환성", fixScaling: "배율/확대·축소 문제 해결", online: "온라인 기능 허용", resources: "발견된 공개 리소스", reopen: "이 설정을 적용하려면 이 게임의 플레이어를 다시 여세요", invalidResource: "자격 증명이나 쿼리 문자열이 없는 공개 HTTP 또는 HTTPS 리소스만 중계할 수 있습니다.", blockResource: "차단", unblockResource: "차단 해제", copyResource: "링크 복사", resourceCopied: "클립보드에 복사했습니다", noResources: "게임이 리소스를 불러오면 여기에 표시됩니다." },
  hi: { standalone: "स्टैंडअलोन अनुकूलता", fixScaling: "स्केलिंग / ज़ूम ठीक करें", online: "ऑनलाइन सुविधाओं की अनुमति दें", resources: "मिले हुए सार्वजनिक संसाधन", reopen: "यह सेटिंग लागू करने के लिए इस गेम का प्लेयर फिर खोलें", invalidResource: "केवल बिना क्रेडेंशियल या क्वेरी स्ट्रिंग वाले सार्वजनिक HTTP या HTTPS संसाधन रिले किए जा सकते हैं।", blockResource: "ब्लॉक करें", unblockResource: "अनब्लॉक करें", copyResource: "लिंक कॉपी करें", resourceCopied: "क्लिपबोर्ड पर कॉपी किया गया", noResources: "जैसे-जैसे गेम संसाधन लोड करता है, वे यहाँ दिखाई देते हैं।" },
  ar: { standalone: "توافق المشغّل المستقل", fixScaling: "إصلاح التحجيم / التكبير", online: "السماح بالميزات عبر الإنترنت", resources: "الموارد العامة المكتشفة", reopen: "أعِد فتح مشغّل هذه اللعبة لتطبيق هذا الإعداد", invalidResource: "لا يمكن ترحيل سوى موارد HTTP أو HTTPS العامة التي لا تتضمن بيانات اعتماد أو سلاسل استعلام.", blockResource: "حظر", unblockResource: "إلغاء الحظر", copyResource: "نسخ الرابط", resourceCopied: "تم النسخ إلى الحافظة", noResources: "تظهر الموارد هنا عندما تحمّلها اللعبة." },
  ru: { standalone: "Совместимость с автономным проигрывателем", fixScaling: "Исправить масштабирование / зум", online: "Разрешить онлайн-функции", resources: "Обнаруженные общедоступные ресурсы", reopen: "Откройте проигрыватель этой игры заново, чтобы применить настройку", invalidResource: "Можно ретранслировать только общедоступные ресурсы HTTP или HTTPS без учётных данных и строк запроса.", blockResource: "Заблокировать", unblockResource: "Разблокировать", copyResource: "Копировать ссылку", resourceCopied: "Скопировано в буфер обмена", noResources: "Ресурсы появляются здесь по мере их загрузки игрой." },
};

export const confirmationActionLabels: Record<Language, { cancel: string; delete: string; deleteFiles: string; keepFiles: string }> = {
  en: { cancel: "Cancel", delete: "Delete", deleteFiles: "Delete files", keepFiles: "Keep files" },
  zh: { cancel: "取消", delete: "删除", deleteFiles: "删除文件", keepFiles: "保留文件" },
  es: { cancel: "Cancelar", delete: "Eliminar", deleteFiles: "Eliminar archivos", keepFiles: "Conservar archivos" },
  fr: { cancel: "Annuler", delete: "Supprimer", deleteFiles: "Supprimer les fichiers", keepFiles: "Conserver les fichiers" },
  de: { cancel: "Abbrechen", delete: "Löschen", deleteFiles: "Dateien löschen", keepFiles: "Dateien behalten" },
  "pt-BR": { cancel: "Cancelar", delete: "Excluir", deleteFiles: "Excluir arquivos", keepFiles: "Manter arquivos" },
  ja: { cancel: "キャンセル", delete: "削除", deleteFiles: "ファイルを削除", keepFiles: "ファイルを保持" },
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
  ko: "이름 바꾸기",
  hi: "नाम बदलें",
  ar: "إعادة التسمية",
  ru: "Переименовать",
};

export const cardSizeLabels: Record<Language, string> = {
  en: "Card size", zh: "卡片大小", es: "Tamaño de las tarjetas", fr: "Taille des cartes", de: "Kartengröße",
  "pt-BR": "Tamanho dos cartões", ja: "カードのサイズ", ko: "카드 크기", hi: "कार्ड का आकार", ar: "حجم البطاقات", ru: "Размер карточек",
};

export const cardSizeToggleLabels: Record<Language, { show: string; hide: string }> = {
  en: { show: "Show card size", hide: "Hide card size" },
  zh: { show: "显示卡片大小", hide: "隐藏卡片大小" },
  es: { show: "Mostrar tamaño de las tarjetas", hide: "Ocultar tamaño de las tarjetas" },
  fr: { show: "Afficher la taille des cartes", hide: "Masquer la taille des cartes" },
  de: { show: "Kartengröße anzeigen", hide: "Kartengröße ausblenden" },
  "pt-BR": { show: "Mostrar tamanho dos cartões", hide: "Ocultar tamanho dos cartões" },
  ja: { show: "カードのサイズを表示", hide: "カードのサイズを隠す" },
  ko: { show: "카드 크기 표시", hide: "카드 크기 숨기기" },
  hi: { show: "कार्ड का आकार दिखाएँ", hide: "कार्ड का आकार छिपाएँ" },
  ar: { show: "إظهار حجم البطاقات", hide: "إخفاء حجم البطاقات" },
  ru: { show: "Показать размер карточек", hide: "Скрыть размер карточек" },
};

export const sortLabels: Record<Language, { sort: string; dateAdded: string; name: string; lastPlayed: string; mostPlayed: string; ascending: string; descending: string }> = {
  en: { sort: "Sort games", dateAdded: "Date added", name: "Name (A–Z)", lastPlayed: "Last played", mostPlayed: "Most played", ascending: "Ascending", descending: "Descending" },
  zh: { sort: "排序游戏", dateAdded: "添加日期", name: "名称（A–Z）", lastPlayed: "上次游玩", mostPlayed: "游玩最多", ascending: "升序", descending: "降序" },
  es: { sort: "Ordenar juegos", dateAdded: "Fecha de incorporación", name: "Nombre (A–Z)", lastPlayed: "Última partida", mostPlayed: "Más jugados", ascending: "Ascendente", descending: "Descendente" },
  fr: { sort: "Trier les jeux", dateAdded: "Date d’ajout", name: "Nom (A–Z)", lastPlayed: "Dernière partie", mostPlayed: "Les plus joués", ascending: "Croissant", descending: "Décroissant" },
  de: { sort: "Spiele sortieren", dateAdded: "Hinzugefügt am", name: "Name (A–Z)", lastPlayed: "Zuletzt gespielt", mostPlayed: "Am meisten gespielt", ascending: "Aufsteigend", descending: "Absteigend" },
  "pt-BR": { sort: "Ordenar jogos", dateAdded: "Data de adição", name: "Nome (A–Z)", lastPlayed: "Última partida", mostPlayed: "Mais jogados", ascending: "Crescente", descending: "Decrescente" },
  ja: { sort: "ゲームを並べ替え", dateAdded: "追加日", name: "名前（A–Z）", lastPlayed: "最終プレイ", mostPlayed: "最もプレイした順", ascending: "昇順", descending: "降順" },
  ko: { sort: "게임 정렬", dateAdded: "추가 날짜", name: "이름 (A–Z)", lastPlayed: "마지막 플레이", mostPlayed: "가장 많이 플레이", ascending: "오름차순", descending: "내림차순" },
  hi: { sort: "गेम क्रमबद्ध करें", dateAdded: "जोड़ने की तारीख", name: "नाम (A–Z)", lastPlayed: "पिछली बार खेला", mostPlayed: "सबसे अधिक खेले गए", ascending: "आरोही", descending: "अवरोही" },
  ar: { sort: "ترتيب الألعاب", dateAdded: "تاريخ الإضافة", name: "الاسم (A–Z)", lastPlayed: "آخر لعب", mostPlayed: "الأكثر لعبًا", ascending: "تصاعدي", descending: "تنازلي" },
  ru: { sort: "Сортировать игры", dateAdded: "Дата добавления", name: "Название (A–Z)", lastPlayed: "Последняя игра", mostPlayed: "Больше всего играли", ascending: "По возрастанию", descending: "По убыванию" },
};

type TranslationKey = keyof typeof messages.zh;

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

export const gameOptionHints: Record<Language, { fullscreen: string; standalone: string; online: string; pinCursor: string }> = {
  en: {"fullscreen":"Opens the player in fullscreen every time this game starts.","standalone":"Loads the game like a standalone Flash player would. Can fix logins or features that only work offline.","online":"Lets the game connect to the internet for high scores, logins and online content.","pinCursor":"Keeps the mouse pointer inside the player window while it is focused."},
  zh: {"fullscreen":"每次启动此游戏时，均以全屏打开播放器。","standalone":"按独立 Flash 播放器的方式加载游戏，可能修复仅在离线时可用的登录或其他功能。","online":"允许游戏连接互联网，以使用高分榜、登录和在线内容。","pinCursor":"播放器窗口处于焦点时，将鼠标指针限制在窗口内。"},
  es: {"fullscreen":"Abre el reproductor en pantalla completa cada vez que se inicia este juego.","standalone":"Carga el juego como un reproductor Flash independiente. Puede solucionar problemas de inicio de sesión o de funciones que solo van sin conexión.","online":"Permite que el juego se conecte a Internet para acceder a puntuaciones, inicios de sesión y contenido en línea.","pinCursor":"Mantiene el puntero del ratón dentro de la ventana del reproductor mientras esta tiene el foco."},
  fr: {"fullscreen":"Ouvre le lecteur en plein écran à chaque démarrage de ce jeu.","standalone":"Charge le jeu comme le ferait un lecteur Flash autonome. Peut corriger les connexions ou les fonctionnalités qui ne fonctionnent que hors ligne.","online":"Autorise le jeu à se connecter à Internet pour les meilleurs scores, les connexions et le contenu en ligne.","pinCursor":"Maintient le pointeur de la souris dans la fenêtre du lecteur tant qu’elle a le focus."},
  de: {"fullscreen":"Öffnet den Player bei jedem Start dieses Spiels im Vollbild.","standalone":"Lädt das Spiel wie ein eigenständiger Flash-Player. Kann Anmeldungen oder Funktionen korrigieren, die nur offline funktionieren.","online":"Erlaubt dem Spiel Internetzugriff für Bestenlisten, Anmeldungen und Online-Inhalte.","pinCursor":"Hält den Mauszeiger im Player-Fenster, solange dieses den Fokus hat."},
  "pt-BR": {"fullscreen":"Abre o player em tela cheia sempre que este jogo é iniciado.","standalone":"Carrega o jogo como um player Flash independente. Pode corrigir problemas de login ou de recursos que só funcionam offline.","online":"Permite que o jogo se conecte à internet para acessar recordes, logins e conteúdo online.","pinCursor":"Mantém o ponteiro do mouse dentro da janela do player enquanto ela está em foco."},
  ja: {"fullscreen":"このゲームを起動するたびに、プレイヤーを全画面で開きます。","standalone":"スタンドアロンの Flash プレイヤーと同じ方法でゲームを読み込みます。オフラインでのみ動作するログインや機能の問題を解決できる場合があります。","online":"ハイスコア、ログイン、オンラインコンテンツのために、ゲームのインターネット接続を許可します。","pinCursor":"プレイヤーウィンドウにフォーカスがある間、マウスポインターをウィンドウ内に固定します。"},
  ko: {"fullscreen":"이 게임을 시작할 때마다 플레이어를 전체 화면으로 엽니다.","standalone":"독립 실행형 Flash 플레이어 방식으로 게임을 불러옵니다. 오프라인에서만 작동하는 로그인이나 기능의 문제를 해결할 수 있습니다.","online":"최고 점수, 로그인, 온라인 콘텐츠를 위해 게임의 인터넷 연결을 허용합니다.","pinCursor":"플레이어 창에 포커스가 있는 동안 마우스 포인터를 창 안에 유지합니다."},
  hi: {"fullscreen":"यह गेम शुरू होने पर हर बार प्लेयर फ़ुलस्क्रीन में खुलता है।","standalone":"गेम को स्टैंडअलोन Flash प्लेयर की तरह लोड करता है। केवल ऑफ़लाइन काम करने वाले लॉगिन या सुविधाओं की समस्याएँ ठीक हो सकती हैं।","online":"हाई स्कोर, लॉगिन और ऑनलाइन सामग्री के लिए गेम को इंटरनेट से जुड़ने देता है।","pinCursor":"प्लेयर विंडो पर फ़ोकस रहने तक माउस पॉइंटर को उसके अंदर रखता है।"},
  ar: {"fullscreen":"يفتح المشغّل بملء الشاشة في كل مرة تبدأ فيها هذه اللعبة.","standalone":"يحمّل اللعبة بالطريقة نفسها التي يستخدمها مشغّل Flash مستقل. قد يصلح مشاكل تسجيل الدخول أو الميزات التي لا تعمل إلا دون اتصال.","online":"يسمح للعبة بالاتصال بالإنترنت لأعلى النتائج وتسجيل الدخول والمحتوى عبر الإنترنت.","pinCursor":"يبقي مؤشر الفأرة داخل نافذة المشغّل ما دامت في بؤرة التركيز."},
  ru: {"fullscreen":"Открывает проигрыватель на весь экран при каждом запуске этой игры.","standalone":"Загружает игру так, как это делает автономный Flash-проигрыватель. Может исправить вход в аккаунт или функции, работающие только без интернета.","online":"Разрешает игре подключаться к интернету для таблиц рекордов, входа в аккаунт и онлайн-контента.","pinCursor":"Удерживает указатель мыши внутри окна проигрывателя, пока оно в фокусе."},
};

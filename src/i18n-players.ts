import type { Language } from "./i18n";

export const addCustomPlayerLabels: Record<Language, string> = {
  en: "Add custom player",
  zh: "添加自定义播放器",
  es: "Añadir reproductor personalizado",
  fr: "Ajouter un lecteur personnalisé",
  de: "Benutzerdefinierten Player hinzufügen",
  "pt-BR": "Adicionar player personalizado",
  ja: "カスタムプレイヤーを追加",
  ko: "사용자 지정 플레이어 추가",
  hi: "कस्टम प्लेयर जोड़ें",
  ar: "إضافة مشغّل مخصص",
  ru: "Добавить свой проигрыватель",
};

export const deleteCustomPlayerLabels: Record<Language, { remove: string; confirm: string }> = {
  en: { remove: "Delete player", confirm: "Click again to delete" },
  zh: { remove: "删除播放器", confirm: "再次点击以删除" },
  es: { remove: "Eliminar reproductor", confirm: "Haz clic de nuevo para eliminar" },
  fr: { remove: "Supprimer le lecteur", confirm: "Cliquez à nouveau pour supprimer" },
  de: { remove: "Player löschen", confirm: "Zum Löschen erneut klicken" },
  "pt-BR": { remove: "Excluir player", confirm: "Clique de novo para excluir" },
  ja: { remove: "プレイヤーを削除", confirm: "もう一度クリックで削除" },
  ko: { remove: "플레이어 삭제", confirm: "다시 클릭하면 삭제됩니다" },
  hi: { remove: "प्लेयर हटाएँ", confirm: "हटाने के लिए फिर से क्लिक करें" },
  ar: { remove: "حذف المشغّل", confirm: "انقر مرة أخرى للحذف" },
  ru: { remove: "Удалить проигрыватель", confirm: "Нажмите ещё раз для удаления" },
};

export const libreShockwaveHints: Record<Language, string> = {
  en: "Experimental Shockwave alternative. Compatibility varies, especially for 3D and Xtras. DirPlayer remains the default.",
  zh: "实验性 Shockwave 备选播放器。兼容性因游戏而异，尤其是 3D 和 Xtras。默认仍为 DirPlayer。",
  es: "Alternativa experimental para Shockwave. La compatibilidad varía, especialmente con 3D y Xtras. DirPlayer sigue siendo el predeterminado.",
  fr: "Alternative Shockwave expérimentale. La compatibilité varie, surtout pour la 3D et les Xtras. DirPlayer reste le choix par défaut.",
  de: "Experimentelle Shockwave-Alternative. Die Kompatibilität variiert, besonders bei 3D und Xtras. DirPlayer bleibt der Standard.",
  "pt-BR": "Alternativa experimental para Shockwave. A compatibilidade varia, especialmente com 3D e Xtras. DirPlayer continua como padrão.",
  ja: "実験的な Shockwave プレイヤーです。特に 3D や Xtras の互換性はゲームによって異なります。既定は引き続き DirPlayer です。",
  ko: "실험적인 Shockwave 대체 플레이어입니다. 특히 3D와 Xtras의 호환성은 게임마다 다릅니다. 기본값은 DirPlayer입니다.",
  hi: "प्रयोगात्मक Shockwave विकल्प। संगतता अलग-अलग हो सकती है, खासकर 3D और Xtras के लिए। DirPlayer डिफ़ॉल्ट बना रहेगा।",
  ar: "بديل تجريبي لـ Shockwave. يختلف التوافق، خاصةً مع 3D وXtras. يبقى DirPlayer الخيار الافتراضي.",
  ru: "Экспериментальная альтернатива Shockwave. Совместимость различается, особенно для 3D и Xtras. По умолчанию остаётся DirPlayer.",
};

interface PlayerLabels {
  title: string;
  description: string;
  builtin: string;
  installed: string;
  notFound: string;
  detected: string;
  manual: string;
  browse: string;
  rescan: string;
  scanning: string;
  reset: string;
  download: string;
  homepage: string;
  versions: string;
  customName: string;
  customArgs: string;
  customArgsHint: string;
  customFormats: string;
  gamePlayer: string;
  gamePlayerVersion: string;
  defaultPlayer: string;
  notInstalled: string;
  externalHint: string;
  fallback: string;
  version: string;
  author: string;
  license: string;
}

export const playerLabels: Record<Language, PlayerLabels> = {
  en: {
    title: "Game players", description: "Flash (SWF) games play in Ruffle and Shockwave (DCR) games in DirPlayer, both built in. External players are separate programs you install yourself, choose one per game in Game Settings.",
    builtin: "Built in", installed: "Installed", notFound: "Not found", detected: "Auto-detected", manual: "Custom path", browse: "Browse…", rescan: "Scan again", scanning: "Scanning…", reset: "Use auto-detect",
    download: "Download", homepage: "Website", versions: "Versions ({n}):", customName: "Name", customArgs: "Arguments", customArgsHint: "{file} = game file, {dir} = its folder, {name} = file name.", customFormats: "Plays",
    gamePlayer: "Player", gamePlayerVersion: "Player version", defaultPlayer: "{name} (default)", notInstalled: "not installed",
    externalHint: "External players open in their own window. The player toolbar, controller mapping, music and saves in Flash Royale are not available, only the options below apply.",
    fallback: "{name} is not available, so {fallback} will be used.", version: "Version", author: "Author", license: "License",
  },
  zh: {
    title: "游戏播放器", description: "Flash（SWF）游戏通过内置的 Ruffle 运行，Shockwave（DCR）游戏通过内置的 DirPlayer 运行。外部播放器是需自行安装的独立程序，可在游戏设置中为各个游戏单独选择。",
    builtin: "内置播放器", installed: "已安装", notFound: "未能找到", detected: "自动识别", manual: "指定路径", browse: "选择文件…", rescan: "再次扫描", scanning: "扫描中…", reset: "改用自动识别",
    download: "下载", homepage: "官方网站", versions: "版本数（{n}）：", customName: "名称", customArgs: "启动参数", customArgsHint: "{file} = 游戏文件，{dir} = 该文件所在文件夹，{name} = 文件名。", customFormats: "支持的格式",
    gamePlayer: "播放器", gamePlayerVersion: "播放器版本", defaultPlayer: "{name}（默认播放器）", notInstalled: "尚未安装",
    externalHint: "外部播放器使用独立窗口。Flash Royale 的播放器工具栏、控制器按键映射、音乐和存档功能均不可用，只有下方选项适用。",
    fallback: "无法使用 {name}，因此将改用 {fallback}。", version: "版本", author: "开发者", license: "许可协议",
  },
  es: {
    title: "Reproductores de juegos", description: "Los juegos Flash (SWF) se ejecutan con Ruffle y los de Shockwave (DCR), con DirPlayer, ambos vienen integrados. Los reproductores externos son programas independientes que debes instalar. Puedes elegir uno para cada juego en sus ajustes.",
    builtin: "Incluido", installed: "Instalado", notFound: "No se ha encontrado", detected: "Detectado automáticamente", manual: "Ruta definida por ti", browse: "Buscar archivo…", rescan: "Volver a buscar", scanning: "Búsqueda en curso…", reset: "Usar detección automática",
    download: "Descargar", homepage: "Página web", versions: "Versiones ({n}):", customName: "Nombre", customArgs: "Parámetros", customArgsHint: "{file} = archivo del juego, {dir} = carpeta que lo contiene, {name} = nombre del archivo.", customFormats: "Formatos que reproduce",
    gamePlayer: "Reproductor", gamePlayerVersion: "Versión del reproductor", defaultPlayer: "{name} (por defecto)", notInstalled: "sin instalar",
    externalHint: "Los reproductores externos usan una ventana independiente. No podrás usar la barra del reproductor, la configuración del mando, la música ni las partidas guardadas de Flash Royale, únicamente se aplican las opciones siguientes.",
    fallback: "No se puede usar {name}, se utilizará {fallback}.", version: "Versión", author: "Autor", license: "Licencia",
  },
  fr: {
    title: "Lecteurs de jeux", description: "Les jeux Flash (SWF) s’exécutent avec Ruffle et les jeux Shockwave (DCR) avec DirPlayer, tous deux inclus. Les lecteurs externes sont des programmes distincts à installer vous-même. Vous pouvez en choisir un pour chaque jeu dans ses paramètres.",
    builtin: "Inclus", installed: "Installé", notFound: "Non trouvé", detected: "Repéré automatiquement", manual: "Emplacement personnalisé", browse: "Choisir un fichier…", rescan: "Relancer la recherche", scanning: "Recherche en cours…", reset: "Utiliser la détection automatique",
    download: "Télécharger", homepage: "Site Internet", versions: "Versions ({n}) :", customName: "Nom", customArgs: "Paramètres de lancement", customArgsHint: "{file} = fichier du jeu, {dir} = dossier qui le contient, {name} = nom du fichier.", customFormats: "Formats lus",
    gamePlayer: "Lecteur", gamePlayerVersion: "Version du lecteur", defaultPlayer: "{name} (lecteur par défaut)", notInstalled: "pas installé",
    externalHint: "Les lecteurs externes utilisent une fenêtre séparée. La barre d’outils du lecteur, l’affectation des commandes de manette, la musique et les sauvegardes de Flash Royale ne sont pas disponibles, seuls les réglages ci-dessous s’appliquent.",
    fallback: "{name} est indisponible, {fallback} sera utilisé à sa place.", version: "Version", author: "Auteur", license: "Licence",
  },
  de: {
    title: "Player für Spiele", description: "Flash-Spiele (SWF) laufen mit Ruffle und Shockwave-Spiele (DCR) mit DirPlayer, beide sind integriert. Externe Player sind separate Programme, die du selbst installierst. In den Spieleinstellungen kannst du für jedes Spiel einen auswählen.",
    builtin: "Enthalten", installed: "Installiert", notFound: "Nicht auffindbar", detected: "Automatisch gefunden", manual: "Benutzerdefinierter Pfad", browse: "Datei auswählen…", rescan: "Suche wiederholen", scanning: "Suche läuft…", reset: "Automatische Erkennung nutzen",
    download: "Download", homepage: "Internetseite", versions: "Versionen ({n}):", customName: "Name", customArgs: "Startargumente", customArgsHint: "{file} = Spieldatei, {dir} = zugehöriger Ordner, {name} = Name der Datei.", customFormats: "Unterstützte Formate",
    gamePlayer: "Player", gamePlayerVersion: "Version des Players", defaultPlayer: "{name} (Standardplayer)", notInstalled: "nicht installiert",
    externalHint: "Externe Player nutzen ein separates Fenster. Die Player-Werkzeugleiste, Controller-Zuordnungen, Musik und Speicherstände von Flash Royale stehen dabei nicht zur Verfügung, es gelten nur die nachfolgenden Optionen.",
    fallback: "{name} steht nicht zur Verfügung, stattdessen wird {fallback} genutzt.", version: "Version", author: "Autor", license: "Lizenz",
  },
  "pt-BR": {
    title: "Players para jogos", description: "Os jogos Flash (SWF) são executados pelo Ruffle e os de Shockwave (DCR), pelo DirPlayer, ambos incluídos no app. Players externos são programas separados que você instala por conta própria. Escolha um para cada jogo nas configurações dele.",
    builtin: "Incluído", installed: "Instalado", notFound: "Não localizado", detected: "Identificado automaticamente", manual: "Local definido por você", browse: "Selecionar arquivo…", rescan: "Buscar de novo", scanning: "Busca em andamento…", reset: "Usar detecção automática",
    download: "Baixar", homepage: "Página na web", versions: "Versões ({n}):", customName: "Nome", customArgs: "Parâmetros", customArgsHint: "{file} = arquivo do jogo, {dir} = pasta que contém o arquivo, {name} = nome do arquivo.", customFormats: "Formatos reproduzidos",
    gamePlayer: "Player", gamePlayerVersion: "Versão do player", defaultPlayer: "{name} (player padrão)", notInstalled: "não instalado",
    externalHint: "Players externos usam uma janela separada. A barra de ferramentas do player, o mapeamento do controle, a música e os jogos salvos do Flash Royale ficam indisponíveis, apenas as opções a seguir se aplicam.",
    fallback: "Não é possível usar {name}, {fallback} será utilizado no lugar.", version: "Versão", author: "Autor", license: "Licença",
  },
  ja: {
    title: "ゲーム用プレイヤー", description: "Flash（SWF）ゲームは Ruffle、Shockwave（DCR）ゲームは DirPlayer で実行され、どちらも内蔵されています。外部プレイヤーはご自身でインストールする独立したプログラムです。ゲーム設定でゲームごとに選べます。",
    builtin: "標準搭載", installed: "インストール済み", notFound: "検出できません", detected: "自動で検出済み", manual: "指定したパス", browse: "ファイルを選択…", rescan: "もう一度検索", scanning: "検索しています…", reset: "自動検出に戻す",
    download: "ダウンロード", homepage: "公式サイト", versions: "バージョン数（{n}）：", customName: "名前", customArgs: "起動引数", customArgsHint: "{file} = ゲームファイル、{dir} = ファイルのあるフォルダー、{name} = ファイル名。", customFormats: "再生できる形式",
    gamePlayer: "プレイヤー", gamePlayerVersion: "プレイヤーバージョン", defaultPlayer: "{name}（標準）", notInstalled: "インストールされていません",
    externalHint: "外部プレイヤーは別のウィンドウで開きます。Flash Royale のプレイヤーツールバー、コントローラーの割り当て、音楽、セーブ機能は利用できません。以下の設定だけが適用されます。",
    fallback: "{name} が利用できないので、代わりに {fallback} を使います。", version: "バージョン", author: "開発者", license: "ライセンス",
  },
  ko: {
    title: "게임 실행 플레이어", description: "Flash(SWF) 게임에는 Ruffle을, Shockwave(DCR) 게임에는 DirPlayer를 사용하며 둘 다 기본 제공됩니다. 외부 플레이어는 사용자가 별도로 설치하는 프로그램입니다. 게임 설정에서 각 게임에 사용할 플레이어를 선택하세요.",
    builtin: "기본 제공", installed: "설치 완료", notFound: "발견되지 않음", detected: "자동으로 찾음", manual: "직접 지정한 경로", browse: "파일 선택…", rescan: "검색 다시 실행", scanning: "검색하고 있습니다…", reset: "자동 검색으로 전환",
    download: "다운로드", homepage: "공식 사이트", versions: "버전 수 ({n}):", customName: "이름", customArgs: "실행 인수", customArgsHint: "{file} = 게임 파일, {dir} = 파일이 있는 폴더, {name} = 파일명.", customFormats: "재생 가능한 형식",
    gamePlayer: "플레이어", gamePlayerVersion: "플레이어 버전", defaultPlayer: "{name} (기본 플레이어)", notInstalled: "미설치",
    externalHint: "외부 플레이어는 별도 창으로 실행됩니다. Flash Royale의 플레이어 도구 모음, 컨트롤러 키 지정, 음악 및 저장 기능은 이용할 수 없으며, 다음 옵션만 적용됩니다.",
    fallback: "{name}을(를) 이용할 수 없으므로 대신 {fallback}을(를) 사용합니다.", version: "버전", author: "개발자", license: "라이선스",
  },
  hi: {
    title: "गेम चलाने वाले प्लेयर", description: "Flash (SWF) गेम Ruffle से और Shockwave (DCR) गेम DirPlayer से चलते हैं, दोनों ऐप में शामिल हैं। बाहरी प्लेयर अलग प्रोग्राम हैं जिन्हें आपको खुद इंस्टॉल करना होता है। गेम की सेटिंग्स में हर गेम का प्लेयर चुनें।",
    builtin: "ऐप में शामिल", installed: "इंस्टॉल किया गया", notFound: "मिल नहीं सका", detected: "अपने-आप मिला", manual: "खुद चुना गया पथ", browse: "फ़ाइल चुनें…", rescan: "दोबारा खोजें", scanning: "खोज जारी है…", reset: "अपने-आप खोजने का विकल्प चुनें",
    download: "डाउनलोड करें", homepage: "वेबसाइट", versions: "संस्करण ({n}):", customName: "नाम", customArgs: "लॉन्च आर्गुमेंट", customArgsHint: "{file} = गेम की फ़ाइल, {dir} = फ़ाइल वाला फ़ोल्डर, {name} = फ़ाइल का नाम।", customFormats: "समर्थित फ़ॉर्मैट",
    gamePlayer: "प्लेयर", gamePlayerVersion: "प्लेयर का संस्करण", defaultPlayer: "{name} (डिफ़ॉल्ट प्लेयर)", notInstalled: "इंस्टॉल नहीं किया गया",
    externalHint: "बाहरी प्लेयर अलग विंडो में खुलते हैं। उनमें Flash Royale का प्लेयर टूलबार, कंट्रोलर बटन मैपिंग, संगीत और सेव की सुविधा उपलब्ध नहीं होती, सिर्फ़ नीचे दी गई सेटिंग्स लागू होती हैं।",
    fallback: "{name} इस्तेमाल नहीं किया जा सकता, इसलिए उसकी जगह {fallback} चलेगा।", version: "संस्करण", author: "निर्माता", license: "लाइसेंस",
  },
  ar: {
    title: "مشغّلات الألعاب", description: "تُشغّل ألعاب Flash (SWF) باستخدام Ruffle وألعاب Shockwave (DCR) باستخدام DirPlayer، وكلاهما مضمن. أما المشغّلات الخارجية فهي برامج مستقلة تثبّتها بنفسك. يمكنك تعيين مشغّل لكل لعبة في إعداداتها.",
    builtin: "مضمن", installed: "تم التثبيت", notFound: "لم يُعثر عليه", detected: "تم العثور عليه تلقائيًا", manual: "مسار تختاره", browse: "اختيار ملف…", rescan: "إعادة البحث", scanning: "البحث جارٍ…", reset: "العودة للاكتشاف التلقائي",
    download: "تنزيل", homepage: "الموقع الإلكتروني", versions: "عدد الإصدارات ({n}):", customName: "الاسم", customArgs: "معاملات التشغيل", customArgsHint: "{file} = ملف اللعبة، {dir} = المجلد الذي يحتويه، {name} = اسم الملف.", customFormats: "الصيغ المدعومة",
    gamePlayer: "المشغّل", gamePlayerVersion: "إصدار المشغّل", defaultPlayer: "{name} (المشغّل الافتراضي)", notInstalled: "لم يُثبّت",
    externalHint: "تعمل المشغّلات الخارجية في نافذة مستقلة. لن تتوفر ميزات شريط أدوات المشغّل وتخصيص أزرار وحدة التحكم والموسيقى والحفظ الخاصة بـ Flash Royale، وتسري الخيارات التالية فقط.",
    fallback: "لا يمكن استخدام {name}، لذا سيُستخدم {fallback} بدلًا منه.", version: "الإصدار", author: "المطوّر", license: "الرخصة",
  },
  ru: {
    title: "Проигрыватели для игр", description: "Для игр Flash (SWF) используется Ruffle, а для Shockwave (DCR) — DirPlayer, оба встроены в приложение. Внешние проигрыватели — самостоятельные программы, которые нужно установить отдельно. Проигрыватель можно выбрать для каждой игры в её настройках.",
    builtin: "Входит в приложение", installed: "Установлен", notFound: "Не обнаружен", detected: "Определён автоматически", manual: "Указанный путь", browse: "Выбрать файл…", rescan: "Повторить поиск", scanning: "Идёт поиск…", reset: "Использовать автоопределение",
    download: "Загрузить", homepage: "Веб-сайт", versions: "Версии ({n}):", customName: "Имя", customArgs: "Параметры запуска", customArgsHint: "{file} = файл игры, {dir} = папка с ним, {name} = название файла.", customFormats: "Поддерживаемые форматы",
    gamePlayer: "Проигрыватель", gamePlayerVersion: "Версия проигрывателя", defaultPlayer: "{name} (стандартный)", notInstalled: "не установлен",
    externalHint: "Внешние проигрыватели используют отдельное окно. Панель инструментов проигрывателя, назначение кнопок контроллера, музыка и сохранения Flash Royale в них недоступны, применяются только приведённые ниже параметры.",
    fallback: "Использовать {name} нельзя, поэтому вместо него будет запущен {fallback}.", version: "Версия", author: "Разработчик", license: "Лицензия",
  },
};

interface FlashpointImportLabels {
  autoImport: string;
  promptToggle: string;
  hint: string;
  importNow: string;
  importing: string;
  imported: string;
  none: string;
  ultimate: string;
  notFound: string;
  toast: string;
  promptTitle: string;
  promptMessage: string;
  selectAll: string;
  selectNone: string;
  importSelected: string;
  skip: string;
  dontAsk: string;
}

export const flashpointImportLabels: Record<Language, FlashpointImportLabels> = {
  en: {
    autoImport: "Automatically import games downloaded in Flashpoint", promptToggle: "Ask which games to import before importing them",
    hint: "Supported Flash (SWF) and Shockwave (DCR) games are added to your library with their title, details and logo. Games you delete or skip are not imported again automatically, use the button below to choose them again.",
    importNow: "Import now", importing: "Importing…", imported: "Imported {n} game(s).", none: "No new downloaded games found.",
    ultimate: "Flashpoint Ultimate already contains every game, so its games are not imported automatically.", notFound: "Flashpoint was not found.", toast: "Imported from Flashpoint:",
    promptTitle: "{n} games downloaded in Flashpoint", promptMessage: "Choose which games to add to your library.", selectAll: "Select all", selectNone: "Select none",
    importSelected: "Import ({n})", skip: "Skip", dontAsk: "Don't show this prompt again",
  },
  zh: {
    autoImport: "自动导入通过 Flashpoint 下载的游戏", promptToggle: "在导入之前询问要选择哪些游戏",
    hint: "支持的 Flash（SWF）和 Shockwave（DCR）游戏会连同标题、详细资料及标志一起加入你的游戏库。被你删除或跳过的游戏不会再次自动导入，如需重新选择，请使用下方按钮。",
    importNow: "现在导入", importing: "导入中…", imported: "成功导入 {n} 个游戏。", none: "未发现新下载的游戏。",
    ultimate: "Flashpoint Ultimate 本身已收录全部游戏，因此不会自动导入其中的游戏。", notFound: "未能找到 Flashpoint。", toast: "从 Flashpoint 导入的游戏：",
    promptTitle: "通过 Flashpoint 下载的 {n} 个游戏", promptMessage: "请选择要加入游戏库的游戏。", selectAll: "选择全部", selectNone: "取消全部选择",
    importSelected: "导入所选（{n}）", skip: "跳过", dontAsk: "以后不再显示此询问",
  },
  es: {
    autoImport: "Importar automáticamente juegos descargados con Flashpoint", promptToggle: "Pedir que elija los juegos antes de importarlos",
    hint: "Los juegos compatibles de Flash (SWF) y Shockwave (DCR) se incorporan a tu biblioteca con título, información y logotipo. Si eliminas u omites un juego, no volverá a importarse automáticamente, puedes seleccionarlo otra vez con el botón de abajo.",
    importNow: "Importar ahora", importing: "Importación en curso…", imported: "Se han importado {n} juegos.", none: "No se han encontrado nuevos juegos descargados.",
    ultimate: "Flashpoint Ultimate ya incluye todos los juegos, por lo que sus juegos no se importan de forma automática.", notFound: "No se ha encontrado Flashpoint.", toast: "Juegos importados de Flashpoint:",
    promptTitle: "Juegos descargados con Flashpoint: {n}", promptMessage: "Selecciona los juegos que quieras incorporar a tu biblioteca.", selectAll: "Elegir todos", selectNone: "Desmarcar todos",
    importSelected: "Importar selección ({n})", skip: "Omitir", dontAsk: "No mostrar de nuevo esta pregunta",
  },
  fr: {
    autoImport: "Importer automatiquement les jeux téléchargés avec Flashpoint", promptToggle: "Me laisser choisir les jeux avant leur importation",
    hint: "Les jeux Flash (SWF) et Shockwave (DCR) compatibles rejoignent votre bibliothèque avec leur titre, leurs informations et leur logo. Les jeux que vous supprimez ou passez ne sont plus importés automatiquement, le bouton ci-dessous permet de les sélectionner de nouveau.",
    importNow: "Importer maintenant", importing: "Importation en cours…", imported: "Importation terminée : {n} jeu(x).", none: "Aucun jeu nouvellement téléchargé n’a été trouvé.",
    ultimate: "Flashpoint Ultimate comprend déjà l’ensemble des jeux, ses jeux ne sont donc pas importés automatiquement.", notFound: "Flashpoint n’a pas été trouvé.", toast: "Jeux importés de Flashpoint :",
    promptTitle: "Jeux téléchargés avec Flashpoint : {n}", promptMessage: "Sélectionnez les jeux à intégrer à votre bibliothèque.", selectAll: "Sélectionner tous les jeux", selectNone: "Désélectionner tous les jeux",
    importSelected: "Importer la sélection ({n})", skip: "Passer", dontAsk: "Ne plus afficher cette demande",
  },
  de: {
    autoImport: "Mit Flashpoint heruntergeladene Spiele automatisch übernehmen", promptToggle: "Vor dem Import nach der gewünschten Spieleauswahl fragen",
    hint: "Unterstützte Flash-Spiele (SWF) und Shockwave-Spiele (DCR) werden samt Titel, Informationen und Logo in deine Bibliothek aufgenommen. Von dir gelöschte oder übersprungene Spiele werden nicht wieder automatisch importiert. Mit der Schaltfläche unten kannst du sie erneut auswählen.",
    importNow: "Jetzt importieren", importing: "Import läuft…", imported: "Import abgeschlossen: {n} Spiel(e).", none: "Es wurden keine neu heruntergeladenen Spiele gefunden.",
    ultimate: "Flashpoint Ultimate bringt bereits sämtliche Spiele mit. Seine Spiele werden deshalb nicht automatisch importiert.", notFound: "Flashpoint konnte nicht gefunden werden.", toast: "Von Flashpoint übernommene Spiele:",
    promptTitle: "Mit Flashpoint heruntergeladene Spiele: {n}", promptMessage: "Wähle aus, welche Spiele in deine Bibliothek aufgenommen werden sollen.", selectAll: "Alles auswählen", selectNone: "Auswahl aufheben",
    importSelected: "Auswahl importieren ({n})", skip: "Überspringen", dontAsk: "Diese Nachfrage nicht erneut anzeigen",
  },
  "pt-BR": {
    autoImport: "Importar automaticamente jogos baixados pelo Flashpoint", promptToggle: "Permitir escolher os jogos antes da importação",
    hint: "Os jogos compatíveis de Flash (SWF) e Shockwave (DCR) entram na sua biblioteca com título, informações e logotipo. Jogos que você excluir ou pular não serão importados automaticamente outra vez, o botão abaixo permite selecioná-los novamente.",
    importNow: "Importar agora", importing: "Importação em andamento…", imported: "Foram importados {n} jogos.", none: "Não foram encontrados novos jogos baixados.",
    ultimate: "O Flashpoint Ultimate já inclui todos os jogos, por isso os jogos dele não são importados de maneira automática.", notFound: "Não foi possível localizar o Flashpoint.", toast: "Jogos importados do Flashpoint:",
    promptTitle: "Jogos baixados pelo Flashpoint: {n}", promptMessage: "Selecione os jogos que deseja incluir na sua biblioteca.", selectAll: "Marcar todos", selectNone: "Desmarcar todos",
    importSelected: "Importar seleção ({n})", skip: "Pular", dontAsk: "Não exibir esta pergunta de novo",
  },
  ja: {
    autoImport: "Flashpoint で入手したゲームを自動でインポートする", promptToggle: "インポート前に取り込むゲームを選ぶ",
    hint: "対応する Flash（SWF）と Shockwave（DCR）のゲームを、タイトル・詳細情報・ロゴとともにライブラリに登録します。削除またはスキップしたゲームは再度自動インポートされません。下のボタンから選び直せます。",
    importNow: "今すぐインポート", importing: "インポートしています…", imported: "ゲームを {n} 件取り込みました。", none: "新たにダウンロードされたゲームは見つかりませんでした。",
    ultimate: "Flashpoint Ultimate にはすでに全ゲームが収録されているので、ゲームは自動インポートされません。", notFound: "Flashpoint を検出できませんでした。", toast: "Flashpoint から取り込んだゲーム：",
    promptTitle: "Flashpoint でダウンロード済みのゲーム {n} 件", promptMessage: "ライブラリに登録するゲームを選んでください。", selectAll: "全件選択", selectNone: "すべての選択を解除",
    importSelected: "選択分をインポート（{n}）", skip: "スキップ", dontAsk: "この選択画面を今後表示しない",
  },
  ko: {
    autoImport: "Flashpoint로 받은 게임 자동으로 가져오기", promptToggle: "가져오기 전에 대상 게임 선택하기",
    hint: "지원하는 Flash(SWF) 및 Shockwave(DCR) 게임을 제목, 상세 정보, 로고와 함께 라이브러리에 등록합니다. 삭제했거나 건너뛴 게임은 다시 자동으로 가져오지 않습니다. 아래 버튼으로 해당 게임을 다시 선택할 수 있습니다.",
    importNow: "지금 가져오기", importing: "가져오고 있습니다…", imported: "게임 {n}개 가져오기를 완료했습니다.", none: "새롭게 다운로드된 게임을 찾지 못했습니다.",
    ultimate: "Flashpoint Ultimate는 모든 게임을 이미 포함하고 있으므로 게임을 자동으로 가져오지 않습니다.", notFound: "Flashpoint를 발견하지 못했습니다.", toast: "Flashpoint로부터 가져온 게임:",
    promptTitle: "Flashpoint로 받은 게임 {n}개", promptMessage: "라이브러리에 등록할 게임을 골라 주세요.", selectAll: "전체 선택", selectNone: "전체 선택 해제",
    importSelected: "선택 항목 가져오기 ({n})", skip: "건너뛰기", dontAsk: "앞으로 이 선택 창 표시하지 않기",
  },
  hi: {
    autoImport: "Flashpoint से डाउनलोड किए गए गेम अपने-आप इम्पोर्ट करें", promptToggle: "इम्पोर्ट करने से पहले गेम चुनने के लिए पूछें",
    hint: "समर्थित Flash (SWF) और Shockwave (DCR) गेम शीर्षक, जानकारी और लोगो सहित आपकी लाइब्रेरी में जुड़ते हैं। आपके हटाए या छोड़े हुए गेम दोबारा अपने-आप इम्पोर्ट नहीं होंगे। उन्हें फिर चुनने के लिए नीचे का बटन इस्तेमाल करें।",
    importNow: "अभी इम्पोर्ट करें", importing: "इम्पोर्ट जारी है…", imported: "{n} गेम इम्पोर्ट कर दिए गए।", none: "नए डाउनलोड किए गए गेम नहीं मिले।",
    ultimate: "Flashpoint Ultimate में सभी गेम पहले से मौजूद हैं, इसलिए उसके गेम अपने-आप इम्पोर्ट नहीं किए जाते।", notFound: "Flashpoint मिल नहीं सका।", toast: "Flashpoint से आए गेम:",
    promptTitle: "Flashpoint से डाउनलोड हुए गेम: {n}", promptMessage: "अपनी लाइब्रेरी में जोड़ने वाले गेम चुनें।", selectAll: "सब चुनें", selectNone: "सभी का चयन हटाएँ",
    importSelected: "चुने हुए इम्पोर्ट करें ({n})", skip: "छोड़ दें", dontAsk: "चुनने का यह संदेश दोबारा न दिखाएँ",
  },
  ar: {
    autoImport: "استيراد ما تُنزّله من ألعاب عبر Flashpoint تلقائيًا", promptToggle: "طلب اختيار الألعاب قبل بدء الاستيراد",
    hint: "تُدرج ألعاب Flash (SWF) وShockwave (DCR) المتوافقة في مكتبتك مع عناوينها ومعلوماتها وشعاراتها. الألعاب التي تحذفها أو تتجاوزها لن تُستورد تلقائيًا مرة أخرى، ويمكنك اختيارها من جديد بالزر أدناه.",
    importNow: "الاستيراد الآن", importing: "الاستيراد جارٍ…", imported: "اكتمل استيراد {n} لعبة.", none: "لم تُعثر على ألعاب منزّلة حديثًا.",
    ultimate: "يتضمن Flashpoint Ultimate جميع الألعاب أصلًا، لذا لا يُجرى استيراد ألعابه تلقائيًا.", notFound: "تعذّر العثور على Flashpoint.", toast: "الألعاب المستوردة من Flashpoint:",
    promptTitle: "الألعاب المنزّلة عبر Flashpoint: {n}", promptMessage: "حدّد الألعاب التي ترغب في ضمّها إلى مكتبتك.", selectAll: "اختيار الجميع", selectNone: "إلغاء اختيار الجميع",
    importSelected: "استيراد المحدد ({n})", skip: "تجاوز", dontAsk: "عدم عرض طلب الاختيار هذا مجددًا",
  },
  ru: {
    autoImport: "Автоматически добавлять игры, скачанные через Flashpoint", promptToggle: "Предлагать выбрать игры перед импортом",
    hint: "Поддерживаемые игры Flash (SWF) и Shockwave (DCR) попадают в библиотеку вместе с названием, описанием и логотипом. Игры, которые вы удалили или пропустили, больше не импортируются автоматически. Кнопка ниже позволяет выбрать их заново.",
    importNow: "Импортировать сейчас", importing: "Идёт импорт…", imported: "Добавлено игр: {n}.", none: "Новых скачанных игр не обнаружено.",
    ultimate: "В Flashpoint Ultimate уже есть все игры, поэтому его игры автоматически не импортируются.", notFound: "Не удалось найти Flashpoint.", toast: "Игры, добавленные из Flashpoint:",
    promptTitle: "Игры, скачанные через Flashpoint: {n}", promptMessage: "Отметьте игры для добавления в свою библиотеку.", selectAll: "Отметить все", selectNone: "Снять все отметки",
    importSelected: "Импортировать выбранные ({n})", skip: "Пропустить", dontAsk: "Не предлагать этот выбор снова",
  },
};

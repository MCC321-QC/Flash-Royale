import type { Language } from "./i18n";
import type { GuideFormat } from "./types";

interface GuideLabels {
  guides: string;
  open: string;
  openBeside: string;
  playerMenuEmpty: string;
  formats: Record<GuideFormat, string>;
  // Game settings editor
  settingsTitle: string;
  settingsDescription: string;
  supportedFormats: string;
  webNote: string;
  addFile: string;
  addLink: string;
  linkPlaceholder: string;
  titlePlaceholder: string;
  add: string;
  cancel: string;
  rename: string;
  save: string;
  remove: string;
  confirmRemove: string;
  moveUp: string;
  moveDown: string;
  // Reader
  loading: string;
  downloading: string;
  failed: string;
  contents: string;
  noContents: string;
  search: string;
  searchPlaceholder: string;
  searching: string;
  noResults: string;
  results: string;
  previousResult: string;
  nextResult: string;
  previousPage: string;
  nextPage: string;
  page: string;
  fitWidth: string;
  fitPage: string;
  centerViewer: string;
  theme: string;
  pageFilter: string;
  filterOriginal: string;
  filterInverted: string;
  themes: { dark: string; light: string; sepia: string };
  scrolled: string;
  twoPages: string;
  coverAlone: string;
  paginated: string;
  openInBrowser: string;
  turnPage: string;
  errors: Record<string, string>;
}

const formats = (values: Partial<Record<GuideFormat, string>>): Record<GuideFormat, string> => ({
  pdf: "PDF", epub: "EPUB", mobi: "MOBI", azw3: "Kindle AZW3", fb2: "FictionBook", fbz: "FictionBook", cbz: "CBZ",
  txt: "TXT", md: "Markdown", html: "HTML", image: "Image", video: "Video", web: "Web", ...values,
});

export const guideLabels: Record<Language, GuideLabels> = {
  en: {
    guides: "Guides", open: "Open", openBeside: "Open beside the game", playerMenuEmpty: "No guides yet. Add them in the game settings.",
    formats: formats({ cbz: "Comic (CBZ)", txt: "Text", image: "Image", video: "Video", web: "Web page" }),
    settingsTitle: "Guides and manuals",
    settingsDescription: "Add walkthroughs, manuals, e-books or videos. Files are copied into the game folder.",
    supportedFormats: "PDF, EPUB, MOBI, AZW3, FB2, CBZ, TXT, Markdown, HTML, images and videos",
    webNote: "Web pages open in your browser, videos and online documents open in the reader.",
    addFile: "Add a file", addLink: "Add a link", linkPlaceholder: "https://…", titlePlaceholder: "Title (optional)",
    add: "Add", cancel: "Cancel", rename: "Rename", save: "Save", remove: "Remove", confirmRemove: "Click again to remove",
    moveUp: "Move up", moveDown: "Move down",
    loading: "Opening the guide…", downloading: "Downloading the guide… {p}", failed: "This guide couldn't be opened.",
    contents: "Contents", noContents: "This guide has no table of contents.", search: "Search", searchPlaceholder: "Search in the guide",
    searching: "Searching…", noResults: "No results", results: "{n} results", previousResult: "Previous result", nextResult: "Next result",
    previousPage: "Previous page", nextPage: "Next page", page: "Page {n} of {total}", fitWidth: "Fit width", fitPage: "Fit page",
    centerViewer: "Center the viewer",
    pageFilter: "Page filter", filterOriginal: "Original", filterInverted: "Inverted",
    theme: "Theme: {name}", themes: { dark: "Dark", light: "Light", sepia: "Sepia" },
    twoPages: "Two pages side by side", coverAlone: "Show the first page (cover) alone",
    scrolled: "Continuous scrolling", paginated: "Pages", openInBrowser: "Open in browser", turnPage: "Turn page",
    errors: {
      GUIDE_INVALID_URL: "Enter a web address starting with https:// or http://.",
      GUIDE_UNSUPPORTED: "This kind of file can't be used as a guide.",
      GUIDE_LIMIT: "A game can have up to 100 guides.",
      GUIDE_TOO_LARGE: "This document is too large to download (200 MB at most).",
      GUIDE_DOWNLOAD_FAILED: "The document couldn't be downloaded.",
      GUIDE_NOT_FOUND: "This guide no longer exists.",
      GUIDE_INVALID_PATH: "This file can't be read.",
    },
  },
  zh: {
    guides: "指南", open: "打开", openBeside: "在游戏旁打开", playerMenuEmpty: "暂无指南。请前往游戏设置添加。",
    formats: formats({ cbz: "漫画（CBZ）", txt: "文本", image: "图片", video: "视频", web: "网页" }),
    settingsTitle: "指南与手册",
    settingsDescription: "添加攻略、手册、电子书或视频。文件会复制到游戏文件夹中。",
    supportedFormats: "PDF、EPUB、MOBI、AZW3、FB2、CBZ、TXT、Markdown、HTML、图片和视频",
    webNote: "网页会在浏览器中打开，视频和在线文档会在阅读器中打开。",
    addFile: "添加文件", addLink: "添加链接", linkPlaceholder: "https://…", titlePlaceholder: "标题（可选）",
    add: "添加", cancel: "取消", rename: "重命名", save: "保存", remove: "移除", confirmRemove: "再点击一次即可移除",
    moveUp: "上移", moveDown: "下移",
    loading: "正在打开指南…", downloading: "正在下载指南… {p}", failed: "无法打开此指南。",
    contents: "目录", noContents: "此指南没有目录。", search: "搜索", searchPlaceholder: "在指南中搜索",
    searching: "正在搜索…", noResults: "没有结果", results: "{n} 条结果", previousResult: "上一条结果", nextResult: "下一条结果",
    previousPage: "上一页", nextPage: "下一页", page: "第 {n} 页，共 {total} 页", fitWidth: "适应宽度", fitPage: "适应整页",
    centerViewer: "将阅读器居中",
    pageFilter: "页面滤镜", filterOriginal: "原始", filterInverted: "反色",
    theme: "主题：{name}", themes: { dark: "深色", light: "浅色", sepia: "褐色" },
    twoPages: "双页并排显示", coverAlone: "单独显示第一页（封面）",
    scrolled: "连续滚动", paginated: "分页", openInBrowser: "在浏览器中打开", turnPage: "翻页",
    errors: {
      GUIDE_INVALID_URL: "请输入以 https:// 或 http:// 开头的网址。",
      GUIDE_UNSUPPORTED: "此类文件无法用作指南。",
      GUIDE_LIMIT: "每个游戏最多可添加 100 份指南。",
      GUIDE_TOO_LARGE: "此文档过大，无法下载（最大 200 MB）。",
      GUIDE_DOWNLOAD_FAILED: "无法下载此文档。",
      GUIDE_NOT_FOUND: "此指南已不存在。",
      GUIDE_INVALID_PATH: "无法读取此文件。",
    },
  },
  es: {
    guides: "Guías", open: "Abrir", openBeside: "Abrir al lado del juego", playerMenuEmpty: "Todavía no hay guías. Añádelas en los ajustes del juego.",
    formats: formats({ cbz: "Cómic (CBZ)", txt: "Texto", image: "Imagen", video: "Vídeo", web: "Página web" }),
    settingsTitle: "Guías y manuales",
    settingsDescription: "Añade guías paso a paso, manuales, libros electrónicos o vídeos. Los archivos se copian en la carpeta del juego.",
    supportedFormats: "PDF, EPUB, MOBI, AZW3, FB2, CBZ, TXT, Markdown, HTML, imágenes y vídeos",
    webNote: "Las páginas web se abren en tu navegador, los vídeos y los documentos en línea se abren en el lector.",
    addFile: "Añadir un archivo", addLink: "Añadir un enlace", linkPlaceholder: "https://…", titlePlaceholder: "Título (opcional)",
    add: "Añadir", cancel: "Cancelar", rename: "Cambiar nombre", save: "Guardar", remove: "Quitar", confirmRemove: "Vuelve a hacer clic para quitar",
    moveUp: "Subir", moveDown: "Bajar",
    loading: "Abriendo la guía…", downloading: "Descargando la guía… {p}", failed: "No se ha podido abrir esta guía.",
    contents: "Índice", noContents: "Esta guía no tiene índice.", search: "Buscar", searchPlaceholder: "Buscar en la guía",
    searching: "Buscando…", noResults: "Sin resultados", results: "{n} resultados", previousResult: "Resultado anterior", nextResult: "Resultado siguiente",
    previousPage: "Página anterior", nextPage: "Página siguiente", page: "Página {n} de {total}", fitWidth: "Ajustar al ancho", fitPage: "Ajustar a la página",
    centerViewer: "Centrar el visor",
    pageFilter: "Filtro de página", filterOriginal: "Original", filterInverted: "Invertido",
    theme: "Tema: {name}", themes: { dark: "Oscuro", light: "Claro", sepia: "Sepia" },
    twoPages: "Dos páginas en paralelo", coverAlone: "Mostrar la primera página (portada) por separado",
    scrolled: "Desplazamiento continuo", paginated: "Páginas", openInBrowser: "Abrir en el navegador", turnPage: "Pasar página",
    errors: {
      GUIDE_INVALID_URL: "Introduce una dirección web que empiece por https:// o http://.",
      GUIDE_UNSUPPORTED: "Este tipo de archivo no se puede usar como guía.",
      GUIDE_LIMIT: "Cada juego puede tener hasta 100 guías.",
      GUIDE_TOO_LARGE: "El documento es demasiado grande para descargarlo (máximo 200 MB).",
      GUIDE_DOWNLOAD_FAILED: "No se ha podido descargar el documento.",
      GUIDE_NOT_FOUND: "Esta guía ya no existe.",
      GUIDE_INVALID_PATH: "No se puede leer este archivo.",
    },
  },
  fr: {
    guides: "Guides", open: "Ouvrir", openBeside: "Ouvrir à côté du jeu", playerMenuEmpty: "Aucun guide pour le moment. Ajoutez-en dans les paramètres du jeu.",
    formats: formats({ cbz: "Bande dessinée (CBZ)", txt: "Texte", image: "Image", video: "Vidéo", web: "Page web" }),
    settingsTitle: "Guides et manuels",
    settingsDescription: "Ajoutez des solutions pas à pas, des manuels, des livres numériques ou des vidéos. Les fichiers sont copiés dans le dossier du jeu.",
    supportedFormats: "PDF, EPUB, MOBI, AZW3, FB2, CBZ, TXT, Markdown, HTML, images et vidéos",
    webNote: "Les pages web s’ouvrent dans votre navigateur, les vidéos et les documents en ligne s’ouvrent dans le lecteur.",
    addFile: "Ajouter un fichier", addLink: "Ajouter un lien", linkPlaceholder: "https://…", titlePlaceholder: "Titre (facultatif)",
    add: "Ajouter", cancel: "Annuler", rename: "Renommer", save: "Enregistrer", remove: "Retirer", confirmRemove: "Cliquez une seconde fois pour retirer",
    moveUp: "Monter", moveDown: "Descendre",
    loading: "Ouverture du guide…", downloading: "Téléchargement du guide… {p}", failed: "Impossible d’ouvrir ce guide.",
    contents: "Sommaire", noContents: "Ce guide ne possède pas de sommaire.", search: "Rechercher", searchPlaceholder: "Rechercher dans le guide",
    searching: "Recherche…", noResults: "Aucun résultat", results: "{n} résultats", previousResult: "Résultat précédent", nextResult: "Résultat suivant",
    previousPage: "Page précédente", nextPage: "Page suivante", page: "Page {n} sur {total}", fitWidth: "Ajuster à la largeur", fitPage: "Ajuster à la page",
    centerViewer: "Centrer la visionneuse",
    pageFilter: "Filtre de page", filterOriginal: "Original", filterInverted: "Inversé",
    theme: "Thème : {name}", themes: { dark: "Sombre", light: "Clair", sepia: "Sépia" },
    twoPages: "Deux pages côte à côte", coverAlone: "Afficher séparément la première page (couverture)",
    scrolled: "Défilement continu", paginated: "Pages", openInBrowser: "Ouvrir dans le navigateur", turnPage: "Tourner la page",
    errors: {
      GUIDE_INVALID_URL: "Saisissez une adresse web commençant par https:// ou http://.",
      GUIDE_UNSUPPORTED: "Ce type de fichier ne peut pas être utilisé comme guide.",
      GUIDE_LIMIT: "Un jeu peut contenir jusqu’à 100 guides.",
      GUIDE_TOO_LARGE: "Ce document est trop volumineux pour être téléchargé (200 Mo maximum).",
      GUIDE_DOWNLOAD_FAILED: "Impossible de télécharger le document.",
      GUIDE_NOT_FOUND: "Ce guide n’existe plus.",
      GUIDE_INVALID_PATH: "Impossible de lire ce fichier.",
    },
  },
  de: {
    guides: "Anleitungen", open: "Öffnen", openBeside: "Neben dem Spiel öffnen", playerMenuEmpty: "Noch keine Anleitungen vorhanden. Füge sie in den Spieleinstellungen hinzu.",
    formats: formats({ cbz: "Comic (CBZ)", txt: "Text", image: "Bild", video: "Video", web: "Webseite" }),
    settingsTitle: "Anleitungen und Handbücher",
    settingsDescription: "Füge Komplettlösungen, Handbücher, E-Books oder Videos hinzu. Dateien werden in den Spielordner kopiert.",
    supportedFormats: "PDF, EPUB, MOBI, AZW3, FB2, CBZ, TXT, Markdown, HTML, Bilder und Videos",
    webNote: "Webseiten werden im Browser geöffnet, Videos und Online-Dokumente werden im Lesefenster geöffnet.",
    addFile: "Datei hinzufügen", addLink: "Link hinzufügen", linkPlaceholder: "https://…", titlePlaceholder: "Titel (optional)",
    add: "Hinzufügen", cancel: "Abbrechen", rename: "Umbenennen", save: "Speichern", remove: "Entfernen", confirmRemove: "Zum Entfernen nochmals klicken",
    moveUp: "Nach oben", moveDown: "Nach unten",
    loading: "Anleitung wird geöffnet…", downloading: "Anleitung wird heruntergeladen… {p}", failed: "Diese Anleitung konnte nicht geöffnet werden.",
    contents: "Inhaltsverzeichnis", noContents: "Diese Anleitung hat kein Inhaltsverzeichnis.", search: "Suchen", searchPlaceholder: "In der Anleitung suchen",
    searching: "Suche läuft…", noResults: "Keine Ergebnisse", results: "{n} Ergebnisse", previousResult: "Vorheriges Ergebnis", nextResult: "Nächstes Ergebnis",
    previousPage: "Vorherige Seite", nextPage: "Nächste Seite", page: "Seite {n} von {total}", fitWidth: "An Breite anpassen", fitPage: "An Seite anpassen",
    centerViewer: "Betrachter zentrieren",
    pageFilter: "Seitenfilter", filterOriginal: "Original", filterInverted: "Invertiert",
    theme: "Design: {name}", themes: { dark: "Dunkel", light: "Hell", sepia: "Sepia" },
    twoPages: "Zwei Seiten nebeneinander", coverAlone: "Erste Seite (Cover) einzeln anzeigen",
    scrolled: "Fortlaufendes Scrollen", paginated: "Seiten", openInBrowser: "Im Browser öffnen", turnPage: "Umblättern",
    errors: {
      GUIDE_INVALID_URL: "Gib eine Webadresse ein, die mit https:// oder http:// beginnt.",
      GUIDE_UNSUPPORTED: "Dieser Dateityp kann nicht als Anleitung verwendet werden.",
      GUIDE_LIMIT: "Ein Spiel kann bis zu 100 Anleitungen haben.",
      GUIDE_TOO_LARGE: "Dieses Dokument ist zu groß zum Herunterladen (höchstens 200 MB).",
      GUIDE_DOWNLOAD_FAILED: "Das Dokument konnte nicht heruntergeladen werden.",
      GUIDE_NOT_FOUND: "Diese Anleitung ist nicht mehr vorhanden.",
      GUIDE_INVALID_PATH: "Diese Datei kann nicht gelesen werden.",
    },
  },
  "pt-BR": {
    guides: "Guias", open: "Abrir", openBeside: "Abrir ao lado do jogo", playerMenuEmpty: "Ainda não há guias. Adicione-os nas configurações do jogo.",
    formats: formats({ cbz: "Quadrinhos (CBZ)", txt: "Texto", image: "Imagem", video: "Vídeo", web: "Página da web" }),
    settingsTitle: "Guias e manuais",
    settingsDescription: "Adicione detonados, manuais, livros digitais ou vídeos. Os arquivos são copiados para a pasta do jogo.",
    supportedFormats: "PDF, EPUB, MOBI, AZW3, FB2, CBZ, TXT, Markdown, HTML, imagens e vídeos",
    webNote: "As páginas da web abrem no navegador, vídeos e documentos on-line abrem no leitor.",
    addFile: "Adicionar um arquivo", addLink: "Adicionar um link", linkPlaceholder: "https://…", titlePlaceholder: "Título (opcional)",
    add: "Adicionar", cancel: "Cancelar", rename: "Renomear", save: "Salvar", remove: "Remover", confirmRemove: "Clique novamente para remover",
    moveUp: "Mover para cima", moveDown: "Mover para baixo",
    loading: "Abrindo o guia…", downloading: "Baixando o guia… {p}", failed: "Não foi possível abrir este guia.",
    contents: "Sumário", noContents: "Este guia não tem sumário.", search: "Buscar", searchPlaceholder: "Buscar no guia",
    searching: "Buscando…", noResults: "Nenhum resultado", results: "{n} resultados", previousResult: "Resultado anterior", nextResult: "Próximo resultado",
    previousPage: "Página anterior", nextPage: "Próxima página", page: "Página {n} de {total}", fitWidth: "Ajustar à largura", fitPage: "Ajustar à página",
    centerViewer: "Centralizar o visualizador",
    pageFilter: "Filtro da página", filterOriginal: "Original", filterInverted: "Invertido",
    theme: "Tema: {name}", themes: { dark: "Escuro", light: "Claro", sepia: "Sépia" },
    twoPages: "Duas páginas lado a lado", coverAlone: "Exibir a primeira página (capa) separadamente",
    scrolled: "Rolagem contínua", paginated: "Páginas", openInBrowser: "Abrir no navegador", turnPage: "Virar página",
    errors: {
      GUIDE_INVALID_URL: "Digite um endereço da web que comece com https:// ou http://.",
      GUIDE_UNSUPPORTED: "Este tipo de arquivo não pode ser usado como guia.",
      GUIDE_LIMIT: "Cada jogo pode ter até 100 guias.",
      GUIDE_TOO_LARGE: "Este documento é grande demais para baixar (no máximo 200 MB).",
      GUIDE_DOWNLOAD_FAILED: "Não foi possível baixar o documento.",
      GUIDE_NOT_FOUND: "Este guia não existe mais.",
      GUIDE_INVALID_PATH: "Não é possível ler este arquivo.",
    },
  },
  ja: {
    guides: "ガイド", open: "開く", openBeside: "ゲームの横に開く", playerMenuEmpty: "まだガイドはありません。ゲーム設定から追加してください。",
    formats: formats({ cbz: "コミック（CBZ）", txt: "テキスト", image: "画像", video: "動画", web: "ウェブページ" }),
    settingsTitle: "ガイドとマニュアル",
    settingsDescription: "攻略ガイド、マニュアル、電子書籍、動画を追加できます。ファイルはゲームのフォルダーにコピーされます。",
    supportedFormats: "PDF、EPUB、MOBI、AZW3、FB2、CBZ、TXT、Markdown、HTML、画像、動画",
    webNote: "ウェブページはブラウザーで開きます。動画とオンラインドキュメントはリーダーで開きます。",
    addFile: "ファイルを追加", addLink: "リンクを追加", linkPlaceholder: "https://…", titlePlaceholder: "タイトル（任意）",
    add: "追加", cancel: "キャンセル", rename: "名前を変更", save: "保存", remove: "削除", confirmRemove: "もう一度クリックすると削除します",
    moveUp: "上に移動", moveDown: "下に移動",
    loading: "ガイドを開いています…", downloading: "ガイドをダウンロードしています… {p}", failed: "このガイドを開けませんでした。",
    contents: "目次", noContents: "このガイドには目次がありません。", search: "検索", searchPlaceholder: "ガイド内を検索",
    searching: "検索しています…", noResults: "結果なし", results: "{n} 件の結果", previousResult: "前の結果", nextResult: "次の結果",
    previousPage: "前のページ", nextPage: "次のページ", page: "{total} ページ中 {n} ページ", fitWidth: "幅に合わせる", fitPage: "ページ全体を表示",
    centerViewer: "ビューアーを中央に配置",
    pageFilter: "ページフィルター", filterOriginal: "元の色", filterInverted: "色を反転",
    theme: "テーマ：{name}", themes: { dark: "ダーク", light: "ライト", sepia: "セピア" },
    twoPages: "2 ページを横に並べる", coverAlone: "最初のページ（表紙）を単独で表示",
    scrolled: "連続スクロール", paginated: "ページ表示", openInBrowser: "ブラウザーで開く", turnPage: "ページをめくる",
    errors: {
      GUIDE_INVALID_URL: "https:// または http:// で始まるウェブアドレスを入力してください。",
      GUIDE_UNSUPPORTED: "この種類のファイルはガイドとして使用できません。",
      GUIDE_LIMIT: "1 つのゲームに追加できるガイドは 100 件までです。",
      GUIDE_TOO_LARGE: "このドキュメントは大きすぎるためダウンロードできません（最大 200 MB）。",
      GUIDE_DOWNLOAD_FAILED: "ドキュメントをダウンロードできませんでした。",
      GUIDE_NOT_FOUND: "このガイドはすでに削除されています。",
      GUIDE_INVALID_PATH: "このファイルは読み取れません。",
    },
  },
  ko: {
    guides: "가이드", open: "열기", openBeside: "게임 옆에 열기", playerMenuEmpty: "아직 가이드가 없습니다. 게임 설정에서 추가하세요.",
    formats: formats({ cbz: "만화 (CBZ)", txt: "텍스트", image: "이미지", video: "동영상", web: "웹 페이지" }),
    settingsTitle: "가이드 및 설명서",
    settingsDescription: "공략, 설명서, 전자책 또는 동영상을 추가하세요. 파일은 게임 폴더에 복사됩니다.",
    supportedFormats: "PDF, EPUB, MOBI, AZW3, FB2, CBZ, TXT, Markdown, HTML, 이미지 및 동영상",
    webNote: "웹 페이지는 브라우저에서 열리고, 동영상과 온라인 문서는 리더에서 열립니다.",
    addFile: "파일 추가", addLink: "링크 추가", linkPlaceholder: "https://…", titlePlaceholder: "제목 (선택 사항)",
    add: "추가", cancel: "취소", rename: "이름 바꾸기", save: "저장", remove: "제거", confirmRemove: "한 번 더 클릭하여 제거",
    moveUp: "위로 이동", moveDown: "아래로 이동",
    loading: "가이드를 여는 중…", downloading: "가이드를 다운로드하는 중… {p}", failed: "이 가이드를 열지 못했습니다.",
    contents: "목차", noContents: "이 가이드에는 목차가 없습니다.", search: "검색", searchPlaceholder: "가이드에서 검색",
    searching: "검색 중…", noResults: "검색 결과 없음", results: "결과 {n}개", previousResult: "이전 결과", nextResult: "다음 결과",
    previousPage: "이전 페이지", nextPage: "다음 페이지", page: "전체 {total}페이지 중 {n}페이지", fitWidth: "너비에 맞추기", fitPage: "페이지에 맞추기",
    centerViewer: "뷰어를 가운데로 이동",
    pageFilter: "페이지 필터", filterOriginal: "원본", filterInverted: "색상 반전",
    theme: "테마: {name}", themes: { dark: "어두운 테마", light: "밝은 테마", sepia: "세피아" },
    twoPages: "두 페이지 나란히 표시", coverAlone: "첫 페이지 (표지)를 따로 표시",
    scrolled: "연속 스크롤", paginated: "페이지", openInBrowser: "브라우저에서 열기", turnPage: "페이지 넘기기",
    errors: {
      GUIDE_INVALID_URL: "https:// 또는 http://로 시작하는 웹 주소를 입력하세요.",
      GUIDE_UNSUPPORTED: "이 파일 형식은 가이드로 사용할 수 없습니다.",
      GUIDE_LIMIT: "게임 하나에 가이드를 최대 100개까지 추가할 수 있습니다.",
      GUIDE_TOO_LARGE: "문서가 너무 커서 다운로드할 수 없습니다 (최대 200 MB).",
      GUIDE_DOWNLOAD_FAILED: "문서를 다운로드하지 못했습니다.",
      GUIDE_NOT_FOUND: "이 가이드는 더 이상 존재하지 않습니다.",
      GUIDE_INVALID_PATH: "이 파일을 읽을 수 없습니다.",
    },
  },
  hi: {
    guides: "गाइड", open: "खोलें", openBeside: "गेम के बगल में खोलें", playerMenuEmpty: "अभी कोई गाइड नहीं है। गेम की सेटिंग में जाकर जोड़ें।",
    formats: formats({ cbz: "कॉमिक (CBZ)", txt: "टेक्स्ट", image: "चित्र", video: "वीडियो", web: "वेब पृष्ठ" }),
    settingsTitle: "गाइड और मैनुअल",
    settingsDescription: "खेलने की चरणबद्ध गाइड, मैनुअल, ई-बुक या वीडियो जोड़ें। फ़ाइलें गेम के फ़ोल्डर में कॉपी की जाती हैं।",
    supportedFormats: "PDF, EPUB, MOBI, AZW3, FB2, CBZ, TXT, Markdown, HTML, चित्र और वीडियो",
    webNote: "वेब पृष्ठ आपके ब्राउज़र में खुलते हैं, वीडियो और ऑनलाइन दस्तावेज़ रीडर में खुलते हैं।",
    addFile: "फ़ाइल जोड़ें", addLink: "लिंक जोड़ें", linkPlaceholder: "https://…", titlePlaceholder: "शीर्षक (वैकल्पिक)",
    add: "जोड़ें", cancel: "रद्द करें", rename: "नाम बदलें", save: "सहेजें", remove: "हटाएँ", confirmRemove: "हटाने के लिए दोबारा क्लिक करें",
    moveUp: "ऊपर ले जाएँ", moveDown: "नीचे ले जाएँ",
    loading: "गाइड खुल रही है…", downloading: "गाइड डाउनलोड हो रही है… {p}", failed: "यह गाइड खोली नहीं जा सकी।",
    contents: "विषय-सूची", noContents: "इस गाइड में विषय-सूची नहीं है।", search: "खोजें", searchPlaceholder: "गाइड में खोजें",
    searching: "खोज जारी है…", noResults: "कोई नतीजा नहीं", results: "{n} नतीजे", previousResult: "पिछला नतीजा", nextResult: "अगला नतीजा",
    previousPage: "पिछला पृष्ठ", nextPage: "अगला पृष्ठ", page: "पृष्ठ {n}, कुल {total}", fitWidth: "चौड़ाई में फ़िट करें", fitPage: "पूरा पृष्ठ फ़िट करें",
    centerViewer: "व्यूअर को बीच में रखें",
    pageFilter: "पृष्ठ का फ़िल्टर", filterOriginal: "मूल", filterInverted: "उलटे रंग",
    theme: "थीम: {name}", themes: { dark: "गहरी", light: "हल्की", sepia: "सेपिया" },
    twoPages: "दो पृष्ठ साथ-साथ", coverAlone: "पहला पृष्ठ (कवर) अकेला दिखाएँ",
    scrolled: "लगातार स्क्रॉल", paginated: "पृष्ठ", openInBrowser: "ब्राउज़र में खोलें", turnPage: "पृष्ठ पलटें",
    errors: {
      GUIDE_INVALID_URL: "https:// या http:// से शुरू होने वाला वेब पता दर्ज करें।",
      GUIDE_UNSUPPORTED: "इस प्रकार की फ़ाइल को गाइड के रूप में इस्तेमाल नहीं किया जा सकता।",
      GUIDE_LIMIT: "एक गेम में अधिकतम 100 गाइड हो सकती हैं।",
      GUIDE_TOO_LARGE: "यह दस्तावेज़ डाउनलोड करने के लिए बहुत बड़ा है (अधिकतम 200 MB)।",
      GUIDE_DOWNLOAD_FAILED: "दस्तावेज़ डाउनलोड नहीं किया जा सका।",
      GUIDE_NOT_FOUND: "यह गाइड अब मौजूद नहीं है।",
      GUIDE_INVALID_PATH: "यह फ़ाइल पढ़ी नहीं जा सकती।",
    },
  },
  ar: {
    guides: "الأدلة", open: "فتح", openBeside: "فتح بجانب اللعبة", playerMenuEmpty: "لا توجد أدلة بعد. أضفها من إعدادات اللعبة.",
    formats: formats({ cbz: "قصص مصوّرة (CBZ)", txt: "نص", image: "صورة", video: "فيديو", web: "صفحة ويب" }),
    settingsTitle: "الأدلة وكتيّبات الاستخدام",
    settingsDescription: "أضف شروحات اللعب أو الكتيّبات أو الكتب الإلكترونية أو الفيديوهات. تُنسخ الملفات إلى مجلد اللعبة.",
    supportedFormats: "PDF وEPUB وMOBI وAZW3 وFB2 وCBZ وTXT وMarkdown وHTML والصور والفيديوهات",
    webNote: "تُفتح صفحات الويب في متصفحك، وتُفتح الفيديوهات والمستندات عبر الإنترنت في القارئ.",
    addFile: "إضافة ملف", addLink: "إضافة رابط", linkPlaceholder: "https://…", titlePlaceholder: "العنوان (اختياري)",
    add: "إضافة", cancel: "إلغاء", rename: "إعادة التسمية", save: "حفظ", remove: "إزالة", confirmRemove: "انقر مرة أخرى للإزالة",
    moveUp: "نقل لأعلى", moveDown: "نقل لأسفل",
    loading: "جارٍ فتح الدليل…", downloading: "جارٍ تنزيل الدليل… {p}", failed: "تعذّر فتح هذا الدليل.",
    contents: "المحتويات", noContents: "لا يحتوي هذا الدليل على فهرس.", search: "بحث", searchPlaceholder: "البحث في الدليل",
    searching: "جارٍ البحث…", noResults: "لا نتائج", results: "{n} من النتائج", previousResult: "النتيجة السابقة", nextResult: "النتيجة التالية",
    previousPage: "الصفحة السابقة", nextPage: "الصفحة التالية", page: "الصفحة {n} من {total}", fitWidth: "ملاءمة العرض", fitPage: "ملاءمة الصفحة",
    centerViewer: "توسيط العارض",
    pageFilter: "مرشّح الصفحة", filterOriginal: "الأصل", filterInverted: "ألوان معكوسة",
    theme: "المظهر: {name}", themes: { dark: "داكن", light: "فاتح", sepia: "بني داكن" },
    twoPages: "صفحتان جنبًا إلى جنب", coverAlone: "عرض الصفحة الأولى (الغلاف) وحدها",
    scrolled: "تمرير مستمر", paginated: "صفحات", openInBrowser: "فتح في المتصفح", turnPage: "تقليب الصفحة",
    errors: {
      GUIDE_INVALID_URL: "أدخل عنوان ويب يبدأ بـ https:// أو http://.",
      GUIDE_UNSUPPORTED: "لا يمكن استخدام هذا النوع من الملفات كدليل.",
      GUIDE_LIMIT: "يمكن إضافة ما يصل إلى 100 دليل لكل لعبة.",
      GUIDE_TOO_LARGE: "هذا المستند أكبر من أن يُنزّل (الحد الأقصى 200 MB).",
      GUIDE_DOWNLOAD_FAILED: "تعذّر تنزيل المستند.",
      GUIDE_NOT_FOUND: "لم يعد هذا الدليل موجودًا.",
      GUIDE_INVALID_PATH: "لا يمكن قراءة هذا الملف.",
    },
  },
  ru: {
    guides: "Руководства", open: "Открыть", openBeside: "Открыть рядом с игрой", playerMenuEmpty: "Руководств пока нет. Добавьте их в настройках игры.",
    formats: formats({ cbz: "Комикс (CBZ)", txt: "Текст", image: "Изображение", video: "Видео", web: "Веб-страница" }),
    settingsTitle: "Руководства и инструкции",
    settingsDescription: "Добавляйте прохождения, инструкции, электронные книги или видео. Файлы копируются в папку игры.",
    supportedFormats: "PDF, EPUB, MOBI, AZW3, FB2, CBZ, TXT, Markdown, HTML, изображения и видео",
    webNote: "Веб-страницы открываются в браузере, а видео и онлайн-документы — в окне чтения.",
    addFile: "Добавить файл", addLink: "Добавить ссылку", linkPlaceholder: "https://…", titlePlaceholder: "Название (необязательно)",
    add: "Добавить", cancel: "Отмена", rename: "Переименовать", save: "Сохранить", remove: "Удалить", confirmRemove: "Нажмите ещё раз для удаления",
    moveUp: "Поднять", moveDown: "Опустить",
    loading: "Открывается руководство…", downloading: "Скачивается руководство… {p}", failed: "Не удалось открыть это руководство.",
    contents: "Оглавление", noContents: "В этом руководстве нет оглавления.", search: "Поиск", searchPlaceholder: "Искать в руководстве",
    searching: "Поиск…", noResults: "Нет результатов", results: "Результатов: {n}", previousResult: "Предыдущий результат", nextResult: "Следующий результат",
    previousPage: "Предыдущая страница", nextPage: "Следующая страница", page: "Страница {n} из {total}", fitWidth: "По ширине", fitPage: "Страница целиком",
    centerViewer: "Центрировать окно просмотра",
    pageFilter: "Фильтр страницы", filterOriginal: "Исходные цвета", filterInverted: "Инверсия цветов",
    theme: "Тема: {name}", themes: { dark: "Тёмная", light: "Светлая", sepia: "Сепия" },
    twoPages: "Две страницы рядом", coverAlone: "Показывать первую страницу (обложку) отдельно",
    scrolled: "Непрерывная прокрутка", paginated: "Страницы", openInBrowser: "Открыть в браузере", turnPage: "Перелистнуть",
    errors: {
      GUIDE_INVALID_URL: "Введите веб-адрес, начинающийся с https:// или http://.",
      GUIDE_UNSUPPORTED: "Этот тип файла нельзя использовать как руководство.",
      GUIDE_LIMIT: "К игре можно добавить не более 100 руководств.",
      GUIDE_TOO_LARGE: "Документ слишком велик для скачивания (не более 200 МБ).",
      GUIDE_DOWNLOAD_FAILED: "Не удалось скачать документ.",
      GUIDE_NOT_FOUND: "Это руководство больше не существует.",
      GUIDE_INVALID_PATH: "Невозможно прочитать этот файл.",
    },
  },
};

export function guideErrorMessage(error: unknown, language: Language) {
  const text = String((error as Error)?.message || error || "");
  const code = /GUIDE_[A-Z_]+/.exec(text)?.[0];
  return code ? guideLabels[language].errors[code] ?? null : null;
}

export const guideVideoLabels: Record<Language, {
  play: string; pause: string; controlVideo: string; movePointer: string;
  seek: string; click: string; back: string; failed: string; rewind: string; forward: string;
}> = {
  en: { rewind: "Rewind 10 seconds", forward: "Skip forward 10 seconds", play: "Play", pause: "Pause", controlVideo: "Control video", movePointer: "Move pointer", seek: "Rewind / fast-forward", click: "Click", back: "Back to top bar", failed: "Unable to control the guide video. Try reopening the guide." },
  zh: { rewind: "快退10秒", forward: "快进10秒", play: "播放", pause: "暂停", controlVideo: "控制视频", movePointer: "移动指针", seek: "快退 / 快进", click: "点击", back: "返回顶部栏", failed: "无法控制攻略视频。请尝试重新打开攻略。" },
  es: { rewind: "Retroceder 10 segundos", forward: "Avanzar 10 segundos", play: "Reproducir", pause: "Pausar", controlVideo: "Controlar vídeo", movePointer: "Mover puntero", seek: "Retroceder / avanzar", click: "Hacer clic", back: "Volver a la barra superior", failed: "No se puede controlar el vídeo de la guía. Prueba a abrir la guía de nuevo." },
  fr: { rewind: "Reculer de 10 secondes", forward: "Avancer de 10 secondes", play: "Lire", pause: "Mettre en pause", controlVideo: "Contrôler la vidéo", movePointer: "Déplacer le pointeur", seek: "Reculer / avancer", click: "Cliquer", back: "Retour à la barre du haut", failed: "Impossible de contrôler la vidéo du guide. Essayez de rouvrir le guide." },
  de: { rewind: "10 Sekunden zurückspulen", forward: "10 Sekunden vorspulen", play: "Abspielen", pause: "Pausieren", controlVideo: "Video steuern", movePointer: "Zeiger bewegen", seek: "Zurück- / vorspulen", click: "Klicken", back: "Zurück zur oberen Leiste", failed: "Das Anleitungsvideo kann nicht gesteuert werden. Öffne die Anleitung erneut." },
  "pt-BR": { rewind: "Retroceder 10 segundos", forward: "Avançar 10 segundos", play: "Reproduzir", pause: "Pausar", controlVideo: "Controlar vídeo", movePointer: "Mover ponteiro", seek: "Retroceder / avançar", click: "Clicar", back: "Voltar à barra superior", failed: "Não foi possível controlar o vídeo do guia. Tente reabrir o guia." },
  ja: { rewind: "10秒巻き戻す", forward: "10秒早送り", play: "再生", pause: "一時停止", controlVideo: "動画を操作", movePointer: "ポインターを移動", seek: "巻き戻し / 早送り", click: "クリック", back: "上部バーに戻る", failed: "ガイド動画を操作できません。ガイドを開き直してください。" },
  ko: { rewind: "10초 되감기", forward: "10초 앞으로", play: "재생", pause: "일시 정지", controlVideo: "동영상 조작", movePointer: "포인터 이동", seek: "되감기 / 빨리 감기", click: "클릭", back: "상단 표시줄로 돌아가기", failed: "가이드 동영상을 조작할 수 없습니다. 가이드를 다시 열어 보세요." },
  hi: { rewind: "10 सेकंड पीछे जाएँ", forward: "10 सेकंड आगे जाएँ", play: "चलाएँ", pause: "रोकें", controlVideo: "वीडियो नियंत्रित करें", movePointer: "पॉइंटर चलाएँ", seek: "पीछे / आगे करें", click: "क्लिक करें", back: "शीर्ष बार पर लौटें", failed: "गाइड वीडियो नियंत्रित नहीं हो सका। गाइड फिर से खोलें।" },
  ar: { rewind: "ترجيع 10 ثوانٍ", forward: "تقديم 10 ثوانٍ", play: "تشغيل", pause: "إيقاف مؤقت", controlVideo: "التحكم في الفيديو", movePointer: "تحريك المؤشر", seek: "ترجيع / تقديم", click: "نقر", back: "العودة إلى الشريط العلوي", failed: "تعذر التحكم في فيديو الدليل. حاول إعادة فتح الدليل." },
  ru: { rewind: "Назад на 10 секунд", forward: "Вперёд на 10 секунд", play: "Воспроизвести", pause: "Пауза", controlVideo: "Управлять видео", movePointer: "Переместить указатель", seek: "Назад / вперёд", click: "Щёлкнуть", back: "Вернуться к верхней панели", failed: "Не удалось управлять видео руководства. Попробуйте открыть руководство снова." },
};

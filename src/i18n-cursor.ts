import type { Language } from "./i18n";
import type { BuiltinCursorId, CursorSlot } from "./cursor-theme";

interface CursorText {
  title: string;
  description: string;
  styles: Record<BuiltinCursorId | "system" | "custom", string>;
  importFailed: string;
  dialogTitle: string;
  filterName: string;
  hotspot: string;
  hotspotTopLeft: string;
  hotspotCenter: string;
  hotspotFile: string;
  size: string;
  sizeSmall: string;
  sizeMedium: string;
  sizeLarge: string;
  largeHint: string;
  hideAfter: string;
  never: string;
  seconds: string;
}

export const cursorLabels: Record<Language, CursorText> = {
  en: {
    title: "Mouse cursor", description: "Used for the mouse pointer in every Flash Royale window and in games opened in the built-in player, including the controller/trackpad cursor. External players keep their own cursor.",
    styles: { system: "System", flash: "Flash classic", royal: "Royal gold", spade: "Ace of spades", diamond: "Red diamond", crosshair: "Arcade crosshair", custom: "Custom" },
    importFailed: "This image can't be used as a cursor.", dialogTitle: "Choose a cursor image", filterName: "Cursor images",
    hotspot: "Click point", hotspotTopLeft: "Top-left corner", hotspotCenter: "Center", hotspotFile: "From the .cur file",
    size: "Size", sizeSmall: "Small", sizeMedium: "Medium", sizeLarge: "Large", largeHint: "Large cursors switch to the system cursor near window edges.",
    hideAfter: "Hide controller cursor when idle", never: "Never", seconds: "{n} s",
  },
  zh: {
    title: "鼠标光标", description: "应用于 Flash Royale 每个窗口以及内置播放器所打开游戏中的鼠标指针，也包括手柄/触控板控制的光标。外部播放器会保留自身的光标。",
    styles: { system: "系统", flash: "经典 Flash", royal: "皇室金色", spade: "黑桃 A", diamond: "红色方块", crosshair: "街机十字准星", custom: "自定义" },
    importFailed: "这张图像不能用作光标。", dialogTitle: "选取光标图像", filterName: "光标图像",
    hotspot: "点击点", hotspotTopLeft: "左上角", hotspotCenter: "正中心", hotspotFile: "取自 .cur 文件",
    size: "尺寸", sizeSmall: "小", sizeMedium: "中等", sizeLarge: "大", largeHint: "大型光标靠近窗口边界时会改用系统光标。",
    hideAfter: "闲置时隐藏手柄光标", never: "从不", seconds: "{n} 秒",
  },
  es: {
    title: "Puntero del ratón", description: "Se aplica al puntero del ratón de todas las ventanas de Flash Royale y de los juegos que se abren con el reproductor incorporado, incluido el cursor del mando/panel táctil. Los reproductores externos conservan su propio cursor.",
    styles: { system: "Sistema", flash: "Clásico de Flash", royal: "Dorado real", spade: "As de picas", diamond: "Rombo rojo", crosshair: "Retícula arcade", custom: "Personalizado" },
    importFailed: "No es posible emplear esta imagen como cursor.", dialogTitle: "Seleccionar imagen para el cursor", filterName: "Imágenes para cursores",
    hotspot: "Punto de pulsación", hotspotTopLeft: "Esquina de arriba a la izquierda", hotspotCenter: "Centro", hotspotFile: "Tomado del archivo .cur",
    size: "Tamaño", sizeSmall: "Pequeño", sizeMedium: "Mediano", sizeLarge: "Grande", largeHint: "Al acercarse a los bordes de la ventana, los cursores grandes pasan al cursor del sistema.",
    hideAfter: "Ocultar el cursor del mando si está inactivo", never: "Nunca", seconds: "{n} s",
  },
  fr: {
    title: "Pointeur de souris", description: "S'applique au pointeur de souris de chaque fenêtre de Flash Royale et des jeux ouverts avec le lecteur intégré, y compris au curseur de manette/pavé tactile. Les lecteurs externes conservent leur curseur.",
    styles: { system: "Système", flash: "Classique Flash", royal: "Doré royal", spade: "As de pique", diamond: "Carreau rouge", crosshair: "Réticule d'arcade", custom: "Personnalisé" },
    importFailed: "Impossible d'utiliser cette image comme curseur.", dialogTitle: "Sélectionner une image pour le curseur", filterName: "Images pour curseurs",
    hotspot: "Point de clic", hotspotTopLeft: "Angle supérieur gauche", hotspotCenter: "Centre", hotspotFile: "Défini dans le fichier .cur",
    size: "Taille", sizeSmall: "Petite", sizeMedium: "Moyenne", sizeLarge: "Grande", largeHint: "À proximité des bords de la fenêtre, les grands curseurs laissent place au curseur du système.",
    hideAfter: "Cacher le curseur de manette lorsqu'il est inactif", never: "Jamais", seconds: "{n} s",
  },
  de: {
    title: "Mauscursor", description: "Gilt für den Mauszeiger in jedem Fenster von Flash Royale und in Spielen, die im integrierten Player geöffnet werden, einschließlich des Controller-/Trackpad-Cursors. Externe Player verwenden weiterhin ihren eigenen Cursor.",
    styles: { system: "System", flash: "Klassischer Flash-Zeiger", royal: "Königliches Gold", spade: "Pik-Ass", diamond: "Rote Raute", crosshair: "Arcade-Zielkreuz", custom: "Benutzerdefiniert" },
    importFailed: "Dieses Bild eignet sich nicht als Cursor.", dialogTitle: "Bild für den Cursor wählen", filterName: "Bilder für Cursor",
    hotspot: "Klickstelle", hotspotTopLeft: "Linke obere Ecke", hotspotCenter: "Zentrum", hotspotFile: "Vorgabe aus der .cur-Datei",
    size: "Größe", sizeSmall: "Klein", sizeMedium: "Mittel", sizeLarge: "Groß", largeHint: "Nahe am Fensterrand werden große Cursor durch den Systemcursor ersetzt.",
    hideAfter: "Controller-Cursor im Leerlauf verbergen", never: "Nie", seconds: "{n} s",
  },
  "pt-BR": {
    title: "Ponteiro do mouse", description: "Aplica-se ao ponteiro do mouse de cada janela do Flash Royale e dos jogos abertos com o player incorporado, incluindo o cursor do controle/trackpad. Players externos mantêm o próprio cursor.",
    styles: { system: "Sistema", flash: "Clássico do Flash", royal: "Dourado real", spade: "Ás de espadas", diamond: "Losango vermelho", crosshair: "Retículo de arcade", custom: "Personalizado" },
    importFailed: "Não é possível usar esta imagem como cursor.", dialogTitle: "Selecionar imagem para o cursor", filterName: "Imagens para cursores",
    hotspot: "Ponto de acionamento", hotspotTopLeft: "Canto de cima à esquerda", hotspotCenter: "Centro", hotspotFile: "Definido no arquivo .cur",
    size: "Tamanho", sizeSmall: "Pequeno", sizeMedium: "Médio", sizeLarge: "Grande", largeHint: "Ao se aproximar das bordas da janela, cursores grandes passam para o cursor do sistema.",
    hideAfter: "Esconder o cursor do controle quando parado", never: "Nunca", seconds: "{n} s",
  },
  ja: {
    title: "マウスのカーソル", description: "Flash Royale の各ウィンドウと内蔵プレイヤーで起動したゲームのマウスポインターに適用されます。コントローラー/トラックパッドで動かすカーソルも対象です。外部プレイヤーはそれぞれのカーソルをそのまま使います。",
    styles: { system: "システム", flash: "クラシック Flash", royal: "王家の金色", spade: "スペードのエース", diamond: "赤いダイヤ", crosshair: "アーケードの照準", custom: "カスタム" },
    importFailed: "この画像をカーソルには使えません。", dialogTitle: "カーソル用の画像を選ぶ", filterName: "カーソル用画像",
    hotspot: "クリックする点", hotspotTopLeft: "左上の角", hotspotCenter: "中心", hotspotFile: ".cur ファイルから取得",
    size: "大きさ", sizeSmall: "小", sizeMedium: "中", sizeLarge: "大", largeHint: "大きなカーソルは、ウィンドウの端に近づくとシステムのカーソルに変わります。",
    hideAfter: "未操作時にコントローラーのカーソルを非表示", never: "隠さない", seconds: "{n} 秒",
  },
  ko: {
    title: "마우스의 커서", description: "Flash Royale의 각 창 및 내장 플레이어로 실행한 게임의 마우스 포인터에 적용됩니다. 컨트롤러/트랙패드로 움직이는 커서도 포함됩니다. 외부 플레이어는 고유 커서를 그대로 씁니다.",
    styles: { system: "시스템", flash: "클래식 Flash", royal: "왕실 금색", spade: "스페이드 에이스", diamond: "빨간 다이아몬드", crosshair: "아케이드 십자선", custom: "사용자 지정" },
    importFailed: "이 그림을 커서로 쓸 수 없습니다.", dialogTitle: "커서에 쓸 이미지 고르기", filterName: "커서용 이미지",
    hotspot: "클릭 위치", hotspotTopLeft: "왼쪽 위 꼭짓점", hotspotCenter: "중앙", hotspotFile: ".cur 파일에서 가져오기",
    size: "크기", sizeSmall: "작음", sizeMedium: "중간", sizeLarge: "큼", largeHint: "큰 커서는 창 테두리에 가까워지면 시스템의 커서로 전환됩니다.",
    hideAfter: "움직임이 없을 때 컨트롤러 커서 감추기", never: "안 함", seconds: "{n}초",
  },
  hi: {
    title: "माउस का कर्सर", description: "Flash Royale की सभी विंडो और अंतर्निहित प्लेयर में खोले गए गेम के माउस पॉइंटर पर लागू होता है। इसमें कंट्रोलर/ट्रैकपैड वाला कर्सर भी शामिल है। बाहरी प्लेयर अपना ही कर्सर बनाए रखते हैं।",
    styles: { system: "सिस्टम", flash: "क्लासिक Flash", royal: "शाही सुनहरा", spade: "हुकुम का इक्का", diamond: "लाल हीरा", crosshair: "आर्केड का निशाना", custom: "कस्टम" },
    importFailed: "यह चित्र कर्सर के तौर पर इस्तेमाल नहीं हो सकता।", dialogTitle: "कर्सर के लिए चित्र चुनें", filterName: "कर्सर के चित्र",
    hotspot: "क्लिक करने का बिंदु", hotspotTopLeft: "ऊपर बाईं तरफ़ का कोना", hotspotCenter: "केंद्र", hotspotFile: ".cur फ़ाइल वाला",
    size: "माप", sizeSmall: "छोटा", sizeMedium: "मध्यम", sizeLarge: "बड़ा", largeHint: "बड़े कर्सर विंडो की सीमाओं के नज़दीक पहुँचने पर सिस्टम कर्सर बन जाते हैं।",
    hideAfter: "इस्तेमाल न होने पर कंट्रोलर का कर्सर छिपाएँ", never: "कभी नहीं", seconds: "{n} सेकंड",
  },
  ar: {
    title: "مؤشر الماوس", description: "يطبَّق على مؤشر الفأرة في جميع نوافذ Flash Royale والألعاب التي تُفتح بالمشغّل المدمج، ويشمل مؤشر وحدة التحكم/لوحة اللمس. تظل للمشغّلات الخارجية مؤشراتها الخاصة.",
    styles: { system: "النظام", flash: "Flash التقليدي", royal: "ذهبي ملكي", spade: "آس البستوني", diamond: "معيّن أحمر", crosshair: "شعيرة تصويب أركيد", custom: "مخصّص" },
    importFailed: "هذه الصورة غير قابلة للاستخدام كمؤشر.", dialogTitle: "تحديد صورة للمؤشر", filterName: "صور للمؤشرات",
    hotspot: "موضع النقر", hotspotTopLeft: "الركن العلوي الأيسر", hotspotCenter: "المركز", hotspotFile: "المحدّد في ملف .cur",
    size: "الحجم", sizeSmall: "صغير", sizeMedium: "متوسط", sizeLarge: "كبير", largeHint: "عند الاقتراب من أطراف النافذة، تُستبدل المؤشرات الكبيرة بمؤشر النظام.",
    hideAfter: "إخفاء مؤشر وحدة التحكم حين يكون ساكنًا", never: "أبدًا", seconds: "{n} ث",
  },
  ru: {
    title: "Указатель мыши", description: "Применяется к указателю мыши в каждом окне Flash Royale и в играх, запущенных встроенным плеером, в том числе к курсору контроллера/трекпада. Сторонние плееры сохраняют свои курсоры.",
    styles: { system: "Системный", flash: "Классический Flash", royal: "Королевский золотой", spade: "Туз пик", diamond: "Красный ромб", crosshair: "Аркадное перекрестие", custom: "Пользовательский" },
    importFailed: "Использовать эту картинку в качестве курсора нельзя.", dialogTitle: "Выбрать картинку для курсора", filterName: "Картинки курсоров",
    hotspot: "Точка нажатия", hotspotTopLeft: "Верхний угол слева", hotspotCenter: "По центру", hotspotFile: "Заданная в файле .cur",
    size: "Величина", sizeSmall: "Малый", sizeMedium: "Средний", sizeLarge: "Крупный", largeHint: "Рядом с границами окна крупные курсоры сменяются системным.",
    hideAfter: "Убирать курсор контроллера при бездействии", never: "Никогда", seconds: "{n} с",
  },
};

interface CursorPackText {
  base: string;
  baseHint: string;
  slots: Record<CursorSlot, string>;
  replace: string;
  resetSlot: string;
  importFiles: string;
  exportPack: string;
  resetPack: string;
  hint: string;
  filesDialogTitle: string;
  exportDialogTitle: string;
  hotspotAuto: string;
  applied: string;
  ignored: string;
  exported: string;
  exportFailed: string;
}

const resizeSlots = (word: string) => ({ "ns-resize": `${word} ↕`, "ew-resize": `${word} ↔`, "nwse-resize": `${word} ⤡`, "nesw-resize": `${word} ⤢` });

export const cursorPackLabels: Record<Language, CursorPackText> = {
  en: {
    base: "Based on", baseHint: "Cursors you don't replace keep this style.",
    slots: { default: "Arrow", pointer: "Link (hand)", text: "Text", "not-allowed": "Unavailable", move: "Move", ...resizeSlots("Resize") },
    replace: "Replace image", resetSlot: "Use the base cursor", importFiles: "Import files…", exportPack: "Export pack…", resetPack: "Reset all",
    hint: "PNG, ICO or CUR, up to 64×64 px (larger images are scaled down). Imported files are matched by the name shown under each cursor, so you can import only the ones you changed. Export the pack to get 64×64 PNG files to edit.",
    filesDialogTitle: "Choose cursor files", exportDialogTitle: "Choose a folder for the cursor pack", hotspotAuto: "Same as the base cursor",
    applied: "Applied: {names}", ignored: "Ignored (name doesn't match a cursor): {names}", exported: "Exported {n} files to {folder}", exportFailed: "The cursor pack couldn't be exported.",
  },
  zh: {
    base: "基础样式", baseHint: "没有替换的光标仍使用此样式。",
    slots: { default: "箭头", pointer: "链接（手形）", text: "文字", "not-allowed": "不可用", move: "移动", ...resizeSlots("更改尺寸") },
    replace: "更换图像", resetSlot: "采用基础光标", importFiles: "导入文件…", exportPack: "导出光标包…", resetPack: "重置全部",
    hint: "支持 PNG、ICO 或 CUR，尺寸上限为 64×64 px（较大的图像会缩小）。导入时按每个光标下方显示的名称匹配文件，因此可以只导入你修改的文件。导出光标包可得到用于编辑的 64×64 PNG 文件。",
    filesDialogTitle: "选取光标文件", exportDialogTitle: "为光标包选取一个文件夹", hotspotAuto: "沿用基础光标的设置",
    applied: "已采用：{names}", ignored: "已跳过（名称未匹配任何光标）：{names}", exported: "已将 {n} 个文件导出至 {folder}", exportFailed: "光标包导出失败。",
  },
  es: {
    base: "Estilo de base", baseHint: "Los cursores sin sustituir conservan este estilo.",
    slots: { default: "Flecha", pointer: "Enlace (mano)", text: "Texto", "not-allowed": "No disponible", move: "Mover", ...resizeSlots("Cambiar tamaño") },
    replace: "Sustituir imagen", resetSlot: "Utilizar el cursor de base", importFiles: "Importar archivos…", exportPack: "Exportar conjunto…", resetPack: "Restaurar todos",
    hint: "PNG, ICO o CUR, con un máximo de 64×64 px (se reducen las imágenes mayores). Los archivos que importes se identifican por el nombre que aparece debajo de cada cursor, por lo que puedes importar únicamente los modificados. Exporta el conjunto para conseguir archivos PNG de 64×64 que puedas editar.",
    filesDialogTitle: "Seleccionar archivos para los cursores", exportDialogTitle: "Seleccionar carpeta para el conjunto de cursores", hotspotAuto: "El mismo que el cursor de base",
    applied: "Aplicados: {names}", ignored: "Omitidos (el nombre no corresponde a un cursor): {names}", exported: "Se exportaron {n} archivos a {folder}", exportFailed: "No fue posible exportar el conjunto de cursores.",
  },
  fr: {
    base: "Style de base", baseHint: "Les curseurs que vous ne remplacez pas conservent ce style.",
    slots: { default: "Flèche", pointer: "Lien (main)", text: "Texte", "not-allowed": "Non disponible", move: "Déplacer", ...resizeSlots("Modifier la taille") },
    replace: "Changer l'image", resetSlot: "Employer le curseur de base", importFiles: "Importer des fichiers…", exportPack: "Exporter le jeu de curseurs…", resetPack: "Tout restaurer",
    hint: "PNG, ICO ou CUR, au maximum 64×64 px (les images plus grandes sont redimensionnées à la baisse). Les fichiers importés sont reconnus par le nom indiqué sous chaque curseur : vous pouvez donc n'importer que les fichiers modifiés. Exportez le jeu de curseurs pour obtenir des fichiers PNG de 64×64 à éditer.",
    filesDialogTitle: "Sélectionner les fichiers des curseurs", exportDialogTitle: "Sélectionner un dossier pour le jeu de curseurs", hotspotAuto: "Identique au curseur de base",
    applied: "Appliqués : {names}", ignored: "Écartés (le nom ne désigne aucun curseur) : {names}", exported: "Export de {n} fichiers vers {folder}", exportFailed: "Impossible d'exporter le jeu de curseurs.",
  },
  de: {
    base: "Grundstil", baseHint: "Cursor, die du nicht austauschst, behalten diesen Stil.",
    slots: { default: "Pfeil", pointer: "Verknüpfung (Hand)", text: "Text", "not-allowed": "Nicht verfügbar", move: "Verschieben", ...resizeSlots("Größe ändern") },
    replace: "Bild austauschen", resetSlot: "Grundcursor nutzen", importFiles: "Dateien importieren…", exportPack: "Cursorpaket exportieren…", resetPack: "Alle zurücksetzen",
    hint: "PNG, ICO oder CUR mit höchstens 64×64 px (größere Bilder werden herunterskaliert). Importierte Dateien werden anhand des Namens unter dem jeweiligen Cursor zugeordnet. So kannst du nur die geänderten Dateien importieren. Exportiere das Paket, um 64×64-PNG-Dateien zum Bearbeiten zu erhalten.",
    filesDialogTitle: "Dateien für Cursor wählen", exportDialogTitle: "Verzeichnis für das Cursorpaket wählen", hotspotAuto: "Gleich wie beim Grundcursor",
    applied: "Angewendet: {names}", ignored: "Übersprungen (Name entspricht keinem Cursor): {names}", exported: "{n} Dateien in {folder} exportiert", exportFailed: "Export des Cursorpakets fehlgeschlagen.",
  },
  "pt-BR": {
    base: "Estilo de base", baseHint: "Os cursores não substituídos preservam este estilo.",
    slots: { default: "Seta", pointer: "Link (mão)", text: "Texto", "not-allowed": "Indisponível", move: "Mover", ...resizeSlots("Alterar tamanho") },
    replace: "Trocar imagem", resetSlot: "Utilizar o cursor de base", importFiles: "Importar arquivos…", exportPack: "Exportar conjunto…", resetPack: "Restaurar todos",
    hint: "PNG, ICO ou CUR, com no máximo 64×64 px (imagens maiores são diminuídas). Os arquivos importados são identificados pelo nome que aparece sob cada cursor, permitindo importar apenas os que você modificou. Exporte o conjunto para obter arquivos PNG de 64×64 que podem ser editados.",
    filesDialogTitle: "Selecionar arquivos para os cursores", exportDialogTitle: "Selecionar pasta para o conjunto de cursores", hotspotAuto: "O mesmo do cursor de base",
    applied: "Aplicados: {names}", ignored: "Ignorados (o nome não identifica um cursor): {names}", exported: "Foram exportados {n} arquivos para {folder}", exportFailed: "Não foi possível exportar o conjunto de cursores.",
  },
  ja: {
    base: "元にするスタイル", baseHint: "置き換えなかったカーソルには、このスタイルが使われます。",
    slots: { default: "矢印", pointer: "リンク（手）", text: "文字入力", "not-allowed": "使用不可", move: "移動", ...resizeSlots("大きさ変更") },
    replace: "別の画像に変更", resetSlot: "元のカーソルを使用", importFiles: "ファイルを読み込み…", exportPack: "パックを書き出し…", resetPack: "すべて初期化",
    hint: "PNG、ICO、CUR に対応し、最大 64×64 px です（大きい画像は縮小します）。読み込むファイルは各カーソルの下に示された名前で照合するため、変更したものだけを読み込めます。パックを書き出すと、編集に使える 64×64 PNG ファイルを取得できます。",
    filesDialogTitle: "カーソルのファイルを選ぶ", exportDialogTitle: "カーソルパック用のフォルダーを選ぶ", hotspotAuto: "元のカーソルに合わせる",
    applied: "適用済み：{names}", ignored: "スキップ（カーソルと一致しない名前）：{names}", exported: "{n} ファイルを {folder} へ書き出しました", exportFailed: "カーソルパックの書き出しに失敗しました。",
  },
  ko: {
    base: "바탕이 되는 스타일", baseHint: "교체하지 않은 커서는 이 스타일로 남습니다.",
    slots: { default: "화살표", pointer: "링크(손)", text: "문자 입력", "not-allowed": "이용 불가", move: "이동", ...resizeSlots("크기 변경") },
    replace: "다른 이미지로 교체", resetSlot: "바탕 커서 이용", importFiles: "파일 가져오기…", exportPack: "커서 팩 내보내기…", resetPack: "전체 재설정",
    hint: "PNG, ICO, CUR을 지원하며 최대 64×64 px입니다(큰 이미지는 줄어듭니다). 가져올 파일은 각 커서 밑에 적힌 이름으로 연결하므로 수정한 파일만 가져올 수 있습니다. 팩을 내보내면 편집용 64×64 PNG 파일을 받을 수 있습니다.",
    filesDialogTitle: "커서용 파일 고르기", exportDialogTitle: "커서 팩용 폴더 고르기", hotspotAuto: "바탕 커서에 맞추기",
    applied: "적용한 항목: {names}", ignored: "건너뜀(이름에 해당하는 커서 없음): {names}", exported: "{n}개 파일을 {folder}(으)로 내보냈습니다", exportFailed: "커서 팩 내보내기에 실패했습니다.",
  },
  hi: {
    base: "जिस शैली पर आधारित हो", baseHint: "जिन कर्सर को नहीं बदला जाएगा, उनकी यही शैली रहेगी।",
    slots: { default: "तीर", pointer: "लिंक (हाथ)", text: "पाठ", "not-allowed": "उपलब्ध नहीं", move: "खिसकाएँ", ...resizeSlots("माप बदलें") },
    replace: "चित्र की जगह दूसरा लगाएँ", resetSlot: "मूल कर्सर लगाएँ", importFiles: "फ़ाइलों का आयात करें…", exportPack: "कर्सर पैक निर्यात करें…", resetPack: "सभी रीसेट करें",
    hint: "PNG, ICO या CUR, अधिकतम 64×64 px तक (बड़े चित्र छोटे कर दिए जाते हैं)। आयात की गई फ़ाइलों का मिलान हर कर्सर के नीचे लिखे नाम से होता है, इसलिए केवल वे फ़ाइलें आयात कर सकते हैं जिन्हें आपने बदला है। संपादन के लिए 64×64 PNG फ़ाइलें प्राप्त करने के लिए पैक का निर्यात करें।",
    filesDialogTitle: "कर्सर की फ़ाइलों का चयन करें", exportDialogTitle: "कर्सर पैक रखने का फ़ोल्डर चुनें", hotspotAuto: "मूल कर्सर के अनुसार",
    applied: "लागू किया गया: {names}", ignored: "छोड़ दिया गया (नाम किसी कर्सर का नहीं है): {names}", exported: "{folder} में {n} फ़ाइलें निर्यात की गईं", exportFailed: "कर्सर पैक का निर्यात संभव नहीं हुआ।",
  },
  ar: {
    base: "النمط الأساسي", baseHint: "تحتفظ المؤشرات التي لا تغيّرها بهذا النمط.",
    slots: { default: "سهم", pointer: "وصلة (يد)", text: "نص", "not-allowed": "غير متاح", move: "تحريك", ...resizeSlots("تعديل الحجم") },
    replace: "تغيير الصورة", resetSlot: "استعمال المؤشر الأساسي", importFiles: "استيراد ملفات…", exportPack: "تصدير مجموعة المؤشرات…", resetPack: "استعادة الجميع",
    hint: "PNG أو ICO أو CUR، بحد أقصى 64×64 بكسل (تُقلَّص الصور الكبيرة). تُعرَف الملفات المستوردة بالاسم المكتوب أسفل كل مؤشر، ولذلك يمكنك استيراد الملفات التي عدّلتها وحدها. صدّر المجموعة للحصول على ملفات PNG بدقة 64×64 قابلة للتحرير.",
    filesDialogTitle: "تحديد ملفات للمؤشرات", exportDialogTitle: "تحديد مجلد لمجموعة المؤشرات", hotspotAuto: "مطابق للمؤشر الأساسي",
    applied: "طُبّق: {names}", ignored: "تم التخطي (الاسم لا يدل على أي مؤشر): {names}", exported: "صُدّرت {n} ملفات إلى {folder}", exportFailed: "لم ينجح تصدير مجموعة المؤشرات.",
  },
  ru: {
    base: "Базовый стиль", baseHint: "Курсоры, которые вы не заменили, сохранят этот стиль.",
    slots: { default: "Стрелка", pointer: "Ссылка (ладонь)", text: "Ввод текста", "not-allowed": "Недоступно", move: "Перемещение", ...resizeSlots("Изменить размер") },
    replace: "Сменить картинку", resetSlot: "Взять базовый курсор", importFiles: "Импортировать файлы…", exportPack: "Экспортировать комплект…", resetPack: "Восстановить все",
    hint: "PNG, ICO или CUR размером не более 64×64 px (крупные изображения масштабируются вниз). Импортируемые файлы определяются по названию под каждым курсором, поэтому достаточно импортировать только изменённые. Экспортируйте комплект, чтобы получить PNG-файлы 64×64 для правки.",
    filesDialogTitle: "Выбрать файлы для курсоров", exportDialogTitle: "Выбрать каталог для комплекта курсоров", hotspotAuto: "Совпадает с базовым курсором",
    applied: "Задействованы: {names}", ignored: "Пропущены (название не совпадает ни с одним курсором): {names}", exported: "В {folder} выгружено файлов: {n}", exportFailed: "Экспорт комплекта курсоров не удался.",
  },
};

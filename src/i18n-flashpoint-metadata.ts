import type { Language } from "./i18n";
import type { FlashpointMetadataField, FlashpointMetadataItem } from "./types";
import { shortcutLabels } from "./i18n-shortcuts";

interface FlashpointMetadataLabels {
  promptToggle: string;
  completeNow: string;
  checking: string;
  completed: string;
  none: string;
  promptMessage: string;
  apply: string;
  matchedById: string;
  matchedByTitle: string;
  source: string;
  empty: string;
  kinds: Record<FlashpointMetadataItem["kind"], string>;
  fields: Record<Exclude<FlashpointMetadataField, `sourceRating:${string}`>, string>;
  screenshotValue: string;
  importWarning: string;
  metadataWarning: string;
  close: string;
}

export const flashpointMetadataLabels: Record<Language, FlashpointMetadataLabels> = {
  en: {
    promptToggle: "Ask which metadata to import before completing it",
    completeNow: "Scan missing metadata", checking: "Checking…", completed: "Updated {n} game(s).", none: "No missing metadata found.",
    promptMessage: "Choose what to import for each game. New items fill empty data, Overwrites replaces what the game already has.",
    apply: "Import ({n})", matchedById: "Matched by Flashpoint ID", matchedByTitle: "Matched by title", source: "Original source", empty: "(empty)",
    kinds: { fill: "New", merge: "Adds", overwrite: "Overwrites" },
    fields: { icon: shortcutLabels.en.title, developer: "Developer", publisher: "Publisher", releaseDate: "Release date", version: "Version", description: "Description", notes: "Notes", tags: "Tags", cover: "Cover", screenshot: "Screenshot", sourceRating: "Source rating (out of 5)" },
    screenshotValue: "Flashpoint screenshot",
    importWarning: "With this prompt turned off, games you download in Flashpoint are imported automatically while automatic import is on.",
    metadataWarning: "With this prompt turned off, missing metadata is filled in automatically while automatic completion is on. Existing data is never overwritten without asking.",
    close: "Close",
  },
  zh: {
    promptToggle: "补全前询问要导入的元数据",
    completeNow: "扫描缺失的元数据", checking: "正在检查…", completed: "已更新 {n} 个游戏。", none: "未发现缺失的元数据。",
    promptMessage: "选择每个游戏要导入的内容。“新增”会填充空白数据，“覆盖”会替换游戏已有的数据。",
    apply: "导入（{n}）", matchedById: "通过 Flashpoint ID 匹配", matchedByTitle: "通过标题匹配", source: "原始来源", empty: "（空）",
    kinds: { fill: "新增", merge: "补充", overwrite: "覆盖" },
    fields: { icon: shortcutLabels.zh.title, developer: "开发者", publisher: "发行商", releaseDate: "发行日期", version: "版本", description: "描述", notes: "备注", tags: "标签", cover: "封面", screenshot: "截图", sourceRating: "来源评分（满分 5 分）" },
    screenshotValue: "Flashpoint 截图",
    importWarning: "关闭此提示后，只要自动导入处于开启状态，在 Flashpoint 中下载的游戏就会自动导入。",
    metadataWarning: "关闭此提示后，只要自动补全处于开启状态，缺失的元数据就会自动填充。已有数据绝不会未经询问就被覆盖。",
    close: "关闭",
  },
  es: {
    promptToggle: "Preguntar qué metadatos importar antes de completarlos",
    completeNow: "Buscar metadatos que faltan", checking: "Comprobando…", completed: "Se han actualizado {n} juego(s).", none: "No se han encontrado metadatos que falten.",
    promptMessage: "Selecciona qué importar para cada juego. «Nuevo» rellena los datos vacíos, «Sobrescribe» sustituye los datos que el juego ya tiene.",
    apply: "Importar ({n})", matchedById: "Coincide por ID de Flashpoint", matchedByTitle: "Coincide por título", source: "Fuente original", empty: "(vacío)",
    kinds: { fill: "Nuevo", merge: "Añade", overwrite: "Sobrescribe" },
    fields: { icon: shortcutLabels.es.title, developer: "Desarrollador", publisher: "Distribuidor", releaseDate: "Fecha de lanzamiento", version: "Versión", description: "Descripción", notes: "Notas", tags: "Etiquetas", cover: "Portada", screenshot: "Captura de pantalla", sourceRating: "Puntuación de la fuente (sobre 5)" },
    screenshotValue: "Captura de Flashpoint",
    importWarning: "Si desactivas este aviso, los juegos que descargues en Flashpoint se importarán automáticamente mientras la importación automática esté activada.",
    metadataWarning: "Si desactivas este aviso, los metadatos que falten se rellenarán automáticamente mientras la función de completado automático esté activada. Los datos existentes nunca se sobrescriben sin preguntar.",
    close: "Cerrar",
  },
  fr: {
    promptToggle: "Demander quelles métadonnées importer avant de les compléter",
    completeNow: "Rechercher les métadonnées manquantes", checking: "Vérification…", completed: "{n} jeu(x) mis à jour.", none: "Aucune métadonnée manquante trouvée.",
    promptMessage: "Sélectionnez les éléments à importer pour chaque jeu. « Nouveau » remplit les champs vides, « Remplace » écrase les données déjà présentes.",
    apply: "Importer ({n})", matchedById: "Correspondance par identifiant Flashpoint", matchedByTitle: "Correspondance par titre", source: "Source d’origine", empty: "(vide)",
    kinds: { fill: "Nouveau", merge: "Ajoute", overwrite: "Remplace" },
    fields: { icon: shortcutLabels.fr.title, developer: "Développeur", publisher: "Éditeur", releaseDate: "Date de sortie", version: "Version", description: "Description", notes: "Notes", tags: "Étiquettes", cover: "Couverture", screenshot: "Capture d’écran", sourceRating: "Note de la source (sur 5)" },
    screenshotValue: "Capture d’écran Flashpoint",
    importWarning: "Si cette demande est désactivée, les jeux téléchargés dans Flashpoint sont importés automatiquement tant que l’importation automatique est activée.",
    metadataWarning: "Si cette demande est désactivée, les métadonnées manquantes sont renseignées automatiquement tant que la complétion automatique est activée. Les données existantes ne sont jamais écrasées sans votre accord.",
    close: "Fermer",
  },
  de: {
    promptToggle: "Vor dem Ergänzen fragen, welche Metadaten importiert werden sollen",
    completeNow: "Nach fehlenden Metadaten suchen", checking: "Wird geprüft…", completed: "{n} Spiel(e) aktualisiert.", none: "Keine fehlenden Metadaten gefunden.",
    promptMessage: "Wähle für jedes Spiel die zu importierenden Daten aus. „Neu“ füllt leere Felder, „Überschreibt“ ersetzt bereits vorhandene Daten des Spiels.",
    apply: "Importieren ({n})", matchedById: "Über Flashpoint-ID zugeordnet", matchedByTitle: "Über Titel zugeordnet", source: "Ursprüngliche Quelle", empty: "(leer)",
    kinds: { fill: "Neu", merge: "Ergänzt", overwrite: "Überschreibt" },
    fields: { icon: shortcutLabels.de.title, developer: "Entwickler", publisher: "Publisher", releaseDate: "Veröffentlichungsdatum", version: "Version", description: "Beschreibung", notes: "Notizen", tags: "Schlagwörter", cover: "Cover", screenshot: "Screenshot", sourceRating: "Bewertung der Quelle (von 5)" },
    screenshotValue: "Screenshot aus Flashpoint",
    importWarning: "Wenn diese Abfrage deaktiviert ist, werden in Flashpoint heruntergeladene Spiele automatisch importiert, solange der automatische Import aktiviert ist.",
    metadataWarning: "Wenn diese Abfrage deaktiviert ist, werden fehlende Metadaten automatisch ausgefüllt, solange die automatische Ergänzung aktiviert ist. Vorhandene Daten werden niemals ohne Rückfrage überschrieben.",
    close: "Schließen",
  },
  "pt-BR": {
    promptToggle: "Perguntar quais metadados importar antes de completá-los",
    completeNow: "Buscar metadados ausentes", checking: "Verificando…", completed: "{n} jogo(s) atualizado(s).", none: "Nenhum metadado ausente foi encontrado.",
    promptMessage: "Selecione o que importar para cada jogo. “Novo” preenche os dados vazios, “Sobrescreve” substitui os dados que o jogo já tem.",
    apply: "Importar ({n})", matchedById: "Correspondência pelo ID do Flashpoint", matchedByTitle: "Correspondência pelo título", source: "Fonte original", empty: "(vazio)",
    kinds: { fill: "Novo", merge: "Acrescenta", overwrite: "Sobrescreve" },
    fields: { icon: shortcutLabels["pt-BR"].title, developer: "Desenvolvedor", publisher: "Publicadora", releaseDate: "Data de lançamento", version: "Versão", description: "Descrição", notes: "Notas", tags: "Marcadores", cover: "Capa", screenshot: "Captura de tela", sourceRating: "Avaliação da fonte (de um total de 5)" },
    screenshotValue: "Captura de tela do Flashpoint",
    importWarning: "Com esta confirmação desativada, os jogos baixados no Flashpoint são importados automaticamente enquanto a importação automática estiver ativada.",
    metadataWarning: "Com esta confirmação desativada, os metadados ausentes são preenchidos automaticamente enquanto o preenchimento automático estiver ativado. Os dados existentes nunca são sobrescritos sem perguntar.",
    close: "Fechar",
  },
  ja: {
    promptToggle: "補完する前にインポートするメタデータを確認する",
    completeNow: "不足しているメタデータをスキャン", checking: "確認しています…", completed: "{n} 件のゲームを更新しました。", none: "不足しているメタデータは見つかりませんでした。",
    promptMessage: "各ゲームにインポートする内容を選択してください。「新規」は空のデータを埋め、「上書き」はゲームの既存のデータを置き換えます。",
    apply: "インポート（{n}）", matchedById: "Flashpoint ID で一致", matchedByTitle: "タイトルで一致", source: "元の配信元", empty: "（空）",
    kinds: { fill: "新規", merge: "追加", overwrite: "上書き" },
    fields: { icon: shortcutLabels.ja.title, developer: "開発元", publisher: "発売元", releaseDate: "リリース日", version: "バージョン", description: "説明", notes: "メモ", tags: "タグ", cover: "カバー", screenshot: "スクリーンショット", sourceRating: "配信元の評価（5 点満点）" },
    screenshotValue: "Flashpoint のスクリーンショット",
    importWarning: "この確認を無効にすると、自動インポートが有効な間は Flashpoint でダウンロードしたゲームが自動的にインポートされます。",
    metadataWarning: "この確認を無効にすると、自動補完が有効な間は不足しているメタデータが自動的に補完されます。確認せずに既存のデータが上書きされることはありません。",
    close: "閉じる",
  },
  ko: {
    promptToggle: "메타데이터를 보완하기 전에 가져올 항목 확인",
    completeNow: "누락된 메타데이터 검색", checking: "확인 중…", completed: "게임 {n}개를 업데이트했습니다.", none: "누락된 메타데이터를 찾지 못했습니다.",
    promptMessage: "게임마다 가져올 항목을 선택하세요. '새 항목'은 비어 있는 데이터를 채우고, '덮어쓰기'는 게임에 이미 있는 데이터를 바꿉니다.",
    apply: "가져오기 ({n})", matchedById: "Flashpoint ID로 일치", matchedByTitle: "제목으로 일치", source: "원본 출처", empty: "(비어 있음)",
    kinds: { fill: "새 항목", merge: "추가", overwrite: "덮어쓰기" },
    fields: { icon: shortcutLabels.ko.title, developer: "개발사", publisher: "배급사", releaseDate: "출시일", version: "버전", description: "설명", notes: "메모", tags: "태그", cover: "표지", screenshot: "스크린샷", sourceRating: "출처 평점 (5점 만점)" },
    screenshotValue: "Flashpoint 스크린샷",
    importWarning: "이 확인을 끄면 자동 가져오기가 켜져 있는 동안 Flashpoint에서 다운로드한 게임을 자동으로 가져옵니다.",
    metadataWarning: "이 확인을 끄면 자동 보완이 켜져 있는 동안 누락된 메타데이터를 자동으로 채웁니다. 기존 데이터는 확인 없이 덮어쓰지 않습니다.",
    close: "닫기",
  },
  hi: {
    promptToggle: "पूरा करने से पहले पूछें कि कौन-सा मेटाडेटा आयात करना है",
    completeNow: "गुम मेटाडेटा की जाँच करें", checking: "जाँच हो रही है…", completed: "{n} गेम अपडेट किए गए।", none: "कोई गुम मेटाडेटा नहीं मिला।",
    promptMessage: "हर गेम के लिए आयात करने वाले आइटम चुनें। “नया” खाली डेटा भरता है, “ओवरराइट” गेम के मौजूदा डेटा को बदल देता है।",
    apply: "आयात करें ({n})", matchedById: "Flashpoint ID से मिलान हुआ", matchedByTitle: "शीर्षक से मिलान हुआ", source: "मूल स्रोत", empty: "(खाली)",
    kinds: { fill: "नया", merge: "जोड़ता है", overwrite: "ओवरराइट" },
    fields: { icon: shortcutLabels.hi.title, developer: "डेवलपर", publisher: "प्रकाशक", releaseDate: "रिलीज़ की तारीख", version: "संस्करण", description: "विवरण", notes: "नोट्स", tags: "टैग", cover: "कवर", screenshot: "स्क्रीनशॉट", sourceRating: "स्रोत की रेटिंग (5 में से)" },
    screenshotValue: "Flashpoint का स्क्रीनशॉट",
    importWarning: "यह पुष्टि बंद होने पर, स्वचालित आयात चालू रहने तक Flashpoint में डाउनलोड किए गए गेम अपने-आप आयात होते हैं।",
    metadataWarning: "यह पुष्टि बंद होने पर, स्वचालित पूर्ति चालू रहने तक गुम मेटाडेटा अपने-आप भर दिया जाता है। मौजूदा डेटा बिना पूछे कभी ओवरराइट नहीं किया जाता।",
    close: "बंद करें",
  },
  ar: {
    promptToggle: "السؤال عن البيانات الوصفية المراد استيرادها قبل إكمالها",
    completeNow: "البحث عن البيانات الوصفية الناقصة", checking: "جارٍ التحقق…", completed: "تم تحديث {n} من الألعاب.", none: "لم يُعثر على بيانات وصفية ناقصة.",
    promptMessage: "اختر ما تريد استيراده لكل لعبة. يملأ «جديد» البيانات الفارغة، بينما يستبدل «استبدال» البيانات الموجودة بالفعل في اللعبة.",
    apply: "استيراد ({n})", matchedById: "مطابقة بمعرّف Flashpoint", matchedByTitle: "مطابقة بالعنوان", source: "المصدر الأصلي", empty: "(فارغ)",
    kinds: { fill: "جديد", merge: "إضافة", overwrite: "استبدال" },
    fields: { icon: shortcutLabels.ar.title, developer: "المطوّر", publisher: "الناشر", releaseDate: "تاريخ الإصدار", version: "الإصدار", description: "الوصف", notes: "ملاحظات", tags: "الوسوم", cover: "الغلاف", screenshot: "لقطة شاشة", sourceRating: "تقييم المصدر (من 5)" },
    screenshotValue: "لقطة شاشة من Flashpoint",
    importWarning: "عند تعطيل هذا السؤال، تُستورد الألعاب التي تنزّلها في Flashpoint تلقائيًا ما دام الاستيراد التلقائي مفعّلًا.",
    metadataWarning: "عند تعطيل هذا السؤال، تُملأ البيانات الوصفية الناقصة تلقائيًا ما دام الإكمال التلقائي مفعّلًا. لا تُستبدل البيانات الموجودة أبدًا دون السؤال أولًا.",
    close: "إغلاق",
  },
  ru: {
    promptToggle: "Спрашивать, какие метаданные импортировать, перед их дополнением",
    completeNow: "Найти недостающие метаданные", checking: "Проверка…", completed: "Обновлено игр: {n}.", none: "Недостающие метаданные не найдены.",
    promptMessage: "Выберите данные для импорта в каждую игру. «Новое» заполняет пустые поля, «Перезапись» заменяет уже имеющиеся данные игры.",
    apply: "Импортировать ({n})", matchedById: "Совпадение по ID Flashpoint", matchedByTitle: "Совпадение по названию", source: "Исходный источник", empty: "(пусто)",
    kinds: { fill: "Новое", merge: "Добавление", overwrite: "Перезапись" },
    fields: { icon: shortcutLabels.ru.title, developer: "Разработчик", publisher: "Издатель", releaseDate: "Дата выхода", version: "Версия", description: "Описание", notes: "Примечания", tags: "Теги", cover: "Обложка", screenshot: "Снимок экрана", sourceRating: "Оценка источника (из 5)" },
    screenshotValue: "Снимок экрана из Flashpoint",
    importWarning: "Если отключить этот запрос, игры, загруженные в Flashpoint, будут импортироваться автоматически, пока включён автоматический импорт.",
    metadataWarning: "Если отключить этот запрос, недостающие метаданные будут заполняться автоматически, пока включено автоматическое дополнение. Имеющиеся данные никогда не перезаписываются без запроса.",
    close: "Закрыть",
  },
};

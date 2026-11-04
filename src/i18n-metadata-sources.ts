import type { Language } from "./i18n";

export const metadataRateLimitLabels: Record<Language, string> = {
  en: "{source} is limiting requests (HTTP 429). Try again after {time}.",
  fr: "{source} limite les requêtes (HTTP 429). Réessayez après {time}.",
  zh: "{source} 正在限制请求（HTTP 429）。请在 {time} 后重试。",
  es: "{source} está limitando las solicitudes (HTTP 429). Inténtalo después de {time}.",
  de: "{source} begrenzt Anfragen (HTTP 429). Versuche es nach {time} erneut.",
  "pt-BR": "{source} está limitando as solicitações (HTTP 429). Tente novamente após {time}.",
  ja: "{source} がリクエストを制限しています（HTTP 429）。{time} 以降に再試行してください。",
  ko: "{source}에서 요청을 제한하고 있습니다(HTTP 429). {time} 이후에 다시 시도하세요.",
  hi: "{source} अनुरोध सीमित कर रहा है (HTTP 429)। {time} के बाद फिर कोशिश करें।",
  ar: "{source} يحدّ من الطلبات (HTTP 429). حاول مجددًا بعد {time}.",
  ru: "{source} ограничивает запросы (HTTP 429). Повторите после {time}.",
};
import type { BuiltinMetadataSourceId } from "./types";

/** Labels for metadata sources, close matches and the manual metadata search. */
interface MetadataSourceLabels {
  autoMetadata: string;
  hint: string;
  toast: string;
  promptTitle: string;
  coverValue: string;
  sources: string;
  sourceNames: Record<BuiltinMetadataSourceId, string>;
  moveUp: string;
  moveDown: string;
  noSources: string;
  matchedFuzzy: string;
  matchedManual: string;
  fromSource: string;
  openPage: string;
  unmatchedTitle: string;
  unmatchedHint: string;
  search: string;
  findMetadata: string;
  searchTitle: string;
  searchPlaceholder: string;
  searching: string;
  noResults: string;
  unavailable: string;
  back: string;
  nothingNew: string;
  imported: string;
  loading: string;
}

const brands = { newgrounds: "Newgrounds", silvergames: "Silvergames", y8: "Y8", armorgames: "Armor Games", andkon: "Andkon", flashgames247: "FlashGames247" } as const;

export const metadataSourceLabels: Record<Language, MetadataSourceLabels> = {
  en: {
    autoMetadata: "Automatically search game metadata after importation",
    hint: "After importation, games missing data are looked up in the enabled sources from top to bottom, by Flashpoint ID, by exact title, or by a close title (90% or more). A higher source fills a field first. Existing data is only replaced when you choose it in the prompt.",
    toast: "Metadata completed:",
    promptTitle: "Metadata found for {n} game(s)",
    coverValue: "Cover image",
    sources: "Metadata sources",
    sourceNames: { flashpointLocal: "Flashpoint (installed)", flashpointOnline: "Flashpoint (online database)", ...brands },
    moveUp: "Move up", moveDown: "Move down",
    noSources: "Enable at least one metadata source.",
    matchedFuzzy: "Close match {n}%", matchedManual: "Chosen in search", fromSource: "From {source}", openPage: "Open page",
    unmatchedTitle: "No match found ({n})",
    unmatchedHint: "These games are missing data but no source found them. Search for them yourself, with other search terms if needed.",
    search: "Search", findMetadata: "Find metadata…",
    searchTitle: "Find metadata for {title}", searchPlaceholder: "Game title or search terms",
    searching: "Searching…", noResults: "No results. Try other search terms or enable more sources.",
    unavailable: "Unavailable: {sources}", back: "Back to results",
    nothingNew: "This result has nothing new for this game.", imported: "Metadata imported.", loading: "Loading…",
  },
  zh: {
    autoMetadata: "导入后自动搜索游戏元数据",
    hint: "导入后，会按从上到下的顺序在已启用的来源中查找缺少数据的游戏：通过 Flashpoint ID、完全一致的标题或相近的标题（相似度至少 90%）匹配。排在前面的来源优先填充字段。只有在提示中选择替换时，才会更改已有数据。",
    toast: "已补全元数据：",
    promptTitle: "已找到 {n} 个游戏的元数据",
    coverValue: "封面图片",
    sources: "元数据来源",
    sourceNames: { flashpointLocal: "Flashpoint（已安装）", flashpointOnline: "Flashpoint（在线数据库）", ...brands },
    moveUp: "上移", moveDown: "下移",
    noSources: "请至少启用一个元数据来源。",
    matchedFuzzy: "相近匹配 {n}%", matchedManual: "搜索中选定", fromSource: "来自 {source}", openPage: "打开页面",
    unmatchedTitle: "未找到匹配（{n}）",
    unmatchedHint: "这些游戏缺少数据，但所有来源都未能找到匹配。请手动搜索，必要时换用其他搜索词。",
    search: "搜索", findMetadata: "查找元数据…",
    searchTitle: "为 {title} 查找元数据", searchPlaceholder: "游戏标题或搜索词",
    searching: "正在搜索…", noResults: "没有结果。请换用其他搜索词或启用更多来源。",
    unavailable: "不可用：{sources}", back: "返回搜索结果",
    nothingNew: "此结果没有可为该游戏补充的新内容。", imported: "元数据已导入。", loading: "正在加载…",
  },
  es: {
    autoMetadata: "Buscar automáticamente los metadatos del juego después de importarlo",
    hint: "Después de importar, se buscan los juegos a los que les faltan datos en las fuentes activadas, de arriba abajo: por ID de Flashpoint, por título exacto o por un título similar (90 % o más). Las fuentes situadas más arriba tienen prioridad al rellenar cada campo. Los datos existentes solo se sustituyen si lo eliges en el aviso.",
    toast: "Metadatos completados:",
    promptTitle: "Se han encontrado metadatos para {n} juego(s)",
    coverValue: "Imagen de portada",
    sources: "Fuentes de metadatos",
    sourceNames: { flashpointLocal: "Flashpoint (instalado)", flashpointOnline: "Flashpoint (base de datos en línea)", ...brands },
    moveUp: "Subir", moveDown: "Bajar",
    noSources: "Activa al menos una fuente de metadatos.",
    matchedFuzzy: "Coincidencia aproximada: {n} %", matchedManual: "Seleccionado en la búsqueda", fromSource: "De {source}", openPage: "Abrir página",
    unmatchedTitle: "Sin coincidencias ({n})",
    unmatchedHint: "A estos juegos les faltan datos, pero ninguna fuente los ha encontrado. Búscalos manualmente y usa otros términos si hace falta.",
    search: "Buscar", findMetadata: "Buscar metadatos…",
    searchTitle: "Buscar metadatos para {title}", searchPlaceholder: "Título del juego o términos de búsqueda",
    searching: "Buscando…", noResults: "No hay resultados. Prueba otros términos de búsqueda o activa más fuentes.",
    unavailable: "No disponible: {sources}", back: "Volver a los resultados",
    nothingNew: "Este resultado no aporta datos nuevos para este juego.", imported: "Metadatos importados.", loading: "Cargando…",
  },
  fr: {
    autoMetadata: "Rechercher automatiquement les métadonnées des jeux après l'importation",
    hint: "Après l'importation, les jeux dont certaines données manquent sont recherchés dans les sources activées, de haut en bas : par identifiant Flashpoint, par titre exact ou par titre proche (90 % ou plus). Les sources placées plus haut ont la priorité pour renseigner chaque champ. Les données existantes ne sont remplacées que si vous le choisissez dans la fenêtre de confirmation.",
    toast: "Métadonnées complétées :",
    promptTitle: "Métadonnées trouvées pour {n} jeu(x)",
    coverValue: "Image de couverture",
    sources: "Sources de métadonnées",
    sourceNames: { flashpointLocal: "Flashpoint (installé)", flashpointOnline: "Flashpoint (base de données en ligne)", ...brands },
    moveUp: "Monter", moveDown: "Descendre",
    noSources: "Activez au moins une source de métadonnées.",
    matchedFuzzy: "Correspondance approximative : {n} %", matchedManual: "Sélectionné dans la recherche", fromSource: "Depuis {source}", openPage: "Ouvrir la page",
    unmatchedTitle: "Aucune correspondance trouvée ({n})",
    unmatchedHint: "Il manque des données à ces jeux, mais aucune source ne les a trouvés. Recherchez-les manuellement, en utilisant d’autres termes si nécessaire.",
    search: "Rechercher", findMetadata: "Rechercher des métadonnées…",
    searchTitle: "Rechercher des métadonnées pour {title}", searchPlaceholder: "Titre du jeu ou termes de recherche",
    searching: "Recherche…", noResults: "Aucun résultat. Essayez d’autres termes ou activez davantage de sources.",
    unavailable: "Indisponible : {sources}", back: "Revenir aux résultats",
    nothingNew: "Ce résultat n’apporte aucune donnée nouvelle pour ce jeu.", imported: "Métadonnées importées.", loading: "Chargement…",
  },
  de: {
    autoMetadata: "Spielmetadaten nach dem Import automatisch suchen",
    hint: "Nach dem Import werden Spiele mit fehlenden Daten in den aktivierten Quellen von oben nach unten gesucht: anhand der Flashpoint-ID, eines exakt übereinstimmenden Titels oder eines ähnlichen Titels (mindestens 90 %). Weiter oben stehende Quellen füllen ein Feld zuerst. Vorhandene Daten werden nur ersetzt, wenn du dies in der Abfrage auswählst.",
    toast: "Metadaten ergänzt:",
    promptTitle: "Metadaten für {n} Spiel(e) gefunden",
    coverValue: "Coverbild",
    sources: "Metadatenquellen",
    sourceNames: { flashpointLocal: "Flashpoint (installiert)", flashpointOnline: "Flashpoint (Online-Datenbank)", ...brands },
    moveUp: "Nach oben", moveDown: "Nach unten",
    noSources: "Aktiviere mindestens eine Metadatenquelle.",
    matchedFuzzy: "Ähnlicher Treffer: {n} %", matchedManual: "In der Suche ausgewählt", fromSource: "Aus {source}", openPage: "Seite öffnen",
    unmatchedTitle: "Keine Übereinstimmung gefunden ({n})",
    unmatchedHint: "Diesen Spielen fehlen Daten, aber keine Quelle hat sie gefunden. Suche selbst nach ihnen und verwende bei Bedarf andere Suchbegriffe.",
    search: "Suchen", findMetadata: "Metadaten suchen…",
    searchTitle: "Metadaten für {title} suchen", searchPlaceholder: "Spieltitel oder Suchbegriffe",
    searching: "Suche läuft…", noResults: "Keine Ergebnisse. Versuche andere Suchbegriffe oder aktiviere weitere Quellen.",
    unavailable: "Nicht verfügbar: {sources}", back: "Zurück zu den Ergebnissen",
    nothingNew: "Dieses Ergebnis enthält keine neuen Daten für dieses Spiel.", imported: "Metadaten importiert.", loading: "Wird geladen…",
  },
  "pt-BR": {
    autoMetadata: "Buscar automaticamente os metadados dos jogos após a importação",
    hint: "Após a importação, os jogos com dados ausentes são buscados nas fontes ativadas, de cima para baixo: pelo ID do Flashpoint, pelo título exato ou por um título semelhante (90% ou mais). Uma fonte mais acima preenche cada campo primeiro. Os dados existentes só são substituídos quando você escolhe isso na confirmação.",
    toast: "Metadados completados:",
    promptTitle: "Metadados encontrados para {n} jogo(s)",
    coverValue: "Imagem de capa",
    sources: "Fontes de metadados",
    sourceNames: { flashpointLocal: "Flashpoint (instalado)", flashpointOnline: "Flashpoint (banco de dados on-line)", ...brands },
    moveUp: "Mover para cima", moveDown: "Mover para baixo",
    noSources: "Ative pelo menos uma fonte de metadados.",
    matchedFuzzy: "Correspondência aproximada: {n}%", matchedManual: "Selecionado na busca", fromSource: "De {source}", openPage: "Abrir página",
    unmatchedTitle: "Nenhuma correspondência encontrada ({n})",
    unmatchedHint: "Estes jogos têm dados ausentes, mas nenhuma fonte os encontrou. Busque-os manualmente, usando outros termos se necessário.",
    search: "Buscar", findMetadata: "Buscar metadados…",
    searchTitle: "Buscar metadados para {title}", searchPlaceholder: "Título do jogo ou termos de busca",
    searching: "Buscando…", noResults: "Nenhum resultado. Tente outros termos de busca ou ative mais fontes.",
    unavailable: "Indisponível: {sources}", back: "Voltar aos resultados",
    nothingNew: "Este resultado não traz dados novos para este jogo.", imported: "Metadados importados.", loading: "Carregando…",
  },
  ja: {
    autoMetadata: "インポート後にゲームのメタデータを自動検索する",
    hint: "インポート後に、データが不足しているゲームを有効なソースで上から順に検索します。Flashpoint ID、完全に一致するタイトル、または類似するタイトル（90% 以上）で照合します。上位のソースが優先してフィールドを埋めます。既存のデータは、確認画面で置き換えを選択した場合にのみ変更されます。",
    toast: "メタデータを補完しました：",
    promptTitle: "{n} 件のゲームのメタデータが見つかりました",
    coverValue: "カバー画像",
    sources: "メタデータのソース",
    sourceNames: { flashpointLocal: "Flashpoint（インストール済み）", flashpointOnline: "Flashpoint（オンラインデータベース）", ...brands },
    moveUp: "上に移動", moveDown: "下に移動",
    noSources: "メタデータのソースを少なくとも 1 つ有効にしてください。",
    matchedFuzzy: "類似する候補：{n}%", matchedManual: "検索で選択", fromSource: "取得元：{source}", openPage: "ページを開く",
    unmatchedTitle: "一致する候補が見つかりませんでした（{n}）",
    unmatchedHint: "これらのゲームはデータが不足していますが、どのソースでも見つかりませんでした。必要に応じて検索語を変えて、自分で検索してください。",
    search: "検索", findMetadata: "メタデータを探す…",
    searchTitle: "{title} のメタデータを探す", searchPlaceholder: "ゲームのタイトルまたは検索語",
    searching: "検索しています…", noResults: "結果がありません。別の検索語を試すか、ソースを追加で有効にしてください。",
    unavailable: "利用不可：{sources}", back: "結果に戻る",
    nothingNew: "この結果には、このゲームに追加できる新しいデータがありません。", imported: "メタデータをインポートしました。", loading: "読み込んでいます…",
  },
  ko: {
    autoMetadata: "가져온 후 게임 메타데이터 자동 검색",
    hint: "가져온 후 데이터가 누락된 게임을 활성화된 소스에서 위에서 아래로 검색합니다. Flashpoint ID, 정확히 일치하는 제목 또는 비슷한 제목 (90% 이상)으로 찾습니다. 위쪽 소스가 먼저 필드를 채웁니다. 기존 데이터는 확인 창에서 교체를 선택한 경우에만 바뀝니다.",
    toast: "메타데이터 보완 완료:",
    promptTitle: "게임 {n}개의 메타데이터를 찾았습니다",
    coverValue: "표지 이미지",
    sources: "메타데이터 소스",
    sourceNames: { flashpointLocal: "Flashpoint (설치됨)", flashpointOnline: "Flashpoint (온라인 데이터베이스)", ...brands },
    moveUp: "위로 이동", moveDown: "아래로 이동",
    noSources: "메타데이터 소스를 하나 이상 활성화하세요.",
    matchedFuzzy: "유사 일치 {n}%", matchedManual: "검색에서 선택됨", fromSource: "출처: {source}", openPage: "페이지 열기",
    unmatchedTitle: "일치하는 결과 없음 ({n})",
    unmatchedHint: "이 게임들은 데이터가 누락되었지만 어느 소스에서도 찾지 못했습니다. 직접 검색하고, 필요하면 다른 검색어를 사용하세요.",
    search: "검색", findMetadata: "메타데이터 찾기…",
    searchTitle: "{title}의 메타데이터 찾기", searchPlaceholder: "게임 제목 또는 검색어",
    searching: "검색 중…", noResults: "결과가 없습니다. 다른 검색어를 사용하거나 소스를 더 활성화하세요.",
    unavailable: "사용할 수 없음: {sources}", back: "결과로 돌아가기",
    nothingNew: "이 결과에는 이 게임에 추가할 새 데이터가 없습니다.", imported: "메타데이터를 가져왔습니다.", loading: "불러오는 중…",
  },
  hi: {
    autoMetadata: "इम्पोर्ट करने के बाद गेम का मेटाडेटा अपने-आप खोजें",
    hint: "इम्पोर्ट करने के बाद, जिन गेम में डेटा की कमी है उन्हें चालू स्रोतों में ऊपर से नीचे खोजा जाता है: Flashpoint ID, बिल्कुल समान शीर्षक या मिलते-जुलते शीर्षक (90% या अधिक) के आधार पर। ऊपर वाला स्रोत पहले फ़ील्ड भरता है। मौजूदा डेटा तभी बदला जाता है जब आप पुष्टि वाले संवाद में उसे चुनते हैं।",
    toast: "मेटाडेटा पूरा हुआ:",
    promptTitle: "{n} गेम के लिए मेटाडेटा मिला",
    coverValue: "कवर का चित्र",
    sources: "मेटाडेटा स्रोत",
    sourceNames: { flashpointLocal: "Flashpoint (इंस्टॉल किया हुआ)", flashpointOnline: "Flashpoint (ऑनलाइन डेटाबेस)", ...brands },
    moveUp: "ऊपर ले जाएँ", moveDown: "नीचे ले जाएँ",
    noSources: "कम-से-कम एक मेटाडेटा स्रोत चालू करें।",
    matchedFuzzy: "मिलता-जुलता नतीजा {n}%", matchedManual: "खोज में चुना गया", fromSource: "{source} से", openPage: "पृष्ठ खोलें",
    unmatchedTitle: "कोई मिलान नहीं मिला ({n})",
    unmatchedHint: "इन गेम में डेटा की कमी है, लेकिन कोई भी स्रोत इन्हें नहीं खोज पाया। इन्हें स्वयं खोजें और ज़रूरत हो तो दूसरे खोज शब्द इस्तेमाल करें।",
    search: "खोजें", findMetadata: "मेटाडेटा खोजें…",
    searchTitle: "{title} के लिए मेटाडेटा खोजें", searchPlaceholder: "गेम का शीर्षक या खोज शब्द",
    searching: "खोज जारी है…", noResults: "कोई नतीजा नहीं मिला। दूसरे खोज शब्द आज़माएँ या और स्रोत चालू करें।",
    unavailable: "उपलब्ध नहीं: {sources}", back: "नतीजों पर वापस जाएँ",
    nothingNew: "इस नतीजे में इस गेम के लिए कोई नया डेटा नहीं है।", imported: "मेटाडेटा आयात हो गया।", loading: "लोड हो रहा है…",
  },
  ar: {
    autoMetadata: "البحث تلقائيًا عن بيانات الألعاب الوصفية بعد الاستيراد",
    hint: "بعد الاستيراد، يُبحث عن الألعاب ذات البيانات الناقصة في المصادر المفعّلة من الأعلى إلى الأسفل: بمعرّف Flashpoint أو بعنوان مطابق تمامًا أو بعنوان قريب (90% أو أكثر). يملأ المصدر الأعلى الحقل أولًا. لا تُستبدل البيانات الموجودة إلا عندما تختار ذلك في نافذة التأكيد.",
    toast: "تم إكمال البيانات الوصفية:",
    promptTitle: "عُثر على بيانات وصفية لـ {n} من الألعاب",
    coverValue: "صورة الغلاف",
    sources: "مصادر البيانات الوصفية",
    sourceNames: { flashpointLocal: "Flashpoint (مثبّت)", flashpointOnline: "Flashpoint (قاعدة بيانات عبر الإنترنت)", ...brands },
    moveUp: "نقل لأعلى", moveDown: "نقل لأسفل",
    noSources: "فعّل مصدرًا واحدًا على الأقل للبيانات الوصفية.",
    matchedFuzzy: "مطابقة قريبة {n}%", matchedManual: "تم اختياره في البحث", fromSource: "من {source}", openPage: "فتح الصفحة",
    unmatchedTitle: "لم يُعثر على تطابق ({n})",
    unmatchedHint: "تنقص هذه الألعاب بيانات، لكن لم يعثر عليها أي مصدر. ابحث عنها بنفسك، واستخدم كلمات بحث أخرى عند الحاجة.",
    search: "بحث", findMetadata: "البحث عن بيانات وصفية…",
    searchTitle: "البحث عن بيانات وصفية لـ {title}", searchPlaceholder: "عنوان اللعبة أو كلمات البحث",
    searching: "جارٍ البحث…", noResults: "لا نتائج. جرّب كلمات بحث أخرى أو فعّل مزيدًا من المصادر.",
    unavailable: "غير متاح: {sources}", back: "العودة إلى النتائج",
    nothingNew: "لا تتضمن هذه النتيجة بيانات جديدة لهذه اللعبة.", imported: "تم استيراد البيانات الوصفية.", loading: "جارٍ التحميل…",
  },
  ru: {
    autoMetadata: "Автоматически искать метаданные игр после импорта",
    hint: "После импорта игры с недостающими данными ищутся во включённых источниках сверху вниз: по ID Flashpoint, точному названию или похожему названию (90% и выше). Источник, стоящий выше, заполняет поле первым. Имеющиеся данные заменяются только при выборе соответствующего действия в окне подтверждения.",
    toast: "Метаданные дополнены:",
    promptTitle: "Найдены метаданные для игр: {n}",
    coverValue: "Изображение обложки",
    sources: "Источники метаданных",
    sourceNames: { flashpointLocal: "Flashpoint (установленный)", flashpointOnline: "Flashpoint (онлайн-база данных)", ...brands },
    moveUp: "Поднять", moveDown: "Опустить",
    noSources: "Включите хотя бы один источник метаданных.",
    matchedFuzzy: "Похожее совпадение: {n}%", matchedManual: "Выбрано в поиске", fromSource: "Из {source}", openPage: "Открыть страницу",
    unmatchedTitle: "Совпадений не найдено ({n})",
    unmatchedHint: "У этих игр не хватает данных, но ни один источник их не нашёл. Поищите их самостоятельно, при необходимости используя другие поисковые запросы.",
    search: "Поиск", findMetadata: "Найти метаданные…",
    searchTitle: "Найти метаданные для {title}", searchPlaceholder: "Название игры или поисковый запрос",
    searching: "Поиск…", noResults: "Нет результатов. Попробуйте другой запрос или включите больше источников.",
    unavailable: "Недоступно: {sources}", back: "Вернуться к результатам",
    nothingNew: "В этом результате нет новых данных для этой игры.", imported: "Метаданные импортированы.", loading: "Загрузка…",
  },
};

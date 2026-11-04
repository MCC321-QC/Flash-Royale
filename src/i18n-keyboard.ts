import type { Language } from "./i18n";

interface KeyboardText {
  layout: string; symbols: string; candidates: string; composition: string; insert: string;
  enter: string; tab: string; delete: string; caret: string; loading: string; failed: string;
  retry: string; gameHint: string; previous: string; next: string; saveFailed: string;
  minimum: string; invalid: string; phoneticHint: string;
}

export const keyboardLabels: Record<Language, KeyboardText> = {
  en: {
    phoneticHint: "Japanese uses romaji and Chinese uses Pinyin. Type a pronunciation, then choose a conversion candidate.",
    minimum: "Minimum {count} characters.", invalid: "This text does not match the field's requirements.",
    layout: "Keyboard layout", symbols: "Symbols", candidates: "Conversion candidates", composition: "Composition", insert: "Insert",
    enter: "Enter", tab: "Tab", delete: "Delete", caret: "Move caret", loading: "Loading offline dictionary…", failed: "Could not load the offline input dictionary.",
    retry: "Retry", gameHint: "Types into the selected game field. Composition is inserted when you choose a candidate.",
    previous: "Previous candidates", next: "Next candidates", saveFailed: "Could not save the keyboard layout.",
  },
  fr: {
    phoneticHint: "Le japonais utilise le romaji et le chinois le pinyin. Saisissez une prononciation, puis choisissez une proposition.",
    minimum: "Minimum de {count} caractères.", invalid: "Ce texte ne respecte pas les contraintes du champ.",
    layout: "Disposition du clavier", symbols: "Symboles", candidates: "Propositions de conversion", composition: "Composition", insert: "Insérer",
    enter: "Entrée", tab: "Tabulation", delete: "Supprimer", caret: "Déplacer le curseur", loading: "Chargement du dictionnaire hors ligne…", failed: "Impossible de charger le dictionnaire de saisie hors ligne.",
    retry: "Réessayer", gameHint: "Écrit dans le champ sélectionné du jeu. La composition est insérée au choix d'une proposition.",
    previous: "Propositions précédentes", next: "Propositions suivantes", saveFailed: "Impossible d'enregistrer la disposition du clavier.",
  },
  zh: {
    phoneticHint: "日语使用罗马字，中文使用拼音。输入读音后选择转换候选词。",
    minimum: "至少输入 {count} 个字符。", invalid: "此文本不符合输入框的要求。",
    layout: "键盘布局", symbols: "符号", candidates: "转换候选词", composition: "正在输入", insert: "输入",
    enter: "回车", tab: "制表", delete: "删除", caret: "移动光标", loading: "正在加载离线词典…", failed: "无法加载离线输入词典。",
    retry: "重试", gameHint: "输入到游戏中已选择的文本框。选择候选词后提交输入。",
    previous: "上一页候选词", next: "下一页候选词", saveFailed: "无法保存键盘布局。",
  },
  es: {
    phoneticHint: "El japonés usa romaji y el chino usa pinyin. Escribe la pronunciación y elige una sugerencia de conversión.",
    minimum: "Mínimo de {count} caracteres.", invalid: "Este texto no cumple los requisitos del campo.",
    layout: "Distribución del teclado", symbols: "Símbolos", candidates: "Candidatos de conversión", composition: "Composición", insert: "Insertar",
    enter: "Intro", tab: "Tabulador", delete: "Suprimir", caret: "Mover cursor", loading: "Cargando diccionario sin conexión…", failed: "No se pudo cargar el diccionario de entrada sin conexión.",
    retry: "Reintentar", gameHint: "Escribe en el campo seleccionado del juego. La composición se inserta al elegir un candidato.",
    previous: "Candidatos anteriores", next: "Candidatos siguientes", saveFailed: "No se pudo guardar la distribución del teclado.",
  },
  de: {
    phoneticHint: "Japanisch verwendet Romaji, Chinesisch Pinyin. Gib die Aussprache ein und wähle einen Umwandlungsvorschlag.",
    minimum: "Mindestens {count} Zeichen.", invalid: "Dieser Text entspricht nicht den Anforderungen des Felds.",
    layout: "Tastaturbelegung", symbols: "Symbole", candidates: "Umwandlungsvorschläge", composition: "Eingabe", insert: "Einfügen",
    enter: "Eingabe", tab: "Tabulator", delete: "Entfernen", caret: "Textcursor bewegen", loading: "Offline-Wörterbuch wird geladen…", failed: "Das Offline-Eingabewörterbuch konnte nicht geladen werden.",
    retry: "Erneut versuchen", gameHint: "Schreibt in das ausgewählte Spielfeld. Die Eingabe wird bei Auswahl eines Vorschlags eingefügt.",
    previous: "Vorherige Vorschläge", next: "Nächste Vorschläge", saveFailed: "Die Tastaturbelegung konnte nicht gespeichert werden.",
  },
  "pt-BR": {
    phoneticHint: "O japonês usa romaji e o chinês usa pinyin. Digite a pronúncia e escolha uma sugestão de conversão.",
    minimum: "Mínimo de {count} caracteres.", invalid: "Este texto não atende aos requisitos do campo.",
    layout: "Layout do teclado", symbols: "Símbolos", candidates: "Sugestões de conversão", composition: "Composição", insert: "Inserir",
    enter: "Enter", tab: "Tabulação", delete: "Excluir", caret: "Mover cursor", loading: "Carregando dicionário offline…", failed: "Não foi possível carregar o dicionário de entrada offline.",
    retry: "Tentar novamente", gameHint: "Digita no campo selecionado do jogo. A composição é inserida ao escolher uma sugestão.",
    previous: "Sugestões anteriores", next: "Próximas sugestões", saveFailed: "Não foi possível salvar o layout do teclado.",
  },
  ja: {
    phoneticHint: "日本語はローマ字、中国語はピンインで入力します。読みを入力して変換候補を選んでください。",
    minimum: "{count} 文字以上入力してください。", invalid: "このテキストは入力欄の条件を満たしていません。",
    layout: "キーボード配列", symbols: "記号", candidates: "変換候補", composition: "入力中", insert: "挿入",
    enter: "改行", tab: "タブ", delete: "削除", caret: "カーソル移動", loading: "オフライン辞書を読み込み中…", failed: "オフライン入力辞書を読み込めませんでした。",
    retry: "再試行", gameHint: "ゲームで選択した入力欄に入力します。変換候補を選ぶと入力が確定します。",
    previous: "前の候補", next: "次の候補", saveFailed: "キーボード配列を保存できませんでした。",
  },
  ko: {
    phoneticHint: "일본어는 로마자, 중국어는 병음을 사용합니다. 발음을 입력한 뒤 변환 후보를 선택하세요.",
    minimum: "최소 {count}자 이상 입력하세요.", invalid: "이 텍스트는 입력란의 조건에 맞지 않습니다.",
    layout: "키보드 배열", symbols: "기호", candidates: "변환 후보", composition: "조합 중", insert: "입력",
    enter: "엔터", tab: "탭", delete: "삭제", caret: "커서 이동", loading: "오프라인 사전을 불러오는 중…", failed: "오프라인 입력 사전을 불러오지 못했습니다.",
    retry: "다시 시도", gameHint: "게임에서 선택한 입력란에 입력합니다. 후보를 선택하면 조합된 글자가 입력됩니다.",
    previous: "이전 후보", next: "다음 후보", saveFailed: "키보드 배열을 저장하지 못했습니다.",
  },
  hi: {
    phoneticHint: "जापानी में रोमाजी और चीनी में पिनयिन इस्तेमाल होता है। उच्चारण लिखें, फिर रूपांतरण विकल्प चुनें।",
    minimum: "कम से कम {count} अक्षर।", invalid: "यह टेक्स्ट फ़ील्ड की शर्तों को पूरा नहीं करता।",
    layout: "कीबोर्ड लेआउट", symbols: "चिह्न", candidates: "रूपांतरण विकल्प", composition: "संयोजन", insert: "डालें",
    enter: "एंटर", tab: "टैब", delete: "मिटाएँ", caret: "कर्सर खिसकाएँ", loading: "ऑफ़लाइन शब्दकोश लोड हो रहा है…", failed: "ऑफ़लाइन इनपुट शब्दकोश लोड नहीं हो सका।",
    retry: "फिर प्रयास करें", gameHint: "गेम के चुने हुए फ़ील्ड में टाइप करता है। विकल्प चुनने पर संयोजन डाला जाता है।",
    previous: "पिछले विकल्प", next: "अगले विकल्प", saveFailed: "कीबोर्ड लेआउट सहेजा नहीं जा सका।",
  },
  ar: {
    phoneticHint: "تستخدم اليابانية الروماجي والصينية البينيين. اكتب النطق ثم اختر اقتراح التحويل.",
    minimum: "الحد الأدنى {count} حرفًا.", invalid: "هذا النص لا يطابق متطلبات الحقل.",
    layout: "تخطيط لوحة المفاتيح", symbols: "الرموز", candidates: "اقتراحات التحويل", composition: "التركيب", insert: "إدراج",
    enter: "إدخال", tab: "جدولة", delete: "حذف", caret: "تحريك المؤشر", loading: "جارٍ تحميل القاموس دون اتصال…", failed: "تعذر تحميل قاموس الإدخال دون اتصال.",
    retry: "إعادة المحاولة", gameHint: "تكتب في الحقل المحدد داخل اللعبة. يُدرج التركيب عند اختيار اقتراح.",
    previous: "الاقتراحات السابقة", next: "الاقتراحات التالية", saveFailed: "تعذر حفظ تخطيط لوحة المفاتيح.",
  },
  ru: {
    phoneticHint: "Японский использует ромадзи, китайский — пиньинь. Введите произношение и выберите вариант преобразования.",
    minimum: "Не менее {count} символов.", invalid: "Этот текст не соответствует требованиям поля.",
    layout: "Раскладка клавиатуры", symbols: "Символы", candidates: "Варианты преобразования", composition: "Составление", insert: "Вставить",
    enter: "Ввод", tab: "Табуляция", delete: "Удалить", caret: "Переместить курсор", loading: "Загрузка автономного словаря…", failed: "Не удалось загрузить автономный словарь ввода.",
    retry: "Повторить", gameHint: "Вводит текст в выбранное поле игры. Составленный текст вставляется после выбора варианта.",
    previous: "Предыдущие варианты", next: "Следующие варианты", saveFailed: "Не удалось сохранить раскладку клавиатуры.",
  },
};

import type { Language } from "./i18n";

interface PresetText {
  builtIn: string;
  savedPresets: string;
  save: string;
  rename: string;
  remove: string;
  name: string;
  apply: string;
  applyConfirm: string;
  deleteConfirm: string;
  contents: string;
  failed: string;
  invalidName: string;
  duplicateName: string;
  restart: string;
}

export const presetLabels: Record<Language, PresetText> = {
  en: {
    restart: "Restart Flash Royale to load the preset library.",
    builtIn: "Built-in presets", savedPresets: "Saved presets", save: "Save as new preset", rename: "Rename preset", remove: "Delete preset",
    name: "Preset name", apply: "Apply preset", applyConfirm: "Replace this player's entire configuration with “{name}”?",
    deleteConfirm: "Delete “{name}” from the shared presets? Existing game mappings will not change.",
    contents: "Saves mappings, dead zone, mouse speed, and enabled setting for this player. Available in every game.",
    failed: "Could not update or load presets", invalidName: "Enter a name of 1 to 80 characters.", duplicateName: "A preset with that name already exists.",
  },
  fr: {
    restart: "Pour charger la bibliothèque de préréglages, redémarrez Flash Royale.",
    builtIn: "Préréglages fournis", savedPresets: "Préréglages sauvegardés", save: "Sauvegarder comme nouveau préréglage", rename: "Renommer ce préréglage", remove: "Supprimer ce préréglage",
    name: "Nom du préréglage", apply: "Appliquer ce préréglage", applyConfirm: "Remplacer l'intégralité des réglages de ce joueur par « {name} » ?",
    deleteConfirm: "Retirer « {name} » des préréglages partagés ? Les associations déjà définies pour les jeux resteront inchangées.",
    contents: "Sauvegarde les associations, la zone morte, la vitesse de la souris et le réglage d'activation de ce joueur. Utilisable dans chaque jeu.",
    failed: "Échec de la mise à jour ou du chargement des préréglages", invalidName: "Indiquez un nom comportant de 1 à 80 caractères.", duplicateName: "Ce nom est déjà utilisé par un préréglage.",
  },
  zh: {
    restart: "重启 Flash Royale 后即可加载预设库。",
    builtIn: "预置方案", savedPresets: "已保存方案", save: "保存为新的预设", rename: "更改预设名称", remove: "删除此预设",
    name: "预设名称", apply: "应用此预设", applyConfirm: "是否以“{name}”替换这位玩家的整个配置？",
    deleteConfirm: "是否从共享预设中移除“{name}”？已有的游戏映射将保持不变。",
    contents: "保存这位玩家的映射、死区、鼠标速度及启用状态设置。所有游戏均可使用。",
    failed: "预设更新或加载失败", invalidName: "请填写长度为 1 至 80 个字符的名称。", duplicateName: "已有预设使用此名称。",
  },
  es: {
    restart: "Para cargar la biblioteca de preajustes, reinicia Flash Royale.",
    builtIn: "Preajustes incorporados", savedPresets: "Preajustes almacenados", save: "Guardar como un preajuste nuevo", rename: "Cambiar nombre del preajuste", remove: "Borrar preajuste",
    name: "Nombre del preajuste", apply: "Aplicar este preajuste", applyConfirm: "¿Sustituir la configuración completa de este jugador por «{name}»?",
    deleteConfirm: "¿Borrar «{name}» de los preajustes compartidos? Las asignaciones de los juegos existentes se conservarán.",
    contents: "Almacena las asignaciones, la zona muerta, la velocidad del ratón y la opción de activación de este jugador. Se puede usar en cualquier juego.",
    failed: "No fue posible actualizar ni cargar los preajustes", invalidName: "Escribe un nombre que tenga entre 1 y 80 caracteres.", duplicateName: "Ese nombre ya está en uso por otro preajuste.",
  },
  de: {
    restart: "Zum Laden der Vorlagenbibliothek musst du Flash Royale neu starten.",
    builtIn: "Mitgelieferte Vorlagen", savedPresets: "Gesicherte Vorlagen", save: "Als neue Vorlage sichern", rename: "Namen der Vorlage ändern", remove: "Vorlage entfernen",
    name: "Name der Vorlage", apply: "Diese Vorlage anwenden", applyConfirm: "Alle Einstellungen dieses Spielers durch „{name}“ ersetzen?",
    deleteConfirm: "„{name}“ aus den gemeinsam genutzten Vorlagen entfernen? Bereits vorhandene Spielbelegungen werden nicht geändert.",
    contents: "Sichert Belegungen, Totzone, Mausgeschwindigkeit und den Aktivierungsstatus dieses Spielers. Für jedes Spiel verfügbar.",
    failed: "Aktualisieren oder Laden der Vorlagen fehlgeschlagen", invalidName: "Trage einen Namen mit 1 bis 80 Zeichen ein.", duplicateName: "Dieser Name wird bereits von einer Vorlage verwendet.",
  },
  "pt-BR": {
    restart: "Para abrir a biblioteca de predefinições, reinicie o Flash Royale.",
    builtIn: "Predefinições fornecidas", savedPresets: "Predefinições armazenadas", save: "Salvar como uma nova predefinição", rename: "Alterar nome da predefinição", remove: "Apagar predefinição",
    name: "Nome da predefinição", apply: "Aplicar esta predefinição", applyConfirm: "Trocar a configuração completa deste jogador por “{name}”?",
    deleteConfirm: "Apagar “{name}” das predefinições compartilhadas? Os mapeamentos já existentes nos jogos serão preservados.",
    contents: "Armazena os mapeamentos, a zona morta, a velocidade do mouse e a opção de ativação deste jogador. Pode ser usada em qualquer jogo.",
    failed: "Falha ao atualizar ou carregar as predefinições", invalidName: "Digite um nome que tenha de 1 a 80 caracteres.", duplicateName: "Esse nome já está em uso por uma predefinição.",
  },
  ja: {
    restart: "プリセットのライブラリを読み込むため、Flash Royale を起動し直してください。",
    builtIn: "標準搭載のプリセット", savedPresets: "保存したプリセット", save: "別の新規プリセットとして保存", rename: "プリセットの名前を変更", remove: "このプリセットを削除",
    name: "プリセットの名前", apply: "このプリセットを適用", applyConfirm: "このプレイヤーの構成をすべて「{name}」で置き換えますか？",
    deleteConfirm: "共有プリセットの「{name}」を削除しますか？ゲームに設定済みの割り当てには影響しません。",
    contents: "このプレイヤーの割り当て、デッドゾーン、マウスの速度、有効・無効の設定を保存します。どのゲームでも利用できます。",
    failed: "プリセットの更新または読み込みに失敗しました", invalidName: "名前は 1～80 文字で指定してください。", duplicateName: "その名前は別のプリセットで使われています。",
  },
  ko: {
    restart: "프리셋 보관함을 읽으려면 Flash Royale을 재시작하세요.",
    builtIn: "기본 제공 프리셋", savedPresets: "보관된 프리셋", save: "새로운 프리셋으로 저장", rename: "프리셋의 이름 바꾸기", remove: "이 프리셋 삭제",
    name: "프리셋의 이름", apply: "이 프리셋 적용", applyConfirm: "이 플레이어의 구성을 모두 “{name}”(으)로 대체할까요?",
    deleteConfirm: "공유 프리셋에서 “{name}”을 지울까요? 게임에 이미 지정한 매핑은 유지됩니다.",
    contents: "이 플레이어의 매핑, 데드존, 마우스 속도, 사용 여부 설정을 보관합니다. 어느 게임에서나 이용할 수 있습니다.",
    failed: "프리셋 갱신 또는 읽기에 실패했습니다", invalidName: "이름을 1~80자로 지정하세요.", duplicateName: "다른 프리셋에서 이미 쓰는 이름입니다.",
  },
  hi: {
    restart: "प्रीसेट की लाइब्रेरी खोलने के लिए Flash Royale को दोबारा चालू करें।",
    builtIn: "बिल्ट-इन प्रीसेट", savedPresets: "सुरक्षित किए गए प्रीसेट", save: "एक नए प्रीसेट के तौर पर सहेजें", rename: "प्रीसेट को नया नाम दें", remove: "यह प्रीसेट मिटाएँ",
    name: "प्रीसेट का नाम", apply: "यह प्रीसेट लागू करें", applyConfirm: "क्या इस खिलाड़ी की पूरी सेटिंग को “{name}” से बदलना है?",
    deleteConfirm: "क्या साझा प्रीसेट में से “{name}” मिटाना है? गेम की पहले से मौजूद मैपिंग जैसी हैं वैसी रहेंगी।",
    contents: "इस खिलाड़ी की मैपिंग, डेड ज़ोन, माउस की गति और चालू होने की सेटिंग सहेजता है। हर गेम में इस्तेमाल किया जा सकता है।",
    failed: "प्रीसेट में बदलाव करना या उन्हें लोड करना संभव नहीं हुआ", invalidName: "नाम 1 से 80 अक्षरों के बीच रखें।", duplicateName: "यह नाम किसी प्रीसेट के लिए पहले ही इस्तेमाल हो रहा है।",
  },
  ar: {
    restart: "لتحميل مكتبة الإعدادات المسبقة، شغّل Flash Royale من جديد.",
    builtIn: "إعدادات مسبقة جاهزة", savedPresets: "إعدادات مسبقة مخزّنة", save: "احفظ كإعداد مسبق جديد", rename: "غيّر اسم الإعداد المسبق", remove: "احذف هذا الإعداد المسبق",
    name: "اسم الإعداد المسبق", apply: "طبّق هذا الإعداد المسبق", applyConfirm: "هل تريد إحلال «{name}» محل إعدادات هذا اللاعب كاملةً؟",
    deleteConfirm: "هل تريد إزالة «{name}» من الإعدادات المسبقة المشتركة؟ ستبقى تعيينات الألعاب الموجودة دون تغيير.",
    contents: "يخزّن تعيينات هذا اللاعب والمنطقة الميتة وسرعة الفأرة وخيار التفعيل. يمكن استخدامه في كل لعبة.",
    failed: "لم ينجح تحديث الإعدادات المسبقة أو تحميلها", invalidName: "اكتب اسمًا يتراوح طوله بين 1 و80 حرفًا.", duplicateName: "هذا الاسم مستخدم بالفعل لإعداد مسبق.",
  },
  ru: {
    restart: "Чтобы загрузить библиотеку профилей, запустите Flash Royale заново.",
    builtIn: "Готовые профили", savedPresets: "Сохранённые профили", save: "Записать как новый профиль", rename: "Изменить название профиля", remove: "Удалить профиль",
    name: "Имя профиля", apply: "Применить этот профиль", applyConfirm: "Полностью заменить настройки этого игрока профилем «{name}»?",
    deleteConfirm: "Убрать «{name}» из общих профилей? Уже заданные назначения в играх останутся прежними.",
    contents: "Запоминает назначения, мёртвую зону, скорость мыши и настройку включения для этого игрока. Можно использовать в любой игре.",
    failed: "Обновление или загрузка профилей не удались", invalidName: "Укажите имя от 1 до 80 символов.", duplicateName: "Это имя уже используется другим профилем.",
  },
};

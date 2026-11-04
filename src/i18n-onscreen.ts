import type { Language } from "./i18n";

export const onscreenToolbarLabels: Record<Language, { toggle: string; help: string }> = {
  en: { toggle: "Show player toolbar arrow", help: "Show the arrow that opens the player toolbar when the on-screen gamepad is active." },
  fr: { toggle: "Afficher la flèche de la barre d'outils du lecteur", help: "Affiche la flèche ouvrant la barre d'outils du lecteur lorsque la manette à l'écran est active." },
  es: { toggle: "Mostrar la flecha de la barra del reproductor", help: "Muestra la flecha que abre la barra del reproductor cuando el mando en pantalla está activo." },
  de: { toggle: "Pfeil für die Player-Werkzeugleiste anzeigen", help: "Zeigt den Pfeil zum Öffnen der Player-Werkzeugleiste, wenn das Bildschirm-Gamepad aktiv ist." },
  "pt-BR": { toggle: "Mostrar seta da barra do player", help: "Mostra a seta que abre a barra do player quando o controle na tela está ativo." },
  zh: { toggle: "显示播放器工具栏箭头", help: "屏幕手柄启用时，显示用于打开播放器工具栏的箭头。" },
  ja: { toggle: "プレイヤーのツールバー矢印を表示", help: "画面上のゲームパッドが有効なとき、プレイヤーのツールバーを開く矢印を表示します。" },
  ko: { toggle: "플레이어 도구 모음 화살표 표시", help: "화면 게임패드가 활성화되면 플레이어 도구 모음을 여는 화살표를 표시합니다." },
  hi: { toggle: "प्लेयर टूलबार का तीर दिखाएँ", help: "स्क्रीन गेमपैड सक्रिय होने पर प्लेयर टूलबार खोलने वाला तीर दिखाता है।" },
  ar: { toggle: "إظهار سهم شريط أدوات المشغّل", help: "يعرض السهم الذي يفتح شريط أدوات المشغّل عند تفعيل يد التحكم على الشاشة." },
  ru: { toggle: "Показывать стрелку панели проигрывателя", help: "Показывает стрелку открытия панели проигрывателя, когда экранный геймпад активен." },
};

export const onscreenMouseLabels: Record<Language, { touchpad: string; leftMouse: string; rightMouse: string }> = {
  en: { touchpad: "Mouse touchpad", leftMouse: "Left mouse button", rightMouse: "Right mouse button" },
  fr: { touchpad: "Pavé tactile de souris", leftMouse: "Bouton gauche de la souris", rightMouse: "Bouton droit de la souris" },
  es: { touchpad: "Panel táctil del ratón", leftMouse: "Botón izquierdo del ratón", rightMouse: "Botón derecho del ratón" },
  de: { touchpad: "Maus-Touchpad", leftMouse: "Linke Maustaste", rightMouse: "Rechte Maustaste" },
  "pt-BR": { touchpad: "Touchpad do mouse", leftMouse: "Botão esquerdo do mouse", rightMouse: "Botão direito do mouse" },
  zh: { touchpad: "鼠标触摸板", leftMouse: "鼠标左键", rightMouse: "鼠标右键" },
  ja: { touchpad: "マウスタッチパッド", leftMouse: "マウス左ボタン", rightMouse: "マウス右ボタン" },
  ko: { touchpad: "마우스 터치패드", leftMouse: "마우스 왼쪽 버튼", rightMouse: "마우스 오른쪽 버튼" },
  hi: { touchpad: "माउस टचपैड", leftMouse: "बायाँ माउस बटन", rightMouse: "दायाँ माउस बटन" },
  ar: { touchpad: "لوحة لمس الفأرة", leftMouse: "زر الفأرة الأيسر", rightMouse: "زر الفأرة الأيمن" },
  ru: { touchpad: "Сенсорная панель мыши", leftMouse: "Левая кнопка мыши", rightMouse: "Правая кнопка мыши" },
};

const keys = ["title", "auto", "enabled", "disabled", "game", "edit", "help", "portrait", "landscape", "control", "visible", "mouse", "size", "opacity", "sensitivity", "deadzone", "reset", "rotate", "preview", "up", "down", "left", "right", "mapping"] as const;
type Text = Record<typeof keys[number], string>;
const rows: Record<Language, string[]> = {
  en: ["On-screen gamepad", "Auto", "Enabled", "Disabled", "Enable on-screen gamepad for this game", "Edit touch controls", "Auto shows controls on touchscreen devices only when controller mode is inactive.", "Portrait", "Landscape", "Control", "Visible", "Mouse movement", "Size", "Opacity", "Mouse sensitivity", "Stick dead zone", "Reset layout", "Rotate game 90 degrees", "Layout preview", "Up", "Down", "Left", "Right", "Mapping"],
  fr: ["Manette à l'écran", "Auto", "Activée", "Désactivée", "Activer la manette à l'écran pour ce jeu", "Modifier les commandes tactiles", "Auto affiche les commandes sur écran tactile hors mode manette.", "Portrait", "Paysage", "Commande", "Visible", "Mouvement de souris", "Taille", "Opacité", "Sensibilité de souris", "Zone morte du stick", "Réinitialiser la disposition", "Tourner le jeu de 90 degrés", "Aperçu de disposition", "Haut", "Bas", "Gauche", "Droite", "Affectation"],
  es: ["Mando en pantalla", "Auto", "Activado", "Desactivado", "Activar mando en pantalla para este juego", "Editar controles táctiles", "Auto muestra controles en pantallas táctiles fuera del modo mando.", "Vertical", "Horizontal", "Control", "Visible", "Movimiento del ratón", "Tamaño", "Opacidad", "Sensibilidad del ratón", "Zona muerta", "Restablecer diseño", "Girar juego 90 grados", "Vista previa", "Arriba", "Abajo", "Izquierda", "Derecha", "Asignación"],
  de: ["Bildschirm-Gamepad", "Auto", "Aktiviert", "Deaktiviert", "Bildschirm-Gamepad für dieses Spiel aktivieren", "Touch-Steuerung bearbeiten", "Auto zeigt Touch-Steuerung nur außerhalb des Controller-Modus.", "Hochformat", "Querformat", "Steuerung", "Sichtbar", "Mausbewegung", "Größe", "Deckkraft", "Mausempfindlichkeit", "Stick-Totzone", "Layout zurücksetzen", "Spiel um 90 Grad drehen", "Layout-Vorschau", "Oben", "Unten", "Links", "Rechts", "Belegung"],
  "pt-BR": ["Controle na tela", "Auto", "Ativado", "Desativado", "Ativar controle na tela para este jogo", "Editar controles de toque", "Auto mostra controles em telas táteis fora do modo controle.", "Retrato", "Paisagem", "Controle", "Visível", "Movimento do mouse", "Tamanho", "Opacidade", "Sensibilidade do mouse", "Zona morta", "Redefinir layout", "Girar jogo 90 graus", "Prévia do layout", "Cima", "Baixo", "Esquerda", "Direita", "Mapeamento"],
  zh: ["屏幕手柄", "自动", "启用", "禁用", "为此游戏启用屏幕手柄", "编辑触摸控件", "自动模式仅在触摸屏且手柄模式未启用时显示。", "竖屏", "横屏", "控件", "显示", "鼠标移动", "大小", "不透明度", "鼠标灵敏度", "摇杆死区", "重置布局", "旋转游戏90度", "布局预览", "上", "下", "左", "右", "映射"],
  ja: ["画面上のゲームパッド", "自動", "有効", "無効", "このゲームで画面ゲームパッドを有効にする", "タッチ操作を編集", "自動はタッチ画面でコントローラーモードが無効な時のみ表示します。", "縦", "横", "操作", "表示", "マウス移動", "サイズ", "不透明度", "マウス感度", "スティックのデッドゾーン", "配置をリセット", "ゲームを90度回転", "配置プレビュー", "上", "下", "左", "右", "割り当て"],
  ko: ["화면 게임패드", "자동", "활성화", "비활성화", "이 게임의 화면 게임패드 활성화", "터치 조작 편집", "자동은 터치스크린에서 컨트롤러 모드가 아닐 때 표시합니다.", "세로", "가로", "조작", "표시", "마우스 이동", "크기", "불투명도", "마우스 감도", "스틱 데드존", "배치 초기화", "게임 90도 회전", "배치 미리보기", "위", "아래", "왼쪽", "오른쪽", "매핑"],
  hi: ["स्क्रीन गेमपैड", "स्वचालित", "सक्षम", "अक्षम", "इस गेम के लिए स्क्रीन गेमपैड सक्षम करें", "टच नियंत्रण संपादित करें", "स्वचालित मोड टचस्क्रीन पर कंट्रोलर मोड बंद होने पर दिखता है।", "पोर्ट्रेट", "लैंडस्केप", "नियंत्रण", "दिखाएँ", "माउस गति", "आकार", "अपारदर्शिता", "माउस संवेदनशीलता", "स्टिक डेड ज़ोन", "लेआउट रीसेट", "गेम 90 डिग्री घुमाएँ", "लेआउट पूर्वावलोकन", "ऊपर", "नीचे", "बाएँ", "दाएँ", "मैपिंग"],
  ar: ["يد تحكم على الشاشة", "تلقائي", "مفعّل", "معطّل", "تفعيل يد التحكم على الشاشة لهذه اللعبة", "تحرير التحكم باللمس", "يظهر التلقائي على شاشات اللمس خارج وضع يد التحكم.", "عمودي", "أفقي", "عنصر تحكم", "ظاهر", "حركة الفأرة", "الحجم", "العتامة", "حساسية الفأرة", "المنطقة الميتة", "إعادة ضبط التخطيط", "تدوير اللعبة 90 درجة", "معاينة التخطيط", "أعلى", "أسفل", "يسار", "يمين", "التعيين"],
  ru: ["Экранный геймпад", "Авто", "Включён", "Выключен", "Включить экранный геймпад для этой игры", "Изменить сенсорное управление", "Авто показывает управление на сенсорном экране вне режима контроллера.", "Портрет", "Альбом", "Элемент", "Видимый", "Движение мыши", "Размер", "Непрозрачность", "Чувствительность мыши", "Мёртвая зона", "Сбросить раскладку", "Повернуть игру на 90 градусов", "Просмотр раскладки", "Вверх", "Вниз", "Влево", "Вправо", "Назначение"],
};
export function onscreenLabels(language: Language): Text {
  return { ...Object.fromEntries(keys.map((key, index) => [key, rows[language][index]])), edit: onscreenControlsLabels[language], game: onscreenDisableLabels[language] } as Text;
}

const onscreenDisableLabels: Record<Language, string> = {
  en: "Disable on-screen controls",
  fr: "Désactiver les commandes à l'écran",
  es: "Desactivar controles en pantalla",
  de: "Bildschirmsteuerung deaktivieren",
  "pt-BR": "Desativar controles na tela",
  zh: "禁用屏幕控件",
  ja: "画面上の操作を無効にする",
  ko: "화면 컨트롤 비활성화",
  hi: "स्क्रीन नियंत्रण अक्षम करें",
  ar: "تعطيل عناصر التحكم على الشاشة",
  ru: "Отключить экранное управление",
};

const onscreenControlsLabels: Record<Language, string> = {
  en: "On-screen controls",
  fr: "Commandes à l'écran",
  es: "Controles en pantalla",
  de: "Bildschirmsteuerung",
  "pt-BR": "Controles na tela",
  zh: "屏幕控件",
  ja: "画面上の操作",
  ko: "화면 컨트롤",
  hi: "स्क्रीन नियंत्रण",
  ar: "عناصر التحكم على الشاشة",
  ru: "Экранное управление",
};

export const onscreenLayoutHelp: Record<Language, string> = {
  en: "Select a control in the preview or the Control menu to adjust its size and position. Opacity applies to all controls.",
  fr: "Sélectionnez une commande dans l'aperçu ou le menu Commande pour ajuster sa taille et sa position. L'opacité s'applique à toutes les commandes.",
  zh: "在预览或控件菜单中选择一个控件，以调整其大小和位置。不透明度适用于所有控件。",
  es: "Selecciona un control en la vista previa o en el menú Control para ajustar su tamaño y posición. La opacidad se aplica a todos los controles.",
  de: "Wähle ein Bedienelement in der Vorschau oder im Menü Bedienelement aus, um seine Größe und Position anzupassen. Die Deckkraft gilt für alle Bedienelemente.",
  "pt-BR": "Selecione um controle na prévia ou no menu Controle para ajustar seu tamanho e posição. A opacidade se aplica a todos os controles.",
  ja: "プレビューまたは操作メニューでコントロールを選択し、サイズと位置を調整します。不透明度はすべてのコントロールに適用されます。",
  ko: "미리 보기 또는 컨트롤 메뉴에서 컨트롤을 선택하여 크기와 위치를 조정하세요. 불투명도는 모든 컨트롤에 적용됩니다.",
  hi: "आकार और स्थिति समायोजित करने के लिए पूर्वावलोकन या नियंत्रण मेनू में कोई नियंत्रण चुनें। अपारदर्शिता सभी नियंत्रणों पर लागू होती है।",
  ar: "حدد عنصر تحكم في المعاينة أو قائمة التحكم لضبط حجمه وموضعه. تُطبَّق العتامة على جميع عناصر التحكم.",
  ru: "Выберите элемент управления в предпросмотре или в меню «Элемент управления», чтобы настроить его размер и положение. Непрозрачность применяется ко всем элементам.",
};

export const onscreenPositionLabels: Record<Language, { x: string; y: string }> = {
  en: { x: "Horizontal position", y: "Vertical position" },
  fr: { x: "Position horizontale", y: "Position verticale" },
  zh: { x: "水平位置", y: "垂直位置" },
  es: { x: "Posición horizontal", y: "Posición vertical" },
  de: { x: "Horizontale Position", y: "Vertikale Position" },
  "pt-BR": { x: "Posição horizontal", y: "Posição vertical" },
  ja: { x: "水平位置", y: "垂直位置" },
  ko: { x: "가로 위치", y: "세로 위치" },
  hi: { x: "क्षैतिज स्थिति", y: "ऊर्ध्वाधर स्थिति" },
  ar: { x: "الموضع الأفقي", y: "الموضع العمودي" },
  ru: { x: "Положение по горизонтали", y: "Положение по вертикали" },
};

export const onscreenGameHelp: Record<Language, string> = {
  en: "Hide touch controls for this game in both Auto and Enabled modes. Your layout and mappings are kept.",
  fr: "Masquer les commandes tactiles pour ce jeu en modes Auto et Activé. La disposition et les affectations sont conservées.",
  zh: "在自动和启用模式下隐藏此游戏的触摸控件。保留布局和映射。",
  es: "Ocultar los controles táctiles de este juego en los modos Auto y Activado. Se conservan el diseño y las asignaciones.",
  de: "Touch-Steuerung für dieses Spiel in Auto und Aktiviert ausblenden. Layout und Belegungen bleiben erhalten.",
  "pt-BR": "Ocultar os controles de toque deste jogo nos modos Auto e Ativado. O layout e os mapeamentos são mantidos.",
  ja: "自動・有効モードの両方でこのゲームのタッチ操作を非表示にします。配置と割り当ては保持されます。",
  ko: "자동 및 활성화 모드에서 이 게임의 터치 조작을 숨깁니다. 배치와 매핑은 유지됩니다.",
  hi: "स्वचालित और सक्षम दोनों मोड में इस गेम के टच नियंत्रण छिपाएँ। लेआउट और मैपिंग सुरक्षित रहते हैं।",
  ar: "إخفاء التحكم باللمس لهذه اللعبة في الوضعين التلقائي والمفعّل. يتم الاحتفاظ بالتخطيط والتعيينات.",
  ru: "Скрыть сенсорное управление этой игры в режимах «Авто» и «Включён». Раскладка и назначения сохраняются.",
};

export const onscreenStyleLabels: Record<Language, { style: string; global: string }> = {
  en: { style: "Controller appearance", global: "Use global appearance" },
  fr: { style: "Apparence de la manette", global: "Utiliser l'apparence globale" },
  zh: { style: "手柄外观", global: "使用全局外观" },
  es: { style: "Apariencia del mando", global: "Usar apariencia global" },
  de: { style: "Controller-Aussehen", global: "Globales Aussehen verwenden" },
  "pt-BR": { style: "Aparência do controle", global: "Usar aparência global" },
  ja: { style: "コントローラーの外観", global: "全体設定の外観を使用" },
  ko: { style: "컨트롤러 모양", global: "전역 모양 사용" },
  hi: { style: "कंट्रोलर का रूप", global: "वैश्विक रूप का उपयोग करें" },
  ar: { style: "مظهر يد التحكم", global: "استخدام المظهر العام" },
  ru: { style: "Вид контроллера", global: "Использовать общий вид" },
};

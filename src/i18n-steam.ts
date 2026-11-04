import type { Language } from "./i18n";

export interface SteamRemapText {
  leftTrackpad: string;
  rightTrackpad: string;
  click: string;
  touch: string;
  leftGrip: string;
  rightGrip: string;
  trackpadMouse: string;
  trackpadScroll: string;
  trackpadSurfaces: string;
  chooseInput: string;
  controllerInput: string;
  trackpadTitle: string;
  trackpadHint: string;
  trackpadSensitivity: string;
  trackpadAcceleration: string;
  trackball: string;
  haptics: string;
  resetTrackpad: string;
  appTrackpadHint: string;
  trackpadMovement: string;
  keyboardKey: string;
}

export const steamRemapLabels: Record<Language, SteamRemapText> = {
  en: {
    leftTrackpad: "Left trackpad", rightTrackpad: "Right trackpad", click: "Click / Press", touch: "touch", leftGrip: "Left grip", rightGrip: "Right grip",
    trackpadMouse: "Trackpad mouse (trackball)", trackpadScroll: "Trackpad scroll wheel", trackpadSurfaces: "Or use a whole trackpad surface:", chooseInput: "Choose what to map:", controllerInput: "Controller button or stick",
    trackpadTitle: "Steam Controller trackpads",
    trackpadHint: "Unmapped trackpads, pad clicks and triggers work like Steam's Desktop layout: right pad = mouse, left pad = scroll wheel, right pad click / R2 = left click, left pad click / L2 = right click.",
    trackpadSensitivity: "Trackpad mouse sensitivity", trackpadAcceleration: "Trackpad acceleration", trackball: "Trackball inertia", haptics: "Haptic feedback",
    resetTrackpad: "Restore Steam defaults",
    appTrackpadHint: "Choose how each trackpad works outside games, including while Flash Royale is in the background. Game mappings stay separate. Inputs assigned to app navigation take priority.",
    trackpadMovement: "Movement", keyboardKey: "Keyboard key",
  },
  zh: {
    leftTrackpad: "左侧触控板", rightTrackpad: "右侧触控板", click: "点击 / 按压", touch: "触碰", leftGrip: "左侧握把", rightGrip: "右侧握把",
    trackpadMouse: "触控板控制鼠标（轨迹球）", trackpadScroll: "触控板控制滚轮", trackpadSurfaces: "也可以使用一整块触控板表面：", chooseInput: "选择需要映射的内容：", controllerInput: "手柄的按钮或摇杆",
    trackpadTitle: "Steam Controller 的触控板",
    trackpadHint: "没有映射的触控板、触控板按压及扳机遵循 Steam 的桌面布局：右板 = 鼠标，左板 = 滚轮，按下右板 / R2 = 左键单击，按下左板 / L2 = 右键单击。",
    trackpadSensitivity: "触控板的鼠标灵敏度", trackpadAcceleration: "触控板加速", trackball: "轨迹球的惯性", haptics: "触感反馈",
    resetTrackpad: "还原 Steam 默认设置",
    appTrackpadHint: "指定各触控板在游戏之外如何工作，包括 Flash Royale 处于后台时。游戏映射仍然独立。已分配给应用导航的输入享有优先权。",
    trackpadMovement: "移动操作", keyboardKey: "键盘上的按键",
  },
  es: {
    leftTrackpad: "Panel táctil de la izquierda", rightTrackpad: "Panel táctil de la derecha", click: "Clic / pulsar", touch: "contacto", leftGrip: "Agarre izquierdo", rightGrip: "Agarre derecho",
    trackpadMouse: "Ratón por panel táctil (trackball)", trackpadScroll: "Rueda de desplazamiento por panel táctil", trackpadSurfaces: "También puedes usar la superficie completa de un panel táctil:", chooseInput: "Selecciona lo que quieres asignar:", controllerInput: "Botón del mando o stick",
    trackpadTitle: "Paneles táctiles de Steam Controller",
    trackpadHint: "Los paneles táctiles, sus clics y los gatillos que no tengan asignación siguen la distribución de escritorio de Steam: panel derecho = ratón, panel izquierdo = rueda, clic en el panel derecho / R2 = clic izquierdo, clic en el panel izquierdo / L2 = clic derecho.",
    trackpadSensitivity: "Sensibilidad del ratón por panel táctil", trackpadAcceleration: "Aceleración del panel táctil", trackball: "Inercia del trackball", haptics: "Retroalimentación háptica",
    resetTrackpad: "Recuperar los valores predeterminados de Steam",
    appTrackpadHint: "Elige el funcionamiento de cada panel táctil fuera de los juegos, incluso cuando Flash Royale está en segundo plano. Las asignaciones de los juegos se mantienen aparte. Tienen prioridad las entradas asignadas a la navegación de la aplicación.",
    trackpadMovement: "Desplazamiento", keyboardKey: "Tecla de teclado",
  },
  fr: {
    leftTrackpad: "Pavé gauche", rightTrackpad: "Pavé droit", click: "Clic / appui", touch: "contact", leftGrip: "Poignée de gauche", rightGrip: "Poignée de droite",
    trackpadMouse: "Souris au pavé tactile (trackball)", trackpadScroll: "Molette de défilement au pavé tactile", trackpadSurfaces: "Vous pouvez aussi utiliser la surface entière d'un pavé tactile :", chooseInput: "Sélectionnez l'entrée à associer :", controllerInput: "Bouton de manette ou joystick",
    trackpadTitle: "Pavés tactiles Steam Controller",
    trackpadHint: "Les pavés tactiles, leurs clics et les gâchettes sans association suivent la configuration Bureau de Steam : pavé droit = souris, pavé gauche = molette, clic sur le pavé droit / R2 = clic gauche, clic sur le pavé gauche / L2 = clic droit.",
    trackpadSensitivity: "Sensibilité de la souris au pavé tactile", trackpadAcceleration: "Accélération du pavé tactile", trackball: "Inertie du trackball", haptics: "Retour tactile",
    resetTrackpad: "Restaurer les réglages par défaut de Steam",
    appTrackpadHint: "Choisissez le fonctionnement de chaque pavé tactile en dehors des jeux, y compris lorsque Flash Royale est en arrière-plan. Les associations des jeux restent distinctes. Les entrées attribuées à la navigation dans l'application sont prioritaires.",
    trackpadMovement: "Déplacement", keyboardKey: "Touche de clavier",
  },
  de: {
    leftTrackpad: "Trackpad links", rightTrackpad: "Trackpad rechts", click: "Klick / Drücken", touch: "Berühren", leftGrip: "Griff links", rightGrip: "Griff rechts",
    trackpadMouse: "Maus per Trackpad (Trackball)", trackpadScroll: "Scrollrad per Trackpad", trackpadSurfaces: "Alternativ die gesamte Fläche eines Trackpads nutzen:", chooseInput: "Zu belegende Eingabe auswählen:", controllerInput: "Taste oder Stick des Controllers",
    trackpadTitle: "Trackpads des Steam Controller",
    trackpadHint: "Unbelegte Trackpads, Trackpad-Klicks und Trigger folgen dem Desktop-Layout von Steam: rechtes Pad = Maus, linkes Pad = Scrollrad, Klick auf rechtes Pad / R2 = Linksklick, Klick auf linkes Pad / L2 = Rechtsklick.",
    trackpadSensitivity: "Mausempfindlichkeit des Trackpads", trackpadAcceleration: "Beschleunigung des Trackpads", trackball: "Trägheit des Trackballs", haptics: "Haptische Rückmeldung",
    resetTrackpad: "Steam-Standardeinstellungen wiederherstellen",
    appTrackpadHint: "Lege fest, wie jedes Trackpad außerhalb von Spielen funktioniert, auch wenn Flash Royale im Hintergrund läuft. Spielbelegungen bleiben davon getrennt. Eingaben, die der App-Navigation zugeordnet sind, haben Vorrang.",
    trackpadMovement: "Bewegen", keyboardKey: "Taste der Tastatur",
  },
  "pt-BR": {
    leftTrackpad: "Trackpad da esquerda", rightTrackpad: "Trackpad da direita", click: "Clique / pressionar", touch: "contato", leftGrip: "Empunhadura da esquerda", rightGrip: "Empunhadura da direita",
    trackpadMouse: "Mouse pelo trackpad (trackball)", trackpadScroll: "Roda de rolagem pelo trackpad", trackpadSurfaces: "Você também pode usar a superfície completa de um trackpad:", chooseInput: "Selecione o que deseja mapear:", controllerInput: "Botão do controle ou analógico",
    trackpadTitle: "Trackpads de Steam Controller",
    trackpadHint: "Os trackpads, seus cliques e os gatilhos sem mapeamento seguem o layout de área de trabalho do Steam: trackpad direito = mouse, trackpad esquerdo = roda de rolagem, clique no trackpad direito / R2 = clique esquerdo, clique no trackpad esquerdo / L2 = clique direito.",
    trackpadSensitivity: "Sensibilidade do mouse pelo trackpad", trackpadAcceleration: "Aceleração do trackpad", trackball: "Inércia do trackball", haptics: "Retorno háptico",
    resetTrackpad: "Recuperar as configurações padrão do Steam",
    appTrackpadHint: "Escolha como cada trackpad se comporta fora dos jogos, mesmo quando o Flash Royale está em segundo plano. Os mapeamentos dos jogos continuam separados. As entradas atribuídas à navegação do aplicativo têm prioridade.",
    trackpadMovement: "Movimentação", keyboardKey: "Tecla de teclado",
  },
  ja: {
    leftTrackpad: "左側のトラックパッド", rightTrackpad: "右側のトラックパッド", click: "クリック / 押す", touch: "接触", leftGrip: "左側のグリップ", rightGrip: "右側のグリップ",
    trackpadMouse: "トラックパッドでマウス操作（トラックボール）", trackpadScroll: "トラックパッドでホイール操作", trackpadSurfaces: "トラックパッドの表面全体を使うこともできます：", chooseInput: "割り当てたい入力を選んでください：", controllerInput: "コントローラーのボタンやスティック",
    trackpadTitle: "Steam Controller のトラックパッド",
    trackpadHint: "未割り当てのトラックパッド、パッドのクリック、トリガーは Steam のデスクトップレイアウトに従います：右パッド = マウス、左パッド = ホイール、右パッドのクリック / R2 = 左クリック、左パッドのクリック / L2 = 右クリック。",
    trackpadSensitivity: "トラックパッドのマウス感度", trackpadAcceleration: "トラックパッドの加速", trackball: "トラックボールの慣性", haptics: "触覚フィードバック",
    resetTrackpad: "Steam の初期設定を復元",
    appTrackpadHint: "ゲーム以外での各トラックパッドの動作を指定します。Flash Royale がバックグラウンドにある場合も対象です。ゲームの割り当ては別のままです。アプリのナビゲーションに割り当てた入力が優先されます。",
    trackpadMovement: "移動操作", keyboardKey: "キーボードのキー",
  },
  ko: {
    leftTrackpad: "좌측 트랙패드", rightTrackpad: "우측 트랙패드", click: "클릭 / 누르기", touch: "접촉", leftGrip: "좌측 그립", rightGrip: "우측 그립",
    trackpadMouse: "트랙패드로 마우스 조작(트랙볼)", trackpadScroll: "트랙패드로 스크롤 휠 조작", trackpadSurfaces: "트랙패드 표면 전체를 사용할 수도 있습니다:", chooseInput: "매핑할 대상을 고르세요:", controllerInput: "컨트롤러의 버튼이나 스틱",
    trackpadTitle: "Steam Controller의 트랙패드",
    trackpadHint: "매핑이 없는 트랙패드, 패드 클릭, 트리거는 Steam의 데스크톱 레이아웃을 따릅니다: 오른쪽 패드 = 마우스, 왼쪽 패드 = 스크롤 휠, 오른쪽 패드 클릭 / R2 = 왼쪽 클릭, 왼쪽 패드 클릭 / L2 = 오른쪽 클릭.",
    trackpadSensitivity: "트랙패드의 마우스 감도", trackpadAcceleration: "트랙패드의 가속", trackball: "트랙볼의 관성", haptics: "촉각 피드백",
    resetTrackpad: "Steam 초기 설정으로 되돌리기",
    appTrackpadHint: "게임 외부에서 각 트랙패드가 작동할 방식을 지정합니다. Flash Royale이 백그라운드에 있을 때도 적용됩니다. 게임 매핑은 별도로 유지됩니다. 앱 탐색에 할당한 입력이 먼저 처리됩니다.",
    trackpadMovement: "이동 조작", keyboardKey: "키보드의 키",
  },
  hi: {
    leftTrackpad: "बाईं ओर का ट्रैकपैड", rightTrackpad: "दाईं ओर का ट्रैकपैड", click: "क्लिक / दबाएँ", touch: "छूना", leftGrip: "बाईं ग्रिप", rightGrip: "दाईं ग्रिप",
    trackpadMouse: "ट्रैकपैड से माउस (ट्रैकबॉल)", trackpadScroll: "ट्रैकपैड से स्क्रॉल व्हील", trackpadSurfaces: "या ट्रैकपैड की पूरी सतह इस्तेमाल करें:", chooseInput: "चुनें कि किसे मैप करना है:", controllerInput: "कंट्रोलर का बटन या स्टिक",
    trackpadTitle: "Steam Controller के ट्रैकपैड",
    trackpadHint: "बिना मैपिंग वाले ट्रैकपैड, पैड क्लिक और ट्रिगर Steam के डेस्कटॉप लेआउट के अनुसार चलते हैं: दायाँ पैड = माउस, बायाँ पैड = स्क्रॉल व्हील, दाएँ पैड का क्लिक / R2 = बायाँ क्लिक, बाएँ पैड का क्लिक / L2 = दायाँ क्लिक।",
    trackpadSensitivity: "ट्रैकपैड से चलने वाले माउस की संवेदनशीलता", trackpadAcceleration: "ट्रैकपैड का त्वरण", trackball: "ट्रैकबॉल की जड़ता", haptics: "स्पर्श प्रतिक्रिया",
    resetTrackpad: "Steam की मूल सेटिंग वापस लाएँ",
    appTrackpadHint: "तय करें कि गेम के बाहर हर ट्रैकपैड कैसे काम करे, Flash Royale के बैकग्राउंड में होने पर भी। गेम की मैपिंग अलग बनी रहती हैं। ऐप के नेविगेशन को दिए गए इनपुट पहले काम करते हैं।",
    trackpadMovement: "हिलाना", keyboardKey: "कीबोर्ड की कुंजी",
  },
  ar: {
    leftTrackpad: "لوحة لمس يسرى", rightTrackpad: "لوحة لمس يمنى", click: "نقر / ضغط", touch: "ملامسة", leftGrip: "قبضة يسرى", rightGrip: "قبضة يمنى",
    trackpadMouse: "فأرة عبر لوحة اللمس (كرة تتبع)", trackpadScroll: "عجلة تمرير عبر لوحة اللمس", trackpadSurfaces: "أو استعمل سطح لوحة اللمس بأكمله:", chooseInput: "حدّد ما ترغب في تعيينه:", controllerInput: "زر وحدة تحكم أو عصاها",
    trackpadTitle: "لوحتا اللمس في Steam Controller",
    trackpadHint: "تتبع لوحات اللمس ونقراتها والزنادات التي لم تُعيَّن تخطيط سطح المكتب في Steam: اللوحة اليمنى = الفأرة، اللوحة اليسرى = عجلة التمرير، نقر اللوحة اليمنى / R2 = نقرة يسرى، نقر اللوحة اليسرى / L2 = نقرة يمنى.",
    trackpadSensitivity: "حساسية الفأرة عبر لوحة اللمس", trackpadAcceleration: "تسارع لوحة اللمس", trackball: "القصور الذاتي لكرة التتبع", haptics: "رد الفعل اللمسي",
    resetTrackpad: "إرجاع قيم Steam الافتراضية",
    appTrackpadHint: "حدّد طريقة عمل كل لوحة لمس خارج الألعاب، بما يشمل بقاء Flash Royale في الخلفية. تظل تعيينات الألعاب منفصلة. تُعطى الأولوية للإدخالات المخصّصة للتنقل داخل التطبيق.",
    trackpadMovement: "تحريك", keyboardKey: "مفتاح من لوحة المفاتيح",
  },
  ru: {
    leftTrackpad: "Трекпад слева", rightTrackpad: "Трекпад справа", click: "Щелчок / нажатие", touch: "прикосновение", leftGrip: "Рукоятка слева", rightGrip: "Рукоятка справа",
    trackpadMouse: "Управление мышью с трекпада (трекбол)", trackpadScroll: "Колёсико прокрутки с трекпада", trackpadSurfaces: "Можно также использовать поверхность трекпада целиком:", chooseInput: "Укажите, что нужно назначить:", controllerInput: "Кнопка контроллера или стик",
    trackpadTitle: "Трекпады контроллера Steam Controller",
    trackpadHint: "Трекпады, их нажатия и курки без назначений следуют раскладке рабочего стола Steam: правый трекпад = мышь, левый трекпад = колёсико прокрутки, нажатие правого трекпада / R2 = левый щелчок, нажатие левого трекпада / L2 = правый щелчок.",
    trackpadSensitivity: "Чувствительность управления мышью с трекпада", trackpadAcceleration: "Ускорение на трекпаде", trackball: "Инерционность трекбола", haptics: "Тактильный отклик",
    resetTrackpad: "Восстановить стандартные параметры Steam",
    appTrackpadHint: "Выберите поведение каждого трекпада вне игр, в том числе при работе Flash Royale в фоне. Назначения игр остаются отдельными. Приоритет имеют вводы, назначенные для навигации по приложению.",
    trackpadMovement: "Перемещение", keyboardKey: "Кнопка клавиатуры",
  },
};

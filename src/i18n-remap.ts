import type { Language } from "./i18n";
import { steamRemapLabels, type SteamRemapText } from "./i18n-steam";

export type RemapText = BaseRemapText & SteamRemapText;

interface BaseRemapText {
  touchLongPress: string;
  touchLongPressHelp: string;
  open: string;
  title: string;
  player: string;
  controller: string;
  noController: string;
  automatic: string;
  none: string;
  disconnected: string;
  enable: string;
  deadzone: string;
  mouseSpeed: string;
  preset: string;
  presetConflict: string;
  keepExisting: string;
  replaceConflicting: string;
  presetArrows: string;
  presetWasd: string;
  presetMouse: string;
  presetMouseRight: string;
  input: string;
  output: string;
  addMapping: string;
  remove: string;
  clearPlayer: string;
  noMappings: string;
  pressInput: string;
  pressOutput: string;
  anyController: string;
  cancel: string;
  saving: string;
  saved: string;
  saveFailed: string;
  loadFailed: string;
  assignHint: string;
  detectHint: string;
  wakeHint: string;
  pinCursor: string;
  unpinCursor: string;
  controllers: string;
  playerAssignments: string;
  useGlobalAssignments: string;
  controllerName: string;
  controllerNames: string;
  controllerNamesHint: string;
  saveName: string;
  forgetController: string;
  forgetConfirm: string;
  controllersHint: string;
  nativeHint: string;
  nativeInput: string;
  nativeInputHint: string;
  nativeInputSteamInput: string;
  autoAssign: string;
  leftClick: string;
  rightClick: string;
  middleClick: string;
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  wheelUp: string;
  wheelDown: string;
  dpad: string;
  leftStick: string;
  rightStick: string;
  up: string;
  down: string;
  left: string;
  right: string;
  button: string;
  axis: string;
  stickPress: string;
  changeInput: string;
  changeOutput: string;
}

const baseRemapLabels: Record<Language, BaseRemapText> = {
  en: {
    touchLongPress: "Long-press to right click",
    touchLongPressHelp: "Enable only if holding a finger on the game is not needed for gameplay.",
    playerAssignments: "Player assignments",
    nativeInput: "Enable native Steam Controller input",
    nativeInputHint: "Leave off when using Steam Input or an Xbox emulation program. Native mode accesses the physical controller and can interfere with those programs.",
    nativeInputSteamInput: "Unavailable: Steam Input is handling your controllers in Flash Royale. To use native input, disable Steam Input in the Flash Royale entry's controller settings in Steam, then restart Flash Royale.",
    nativeHint: "Native and Xbox entries may represent the same controller. Assign only one entry per physical controller, and set unused players to None.",
    controllerNames: "Controller names",
    controllerNamesHint: "Select a name pill to give your controller a nickname. Names are shared across all games and players.",
    useGlobalAssignments: "Use controller assignments from main Settings", controllerName: "Controller nickname", saveName: "Save name", forgetController: "Forget", forgetConfirm: "Forget {name}? Its nickname is deleted and players assigned to it in Settings go back to Automatic. It shows up again the next time it connects.",
    open: "Controller mapping", title: "Controller mapping", player: "Player", controller: "Controller", noController: "No controller connected",
    automatic: "Automatic (next free controller)", none: "None", disconnected: "disconnected", enable: "Enable mapping for this player",
    deadzone: "Stick dead zone", mouseSpeed: "Virtual mouse speed", preset: "Apply a preset…", presetArrows: "Arrow keys + Space / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "Left stick moves the mouse", presetMouseRight: "Right stick moves the mouse", input: "Controller input", output: "Keyboard / mouse",
    addMapping: "Add mapping", remove: "Remove mapping", clearPlayer: "Clear all mappings", noMappings: "No mappings for this player yet.",
    pressInput: "Press a button or move a stick on the controller…", pressOutput: "Press a keyboard key, or choose a mouse action:",
    anyController: "No controller is currently assigned to this player, so input from any controller is accepted while capturing.",
    cancel: "Cancel", saving: "Saving…", saved: "Saved", saveFailed: "Could not save the mapping", loadFailed: "Could not load the mapping",
    assignHint: "Choose which controller drives each player in Settings › Controllers.",
    pinCursor: "Pin cursor to window", unpinCursor: "Release cursor from window",
    presetConflict: "This preset uses inputs that already have mappings. Keep your existing mappings or replace the conflicting ones?",
    keepExisting: "Keep existing", replaceConflicting: "Replace conflicting mappings",
    wakeHint: "Press any button on this controller to activate it in this window.",
    detectHint: "Press any button on a controller to detect it.", controllers: "Controllers",
    controllersHint: "Choose which detected controller is used by each player.",
    autoAssign: "Assign connected controllers in order", leftClick: "Left click", rightClick: "Right click", middleClick: "Middle click",
    moveUp: "Move mouse up", moveDown: "Move mouse down", moveLeft: "Move mouse left", moveRight: "Move mouse right",
    wheelUp: "Scroll wheel up", wheelDown: "Scroll wheel down", dpad: "D-pad", leftStick: "Left stick", rightStick: "Right stick",
    up: "up", down: "down", left: "left", right: "right", button: "Button", axis: "Axis", stickPress: "press",
    changeInput: "Change controller input", changeOutput: "Change keyboard / mouse output",
  },
  zh: {
    touchLongPress: "长按右键单击",
    touchLongPressHelp: "默认关闭。仅当游玩时不需要将手指持续按在游戏上时才启用。与触控界面设置相互独立。",
    playerAssignments: "玩家分配",
    nativeInput: "开启 Steam Controller 原生输入",
    nativeInputHint: "使用 Steam Input 或 Xbox 模拟程序时应保持关闭。原生模式会访问实体手柄，可能干扰这些程序。",
    nativeInputSteamInput: "????Steam Input ??? Flash Royale ???????????????? Steam ? Flash Royale ??????????? Steam Input??????? Flash Royale?",
    nativeHint: "Native 与 Xbox 条目可能对应同一只手柄。每只实体手柄只分配一个条目，未使用的玩家则设为“无”。",
    controllerNames: "手柄的名称",
    controllerNamesHint: "选择名称标签即可为手柄取昵称。昵称在所有游戏和玩家间共用。",
    useGlobalAssignments: "沿用主设置中的手柄分配", controllerName: "手柄昵称", saveName: "保存名称", forgetController: "忘记", forgetConfirm: "要忘记 {name} 吗？其昵称将被删除，设置中分配给它的玩家将恢复为“自动”。下次连接时，它仍会再次出现。",
    open: "手柄输入映射", title: "手柄输入映射", player: "玩家", controller: "手柄", noController: "没有连接的手柄",
    automatic: "自动（下一只空闲手柄）", none: "无", disconnected: "连接已断开", enable: "启用这位玩家的映射",
    deadzone: "摇杆的死区", mouseSpeed: "虚拟鼠标的速度", preset: "应用预设…", presetArrows: "方向键 + 空格 / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "用左摇杆移动鼠标", presetMouseRight: "用右摇杆移动鼠标", input: "手柄的输入", output: "键盘 / 鼠标",
    addMapping: "新增映射", remove: "移除映射", clearPlayer: "清空全部映射", noMappings: "这位玩家尚未设置映射。",
    pressInput: "按下手柄上的按钮，或移动摇杆…", pressOutput: "按一个键盘按键，或选取鼠标操作：",
    anyController: "目前没有为这位玩家指定手柄，因此捕获输入时会接受任意手柄的输入。",
    cancel: "取消", saving: "保存中…", saved: "已保存", saveFailed: "映射保存失败", loadFailed: "映射加载失败",
    assignHint: "在“设置 › 手柄”中指定各玩家使用的手柄。",
    pinCursor: "将光标限制在窗口内", unpinCursor: "解除窗口内的光标限制",
    presetConflict: "此预设包含已经设置了映射的输入。要保留已有映射，还是替换发生冲突的映射？",
    keepExisting: "保留已有映射", replaceConflicting: "替换冲突映射",
    wakeHint: "按这只手柄的任意按钮，即可在当前窗口启用它。",
    detectHint: "按手柄上的任意按钮即可检测到它。", controllers: "手柄",
    controllersHint: "从检测到的手柄中，选择各玩家要使用的手柄。",
    autoAssign: "依次分配已连接手柄", leftClick: "左键单击", rightClick: "右键单击", middleClick: "中键单击",
    moveUp: "向上移动鼠标", moveDown: "向下移动鼠标", moveLeft: "向左移动鼠标", moveRight: "向右移动鼠标",
    wheelUp: "向上滚动滚轮", wheelDown: "向下滚动滚轮", dpad: "十字方向键", leftStick: "左摇杆", rightStick: "右摇杆",
    up: "上", down: "下", left: "左", right: "右", button: "按钮", axis: "轴", stickPress: "按下",
    changeInput: "更换手柄输入", changeOutput: "更换键盘 / 鼠标输出",
  },
  es: {
    touchLongPress: "Mantener pulsado para hacer clic derecho",
    touchLongPressHelp: "Desactivado de forma predeterminada. Actívalo solo si no necesitas mantener un dedo sobre el juego para jugar. Es independiente de los ajustes de la interfaz táctil.",
    playerAssignments: "Asignaciones de jugadores",
    nativeInput: "Habilitar la entrada nativa de Steam Controller",
    nativeInputHint: "Déjala desactivada cuando uses Steam Input o un programa de emulación de Xbox. El modo nativo accede al mando físico y puede interferir con esos programas.",
    nativeInputSteamInput: "No disponible: Steam Input est? gestionando tus mandos en Flash Royale. Para usar la entrada nativa, desactiva Steam Input en la configuraci?n del mando de la entrada de Flash Royale en Steam y reinicia Flash Royale.",
    nativeHint: "Las entradas Native y Xbox pueden corresponder al mismo mando. Asigna una sola entrada por mando físico y configura como Ninguno a los jugadores que no uses.",
    controllerNames: "Nombres de mandos",
    controllerNamesHint: "Selecciona una etiqueta de nombre para ponerle un apodo al mando. Los nombres se comparten en todos los juegos y entre todos los jugadores.",
    useGlobalAssignments: "Utilizar las asignaciones de mandos de los Ajustes principales", controllerName: "Apodo del mando", saveName: "Guardar nombre", forgetController: "Olvidar", forgetConfirm: "¿Olvidar {name}? Se borrará su apodo y los jugadores que lo tengan asignado en Ajustes volverán a Automático. Aparecerá otra vez cuando se conecte de nuevo.",
    open: "Mapeo del mando", title: "Mapeo del mando", player: "Jugador", controller: "Mando", noController: "No hay mandos conectados",
    automatic: "Automático (próximo mando libre)", none: "Ninguno", disconnected: "sin conexión", enable: "Habilitar el mapeo de este jugador",
    deadzone: "Zona muerta del stick", mouseSpeed: "Velocidad del ratón virtual", preset: "Aplicar un preajuste…", presetArrows: "Teclas de flecha + Espacio / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "Mover el ratón con el stick izquierdo", presetMouseRight: "Mover el ratón con el stick derecho", input: "Entrada del mando", output: "Teclado / ratón",
    addMapping: "Agregar asignación", remove: "Eliminar asignación", clearPlayer: "Vaciar todas las asignaciones", noMappings: "Todavía no hay asignaciones para este jugador.",
    pressInput: "Pulsa un botón del mando o desplaza uno de sus sticks…", pressOutput: "Pulsa una tecla del teclado o selecciona una acción del ratón:",
    anyController: "Este jugador no tiene ningún mando asignado actualmente, por lo que durante la captura se admite la entrada de cualquier mando.",
    cancel: "Cancelar", saving: "Guardando…", saved: "Guardado", saveFailed: "No fue posible guardar la asignación", loadFailed: "No fue posible cargar la asignación",
    assignHint: "En Ajustes › Mandos, selecciona el mando que controlará a cada jugador.",
    pinCursor: "Restringir el cursor a la ventana", unpinCursor: "Quitar la restricción del cursor",
    presetConflict: "Este preajuste utiliza entradas que ya tienen asignaciones. ¿Mantener las asignaciones actuales o sustituir las que entren en conflicto?",
    keepExisting: "Mantener las actuales", replaceConflicting: "Sustituir las asignaciones en conflicto",
    wakeHint: "Pulsa un botón cualquiera de este mando para activarlo en la ventana actual.",
    detectHint: "Pulsa un botón cualquiera de un mando para detectarlo.", controllers: "Mandos",
    controllersHint: "Selecciona cuál de los mandos detectados utilizará cada jugador.",
    autoAssign: "Asignar por orden los mandos conectados", leftClick: "Clic izquierdo", rightClick: "Clic derecho", middleClick: "Clic del botón central",
    moveUp: "Mover el ratón hacia arriba", moveDown: "Mover el ratón hacia abajo", moveLeft: "Mover el ratón hacia la izquierda", moveRight: "Mover el ratón hacia la derecha",
    wheelUp: "Desplazar la rueda hacia arriba", wheelDown: "Desplazar la rueda hacia abajo", dpad: "Cruceta", leftStick: "Stick izquierdo", rightStick: "Stick derecho",
    up: "arriba", down: "abajo", left: "izquierda", right: "derecha", button: "Botón", axis: "Eje", stickPress: "pulsar",
    changeInput: "Modificar la entrada del mando", changeOutput: "Modificar la salida de teclado / ratón",
  },
  fr: {
    touchLongPress: "Appui prolongé pour un clic droit",
    touchLongPressHelp: "Désactivé par défaut. À activer uniquement si jouer ne demande pas de maintenir un doigt sur le jeu. Indépendant des paramètres de l'interface tactile.",
    playerAssignments: "Attributions aux joueurs",
    nativeInput: "Activer l'entrée native du Steam Controller",
    nativeInputHint: "Laissez cette option désactivée avec Steam Input ou un logiciel d'émulation Xbox. Le mode natif accède à la manette physique et peut perturber ces logiciels.",
    nativeInputSteamInput: "Indisponible : Steam Input g?re vos manettes dans Flash Royale. Pour utiliser l'entr?e native, d?sactivez Steam Input dans les param?tres de manette de l'entr?e Flash Royale dans Steam, puis red?marrez Flash Royale.",
    nativeHint: "Les entrées Native et Xbox peuvent correspondre à une seule manette. N'attribuez qu'une entrée par manette physique et réglez les joueurs inutilisés sur Aucune.",
    controllerNames: "Noms de manettes",
    controllerNamesHint: "Sélectionnez une pastille de nom pour donner un surnom à votre manette. Les noms sont communs à tous les jeux et à tous les joueurs.",
    useGlobalAssignments: "Reprendre les attributions de manettes des paramètres principaux", controllerName: "Surnom de la manette", saveName: "Sauvegarder le nom", forgetController: "Oublier", forgetConfirm: "Oublier {name} ? Son surnom sera effacé et les joueurs auxquels elle est attribuée dans les paramètres repasseront sur Automatique. Elle réapparaîtra lors de sa prochaine connexion.",
    open: "Associations de la manette", title: "Associations de la manette", player: "Joueur", controller: "Manette", noController: "Aucune manette n'est connectée",
    automatic: "Automatique (manette libre suivante)", none: "Aucune", disconnected: "déconnectée", enable: "Activer les associations pour ce joueur",
    deadzone: "Zone morte du joystick", mouseSpeed: "Vitesse de la souris virtuelle", preset: "Appliquer un préréglage…", presetArrows: "Touches fléchées + Espace / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "Déplacer la souris au joystick gauche", presetMouseRight: "Déplacer la souris au joystick droit", input: "Entrée de manette", output: "Clavier / souris",
    addMapping: "Ajouter une association", remove: "Retirer l'association", clearPlayer: "Vider toutes les associations", noMappings: "Ce joueur n'a pas encore d'associations.",
    pressInput: "Appuyez sur un bouton de la manette ou déplacez un joystick…", pressOutput: "Appuyez sur une touche de clavier ou sélectionnez une action de souris :",
    anyController: "Aucune manette n'est actuellement attribuée à ce joueur, pendant la capture, les entrées de toutes les manettes sont donc acceptées.",
    cancel: "Annuler", saving: "Sauvegarde…", saved: "Sauvegardé", saveFailed: "Impossible de sauvegarder l'association", loadFailed: "Impossible de charger l'association",
    assignHint: "Dans Paramètres › Manettes, choisissez la manette qui contrôle chaque joueur.",
    pinCursor: "Confiner le curseur à la fenêtre", unpinCursor: "Libérer le curseur de la fenêtre",
    presetConflict: "Ce préréglage emploie des entrées déjà associées. Garder les associations actuelles ou remplacer celles qui entrent en conflit ?",
    keepExisting: "Garder les associations actuelles", replaceConflicting: "Remplacer les associations en conflit",
    wakeHint: "Appuyez sur n'importe quel bouton de cette manette pour l'activer dans cette fenêtre.",
    detectHint: "Appuyez sur n'importe quel bouton d'une manette pour la détecter.", controllers: "Manettes",
    controllersHint: "Choisissez, parmi les manettes détectées, celle que chaque joueur utilise.",
    autoAssign: "Attribuer les manettes connectées dans l'ordre", leftClick: "Clic gauche", rightClick: "Clic droit", middleClick: "Clic central",
    moveUp: "Déplacer la souris vers le haut", moveDown: "Déplacer la souris vers le bas", moveLeft: "Déplacer la souris vers la gauche", moveRight: "Déplacer la souris vers la droite",
    wheelUp: "Faire rouler la molette vers le haut", wheelDown: "Faire rouler la molette vers le bas", dpad: "Croix directionnelle", leftStick: "Joystick gauche", rightStick: "Joystick droit",
    up: "haut", down: "bas", left: "gauche", right: "droite", button: "Bouton", axis: "Axe", stickPress: "appui",
    changeInput: "Modifier l'entrée de manette", changeOutput: "Modifier la sortie clavier / souris",
  },
  de: {
    touchLongPress: "Durch langes Drücken rechtsklicken",
    touchLongPressHelp: "Standardmäßig ausgeschaltet. Nur einschalten, wenn für das Spielen kein Finger auf dem Spiel gehalten werden muss. Unabhängig von den Einstellungen der Touch-Oberfläche.",
    playerAssignments: "Zuweisungen zu Spielern",
    nativeInput: "Native Eingabe des Steam Controller einschalten",
    nativeInputHint: "Bei Nutzung von Steam Input oder einem Xbox-Emulationsprogramm ausgeschaltet lassen. Der native Modus greift auf den physischen Controller zu und kann diese Programme beeinträchtigen.",
    nativeInputSteamInput: "Nicht verf?gbar: Steam Input verwaltet deine Controller in Flash Royale. Um die native Eingabe zu nutzen, deaktiviere Steam Input in den Controller-Einstellungen des Flash-Royale-Eintrags in Steam und starte Flash Royale neu.",
    nativeHint: "Native- und Xbox-Einträge können für denselben Controller stehen. Weise pro physischem Controller nur einen Eintrag zu und stelle ungenutzte Spieler auf Keiner.",
    controllerNames: "Namen der Controller",
    controllerNamesHint: "Wähle eine Namensplakette, um dem Controller einen Spitznamen zu geben. Die Namen werden in allen Spielen und für alle Spieler gemeinsam genutzt.",
    useGlobalAssignments: "Controller-Zuweisungen aus den allgemeinen Einstellungen übernehmen", controllerName: "Spitzname des Controllers", saveName: "Namen sichern", forgetController: "Vergessen", forgetConfirm: "{name} vergessen? Sein Spitzname wird gelöscht und Spieler, denen er in den Einstellungen zugewiesen ist, wechseln zurück zu Automatisch. Bei der nächsten Verbindung wird er wieder angezeigt.",
    open: "Controller-Zuordnung", title: "Controller-Zuordnung", player: "Spieler", controller: "Controller", noController: "Es ist kein Controller verbunden",
    automatic: "Automatisch (nächster ungenutzter Controller)", none: "Keiner", disconnected: "Verbindung getrennt", enable: "Belegungen für diesen Spieler einschalten",
    deadzone: "Totzone des Sticks", mouseSpeed: "Tempo der virtuellen Maus", preset: "Eine Vorlage anwenden…", presetArrows: "Pfeiltasten + Leertaste / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "Maus mit linkem Stick bewegen", presetMouseRight: "Maus mit rechtem Stick bewegen", input: "Eingabe des Controllers", output: "Tastatur / Maus",
    addMapping: "Neue Belegung", remove: "Belegung löschen", clearPlayer: "Sämtliche Belegungen leeren", noMappings: "Dieser Spieler hat noch keine Belegungen.",
    pressInput: "Drücke am Controller eine Taste oder bewege einen Stick…", pressOutput: "Drücke eine Taste auf der Tastatur oder wähle eine Mausaktion:",
    anyController: "Aktuell ist diesem Spieler kein Controller zugewiesen. Deshalb wird beim Erfassen die Eingabe jedes Controllers angenommen.",
    cancel: "Abbrechen", saving: "Speichern…", saved: "Gesichert", saveFailed: "Speichern der Belegung fehlgeschlagen", loadFailed: "Laden der Belegung fehlgeschlagen",
    assignHint: "Lege unter Einstellungen › Controller fest, welcher Controller den jeweiligen Spieler steuert.",
    pinCursor: "Cursor auf das Fenster beschränken", unpinCursor: "Cursor aus dem Fenster lösen",
    presetConflict: "Diese Vorlage nutzt Eingaben mit vorhandenen Belegungen. Möchtest du deine bisherigen Belegungen behalten oder die widersprüchlichen ersetzen?",
    keepExisting: "Bisherige behalten", replaceConflicting: "Widersprüchliche Belegungen ersetzen",
    wakeHint: "Drücke eine beliebige Taste dieses Controllers, um ihn in diesem Fenster zu aktivieren.",
    detectHint: "Drücke eine beliebige Taste eines Controllers, damit er erkannt wird.", controllers: "Controller",
    controllersHint: "Lege fest, welchen der erkannten Controller jeder Spieler nutzt.",
    autoAssign: "Angeschlossene Controller der Reihe nach zuweisen", leftClick: "Linksklick", rightClick: "Rechtsklick", middleClick: "Klick mit mittlerer Taste",
    moveUp: "Maus aufwärts bewegen", moveDown: "Maus abwärts bewegen", moveLeft: "Maus nach links bewegen", moveRight: "Maus nach rechts bewegen",
    wheelUp: "Mausrad aufwärts drehen", wheelDown: "Mausrad abwärts drehen", dpad: "Steuerkreuz", leftStick: "Linker Stick", rightStick: "Rechter Stick",
    up: "oben", down: "unten", left: "links", right: "rechts", button: "Taste", axis: "Achse", stickPress: "drücken",
    changeInput: "Controller-Eingabe wechseln", changeOutput: "Ausgabe für Tastatur / Maus wechseln",
  },
  "pt-BR": {
    touchLongPress: "Manter pressionado para clicar com o botão direito",
    touchLongPressHelp: "Desligado por padrão. Ative somente se não for necessário manter um dedo sobre o jogo para jogar. É independente das configurações da interface de toque.",
    playerAssignments: "Atribuições de jogadores",
    nativeInput: "Habilitar entrada nativa de Steam Controller",
    nativeInputHint: "Deixe desligada ao usar Steam Input ou um programa de emulação de Xbox. O modo nativo acessa o controle físico e pode atrapalhar esses programas.",
    nativeInputSteamInput: "Indispon?vel: o Steam Input est? controlando seus controles no Flash Royale. Para usar a entrada nativa, desative o Steam Input nas configura??es de controle da entrada do Flash Royale no Steam e reinicie o Flash Royale.",
    nativeHint: "As entradas Native e Xbox podem corresponder ao mesmo controle. Atribua somente uma entrada por controle físico e defina os jogadores não utilizados como Nenhum.",
    controllerNames: "Nomes de controles",
    controllerNamesHint: "Escolha uma etiqueta de nome para dar um apelido ao controle. Os nomes são comuns a todos os jogos e jogadores.",
    useGlobalAssignments: "Utilizar as atribuições de controles das Configurações principais", controllerName: "Apelido do controle", saveName: "Guardar nome", forgetController: "Esquecer", forgetConfirm: "Esquecer {name}? O apelido será apagado e os jogadores atribuídos a ele nas Configurações voltarão para Automático. Ele reaparecerá quando se conectar novamente.",
    open: "Mapeamento de controle", title: "Mapeamento de controle", player: "Jogador", controller: "Controle", noController: "Não há controles conectados",
    automatic: "Automático (próximo controle disponível)", none: "Nenhum", disconnected: "sem conexão", enable: "Habilitar mapeamento para este jogador",
    deadzone: "Zona morta do analógico", mouseSpeed: "Velocidade do mouse virtual", preset: "Aplicar uma predefinição…", presetArrows: "Teclas de seta + Espaço / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "Mover o mouse com o analógico esquerdo", presetMouseRight: "Mover o mouse com o analógico direito", input: "Entrada do controle", output: "Teclado / mouse",
    addMapping: "Acrescentar mapeamento", remove: "Excluir mapeamento", clearPlayer: "Apagar todos os mapeamentos", noMappings: "Ainda não há mapeamentos para este jogador.",
    pressInput: "Aperte um botão do controle ou mova um dos analógicos…", pressOutput: "Aperte uma tecla do teclado ou selecione uma ação do mouse:",
    anyController: "Não há controle atribuído a este jogador no momento. Por isso, a captura aceita entradas de qualquer controle.",
    cancel: "Cancelar", saving: "Salvando…", saved: "Salvo", saveFailed: "Falha ao salvar o mapeamento", loadFailed: "Falha ao carregar o mapeamento",
    assignHint: "Em Configurações › Controles, selecione qual controle comandará cada jogador.",
    pinCursor: "Restringir o cursor à janela", unpinCursor: "Retirar a restrição do cursor",
    presetConflict: "Esta predefinição utiliza entradas que já têm mapeamentos. Deseja manter os mapeamentos atuais ou trocar os que entram em conflito?",
    keepExisting: "Manter os atuais", replaceConflicting: "Trocar mapeamentos em conflito",
    wakeHint: "Aperte qualquer botão deste controle para ativá-lo na janela atual.",
    detectHint: "Aperte qualquer botão de um controle para detectá-lo.", controllers: "Controles",
    controllersHint: "Selecione qual dos controles detectados cada jogador utilizará.",
    autoAssign: "Atribuir em ordem os controles conectados", leftClick: "Clique esquerdo", rightClick: "Clique direito", middleClick: "Clique do botão central",
    moveUp: "Mover o mouse para cima", moveDown: "Mover o mouse para baixo", moveLeft: "Mover o mouse para a esquerda", moveRight: "Mover o mouse para a direita",
    wheelUp: "Girar a roda para cima", wheelDown: "Girar a roda para baixo", dpad: "Direcional", leftStick: "Analógico esquerdo", rightStick: "Analógico direito",
    up: "cima", down: "baixo", left: "esquerda", right: "direita", button: "Botão", axis: "Eixo", stickPress: "pressionar",
    changeInput: "Modificar a entrada do controle", changeOutput: "Modificar a saída de teclado / mouse",
  },
  ja: {
    touchLongPress: "長押しで右クリックする",
    touchLongPressHelp: "初期状態ではオフです。ゲームを遊ぶ際に指を押し続ける必要がない場合だけ有効にしてください。タッチ用インターフェースの設定とは独立しています。",
    playerAssignments: "プレイヤーへの割り当て",
    nativeInput: "Steam Controller のネイティブ入力を有効化",
    nativeInputHint: "Steam Input や Xbox エミュレーションソフトを使う場合は、オフのままにしてください。ネイティブモードは実物のコントローラーにアクセスするため、それらのソフトに干渉する場合があります。",
    nativeInputSteamInput: "????????Steam Input ? Flash Royale ??????????????????????????????Steam ? Flash Royale ????????????? Steam Input ??????Flash Royale ???????????",
    nativeHint: "Native と Xbox の項目が同じコントローラーを表す場合があります。実物のコントローラーごとに割り当てる項目は 1 つだけにし、使わないプレイヤーは「なし」にしてください。",
    controllerNames: "コントローラー名",
    controllerNamesHint: "名前のバッジを選ぶと、コントローラーにニックネームを付けられます。名前はすべてのゲームとプレイヤーで共通です。",
    useGlobalAssignments: "メインの設定からコントローラー割り当てを使用", controllerName: "コントローラーのニックネーム", saveName: "名前を保存", forgetController: "登録を忘れる", forgetConfirm: "{name} の登録を忘れますか？ニックネームが削除され、設定でこのコントローラーを割り当てたプレイヤーは「自動」に戻ります。次に接続すると再び表示されます。",
    open: "コントローラーの割り当て", title: "コントローラーの割り当て", player: "プレイヤー", controller: "コントローラー", noController: "接続中のコントローラーがありません",
    automatic: "自動（次の未使用コントローラー）", none: "なし", disconnected: "接続解除済み", enable: "このプレイヤーの割り当てを有効化",
    deadzone: "スティックの無反応範囲", mouseSpeed: "仮想マウスの移動速度", preset: "プリセットを適用…", presetArrows: "矢印キー + Space / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "左スティックでマウスを動かす", presetMouseRight: "右スティックでマウスを動かす", input: "コントローラーからの入力", output: "キーボード / マウス",
    addMapping: "新しい割り当てを追加", remove: "割り当てを取り除く", clearPlayer: "すべての割り当てを消す", noMappings: "このプレイヤーには割り当てがまだありません。",
    pressInput: "コントローラーのボタンを押すか、スティックを動かしてください…", pressOutput: "キーボードのキーを押すか、マウスの操作を選んでください：",
    anyController: "現在このプレイヤーにコントローラーは割り当てられていません。そのため、入力の取得中はどのコントローラーからの入力も受け付けます。",
    cancel: "キャンセル", saving: "保存しています…", saved: "保存済み", saveFailed: "割り当ての保存に失敗しました", loadFailed: "割り当ての読み込みに失敗しました",
    assignHint: "「設定 › コントローラー」で、各プレイヤーを操作するコントローラーを指定してください。",
    pinCursor: "カーソルをウィンドウ内に制限", unpinCursor: "カーソルのウィンドウ制限を解除",
    presetConflict: "このプリセットはすでに割り当てのある入力を使っています。現在の割り当てを残しますか、それとも競合するものを置き換えますか？",
    keepExisting: "現在の割り当てを残す", replaceConflicting: "競合する割り当てを変更",
    wakeHint: "このコントローラーのいずれかのボタンを押すと、このウィンドウで有効になります。",
    detectHint: "コントローラーのいずれかのボタンを押して検出してください。", controllers: "コントローラー",
    controllersHint: "検出済みのコントローラーから、各プレイヤーが使うものを選びます。",
    autoAssign: "接続中のコントローラーを順に割り当て", leftClick: "左クリック", rightClick: "右クリック", middleClick: "中央クリック",
    moveUp: "マウスを上に移動", moveDown: "マウスを下に移動", moveLeft: "マウスを左に移動", moveRight: "マウスを右に移動",
    wheelUp: "ホイールを上にスクロール", wheelDown: "ホイールを下にスクロール", dpad: "十字キー", leftStick: "左スティック", rightStick: "右スティック",
    up: "上", down: "下", left: "左", right: "右", button: "ボタン", axis: "軸", stickPress: "押す",
    changeInput: "コントローラー入力を変更", changeOutput: "キーボード / マウスの出力を変更",
  },
  ko: {
    touchLongPress: "길게 눌러 우클릭하기",
    touchLongPressHelp: "초기 설정에서는 꺼져 있습니다. 게임을 할 때 손가락을 계속 대고 있을 필요가 없는 경우에만 켜세요. 터치용 인터페이스 설정과는 독립적입니다.",
    playerAssignments: "플레이어별 할당",
    nativeInput: "Steam Controller의 네이티브 입력 켜기",
    nativeInputHint: "Steam Input이나 Xbox 에뮬레이션 프로그램을 사용할 때는 꺼 두세요. 네이티브 모드는 실제 컨트롤러에 접근하므로 해당 프로그램과 충돌할 수 있습니다.",
    nativeInputSteamInput: "??? ? ??: Steam Input? Flash Royale? ????? ???? ????. ???? ??? ????? Steam?? Flash Royale ??? ???? ???? Steam Input? ?? Flash Royale? ?? ?????.",
    nativeHint: "Native 및 Xbox 항목이 하나의 컨트롤러를 가리킬 수 있습니다. 실제 컨트롤러 하나당 항목 하나만 할당하고 사용하지 않는 플레이어는 없음으로 지정하세요.",
    controllerNames: "컨트롤러의 이름",
    controllerNamesHint: "이름 배지를 고르면 컨트롤러에 별명을 붙일 수 있습니다. 이름은 모든 게임 및 플레이어가 공통으로 사용합니다.",
    useGlobalAssignments: "기본 설정에 지정된 컨트롤러 할당 이용", controllerName: "컨트롤러 별명", saveName: "이름 보관", forgetController: "기억 지우기", forgetConfirm: "{name}의 기억을 지울까요? 별명이 삭제되고 설정에서 이 컨트롤러가 할당된 플레이어는 자동으로 되돌아갑니다. 다음에 연결하면 다시 나타납니다.",
    open: "컨트롤러 입력 매핑", title: "컨트롤러 입력 매핑", player: "플레이어", controller: "컨트롤러", noController: "연결 중인 컨트롤러가 없습니다",
    automatic: "자동(다음 미사용 컨트롤러)", none: "없음", disconnected: "접속 끊김", enable: "이 플레이어의 매핑 켜기",
    deadzone: "스틱의 데드존", mouseSpeed: "가상 마우스의 이동 속도", preset: "프리셋 적용…", presetArrows: "화살표 키 + Space / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "왼쪽 스틱으로 마우스 움직이기", presetMouseRight: "오른쪽 스틱으로 마우스 움직이기", input: "컨트롤러에서의 입력", output: "키보드 / 마우스",
    addMapping: "새 매핑 추가", remove: "매핑 제거", clearPlayer: "매핑 전부 비우기", noMappings: "이 플레이어에 지정한 매핑이 아직 없습니다.",
    pressInput: "컨트롤러의 버튼을 누르거나 스틱을 움직여 주세요…", pressOutput: "키보드의 키를 누르거나 마우스 동작을 골라 주세요:",
    anyController: "현재 이 플레이어에 지정된 컨트롤러가 없습니다. 따라서 입력을 수집하는 동안에는 모든 컨트롤러의 입력이 허용됩니다.",
    cancel: "취소", saving: "저장하는 중…", saved: "저장 완료", saveFailed: "매핑 저장에 실패했습니다", loadFailed: "매핑 읽기에 실패했습니다",
    assignHint: "설정 › 컨트롤러에서 각 플레이어를 조작할 컨트롤러를 지정하세요.",
    pinCursor: "커서를 창 내부로 제한", unpinCursor: "커서의 창 제한 풀기",
    presetConflict: "이 프리셋은 매핑이 이미 있는 입력을 이용합니다. 현재 매핑을 남겨 둘까요, 아니면 충돌하는 항목을 대체할까요?",
    keepExisting: "현재 매핑 남기기", replaceConflicting: "충돌 매핑 대체",
    wakeHint: "이 컨트롤러의 버튼을 아무거나 누르면 현재 창에서 활성화됩니다.",
    detectHint: "컨트롤러의 버튼을 아무거나 눌러 감지하세요.", controllers: "컨트롤러",
    controllersHint: "감지한 컨트롤러 중 각 플레이어가 쓸 것을 고르세요.",
    autoAssign: "연결한 컨트롤러를 차례로 할당", leftClick: "왼쪽 클릭", rightClick: "오른쪽 클릭", middleClick: "가운데 클릭",
    moveUp: "마우스를 위로 이동", moveDown: "마우스를 아래로 이동", moveLeft: "마우스를 왼쪽으로 이동", moveRight: "마우스를 오른쪽으로 이동",
    wheelUp: "휠을 위로 스크롤", wheelDown: "휠을 아래로 스크롤", dpad: "방향 패드", leftStick: "왼쪽 스틱", rightStick: "오른쪽 스틱",
    up: "위", down: "아래", left: "왼쪽", right: "오른쪽", button: "버튼", axis: "축", stickPress: "누름",
    changeInput: "컨트롤러 입력 바꾸기", changeOutput: "키보드 / 마우스 출력 바꾸기",
  },
  hi: {
    touchLongPress: "लंबे समय तक दबाने से राइट-क्लिक करें",
    touchLongPressHelp: "शुरू में बंद रहता है। केवल तभी चालू करें जब खेलने के लिए गेम पर उँगली रखे रहना ज़रूरी न हो। यह टच इंटरफ़ेस की सेटिंग से अलग है।",
    playerAssignments: "खिलाड़ियों को आवंटन",
    nativeInput: "Steam Controller का नेटिव इनपुट सक्षम करें",
    nativeInputHint: "Steam Input या Xbox का एमुलेशन करने वाला प्रोग्राम चलाते समय इसे बंद रखें। नेटिव मोड वास्तविक कंट्रोलर तक पहुँचता है और उन प्रोग्रामों के काम में बाधा डाल सकता है।",
    nativeInputSteamInput: "?????? ????: Flash Royale ??? ???? ???????? Steam Input ????? ??? ??? ????? ????? ???????? ???? ?? ??? Steam ??? Flash Royale ????????? ?? ???????? ???????? ??? Steam Input ??? ????, ??? Flash Royale ?????? ???? ?????",
    nativeHint: "Native और Xbox की प्रविष्टियाँ एक ही कंट्रोलर की हो सकती हैं। हर वास्तविक कंट्रोलर की केवल एक प्रविष्टि आवंटित करें और जिन खिलाड़ियों का उपयोग नहीं हो रहा उन्हें कोई नहीं पर रखें।",
    controllerNames: "कंट्रोलरों के नाम",
    controllerNamesHint: "अपने कंट्रोलर को उपनाम देने के लिए नाम का बैज चुनें। नाम सभी गेम और खिलाड़ियों में साझा रहते हैं।",
    useGlobalAssignments: "मुख्य सेटिंग के कंट्रोलर आवंटन इस्तेमाल करें", controllerName: "कंट्रोलर का उपनाम", saveName: "नाम सुरक्षित करें", forgetController: "भूल जाएँ", forgetConfirm: "क्या {name} को भूलना है? इसका उपनाम मिट जाएगा और सेटिंग में इसे आवंटित किए गए खिलाड़ी फिर स्वचालित पर आ जाएँगे। अगली बार जुड़ने पर यह दोबारा दिखेगा।",
    open: "कंट्रोलर के इनपुट की मैपिंग", title: "कंट्रोलर के इनपुट की मैपिंग", player: "खिलाड़ी", controller: "कंट्रोलर", noController: "कोई कंट्रोलर जुड़ा हुआ नहीं है",
    automatic: "स्वचालित (अगला उपलब्ध कंट्रोलर)", none: "कोई नहीं", disconnected: "कनेक्शन टूटा", enable: "इस खिलाड़ी की मैपिंग सक्षम करें",
    deadzone: "स्टिक का डेड ज़ोन", mouseSpeed: "वर्चुअल माउस की गति", preset: "कोई प्रीसेट लागू करें…", presetArrows: "तीर वाली कुंजियाँ + Space / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "बाएँ स्टिक से माउस चलाएँ", presetMouseRight: "दाएँ स्टिक से माउस चलाएँ", input: "कंट्रोलर का इनपुट", output: "कीबोर्ड / माउस",
    addMapping: "नई मैपिंग जोड़ें", remove: "यह मैपिंग हटाएँ", clearPlayer: "पूरी मैपिंग साफ़ करें", noMappings: "इस खिलाड़ी की कोई मैपिंग अभी तक नहीं है।",
    pressInput: "कंट्रोलर पर बटन दबाएँ या उसका स्टिक हिलाएँ…", pressOutput: "कीबोर्ड पर कुंजी दबाएँ या माउस की क्रिया चुनें:",
    anyController: "अभी इस खिलाड़ी को कोई कंट्रोलर नहीं दिया गया है, इसलिए इनपुट कैप्चर करते समय किसी भी कंट्रोलर का इनपुट लिया जाएगा।",
    cancel: "रद्द करें", saving: "सुरक्षित हो रहा है…", saved: "सुरक्षित हुआ", saveFailed: "मैपिंग को सहेजना संभव नहीं हुआ", loadFailed: "मैपिंग को लोड करना संभव नहीं हुआ",
    assignHint: "सेटिंग › कंट्रोलर में तय करें कि हर खिलाड़ी को कौन-सा कंट्रोलर चलाएगा।",
    pinCursor: "कर्सर को विंडो तक सीमित करें", unpinCursor: "कर्सर की विंडो सीमा हटाएँ",
    presetConflict: "यह प्रीसेट ऐसे इनपुट इस्तेमाल करता है जिनकी मैपिंग पहले से है। वर्तमान मैपिंग रखनी है या टकराव वाली मैपिंग बदलनी है?",
    keepExisting: "वर्तमान मैपिंग रखें", replaceConflicting: "टकराव वाली मैपिंग बदलें",
    wakeHint: "इस विंडो में सक्रिय करने के लिए इस कंट्रोलर का कोई बटन दबाएँ।",
    detectHint: "कंट्रोलर की पहचान के लिए उसका कोई बटन दबाएँ।", controllers: "कंट्रोलर",
    controllersHint: "पहचाने गए कंट्रोलरों में से हर खिलाड़ी के इस्तेमाल वाला कंट्रोलर चुनें।",
    autoAssign: "जुड़े कंट्रोलरों को क्रमवार आवंटित करें", leftClick: "बायाँ क्लिक", rightClick: "दायाँ क्लिक", middleClick: "मध्य बटन का क्लिक",
    moveUp: "माउस को ऊपर ले जाएँ", moveDown: "माउस को नीचे ले जाएँ", moveLeft: "माउस को बाएँ ले जाएँ", moveRight: "माउस को दाएँ ले जाएँ",
    wheelUp: "व्हील ऊपर स्क्रॉल करें", wheelDown: "व्हील नीचे स्क्रॉल करें", dpad: "डी-पैड", leftStick: "बायाँ स्टिक", rightStick: "दायाँ स्टिक",
    up: "ऊपर", down: "नीचे", left: "बाएँ", right: "दाएँ", button: "बटन", axis: "अक्ष", stickPress: "दबाएँ",
    changeInput: "कंट्रोलर का इनपुट बदलें", changeOutput: "कीबोर्ड / माउस का आउटपुट बदलें",
  },
  ar: {
    touchLongPress: "اضغط مطوّلًا للنقر بالزر الأيمن",
    touchLongPressHelp: "متوقف افتراضيًا. لا تفعّله إلا إذا لم يكن إبقاء الإصبع على اللعبة ضروريًا للعب. مستقل عن خيارات واجهة اللمس.",
    playerAssignments: "التعيينات للاعبين",
    nativeInput: "تشغيل الإدخال الأصلي لوحدة Steam Controller",
    nativeInputHint: "أبقِه متوقفًا عند استخدام Steam Input أو برنامج لمحاكاة Xbox. يصل الوضع الأصلي إلى وحدة التحكم الفعلية وقد يعرقل عمل هذه البرامج.",
    nativeInputSteamInput: "??? ????: ????? Steam Input ????? ?????? ?? Flash Royale. ???????? ??????? ??????? ???? Steam Input ?? ??????? ???? ?????? ????? Flash Royale ?? Steam? ?? ??? ????? Flash Royale.",
    nativeHint: "قد يمثّل الإدخالان Native وXbox وحدة التحكم نفسها. خصّص إدخالًا واحدًا فقط لكل وحدة فعلية، واضبط اللاعبين غير المستخدمين على لا شيء.",
    controllerNames: "أسماء لوحدات التحكم",
    controllerNamesHint: "حدّد شارة اسم لتمنح وحدة التحكم لقبًا. تُشارك الأسماء بين جميع الألعاب واللاعبين.",
    useGlobalAssignments: "استعمال تعيينات وحدات التحكم من الإعدادات الرئيسية", controllerName: "لقب وحدة التحكم", saveName: "تخزين الاسم", forgetController: "نسيان", forgetConfirm: "هل تريد نسيان {name}؟ سيُحذف لقبها ويعود اللاعبون الذين عُيّنت لهم في الإعدادات إلى الخيار التلقائي. ستظهر من جديد عند اتصالها في المرة القادمة.",
    open: "ربط مدخلات وحدة التحكم", title: "ربط مدخلات وحدة التحكم", player: "اللاعب", controller: "وحدة التحكم", noController: "لم تتصل أي وحدة تحكم",
    automatic: "تلقائي (وحدة التحكم المتاحة التالية)", none: "لا شيء", disconnected: "انقطع الاتصال", enable: "تشغيل التعيينات لهذا اللاعب",
    deadzone: "المنطقة الميتة للعصا", mouseSpeed: "سرعة الفأرة الافتراضية", preset: "طبّق إعدادًا مسبقًا…", presetArrows: "مفاتيح الأسهم + Space / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "تحريك الفأرة بالعصا اليسرى", presetMouseRight: "تحريك الفأرة بالعصا اليمنى", input: "مدخل وحدة التحكم", output: "لوحة المفاتيح / الفأرة",
    addMapping: "تعيين جديد", remove: "حذف التعيين", clearPlayer: "إفراغ جميع التعيينات", noMappings: "لم تُضبط تعيينات لهذا اللاعب حتى الآن.",
    pressInput: "اضغط زرًا على وحدة التحكم أو حرّك عصاها…", pressOutput: "اضغط مفتاحًا على لوحة المفاتيح أو حدّد إجراءً للفأرة:",
    anyController: "لا توجد وحدة تحكم معيّنة لهذا اللاعب حاليًا، لذلك يُسمح بمدخلات أي وحدة تحكم أثناء الالتقاط.",
    cancel: "إلغاء", saving: "يُحفظ الآن…", saved: "محفوظ", saveFailed: "لم ينجح حفظ التعيين", loadFailed: "لم ينجح تحميل التعيين",
    assignHint: "حدّد وحدة التحكم التي تقود كل لاعب ضمن الإعدادات › وحدات التحكم.",
    pinCursor: "حصر المؤشر داخل النافذة", unpinCursor: "إلغاء حصر المؤشر في النافذة",
    presetConflict: "يتضمن هذا الإعداد المسبق مدخلات لها تعيينات بالفعل. هل تريد إبقاء تعييناتك الحالية أم تغيير المتعارض منها؟",
    keepExisting: "إبقاء الحالية", replaceConflicting: "تغيير التعيينات المتعارضة",
    wakeHint: "اضغط أي زر على وحدة التحكم هذه لتنشيطها في النافذة الحالية.",
    detectHint: "اضغط أي زر على وحدة تحكم للكشف عنها.", controllers: "وحدات التحكم",
    controllersHint: "حدّد أي وحدة تحكم مكتشفة سيستخدمها كل لاعب.",
    autoAssign: "تخصيص وحدات التحكم المتصلة بالتتابع", leftClick: "نقرة بالزر الأيسر", rightClick: "نقرة بالزر الأيمن", middleClick: "نقرة بالزر الأوسط",
    moveUp: "تحريك الفأرة إلى أعلى", moveDown: "تحريك الفأرة إلى أسفل", moveLeft: "تحريك الفأرة إلى اليسار", moveRight: "تحريك الفأرة إلى اليمين",
    wheelUp: "تدوير العجلة لأعلى", wheelDown: "تدوير العجلة لأسفل", dpad: "لوحة الاتجاهات", leftStick: "العصا اليسرى", rightStick: "العصا اليمنى",
    up: "أعلى", down: "أسفل", left: "يسار", right: "يمين", button: "زر", axis: "محور", stickPress: "ضغط",
    changeInput: "تعديل مدخل وحدة التحكم", changeOutput: "تعديل مخرج لوحة المفاتيح / الفأرة",
  },
  ru: {
    touchLongPress: "Долгое касание выполняет правый щелчок",
    touchLongPressHelp: "Изначально выключено. Включайте лишь в том случае, если для игры не требуется удерживать палец на ней. Не связано с параметрами сенсорного интерфейса.",
    playerAssignments: "Распределение по игрокам",
    nativeInput: "Включить нативный ввод контроллера Steam Controller",
    nativeInputHint: "Оставьте выключенным при работе со Steam Input или программой эмуляции Xbox. Нативный режим обращается к физическому контроллеру и может помешать этим программам.",
    nativeInputSteamInput: "??????????: Steam Input ????????? ?????? ????????????? ?? Flash Royale. ????? ???????????? ???????? ????, ????????? Steam Input ? ?????????? ??????????? ??? ?????? Flash Royale ? Steam ? ????????????? Flash Royale.",
    nativeHint: "Записи Native и Xbox могут относиться к одному контроллеру. Для каждого физического контроллера назначайте только одну запись, а неиспользуемым игрокам задайте «Нет».",
    controllerNames: "Названия контроллеров",
    controllerNamesHint: "Выберите плашку с именем, чтобы дать контроллеру прозвище. Имена общие для всех игр и игроков.",
    useGlobalAssignments: "Взять назначения контроллеров из основных Настроек", controllerName: "Прозвище контроллера", saveName: "Запомнить имя", forgetController: "Забыть", forgetConfirm: "Забыть {name}? Его прозвище будет удалено, а игроки, которым он назначен в Настройках, вернутся к варианту «Автоматически». При следующем подключении он появится снова.",
    open: "Назначения контроллера", title: "Назначения контроллера", player: "Игрок", controller: "Контроллер", noController: "Нет подключённых контроллеров",
    automatic: "Автоматически (ближайший свободный контроллер)", none: "Нет", disconnected: "соединение разорвано", enable: "Включить назначения этому игроку",
    deadzone: "Мёртвая зона джойстика", mouseSpeed: "Скорость виртуального указателя мыши", preset: "Применить профиль…", presetArrows: "Клавиши со стрелками + Пробел / Z / X / C",
    presetWasd: "WASD + J / K / L", presetMouse: "Двигать мышь левым стиком", presetMouseRight: "Двигать мышь правым стиком", input: "Ввод с контроллера", output: "Клавиатура / мышь",
    addMapping: "Новое назначение", remove: "Убрать назначение", clearPlayer: "Стереть все назначения", noMappings: "Для этого игрока назначения ещё не заданы.",
    pressInput: "Нажмите кнопку контроллера или сдвиньте стик…", pressOutput: "Нажмите клавишу клавиатуры либо укажите действие мыши:",
    anyController: "Сейчас этому игроку не назначен контроллер, поэтому во время захвата принимаются сигналы от любого контроллера.",
    cancel: "Отмена", saving: "Запись…", saved: "Записано", saveFailed: "Сохранение назначения не удалось", loadFailed: "Загрузка назначения не удалась",
    assignHint: "В разделе Настройки › Контроллеры укажите, какой контроллер управляет каждым игроком.",
    pinCursor: "Ограничить курсор окном", unpinCursor: "Снять ограничение курсора окном",
    presetConflict: "Профиль использует вводы, у которых уже есть назначения. Оставить прежние назначения или заменить конфликтующие?",
    keepExisting: "Оставить прежние", replaceConflicting: "Заменить конфликтующие назначения",
    wakeHint: "Нажмите любую кнопку этого контроллера, чтобы включить его в текущем окне.",
    detectHint: "Нажмите любую кнопку контроллера для его обнаружения.", controllers: "Контроллеры",
    controllersHint: "Укажите, какой из найденных контроллеров использует каждый игрок.",
    autoAssign: "Распределить подключённые контроллеры по очереди", leftClick: "Левый щелчок", rightClick: "Правый щелчок", middleClick: "Щелчок средней кнопкой",
    moveUp: "Переместить мышь вверх", moveDown: "Переместить мышь вниз", moveLeft: "Переместить мышь влево", moveRight: "Переместить мышь вправо",
    wheelUp: "Прокрутить колёсико вверх", wheelDown: "Прокрутить колёсико вниз", dpad: "Крестовина", leftStick: "Левый стик", rightStick: "Правый стик",
    up: "вверх", down: "вниз", left: "влево", right: "вправо", button: "Кнопка", axis: "Ось", stickPress: "нажать",
    changeInput: "Сменить ввод с контроллера", changeOutput: "Сменить вывод клавиатуры / мыши",
  },
};

export const detectedControllersLabels: Record<Language, string> = {
  en: "Detected controllers",
  zh: "已发现的手柄",
  es: "Mandos encontrados",
  fr: "Manettes repérées",
  de: "Gefundene Controller",
  "pt-BR": "Controles encontrados",
  ja: "検出済みのコントローラー",
  ko: "발견한 컨트롤러",
  hi: "खोजे गए कंट्रोलर",
  ar: "وحدات التحكم التي تم اكتشافها",
  ru: "Найденные контроллеры",
};

export const remapLabels = Object.fromEntries(
  (Object.keys(baseRemapLabels) as Language[]).map((language) => [language, { ...baseRemapLabels[language], ...steamRemapLabels[language] }]),
) as Record<Language, RemapText>;

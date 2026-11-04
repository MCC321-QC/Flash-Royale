import type { Language } from "./i18n";

export const libraryMusicPlaybackLabels: Record<Language, { pause: string; resume: string }> = {
  en: { pause: "Pause library music globally", resume: "Resume library music globally" },
  fr: { pause: "Mettre la musique de la bibliothèque en pause globale", resume: "Reprendre la musique de la bibliothèque globalement" },
  zh: { pause: "全局暂停游戏库音乐", resume: "全局恢复游戏库音乐" },
  es: { pause: "Pausar toda la música de la biblioteca", resume: "Reanudar toda la música de la biblioteca" },
  de: { pause: "Bibliotheksmusik global pausieren", resume: "Bibliotheksmusik global fortsetzen" },
  "pt-BR": { pause: "Pausar toda a música da biblioteca", resume: "Retomar toda a música da biblioteca" },
  ja: { pause: "ライブラリの音楽を全体で一時停止", resume: "ライブラリの音楽を全体で再開" },
  ko: { pause: "라이브러리 음악 전체 일시 정지", resume: "라이브러리 음악 전체 재개" },
  hi: { pause: "पूरी लाइब्रेरी का संगीत रोकें", resume: "पूरी लाइब्रेरी का संगीत फिर शुरू करें" },
  ar: { pause: "إيقاف موسيقى المكتبة مؤقتًا بالكامل", resume: "استئناف موسيقى المكتبة بالكامل" },
  ru: { pause: "Приостановить всю музыку библиотеки", resume: "Возобновить всю музыку библиотеки" },
};

export const libraryMusicLabels: Record<Language, { global: string; game: string; gameHelp: string; help: string }> = {
  en: { global: "Enable library music", game: "Enable music", gameHelp: "Allow this game's music to play in the library.", help: "Play selected game music in the library. Turning this off hides music controls without changing each game's preference or selected track." },
  fr: { global: "Activer la musique de la bibliothèque", game: "Activer la musique", gameHelp: "Autoriser la lecture de la musique du jeu dans la bibliothèque.", help: "Lire la musique du jeu sélectionné dans la bibliothèque. Désactiver cette option masque les commandes musicales sans modifier les préférences des jeux ni les pistes sélectionnées." },
  zh: { global: "启用游戏库音乐", game: "启用音乐", gameHelp: "允许在游戏库中播放该游戏的音乐。", help: "在游戏库中播放所选游戏的音乐。关闭后将隐藏音乐控件，但不会更改各游戏的偏好或所选曲目。" },
  es: { global: "Activar música de la biblioteca", game: "Activar música", gameHelp: "Permite reproducir la música del juego en la biblioteca.", help: "Reproduce la música del juego seleccionado en la biblioteca. Desactivar oculta los controles sin cambiar las preferencias de cada juego ni la pista seleccionada." },
  de: { global: "Bibliotheksmusik aktivieren", game: "Musik aktivieren", gameHelp: "Erlaubt die Wiedergabe der Spielmusik in der Bibliothek.", help: "Musik des ausgewählten Spiels in der Bibliothek abspielen. Beim Ausschalten werden die Musiksteuerungen ausgeblendet, ohne Spielpräferenzen oder ausgewählte Titel zu ändern." },
  "pt-BR": { global: "Ativar música da biblioteca", game: "Ativar música", gameHelp: "Permite reproduzir a música do jogo na biblioteca.", help: "Reproduz a música do jogo selecionado na biblioteca. Desativar oculta os controles sem alterar as preferências de cada jogo ou a faixa selecionada." },
  ja: { global: "ライブラリの音楽を有効にする", game: "音楽を有効にする", gameHelp: "ライブラリでこのゲームの音楽を再生できるようにします。", help: "ライブラリで選択したゲームの音楽を再生します。無効にすると音楽操作が非表示になりますが、各ゲームの設定や選択した曲は保持されます。" },
  ko: { global: "라이브러리 음악 활성화", game: "음악 활성화", gameHelp: "라이브러리에서 이 게임의 음악을 재생하도록 허용합니다.", help: "라이브러리에서 선택한 게임의 음악을 재생합니다. 끄면 음악 컨트롤이 숨겨지지만 게임별 설정과 선택한 곡은 유지됩니다." },
  hi: { global: "लाइब्रेरी संगीत चालू करें", game: "संगीत चालू करें", gameHelp: "लाइब्रेरी में इस गेम का संगीत चलाने की अनुमति दें।", help: "लाइब्रेरी में चुने हुए गेम का संगीत चलाएँ। बंद करने पर संगीत नियंत्रण छिप जाते हैं लेकिन गेम की पसंद और चुना हुआ ट्रैक नहीं बदलता।" },
  ar: { global: "تفعيل موسيقى المكتبة", game: "تفعيل الموسيقى", gameHelp: "السماح بتشغيل موسيقى اللعبة في المكتبة.", help: "تشغيل موسيقى اللعبة المحددة في المكتبة. يؤدي إيقاف هذا الخيار إلى إخفاء عناصر التحكم دون تغيير تفضيلات الألعاب أو المقطع المحدد." },
  ru: { global: "Включить музыку в библиотеке", game: "Включить музыку", gameHelp: "Разрешить воспроизведение музыки игры в библиотеке.", help: "Воспроизводить музыку выбранной игры в библиотеке. Отключение скрывает управление музыкой, не меняя настройки игр и выбранные композиции." },
};

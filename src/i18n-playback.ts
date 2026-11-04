import type { Language } from "./i18n";

export const playerResetConfirmLabels: Record<Language, string> = {
  en: "Press again to reset game. Unsaved progress will be lost.",
  zh: "再次按下以重置游戏。未保存的进度将丢失。",
  es: "Pulsa de nuevo para reiniciar el juego. Se perderá el progreso sin guardar.",
  fr: "Appuyez à nouveau pour réinitialiser le jeu. La progression non enregistrée sera perdue.",
  de: "Erneut drücken, um das Spiel zurückzusetzen. Nicht gespeicherter Fortschritt geht verloren.",
  "pt-BR": "Pressione novamente para reiniciar o jogo. O progresso não salvo será perdido.",
  ja: "もう一度押すとゲームをリセットします。未保存の進行状況は失われます。",
  ko: "다시 누르면 게임이 초기화됩니다. 저장하지 않은 진행 상황이 사라집니다.",
  hi: "गेम रीसेट करने के लिए फिर से दबाएँ। बिना सहेजी प्रगति खो जाएगी।",
  ar: "اضغط مرة أخرى لإعادة تشغيل اللعبة. سيُفقد التقدم غير المحفوظ.",
  ru: "Нажмите ещё раз, чтобы перезапустить игру. Несохранённый прогресс будет потерян.",
};

export const playerCloseConfirmLabels: Record<Language, string> = {
  en: "Press again to close game. Unsaved progress will be lost.",
  zh: "再次按下以关闭游戏。未保存的进度将丢失。",
  es: "Pulsa de nuevo para cerrar el juego. Se perderá el progreso sin guardar.",
  fr: "Appuyez à nouveau pour fermer le jeu. La progression non enregistrée sera perdue.",
  de: "Erneut drücken, um das Spiel zu schließen. Nicht gespeicherter Fortschritt geht verloren.",
  "pt-BR": "Pressione novamente para fechar o jogo. O progresso não salvo será perdido.",
  ja: "もう一度押すとゲームを閉じます。未保存の進行状況は失われます。",
  ko: "다시 누르면 게임이 종료됩니다. 저장하지 않은 진행 상황이 사라집니다.",
  hi: "गेम बंद करने के लिए फिर से दबाएँ। बिना सहेजी प्रगति खो जाएगी।",
  ar: "اضغط مرة أخرى لإغلاق اللعبة. سيُفقد التقدم غير المحفوظ.",
  ru: "Нажмите ещё раз, чтобы закрыть игру. Несохранённый прогресс будет потерян.",
};

export const gamePausedLabels: Record<Language, string> = {
  en: "Game Paused",
  zh: "游戏已暂停",
  es: "Juego en pausa",
  fr: "Jeu en pause",
  de: "Spiel pausiert",
  "pt-BR": "Jogo pausado",
  ja: "ゲーム一時停止中",
  ko: "게임 일시 정지됨",
  hi: "गेम रुका हुआ है",
  ar: "اللعبة متوقفة مؤقتًا",
  ru: "Игра приостановлена",
};

export const playerVolumeLabels: Record<Language, { volume: string; failed: string }> = {
  en: { volume: "Volume", failed: "Could not update game volume" },
  zh: { volume: "音量", failed: "无法更新游戏音量" },
  es: { volume: "Volumen", failed: "No se pudo actualizar el volumen del juego" },
  fr: { volume: "Volume", failed: "Impossible de modifier le volume du jeu" },
  de: { volume: "Lautstärke", failed: "Die Spiellautstärke konnte nicht aktualisiert werden" },
  "pt-BR": { volume: "Volume", failed: "Não foi possível atualizar o volume do jogo" },
  ja: { volume: "音量", failed: "ゲームの音量を更新できませんでした" },
  ko: { volume: "음량", failed: "게임 음량을 변경할 수 없습니다" },
  hi: { volume: "आवाज़", failed: "गेम की आवाज़ अपडेट नहीं की जा सकी" },
  ar: { volume: "مستوى الصوت", failed: "تعذر تحديث مستوى صوت اللعبة" },
  ru: { volume: "Громкость", failed: "Не удалось изменить громкость игры" },
};

export const playbackLabels: Record<Language, { pause: string; resume: string; shortcut: string; unassigned: string; clear: string; help: string }> = {
  en: { pause: "Pause game", resume: "Resume game", shortcut: "Pause / resume game", unassigned: "Unassigned", clear: "Clear shortcut", help: "Pause the game player entirely." },
  zh: { pause: "暂停游戏", resume: "继续游戏", shortcut: "暂停 / 继续游戏", unassigned: "未分配", clear: "清除快捷键", help: "完全暂停游戏播放器。" },
  es: { pause: "Pausar juego", resume: "Reanudar juego", shortcut: "Pausar / reanudar juego", unassigned: "Sin asignar", clear: "Borrar atajo", help: "Pausa el reproductor por completo." },
  fr: { pause: "Mettre le jeu en pause", resume: "Reprendre le jeu", shortcut: "Pause / reprise du jeu", unassigned: "Non attribué", clear: "Effacer le raccourci", help: "Mettez complètement le lecteur en pause." },
  de: { pause: "Spiel pausieren", resume: "Spiel fortsetzen", shortcut: "Spiel pausieren / fortsetzen", unassigned: "Nicht zugewiesen", clear: "Tastenkombination löschen", help: "Pausiert den Player vollständig." },
  "pt-BR": { pause: "Pausar jogo", resume: "Retomar jogo", shortcut: "Pausar / retomar jogo", unassigned: "Não atribuído", clear: "Limpar atalho", help: "Pause o player por completo." },
  ja: { pause: "ゲームを一時停止", resume: "ゲームを再開", shortcut: "ゲームの一時停止 / 再開", unassigned: "未割り当て", clear: "ショートカットを解除", help: "プレイヤーを完全に一時停止します。" },
  ko: { pause: "게임 일시 정지", resume: "게임 재개", shortcut: "게임 일시 정지 / 재개", unassigned: "미지정", clear: "단축키 지우기", help: "플레이어를 완전히 일시 정지합니다." },
  hi: { pause: "गेम रोकें", resume: "गेम जारी रखें", shortcut: "गेम रोकें / जारी रखें", unassigned: "असाइन नहीं किया गया", clear: "शॉर्टकट हटाएँ", help: "प्लेयर को पूरी तरह रोकता है।" },
  ar: { pause: "إيقاف اللعبة مؤقتًا", resume: "استئناف اللعبة", shortcut: "إيقاف اللعبة مؤقتًا / استئنافها", unassigned: "غير معيّن", clear: "مسح الاختصار", help: "أوقف المشغل تمامًا." },
  ru: { pause: "Приостановить игру", resume: "Продолжить игру", shortcut: "Пауза / продолжение игры", unassigned: "Не назначено", clear: "Удалить сочетание", help: "Полностью приостанавливает плеер." },
};

import type { Language } from "./i18n";

interface ScreenshotLabels {
  take: string;
  saved: string;
  view: string;
  useAsCover: string;
  open: string;
  title: string;
  empty: string;
  openFolder: string;
  delete: string;
  confirmDelete: string;
  previous: string;
  next: string;
  close: string;
  count: string;
  cropTitle: string;
  cropHint: string;
  cropMove: string;
  cropResize: string;
  apply: string;
  cancel: string;
  resetFrame: string;
  coverApplied: string;
  failed: string;
}

export const screenshotLabels: Record<Language, ScreenshotLabels> = {
  en: {
    take: "Take screenshot", saved: "Screenshot saved", view: "View", useAsCover: "Use as game cover", open: "Screenshots",
    title: "Screenshots", empty: "No screenshots yet. Use the camera button at the top of the game window to take one.",
    openFolder: "Open folder", delete: "Delete", confirmDelete: "Click again to delete", previous: "Previous", next: "Next",
    close: "Close", count: "{n} screenshot(s)", cropTitle: "Choose the cover area",
    cropHint: "Drag the frame to move it. Drag a corner or use the mouse wheel to resize it. Covers use a 16:9 ratio.",
    cropMove: "Move", cropResize: "Resize", apply: "Apply cover", cancel: "Cancel", resetFrame: "Reset frame",
    coverApplied: "Cover updated", failed: "The screenshot could not be taken",
  },
  zh: {
    take: "拍摄截图", saved: "已保存截图", view: "查看", useAsCover: "设为游戏封面", open: "截图",
    title: "截图", empty: "暂无截图。点击游戏窗口顶部的相机按钮即可拍摄。",
    openFolder: "打开文件夹", delete: "删除", confirmDelete: "再点击一次即可删除", previous: "上一张", next: "下一张",
    close: "关闭", count: "{n} 张截图", cropTitle: "选择封面范围",
    cropHint: "拖动选框可移动位置，拖动角点或滚动鼠标滚轮可调整大小。封面采用 16:9 比例。",
    cropMove: "移动", cropResize: "调整大小", apply: "应用封面", cancel: "取消", resetFrame: "重置选框",
    coverApplied: "已更新封面", failed: "未能拍摄截图",
  },
  es: {
    take: "Tomar captura de pantalla", saved: "Captura guardada", view: "Ver", useAsCover: "Usar como portada del juego", open: "Capturas de pantalla",
    title: "Capturas de pantalla", empty: "Todavía no hay capturas. Usa el botón de la cámara situado arriba en la ventana del juego para tomar una.",
    openFolder: "Abrir carpeta", delete: "Eliminar", confirmDelete: "Vuelve a hacer clic para eliminar", previous: "Anterior", next: "Siguiente",
    close: "Cerrar", count: "{n} captura(s)", cropTitle: "Selecciona la zona de la portada",
    cropHint: "Arrastra el marco para moverlo. Arrastra una esquina o usa la rueda del ratón para ajustar su tamaño. Las portadas tienen una relación de aspecto de 16:9.",
    cropMove: "Mover", cropResize: "Cambiar tamaño", apply: "Aplicar portada", cancel: "Cancelar", resetFrame: "Restablecer marco",
    coverApplied: "Portada actualizada", failed: "No se ha podido tomar la captura",
  },
  fr: {
    take: "Prendre une capture d’écran", saved: "Capture enregistrée", view: "Afficher", useAsCover: "Utiliser comme couverture du jeu", open: "Captures d’écran",
    title: "Captures d’écran", empty: "Aucune capture pour le moment. Utilisez le bouton appareil photo en haut de la fenêtre du jeu pour en prendre une.",
    openFolder: "Ouvrir le dossier", delete: "Supprimer", confirmDelete: "Cliquez une seconde fois pour supprimer", previous: "Précédente", next: "Suivante",
    close: "Fermer", count: "{n} capture(s)", cropTitle: "Sélectionner la zone de couverture",
    cropHint: "Faites glisser le cadre pour le déplacer. Faites glisser un coin ou utilisez la molette pour modifier sa taille. Les couvertures sont au format 16:9.",
    cropMove: "Déplacer", cropResize: "Redimensionner", apply: "Appliquer la couverture", cancel: "Annuler", resetFrame: "Réinitialiser le cadre",
    coverApplied: "Couverture actualisée", failed: "Impossible de prendre la capture d’écran",
  },
  de: {
    take: "Screenshot aufnehmen", saved: "Screenshot gespeichert", view: "Anzeigen", useAsCover: "Als Spielcover verwenden", open: "Screenshots",
    title: "Screenshots", empty: "Es gibt noch keine Screenshots. Mit der Kamera-Schaltfläche oben im Spielfenster kannst du einen aufnehmen.",
    openFolder: "Ordner öffnen", delete: "Löschen", confirmDelete: "Zum Löschen nochmals klicken", previous: "Vorheriger", next: "Nächster",
    close: "Schließen", count: "{n} Screenshot(s)", cropTitle: "Bereich für das Cover auswählen",
    cropHint: "Ziehe den Rahmen, um ihn zu bewegen. Ziehe an einer Ecke oder drehe das Mausrad, um seine Größe zu ändern. Cover haben ein Seitenverhältnis von 16:9.",
    cropMove: "Verschieben", cropResize: "Größe ändern", apply: "Cover anwenden", cancel: "Abbrechen", resetFrame: "Rahmen zurücksetzen",
    coverApplied: "Cover aktualisiert", failed: "Der Screenshot konnte nicht aufgenommen werden",
  },
  "pt-BR": {
    take: "Fazer captura de tela", saved: "Captura de tela salva", view: "Visualizar", useAsCover: "Usar como capa do jogo", open: "Capturas de tela",
    title: "Capturas de tela", empty: "Ainda não há capturas. Use o botão da câmera na parte superior da janela do jogo para fazer uma.",
    openFolder: "Abrir pasta", delete: "Excluir", confirmDelete: "Clique novamente para excluir", previous: "Anterior", next: "Próxima",
    close: "Fechar", count: "{n} captura(s) de tela", cropTitle: "Selecione a área da capa",
    cropHint: "Arraste a moldura para movê-la. Arraste um canto ou use a roda do mouse para ajustar o tamanho. As capas têm proporção de 16:9.",
    cropMove: "Mover", cropResize: "Redimensionar", apply: "Aplicar capa", cancel: "Cancelar", resetFrame: "Restaurar moldura",
    coverApplied: "Capa atualizada", failed: "Não foi possível fazer a captura de tela",
  },
  ja: {
    take: "スクリーンショットを撮影", saved: "スクリーンショットを保存しました", view: "表示", useAsCover: "ゲームのカバーとして使用", open: "スクリーンショット",
    title: "スクリーンショット", empty: "まだスクリーンショットはありません。ゲームウィンドウの上部にあるカメラボタンで撮影できます。",
    openFolder: "フォルダーを開く", delete: "削除", confirmDelete: "もう一度クリックすると削除します", previous: "前へ", next: "次へ",
    close: "閉じる", count: "スクリーンショット {n} 枚", cropTitle: "カバーにする範囲を選択",
    cropHint: "枠をドラッグして移動します。角をドラッグするかマウスホイールを使うとサイズを変更できます。カバーの縦横比は 16:9 です。",
    cropMove: "移動", cropResize: "サイズ変更", apply: "カバーを適用", cancel: "キャンセル", resetFrame: "枠を初期化",
    coverApplied: "カバーを更新しました", failed: "スクリーンショットを撮影できませんでした",
  },
  ko: {
    take: "스크린샷 촬영", saved: "스크린샷이 저장되었습니다", view: "보기", useAsCover: "게임 표지로 사용", open: "스크린샷",
    title: "스크린샷", empty: "아직 스크린샷이 없습니다. 게임 창 상단의 카메라 버튼을 눌러 촬영하세요.",
    openFolder: "폴더 열기", delete: "삭제", confirmDelete: "한 번 더 클릭하여 삭제", previous: "이전", next: "다음",
    close: "닫기", count: "스크린샷 {n}장", cropTitle: "표지로 사용할 영역 선택",
    cropHint: "프레임을 끌어 위치를 옮기세요. 모서리를 끌거나 마우스 휠을 사용하면 크기를 바꿀 수 있습니다. 표지의 비율은 16:9입니다.",
    cropMove: "이동", cropResize: "크기 조절", apply: "표지 적용", cancel: "취소", resetFrame: "프레임 초기화",
    coverApplied: "표지가 업데이트되었습니다", failed: "스크린샷을 촬영하지 못했습니다",
  },
  hi: {
    take: "स्क्रीनशॉट लें", saved: "स्क्रीनशॉट सहेज लिया गया", view: "देखें", useAsCover: "गेम के कवर के रूप में इस्तेमाल करें", open: "स्क्रीनशॉट",
    title: "स्क्रीनशॉट", empty: "अभी कोई स्क्रीनशॉट नहीं है। स्क्रीनशॉट लेने के लिए गेम विंडो के ऊपर मौजूद कैमरा बटन दबाएँ।",
    openFolder: "फ़ोल्डर खोलें", delete: "मिटाएँ", confirmDelete: "मिटाने के लिए दोबारा क्लिक करें", previous: "पिछला", next: "अगला",
    close: "बंद करें", count: "{n} स्क्रीनशॉट", cropTitle: "कवर का क्षेत्र चुनें",
    cropHint: "फ़्रेम को खींचकर खिसकाएँ। आकार बदलने के लिए किसी कोने को खींचें या माउस का पहिया घुमाएँ। कवर का अनुपात 16:9 होता है।",
    cropMove: "खिसकाएँ", cropResize: "आकार बदलें", apply: "कवर लागू करें", cancel: "रद्द करें", resetFrame: "फ़्रेम रीसेट करें",
    coverApplied: "कवर अपडेट हो गया", failed: "स्क्रीनशॉट नहीं लिया जा सका",
  },
  ar: {
    take: "التقاط صورة للشاشة", saved: "تم حفظ لقطة الشاشة", view: "عرض", useAsCover: "استخدام كغلاف للعبة", open: "لقطات الشاشة",
    title: "لقطات الشاشة", empty: "لا توجد لقطات شاشة بعد. استخدم زر الكاميرا أعلى نافذة اللعبة لالتقاط صورة.",
    openFolder: "فتح المجلد", delete: "حذف", confirmDelete: "انقر مرة أخرى للحذف", previous: "السابقة", next: "التالية",
    close: "إغلاق", count: "{n} من لقطات الشاشة", cropTitle: "اختيار منطقة الغلاف",
    cropHint: "اسحب الإطار لتحريكه. اسحب إحدى الزوايا أو استخدم عجلة الفأرة لتغيير حجمه. تستخدم الأغلفة نسبة أبعاد 16:9.",
    cropMove: "تحريك", cropResize: "تغيير الحجم", apply: "تطبيق الغلاف", cancel: "إلغاء", resetFrame: "إعادة ضبط الإطار",
    coverApplied: "تم تحديث الغلاف", failed: "تعذّر التقاط صورة للشاشة",
  },
  ru: {
    take: "Сделать снимок экрана", saved: "Снимок экрана сохранён", view: "Посмотреть", useAsCover: "Использовать как обложку игры", open: "Снимки экрана",
    title: "Снимки экрана", empty: "Снимков пока нет. Чтобы сделать снимок, нажмите кнопку с камерой в верхней части окна игры.",
    openFolder: "Открыть папку", delete: "Удалить", confirmDelete: "Нажмите ещё раз для удаления", previous: "Предыдущий", next: "Следующий",
    close: "Закрыть", count: "Снимков экрана: {n}", cropTitle: "Выберите область обложки",
    cropHint: "Перетащите рамку, чтобы переместить её. Для изменения размера потяните за угол или прокрутите колёсико мыши. Соотношение сторон обложки — 16:9.",
    cropMove: "Переместить", cropResize: "Изменить размер", apply: "Применить обложку", cancel: "Отмена", resetFrame: "Сбросить рамку",
    coverApplied: "Обложка обновлена", failed: "Не удалось сделать снимок экрана",
  },
};

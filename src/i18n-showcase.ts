import type { Language } from "./i18n";

interface ShowcaseLabels {
  title: string;
  hint: string;
  formats: string;
  choose: string;
  add: string;
  addScreenshots: string;
  remove: string;
  deleteImported: string;
  view: string;
  close: string;
  pickTitle: string;
  pickHint: string;
  done: string;
  added: string;
  skipped: string;
  fromFlashpoint: string;
  empty: string;
  showcase: string;
  showcased: string;
}

export const showcaseLabels: Record<Language, ShowcaseLabels> = {
  en: {
    title: "Showcase screenshots",
    hint: "Shown in the game info panel. Screenshots from Flashpoint are imported automatically, you can also pick your own screenshots or add images from anywhere. Deleted Flashpoint screenshots are not imported again.",
    formats: "Supported: PNG, JPG, WEBP, GIF and BMP images up to 25 MB each. Added images are copied into the game's screenshots folder and shown in the showcase.",
    choose: "Choose from my screenshots", add: "Add images…", addScreenshots: "Add screenshots",
    remove: "Remove from showcase", deleteImported: "Delete screenshot", view: "View screenshot", close: "Close",
    pickTitle: "Choose showcase screenshots", pickHint: "Your screenshots of this game. Checked ones are shown in the showcase.", done: "Done",
    added: "Added {n} screenshot(s).", skipped: "{n} file(s) skipped: not a supported image or larger than 25 MB.",
    fromFlashpoint: "Flashpoint", empty: "No showcase screenshots yet.", showcase: "Add to showcase", showcased: "In showcase",
  },
  zh: {
    title: "精选截图",
    hint: "这些截图会显示在游戏信息面板中。Flashpoint 截图会自动导入，你也可以挑选自己的截图，或从任意位置添加图片。删除的 Flashpoint 截图不会再次导入。",
    formats: "支持 PNG、JPG、WEBP、GIF 和 BMP 图片，每张最大 25 MB。添加的图片会复制到该游戏的截图文件夹中，并展示在精选截图中。",
    choose: "从我的截图中挑选", add: "添加图片…", addScreenshots: "添加截图",
    remove: "从精选截图中移除", deleteImported: "删除截图", view: "查看截图", close: "关闭",
    pickTitle: "选择精选截图", pickHint: "这是你为该游戏拍摄的截图。勾选的图片会作为精选截图展示。", done: "完成",
    added: "已添加 {n} 张截图。", skipped: "已跳过 {n} 个文件：图片格式不受支持，或大小超过 25 MB。",
    fromFlashpoint: "Flashpoint", empty: "暂无精选截图。", showcase: "添加到精选截图", showcased: "已加入精选截图",
  },
  es: {
    title: "Capturas destacadas",
    hint: "Se muestran en el panel de información del juego. Las capturas de Flashpoint se importan automáticamente, también puedes seleccionar tus propias capturas o añadir imágenes de cualquier ubicación. Las capturas de Flashpoint que elimines no se importarán de nuevo.",
    formats: "Se admiten imágenes PNG, JPG, WEBP, GIF y BMP de hasta 25 MB cada una. Las imágenes añadidas se copian en la carpeta de capturas del juego y se muestran entre las destacadas.",
    choose: "Seleccionar entre mis capturas", add: "Añadir imágenes…", addScreenshots: "Añadir capturas",
    remove: "Quitar de las destacadas", deleteImported: "Eliminar captura", view: "Ver captura", close: "Cerrar",
    pickTitle: "Seleccionar capturas destacadas", pickHint: "Tus capturas de este juego. Las que marques se mostrarán como destacadas.", done: "Listo",
    added: "Se han añadido {n} captura(s).", skipped: "Se han omitido {n} archivo(s): formato de imagen no compatible o tamaño superior a 25 MB.",
    fromFlashpoint: "Flashpoint", empty: "Todavía no hay capturas destacadas.", showcase: "Añadir a destacadas", showcased: "En destacadas",
  },
  fr: {
    title: "Captures en vitrine",
    hint: "Ces captures apparaissent dans le panneau d’informations du jeu. Celles de Flashpoint sont importées automatiquement, vous pouvez aussi sélectionner vos propres captures ou ajouter des images depuis n’importe quel emplacement. Les captures Flashpoint supprimées ne sont pas réimportées.",
    formats: "Images acceptées : PNG, JPG, WEBP, GIF et BMP, jusqu’à 25 Mo par image. Les images ajoutées sont copiées dans le dossier de captures du jeu et affichées dans la vitrine.",
    choose: "Sélectionner parmi mes captures", add: "Ajouter des images…", addScreenshots: "Ajouter des captures",
    remove: "Retirer de la vitrine", deleteImported: "Supprimer la capture", view: "Afficher la capture", close: "Fermer",
    pickTitle: "Sélectionner les captures en vitrine", pickHint: "Vos captures de ce jeu. Les captures cochées apparaissent dans la vitrine.", done: "Terminé",
    added: "{n} capture(s) ajoutée(s).", skipped: "{n} fichier(s) ignoré(s) : format d’image non accepté ou taille supérieure à 25 Mo.",
    fromFlashpoint: "Flashpoint", empty: "Aucune capture en vitrine pour le moment.", showcase: "Ajouter à la vitrine", showcased: "Dans la vitrine",
  },
  de: {
    title: "Präsentationsbilder",
    hint: "Diese Bilder erscheinen im Spielinfo-Bereich. Screenshots aus Flashpoint werden automatisch importiert. Du kannst auch eigene Screenshots auswählen oder Bilder von beliebigen Orten hinzufügen. Gelöschte Flashpoint-Screenshots werden nicht nochmals importiert.",
    formats: "Unterstützt werden PNG-, JPG-, WEBP-, GIF- und BMP-Bilder mit jeweils höchstens 25 MB. Hinzugefügte Bilder werden in den Screenshot-Ordner des Spiels kopiert und in der Präsentation angezeigt.",
    choose: "Aus meinen Screenshots auswählen", add: "Bilder hinzufügen…", addScreenshots: "Screenshots hinzufügen",
    remove: "Aus der Präsentation entfernen", deleteImported: "Screenshot löschen", view: "Screenshot anzeigen", close: "Schließen",
    pickTitle: "Präsentationsbilder auswählen", pickHint: "Deine Screenshots von diesem Spiel. Angekreuzte Bilder werden in der Präsentation angezeigt.", done: "Fertig",
    added: "{n} Screenshot(s) hinzugefügt.", skipped: "{n} Datei(en) übersprungen: Bildformat nicht unterstützt oder größer als 25 MB.",
    fromFlashpoint: "Flashpoint", empty: "Noch keine Präsentationsbilder vorhanden.", showcase: "Zur Präsentation hinzufügen", showcased: "In der Präsentation",
  },
  "pt-BR": {
    title: "Capturas em destaque",
    hint: "Estas capturas aparecem no painel de informações do jogo. As capturas do Flashpoint são importadas automaticamente, você também pode selecionar suas próprias capturas ou adicionar imagens de qualquer local. Capturas do Flashpoint que forem excluídas não serão importadas novamente.",
    formats: "São aceitas imagens PNG, JPG, WEBP, GIF e BMP de até 25 MB cada. As imagens adicionadas são copiadas para a pasta de capturas do jogo e exibidas em destaque.",
    choose: "Selecionar entre minhas capturas", add: "Adicionar imagens…", addScreenshots: "Adicionar capturas",
    remove: "Remover dos destaques", deleteImported: "Excluir captura", view: "Visualizar captura", close: "Fechar",
    pickTitle: "Selecionar capturas em destaque", pickHint: "Suas capturas deste jogo. As capturas marcadas aparecem em destaque.", done: "Concluir",
    added: "{n} captura(s) adicionada(s).", skipped: "{n} arquivo(s) ignorado(s): formato de imagem não aceito ou tamanho maior que 25 MB.",
    fromFlashpoint: "Flashpoint", empty: "Ainda não há capturas em destaque.", showcase: "Adicionar aos destaques", showcased: "Nos destaques",
  },
  ja: {
    title: "紹介用スクリーンショット",
    hint: "ゲーム情報パネルに表示する画像です。Flashpoint のスクリーンショットは自動的にインポートされます。自分のスクリーンショットを選んだり、任意の場所から画像を追加したりすることもできます。削除した Flashpoint のスクリーンショットは再度インポートされません。",
    formats: "PNG、JPG、WEBP、GIF、BMP 形式の画像に対応しています（各 25 MB まで）。追加した画像はゲームのスクリーンショットフォルダーにコピーされ、紹介用として表示されます。",
    choose: "自分のスクリーンショットから選択", add: "画像を追加…", addScreenshots: "スクリーンショットを追加",
    remove: "紹介用から外す", deleteImported: "スクリーンショットを削除", view: "スクリーンショットを表示", close: "閉じる",
    pickTitle: "紹介用スクリーンショットを選択", pickHint: "このゲームで撮影したスクリーンショットです。チェックした画像が紹介用として表示されます。", done: "完了",
    added: "スクリーンショットを {n} 枚追加しました。", skipped: "{n} 件のファイルをスキップしました。対応していない画像形式か、25 MB を超えています。",
    fromFlashpoint: "Flashpoint", empty: "紹介用スクリーンショットはまだありません。", showcase: "紹介用に追加", showcased: "紹介用に追加済み",
  },
  ko: {
    title: "소개용 스크린샷",
    hint: "게임 정보 패널에 표시됩니다. Flashpoint 스크린샷은 자동으로 가져오며, 직접 찍은 스크린샷을 선택하거나 다른 위치의 이미지를 추가할 수도 있습니다. 삭제한 Flashpoint 스크린샷은 다시 가져오지 않습니다.",
    formats: "PNG, JPG, WEBP, GIF, BMP 이미지를 지원하며 각 파일은 최대 25 MB까지 가능합니다. 추가한 이미지는 게임의 스크린샷 폴더에 복사되고 소개용으로 표시됩니다.",
    choose: "내 스크린샷에서 선택", add: "이미지 추가…", addScreenshots: "스크린샷 추가",
    remove: "소개용에서 제외", deleteImported: "스크린샷 삭제", view: "스크린샷 보기", close: "닫기",
    pickTitle: "소개용 스크린샷 선택", pickHint: "이 게임에서 직접 찍은 스크린샷입니다. 선택한 항목이 소개용으로 표시됩니다.", done: "완료",
    added: "스크린샷 {n}장을 추가했습니다.", skipped: "파일 {n}개를 건너뛰었습니다. 지원하지 않는 이미지 형식이거나 25 MB를 초과합니다.",
    fromFlashpoint: "Flashpoint", empty: "아직 소개용 스크린샷이 없습니다.", showcase: "소개용으로 추가", showcased: "소개용에 포함됨",
  },
  hi: {
    title: "प्रदर्शित स्क्रीनशॉट",
    hint: "ये गेम के जानकारी पैनल में दिखते हैं। Flashpoint के स्क्रीनशॉट अपने-आप आयात होते हैं, आप अपने स्क्रीनशॉट भी चुन सकते हैं या किसी भी स्थान से चित्र जोड़ सकते हैं। मिटाए गए Flashpoint स्क्रीनशॉट दोबारा आयात नहीं होते।",
    formats: "PNG, JPG, WEBP, GIF और BMP चित्र समर्थित हैं, प्रत्येक अधिकतम 25 MB तक। जोड़े गए चित्र गेम के स्क्रीनशॉट फ़ोल्डर में कॉपी होते हैं और प्रदर्शन में दिखाए जाते हैं।",
    choose: "मेरे स्क्रीनशॉट में से चुनें", add: "चित्र जोड़ें…", addScreenshots: "स्क्रीनशॉट जोड़ें",
    remove: "प्रदर्शन से हटाएँ", deleteImported: "स्क्रीनशॉट मिटाएँ", view: "स्क्रीनशॉट देखें", close: "बंद करें",
    pickTitle: "प्रदर्शन के लिए स्क्रीनशॉट चुनें", pickHint: "इस गेम के आपके स्क्रीनशॉट। चुने हुए स्क्रीनशॉट प्रदर्शन में दिखते हैं।", done: "हो गया",
    added: "{n} स्क्रीनशॉट जोड़े गए।", skipped: "{n} फ़ाइलें छोड़ी गईं: चित्र का प्रारूप समर्थित नहीं है या आकार 25 MB से अधिक है।",
    fromFlashpoint: "Flashpoint", empty: "अभी प्रदर्शन के लिए कोई स्क्रीनशॉट नहीं है।", showcase: "प्रदर्शन में जोड़ें", showcased: "प्रदर्शन में शामिल",
  },
  ar: {
    title: "لقطات شاشة للعرض",
    hint: "تظهر في لوحة معلومات اللعبة. تُستورد لقطات Flashpoint تلقائيًا، ويمكنك أيضًا اختيار لقطاتك الخاصة أو إضافة صور من أي مكان. لا تُستورد لقطات Flashpoint المحذوفة مرة أخرى.",
    formats: "تُقبل صور PNG وJPG وWEBP وGIF وBMP بحجم أقصاه 25 MB لكل صورة. تُنسخ الصور المضافة إلى مجلد لقطات الشاشة الخاص باللعبة وتظهر في قسم العرض.",
    choose: "الاختيار من لقطاتي", add: "إضافة صور…", addScreenshots: "إضافة لقطات شاشة",
    remove: "إزالة من قسم العرض", deleteImported: "حذف لقطة الشاشة", view: "عرض لقطة الشاشة", close: "إغلاق",
    pickTitle: "اختيار لقطات الشاشة للعرض", pickHint: "لقطاتك لهذه اللعبة. تظهر اللقطات المحددة في قسم العرض.", done: "تم",
    added: "تمت إضافة {n} من لقطات الشاشة.", skipped: "تم تخطي {n} من الملفات: صيغة الصورة غير مدعومة أو حجمها أكبر من 25 MB.",
    fromFlashpoint: "Flashpoint", empty: "لا توجد لقطات شاشة للعرض بعد.", showcase: "إضافة إلى قسم العرض", showcased: "في قسم العرض",
  },
  ru: {
    title: "Снимки для витрины",
    hint: "Отображаются на панели информации об игре. Снимки из Flashpoint импортируются автоматически. Также можно выбрать собственные снимки или добавить изображения из любого расположения. Удалённые снимки Flashpoint повторно не импортируются.",
    formats: "Поддерживаются изображения PNG, JPG, WEBP, GIF и BMP размером до 25 МБ каждое. Добавленные изображения копируются в папку снимков экрана игры и отображаются на витрине.",
    choose: "Выбрать из моих снимков", add: "Добавить изображения…", addScreenshots: "Добавить снимки экрана",
    remove: "Убрать с витрины", deleteImported: "Удалить снимок", view: "Посмотреть снимок", close: "Закрыть",
    pickTitle: "Выберите снимки для витрины", pickHint: "Ваши снимки этой игры. Отмеченные снимки отображаются на витрине.", done: "Готово",
    added: "Добавлено снимков: {n}.", skipped: "Пропущено файлов: {n}. Формат изображения не поддерживается или размер превышает 25 МБ.",
    fromFlashpoint: "Flashpoint", empty: "Снимков для витрины пока нет.", showcase: "Добавить на витрину", showcased: "На витрине",
  },
};

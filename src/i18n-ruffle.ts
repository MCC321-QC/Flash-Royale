import type { Language } from "./i18n";

interface RuffleChannelLabels {
  channel: string;
  stable: string;
  nightly: string;
  notDownloaded: string;
  hint: string;
  update: string;
  downloading: string;
  upToDate: string;
  updated: string;
  switched: string;
}

export const ruffleChannelLabels: Record<Language, RuffleChannelLabels> = {
  en: {
    channel: "Ruffle version", stable: "Stable · v{version}", nightly: "Nightly · {version}", notDownloaded: "not downloaded",
    hint: "Nightly builds are newer and may run more games, but they are less tested. They are downloaded when you choose them. The change applies to games opened afterwards.",
    update: "Update nightly", downloading: "Downloading Ruffle nightly…", upToDate: "The newest nightly ({version}) is already installed.", updated: "Ruffle nightly {version} installed.", switched: "New games will use Ruffle {version}.",
  },
  zh: {
    channel: "Ruffle 版本", stable: "稳定版 · v{version}", nightly: "每日构建版 · {version}", notDownloaded: "尚未下载",
    hint: "每日构建版较新，可能运行更多游戏，但经过的测试较少。选择后才会下载，更改仅对之后打开的游戏生效。",
    update: "更新每日构建版", downloading: "正在下载 Ruffle 每日构建版…", upToDate: "最新每日构建版（{version}）已安装。", updated: "Ruffle 每日构建版 {version} 安装完成。", switched: "之后打开的游戏将使用 Ruffle {version}。",
  },
  es: {
    channel: "Versión de Ruffle", stable: "Estable · v{version}", nightly: "Nightly · {version}", notDownloaded: "aún no descargada",
    hint: "Las compilaciones nightly son más recientes y pueden ejecutar más juegos, aunque se han probado menos. Se descargan cuando las seleccionas. El cambio afecta a los juegos que abras a partir de entonces.",
    update: "Actualizar la nightly", downloading: "Descargando la nightly de Ruffle…", upToDate: "La última nightly ({version}) ya está instalada.", updated: "Se ha instalado la nightly {version} de Ruffle.", switched: "Los juegos que abras a partir de ahora usarán Ruffle {version}.",
  },
  fr: {
    channel: "Version de Ruffle", stable: "Stable · v{version}", nightly: "Nightly · {version}", notDownloaded: "pas encore téléchargée",
    hint: "Les compilations nightly sont plus récentes et peuvent exécuter davantage de jeux, mais ont été moins testées. Elles sont téléchargées lorsque vous les sélectionnez. Le changement concerne les jeux ouverts par la suite.",
    update: "Actualiser la nightly", downloading: "Téléchargement de la nightly de Ruffle…", upToDate: "La dernière nightly ({version}) est déjà installée.", updated: "La nightly {version} de Ruffle a été installée.", switched: "Les jeux ouverts à partir de maintenant utiliseront Ruffle {version}.",
  },
  de: {
    channel: "Ruffle-Version", stable: "Stabile Version · v{version}", nightly: "Nightly · {version}", notDownloaded: "noch nicht heruntergeladen",
    hint: "Nightly-Builds sind aktueller und können möglicherweise mehr Spiele ausführen, wurden aber weniger getestet. Der Download erfolgt bei der Auswahl. Die Änderung betrifft Spiele, die du anschließend öffnest.",
    update: "Nightly updaten", downloading: "Ruffle-Nightly wird heruntergeladen…", upToDate: "Die aktuellste Nightly ({version}) ist schon installiert.", updated: "Ruffle-Nightly {version} wurde installiert.", switched: "Ab jetzt geöffnete Spiele nutzen Ruffle {version}.",
  },
  "pt-BR": {
    channel: "Versão do Ruffle", stable: "Estável · v{version}", nightly: "Nightly · {version}", notDownloaded: "ainda não baixada",
    hint: "As compilações nightly são mais recentes e podem executar mais jogos, mas passaram por menos testes. O download ocorre ao selecioná-las. A alteração se aplica aos jogos abertos a partir daí.",
    update: "Atualizar a nightly", downloading: "Baixando a nightly do Ruffle…", upToDate: "A última nightly ({version}) já está instalada.", updated: "A nightly {version} do Ruffle foi instalada.", switched: "Os jogos abertos a partir de agora usarão o Ruffle {version}.",
  },
  ja: {
    channel: "Ruffle バージョン", stable: "安定版 · v{version}", nightly: "ナイトリー版 · {version}", notDownloaded: "まだダウンロードされていません",
    hint: "ナイトリービルドはより新しく、動くゲームが増える可能性がありますが、テストは十分ではありません。選択するとダウンロードされます。変更は、それ以降に開くゲームに反映されます。",
    update: "ナイトリー版を更新", downloading: "Ruffle ナイトリー版をダウンロードしています…", upToDate: "最新のナイトリー版（{version}）はすでにインストールされています。", updated: "Ruffle ナイトリー版 {version} のインストールが完了しました。", switched: "これから開くゲームでは Ruffle {version} を使用します。",
  },
  ko: {
    channel: "Ruffle 버전", stable: "안정 버전 · v{version}", nightly: "나이틀리 버전 · {version}", notDownloaded: "아직 다운로드하지 않음",
    hint: "나이틀리 빌드는 더 최근에 만들어져 더 많은 게임이 실행될 수 있지만 검증이 덜 되어 있습니다. 선택하면 다운로드되며, 그 이후에 여는 게임부터 변경 내용이 적용됩니다.",
    update: "나이틀리 버전 업데이트", downloading: "Ruffle 나이틀리 버전을 다운로드하고 있습니다…", upToDate: "가장 최근 나이틀리 버전({version})이 이미 설치되어 있습니다.", updated: "Ruffle 나이틀리 버전 {version} 설치를 완료했습니다.", switched: "이제부터 여는 게임에는 Ruffle {version}이(가) 사용됩니다.",
  },
  hi: {
    channel: "Ruffle का संस्करण", stable: "स्थिर संस्करण · v{version}", nightly: "नाइटली संस्करण · {version}", notDownloaded: "अभी डाउनलोड नहीं किया गया",
    hint: "नाइटली बिल्ड ज़्यादा नए होते हैं और अधिक गेम चला सकते हैं, पर उनका परीक्षण कम हुआ होता है। उन्हें चुनने पर डाउनलोड किया जाता है। बदलाव उसके बाद खोले जाने वाले गेम पर लागू होगा।",
    update: "नाइटली संस्करण अपडेट करें", downloading: "Ruffle का नाइटली संस्करण डाउनलोड किया जा रहा है…", upToDate: "नवीनतम नाइटली संस्करण ({version}) पहले से इंस्टॉल है।", updated: "Ruffle का नाइटली संस्करण {version} इंस्टॉल कर दिया गया।", switched: "अब खोले जाने वाले गेम Ruffle {version} इस्तेमाल करेंगे।",
  },
  ar: {
    channel: "إصدار Ruffle", stable: "الإصدار المستقر · v{version}", nightly: "الإصدار الليلي · {version}", notDownloaded: "لم يُنزّل بعد",
    hint: "البُنى الليلية أحدث وقد تتمكن من تشغيل المزيد من الألعاب، لكنها خضعت لاختبارات أقل. تُنزّل عند اختيارها، ويسري التغيير على الألعاب التي تفتحها بعد ذلك.",
    update: "تحديث النسخة الليلية", downloading: "يجري تنزيل النسخة الليلية من Ruffle…", upToDate: "النسخة الليلية الأحدث ({version}) مثبّتة مسبقًا.", updated: "اكتمل تثبيت النسخة الليلية {version} من Ruffle.", switched: "الألعاب التي تفتحها من الآن ستستخدم Ruffle {version}.",
  },
  ru: {
    channel: "Версия Ruffle", stable: "Стабильный выпуск · v{version}", nightly: "Ночная сборка · {version}", notDownloaded: "ещё не скачана",
    hint: "Ночные сборки новее и могут поддерживать больше игр, но проходят меньше проверок. Загрузка начинается при их выборе. Изменение действует на игры, открытые после этого.",
    update: "Обновить ночную сборку", downloading: "Скачивается ночная сборка Ruffle…", upToDate: "Последняя ночная сборка ({version}) уже установлена.", updated: "Установлена ночная сборка Ruffle {version}.", switched: "Игры, открытые с этого момента, будут использовать Ruffle {version}.",
  },
};

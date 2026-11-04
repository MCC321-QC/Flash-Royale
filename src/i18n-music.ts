import type { Language } from "./i18n";

type MusicText = {
  title: string; enable: string; hint: string; browse: string; testing: string; saved: string;
  setup: string; python: string; install: string; locate: string; ffmpeg: string; finish: string; documentation: string;
};

type AuditText = {
  check: string; checking: string; normalize: string; normalizing: string; hint: string;
  normalized: string; needsNormalization: string; silent: string; error: string;
  empty: string; results: string; limit: string;
};

export const musicAuditLabels: Record<Language, AuditText> = {
  en: {
    check: "Check library music", checking: "Checking library music...", normalize: "Normalize tracks that need it",
    normalizing: "Normalizing library music...", normalized: "Normalized", needsNormalization: "Needs normalization",
    silent: "Silent", error: "Could not check", empty: "No saved library music to check", results: "Track results",
    limit: "Showing the first 100 results. Counts cover every track.",
    hint: "Save both executable paths to check all saved library music, even with automatic normalization off. Checking does not change files. The target is -23 LUFS (±0.5 LU), with peaks at or below -1.9 dBTP.",
  },
  fr: {
    check: "Vérifier les musiques de la bibliothèque", checking: "Vérification des musiques...", normalize: "Normaliser les pistes qui en ont besoin",
    normalizing: "Normalisation des musiques...", normalized: "Normalisées", needsNormalization: "À normaliser",
    silent: "Silencieuses", error: "Vérification impossible", empty: "Aucune musique enregistrée à vérifier", results: "Résultats par piste",
    limit: "Affichage des 100 premiers résultats. Les totaux couvrent toutes les pistes.",
    hint: "Enregistrez les deux chemins pour vérifier toutes les musiques enregistrées, même si la normalisation automatique est désactivée. La vérification ne modifie aucun fichier. La cible est -23 LUFS (±0,5 LU), avec des crêtes au maximum à -1,9 dBTP.",
  },
  zh: {
    check: "检查游戏库音乐", checking: "正在检查游戏库音乐...", normalize: "标准化需要处理的曲目",
    normalizing: "正在标准化游戏库音乐...", normalized: "已标准化", needsNormalization: "需要标准化",
    silent: "静音", error: "无法检查", empty: "没有可检查的已保存音乐", results: "曲目结果",
    limit: "显示前 100 个结果。统计包含所有曲目。",
    hint: "保存两个可执行文件的路径后，即使自动标准化关闭，也可检查游戏库中所有已保存的音乐。检查不会修改文件。目标为 -23 LUFS（±0.5 LU），峰值不高于 -1.9 dBTP。",
  },
  es: {
    check: "Comprobar música de la biblioteca", checking: "Comprobando música...", normalize: "Normalizar las pistas que lo necesiten",
    normalizing: "Normalizando música...", normalized: "Normalizadas", needsNormalization: "Necesitan normalización",
    silent: "Silenciosas", error: "No se pudo comprobar", empty: "No hay música guardada para comprobar", results: "Resultados por pista",
    limit: "Se muestran los primeros 100 resultados. Los totales incluyen todas las pistas.",
    hint: "Guarda las rutas de ambos ejecutables para comprobar toda la música guardada, incluso con la normalización automática desactivada. La comprobación no cambia archivos. El objetivo es -23 LUFS (±0,5 LU), con picos de hasta -1,9 dBTP.",
  },
  de: {
    check: "Bibliotheksmusik prüfen", checking: "Musik wird geprüft...", normalize: "Betroffene Titel normalisieren",
    normalizing: "Musik wird normalisiert...", normalized: "Normalisiert", needsNormalization: "Normalisierung erforderlich",
    silent: "Stumm", error: "Prüfung fehlgeschlagen", empty: "Keine gespeicherte Musik zum Prüfen", results: "Ergebnisse pro Titel",
    limit: "Die ersten 100 Ergebnisse werden angezeigt. Die Zählung umfasst alle Titel.",
    hint: "Speichere beide Programmpfade, um alle gespeicherten Titel zu prüfen, auch bei deaktivierter automatischer Normalisierung. Die Prüfung verändert keine Dateien. Ziel sind -23 LUFS (±0,5 LU) mit Spitzen bis -1,9 dBTP.",
  },
  "pt-BR": {
    check: "Verificar músicas da biblioteca", checking: "Verificando músicas...", normalize: "Normalizar faixas que precisam",
    normalizing: "Normalizando músicas...", normalized: "Normalizadas", needsNormalization: "Precisam de normalização",
    silent: "Silenciosas", error: "Não foi possível verificar", empty: "Nenhuma música salva para verificar", results: "Resultados por faixa",
    limit: "Exibindo os primeiros 100 resultados. As contagens incluem todas as faixas.",
    hint: "Salve os caminhos dos dois executáveis para verificar todas as músicas salvas, mesmo com a normalização automática desativada. A verificação não altera arquivos. O alvo é -23 LUFS (±0,5 LU), com picos até -1,9 dBTP.",
  },
  ja: {
    check: "ライブラリーの音楽を確認", checking: "音楽を確認中...", normalize: "必要な曲を正規化",
    normalizing: "音楽を正規化中...", normalized: "正規化済み", needsNormalization: "正規化が必要",
    silent: "無音", error: "確認できませんでした", empty: "確認する保存済み音楽がありません", results: "曲ごとの結果",
    limit: "最初の100件を表示します。集計にはすべての曲が含まれます。",
    hint: "両方の実行ファイルのパスを保存すると、自動正規化が無効でも保存済みの音楽をすべて確認できます。確認ではファイルを変更しません。目標は -23 LUFS（±0.5 LU）、ピークは -1.9 dBTP 以下です。",
  },
  ko: {
    check: "라이브러리 음악 확인", checking: "음악 확인 중...", normalize: "필요한 곡 정규화",
    normalizing: "음악 정규화 중...", normalized: "정규화됨", needsNormalization: "정규화 필요",
    silent: "무음", error: "확인할 수 없음", empty: "확인할 저장된 음악이 없습니다", results: "곡별 결과",
    limit: "처음 100개 결과를 표시합니다. 집계에는 모든 곡이 포함됩니다.",
    hint: "두 실행 파일 경로를 저장하면 자동 정규화가 꺼져 있어도 저장된 모든 음악을 확인할 수 있습니다. 확인은 파일을 변경하지 않습니다. 목표는 -23 LUFS(±0.5 LU), 피크는 -1.9 dBTP 이하입니다.",
  },
  hi: {
    check: "लाइब्रेरी संगीत जाँचें", checking: "संगीत जाँचा जा रहा है...", normalize: "ज़रूरी ट्रैक सामान्य करें",
    normalizing: "संगीत सामान्य किया जा रहा है...", normalized: "सामान्य", needsNormalization: "सामान्यीकरण ज़रूरी",
    silent: "मौन", error: "जाँच नहीं हो सकी", empty: "जाँचने के लिए सहेजा हुआ संगीत नहीं है", results: "ट्रैक परिणाम",
    limit: "पहले 100 परिणाम दिखाए जा रहे हैं। गणना में सभी ट्रैक शामिल हैं।",
    hint: "दोनों निष्पादन फ़ाइलों के पथ सहेजें ताकि स्वचालित सामान्यीकरण बंद होने पर भी सभी सहेजे गए गाने जाँचे जा सकें। जाँच फ़ाइलें नहीं बदलती। लक्ष्य -23 LUFS (±0.5 LU) और अधिकतम पीक -1.9 dBTP है।",
  },
  ar: {
    check: "فحص موسيقى المكتبة", checking: "جارٍ فحص الموسيقى...", normalize: "تسوية المقاطع التي تحتاج لذلك",
    normalizing: "جارٍ تسوية الموسيقى...", normalized: "مُسوّاة", needsNormalization: "تحتاج إلى تسوية",
    silent: "صامتة", error: "تعذر الفحص", empty: "لا توجد موسيقى محفوظة لفحصها", results: "نتائج المقاطع",
    limit: "تُعرض أول 100 نتيجة. تشمل الأعداد جميع المقاطع.",
    hint: "احفظ مساري الملفين التنفيذيين لفحص كل الموسيقى المحفوظة حتى عند تعطيل التسوية التلقائية. لا يغيّر الفحص الملفات. الهدف هو -23 LUFS (±0.5 LU)، مع قمم لا تتجاوز -1.9 dBTP.",
  },
  ru: {
    check: "Проверить музыку библиотеки", checking: "Проверка музыки...", normalize: "Нормализовать нужные треки",
    normalizing: "Нормализация музыки...", normalized: "Нормализованы", needsNormalization: "Требуют нормализации",
    silent: "Тишина", error: "Не удалось проверить", empty: "Нет сохранённой музыки для проверки", results: "Результаты по трекам",
    limit: "Показаны первые 100 результатов. Счётчики учитывают все треки.",
    hint: "Сохраните пути обоих исполняемых файлов, чтобы проверить всю сохранённую музыку даже при отключённой автоматической нормализации. Проверка не меняет файлы. Цель — -23 LUFS (±0,5 LU), пики не выше -1,9 dBTP.",
  },
};

export const musicNormalizationLabels: Record<Language, MusicText> = {
  en: {
    title: "Music normalization", enable: "Normalize newly added music", browse: "Browse", testing: "Checking tools...", saved: "Settings saved",
    hint: "Use your own ffmpeg-normalize and FFmpeg to balance newly extracted SWF/DCR music and custom songs at -23 LUFS.",
    setup: "How to install and configure", python: "Install Python from the official website.",
    install: "In PowerShell, install ffmpeg-normalize:",
    locate: "Find your Python user folder with the command below, then locate ffmpeg-normalize.exe in its Python3xx\\Scripts subfolder:",
    ffmpeg: "Download a Windows FFmpeg build from the official download page and extract it.",
    finish: "Browse above to ffmpeg-normalize.exe and the extracted bin\\ffmpeg.exe. Enable normalization and save to check both tools. If you move the tools, update these paths. Disable the option and save to stop normalization.",
    documentation: "ffmpeg-normalize installation documentation",
  },
  fr: {
    title: "Normalisation musicale", enable: "Normaliser les nouvelles musiques", browse: "Parcourir", testing: "Vérification des outils...", saved: "Paramètres enregistrés",
    hint: "Utilise vos propres ffmpeg-normalize et FFmpeg pour équilibrer les musiques extraites des SWF/DCR et les morceaux ajoutés à -23 LUFS.",
    setup: "Installation et configuration", python: "Installez Python depuis son site officiel.",
    install: "Dans PowerShell, installez ffmpeg-normalize :",
    locate: "Trouvez votre dossier utilisateur Python avec la commande ci-dessous, puis ffmpeg-normalize.exe dans son sous-dossier Python3xx\\Scripts :",
    ffmpeg: "Téléchargez une version Windows de FFmpeg depuis la page officielle et décompressez-la.",
    finish: "Sélectionnez ci-dessus ffmpeg-normalize.exe et le fichier extrait bin\\ffmpeg.exe. Activez la normalisation et enregistrez pour vérifier les deux outils. Mettez ces chemins à jour si vous déplacez les outils. Désactivez l’option et enregistrez pour arrêter la normalisation.",
    documentation: "Documentation d’installation de ffmpeg-normalize",
  },
  zh: {
    title: "音乐响度标准化", enable: "标准化新添加的音乐", browse: "浏览", testing: "正在检查工具...", saved: "设置已保存",
    hint: "使用你提供的 ffmpeg-normalize 和 FFmpeg，将新提取的 SWF/DCR 音乐及自定义歌曲调整至 -23 LUFS。",
    setup: "安装与配置方法", python: "从官方网站安装 Python。",
    install: "在 PowerShell 中安装 ffmpeg-normalize：",
    locate: "使用以下命令查找 Python 用户文件夹，然后在其 Python3xx\\Scripts 子文件夹中找到 ffmpeg-normalize.exe：",
    ffmpeg: "从官方下载页面下载 Windows 版 FFmpeg 并解压。",
    finish: "在上方选择 ffmpeg-normalize.exe 和解压后的 bin\\ffmpeg.exe。启用标准化并保存以检查这两个工具。如果移动了工具，请更新路径。关闭选项并保存即可停止标准化。",
    documentation: "ffmpeg-normalize 安装文档",
  },
  es: {
    title: "Normalización de música", enable: "Normalizar la música nueva", browse: "Examinar", testing: "Comprobando herramientas...", saved: "Ajustes guardados",
    hint: "Usa tus propias herramientas ffmpeg-normalize y FFmpeg para equilibrar la música recién extraída de SWF/DCR y las canciones añadidas a -23 LUFS.",
    setup: "Cómo instalar y configurar", python: "Instala Python desde su sitio oficial.",
    install: "En PowerShell, instala ffmpeg-normalize:",
    locate: "Busca tu carpeta de usuario de Python con este comando y localiza ffmpeg-normalize.exe en su subcarpeta Python3xx\\Scripts:",
    ffmpeg: "Descarga una compilación de FFmpeg para Windows desde la página oficial y extráela.",
    finish: "Selecciona arriba ffmpeg-normalize.exe y el archivo extraído bin\\ffmpeg.exe. Activa la normalización y guarda para comprobar ambas herramientas. Actualiza las rutas si las mueves. Desactiva la opción y guarda para detener la normalización.",
    documentation: "Documentación de instalación de ffmpeg-normalize",
  },
  de: {
    title: "Musiknormalisierung", enable: "Neu hinzugefügte Musik normalisieren", browse: "Durchsuchen", testing: "Werkzeuge werden geprüft...", saved: "Einstellungen gespeichert",
    hint: "Verwendet deine eigenen Programme ffmpeg-normalize und FFmpeg, um neu extrahierte SWF/DCR-Musik und hinzugefügte Titel auf -23 LUFS anzugleichen.",
    setup: "Installation und Einrichtung", python: "Installiere Python von der offiziellen Website.",
    install: "Installiere ffmpeg-normalize in PowerShell:",
    locate: "Ermittle mit diesem Befehl deinen Python-Benutzerordner und suche ffmpeg-normalize.exe in dessen Unterordner Python3xx\\Scripts:",
    ffmpeg: "Lade eine Windows-Version von FFmpeg über die offizielle Downloadseite herunter und entpacke sie.",
    finish: "Wähle oben ffmpeg-normalize.exe und die entpackte bin\\ffmpeg.exe. Aktiviere die Normalisierung und speichere, um beide Werkzeuge zu prüfen. Aktualisiere die Pfade, wenn du die Werkzeuge verschiebst. Deaktiviere die Option und speichere, um die Normalisierung zu beenden.",
    documentation: "Installationsanleitung für ffmpeg-normalize",
  },
  "pt-BR": {
    title: "Normalização de música", enable: "Normalizar novas músicas", browse: "Procurar", testing: "Verificando ferramentas...", saved: "Configurações salvas",
    hint: "Usa seus próprios ffmpeg-normalize e FFmpeg para equilibrar músicas recém-extraídas de SWF/DCR e músicas adicionadas em -23 LUFS.",
    setup: "Como instalar e configurar", python: "Instale o Python pelo site oficial.",
    install: "No PowerShell, instale o ffmpeg-normalize:",
    locate: "Encontre sua pasta de usuário do Python com este comando e localize ffmpeg-normalize.exe na subpasta Python3xx\\Scripts:",
    ffmpeg: "Baixe uma versão do FFmpeg para Windows pela página oficial e extraia.",
    finish: "Selecione acima ffmpeg-normalize.exe e o arquivo extraído bin\\ffmpeg.exe. Ative a normalização e salve para verificar as duas ferramentas. Atualize os caminhos se mover as ferramentas. Desative a opção e salve para interromper a normalização.",
    documentation: "Documentação de instalação do ffmpeg-normalize",
  },
  ja: {
    title: "音楽の正規化", enable: "新しく追加する音楽を正規化", browse: "参照", testing: "ツールを確認中...", saved: "設定を保存しました",
    hint: "自分で用意した ffmpeg-normalize と FFmpeg を使い、新しく抽出した SWF/DCR 音楽や追加した曲を -23 LUFS に調整します。",
    setup: "インストールと設定方法", python: "公式サイトから Python をインストールします。",
    install: "PowerShell で ffmpeg-normalize をインストールします：",
    locate: "次のコマンドで Python ユーザーフォルダーを調べ、その Python3xx\\Scripts サブフォルダーで ffmpeg-normalize.exe を探します：",
    ffmpeg: "公式ダウンロードページから Windows 版 FFmpeg を入手して展開します。",
    finish: "上で ffmpeg-normalize.exe と展開した bin\\ffmpeg.exe を選びます。正規化を有効にして保存すると、両ツールを確認します。ツールを移動した場合はパスを更新してください。無効にして保存すると正規化を停止します。",
    documentation: "ffmpeg-normalize のインストールガイド",
  },
  ko: {
    title: "음악 정규화", enable: "새로 추가하는 음악 정규화", browse: "찾아보기", testing: "도구 확인 중...", saved: "설정 저장됨",
    hint: "직접 제공한 ffmpeg-normalize와 FFmpeg로 새로 추출한 SWF/DCR 음악과 추가한 곡을 -23 LUFS로 조정합니다.",
    setup: "설치 및 설정 방법", python: "공식 웹사이트에서 Python을 설치하세요.",
    install: "PowerShell에서 ffmpeg-normalize를 설치하세요:",
    locate: "다음 명령으로 Python 사용자 폴더를 찾고 그 안의 Python3xx\\Scripts 하위 폴더에서 ffmpeg-normalize.exe를 찾으세요:",
    ffmpeg: "공식 다운로드 페이지에서 Windows용 FFmpeg를 내려받고 압축을 푸세요.",
    finish: "위에서 ffmpeg-normalize.exe와 압축을 푼 bin\\ffmpeg.exe를 선택하세요. 정규화를 켜고 저장하면 두 도구를 확인합니다. 도구를 옮기면 경로를 갱신하세요. 옵션을 끄고 저장하면 정규화를 중단합니다.",
    documentation: "ffmpeg-normalize 설치 문서",
  },
  hi: {
    title: "संगीत सामान्यीकरण", enable: "नया जोड़ा गया संगीत सामान्य करें", browse: "ब्राउज़ करें", testing: "टूल जाँचे जा रहे हैं...", saved: "सेटिंग सहेजी गई",
    hint: "अपने ffmpeg-normalize और FFmpeg से नया निकाला गया SWF/DCR संगीत और जोड़े गए गाने -23 LUFS पर संतुलित करें।",
    setup: "इंस्टॉल और कॉन्फ़िगर करने का तरीका", python: "आधिकारिक वेबसाइट से Python इंस्टॉल करें।",
    install: "PowerShell में ffmpeg-normalize इंस्टॉल करें:",
    locate: "इस कमांड से Python उपयोगकर्ता फ़ोल्डर ढूँढें, फिर उसके Python3xx\\Scripts सबफ़ोल्डर में ffmpeg-normalize.exe ढूँढें:",
    ffmpeg: "आधिकारिक डाउनलोड पेज से Windows के लिए FFmpeg डाउनलोड करके निकालें।",
    finish: "ऊपर ffmpeg-normalize.exe और निकाली गई bin\\ffmpeg.exe चुनें। सामान्यीकरण चालू करके सहेजें ताकि दोनों टूल जाँचे जाएँ। टूल ले जाने पर पथ बदलें। सामान्यीकरण रोकने के लिए विकल्प बंद करके सहेजें।",
    documentation: "ffmpeg-normalize इंस्टॉलेशन दस्तावेज़",
  },
  ar: {
    title: "تسوية مستوى الموسيقى", enable: "تسوية الموسيقى المضافة حديثًا", browse: "استعراض", testing: "جارٍ فحص الأدوات...", saved: "تم حفظ الإعدادات",
    hint: "استخدم نسختيك من ffmpeg-normalize وFFmpeg لموازنة موسيقى SWF/DCR المستخرجة حديثًا والأغاني المضافة عند -23 LUFS.",
    setup: "طريقة التثبيت والإعداد", python: "ثبّت Python من موقعه الرسمي.",
    install: "ثبّت ffmpeg-normalize في PowerShell:",
    locate: "اعثر على مجلد مستخدم Python بهذا الأمر، ثم ابحث عن ffmpeg-normalize.exe داخل المجلد الفرعي Python3xx\\Scripts:",
    ffmpeg: "نزّل إصدار FFmpeg لنظام Windows من صفحة التنزيل الرسمية وفك ضغطه.",
    finish: "اختر أعلاه ffmpeg-normalize.exe وملف bin\\ffmpeg.exe المستخرج. فعّل التسوية واحفظ لفحص الأداتين. حدّث المسارات إذا نقلت الأدوات. عطّل الخيار واحفظ لإيقاف التسوية.",
    documentation: "وثائق تثبيت ffmpeg-normalize",
  },
  ru: {
    title: "Нормализация музыки", enable: "Нормализовать новую музыку", browse: "Обзор", testing: "Проверка инструментов...", saved: "Настройки сохранены",
    hint: "Использует ваши ffmpeg-normalize и FFmpeg для выравнивания новой музыки из SWF/DCR и добавленных песен до -23 LUFS.",
    setup: "Установка и настройка", python: "Установите Python с официального сайта.",
    install: "В PowerShell установите ffmpeg-normalize:",
    locate: "Найдите пользовательскую папку Python этой командой, затем ffmpeg-normalize.exe в её подпапке Python3xx\\Scripts:",
    ffmpeg: "Скачайте сборку FFmpeg для Windows с официальной страницы и распакуйте её.",
    finish: "Выберите выше ffmpeg-normalize.exe и распакованный bin\\ffmpeg.exe. Включите нормализацию и сохраните, чтобы проверить оба инструмента. При перемещении инструментов обновите пути. Отключите опцию и сохраните, чтобы остановить нормализацию.",
    documentation: "Документация по установке ffmpeg-normalize",
  },
};
export const musicBackupLabels: Record<Language, {
  title: string; hint: string; empty: string; total: string; restore: string; remove: string; confirmDelete: string; refresh: string;
}> = {
  en: { title: "Original music backups", hint: "One original is kept per song before normalization. Restore keeps the backup. Deleting a backup is permanent.", empty: "No music backups.", total: "Total backup size: {size}", restore: "Restore original", remove: "Delete backup", confirmDelete: "Click again to delete", refresh: "Refresh backups" },
  zh: { title: "原始音乐备份", hint: "每首歌曲在标准化前保留一份原始备份。恢复后备份仍会保留。删除备份无法撤销。", empty: "没有音乐备份。", total: "备份总大小：{size}", restore: "恢复原始音乐", remove: "删除备份", confirmDelete: "再次点击以删除", refresh: "刷新备份" },
  es: { title: "Copias de música original", hint: "Se guarda un original por canción antes de normalizar. Restaurar conserva la copia. Eliminarla es permanente.", empty: "No hay copias de música.", total: "Tamaño total de las copias: {size}", restore: "Restaurar original", remove: "Eliminar copia", confirmDelete: "Haz clic de nuevo para eliminar", refresh: "Actualizar copias" },
  fr: { title: "Sauvegardes des musiques originales", hint: "Un original est conservé par morceau avant normalisation. La restauration garde la sauvegarde. Sa suppression est définitive.", empty: "Aucune sauvegarde de musique.", total: "Taille totale des sauvegardes : {size}", restore: "Restaurer l'original", remove: "Supprimer la sauvegarde", confirmDelete: "Cliquez à nouveau pour supprimer", refresh: "Actualiser les sauvegardes" },
  de: { title: "Original-Musiksicherungen", hint: "Vor der Normalisierung wird ein Original pro Titel gesichert. Wiederherstellen behält die Sicherung. Löschen ist endgültig.", empty: "Keine Musiksicherungen.", total: "Gesamtgröße der Sicherungen: {size}", restore: "Original wiederherstellen", remove: "Sicherung löschen", confirmDelete: "Zum Löschen erneut klicken", refresh: "Sicherungen aktualisieren" },
  "pt-BR": { title: "Backups das músicas originais", hint: "Um original é salvo por música antes da normalização. Restaurar mantém o backup. A exclusão é permanente.", empty: "Nenhum backup de música.", total: "Tamanho total dos backups: {size}", restore: "Restaurar original", remove: "Excluir backup", confirmDelete: "Clique novamente para excluir", refresh: "Atualizar backups" },
  ja: { title: "元の音楽のバックアップ", hint: "正規化前に各曲のオリジナルを1つ保存します。復元後もバックアップは残ります。削除は取り消せません。", empty: "音楽のバックアップはありません。", total: "バックアップの合計サイズ：{size}", restore: "元の音楽を復元", remove: "バックアップを削除", confirmDelete: "もう一度クリックして削除", refresh: "バックアップを更新" },
  ko: { title: "원본 음악 백업", hint: "정규화 전에 곡마다 원본 하나를 보관합니다. 복원해도 백업은 유지됩니다. 삭제는 되돌릴 수 없습니다.", empty: "음악 백업이 없습니다.", total: "전체 백업 크기: {size}", restore: "원본 복원", remove: "백업 삭제", confirmDelete: "다시 클릭하여 삭제", refresh: "백업 새로 고침" },
  hi: { title: "मूल संगीत बैकअप", hint: "सामान्यीकरण से पहले हर गीत का एक मूल बैकअप रखा जाता है। बहाल करने पर बैकअप बना रहता है। हटाना स्थायी है।", empty: "कोई संगीत बैकअप नहीं।", total: "कुल बैकअप आकार: {size}", restore: "मूल बहाल करें", remove: "बैकअप हटाएँ", confirmDelete: "हटाने के लिए फिर क्लिक करें", refresh: "बैकअप ताज़ा करें" },
  ar: { title: "نسخ الموسيقى الأصلية", hint: "تُحفظ نسخة أصلية لكل مقطع قبل توحيد مستوى الصوت. تحتفظ الاستعادة بالنسخة. حذفها نهائي.", empty: "لا توجد نسخ موسيقى احتياطية.", total: "الحجم الإجمالي للنسخ: {size}", restore: "استعادة الأصل", remove: "حذف النسخة", confirmDelete: "انقر مجدداً للحذف", refresh: "تحديث النسخ" },
  ru: { title: "Резервные копии исходной музыки", hint: "Перед нормализацией сохраняется один оригинал каждого трека. Восстановление сохраняет копию. Удаление необратимо.", empty: "Нет резервных копий музыки.", total: "Общий размер копий: {size}", restore: "Восстановить оригинал", remove: "Удалить копию", confirmDelete: "Нажмите ещё раз для удаления", refresh: "Обновить список копий" },
};
export const musicBackupPanelLabels: Record<Language, { manage: string; count: string; noMatches: string }> = {
  en: { manage: "Manage backups", count: "{count} backups", noMatches: "No matching backups." },
  fr: { manage: "Gérer les sauvegardes", count: "{count} sauvegardes", noMatches: "Aucune sauvegarde correspondante." },
  es: { manage: "Gestionar copias", count: "{count} copias", noMatches: "No hay copias coincidentes." },
  de: { manage: "Sicherungen verwalten", count: "{count} Sicherungen", noMatches: "Keine passenden Sicherungen." },
  "pt-BR": { manage: "Gerenciar backups", count: "{count} backups", noMatches: "Nenhum backup correspondente." },
  zh: { manage: "管理备份", count: "{count} 个备份", noMatches: "没有匹配的备份。" },
  ja: { manage: "バックアップを管理", count: "{count} 件のバックアップ", noMatches: "一致するバックアップはありません。" },
  ko: { manage: "백업 관리", count: "백업 {count}개", noMatches: "일치하는 백업이 없습니다." },
  hi: { manage: "बैकअप प्रबंधित करें", count: "{count} बैकअप", noMatches: "कोई मेल खाता बैकअप नहीं।" },
  ar: { manage: "إدارة النسخ الاحتياطية", count: "{count} نسخة احتياطية", noMatches: "لا توجد نسخ احتياطية مطابقة." },
  ru: { manage: "Управление копиями", count: "Резервных копий: {count}", noMatches: "Подходящих копий нет." },
};

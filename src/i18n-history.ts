import type { Language } from "./i18n";
import type { ActivityKind, ActivityStatus } from "./types";
import { defaultMusicLabels } from "./i18n-default-music";

export const backgroundLabels: Record<Language, string> = {
  en: "Continue in background", zh: "在后台继续", es: "Continuar en segundo plano",
  fr: "Continuer en arrière-plan", de: "Im Hintergrund fortsetzen", "pt-BR": "Continuar em segundo plano",
  ja: "バックグラウンドで続行", ko: "백그라운드에서 계속", hi: "पृष्ठभूमि में जारी रखें",
  ar: "المتابعة في الخلفية", ru: "Продолжить в фоне",
};

export interface HistoryLabels {
  title: string;
  openHint: string;
  filterAll: string;
  filterTasks: string;
  filterNotifications: string;
  clear: string;
  confirmClear: string;
  empty: string;
  emptyFilter: string;
  runningCount: string;
  entryCount: string;
  hide: string;
  cancel: string;
  working: string;
  downloading: string;
  preparing: string;
  status: Record<ActivityStatus, string>;
  kinds: Record<ActivityKind, string>;
  results: {
    tracksChecked: string;
    tracksNormalized: string;
    imported: string;
    skipped: string;
    gamesUpdated: string;
    noChanges: string;
    gamesChecked: string;
    restarting: string;
    installed: string;
    upToDate: string;
    gamesMoved: string;
    coversCreated: string;
    securityAlert: string;
    threat: string;
  };
}

export const historyLabels: Record<Language, HistoryLabels> = {
  en: {
    title: "Activity history", openHint: "Open the activity history", filterAll: "All", filterTasks: "Tasks", filterNotifications: "Notifications",
    clear: "Clear history", confirmClear: "Click again to clear", empty: "No activity yet.", emptyFilter: "Nothing to show for this filter.",
    runningCount: "{n} running", entryCount: "{n} entries", hide: "Hide", cancel: "Cancel", working: "Working…", downloading: "Downloading…", preparing: "Preparing…",
    status: { running: "In progress", done: "Done", failed: "Failed", cancelled: "Cancelled", interrupted: "Interrupted (app closed)", info: "Info", alert: "Alert" },
    kinds: {
      notice: "Notification", appUpdate: "Flash Royale update", ruffleNightly: "Ruffle nightly update", flashpointImport: "Flashpoint import",
      flashpointScan: "Flashpoint download check",
      musicImport: defaultMusicLabels.en.task, musicCheck: "Music loudness check", musicNormalize: "Music normalization",
      flashpointMetadata: "Metadata import", antivirusScan: "Antivirus scan", antivirusThreat: "Antivirus alert", localImport: "Game import",
      exploreImport: "Explore import", storageMigration: "Library storage update", metadataApply: "Metadata update", sourcesCheck: "Source definitions check",
      securityCheck: "Security check", securityAlert: "Security alert", coverCapture: "Cover creation", guideAdd: "Guide added", guideDownload: "Guide download",
    },
    results: {
      tracksChecked: "{n} track(s) checked", tracksNormalized: "{n} track(s) normalized",
      imported: "{n} imported", skipped: "{n} skipped", gamesUpdated: "{n} game(s) updated", noChanges: "No changes", gamesChecked: "{n} game(s) checked",
      restarting: "Restarting to finish the update", installed: "New version installed", upToDate: "Already up to date", gamesMoved: "{n} game(s) moved",
      coversCreated: "{n} cover(s) created", securityAlert: "Review it in Settings > Security", threat: "The game file was quarantined",
    },
  },
  zh: {
    title: "活动记录", openHint: "打开活动记录", filterAll: "全部", filterTasks: "任务", filterNotifications: "通知",
    clear: "清空记录", confirmClear: "再点击一次即可清空", empty: "暂无活动。", emptyFilter: "此筛选条件下没有可显示的内容。",
    runningCount: "{n} 项正在运行", entryCount: "{n} 条记录", hide: "隐藏", cancel: "取消", working: "正在处理…", downloading: "正在下载…", preparing: "正在准备…",
    status: { running: "进行中", done: "已完成", failed: "失败", cancelled: "已取消", interrupted: "已中断（应用已关闭）", info: "信息", alert: "警报" },
    kinds: {
      notice: "通知", appUpdate: "Flash Royale 更新", ruffleNightly: "Ruffle 每夜构建版更新", flashpointImport: "Flashpoint 导入",
      flashpointScan: "Flashpoint 下载检查",
      musicImport: defaultMusicLabels.zh.task, musicCheck: "音乐响度检查", musicNormalize: "音乐响度标准化",
      flashpointMetadata: "元数据导入", antivirusScan: "防病毒扫描", antivirusThreat: "防病毒警报", localImport: "游戏导入",
      exploreImport: "从探索导入", storageMigration: "游戏库存储更新", metadataApply: "元数据更新", sourcesCheck: "来源定义检查",
      securityCheck: "安全检查", securityAlert: "安全警报", coverCapture: "封面创建", guideAdd: "已添加指南", guideDownload: "指南下载",
    },
    results: {
      tracksChecked: "已检查 {n} 首曲目", tracksNormalized: "已标准化 {n} 首曲目",
      imported: "已导入 {n} 项", skipped: "已跳过 {n} 项", gamesUpdated: "已更新 {n} 个游戏", noChanges: "没有更改", gamesChecked: "已检查 {n} 个游戏",
      restarting: "正在重启以完成更新", installed: "已安装新版本", upToDate: "已是最新版本", gamesMoved: "已移动 {n} 个游戏",
      coversCreated: "已创建 {n} 张封面", securityAlert: "请前往“设置 > 安全”查看", threat: "游戏文件已被隔离",
    },
  },
  es: {
    title: "Historial de actividad", openHint: "Abrir el historial de actividad", filterAll: "Todo", filterTasks: "Tareas", filterNotifications: "Notificaciones",
    clear: "Vaciar historial", confirmClear: "Vuelve a hacer clic para vaciarlo", empty: "Aún no hay actividad.", emptyFilter: "No hay nada que mostrar con este filtro.",
    runningCount: "{n} en ejecución", entryCount: "{n} entradas", hide: "Ocultar", cancel: "Cancelar", working: "Procesando…", downloading: "Descargando…", preparing: "Preparando…",
    status: { running: "En curso", done: "Completado", failed: "Fallido", cancelled: "Cancelado", interrupted: "Interrumpido (aplicación cerrada)", info: "Información", alert: "Alerta" },
    kinds: {
      notice: "Notificación", appUpdate: "Actualización de Flash Royale", ruffleNightly: "Actualización de la compilación nocturna de Ruffle", flashpointImport: "Importación desde Flashpoint",
      flashpointScan: "Comprobación de descargas de Flashpoint",
      musicImport: defaultMusicLabels.es.task, musicCheck: "Comprobación de volumen musical", musicNormalize: "Normalización de música",
      flashpointMetadata: "Importación de metadatos", antivirusScan: "Análisis antivirus", antivirusThreat: "Alerta del antivirus", localImport: "Importación de juegos",
      exploreImport: "Importación desde Explorar", storageMigration: "Actualización del almacenamiento de la biblioteca", metadataApply: "Actualización de metadatos", sourcesCheck: "Comprobación de las definiciones de fuentes",
      securityCheck: "Comprobación de seguridad", securityAlert: "Alerta de seguridad", coverCapture: "Creación de portadas", guideAdd: "Guía añadida", guideDownload: "Descarga de una guía",
    },
    results: {
      tracksChecked: "{n} pista(s) comprobada(s)", tracksNormalized: "{n} pista(s) normalizada(s)",
      imported: "{n} importado(s)", skipped: "{n} omitido(s)", gamesUpdated: "{n} juego(s) actualizado(s)", noChanges: "Sin cambios", gamesChecked: "{n} juego(s) comprobado(s)",
      restarting: "Reiniciando para completar la actualización", installed: "Nueva versión instalada", upToDate: "Ya está al día", gamesMoved: "{n} juego(s) trasladado(s)",
      coversCreated: "{n} portada(s) creada(s)", securityAlert: "Revísala en Ajustes > Seguridad", threat: "El archivo del juego se ha puesto en cuarentena",
    },
  },
  fr: {
    title: "Historique des activités", openHint: "Ouvrir l’historique des activités", filterAll: "Tout", filterTasks: "Tâches", filterNotifications: "Notifications",
    clear: "Vider l’historique", confirmClear: "Cliquez une seconde fois pour vider", empty: "Aucune activité pour le moment.", emptyFilter: "Aucun élément à afficher avec ce filtre.",
    runningCount: "{n} en cours", entryCount: "{n} entrée(s)", hide: "Masquer", cancel: "Annuler", working: "Traitement…", downloading: "Téléchargement…", preparing: "Préparation…",
    status: { running: "En cours", done: "Terminé", failed: "Échec", cancelled: "Annulé", interrupted: "Interrompu (application fermée)", info: "Information", alert: "Alerte" },
    kinds: {
      notice: "Notification", appUpdate: "Mise à jour de Flash Royale", ruffleNightly: "Mise à jour de la version nightly de Ruffle", flashpointImport: "Importation depuis Flashpoint",
      flashpointScan: "Vérification des téléchargements Flashpoint",
      musicImport: defaultMusicLabels.fr.task, musicCheck: "Vérification du volume musical", musicNormalize: "Normalisation musicale",
      flashpointMetadata: "Importation de métadonnées", antivirusScan: "Analyse antivirus", antivirusThreat: "Alerte antivirus", localImport: "Importation de jeux",
      exploreImport: "Importation depuis Explorer", storageMigration: "Mise à jour du stockage de la bibliothèque", metadataApply: "Mise à jour des métadonnées", sourcesCheck: "Vérification des définitions des sources",
      securityCheck: "Contrôle de sécurité", securityAlert: "Alerte de sécurité", coverCapture: "Création de couvertures", guideAdd: "Guide ajouté", guideDownload: "Téléchargement d’un guide",
    },
    results: {
      tracksChecked: "{n} piste(s) vérifiée(s)", tracksNormalized: "{n} piste(s) normalisée(s)",
      imported: "{n} élément(s) importé(s)", skipped: "{n} élément(s) ignoré(s)", gamesUpdated: "{n} jeu(x) actualisé(s)", noChanges: "Aucune modification", gamesChecked: "{n} jeu(x) vérifié(s)",
      restarting: "Redémarrage pour terminer la mise à jour", installed: "Nouvelle version installée", upToDate: "Déjà à jour", gamesMoved: "{n} jeu(x) déplacé(s)",
      coversCreated: "{n} couverture(s) créée(s)", securityAlert: "À consulter dans Paramètres > Sécurité", threat: "Le fichier du jeu a été placé en quarantaine",
    },
  },
  de: {
    title: "Aktivitätsverlauf", openHint: "Aktivitätsverlauf öffnen", filterAll: "Alle", filterTasks: "Aufgaben", filterNotifications: "Benachrichtigungen",
    clear: "Verlauf leeren", confirmClear: "Zum Leeren nochmals klicken", empty: "Noch keine Aktivitäten vorhanden.", emptyFilter: "Für diesen Filter gibt es nichts anzuzeigen.",
    runningCount: "{n} laufen", entryCount: "{n} Einträge", hide: "Ausblenden", cancel: "Abbrechen", working: "Wird bearbeitet…", downloading: "Wird heruntergeladen…", preparing: "Wird vorbereitet…",
    status: { running: "In Bearbeitung", done: "Abgeschlossen", failed: "Fehlgeschlagen", cancelled: "Abgebrochen", interrupted: "Unterbrochen (App geschlossen)", info: "Information", alert: "Warnung" },
    kinds: {
      notice: "Benachrichtigung", appUpdate: "Flash Royale-Update", ruffleNightly: "Update der Ruffle-Nightly-Version", flashpointImport: "Import aus Flashpoint",
      flashpointScan: "Flashpoint-Downloads prüfen",
      musicImport: defaultMusicLabels.de.task, musicCheck: "Musiklautstärke prüfen", musicNormalize: "Musiknormalisierung",
      flashpointMetadata: "Metadatenimport", antivirusScan: "Virensuche", antivirusThreat: "Antivirus-Warnung", localImport: "Spieleimport",
      exploreImport: "Import aus Entdecken", storageMigration: "Aktualisierung des Bibliotheksspeichers", metadataApply: "Metadatenaktualisierung", sourcesCheck: "Prüfung der Quelldefinitionen",
      securityCheck: "Sicherheitsprüfung", securityAlert: "Sicherheitswarnung", coverCapture: "Cover-Erstellung", guideAdd: "Anleitung hinzugefügt", guideDownload: "Anleitungsdownload",
    },
    results: {
      imported: "{n} importiert", skipped: "{n} übersprungen", gamesUpdated: "{n} Spiel(e) aktualisiert", noChanges: "Keine Änderungen", gamesChecked: "{n} Spiel(e) geprüft",
      tracksChecked: "{n} Titel geprüft", tracksNormalized: "{n} Titel normalisiert",
      restarting: "Neustart zum Abschließen des Updates", installed: "Neue Version installiert", upToDate: "Bereits auf dem neuesten Stand", gamesMoved: "{n} Spiel(e) verschoben",
      coversCreated: "{n} Cover erstellt", securityAlert: "Unter Einstellungen > Sicherheit prüfen", threat: "Die Spieldatei wurde unter Quarantäne gestellt",
    },
  },
  "pt-BR": {
    title: "Histórico de atividades", openHint: "Abrir o histórico de atividades", filterAll: "Tudo", filterTasks: "Tarefas", filterNotifications: "Notificações",
    clear: "Limpar histórico", confirmClear: "Clique novamente para limpar", empty: "Ainda não há atividades.", emptyFilter: "Não há nada para exibir com este filtro.",
    runningCount: "{n} em execução", entryCount: "{n} registros", hide: "Ocultar", cancel: "Cancelar", working: "Processando…", downloading: "Baixando…", preparing: "Preparando…",
    status: { running: "Em andamento", done: "Concluído", failed: "Falhou", cancelled: "Cancelado", interrupted: "Interrompido (aplicativo fechado)", info: "Informação", alert: "Alerta" },
    kinds: {
      notice: "Notificação", appUpdate: "Atualização do Flash Royale", ruffleNightly: "Atualização da versão nightly do Ruffle", flashpointImport: "Importação do Flashpoint",
      flashpointScan: "Verificação de downloads do Flashpoint",
      musicImport: defaultMusicLabels["pt-BR"].task, musicCheck: "Verificação do volume musical", musicNormalize: "Normalização de música",
      flashpointMetadata: "Importação de metadados", antivirusScan: "Verificação antivírus", antivirusThreat: "Alerta do antivírus", localImport: "Importação de jogos",
      exploreImport: "Importação de Explorar", storageMigration: "Atualização do armazenamento da biblioteca", metadataApply: "Atualização de metadados", sourcesCheck: "Verificação das definições de fontes",
      securityCheck: "Verificação de segurança", securityAlert: "Alerta de segurança", coverCapture: "Criação de capas", guideAdd: "Guia adicionado", guideDownload: "Download de guia",
    },
    results: {
      imported: "{n} importado(s)", skipped: "{n} ignorado(s)", gamesUpdated: "{n} jogo(s) atualizado(s)", noChanges: "Nenhuma alteração", gamesChecked: "{n} jogo(s) verificado(s)",
      tracksChecked: "{n} faixa(s) verificada(s)", tracksNormalized: "{n} faixa(s) normalizada(s)",
      restarting: "Reiniciando para concluir a atualização", installed: "Nova versão instalada", upToDate: "Já está atualizado", gamesMoved: "{n} jogo(s) movido(s)",
      coversCreated: "{n} capa(s) criada(s)", securityAlert: "Confira em Configurações > Segurança", threat: "O arquivo do jogo foi colocado em quarentena",
    },
  },
  ja: {
    title: "アクティビティ履歴", openHint: "アクティビティ履歴を開く", filterAll: "すべて", filterTasks: "タスク", filterNotifications: "通知",
    clear: "履歴を消去", confirmClear: "もう一度クリックすると消去します", empty: "まだアクティビティはありません。", emptyFilter: "このフィルターで表示できる項目はありません。",
    runningCount: "{n} 件実行中", entryCount: "{n} 件の記録", hide: "非表示", cancel: "キャンセル", working: "処理しています…", downloading: "ダウンロードしています…", preparing: "準備しています…",
    status: { running: "進行中", done: "完了", failed: "失敗", cancelled: "キャンセル済み", interrupted: "中断（アプリ終了）", info: "情報", alert: "警告" },
    kinds: {
      notice: "通知", appUpdate: "Flash Royale の更新", ruffleNightly: "Ruffle nightly の更新", flashpointImport: "Flashpoint からのインポート",
      flashpointScan: "Flashpoint ダウンロード確認",
      musicImport: defaultMusicLabels.ja.task, musicCheck: "音楽の音量確認", musicNormalize: "音楽の正規化",
      flashpointMetadata: "メタデータのインポート", antivirusScan: "ウイルススキャン", antivirusThreat: "ウイルス対策の警告", localImport: "ゲームのインポート",
      exploreImport: "探索からのインポート", storageMigration: "ライブラリー保存先の更新", metadataApply: "メタデータの更新", sourcesCheck: "ソース定義の確認",
      securityCheck: "セキュリティチェック", securityAlert: "セキュリティ警告", coverCapture: "カバーの作成", guideAdd: "ガイドの追加", guideDownload: "ガイドのダウンロード",
    },
    results: {
      imported: "{n} 件インポート済み", skipped: "{n} 件スキップ", gamesUpdated: "ゲームを {n} 件更新", noChanges: "変更なし", gamesChecked: "ゲームを {n} 件確認",
      tracksChecked: "{n} 曲を確認", tracksNormalized: "{n} 曲を正規化",
      restarting: "更新を完了するため再起動しています", installed: "新しいバージョンをインストールしました", upToDate: "すでに最新です", gamesMoved: "ゲームを {n} 件移動",
      coversCreated: "カバーを {n} 枚作成", securityAlert: "「設定 > セキュリティ」で確認してください", threat: "ゲームファイルを隔離しました",
    },
  },
  ko: {
    title: "활동 기록", openHint: "활동 기록 열기", filterAll: "전체", filterTasks: "작업", filterNotifications: "알림",
    clear: "기록 비우기", confirmClear: "한 번 더 클릭하여 비우기", empty: "아직 활동 내역이 없습니다.", emptyFilter: "이 필터에 해당하는 내역이 없습니다.",
    runningCount: "{n}개 실행 중", entryCount: "기록 {n}개", hide: "숨기기", cancel: "취소", working: "처리 중…", downloading: "다운로드 중…", preparing: "준비 중…",
    status: { running: "진행 중", done: "완료", failed: "실패", cancelled: "취소됨", interrupted: "중단됨 (앱 종료)", info: "정보", alert: "경고" },
    kinds: {
      notice: "알림", appUpdate: "Flash Royale 업데이트", ruffleNightly: "Ruffle nightly 업데이트", flashpointImport: "Flashpoint에서 가져오기",
      flashpointScan: "Flashpoint 다운로드 확인",
      musicImport: defaultMusicLabels.ko.task, musicCheck: "음악 음량 확인", musicNormalize: "음악 정규화",
      flashpointMetadata: "메타데이터 가져오기", antivirusScan: "바이러스 검사", antivirusThreat: "바이러스 백신 경고", localImport: "게임 가져오기",
      exploreImport: "탐색에서 가져오기", storageMigration: "라이브러리 저장소 업데이트", metadataApply: "메타데이터 업데이트", sourcesCheck: "소스 정의 확인",
      securityCheck: "보안 점검", securityAlert: "보안 경고", coverCapture: "표지 생성", guideAdd: "가이드 추가됨", guideDownload: "가이드 다운로드",
    },
    results: {
      imported: "{n}개 가져옴", skipped: "{n}개 건너뜀", gamesUpdated: "게임 {n}개 업데이트됨", noChanges: "변경 사항 없음", gamesChecked: "게임 {n}개 확인됨",
      tracksChecked: "{n}곡 확인됨", tracksNormalized: "{n}곡 정규화됨",
      restarting: "업데이트를 마치기 위해 다시 시작하는 중", installed: "새 버전 설치됨", upToDate: "이미 최신 버전임", gamesMoved: "게임 {n}개 이동됨",
      coversCreated: "표지 {n}개 생성됨", securityAlert: "설정 > 보안에서 확인하세요", threat: "게임 파일이 격리되었습니다",
    },
  },
  hi: {
    title: "गतिविधि का इतिहास", openHint: "गतिविधि का इतिहास खोलें", filterAll: "सभी", filterTasks: "कार्य", filterNotifications: "सूचनाएँ",
    clear: "इतिहास साफ़ करें", confirmClear: "साफ़ करने के लिए दोबारा क्लिक करें", empty: "अभी कोई गतिविधि नहीं हुई है।", emptyFilter: "इस फ़िल्टर में दिखाने के लिए कुछ नहीं है।",
    runningCount: "{n} चल रहे हैं", entryCount: "{n} प्रविष्टियाँ", hide: "छिपाएँ", cancel: "रद्द करें", working: "काम चल रहा है…", downloading: "डाउनलोड हो रहा है…", preparing: "तैयारी हो रही है…",
    status: { running: "जारी है", done: "पूरा हुआ", failed: "विफल", cancelled: "रद्द हुआ", interrupted: "बीच में रुका (ऐप बंद हो गया)", info: "जानकारी", alert: "चेतावनी" },
    kinds: {
      notice: "सूचना", appUpdate: "Flash Royale अपडेट", ruffleNightly: "Ruffle nightly अपडेट", flashpointImport: "Flashpoint से आयात",
      flashpointScan: "Flashpoint डाउनलोड की जाँच",
      musicImport: defaultMusicLabels.hi.task, musicCheck: "संगीत ध्वनि स्तर की जाँच", musicNormalize: "संगीत सामान्यीकरण",
      flashpointMetadata: "मेटाडेटा आयात", antivirusScan: "एंटीवायरस जाँच", antivirusThreat: "एंटीवायरस चेतावनी", localImport: "गेम आयात",
      exploreImport: "खोज अनुभाग से आयात", storageMigration: "लाइब्रेरी स्टोरेज अपडेट", metadataApply: "मेटाडेटा अपडेट", sourcesCheck: "स्रोत परिभाषाओं की जाँच",
      securityCheck: "सुरक्षा जाँच", securityAlert: "सुरक्षा चेतावनी", coverCapture: "कवर बनाना", guideAdd: "गाइड जोड़ी गई", guideDownload: "गाइड डाउनलोड",
    },
    results: {
      imported: "{n} आयात हुए", skipped: "{n} छोड़े गए", gamesUpdated: "{n} गेम अपडेट हुए", noChanges: "कोई बदलाव नहीं", gamesChecked: "{n} गेम की जाँच हुई",
      tracksChecked: "{n} ट्रैक जाँचे गए", tracksNormalized: "{n} ट्रैक सामान्य किए गए",
      restarting: "अपडेट पूरा करने के लिए दोबारा शुरू हो रहा है", installed: "नया संस्करण इंस्टॉल हो गया", upToDate: "पहले से नवीनतम है", gamesMoved: "{n} गेम स्थानांतरित हुए",
      coversCreated: "{n} कवर बनाए गए", securityAlert: "सेटिंग > सुरक्षा में इसकी समीक्षा करें", threat: "गेम की फ़ाइल क्वारंटीन कर दी गई",
    },
  },
  ar: {
    title: "سجل النشاط", openHint: "فتح سجل النشاط", filterAll: "الكل", filterTasks: "المهام", filterNotifications: "الإشعارات",
    clear: "مسح السجل", confirmClear: "انقر مرة أخرى للمسح", empty: "لا يوجد نشاط بعد.", emptyFilter: "لا توجد عناصر لعرضها وفق هذا المرشّح.",
    runningCount: "{n} قيد التشغيل", entryCount: "{n} من السجلات", hide: "إخفاء", cancel: "إلغاء", working: "جارٍ العمل…", downloading: "جارٍ التنزيل…", preparing: "جارٍ التحضير…",
    status: { running: "قيد التنفيذ", done: "مكتمل", failed: "فشل", cancelled: "ملغى", interrupted: "توقف (أُغلق التطبيق)", info: "معلومة", alert: "تنبيه" },
    kinds: {
      notice: "إشعار", appUpdate: "تحديث Flash Royale", ruffleNightly: "تحديث الإصدار الليلي من Ruffle", flashpointImport: "استيراد من Flashpoint",
      flashpointScan: "فحص تنزيلات Flashpoint",
      musicImport: defaultMusicLabels.ar.task, musicCheck: "فحص مستوى صوت الموسيقى", musicNormalize: "تسوية مستوى الموسيقى",
      flashpointMetadata: "استيراد البيانات الوصفية", antivirusScan: "فحص مكافحة الفيروسات", antivirusThreat: "تنبيه مكافحة الفيروسات", localImport: "استيراد لعبة",
      exploreImport: "استيراد من الاستكشاف", storageMigration: "تحديث تخزين المكتبة", metadataApply: "تحديث البيانات الوصفية", sourcesCheck: "التحقق من تعريفات المصادر",
      securityCheck: "فحص الأمان", securityAlert: "تنبيه أمني", coverCapture: "إنشاء غلاف", guideAdd: "تمت إضافة دليل", guideDownload: "تنزيل دليل",
    },
    results: {
      imported: "تم استيراد {n}", skipped: "تم تخطي {n}", gamesUpdated: "تم تحديث {n} من الألعاب", noChanges: "لا تغييرات", gamesChecked: "تم فحص {n} من الألعاب",
      tracksChecked: "تم فحص {n} مقطع", tracksNormalized: "تمت تسوية {n} مقطع",
      restarting: "جارٍ إعادة التشغيل لإكمال التحديث", installed: "تم تثبيت الإصدار الجديد", upToDate: "محدّث بالفعل", gamesMoved: "تم نقل {n} من الألعاب",
      coversCreated: "تم إنشاء {n} من الأغلفة", securityAlert: "راجعه في الإعدادات > الأمان", threat: "وُضع ملف اللعبة في الحجر",
    },
  },
  ru: {
    title: "История действий", openHint: "Открыть историю действий", filterAll: "Всё", filterTasks: "Задачи", filterNotifications: "Уведомления",
    clear: "Очистить историю", confirmClear: "Нажмите ещё раз для очистки", empty: "Действий пока нет.", emptyFilter: "Для этого фильтра нечего показывать.",
    runningCount: "Выполняется: {n}", entryCount: "Записей: {n}", hide: "Скрыть", cancel: "Отменить", working: "Обработка…", downloading: "Скачивание…", preparing: "Подготовка…",
    status: { running: "Выполняется", done: "Завершено", failed: "Ошибка", cancelled: "Отменено", interrupted: "Прервано (приложение закрыто)", info: "Информация", alert: "Предупреждение" },
    kinds: {
      notice: "Уведомление", appUpdate: "Обновление Flash Royale", ruffleNightly: "Обновление ночной сборки Ruffle", flashpointImport: "Импорт из Flashpoint",
      flashpointScan: "Проверка загрузок Flashpoint",
      musicImport: defaultMusicLabels.ru.task, musicCheck: "Проверка громкости музыки", musicNormalize: "Нормализация музыки",
      flashpointMetadata: "Импорт метаданных", antivirusScan: "Антивирусная проверка", antivirusThreat: "Предупреждение антивируса", localImport: "Импорт игры",
      exploreImport: "Импорт из обзора", storageMigration: "Обновление хранилища библиотеки", metadataApply: "Обновление метаданных", sourcesCheck: "Проверка определений источников",
      securityCheck: "Проверка безопасности", securityAlert: "Предупреждение безопасности", coverCapture: "Создание обложки", guideAdd: "Добавленное руководство", guideDownload: "Скачивание руководства",
    },
    results: {
      imported: "Импортировано: {n}", skipped: "Пропущено: {n}", gamesUpdated: "Обновлено игр: {n}", noChanges: "Без изменений", gamesChecked: "Проверено игр: {n}",
      tracksChecked: "Проверено треков: {n}", tracksNormalized: "Нормализовано треков: {n}",
      restarting: "Перезапуск для завершения обновления", installed: "Новая версия установлена", upToDate: "Уже установлена последняя версия", gamesMoved: "Перемещено игр: {n}",
      coversCreated: "Создано обложек: {n}", securityAlert: "Просмотрите в разделе «Настройки > Безопасность»", threat: "Файл игры помещён в карантин",
    },
  },
};

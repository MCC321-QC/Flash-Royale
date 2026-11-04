import type { Language } from "./i18n";

export const musicImportSelectionLabels: Record<Language, string> = {
  en: "Choose which games to re-import default music for. Custom songs and game preferences are kept.",
  fr: "Choisissez les jeux dont la musique par défaut doit être réimportée. Les morceaux personnalisés et les préférences sont conservés.",
  zh: "选择要重新导入默认音乐的游戏。自定义歌曲和游戏偏好将保留。",
  es: "Elige los juegos cuya música predeterminada se volverá a importar. Se conservan las canciones personalizadas y las preferencias.",
  de: "Wähle die Spiele, deren Standardmusik erneut importiert werden soll. Eigene Titel und Spielpräferenzen bleiben erhalten.",
  "pt-BR": "Escolha os jogos para reimportar a música padrão. Músicas personalizadas e preferências são mantidas.",
  ja: "既定の音楽を再インポートするゲームを選んでください。カスタム曲とゲーム設定は保持されます。",
  ko: "기본 음악을 다시 가져올 게임을 선택하세요. 사용자 곡과 게임 설정은 유지됩니다.",
  hi: "डिफ़ॉल्ट संगीत फिर से आयात करने के लिए गेम चुनें। कस्टम गीत और गेम की पसंद सुरक्षित रहेंगी।",
  ar: "اختر الألعاب لإعادة استيراد موسيقاها الافتراضية. تُحفظ الأغاني المخصصة وتفضيلات الألعاب.",
  ru: "Выберите игры для повторного импорта музыки по умолчанию. Свои композиции и настройки игр сохраняются.",
};

export const defaultMusicLabels: Record<Language, { title: string; enable: string; help: string; missing: string; all: string; task: string }> = {
  en: { title: "Game music", enable: "Automatically import default music", help: "Extract music from SWF and DCR games, including local Director companion files. Manual imports below work even when this is off. Custom songs, game preferences and track selection are kept. If enabled, normalization runs after extraction finishes.", missing: "Import missing music", all: "Re-import music", task: "Default music import" },
  fr: { title: "Musique des jeux", enable: "Importer automatiquement la musique par défaut", help: "Extraire la musique des jeux SWF et DCR, y compris les fichiers complémentaires Director locaux. Les boutons ci-dessous fonctionnent même si cette option est désactivée. Les morceaux personnalisés, les préférences et les pistes sélectionnées sont conservés. Si activée, la normalisation suit l’extraction.", missing: "Importer la musique manquante", all: "Réimporter la musique", task: "Importation de musique par défaut" },
  zh: { title: "游戏音乐", enable: "自动导入默认音乐", help: "提取 SWF 和 DCR 游戏的音乐，包括本地 Director 配套文件。关闭后仍可使用下方按钮手动导入。自定义歌曲、游戏偏好和曲目选择保持不变。如已启用标准化，将在提取完成后运行。", missing: "导入缺失的音乐", all: "重新导入音乐", task: "默认音乐导入" },
  es: { title: "Música de los juegos", enable: "Importar música predeterminada automáticamente", help: "Extrae música de juegos SWF y DCR, incluidos archivos complementarios locales de Director. Los botones funcionan aunque esta opción esté desactivada. Se conservan canciones personalizadas, preferencias y selección. Si está activada, la normalización se ejecuta tras la extracción.", missing: "Importar música faltante", all: "Reimportar música", task: "Importación de música predeterminada" },
  de: { title: "Spielmusik", enable: "Standardmusik automatisch importieren", help: "Musik aus SWF- und DCR-Spielen einschließlich lokaler Director-Begleitdateien extrahieren. Der manuelle Import funktioniert auch bei deaktivierter Option. Eigene Titel, Spielpräferenzen und Titelauswahl bleiben erhalten. Falls aktiviert, folgt die Normalisierung nach der Extraktion.", missing: "Fehlende Musik importieren", all: "Musik erneut importieren", task: "Standardmusik importieren" },
  "pt-BR": { title: "Música dos jogos", enable: "Importar música padrão automaticamente", help: "Extrai música de jogos SWF e DCR, incluindo arquivos complementares locais do Director. Os botões funcionam mesmo com esta opção desativada. Músicas personalizadas, preferências e seleção são mantidas. Se ativada, a normalização ocorre após a extração.", missing: "Importar música ausente", all: "Reimportar música", task: "Importação de música padrão" },
  ja: { title: "ゲームの音楽", enable: "既定の音楽を自動インポート", help: "SWF と DCR ゲームから、ローカルの Director 付属ファイルも含めて音楽を抽出します。無効でも下のボタンで手動インポートできます。カスタム曲、設定、選択した曲は保持されます。有効な場合は抽出完了後に音量を正規化します。", missing: "不足している音楽をインポート", all: "音楽を再インポート", task: "既定の音楽のインポート" },
  ko: { title: "게임 음악", enable: "기본 음악 자동 가져오기", help: "로컬 Director 동반 파일을 포함하여 SWF 및 DCR 게임에서 음악을 추출합니다. 꺼져 있어도 아래 버튼으로 수동 가져오기가 가능합니다. 사용자 곡, 게임 설정과 곡 선택은 유지됩니다. 활성화된 경우 추출 완료 후 음량 정규화를 실행합니다.", missing: "누락된 음악 가져오기", all: "음악 다시 가져오기", task: "기본 음악 가져오기" },
  hi: { title: "गेम संगीत", enable: "डिफ़ॉल्ट संगीत अपने आप आयात करें", help: "स्थानीय Director सहायक फ़ाइलों सहित SWF और DCR गेम से संगीत निकालें। बंद होने पर भी नीचे दिए बटन काम करते हैं। कस्टम गीत, गेम की पसंद और ट्रैक चयन सुरक्षित रहते हैं। सक्षम होने पर निष्कर्षण के बाद सामान्यीकरण चलता है।", missing: "अनुपलब्ध संगीत आयात करें", all: "संगीत फिर से आयात करें", task: "डिफ़ॉल्ट संगीत आयात" },
  ar: { title: "موسيقى الألعاب", enable: "استيراد الموسيقى الافتراضية تلقائيًا", help: "استخراج الموسيقى من ألعاب SWF وDCR، بما في ذلك ملفات Director المرافقة المحلية. تعمل الأزرار أدناه حتى عند تعطيل الخيار. تُحفظ الأغاني المخصصة والتفضيلات والمقطع المحدد. تُشغّل تسوية الصوت بعد الاستخراج إذا كانت مفعّلة.", missing: "استيراد الموسيقى الناقصة", all: "إعادة استيراد الموسيقى", task: "استيراد الموسيقى الافتراضية" },
  ru: { title: "Музыка игр", enable: "Автоматически импортировать музыку по умолчанию", help: "Извлекать музыку из SWF- и DCR-игр, включая локальные сопутствующие файлы Director. Кнопки ниже работают и при отключённой опции. Свои композиции, настройки игр и выбор трека сохраняются. Если нормализация включена, она запускается после извлечения.", missing: "Импортировать недостающую музыку", all: "Повторно импортировать музыку", task: "Импорт музыки по умолчанию" },
};

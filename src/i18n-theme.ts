import type { Language } from "./i18n";
import type { BodyFont, ThemeColorRole, ThemeSkin, TitleFont, WallpaperKind } from "./theme";

export type ThemeColorGroup = "backgrounds" | "text" | "accents" | "status";

interface ThemeText {
  title: string;
  description: string;
  choose: string;
  edit: string;
  builtinNames: Record<ThemeSkin, string>;
  builtinHint: string;
  retroCredit: string;
  copyName: string;
  duplicate: string;
  importTheme: string;
  exportTheme: string;
  remove: string;
  confirmRemove: string;
  imported: string;
  exported: string;
  importFailed: string;
  exportFailed: string;
  tooMany: string;
  name: string;
  style: string;
  styles: Record<ThemeSkin, string>;
  scheme: string;
  schemes: Record<"dark" | "light", string>;
  colors: string;
  colorGroups: Record<ThemeColorGroup, string>;
  roles: Record<ThemeColorRole, string>;
  wallpaper: string;
  wallpapers: Record<WallpaperKind, string>;
  wallpaperColor: string;
  chooseImage: string;
  imageFailed: string;
  bodyFont: string;
  bodyFonts: Record<BodyFont, string>;
  titleFont: string;
  titleFonts: Record<TitleFont, string>;
  roundness: string;
  shadows: string;
  reset: string;
}

export const themeLabels: Record<Language, ThemeText> = {
  en: {
    title: "Theme", description: "Colors, wallpaper, fonts and shapes for every Flash Royale window. Games keep their own look.",
    choose: "Theme", edit: "Edit theme",
    builtinNames: { default: "Default", "retro-royale": "Retro Royale", "card-suits": "Card Suits", casino: "Casino", neon: "Neon", "classic-flash": "Classic Flash" },
    builtinHint: "Built-in themes can't be changed. Duplicate one to make your own version.",
    retroCredit: "Retro Royale is inspired by RuffleVita by İbrahim Doğan.",
    copyName: "{name} copy", duplicate: "Duplicate", importTheme: "Import", exportTheme: "Export", remove: "Delete", confirmRemove: "Click again to delete",
    imported: "Imported “{name}”.", exported: "Saved to {path}", importFailed: "This file isn't a Flash Royale theme.", exportFailed: "The theme file couldn't be saved.",
    tooMany: "You can keep up to {n} custom themes. Delete one first.",
    name: "Name", style: "Style", styles: { default: "Default", "retro-royale": "Retro Royale (outlined)", "card-suits": "Card Suits (card table)", casino: "Casino (gold trim)", neon: "Neon (glow)", "classic-flash": "Classic Flash (glossy)" },
    scheme: "Native controls", schemes: { dark: "Dark", light: "Light" },
    colors: "Colors", colorGroups: { backgrounds: "Backgrounds", text: "Text", accents: "Accents", status: "Status" },
    roles: {
      bg: "Background", surface: "Panels", "surface-2": "Inner panels", raised: "Raised controls", border: "Borders", depth: "Darkest areas",
      text: "Text", "text-soft": "Soft text", "text-muted": "Muted text", "text-dim": "Dim text", overlay: "Lines and tints", shadow: "Shadows", "on-accent": "Text on accent",
      accent: "Accent", "accent-bright": "Accent hover", highlight: "Selection", danger: "Danger", "danger-text": "Danger text",
      success: "Success", "success-text": "Success text", warning: "Warning", info: "Info and online games", "info-text": "Info text",
    },
    wallpaper: "Wallpaper", wallpapers: { gradient: "Gradient", solid: "Solid color", dots: "Dots", felt: "Card table felt", velvet: "Velvet diamonds", grid: "Neon grid", stripes: "Pinstripes", image: "Image" },
    wallpaperColor: "Wallpaper color", chooseImage: "Choose image", imageFailed: "This image can't be used as a wallpaper.",
    bodyFont: "Text font", bodyFonts: { app: "Standard", rounded: "Rounded" },
    titleFont: "Title font", titleFonts: { app: "Standard", display: "Bold display", serif: "Elegant serif", deco: "Art deco", tech: "Futuristic", arcade: "Arcade" },
    roundness: "Corner roundness", shadows: "Shadows and glow", reset: "Reset to the {style} style",
  },
  zh: {
    title: "主题", description: "设置 Flash Royale 所有窗口的颜色、壁纸、字体与形状。游戏会保留自身的外观。",
    choose: "主题", edit: "编辑主题",
    builtinNames: { default: "默认", "retro-royale": "Retro Royale", "card-suits": "扑克花色", casino: "赌场", neon: "霓虹", "classic-flash": "经典 Flash" },
    builtinHint: "内置主题无法修改。复制一个即可制作你自己的版本。",
    retroCredit: "Retro Royale 的灵感来自 İbrahim Doğan 的 RuffleVita。",
    copyName: "{name} 副本", duplicate: "复制", importTheme: "导入", exportTheme: "导出", remove: "删除", confirmRemove: "再次点击以删除",
    imported: "已导入“{name}”。", exported: "已保存到 {path}", importFailed: "此文件不是 Flash Royale 主题。", exportFailed: "无法保存主题文件。",
    tooMany: "最多可保留 {n} 个自定义主题。请先删除一个。",
    name: "名称", style: "样式", styles: { default: "默认", "retro-royale": "Retro Royale（描边）", "card-suits": "扑克花色（牌桌）", casino: "赌场（金边）", neon: "霓虹（发光）", "classic-flash": "经典 Flash（光泽）" },
    scheme: "原生控件", schemes: { dark: "深色", light: "浅色" },
    colors: "颜色", colorGroups: { backgrounds: "背景", text: "文字", accents: "强调色", status: "状态" },
    roles: {
      bg: "背景", surface: "面板", "surface-2": "内层面板", raised: "凸起控件", border: "边框", depth: "最暗区域",
      text: "文字", "text-soft": "柔和文字", "text-muted": "次要文字", "text-dim": "暗淡文字", overlay: "线条与色调", shadow: "阴影", "on-accent": "强调色上的文字",
      accent: "强调色", "accent-bright": "强调色悬停", highlight: "选中", danger: "危险", "danger-text": "危险文字",
      success: "成功", "success-text": "成功文字", warning: "警告", info: "信息与在线游戏", "info-text": "信息文字",
    },
    wallpaper: "壁纸", wallpapers: { gradient: "渐变", solid: "纯色", dots: "圆点", felt: "牌桌绒布", velvet: "丝绒菱格", grid: "霓虹网格", stripes: "细条纹", image: "图片" },
    wallpaperColor: "壁纸颜色", chooseImage: "选择图片", imageFailed: "此图片不能用作壁纸。",
    bodyFont: "正文字体", bodyFonts: { app: "标准", rounded: "圆体" },
    titleFont: "标题字体", titleFonts: { app: "标准", display: "粗体展示", serif: "优雅衬线", deco: "装饰艺术", tech: "未来感", arcade: "街机" },
    roundness: "圆角程度", shadows: "阴影与发光", reset: "重置为 {style} 样式",
  },
  es: {
    title: "Tema", description: "Colores, fondo, fuentes y formas de todas las ventanas de Flash Royale. Los juegos conservan su propio aspecto.",
    choose: "Tema", edit: "Editar tema",
    builtinNames: { default: "Predeterminado", "retro-royale": "Retro Royale", "card-suits": "Palos de cartas", casino: "Casino", neon: "Neón", "classic-flash": "Flash clásico" },
    builtinHint: "Los temas integrados no se pueden cambiar. Duplica uno para crear tu propia versión.",
    retroCredit: "Retro Royale está inspirado en RuffleVita de İbrahim Doğan.",
    copyName: "Copia de {name}", duplicate: "Duplicar", importTheme: "Importar", exportTheme: "Exportar", remove: "Eliminar", confirmRemove: "Haz clic otra vez para eliminar",
    imported: "Se importó «{name}».", exported: "Guardado en {path}", importFailed: "Este archivo no es un tema de Flash Royale.", exportFailed: "No se pudo guardar el archivo del tema.",
    tooMany: "Puedes tener hasta {n} temas personalizados. Elimina uno primero.",
    name: "Nombre", style: "Estilo", styles: { default: "Predeterminado", "retro-royale": "Retro Royale (contorneado)", "card-suits": "Palos de cartas (mesa de cartas)", casino: "Casino (ribete dorado)", neon: "Neón (brillo)", "classic-flash": "Flash clásico (brillante)" },
    scheme: "Controles nativos", schemes: { dark: "Oscuros", light: "Claros" },
    colors: "Colores", colorGroups: { backgrounds: "Fondos", text: "Texto", accents: "Acentos", status: "Estado" },
    roles: {
      bg: "Fondo", surface: "Paneles", "surface-2": "Paneles internos", raised: "Controles elevados", border: "Bordes", depth: "Zonas más oscuras",
      text: "Texto", "text-soft": "Texto suave", "text-muted": "Texto atenuado", "text-dim": "Texto tenue", overlay: "Líneas y tintes", shadow: "Sombras", "on-accent": "Texto sobre acento",
      accent: "Acento", "accent-bright": "Acento al pasar", highlight: "Selección", danger: "Peligro", "danger-text": "Texto de peligro",
      success: "Éxito", "success-text": "Texto de éxito", warning: "Advertencia", info: "Información y juegos en línea", "info-text": "Texto de información",
    },
    wallpaper: "Fondo de pantalla", wallpapers: { gradient: "Degradado", solid: "Color sólido", dots: "Puntos", felt: "Tapete de mesa", velvet: "Rombos de terciopelo", grid: "Cuadrícula neón", stripes: "Rayas finas", image: "Imagen" },
    wallpaperColor: "Color del fondo", chooseImage: "Elegir imagen", imageFailed: "Esta imagen no se puede usar como fondo.",
    bodyFont: "Fuente del texto", bodyFonts: { app: "Estándar", rounded: "Redondeada" },
    titleFont: "Fuente de títulos", titleFonts: { app: "Estándar", display: "Display gruesa", serif: "Serif elegante", deco: "Art déco", tech: "Futurista", arcade: "Arcade" },
    roundness: "Redondez de esquinas", shadows: "Sombras y brillo", reset: "Restablecer al estilo {style}",
  },
  fr: {
    title: "Thème", description: "Couleurs, fond d’écran, polices et formes de toutes les fenêtres de Flash Royale. Les jeux gardent leur propre apparence.",
    choose: "Thème", edit: "Modifier le thème",
    builtinNames: { default: "Par défaut", "retro-royale": "Retro Royale", "card-suits": "Enseignes", casino: "Casino", neon: "Néon", "classic-flash": "Flash classique" },
    builtinHint: "Les thèmes intégrés ne peuvent pas être modifiés. Dupliquez-en un pour créer votre propre version.",
    retroCredit: "Retro Royale s’inspire de RuffleVita par İbrahim Doğan.",
    copyName: "Copie de {name}", duplicate: "Dupliquer", importTheme: "Importer", exportTheme: "Exporter", remove: "Supprimer", confirmRemove: "Cliquez encore pour supprimer",
    imported: "« {name} » importé.", exported: "Enregistré dans {path}", importFailed: "Ce fichier n’est pas un thème Flash Royale.", exportFailed: "Impossible d’enregistrer le fichier du thème.",
    tooMany: "Vous pouvez garder jusqu’à {n} thèmes personnalisés. Supprimez-en un d’abord.",
    name: "Nom", style: "Style", styles: { default: "Par défaut", "retro-royale": "Retro Royale (contours)", "card-suits": "Enseignes (table de jeu)", casino: "Casino (liseré doré)", neon: "Néon (lueur)", "classic-flash": "Flash classique (brillant)" },
    scheme: "Contrôles natifs", schemes: { dark: "Sombres", light: "Clairs" },
    colors: "Couleurs", colorGroups: { backgrounds: "Arrière-plans", text: "Texte", accents: "Accents", status: "État" },
    roles: {
      bg: "Arrière-plan", surface: "Panneaux", "surface-2": "Panneaux internes", raised: "Contrôles en relief", border: "Bordures", depth: "Zones les plus sombres",
      text: "Texte", "text-soft": "Texte doux", "text-muted": "Texte atténué", "text-dim": "Texte pâle", overlay: "Lignes et teintes", shadow: "Ombres", "on-accent": "Texte sur l’accent",
      accent: "Accent", "accent-bright": "Accent au survol", highlight: "Sélection", danger: "Danger", "danger-text": "Texte de danger",
      success: "Succès", "success-text": "Texte de succès", warning: "Avertissement", info: "Info et jeux en ligne", "info-text": "Texte d’info",
    },
    wallpaper: "Fond d’écran", wallpapers: { gradient: "Dégradé", solid: "Couleur unie", dots: "Points", felt: "Tapis de jeu", velvet: "Losanges de velours", grid: "Grille néon", stripes: "Fines rayures", image: "Image" },
    wallpaperColor: "Couleur du fond", chooseImage: "Choisir une image", imageFailed: "Cette image ne peut pas servir de fond d’écran.",
    bodyFont: "Police du texte", bodyFonts: { app: "Standard", rounded: "Arrondie" },
    titleFont: "Police des titres", titleFonts: { app: "Standard", display: "Display grasse", serif: "Serif élégante", deco: "Art déco", tech: "Futuriste", arcade: "Arcade" },
    roundness: "Arrondi des coins", shadows: "Ombres et lueur", reset: "Réinitialiser au style {style}",
  },
  de: {
    title: "Design", description: "Farben, Hintergrund, Schriften und Formen für alle Flash Royale-Fenster. Spiele behalten ihr eigenes Aussehen.",
    choose: "Design", edit: "Design bearbeiten",
    builtinNames: { default: "Standard", "retro-royale": "Retro Royale", "card-suits": "Kartenfarben", casino: "Casino", neon: "Neon", "classic-flash": "Klassisches Flash" },
    builtinHint: "Integrierte Designs können nicht geändert werden. Dupliziere eines, um deine eigene Version zu erstellen.",
    retroCredit: "Retro Royale ist von RuffleVita von İbrahim Doğan inspiriert.",
    copyName: "{name} (Kopie)", duplicate: "Duplizieren", importTheme: "Importieren", exportTheme: "Exportieren", remove: "Löschen", confirmRemove: "Zum Löschen erneut klicken",
    imported: "„{name}“ importiert.", exported: "Gespeichert unter {path}", importFailed: "Diese Datei ist kein Flash Royale-Design.", exportFailed: "Die Design-Datei konnte nicht gespeichert werden.",
    tooMany: "Du kannst bis zu {n} eigene Designs behalten. Lösche zuerst eines.",
    name: "Name", style: "Stil", styles: { default: "Standard", "retro-royale": "Retro Royale (umrandet)", "card-suits": "Kartenfarben (Spieltisch)", casino: "Casino (Goldrand)", neon: "Neon (Leuchten)", "classic-flash": "Klassisches Flash (glänzend)" },
    scheme: "Native Steuerelemente", schemes: { dark: "Dunkel", light: "Hell" },
    colors: "Farben", colorGroups: { backgrounds: "Hintergründe", text: "Text", accents: "Akzente", status: "Status" },
    roles: {
      bg: "Hintergrund", surface: "Bereiche", "surface-2": "Innere Bereiche", raised: "Erhabene Elemente", border: "Rahmen", depth: "Dunkelste Flächen",
      text: "Text", "text-soft": "Weicher Text", "text-muted": "Gedämpfter Text", "text-dim": "Blasser Text", overlay: "Linien und Tönungen", shadow: "Schatten", "on-accent": "Text auf Akzent",
      accent: "Akzent", "accent-bright": "Akzent beim Überfahren", highlight: "Auswahl", danger: "Gefahr", "danger-text": "Gefahrentext",
      success: "Erfolg", "success-text": "Erfolgstext", warning: "Warnung", info: "Info und Online-Spiele", "info-text": "Infotext",
    },
    wallpaper: "Hintergrundbild", wallpapers: { gradient: "Verlauf", solid: "Einfarbig", dots: "Punkte", felt: "Spieltischfilz", velvet: "Samtrauten", grid: "Neon-Gitter", stripes: "Nadelstreifen", image: "Bild" },
    wallpaperColor: "Hintergrundfarbe", chooseImage: "Bild wählen", imageFailed: "Dieses Bild kann nicht als Hintergrund verwendet werden.",
    bodyFont: "Textschrift", bodyFonts: { app: "Standard", rounded: "Abgerundet" },
    titleFont: "Titelschrift", titleFonts: { app: "Standard", display: "Fette Display-Schrift", serif: "Elegante Serifenschrift", deco: "Art déco", tech: "Futuristisch", arcade: "Arcade" },
    roundness: "Eckenrundung", shadows: "Schatten und Leuchten", reset: "Auf den Stil {style} zurücksetzen",
  },
  "pt-BR": {
    title: "Tema", description: "Cores, papel de parede, fontes e formas de todas as janelas do Flash Royale. Os jogos mantêm a própria aparência.",
    choose: "Tema", edit: "Editar tema",
    builtinNames: { default: "Padrão", "retro-royale": "Retro Royale", "card-suits": "Naipes", casino: "Cassino", neon: "Neon", "classic-flash": "Flash clássico" },
    builtinHint: "Temas integrados não podem ser alterados. Duplique um para criar sua própria versão.",
    retroCredit: "O Retro Royale é inspirado no RuffleVita, de İbrahim Doğan.",
    copyName: "Cópia de {name}", duplicate: "Duplicar", importTheme: "Importar", exportTheme: "Exportar", remove: "Excluir", confirmRemove: "Clique de novo para excluir",
    imported: "“{name}” importado.", exported: "Salvo em {path}", importFailed: "Este arquivo não é um tema do Flash Royale.", exportFailed: "Não foi possível salvar o arquivo do tema.",
    tooMany: "Você pode manter até {n} temas personalizados. Exclua um primeiro.",
    name: "Nome", style: "Estilo", styles: { default: "Padrão", "retro-royale": "Retro Royale (contornado)", "card-suits": "Naipes (mesa de cartas)", casino: "Cassino (friso dourado)", neon: "Neon (brilho)", "classic-flash": "Flash clássico (brilhante)" },
    scheme: "Controles nativos", schemes: { dark: "Escuros", light: "Claros" },
    colors: "Cores", colorGroups: { backgrounds: "Fundos", text: "Texto", accents: "Destaques", status: "Status" },
    roles: {
      bg: "Fundo", surface: "Painéis", "surface-2": "Painéis internos", raised: "Controles elevados", border: "Bordas", depth: "Áreas mais escuras",
      text: "Texto", "text-soft": "Texto suave", "text-muted": "Texto atenuado", "text-dim": "Texto apagado", overlay: "Linhas e tons", shadow: "Sombras", "on-accent": "Texto sobre destaque",
      accent: "Destaque", "accent-bright": "Destaque ao passar", highlight: "Seleção", danger: "Perigo", "danger-text": "Texto de perigo",
      success: "Sucesso", "success-text": "Texto de sucesso", warning: "Aviso", info: "Info e jogos online", "info-text": "Texto de info",
    },
    wallpaper: "Papel de parede", wallpapers: { gradient: "Gradiente", solid: "Cor sólida", dots: "Pontos", felt: "Feltro de mesa", velvet: "Losangos de veludo", grid: "Grade neon", stripes: "Riscas finas", image: "Imagem" },
    wallpaperColor: "Cor do papel de parede", chooseImage: "Escolher imagem", imageFailed: "Esta imagem não pode ser usada como papel de parede.",
    bodyFont: "Fonte do texto", bodyFonts: { app: "Padrão", rounded: "Arredondada" },
    titleFont: "Fonte dos títulos", titleFonts: { app: "Padrão", display: "Display encorpada", serif: "Serifada elegante", deco: "Art déco", tech: "Futurista", arcade: "Arcade" },
    roundness: "Arredondamento dos cantos", shadows: "Sombras e brilho", reset: "Redefinir para o estilo {style}",
  },
  ja: {
    title: "テーマ", description: "Flash Royale のすべてのウィンドウの色、壁紙、フォント、形を設定します。ゲームの見た目は変わりません。",
    choose: "テーマ", edit: "テーマを編集",
    builtinNames: { default: "デフォルト", "retro-royale": "Retro Royale", "card-suits": "カードスート", casino: "カジノ", neon: "ネオン", "classic-flash": "クラシック Flash" },
    builtinHint: "組み込みテーマは変更できません。複製して自分のバージョンを作成してください。",
    retroCredit: "Retro Royale は İbrahim Doğan 氏の RuffleVita に着想を得ています。",
    copyName: "{name} のコピー", duplicate: "複製", importTheme: "インポート", exportTheme: "エクスポート", remove: "削除", confirmRemove: "もう一度クリックで削除",
    imported: "「{name}」をインポートしました。", exported: "{path} に保存しました", importFailed: "このファイルは Flash Royale のテーマではありません。", exportFailed: "テーマファイルを保存できませんでした。",
    tooMany: "カスタムテーマは最大 {n} 個までです。先に 1 つ削除してください。",
    name: "名前", style: "スタイル", styles: { default: "デフォルト", "retro-royale": "Retro Royale（縁取り）", "card-suits": "カードスート（カードテーブル）", casino: "カジノ（金縁）", neon: "ネオン（発光）", "classic-flash": "クラシック Flash（光沢）" },
    scheme: "ネイティブコントロール", schemes: { dark: "ダーク", light: "ライト" },
    colors: "色", colorGroups: { backgrounds: "背景", text: "テキスト", accents: "アクセント", status: "状態" },
    roles: {
      bg: "背景", surface: "パネル", "surface-2": "内側のパネル", raised: "浮き上がったコントロール", border: "枠線", depth: "最も暗い部分",
      text: "テキスト", "text-soft": "柔らかいテキスト", "text-muted": "控えめなテキスト", "text-dim": "薄いテキスト", overlay: "線と色合い", shadow: "影", "on-accent": "アクセント上のテキスト",
      accent: "アクセント", "accent-bright": "ホバー時のアクセント", highlight: "選択", danger: "危険", "danger-text": "危険のテキスト",
      success: "成功", "success-text": "成功のテキスト", warning: "警告", info: "情報とオンラインゲーム", "info-text": "情報のテキスト",
    },
    wallpaper: "壁紙", wallpapers: { gradient: "グラデーション", solid: "単色", dots: "ドット", felt: "テーブルのフェルト", velvet: "ベルベットのひし形", grid: "ネオングリッド", stripes: "ピンストライプ", image: "画像" },
    wallpaperColor: "壁紙の色", chooseImage: "画像を選択", imageFailed: "この画像は壁紙に使用できません。",
    bodyFont: "本文フォント", bodyFonts: { app: "標準", rounded: "丸ゴシック" },
    titleFont: "見出しフォント", titleFonts: { app: "標準", display: "太字ディスプレイ", serif: "エレガントなセリフ", deco: "アールデコ", tech: "未来的", arcade: "アーケード" },
    roundness: "角の丸み", shadows: "影と光彩", reset: "{style} スタイルにリセット",
  },
  ko: {
    title: "테마", description: "모든 Flash Royale 창의 색, 배경화면, 글꼴, 모양을 정합니다. 게임은 자체 모양을 유지합니다.",
    choose: "테마", edit: "테마 편집",
    builtinNames: { default: "기본", "retro-royale": "Retro Royale", "card-suits": "카드 문양", casino: "카지노", neon: "네온", "classic-flash": "클래식 Flash" },
    builtinHint: "기본 제공 테마는 바꿀 수 없습니다. 복제해서 나만의 버전을 만드세요.",
    retroCredit: "Retro Royale은 İbrahim Doğan의 RuffleVita에서 영감을 받았습니다.",
    copyName: "{name} 사본", duplicate: "복제", importTheme: "가져오기", exportTheme: "내보내기", remove: "삭제", confirmRemove: "한 번 더 클릭하면 삭제",
    imported: "“{name}”을(를) 가져왔습니다.", exported: "{path}에 저장했습니다", importFailed: "이 파일은 Flash Royale 테마가 아닙니다.", exportFailed: "테마 파일을 저장할 수 없습니다.",
    tooMany: "사용자 테마는 최대 {n}개까지 보관할 수 있습니다. 먼저 하나를 삭제하세요.",
    name: "이름", style: "스타일", styles: { default: "기본", "retro-royale": "Retro Royale (윤곽선)", "card-suits": "카드 문양（카드 테이블）", casino: "카지노（금테）", neon: "네온（발광）", "classic-flash": "클래식 Flash（광택）" },
    scheme: "기본 컨트롤", schemes: { dark: "어둡게", light: "밝게" },
    colors: "색", colorGroups: { backgrounds: "배경", text: "텍스트", accents: "강조", status: "상태" },
    roles: {
      bg: "배경", surface: "패널", "surface-2": "안쪽 패널", raised: "돌출 컨트롤", border: "테두리", depth: "가장 어두운 영역",
      text: "텍스트", "text-soft": "부드러운 텍스트", "text-muted": "흐린 텍스트", "text-dim": "옅은 텍스트", overlay: "선과 색조", shadow: "그림자", "on-accent": "강조색 위 텍스트",
      accent: "강조", "accent-bright": "마우스를 올린 강조", highlight: "선택", danger: "위험", "danger-text": "위험 텍스트",
      success: "성공", "success-text": "성공 텍스트", warning: "경고", info: "정보 및 온라인 게임", "info-text": "정보 텍스트",
    },
    wallpaper: "배경화면", wallpapers: { gradient: "그라데이션", solid: "단색", dots: "점무늬", felt: "카드 테이블 펠트", velvet: "벨벳 다이아몬드", grid: "네온 격자", stripes: "핀스트라이프", image: "이미지" },
    wallpaperColor: "배경화면 색", chooseImage: "이미지 선택", imageFailed: "이 이미지는 배경화면으로 사용할 수 없습니다.",
    bodyFont: "본문 글꼴", bodyFonts: { app: "표준", rounded: "둥근 글꼴" },
    titleFont: "제목 글꼴", titleFonts: { app: "표준", display: "굵은 디스플레이", serif: "우아한 세리프", deco: "아르데코", tech: "미래적", arcade: "아케이드" },
    roundness: "모서리 둥글기", shadows: "그림자와 광채", reset: "{style} 스타일로 재설정",
  },
  hi: {
    title: "थीम", description: "Flash Royale की हर विंडो के रंग, वॉलपेपर, फ़ॉन्ट और आकार। गेम अपना रूप बनाए रखते हैं।",
    choose: "थीम", edit: "थीम संपादित करें",
    builtinNames: { default: "डिफ़ॉल्ट", "retro-royale": "Retro Royale", "card-suits": "ताश के पत्ते", casino: "कैसीनो", neon: "नियॉन", "classic-flash": "क्लासिक Flash" },
    builtinHint: "बिल्ट-इन थीम बदली नहीं जा सकतीं। अपना संस्करण बनाने के लिए किसी एक की प्रतिलिपि बनाएँ।",
    retroCredit: "Retro Royale, İbrahim Doğan के RuffleVita से प्रेरित है।",
    copyName: "{name} की प्रतिलिपि", duplicate: "प्रतिलिपि बनाएँ", importTheme: "आयात करें", exportTheme: "निर्यात करें", remove: "हटाएँ", confirmRemove: "हटाने के लिए फिर क्लिक करें",
    imported: "“{name}” आयात किया गया।", exported: "{path} में सहेजा गया", importFailed: "यह फ़ाइल Flash Royale थीम नहीं है।", exportFailed: "थीम फ़ाइल सहेजी नहीं जा सकी।",
    tooMany: "आप अधिकतम {n} कस्टम थीम रख सकते हैं। पहले एक हटाएँ।",
    name: "नाम", style: "शैली", styles: { default: "डिफ़ॉल्ट", "retro-royale": "Retro Royale (रूपरेखा वाली)", "card-suits": "ताश के पत्ते (ताश की मेज़)", casino: "कैसीनो (सुनहरा किनारा)", neon: "नियॉन (चमक)", "classic-flash": "क्लासिक Flash (चमकदार)" },
    scheme: "नेटिव नियंत्रण", schemes: { dark: "गहरे", light: "हल्के" },
    colors: "रंग", colorGroups: { backgrounds: "पृष्ठभूमि", text: "टेक्स्ट", accents: "उभार रंग", status: "स्थिति" },
    roles: {
      bg: "पृष्ठभूमि", surface: "पैनल", "surface-2": "भीतरी पैनल", raised: "उभरे नियंत्रण", border: "किनारे", depth: "सबसे गहरे हिस्से",
      text: "टेक्स्ट", "text-soft": "नरम टेक्स्ट", "text-muted": "मंद टेक्स्ट", "text-dim": "फीका टेक्स्ट", overlay: "रेखाएँ और आभा", shadow: "छायाएँ", "on-accent": "उभार रंग पर टेक्स्ट",
      accent: "उभार रंग", "accent-bright": "होवर पर उभार रंग", highlight: "चयन", danger: "ख़तरा", "danger-text": "ख़तरे का टेक्स्ट",
      success: "सफलता", "success-text": "सफलता का टेक्स्ट", warning: "चेतावनी", info: "जानकारी और ऑनलाइन गेम", "info-text": "जानकारी का टेक्स्ट",
    },
    wallpaper: "वॉलपेपर", wallpapers: { gradient: "ग्रेडिएंट", solid: "एक रंग", dots: "बिंदु", felt: "ताश की मेज़ का फ़ेल्ट", velvet: "मखमली हीरे", grid: "नियॉन ग्रिड", stripes: "पतली धारियाँ", image: "छवि" },
    wallpaperColor: "वॉलपेपर का रंग", chooseImage: "छवि चुनें", imageFailed: "यह छवि वॉलपेपर के रूप में उपयोग नहीं की जा सकती।",
    bodyFont: "टेक्स्ट फ़ॉन्ट", bodyFonts: { app: "मानक", rounded: "गोलाकार" },
    titleFont: "शीर्षक फ़ॉन्ट", titleFonts: { app: "मानक", display: "मोटा डिस्प्ले", serif: "सुरुचिपूर्ण सेरिफ़", deco: "आर्ट डेको", tech: "भविष्यवादी", arcade: "आर्केड" },
    roundness: "कोनों की गोलाई", shadows: "छाया और चमक", reset: "{style} शैली पर रीसेट करें",
  },
  ar: {
    title: "السمة", description: "الألوان والخلفية والخطوط والأشكال لكل نوافذ Flash Royale. تحتفظ الألعاب بمظهرها الخاص.",
    choose: "السمة", edit: "تعديل السمة",
    builtinNames: { default: "الافتراضية", "retro-royale": "Retro Royale", "card-suits": "رموز الورق", casino: "كازينو", neon: "نيون", "classic-flash": "Flash الكلاسيكي" },
    builtinHint: "لا يمكن تغيير السمات المدمجة. انسخ واحدة لإنشاء نسختك الخاصة.",
    retroCredit: "سمة Retro Royale مستوحاة من RuffleVita لـ İbrahim Doğan.",
    copyName: "نسخة من {name}", duplicate: "نسخ", importTheme: "استيراد", exportTheme: "تصدير", remove: "حذف", confirmRemove: "انقر مرة أخرى للحذف",
    imported: "تم استيراد «{name}».", exported: "تم الحفظ في {path}", importFailed: "هذا الملف ليس سمة Flash Royale.", exportFailed: "تعذر حفظ ملف السمة.",
    tooMany: "يمكنك الاحتفاظ بما يصل إلى {n} سمة مخصصة. احذف واحدة أولًا.",
    name: "الاسم", style: "النمط", styles: { default: "الافتراضي", "retro-royale": "Retro Royale (بحواف)", "card-suits": "رموز الورق (طاولة ورق)", casino: "كازينو (حواف ذهبية)", neon: "نيون (توهج)", "classic-flash": "Flash الكلاسيكي (لامع)" },
    scheme: "عناصر التحكم الأصلية", schemes: { dark: "داكنة", light: "فاتحة" },
    colors: "الألوان", colorGroups: { backgrounds: "الخلفيات", text: "النص", accents: "ألوان التمييز", status: "الحالة" },
    roles: {
      bg: "الخلفية", surface: "اللوحات", "surface-2": "اللوحات الداخلية", raised: "عناصر بارزة", border: "الحدود", depth: "أغمق المناطق",
      text: "النص", "text-soft": "نص ناعم", "text-muted": "نص خافت", "text-dim": "نص باهت", overlay: "الخطوط والصبغات", shadow: "الظلال", "on-accent": "نص على لون التمييز",
      accent: "لون التمييز", "accent-bright": "التمييز عند المرور", highlight: "التحديد", danger: "خطر", "danger-text": "نص الخطر",
      success: "نجاح", "success-text": "نص النجاح", warning: "تحذير", info: "معلومات وألعاب عبر الإنترنت", "info-text": "نص المعلومات",
    },
    wallpaper: "الخلفية", wallpapers: { gradient: "تدرج", solid: "لون واحد", dots: "نقاط", felt: "لباد طاولة الورق", velvet: "معينات مخملية", grid: "شبكة نيون", stripes: "خطوط رفيعة", image: "صورة" },
    wallpaperColor: "لون الخلفية", chooseImage: "اختيار صورة", imageFailed: "لا يمكن استخدام هذه الصورة كخلفية.",
    bodyFont: "خط النص", bodyFonts: { app: "قياسي", rounded: "مستدير" },
    titleFont: "خط العناوين", titleFonts: { app: "قياسي", display: "عرض عريض", serif: "سيريف أنيق", deco: "آرت ديكو", tech: "مستقبلي", arcade: "أركيد" },
    roundness: "استدارة الزوايا", shadows: "الظلال والتوهج", reset: "إعادة التعيين إلى نمط {style}",
  },
  ru: {
    title: "Тема", description: "Цвета, обои, шрифты и формы всех окон Flash Royale. Игры сохраняют свой вид.",
    choose: "Тема", edit: "Изменить тему",
    builtinNames: { default: "Стандартная", "retro-royale": "Retro Royale", "card-suits": "Карточные масти", casino: "Казино", neon: "Неон", "classic-flash": "Классический Flash" },
    builtinHint: "Встроенные темы нельзя изменить. Создайте копию, чтобы сделать свою версию.",
    retroCredit: "Retro Royale вдохновлена RuffleVita от İbrahim Doğan.",
    copyName: "{name} (копия)", duplicate: "Копировать", importTheme: "Импорт", exportTheme: "Экспорт", remove: "Удалить", confirmRemove: "Нажмите ещё раз для удаления",
    imported: "Тема «{name}» импортирована.", exported: "Сохранено в {path}", importFailed: "Этот файл не является темой Flash Royale.", exportFailed: "Не удалось сохранить файл темы.",
    tooMany: "Можно хранить до {n} своих тем. Сначала удалите одну.",
    name: "Название", style: "Стиль", styles: { default: "Стандартный", "retro-royale": "Retro Royale (с обводкой)", "card-suits": "Карточные масти (карточный стол)", casino: "Казино (золотая кайма)", neon: "Неон (свечение)", "classic-flash": "Классический Flash (глянец)" },
    scheme: "Системные элементы", schemes: { dark: "Тёмные", light: "Светлые" },
    colors: "Цвета", colorGroups: { backgrounds: "Фоны", text: "Текст", accents: "Акценты", status: "Состояния" },
    roles: {
      bg: "Фон", surface: "Панели", "surface-2": "Внутренние панели", raised: "Выпуклые элементы", border: "Рамки", depth: "Самые тёмные области",
      text: "Текст", "text-soft": "Мягкий текст", "text-muted": "Приглушённый текст", "text-dim": "Бледный текст", overlay: "Линии и оттенки", shadow: "Тени", "on-accent": "Текст на акценте",
      accent: "Акцент", "accent-bright": "Акцент при наведении", highlight: "Выделение", danger: "Опасность", "danger-text": "Текст опасности",
      success: "Успех", "success-text": "Текст успеха", warning: "Предупреждение", info: "Сведения и онлайн-игры", "info-text": "Текст сведений",
    },
    wallpaper: "Обои", wallpapers: { gradient: "Градиент", solid: "Сплошной цвет", dots: "Точки", felt: "Сукно стола", velvet: "Бархатные ромбы", grid: "Неоновая сетка", stripes: "Тонкая полоска", image: "Изображение" },
    wallpaperColor: "Цвет обоев", chooseImage: "Выбрать изображение", imageFailed: "Это изображение нельзя использовать как обои.",
    bodyFont: "Шрифт текста", bodyFonts: { app: "Стандартный", rounded: "Округлый" },
    titleFont: "Шрифт заголовков", titleFonts: { app: "Стандартный", display: "Жирный акцидентный", serif: "Изящный антиква", deco: "Ар-деко", tech: "Футуристичный", arcade: "Аркадный" },
    roundness: "Скругление углов", shadows: "Тени и свечение", reset: "Сбросить к стилю {style}",
  },
};

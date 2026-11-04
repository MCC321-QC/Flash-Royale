import type { Language } from "./i18n";

export const colorPickerLabels: Record<Language, { red: string; green: string; blue: string; hex: string; invalid: string }> = {
  en: { red: "Red", green: "Green", blue: "Blue", hex: "Hex color", invalid: "Enter a color as #RRGGBB." },
  fr: { red: "Rouge", green: "Vert", blue: "Bleu", hex: "Couleur hexadécimale", invalid: "Entrez une couleur au format #RRGGBB." },
  zh: { red: "红", green: "绿", blue: "蓝", hex: "十六进制颜色", invalid: "请输入 #RRGGBB 格式的颜色。" },
  es: { red: "Rojo", green: "Verde", blue: "Azul", hex: "Color hexadecimal", invalid: "Introduce un color en formato #RRGGBB." },
  de: { red: "Rot", green: "Grün", blue: "Blau", hex: "Hex-Farbe", invalid: "Eine Farbe im Format #RRGGBB eingeben." },
  "pt-BR": { red: "Vermelho", green: "Verde", blue: "Azul", hex: "Cor hexadecimal", invalid: "Digite uma cor no formato #RRGGBB." },
  ja: { red: "赤", green: "緑", blue: "青", hex: "16進数の色", invalid: "#RRGGBB 形式で色を入力してください。" },
  ko: { red: "빨강", green: "초록", blue: "파랑", hex: "16진수 색상", invalid: "#RRGGBB 형식으로 색상을 입력하세요." },
  hi: { red: "लाल", green: "हरा", blue: "नीला", hex: "हेक्स रंग", invalid: "#RRGGBB प्रारूप में रंग दर्ज करें।" },
  ar: { red: "أحمر", green: "أخضر", blue: "أزرق", hex: "لون سداسي عشري", invalid: "أدخل لونًا بتنسيق #RRGGBB." },
  ru: { red: "Красный", green: "Зелёный", blue: "Синий", hex: "HEX-цвет", invalid: "Введите цвет в формате #RRGGBB." },
};

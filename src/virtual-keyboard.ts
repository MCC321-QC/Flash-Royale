import type { KeyboardLayoutId } from "./keyboard-layouts";
import type { Language } from "./i18n";

export interface KeyboardKey { value: string; shifted?: string; code: string }
export interface KeyboardLayout { id: KeyboardLayoutId; language: Language; name: string; rows: KeyboardKey[][]; symbols: string; ime?: "zh" | "ja" | "ko"; rtl?: boolean }

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function caretBoundary(value: string, offset: number, direction: -1 | 1) {
  const boundaries = [0, ...Array.from(graphemes.segment(value), part => part.index + part.segment.length)];
  return direction < 0 ? boundaries.filter(index => index < offset).at(-1) ?? 0 : boundaries.find(index => index > offset) ?? value.length;
}

const kana: Record<string, string> = {
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ", ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  sa: "さ", shi: "し", si: "し", su: "す", se: "せ", so: "そ", za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  ta: "た", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", te: "て", to: "と", da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の", ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ",
  ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ", pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も", ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ", wa: "わ", wi: "うぃ", we: "うぇ", wo: "を",
  va: "ゔぁ", vi: "ゔぃ", vu: "ゔ", ve: "ゔぇ", vo: "ゔぉ", fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
  she: "しぇ", je: "じぇ", che: "ちぇ", tsa: "つぁ", tsi: "つぃ", tse: "つぇ", tso: "つぉ",
  thi: "てぃ", thu: "てゅ", dhi: "でぃ", dhu: "でゅ", twu: "とぅ", dwu: "どぅ",
  xtsu: "っ", ltsu: "っ", xtu: "っ", ltu: "っ", xwa: "ゎ", lwa: "ゎ", xka: "ゕ", xke: "ゖ",
  "-": "ー",
};
for (const [prefix, letter] of Object.entries({ ky: "き", gy: "ぎ", sh: "し", sy: "し", jy: "じ", j: "じ", zy: "じ", ch: "ち", ty: "ち", cy: "ち", dy: "ぢ", ny: "に", hy: "ひ", by: "び", py: "ぴ", my: "み", ry: "り", fy: "ふ", vy: "ゔ" })) {
  for (const [vowel, small] of Object.entries({ a: "ゃ", u: "ゅ", o: "ょ" })) kana[prefix + vowel] = letter + small;
}
for (const prefix of ["x", "l"]) for (const [vowel, small] of Object.entries({ a: "ぁ", i: "ぃ", u: "ぅ", e: "ぇ", o: "ぉ", ya: "ゃ", yu: "ゅ", yo: "ょ" })) kana[prefix + vowel] = small;

export function romajiToKana(raw: string) {
  const input = raw.toLowerCase();
  let result = "";
  for (let index = 0; index < input.length;) {
    const char = input[index], next = input[index + 1] ?? "";
    if (char === "n" && (!next || next === "'" || next === "n" || !/[aiueoy]/.test(next))) {
      result += "ん";
      index += next === "'" || next === "n" && index + 2 === input.length ? 2 : 1;
    } else if (char !== "n" && /[bcdfghjklmpqrstvwxyz]/.test(char) && (char === next || char === "t" && input.slice(index + 1, index + 3) === "ch")) {
      result += "っ"; index++;
    } else {
      const key = [4, 3, 2, 1].map(length => input.slice(index, index + length)).find(value => Object.prototype.hasOwnProperty.call(kana, value));
      result += key ? kana[key] : char;
      index += key?.length ?? 1;
    }
  }
  return result;
}
export const toKatakana = (value: string) => value.replace(/[ぁ-ゖ]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60));

const leads = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const vowels = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const tails = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];
const vowelPairs: Record<string, string> = { "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ", "ㅘㅣ": "ㅙ", "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅝㅣ": "ㅞ", "ㅡㅣ": "ㅢ" };
const tailPairs: Record<string, string> = { "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ" };
export function composeHangul(raw: string) {
  let output = "", lead = "", vowel = "", tail = "";
  const current = () => lead && vowel ? String.fromCharCode(0xac00 + (leads.indexOf(lead) * 21 + vowels.indexOf(vowel)) * 28 + tails.indexOf(tail)) : lead + vowel;
  const commit = () => { output += current(); lead = ""; vowel = ""; tail = ""; };
  for (const char of raw) {
    if (vowels.includes(char)) {
      if (tail) {
        const pair = Object.entries(tailPairs).find(([, value]) => value === tail)?.[0];
        const nextLead = pair?.[1] ?? tail;
        tail = pair?.[0] ?? "";
        commit(); lead = nextLead; vowel = char;
      } else if (!vowel) vowel = char;
      else if (vowelPairs[vowel + char]) vowel = vowelPairs[vowel + char];
      else { commit(); vowel = char; }
    } else if (leads.includes(char)) {
      if (lead && vowel && !tail && tails.includes(char)) tail = char;
      else if (tail && tailPairs[tail + char]) tail = tailPairs[tail + char];
      else { commit(); lead = char; }
    } else { commit(); output += char; }
  }
  return output + current();
}

export interface KeyboardDictionary { schema: 1; entries: Record<string, string[]> }
export function isKeyboardDictionary(value: unknown): value is KeyboardDictionary {
  if (!value || typeof value !== "object" || !("schema" in value) || value.schema !== 1 || !("entries" in value) ||
      !value.entries || typeof value.entries !== "object" || Array.isArray(value.entries)) return false;
  const entries = Object.values(value.entries);
  return entries.length > 0 && entries.every((words: unknown) => Array.isArray(words) && words.length > 0 && words.every((word: unknown) => typeof word === "string" && word.length > 0));
}
export function conversionCandidates(dictionary: KeyboardDictionary, input: string) {
  if (Object.prototype.hasOwnProperty.call(dictionary.entries, input)) return dictionary.entries[input];
  if (!input || input.length > 128) return [];
  const paths = new Map<number, { text: string; cost: number }[]>([[0, [{ text: "", cost: 0 }]]]);
  for (let start = 0; start < input.length; start++) {
    const previous = paths.get(start);
    if (!previous) continue;
    for (let end = start + 1; end <= input.length; end++) {
      const key = input.slice(start, end);
      if (!Object.prototype.hasOwnProperty.call(dictionary.entries, key)) continue;
      const next = paths.get(end) ?? [];
      for (const prefix of previous) dictionary.entries[key].slice(0, 4).forEach((word, rank) => next.push({ text: prefix.text + word, cost: prefix.cost + 1 + rank * 0.1 }));
      next.sort((a, b) => a.cost - b.cost);
      paths.set(end, next.filter((entry, index) => next.findIndex(value => value.text === entry.text) === index).slice(0, 8));
    }
  }
  return paths.get(input.length)?.map(entry => entry.text) ?? [];
}

export function keyboardComposition(layout: KeyboardLayout, raw: string, dictionary: KeyboardDictionary | null) {
  const display = layout.ime === "ja" ? romajiToKana(raw) : layout.ime === "ko" ? composeHangul(raw) : raw;
  const lookup = layout.ime === "zh" ? raw.toLowerCase().replace(/u:|ü/g, "v").replace(/[\s']/g, "") : display;
  const converted = dictionary ? conversionCandidates(dictionary, lookup) : [];
  const literals = layout.ime === "ja" ? [display, toKatakana(display)] : [display];
  return { display, lookup, candidates: [...new Set([...converted, ...literals])].filter(Boolean) };
}

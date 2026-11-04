import { cachedNumberFormat } from "./intl-cache";

export function formatFileSize(bytes: number, language: string) {
  const formatter = cachedNumberFormat(language, { maximumFractionDigits: 1 });
  if (bytes >= 1024 * 1024) return `${formatter.format(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${cachedNumberFormat(language).format(bytes)} B`;
}

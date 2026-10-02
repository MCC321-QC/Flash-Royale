import { Star } from "lucide-react";
import type { Language } from "./i18n";

const stars = [0, 1, 2, 3, 4];

export function StarRating({ rating, label, language, compact = false }: {
  rating: number;
  label: string;
  language: Language;
  compact?: boolean;
}) {
  if (!Number.isFinite(rating)) return null;
  const value = Math.max(0, Math.min(5, rating));
  const formattedValue = value.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const description = `${label}: ${formattedValue} / 5`;

  return (
    <span className={compact ? "star-rating compact" : "star-rating"} role="img" aria-label={description} title={description}>
      <span className="star-rating-glyphs" aria-hidden="true">
        <span className="star-rating-icons star-rating-base">
          {stars.map((star) => <Star key={star} />)}
        </span>
        <span className="star-rating-fill" style={{ width: `${value * 20}%` }}>
          <span className="star-rating-icons">
            {stars.map((star) => <Star key={star} fill="currentColor" />)}
          </span>
        </span>
      </span>
      <span className="star-rating-value" aria-hidden="true">{formattedValue}</span>
    </span>
  );
}
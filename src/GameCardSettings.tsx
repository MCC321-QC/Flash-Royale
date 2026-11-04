import { ArrowDown, ArrowUp, ChevronDown, RotateCcw } from "lucide-react";
import { useId, type MouseEvent } from "react";
import { messages, sourceMetadataLabels, gameCardTagLimitLabels, type Language } from "./i18n";
import { compatibilityLabels } from "./i18n-compatibility";
import { metadataSourceLabels } from "./i18n-metadata-sources";
import { gameCardSettingsLabels } from "./i18n-game-cards";
import { focusControl } from "./controller-navigation";
import { gameCardFieldIds, gameCardTagLimits, isCardPill, moveGameCardField, resetGameCardOrder, type GameCardFieldId, type GameCardPreferences, type UpdateGameCardPreferences } from "./game-card-preferences";

export function GameCardSettings({ language, preferences, onChange }: { language: Language; preferences: GameCardPreferences; onChange: UpdateGameCardPreferences }) {
  const id = useId();
  const text = messages[language];
  const labels = gameCardSettingsLabels[language];
  const moves = metadataSourceLabels[language];
  const names: Record<GameCardFieldId, string> = {
    category: text.category,
    releaseDate: text.releaseDate,
    developer: text.developer,
    publisher: text.publisher,
    version: sourceMetadataLabels[language].version,
    playTime: labels.timePlayed,
    playedTimes: labels.playedTimes,
    compatibility: compatibilityLabels[language].title,
    tags: text.tags,
  };
  const move = (event: MouseEvent<HTMLButtonElement>, field: GameCardFieldId, direction: -1 | 1) => {
    const button = event.currentTarget;
    onChange(current => ({ ...current, fields: moveGameCardField(current.fields, field, direction) }));
    requestAnimationFrame(() => {
      if (!button.isConnected) return;
      const target = button.disabled ? button.parentElement?.querySelector<HTMLButtonElement>("button:not(:disabled)") : button;
      if (target) focusControl(target);
    });
  };
  return <div className="settings-option game-card-settings">
    <label className="settings-toggle">
      <input type="checkbox" checked={preferences.showRating} onChange={event => {
        const showRating = event.target.checked;
        onChange(current => ({ ...current, showRating }));
      }} />
      <span>{labels.rating}</span>
    </label>
    <small>{labels.ratingHint}</small>
    <label className="settings-controller-row settings-tag-limit">
      <span>{gameCardTagLimitLabels[language].title}</span>
      <div className="settings-select-wrap">
        <select value={preferences.maxTags} disabled={!preferences.fields.find(field => field.id === "tags")?.enabled}
          onChange={event => {
            const maxTags = Number(event.target.value);
            onChange(current => ({ ...current, maxTags }));
          }}>
          {gameCardTagLimits.map(limit => <option key={limit} value={limit}>{limit ? String(limit) : gameCardTagLimitLabels[language].all}</option>)}
        </select>
        <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
      </div>
    </label>
    <small>{gameCardTagLimitLabels[language].hint}</small>
    <fieldset className="metadata-sources game-card-metadata-settings">
      <legend>{labels.title}</legend>
      <ol>
        {preferences.fields.map((field, index) => <li key={field.id} className={field.enabled ? "" : "is-disabled"} data-card-field={field.id}
          data-card-pair={isCardPill(field.id) ? "" : undefined}>
          <label className="settings-toggle metadata-source-check">
            <input id={`${id}-${field.id}`} type="checkbox" checked={field.enabled}
              onChange={event => {
                const enabled = event.target.checked;
                onChange(current => ({ ...current, fields: current.fields.map(entry => entry.id === field.id ? { ...entry, enabled } : entry) }));
              }} />
          </label>
          <button type="button" className="icon" title={moves.moveUp} aria-label={`${moves.moveUp}: ${names[field.id]}`} disabled={index === 0} onClick={event => move(event, field.id, -1)}>
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button type="button" className="icon" title={moves.moveDown} aria-label={`${moves.moveDown}: ${names[field.id]}`} disabled={index === preferences.fields.length - 1} onClick={event => move(event, field.id, 1)}>
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <label htmlFor={`${id}-${field.id}`} className="metadata-source-name"><span>{names[field.id]}</span></label>
        </li>)}
      </ol>
      <small>{labels.hint}</small>
      <button type="button" className="secondary game-card-order-reset"
        disabled={preferences.fields.every((field, index) => field.id === gameCardFieldIds[index])}
        onClick={event => {
          const button = event.currentTarget;
          onChange(current => ({ ...current, fields: resetGameCardOrder(current.fields) }));
          requestAnimationFrame(() => {
            if (!button.isConnected) return;
            const first = button.parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (first) focusControl(first);
          });
        }}>
        <RotateCcw size={14} aria-hidden="true" />{labels.resetOrder}
      </button>
    </fieldset>
  </div>;
}

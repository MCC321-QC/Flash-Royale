import type { HistoryLabels } from "./i18n-history";
import type { ActivityEntry } from "./types";

const fill = (template: string, n: number | undefined) => template.replace("{n}", String(n ?? 0));

export function currentActivity(entries: ActivityEntry[]) {
  const visible = entries.filter(entry => entry.status !== "running" || !entry.suppressWhileRunning);
  return visible.find(entry => entry.status === "running") ?? visible[0] ?? null;
}

/** The headline and the outcome line an activity entry shows in the history and progress windows. */
export function describeActivity(entry: ActivityEntry, text: HistoryLabels) {
  if (entry.kind === "notice") return { name: entry.text || text.kinds.notice, summary: "" };
  const name = text.kinds[entry.kind] || entry.kind;
  if (entry.status === "running") {
    const stage = entry.progress?.stage === "downloading" ? text.downloading : entry.progress?.stage === "preparing" ? text.preparing : "";
    return { name, summary: entry.progress?.label || stage || text.working };
  }
  if (entry.status === "failed") return { name, summary: entry.detail || text.status.failed };
  if (entry.status === "interrupted") return { name, summary: text.status.interrupted };
  const results = text.results;
  let summary = "";
  switch (entry.kind) {
    case "flashpointScan":
      summary = entry.count ? "" : results.noChanges;
      break;
    case "localImport":
    case "exploreImport":
    case "flashpointImport":
      summary = [fill(results.imported, entry.count), entry.skipped ? fill(results.skipped, entry.skipped) : ""].filter(Boolean).join(" · ");
      break;
    case "flashpointMetadata":
    case "metadataApply":
      summary = entry.count ? fill(results.gamesUpdated, entry.count) : results.noChanges;
      break;
    case "antivirusScan":
      summary = fill(results.gamesChecked, entry.count);
      break;
    case "antivirusThreat":
      summary = results.threat;
      break;
    case "securityAlert":
      summary = results.securityAlert;
      break;
    case "appUpdate":
      summary = results.restarting;
      break;
    case "ruffleNightly":
    case "sourcesCheck":
      summary = entry.count ? results.installed : results.upToDate;
      break;
    case "storageMigration":
      summary = fill(results.gamesMoved, entry.count);
      break;
    case "coverCapture":
      summary = fill(results.coversCreated, entry.count);
      break;
    case "guideAdd":
    case "guideDownload":
      summary = entry.detail || "";
      break;
    case "musicCheck":
      summary = fill(results.tracksChecked, entry.count);
      break;
    case "musicNormalize":
      summary = fill(results.tracksNormalized, entry.count);
      break;
    default:
      summary = "";
  }
  return { name, summary };
}

/** 0–100 for a determinate bar, or null while the amount of work is unknown. */
export function activityPercent(entry: ActivityEntry) {
  if (entry.status !== "running") return 100;
  const progress = entry.progress;
  if (!progress) return null;
  if (typeof progress.percent === "number") return progress.percent;
  if (progress.total) return Math.min(100, ((progress.current ?? 0) / progress.total) * 100);
  return null;
}

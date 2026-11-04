import type { ReactNode } from "react";

/** `https://github.com/<owner>/<repo>` from a release page URL, or "" when it isn't a GitHub release. */
export function repositoryFromReleaseUrl(releaseUrl: string) {
  try {
    const url = new URL(releaseUrl);
    const match = /^\/([^/]+)\/([^/]+)\/releases\//.exec(url.pathname);
    return url.origin === "https://github.com" && match ? `https://github.com/${match[1]}/${match[2]}` : "";
  } catch {
    return "";
  }
}

// Order matters: at the same position, earlier alternatives win, so commit hashes inside URLs stay part of the URL.
const inlinePattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|(^|[\s(])#(\d{1,7})\b|\b([0-9a-f]{7,40})\b/gi;

/** A commit hash has both letters and digits, so words like "added" or numbers like "2024010" are left alone. */
function isCommitHash(value: string) {
  return /[0-9]/.test(value) && /[a-f]/i.test(value) && /^[0-9a-f]+$/.test(value);
}

interface ChangelogToken {
  type: "text" | "link" | "code" | "strong";
  text: string;
  url?: string;
}

export function tokenizeChangelogLine(line: string, repository: string): ChangelogToken[] {
  const tokens: ChangelogToken[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last?.type === "text") last.text += text;
    else tokens.push({ type: "text", text });
  };
  let index = 0;
  for (const match of line.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    const [whole, linkText, linkUrl, bareUrl, code, strong, issuePrefix, issue, hash] = match;
    if (hash !== undefined && (!repository || !isCommitHash(hash))) continue;
    if (issue !== undefined && !repository) continue;
    pushText(line.slice(index, start));
    if (linkUrl) tokens.push({ type: "link", text: linkText, url: linkUrl });
    else if (bareUrl) {
      // Sentence punctuation right after a URL isn't part of it.
      const url = bareUrl.replace(/[.,;:!?'"]+$/, "");
      tokens.push({ type: "link", text: url, url });
      pushText(bareUrl.slice(url.length));
    } else if (code !== undefined) tokens.push({ type: "code", text: code });
    else if (strong !== undefined) tokens.push({ type: "strong", text: strong });
    else if (issue !== undefined) {
      pushText(issuePrefix);
      tokens.push({ type: "link", text: `#${issue}`, url: `${repository}/issues/${issue}` });
    } else if (hash !== undefined) tokens.push({ type: "link", text: hash, url: `${repository}/commit/${hash.toLowerCase()}` });
    else pushText(whole);
    index = start + whole.length;
  }
  pushText(line.slice(index));
  return tokens;
}

type Block = { type: "list"; items: string[] } | { type: "heading" | "paragraph"; text: string };

function parseBlocks(changelog: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of changelog.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "list") last.items.push(bullet[1]);
      else blocks.push({ type: "list", items: [bullet[1]] });
    } else if (heading) blocks.push({ type: "heading", text: heading[1] });
    else if (line.trim()) blocks.push({ type: "paragraph", text: line.trim() });
  }
  return blocks;
}

/** Release notes from GitHub with working links: URLs, markdown links, #issues and commit hashes. */
export function Changelog({ text, releaseUrl, emptyText, onOpenLink }: {
  text: string;
  releaseUrl: string;
  emptyText: string;
  onOpenLink: (url: string) => void;
}) {
  const repository = repositoryFromReleaseUrl(releaseUrl);
  const blocks = parseBlocks(text);
  const inline = (line: string): ReactNode[] => tokenizeChangelogLine(line, repository).map((token, index) => {
    if (token.type === "link") {
      return (
        <a key={index} href={token.url} title={token.url} dir="ltr" onClick={(event) => {
          event.preventDefault();
          onOpenLink(token.url!);
        }}>{token.text}</a>
      );
    }
    if (token.type === "code") return <code key={index}>{token.text}</code>;
    if (token.type === "strong") return <strong key={index}>{token.text}</strong>;
    return token.text;
  });
  return (
    <div className="update-changelog">
      {blocks.length === 0 ? <p>{emptyText}</p> : blocks.map((block, index) => {
        if (block.type === "list") return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>;
        if (block.type === "heading") return <h4 key={index}>{inline(block.text)}</h4>;
        return <p key={index}>{inline(block.text)}</p>;
      })}
    </div>
  );
}

/**
 * Lightweight inline Markdown → HTML renderer.
 * Supports: **bold**, __bold__, *italic*, _italic_,
 *           ~~strikethrough~~, `inline code`, ```code block```,
 *           [link](url)
 * Returns sanitised HTML string safe for dangerouslySetInnerHTML.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdown(text: string): string {
  // Split code blocks first (``` ... ```) to protect them
  const codeBlockRe = /```([^`]*)```/gs;
  const codeBlocks: string[] = [];

  let safe = text.replace(codeBlockRe, (_match, code) => {
    const idx = codeBlocks.push(escapeHtml(code.trim())) - 1;
    return `\x00CODEBLOCK${idx}\x00`;
  });

  // Inline code
  const inlineCodeRe = /`([^`]+)`/g;
  const inlineCodes: string[] = [];
  safe = safe.replace(inlineCodeRe, (_match, code) => {
    const idx = inlineCodes.push(escapeHtml(code)) - 1;
    return `\x00INLINECODE${idx}\x00`;
  });

  // Escape HTML in remaining text
  safe = escapeHtml(safe);

  // Bold (**text** or __text__)
  safe = safe.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
  safe = safe.replace(/__(.+?)__/gs, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  safe = safe.replace(/\*(.+?)\*/gs, '<em>$1</em>');
  safe = safe.replace(/_(.+?)_/gs, '<em>$1</em>');

  // Strikethrough
  safe = safe.replace(/~~(.+?)~~/gs, '<s>$1</s>');

  // Links
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-tg-blue underline">$1</a>');

  // Auto-link bare URLs
  safe = safe.replace(
    /(?<![">])(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-tg-blue underline">$1</a>'
  );

  // Restore inline code
  safe = safe.replace(/\x00INLINECODE(\d+)\x00/g, (_, i) =>
    `<code class="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-[13px] font-mono">${inlineCodes[Number(i)]}</code>`
  );

  // Restore code blocks
  safe = safe.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, i) =>
    `<pre class="bg-black/10 dark:bg-white/10 rounded-lg p-3 text-[13px] font-mono overflow-x-auto my-1 whitespace-pre-wrap"><code>${codeBlocks[Number(i)]}</code></pre>`
  );

  // Line breaks
  safe = safe.replace(/\n/g, '<br>');

  return safe;
}

export function hasMarkdown(text: string): boolean {
  return /(\*\*|__|\*|_|~~|`|\[.+\]\(https?:)/.test(text);
}

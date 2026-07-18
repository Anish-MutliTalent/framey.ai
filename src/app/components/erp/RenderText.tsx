/**
 * Renders plain text with URLs auto-converted to clickable links.
 * Drop-in replacement wherever you'd use <p> or <span> for body text.
 */

const URL_REGEX = /(https?:\/\/[^\s<>"]+)/g;

interface Props {
  text?: string | null;
  className?: string;
  style?: React.CSSProperties;
  tag?: 'p' | 'span' | 'div';
}

export function RenderText({ text, className = '', style = {}, tag = 'p' }: Props) {
  if (!text) return null;

  const parts = text.split(URL_REGEX);
  const children = parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // Reset lastIndex after test
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-70 transition-opacity break-all"
          style={{ color: 'inherit' }}
          onClick={e => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    URL_REGEX.lastIndex = 0;
    return <span key={i}>{part}</span>;
  });

  const Tag = tag;
  return <Tag className={className} style={style}>{children}</Tag>;
}

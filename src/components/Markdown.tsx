import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function Markdown({ content }: { content: string }) {
  const html = useMemo(() => {
    const parsed = marked.parse(content ?? '', { async: false }) as string;
    return DOMPurify.sanitize(parsed);
  }, [content]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

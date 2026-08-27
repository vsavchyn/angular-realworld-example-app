import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const PURIFY_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
  FORBID_ATTR: ['style'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function Markdown({ content }: { content: string }) {
  const html = useMemo(() => {
    const parsed = marked.parse(content ?? '', { async: false }) as string;
    return DOMPurify.sanitize(parsed, PURIFY_CONFIG);
  }, [content]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

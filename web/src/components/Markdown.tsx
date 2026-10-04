import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders user Markdown safely (raw HTML is not allowed); links open in a new tab. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

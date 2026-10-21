import React from "react";
import DOMPurify from "dompurify";

interface PostRendererProps {
  content: string;
}

const PostRenderer: React.FC<PostRendererProps> = ({ content }) => {
  // Legacy text parser for backward compatibility
  const renderTextWithMentions = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => 
      part.startsWith('@') ? (
        <span key={i} className="text-brand-orange font-semibold cursor-pointer hover:underline">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // Smart check: Does this look like an HTML string?
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  return (
    <>
      <style>
        {`
          /* Shared Tiptap HTML Content Styling */
          .tiptap-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .tiptap-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .tiptap-content p { margin-bottom: 0.5rem; }
          .tiptap-content p:last-child { margin-bottom: 0; }
          .tiptap-content strong { font-weight: bold; }
          .tiptap-content em { font-style: italic; }
          .tiptap-content s { text-decoration: line-through; }
          .tiptap-content [data-type="mention"] { color: #f97316; font-weight: bold; background-color: #fff7ed; padding: 0.125rem 0.25rem; border-radius: 0.375rem; cursor: pointer; }
          .tiptap-content [data-type="hashtag"] { color: #3b82f6; font-weight: bold; background-color: #eff6ff; padding: 0.125rem 0.25rem; border-radius: 0.375rem; cursor: pointer; }
        `}
      </style>
      
      {isHtml ? (
        <div 
          className="tiptap-content text-gray-800 text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
        />
      ) : (
        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
          {renderTextWithMentions(content)}
        </p>
      )}
    </>
  );
};

export default PostRenderer;
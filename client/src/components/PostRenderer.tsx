import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";

interface PostRendererProps {
  content: string;
}

const PostRenderer: React.FC<PostRendererProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Smart check: Does this look like an HTML string?
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  // 🚨 1. INTERCEPT HTML CLICKS FOR ROUTING
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isHtml) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Handle Mentions
      if (target.dataset.type === "mention") {
        const username = target.textContent?.replace("@", "");
        if (username) navigate(`/profile/${username}`);
      }
      
      // Handle Hashtags
      if (target.dataset.type === "hashtag") {
        const tag = target.textContent?.replace("#", "");
        if (tag) navigate(`/explore?tag=${tag}`); 
      }
    };

    container.addEventListener("click", handleLinkClick);
    return () => container.removeEventListener("click", handleLinkClick);
  }, [navigate, isHtml, content]);

  // 🚨 2. UPGRADED LEGACY PARSER (Now uses React Router!)
  const renderTextWithMentions = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => 
      part.startsWith('@') ? (
        <span 
          key={i} 
          onClick={() => navigate(`/profile/${part.replace("@", "")}`)}
          className="text-brand-orange font-semibold cursor-pointer hover:underline"
        >
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // 🚨 3. SECURE DOMPURIFY (Whitelisting Tiptap attributes)
  const sanitizedContent = DOMPurify.sanitize(content, {
    ADD_ATTR: ['data-type', 'data-id', 'target'] 
  });

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
          
          /* Interactive Tags Polish */
          .tiptap-content [data-type="mention"] { color: #f97316; font-weight: bold; background-color: #fff7ed; padding: 0.125rem 0.375rem; border-radius: 0.375rem; cursor: pointer; transition: all 0.2s; }
          .tiptap-content [data-type="mention"]:hover { background-color: #ffedd5; text-decoration: underline; }
          
          .tiptap-content [data-type="hashtag"] { color: #3b82f6; font-weight: bold; background-color: #eff6ff; padding: 0.125rem 0.375rem; border-radius: 0.375rem; cursor: pointer; transition: all 0.2s; }
          .tiptap-content [data-type="hashtag"]:hover { background-color: #dbeafe; text-decoration: underline; }
          
          .tiptap-content a { color: #3b82f6; text-decoration: underline; cursor: pointer; }
        `}
      </style>
      
      {isHtml ? (
        <div 
          ref={containerRef}
          className="tiptap-content text-gray-800 text-[15px] sm:text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      ) : (
        <div className="text-gray-800 text-[15px] sm:text-base leading-relaxed whitespace-pre-wrap">
          {renderTextWithMentions(content)}
        </div>
      )}
    </>
  );
};

export default PostRenderer;
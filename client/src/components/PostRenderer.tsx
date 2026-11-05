import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";

interface PostRendererProps {
  content: string;
}

const PostRenderer: React.FC<PostRendererProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Safely check if content exists
  const safeContent = content || "";

  // Smart check: Does this look like an HTML string?
  const isHtml = /<[a-z][\s\S]*>/i.test(safeContent);

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
  }, [navigate, isHtml, safeContent]);

  // 🚨 2. FORMAT PLAIN TEXT (For older legacy posts)
  const renderTextWithMentions = (text: string) => {
    if (!text) return null;
    
    // Split by Mentions OR Hashtags
    const parts = text.split(/(@[\w_.]+)|(#[\w_]+)/g).filter(Boolean);
    
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span 
            key={i} 
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${part.replace("@", "")}`); }}
            className="text-brand-orange font-bold cursor-pointer hover:underline bg-brand-orange/10 px-1 rounded-md inline-block"
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('#')) {
        return (
          <span 
            key={i} 
            onClick={(e) => { e.stopPropagation(); navigate(`/explore?tag=${part.replace("#", "")}`); }}
            className="text-brand-blue font-bold cursor-pointer hover:underline bg-brand-blue/10 px-1 rounded-md inline-block"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatHtmlTags = (htmlString: string) => {
    if (!htmlString) return "";
    
    return htmlString
      .replace(/(^|[\s>\u00A0\u200B]|&nbsp;)(@[\w_.]+)/g, '$1<span data-type="mention" class="text-brand-orange font-bold cursor-pointer hover:underline bg-brand-orange/10 px-1 rounded-md" style="color: #ed7f23; font-weight: bold;">$2</span>')
      .replace(/(^|[\s>\u00A0\u200B]|&nbsp;)(#[\w_]+)/g, '$1<span data-type="hashtag" class="text-brand-blue font-bold cursor-pointer hover:underline bg-brand-blue/10 px-1 rounded-md" style="color: #1765a4; font-weight: bold;">$2</span>');
  };

  const rawContent = isHtml ? formatHtmlTags(safeContent) : safeContent;

  const sanitizedContent = DOMPurify.sanitize(rawContent, {
    ADD_ATTR: ['data-type', 'data-id', 'target', 'rel', 'class', 'style'],
    ADD_TAGS: ['span', 'div', 'p', 'ul', 'ol', 'li', 'strong', 'em', 's', 'a', 'br'],
    ALLOWED_URI_REGEXP: /^(https?|mailto|tel|data:image\/)/i 
  });

  return (
    <>
      <style>
        {`
          .tiptap-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .tiptap-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .tiptap-content p { margin-bottom: 0.5rem; }
          .tiptap-content p:last-child { margin-bottom: 0; }
          .tiptap-content strong { font-weight: bold; }
          .tiptap-content em { font-style: italic; }
          .tiptap-content s { text-decoration: line-through; }
          
          /* Updated link color to match brand blue */
          .tiptap-content a { color: #1765a4; text-decoration: underline; cursor: pointer; }
          
          /* Fallback CSS for badges in case Tailwind purges the strings (Matched to your exact brand opacity) */
          .tiptap-content [data-type="mention"] { background-color: rgba(237, 127, 35, 0.1); border-radius: 0.375rem; padding: 0.125rem 0.375rem; }
          .tiptap-content [data-type="mention"]:hover { text-decoration: underline; }
          .tiptap-content [data-type="hashtag"] { background-color: rgba(23, 101, 164, 0.1); border-radius: 0.375rem; padding: 0.125rem 0.375rem; }
          .tiptap-content [data-type="hashtag"]:hover { text-decoration: underline; }
        `}
      </style>
      
      {isHtml ? (
        <div 
          ref={containerRef}
          className="tiptap-content text-gray-800 text-[15px] sm:text-base leading-relaxed break-words"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      ) : (
        <div className="text-gray-800 text-[15px] sm:text-base leading-relaxed whitespace-pre-wrap break-words">
          {renderTextWithMentions(safeContent)}
        </div>
      )}
    </>
  );
};

export default PostRenderer;
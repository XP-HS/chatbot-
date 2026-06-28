import './ChatMessage.css';

/**
 * 简单的 Markdown 渲染器
 * 支持：**粗体**、*斜体*、`代码`、```代码块```、有序/无序列表
 */
function renderMarkdown(text) {
  if (!text) return '';

  let html = text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块 ```...```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // 行内代码 `...`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 粗体 **...**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 斜体 *...*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 无序列表
  html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // 换行
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function ChatMessage({ message }) {
  const { role, content, timestamp, streaming } = message;
  const isUser = role === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'bot-message'}`}>
      <div className="message-avatar">
        {isUser ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M8 9.5V12m8-2.5V12" />
            <path d="M8 15s1.5 2 4 2 4-2 4-2" />
          </svg>
        )}
      </div>
      <div className="message-content">
        <div className="message-bubble">
          {content ? (
            <span dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          ) : (
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          )}
          {streaming && <span className="cursor-blink">▌</span>}
        </div>
        {timestamp && <div className="message-time">{timestamp}</div>}
      </div>
    </div>
  );
}

export default ChatMessage;

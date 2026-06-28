import { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { sendChatMessage, sendChatMessageStream, getConversations, getMessages } from './api/difyApi';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState('');
  const [useStreaming, setUseStreaming] = useState(true); // 默认使用流式模式
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const streamControllerRef = useRef(null);

  // 生成稳定的用户ID
  const [userId] = useState(() => {
    const saved = localStorage.getItem('dify-user-id');
    if (saved) return saved;
    const newId = 'web-user-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('dify-user-id', newId);
    return newId;
  });

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 加载会话列表
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await getConversations(userId, 50);
      setConversations(data.data || []);
    } catch (err) {
      console.error('加载会话列表失败:', err);
    }
  };

  // 加载历史消息
  const loadHistoryMessages = async (convId) => {
    try {
      const data = await getMessages(convId, userId, 50);
      const msgs = [];
      // Dify 的 messages API 每条记录同时包含 query 和 answer
      // API 返回是倒序的（最新的在前）
      const reversedData = [...(data.data || [])].reverse();
      reversedData.forEach((msg) => {
        if (msg.query) {
          msgs.push({
            role: 'user',
            content: msg.query,
            timestamp: new Date(msg.created_at * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          });
        }
        if (msg.answer) {
          msgs.push({
            role: 'assistant',
            content: msg.answer,
            timestamp: new Date(msg.created_at * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          });
        }
      });
      setMessages(msgs);
    } catch (err) {
      console.error('加载历史消息失败:', err);
    }
  };

  // 格式化时间
  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 发送消息 - 流式模式
  const handleSend = useCallback((query) => {
    // 添加用户消息
    const userMsg = { role: 'user', content: query, timestamp: formatTime() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    if (useStreaming) {
      // 流式模式
      setMessages((prev) => [...prev, { role: 'assistant', content: '', timestamp: formatTime(), streaming: true }]);

      streamControllerRef.current = sendChatMessageStream(query, userId, conversationId, {
        onMessage: (data) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === 'assistant') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: (updated[lastIdx].content || '') + (data.answer || ''),
              };
            }
            return updated;
          });
        },
        onEnd: (data) => {
          // 保存会话ID并刷新会话列表
          if (data.conversation_id) {
            if (!conversationId) {
              setConversationId(data.conversation_id);
              setActiveConvId(data.conversation_id);
              loadConversations();
            }
          }
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === 'assistant') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                timestamp: formatTime(),
                streaming: false,
              };
            }
            return updated;
          });
          setLoading(false);
        },
        onError: (err) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === 'assistant') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: `❌ 错误: ${err.message}`,
                streaming: false,
              };
            }
            return updated;
          });
          setLoading(false);
        },
      });
    } else {
      // 阻塞模式
      setMessages((prev) => [...prev, { role: 'assistant', content: '', timestamp: formatTime() }]);

      sendChatMessage(query, userId, conversationId)
        .then((data) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: data.answer,
              timestamp: formatTime(),
            };
            return updated;
          });

          if (data.conversation_id) {
            if (!conversationId) {
              setConversationId(data.conversation_id);
              setActiveConvId(data.conversation_id);
              loadConversations();
            }
          }
        })
        .catch((err) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: `❌ 错误: ${err.message}`,
            };
            return updated;
          });
        })
        .finally(() => setLoading(false));
    }
  }, [useStreaming, userId, conversationId]);

  // 停止生成
  const handleStop = () => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
    }
    setLoading(false);
    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.role === 'assistant' && updated[lastIdx]?.streaming) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: (updated[lastIdx].content || '') + ' [已停止]',
          streaming: false,
        };
      }
      return updated;
    });
  };

  // 新建对话
  const handleNewChat = () => {
    handleStop();
    setMessages([]);
    setConversationId('');
    setActiveConvId('');
  };

  // 切换模式
  const toggleMode = () => {
    setUseStreaming((prev) => !prev);
  };

  return (
    <div className="app-container">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={(id) => {
          handleStop();
          setConversationId(id);
          setActiveConvId(id);
          loadHistoryMessages(id);
          setSidebarOpen(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setSidebarOpen(false);
        }}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="chat-container">
        <div className="chat-header">
          <div className="header-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="菜单">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h2>Dify AI 助手</h2>
          </div>
          <div className="header-actions">
            <button
              className={`mode-toggle ${useStreaming ? 'streaming' : 'blocking'}`}
              onClick={toggleMode}
              title="切换响应模式"
            >
              {useStreaming ? '⚡ 流式' : '📦 阻塞'}
            </button>
            {loading && useStreaming && (
              <button className="stop-button" onClick={handleStop}>
                停止
              </button>
            )}
          </div>
        </div>
        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                  <path d="M8 9.5V12m8-2.5V12" />
                  <path d="M8 15s1.5 2 4 2 4-2 4-2" />
                </svg>
              </div>
              <h3>你好！有什么可以帮你的？</h3>
              <p>我是基于 Dify 的 AI 助手，可以回答你的问题</p>
              <p className="mode-hint">当前模式：{useStreaming ? '流式响应（实时打字）' : '阻塞响应（一次性返回）'}</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}

export default App;

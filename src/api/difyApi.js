/**
 * Dify Chat API 服务层
 * Base URL: https://api.dify.ai/v1
 * API Key: app-hH0JtF6F8ei3f31LSWAqrjoP
 */

const BASE_URL = 'https://api.dify.ai/v1';
const API_KEY = 'app-hH0JtF6F8ei3f31LSWAqrjoP';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * 发送对话消息（阻塞模式）
 * @param {string} query - 用户输入
 * @param {string} user - 用户标识
 * @param {string} conversationId - 会话ID（可选，为空则创建新会话）
 * @returns {Promise<Object>} 响应数据
 */
export async function sendChatMessage(query, user = 'web-user', conversationId = '') {
  const body = {
    inputs: {},
    query,
    response_mode: 'blocking',
    conversation_id: conversationId,
    user,
  };

  const response = await fetch(`${BASE_URL}/chat-messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `请求失败: ${response.status}`);
  }

  return response.json();
}

/**
 * 发送对话消息（流式模式 - SSE）
 * @param {string} query - 用户输入
 * @param {string} user - 用户标识
 * @param {string} conversationId - 会话ID（可选）
 * @param {Object} callbacks - 回调函数 { onMessage, onEnd, onError }
 * @returns {AbortController} 用于取消请求的控制器
 */
export function sendChatMessageStream(query, user = 'web-user', conversationId = '', callbacks = {}) {
  const { onMessage, onEnd, onError } = callbacks;

  const body = {
    inputs: {},
    query,
    response_mode: 'streaming',
    conversation_id: conversationId,
    user,
  };

  const controller = new AbortController();

  fetch(`${BASE_URL}/chat-messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `请求失败: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.event === 'message') {
                onMessage && onMessage(data);
              } else if (data.event === 'message_end') {
                onEnd && onEnd(data);
              } else if (data.event === 'error') {
                onError && onError(new Error(data.message || '流式响应错误'));
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError && onError(err);
      }
    });

  return controller;
}

/**
 * 获取会话列表
 * @param {string} user - 用户标识
 * @param {number} limit - 返回数量
 * @returns {Promise<Object>}
 */
export async function getConversations(user = 'web-user', limit = 20) {
  const response = await fetch(
    `${BASE_URL}/conversations?user=${encodeURIComponent(user)}&limit=${limit}`,
    { headers }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `请求失败: ${response.status}`);
  }

  return response.json();
}

/**
 * 获取消息历史
 * @param {string} conversationId - 会话ID
 * @param {string} user - 用户标识
 * @param {number} limit - 返回数量
 * @returns {Promise<Object>}
 */
export async function getMessages(conversationId, user = 'web-user', limit = 20) {
  const response = await fetch(
    `${BASE_URL}/messages?conversation_id=${encodeURIComponent(conversationId)}&user=${encodeURIComponent(user)}&limit=${limit}`,
    { headers }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `请求失败: ${response.status}`);
  }

  return response.json();
}

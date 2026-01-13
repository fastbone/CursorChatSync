/**
 * Utility to extract conversation IDs from chat data structure
 */

export interface ConversationInfo {
  conversationId: string;
  data: any;
}

/**
 * Extract all conversations from chat data with their IDs
 */
export function extractConversations(chatData: any): Map<string, any> {
  const conversations = new Map<string, any>();

  if (!chatData || typeof chatData !== 'object') {
    return conversations;
  }

  // Strategy 1: If chat_data is an array
  if (Array.isArray(chatData)) {
    chatData.forEach((item, index) => {
      const id = extractConversationId(item, index);
      conversations.set(id, item);
    });
  } else {
    // Strategy 2: Look for common conversation keys
    const conversationKeys = [
      'conversations',
      'chats',
      'history',
      'messages',
      'conversationHistory',
      'chatHistory',
    ];

    for (const key of conversationKeys) {
      if (chatData[key] && Array.isArray(chatData[key])) {
        chatData[key].forEach((item: any, index: number) => {
          const id = extractConversationId(item, index);
          conversations.set(id, item);
        });
      }
    }

    // Strategy 3: If the entire object is a conversation
    const directId = extractConversationId(chatData, 0);
    if (directId && directId !== '0') {
      conversations.set(directId, chatData);
    }

    // Strategy 4: Look for nested conversation structures
    for (const [key, value] of Object.entries(chatData)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedId = extractConversationId(value, 0);
        if (nestedId && nestedId !== '0') {
          conversations.set(`${key}_${nestedId}`, value);
        }
      }
    }
  }

  return conversations;
}

/**
 * Extract a single conversation ID from a conversation object
 */
function extractConversationId(conversation: any, fallbackIndex: number): string {
  // Try common ID fields
  if (conversation?.conversationId) return String(conversation.conversationId);
  if (conversation?.chatId) return String(conversation.chatId);
  if (conversation?.id) return String(conversation.id);
  if (conversation?.uuid) return String(conversation.uuid);
  if (conversation?.conversation_id) return String(conversation.conversation_id);
  if (conversation?.chat_id) return String(conversation.chat_id);

  // Try to generate a stable ID from content
  if (conversation && typeof conversation === 'object') {
    try {
      const content = JSON.stringify(conversation);
      const hash = simpleHash(content);
      return `hash_${hash}`;
    } catch {
      return String(fallbackIndex);
    }
  }

  return String(fallbackIndex);
}

/**
 * Simple hash function for generating stable IDs
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

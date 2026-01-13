/**
 * Utility to extract conversation IDs from chat data structure
 * Handles various formats and provides fallback mechanisms
 */

export interface ConversationInfo {
  conversationId: string;
  data: any;
}

/**
 * Extract all conversations from chat data with their IDs
 * Returns a map of conversationId -> conversation data
 */
export function extractConversations(chatData: any): Map<string, any> {
  const conversations = new Map<string, any>();

  if (!chatData || typeof chatData !== 'object') {
    return conversations;
  }

  // Strategy 1: If chat_data is an object with conversation arrays
  if (Array.isArray(chatData)) {
    // Array of conversations
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
      // Use hash of first message or key content as ID
      const content = JSON.stringify(conversation);
      const hash = simpleHash(content);
      return `hash_${hash}`;
    } catch {
      // Fallback to index
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

/**
 * Filter conversations from chat data based on excluded conversation IDs
 */
export function filterExcludedConversations(
  chatData: any,
  excludedIds: Set<string>
): any {
  if (!chatData || excludedIds.size === 0) {
    return chatData;
  }

  const conversations = extractConversations(chatData);
  const filtered = new Map<string, any>();

  // Keep only non-excluded conversations
  for (const [id, data] of conversations.entries()) {
    if (!excludedIds.has(id)) {
      filtered.set(id, data);
    }
  }

  // Reconstruct the original structure
  return reconstructChatData(chatData, filtered);
}

/**
 * Reconstruct chat data structure with filtered conversations
 */
function reconstructChatData(originalData: any, filteredConversations: Map<string, any>): any {
  if (Array.isArray(originalData)) {
    return Array.from(filteredConversations.values());
  }

  // Try to preserve original structure
  const result: any = { ...originalData };

  // Update conversation arrays
  const conversationKeys = [
    'conversations',
    'chats',
    'history',
    'messages',
    'conversationHistory',
    'chatHistory',
  ];

  for (const key of conversationKeys) {
    if (result[key] && Array.isArray(result[key])) {
      result[key] = Array.from(filteredConversations.values());
    }
  }

  return result;
}

/**
 * Check if any conversations in chat data are locked
 */
export function getLockedConversationIds(
  chatData: any,
  isLockedFn: (conversationId: string) => Promise<boolean>
): Promise<Set<string>> {
  const conversations = extractConversations(chatData);
  const lockedIds = new Set<string>();

  // Check each conversation (in parallel would be better, but keeping it simple)
  const checks = Array.from(conversations.keys()).map(async (id) => {
    const isLocked = await isLockedFn(id);
    if (isLocked) {
      lockedIds.add(id);
    }
  });

  return Promise.all(checks).then(() => lockedIds);
}

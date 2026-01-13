/**
 * Chat Data Structure Validator
 * 
 * This module validates and documents the expected structure of Cursor chat data
 * stored in state.vscdb. Since the exact structure may vary, this validator
 * uses flexible heuristics while documenting assumptions.
 */

export interface ChatDataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedFormat?: 'array' | 'object_with_conversations' | 'object_single' | 'nested' | 'unknown';
  conversationCount: number;
  sampleKeys?: string[];
}

export interface ConversationStructure {
  hasId: boolean;
  hasMessages: boolean;
  hasTimestamp: boolean;
  idFields: string[];
  messageFields: string[];
  timestampFields: string[];
}

/**
 * Validate chat data structure
 */
export function validateChatData(chatData: any): ChatDataValidationResult {
  const result: ChatDataValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    conversationCount: 0,
  };

  // Basic type check
  if (chatData === null || chatData === undefined) {
    result.isValid = false;
    result.errors.push('Chat data is null or undefined');
    return result;
  }

  if (typeof chatData !== 'object') {
    result.isValid = false;
    result.errors.push(`Chat data must be an object, got ${typeof chatData}`);
    return result;
  }

  // Detect format
  if (Array.isArray(chatData)) {
    result.detectedFormat = 'array';
    result.conversationCount = chatData.length;
    
    // Validate array items
    chatData.forEach((item, index) => {
      const convResult = validateConversationStructure(item);
      if (!convResult.hasId) {
        result.warnings.push(`Conversation at index ${index} has no identifiable ID field`);
      }
      if (!convResult.hasMessages) {
        result.warnings.push(`Conversation at index ${index} has no messages array`);
      }
    });
  } else {
    // Object format - check for common conversation keys
    const conversationKeys = [
      'conversations',
      'chats',
      'history',
      'messages',
      'conversationHistory',
      'chatHistory',
    ];

    let foundConversationKey = false;
    for (const key of conversationKeys) {
      if (chatData[key] && Array.isArray(chatData[key])) {
        foundConversationKey = true;
        result.detectedFormat = 'object_with_conversations';
        result.conversationCount = chatData[key].length;
        result.sampleKeys = [key];
        break;
      }
    }

    if (!foundConversationKey) {
      // Check if the object itself is a conversation
      const convResult = validateConversationStructure(chatData);
      if (convResult.hasId || convResult.hasMessages) {
        result.detectedFormat = 'object_single';
        result.conversationCount = 1;
      } else {
        // Check for nested structures
        const nestedKeys = Object.keys(chatData).filter(key => {
          const value = chatData[key];
          return value && typeof value === 'object' && !Array.isArray(value);
        });
        
        if (nestedKeys.length > 0) {
          result.detectedFormat = 'nested';
          result.sampleKeys = nestedKeys.slice(0, 5);
          result.warnings.push('Detected nested structure - may contain multiple conversations');
        } else {
          result.detectedFormat = 'unknown';
          result.warnings.push('Could not detect conversation structure in chat data');
        }
      }
    }
  }

  // Check for empty data
  if (result.conversationCount === 0) {
    result.warnings.push('No conversations detected in chat data');
  }

  return result;
}

/**
 * Validate a single conversation structure
 */
export function validateConversationStructure(conversation: any): ConversationStructure {
  const result: ConversationStructure = {
    hasId: false,
    hasMessages: false,
    hasTimestamp: false,
    idFields: [],
    messageFields: [],
    timestampFields: [],
  };

  if (!conversation || typeof conversation !== 'object') {
    return result;
  }

  // Check for ID fields
  const idFields = ['id', 'conversationId', 'chatId', 'uuid', 'conversation_id', 'chat_id'];
  for (const field of idFields) {
    if (conversation[field] !== undefined) {
      result.hasId = true;
      result.idFields.push(field);
    }
  }

  // Check for message fields
  const messageFields = ['messages', 'message', 'chat', 'content', 'items'];
  for (const field of messageFields) {
    if (conversation[field] !== undefined) {
      if (Array.isArray(conversation[field])) {
        result.hasMessages = true;
        result.messageFields.push(field);
      }
    }
  }

  // Check for timestamp fields
  const timestampFields = [
    'timestamp',
    'createdAt',
    'updatedAt',
    'date',
    'time',
    'lastModified',
    'created_at',
    'updated_at',
  ];
  for (const field of timestampFields) {
    if (conversation[field] !== undefined) {
      result.hasTimestamp = true;
      result.timestampFields.push(field);
    }
  }

  return result;
}

/**
 * Get a summary of chat data structure for documentation
 */
export function getChatDataSummary(chatData: any): string {
  const validation = validateChatData(chatData);
  const summary: string[] = [];

  summary.push(`Format: ${validation.detectedFormat || 'unknown'}`);
  summary.push(`Conversations: ${validation.conversationCount}`);

  if (validation.sampleKeys && validation.sampleKeys.length > 0) {
    summary.push(`Sample keys: ${validation.sampleKeys.join(', ')}`);
  }

  if (validation.errors.length > 0) {
    summary.push(`Errors: ${validation.errors.length}`);
  }

  if (validation.warnings.length > 0) {
    summary.push(`Warnings: ${validation.warnings.length}`);
  }

  return summary.join(' | ');
}

/**
 * Document assumptions about chat data structure
 * 
 * ASSUMPTIONS:
 * 1. Chat data can be stored in multiple formats:
 *    - Array of conversation objects
 *    - Object with a 'conversations' or similar key containing an array
 *    - Single conversation object
 *    - Nested object structure
 * 
 * 2. Conversations may have:
 *    - ID fields: id, conversationId, chatId, uuid, conversation_id, chat_id
 *    - Message arrays: messages, message, chat, content, items
 *    - Timestamps: timestamp, createdAt, updatedAt, date, time, lastModified
 * 
 * 3. The state.vscdb database uses ItemTable with key-value pairs
 *    - Keys may contain 'chat' or 'conversation'
 *    - Values are typically JSON strings
 * 
 * 4. When no ID is found, we generate a hash-based ID from content
 */
export const CHAT_DATA_ASSUMPTIONS = {
  formats: ['array', 'object_with_conversations', 'object_single', 'nested'],
  idFields: ['id', 'conversationId', 'chatId', 'uuid', 'conversation_id', 'chat_id'],
  messageFields: ['messages', 'message', 'chat', 'content', 'items'],
  timestampFields: [
    'timestamp',
    'createdAt',
    'updatedAt',
    'date',
    'time',
    'lastModified',
    'created_at',
    'updated_at',
  ],
  databaseTable: 'ItemTable',
  databaseKeyPattern: ['%chat%', '%conversation%'],
};

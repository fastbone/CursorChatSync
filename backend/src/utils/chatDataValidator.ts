/**
 * Chat Data Structure Validator (Backend)
 * 
 * This module validates chat data received from the extension.
 * It ensures data integrity before storing in the database.
 */

export interface ChatDataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conversationCount: number;
}

/**
 * Validate chat data structure before storing
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

  // Check for circular references (basic check)
  try {
    JSON.stringify(chatData);
  } catch (error: any) {
    if (error.message.includes('circular')) {
      result.isValid = false;
      result.errors.push('Chat data contains circular references');
      return result;
    }
  }

  // Count conversations using heuristics
  if (Array.isArray(chatData)) {
    result.conversationCount = chatData.length;
  } else {
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
        result.conversationCount = chatData[key].length;
        break;
      }
    }

    // If no array found, might be a single conversation
    if (result.conversationCount === 0) {
      if (chatData.id || chatData.conversationId || chatData.messages) {
        result.conversationCount = 1;
      }
    }
  }

  // Size check (prevent extremely large payloads)
  const dataSize = JSON.stringify(chatData).length;
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (dataSize > maxSize) {
    result.warnings.push(`Chat data is large (${(dataSize / 1024 / 1024).toFixed(2)}MB)`);
  }

  // Check for empty data
  if (result.conversationCount === 0) {
    result.warnings.push('No conversations detected in chat data');
  }

  return result;
}

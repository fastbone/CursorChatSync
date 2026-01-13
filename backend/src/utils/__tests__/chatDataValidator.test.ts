import { validateChatData } from '../chatDataValidator';

describe('chatDataValidator', () => {
  describe('validateChatData', () => {
    it('should reject null data', () => {
      const result = validateChatData(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Chat data is null or undefined');
    });

    it('should reject undefined data', () => {
      const result = validateChatData(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Chat data is null or undefined');
    });

    it('should reject non-object data', () => {
      const result = validateChatData('string');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Chat data must be an object, got string');
    });

    it('should validate array format', () => {
      const chatData = [
        { id: 'conv-1', messages: [] },
        { id: 'conv-2', messages: [] },
      ];
      const result = validateChatData(chatData);
      expect(result.isValid).toBe(true);
      expect(result.conversationCount).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate object with conversations array', () => {
      const chatData = {
        conversations: [
          { id: 'conv-1', messages: [] },
          { id: 'conv-2', messages: [] },
        ],
      };
      const result = validateChatData(chatData);
      expect(result.isValid).toBe(true);
      expect(result.conversationCount).toBe(2);
    });

    it('should validate single conversation object', () => {
      const chatData = {
        id: 'conv-1',
        messages: [],
      };
      const result = validateChatData(chatData);
      expect(result.isValid).toBe(true);
      expect(result.conversationCount).toBe(1);
    });

    it('should detect empty conversations and warn', () => {
      const chatData = {};
      const result = validateChatData(chatData);
      expect(result.isValid).toBe(true);
      expect(result.conversationCount).toBe(0);
      expect(result.warnings).toContain('No conversations detected in chat data');
    });

    it('should warn about large data', () => {
      // Create a large object (simulate)
      const largeData = { data: 'x'.repeat(11 * 1024 * 1024) }; // 11MB
      const result = validateChatData(largeData);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('large'))).toBe(true);
    });

    it('should detect circular references', () => {
      const chatData: any = { id: 'conv-1' };
      chatData.self = chatData; // Create circular reference
      
      const result = validateChatData(chatData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('circular'))).toBe(true);
    });

    it('should handle different conversation key names', () => {
      const testCases = [
        { conversations: [{ id: '1' }] },
        { chats: [{ id: '1' }] },
        { history: [{ id: '1' }] },
        { messages: [{ id: '1' }] },
        { conversationHistory: [{ id: '1' }] },
        { chatHistory: [{ id: '1' }] },
      ];

      testCases.forEach((chatData) => {
        const result = validateChatData(chatData);
        expect(result.isValid).toBe(true);
        expect(result.conversationCount).toBe(1);
      });
    });
  });
});

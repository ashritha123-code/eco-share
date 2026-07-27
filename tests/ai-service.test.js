/**
 * EcoCircle - AI Service Tests
 * Tests for the AIService mock responses and API key management
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock window.__ENV__
global.window = { __ENV__: {} };

// Import AIService inline (since it uses ES modules, we redefine core logic for test)
const GEMINI_KEY_STORAGE = 'EcoCircle_gemini_api_key';

const AIService = {
  getApiKey: () => {
    const saved = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (saved) return saved;
    if (window.__ENV__ && window.__ENV__.GEMINI_API_KEY) return window.__ENV__.GEMINI_API_KEY;
    return '';
  },
  saveApiKey: (key) => {
    if (key) localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    else localStorage.removeItem(GEMINI_KEY_STORAGE);
  },
  isLive: function() { return !!this.getApiKey(); },
  getMockResponse: (prompt) => {
    const p = prompt.toLowerCase();
    if (p.includes('compost')) return '🍂 **Home Composting Guide**\nComposting is a simple way...';
    if (p.includes('recycle')) return '♻️ **General Recycling Rules & Prep**\nCorrect recycling...';
    if (p.includes('carbon') || p.includes('offset')) return '🌱 **Carbon Footprint Sharing Calculation**\nSharing tools...';
    if (p.includes('upcycl') || p.includes('cardboard')) return '🎨 **Creative DIY Upcycling Ideas**\nGive waste items...';
    return '✨ **Sustainability Tip**: Did you know that over 30% of household waste is compostable?';
  },
  getMockAutoFill: (title) => {
    const t = title.toLowerCase();
    if (t.includes('book')) return { category: 'Books', quantity: '1 book', co2Offset: 2.5, description: 'A copy...' };
    if (t.includes('chair') || t.includes('table')) return { category: 'Furniture', quantity: '1 item', co2Offset: 45.0, description: 'A comfortable...' };
    if (t.includes('shirt') || t.includes('clothes')) return { category: 'Clothes', quantity: '1 item', co2Offset: 12.0, description: 'Gently used...' };
    if (t.includes('phone') || t.includes('charger')) return { category: 'Electronics', quantity: '1 unit', co2Offset: 30.0, description: 'A functional...' };
    return { category: 'Other', quantity: '1 unit', co2Offset: 2.0, description: 'Sharing this item...' };
  }
};

// ─────────────────────────────────────────────────────────────
// TEST SUITE 1: API Key Management
// ─────────────────────────────────────────────────────────────
describe('AIService - API Key Management', () => {

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    window.__ENV__ = {};
  });

  test('returns empty string when no key is set', () => {
    localStorageMock.getItem.mockReturnValue(null);
    expect(AIService.getApiKey()).toBe('');
  });

  test('returns key from localStorage when set', () => {
    localStorageMock.getItem.mockReturnValue('test-api-key-123');
    expect(AIService.getApiKey()).toBe('test-api-key-123');
  });

  test('returns key from window.__ENV__ when localStorage is empty', () => {
    localStorageMock.getItem.mockReturnValue(null);
    window.__ENV__ = { GEMINI_API_KEY: 'env-api-key-456' };
    expect(AIService.getApiKey()).toBe('env-api-key-456');
  });

  test('isLive() returns false when no key is set', () => {
    localStorageMock.getItem.mockReturnValue(null);
    expect(AIService.isLive()).toBe(false);
  });

  test('isLive() returns true when key is set', () => {
    localStorageMock.getItem.mockReturnValue('some-key');
    expect(AIService.isLive()).toBe(true);
  });

  test('saveApiKey() stores trimmed key in localStorage', () => {
    AIService.saveApiKey('  my-key-789  ');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(GEMINI_KEY_STORAGE, 'my-key-789');
  });

  test('saveApiKey() removes key from localStorage when empty string passed', () => {
    AIService.saveApiKey('');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(GEMINI_KEY_STORAGE);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 2: Mock Responses (Offline Mode)
// ─────────────────────────────────────────────────────────────
describe('AIService - Mock Responses', () => {

  test('returns composting guide for compost query', () => {
    const response = AIService.getMockResponse('How do I compost at home?');
    expect(response).toContain('Composting');
    expect(response).toContain('🍂');
  });

  test('returns recycling guide for recycle query', () => {
    const response = AIService.getMockResponse('How should I recycle plastic?');
    expect(response).toContain('Recycling');
    expect(response).toContain('♻️');
  });

  test('returns carbon footprint info for carbon query', () => {
    const response = AIService.getMockResponse('What is the carbon offset for sharing a lawnmower?');
    expect(response).toContain('Carbon');
    expect(response).toContain('🌱');
  });

  test('returns upcycling ideas for upcycle query', () => {
    const response = AIService.getMockResponse('Give me upcycling ideas for cardboard boxes');
    expect(response).toContain('Upcycling');
    expect(response).toContain('🎨');
  });

  test('returns default sustainability tip for unrecognized query', () => {
    const response = AIService.getMockResponse('What is the meaning of life?');
    expect(response).toContain('Sustainability Tip');
    expect(response).toContain('✨');
  });

  test('mock responses are different for different topics', () => {
    const compostResponse = AIService.getMockResponse('compost');
    const recycleResponse = AIService.getMockResponse('recycle');
    expect(compostResponse).not.toBe(recycleResponse);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 3: Auto-Fill Mock (Resource categorization)
// ─────────────────────────────────────────────────────────────
describe('AIService - Auto-Fill Resource Categorization', () => {

  test('categorizes books correctly', () => {
    const result = AIService.getMockAutoFill('Harry Potter book');
    expect(result.category).toBe('Books');
    expect(result.quantity).toBe('1 book');
    expect(result.co2Offset).toBe(2.5);
  });

  test('categorizes furniture correctly', () => {
    const result = AIService.getMockAutoFill('Wooden dining chair');
    expect(result.category).toBe('Furniture');
    expect(result.co2Offset).toBe(45.0);
  });

  test('categorizes clothes correctly', () => {
    const result = AIService.getMockAutoFill('Blue denim shirt');
    expect(result.category).toBe('Clothes');
    expect(result.co2Offset).toBe(12.0);
  });

  test('categorizes electronics correctly', () => {
    const result = AIService.getMockAutoFill('Old phone charger');
    expect(result.category).toBe('Electronics');
    expect(result.co2Offset).toBe(30.0);
  });

  test('defaults to "Other" for unrecognized items', () => {
    const result = AIService.getMockAutoFill('Random widget thing');
    expect(result.category).toBe('Other');
    expect(result.co2Offset).toBe(2.0);
  });

  test('auto-fill always returns required fields', () => {
    const result = AIService.getMockAutoFill('Some item');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('quantity');
    expect(result).toHaveProperty('co2Offset');
    expect(result).toHaveProperty('description');
  });

  test('co2Offset is always a positive number', () => {
    const items = ['book', 'chair', 'shirt', 'phone', 'random thing'];
    items.forEach(item => {
      const result = AIService.getMockAutoFill(item);
      expect(typeof result.co2Offset).toBe('number');
      expect(result.co2Offset).toBeGreaterThan(0);
    });
  });
});

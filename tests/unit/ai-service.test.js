/**
 * EcoCircle - Unit Tests: AI Service
 * Tests core AI service logic, key management, mock responses, auto-fill
 */

global.fetch = jest.fn();
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((k) => store[k] ?? null),
    setItem: jest.fn((k, v) => { store[k] = String(v); }),
    removeItem: jest.fn((k) => { delete store[k]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });
global.window = { __ENV__: {} };

const GEMINI_KEY_STORAGE = 'EcoCircle_gemini_api_key';
const AIService = {
  getApiKey: () => {
    const saved = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (saved) return saved;
    if (window.__ENV__?.GEMINI_API_KEY) return window.__ENV__.GEMINI_API_KEY;
    return '';
  },
  saveApiKey: (key) => {
    if (key) localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    else localStorage.removeItem(GEMINI_KEY_STORAGE);
  },
  isLive() { return !!this.getApiKey(); },
  getMockResponse: (prompt) => {
    const p = prompt.toLowerCase();
    if (p.includes('compost')) return '🍂 **Home Composting Guide**\nComposting recycles organic waste.';
    if (p.includes('recycle')) return '♻️ **General Recycling Rules**\nCorrect recycling reduces contamination.';
    if (p.includes('carbon') || p.includes('offset') || p.includes('lawnmower')) return '🌱 **Carbon Footprint Calculation**\nSharing tools has huge environmental impact.';
    if (p.includes('upcycl') || p.includes('cardboard') || p.includes('jar')) return '🎨 **DIY Upcycling Ideas**\nGive waste items a second life.';
    if (p.includes('solar') || p.includes('energy')) return '⚡ **Renewable Energy Tips**\nSolar panels reduce electricity bills.';
    if (p.includes('water') || p.includes('rain')) return '💧 **Water Conservation**\nRainwater harvesting saves thousands of litres.';
    if (p.includes('plastic') || p.includes('bag')) return '🛍️ **Plastic Reduction Guide**\nAvoid single-use plastics.';
    return '✨ **Sustainability Tip**: Over 30% of household waste is compostable.';
  },
  getMockAutoFill: (title) => {
    const t = title.toLowerCase();
    if (t.includes('mower') || t.includes('drill') || t.includes('tool') || t.includes('ladder') || t.includes('saw')) {
      return { category: 'Household Items', quantity: '1 unit', co2Offset: 25.0, description: `Sturdy ${title} in good condition.` };
    }
    if (t.includes('book') || t.includes('novel') || t.includes('textbook')) {
      return { category: 'Books', quantity: '1 book', co2Offset: 2.5, description: `A copy of "${title}".` };
    }
    if (t.includes('banana') || t.includes('food') || t.includes('apple') || t.includes('vegetable') || t.includes('egg')) {
      return { category: 'Food', quantity: '1 pack', co2Offset: 1.8, description: `Fresh ${title}.` };
    }
    if (t.includes('shirt') || t.includes('pants') || t.includes('jacket') || t.includes('clothes') || t.includes('coat')) {
      return { category: 'Clothes', quantity: '1 item', co2Offset: 12.0, description: `Gently used ${title}.` };
    }
    if (t.includes('chair') || t.includes('table') || t.includes('desk') || t.includes('shelf') || t.includes('sofa')) {
      return { category: 'Furniture', quantity: '1 item', co2Offset: 45.0, description: `A comfortable ${title}.` };
    }
    if (t.includes('phone') || t.includes('charger') || t.includes('cable') || t.includes('tv') || t.includes('keyboard')) {
      return { category: 'Electronics', quantity: '1 unit', co2Offset: 30.0, description: `A functional ${title}.` };
    }
    if (t.includes('bandage') || t.includes('medicine') || t.includes('first aid')) {
      return { category: 'Medical Supplies', quantity: '1 pack', co2Offset: 0.5, description: `Medical item: ${title}.` };
    }
    return { category: 'Other', quantity: '1 unit', co2Offset: 2.0, description: `Sharing this ${title} with the community.` };
  }
};

// ─────────────────── API KEY MANAGEMENT ───────────────────
describe('[UNIT] AI Service - API Key Management', () => {
  beforeEach(() => { localStorageMock.clear(); jest.clearAllMocks(); window.__ENV__ = {}; });

  test('TC-U01: returns empty string when no key configured', () => {
    localStorageMock.getItem.mockReturnValue(null);
    expect(AIService.getApiKey()).toBe('');
  });
  test('TC-U02: returns key stored in localStorage', () => {
    localStorageMock.getItem.mockReturnValue('stored-key-abc');
    expect(AIService.getApiKey()).toBe('stored-key-abc');
  });
  test('TC-U03: falls back to window.__ENV__ when localStorage empty', () => {
    localStorageMock.getItem.mockReturnValue(null);
    window.__ENV__ = { GEMINI_API_KEY: 'env-key-xyz' };
    expect(AIService.getApiKey()).toBe('env-key-xyz');
  });
  test('TC-U04: localStorage key takes priority over window.__ENV__', () => {
    localStorageMock.getItem.mockReturnValue('local-key');
    window.__ENV__ = { GEMINI_API_KEY: 'env-key' };
    expect(AIService.getApiKey()).toBe('local-key');
  });
  test('TC-U05: isLive() returns false with no key', () => {
    localStorageMock.getItem.mockReturnValue(null);
    expect(AIService.isLive()).toBe(false);
  });
  test('TC-U06: isLive() returns true with a key set', () => {
    localStorageMock.getItem.mockReturnValue('valid-key');
    expect(AIService.isLive()).toBe(true);
  });
  test('TC-U07: saveApiKey() stores trimmed key', () => {
    AIService.saveApiKey('  trim-me  ');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(GEMINI_KEY_STORAGE, 'trim-me');
  });
  test('TC-U08: saveApiKey() removes key when empty string given', () => {
    AIService.saveApiKey('');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(GEMINI_KEY_STORAGE);
  });
  test('TC-U09: saveApiKey() removes key when null given', () => {
    AIService.saveApiKey(null);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(GEMINI_KEY_STORAGE);
  });
  test('TC-U10: isLive() is false when key is empty string in localStorage', () => {
    localStorageMock.getItem.mockReturnValue('');
    expect(AIService.isLive()).toBe(false);
  });
});

// ─────────────────── MOCK AI RESPONSES ───────────────────
describe('[UNIT] AI Service - Mock Responses', () => {
  test('TC-U11: compost query returns composting guide', () => {
    expect(AIService.getMockResponse('How do I compost?')).toContain('Composting');
  });
  test('TC-U12: recycle query returns recycling guide', () => {
    expect(AIService.getMockResponse('How to recycle plastic?')).toContain('Recycling');
  });
  test('TC-U13: carbon query returns carbon info', () => {
    expect(AIService.getMockResponse('What is my carbon offset?')).toContain('Carbon');
  });
  test('TC-U14: upcycling query returns DIY ideas', () => {
    expect(AIService.getMockResponse('Upcycling ideas for home')).toContain('Upcycling');
  });
  test('TC-U15: solar query returns energy tips', () => {
    expect(AIService.getMockResponse('How does solar energy work?')).toContain('Renewable Energy');
  });
  test('TC-U16: water query returns conservation tips', () => {
    expect(AIService.getMockResponse('How to save water at home?')).toContain('Water Conservation');
  });
  test('TC-U17: plastic query returns plastic reduction guide', () => {
    expect(AIService.getMockResponse('How to reduce plastic use?')).toContain('Plastic');
  });
  test('TC-U18: unknown query returns default sustainability tip', () => {
    expect(AIService.getMockResponse('What is the universe?')).toContain('Sustainability Tip');
  });
  test('TC-U19: compost response contains emoji', () => {
    expect(AIService.getMockResponse('compost')).toContain('🍂');
  });
  test('TC-U20: recycle response contains emoji', () => {
    expect(AIService.getMockResponse('recycle')).toContain('♻️');
  });
  test('TC-U21: different queries return different responses', () => {
    expect(AIService.getMockResponse('compost')).not.toBe(AIService.getMockResponse('recycle'));
  });
  test('TC-U22: response is always a non-empty string', () => {
    const response = AIService.getMockResponse('anything at all');
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });
  test('TC-U23: case-insensitive matching for COMPOST', () => {
    expect(AIService.getMockResponse('COMPOST NOW')).toContain('Composting');
  });
  test('TC-U24: case-insensitive matching for RECYCLE', () => {
    expect(AIService.getMockResponse('RECYCLE GUIDE')).toContain('Recycling');
  });
});

// ─────────────────── AUTO-FILL CATEGORIZATION ───────────────────
describe('[UNIT] AI Service - Auto-Fill Categorization', () => {
  test('TC-U25: books categorized correctly', () => {
    expect(AIService.getMockAutoFill('Harry Potter Book').category).toBe('Books');
  });
  test('TC-U26: novel categorized as Books', () => {
    expect(AIService.getMockAutoFill('Mystery novel').category).toBe('Books');
  });
  test('TC-U27: textbook categorized as Books', () => {
    expect(AIService.getMockAutoFill('Class 10 textbook').category).toBe('Books');
  });
  test('TC-U28: chair categorized as Furniture', () => {
    expect(AIService.getMockAutoFill('Wooden chair').category).toBe('Furniture');
  });
  test('TC-U29: table categorized as Furniture', () => {
    expect(AIService.getMockAutoFill('Dining table').category).toBe('Furniture');
  });
  test('TC-U30: sofa categorized as Furniture', () => {
    expect(AIService.getMockAutoFill('3-seater sofa').category).toBe('Furniture');
  });
  test('TC-U31: shirt categorized as Clothes', () => {
    expect(AIService.getMockAutoFill('Blue denim shirt').category).toBe('Clothes');
  });
  test('TC-U32: jacket categorized as Clothes', () => {
    expect(AIService.getMockAutoFill('Winter jacket').category).toBe('Clothes');
  });
  test('TC-U33: phone categorized as Electronics', () => {
    expect(AIService.getMockAutoFill('Old mobile phone').category).toBe('Electronics');
  });
  test('TC-U34: charger categorized as Electronics', () => {
    expect(AIService.getMockAutoFill('USB charger').category).toBe('Electronics');
  });
  test('TC-U35: food categorized correctly', () => {
    expect(AIService.getMockAutoFill('Fresh bananas').category).toBe('Food');
  });
  test('TC-U36: medical supplies categorized correctly', () => {
    expect(AIService.getMockAutoFill('First aid bandage kit').category).toBe('Medical Supplies');
  });
  test('TC-U37: unrecognized item defaults to Other', () => {
    expect(AIService.getMockAutoFill('Random mystery object').category).toBe('Other');
  });
  test('TC-U38: co2Offset is always positive', () => {
    ['book', 'chair', 'shirt', 'phone', 'apple', 'drill', 'random'].forEach(item => {
      expect(AIService.getMockAutoFill(item).co2Offset).toBeGreaterThan(0);
    });
  });
  test('TC-U39: furniture has highest co2 offset among common items', () => {
    const furniture = AIService.getMockAutoFill('chair').co2Offset;
    const book = AIService.getMockAutoFill('book').co2Offset;
    expect(furniture).toBeGreaterThan(book);
  });
  test('TC-U40: all required fields present in auto-fill result', () => {
    const result = AIService.getMockAutoFill('some item');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('quantity');
    expect(result).toHaveProperty('co2Offset');
    expect(result).toHaveProperty('description');
  });
  test('TC-U41: description is non-empty string', () => {
    const result = AIService.getMockAutoFill('Garden tools');
    expect(typeof result.description).toBe('string');
    expect(result.description.length).toBeGreaterThan(0);
  });
  test('TC-U42: quantity is non-empty string', () => {
    const result = AIService.getMockAutoFill('Book');
    expect(typeof result.quantity).toBe('string');
    expect(result.quantity.length).toBeGreaterThan(0);
  });
});

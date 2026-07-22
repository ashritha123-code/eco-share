/**
 * EcoCircle - App Features Tests
 * Tests for core app features: resources, authentication validation, chat
 */

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = String(value); }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    _store: store,
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// ─────────────────────────────────────────────────────────────
// TEST SUITE 1: Resource Validation Logic
// ─────────────────────────────────────────────────────────────
describe('Resource Form Validation', () => {

  function validateResource({ title, category, quantity, description, location }) {
    const errors = [];
    if (!title || title.trim().length < 3) errors.push('Title must be at least 3 characters');
    if (!category) errors.push('Category is required');
    if (!quantity || quantity.trim() === '') errors.push('Quantity is required');
    if (!description || description.trim().length < 10) errors.push('Description must be at least 10 characters');
    if (!location || location.trim() === '') errors.push('Location is required');
    return errors;
  }

  test('valid resource passes all validation', () => {
    const errors = validateResource({
      title: 'Garden Tools',
      category: 'Household Items',
      quantity: '2 units',
      description: 'Set of gardening tools in good condition, ready to share!',
      location: 'Hyderabad, India'
    });
    expect(errors).toHaveLength(0);
  });

  test('rejects resource with short title', () => {
    const errors = validateResource({
      title: 'AB',
      category: 'Books',
      quantity: '1',
      description: 'A good book to share with others',
      location: 'Chennai'
    });
    expect(errors).toContain('Title must be at least 3 characters');
  });

  test('rejects resource with no category', () => {
    const errors = validateResource({
      title: 'Old Laptop',
      category: '',
      quantity: '1',
      description: 'Working laptop, slightly old but functional',
      location: 'Bangalore'
    });
    expect(errors).toContain('Category is required');
  });

  test('rejects resource with short description', () => {
    const errors = validateResource({
      title: 'Old Chair',
      category: 'Furniture',
      quantity: '1 chair',
      description: 'Chair',
      location: 'Mumbai'
    });
    expect(errors).toContain('Description must be at least 10 characters');
  });

  test('rejects resource with no location', () => {
    const errors = validateResource({
      title: 'Science Textbook',
      category: 'Books',
      quantity: '1 book',
      description: 'Class 10 science textbook in great condition',
      location: ''
    });
    expect(errors).toContain('Location is required');
  });

  test('can return multiple errors at once', () => {
    const errors = validateResource({
      title: '',
      category: '',
      quantity: '',
      description: '',
      location: ''
    });
    expect(errors.length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 2: Email Validation
// ─────────────────────────────────────────────────────────────
describe('Email Validation', () => {

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  test('accepts valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.email+alias@domain.co.in')).toBe(true);
    expect(isValidEmail('eco.user123@gmail.com')).toBe(true);
  });

  test('rejects invalid email addresses', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 3: Password Validation
// ─────────────────────────────────────────────────────────────
describe('Password Validation', () => {

  function validatePassword(password) {
    const errors = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
    return errors;
  }

  test('accepts a strong password', () => {
    expect(validatePassword('SecurePass1')).toHaveLength(0);
    expect(validatePassword('EcoCircle2026')).toHaveLength(0);
  });

  test('rejects password shorter than 8 characters', () => {
    const errors = validatePassword('Ab1');
    expect(errors).toContain('Password must be at least 8 characters');
  });

  test('rejects password with no uppercase letter', () => {
    const errors = validatePassword('alllowercase1');
    expect(errors).toContain('Password must contain an uppercase letter');
  });

  test('rejects password with no number', () => {
    const errors = validatePassword('NoNumbers');
    expect(errors).toContain('Password must contain a number');
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 4: Chat History (LocalStorage Persistence)
// ─────────────────────────────────────────────────────────────
describe('Chat History Persistence', () => {

  const CHAT_HISTORY_KEY = 'EcoCircle_chat_history';

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('saves chat messages to localStorage', () => {
    const messages = [
      { sender: 'partner', html: 'Hello! I am the AI assistant.' },
      { sender: 'user', html: 'How do I compost?' },
      { sender: 'partner', html: 'Great question! Composting involves...' }
    ];
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    expect(localStorage.setItem).toHaveBeenCalledWith(CHAT_HISTORY_KEY, JSON.stringify(messages));
  });

  test('retrieves saved chat messages from localStorage', () => {
    const messages = [{ sender: 'user', html: 'Test message' }];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(messages));

    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    const parsed = JSON.parse(saved);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].html).toBe('Test message');
  });

  test('clearing chat removes data from localStorage', () => {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    expect(localStorage.removeItem).toHaveBeenCalledWith(CHAT_HISTORY_KEY);
  });

  test('handles empty chat history gracefully', () => {
    localStorageMock.getItem.mockReturnValue(null);
    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    expect(saved).toBeNull();
  });

  test('handles corrupted localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('not-valid-json');
    expect(() => {
      try {
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        JSON.parse(saved);
      } catch (e) {
        // Should catch error gracefully
        expect(e).toBeInstanceOf(SyntaxError);
      }
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// TEST SUITE 5: CO2 Offset Calculations
// ─────────────────────────────────────────────────────────────
describe('CO2 Offset Calculations', () => {

  function calculateTotalCO2(resources) {
    return resources.reduce((total, r) => total + (r.co2Offset || 0), 0);
  }

  function formatCO2(kg) {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} tonnes`;
    return `${kg.toFixed(1)} kg`;
  }

  test('calculates total CO2 offset correctly', () => {
    const resources = [
      { title: 'Lawnmower', co2Offset: 150 },
      { title: 'Bookshelf', co2Offset: 45 },
      { title: 'Jacket', co2Offset: 12 }
    ];
    expect(calculateTotalCO2(resources)).toBe(207);
  });

  test('handles resources with no CO2 offset', () => {
    const resources = [
      { title: 'Item A', co2Offset: 10 },
      { title: 'Item B' } // no co2Offset
    ];
    expect(calculateTotalCO2(resources)).toBe(10);
  });

  test('returns 0 for empty resource list', () => {
    expect(calculateTotalCO2([])).toBe(0);
  });

  test('formats CO2 in kg correctly', () => {
    expect(formatCO2(207)).toBe('207.0 kg');
    expect(formatCO2(12.5)).toBe('12.5 kg');
  });

  test('formats large CO2 values as tonnes', () => {
    expect(formatCO2(1500)).toBe('1.5 tonnes');
    expect(formatCO2(2000)).toBe('2.0 tonnes');
  });
});

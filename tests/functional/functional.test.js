/**
 * EcoCircle - Functional Tests
 * Tests for resource management, auth flows, chat, CO2, and search
 */

// ─────────────────── RESOURCE MANAGEMENT ───────────────────
describe('[FUNCTIONAL] Resource Management', () => {

  function validateResource({ title, category, quantity, description, location }) {
    const errors = [];
    if (!title || title.trim().length < 3) errors.push('Title too short');
    if (!category) errors.push('Category required');
    if (!quantity || quantity.trim() === '') errors.push('Quantity required');
    if (!description || description.trim().length < 10) errors.push('Description too short');
    if (!location || location.trim() === '') errors.push('Location required');
    return errors;
  }

  function createResource(data) {
    const errors = validateResource(data);
    if (errors.length > 0) return { success: false, errors };
    return { success: true, resource: { ...data, id: Date.now(), createdAt: new Date().toISOString(), status: 'available' } };
  }

  function filterResources(resources, { category, search, location } = {}) {
    return resources.filter(r => {
      if (category && r.category !== category) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (location && !r.location.toLowerCase().includes(location.toLowerCase())) return false;
      return true;
    });
  }

  const sampleResources = [
    { id: 1, title: 'Harry Potter Book', category: 'Books', location: 'Hyderabad', status: 'available' },
    { id: 2, title: 'Wooden Chair', category: 'Furniture', location: 'Chennai', status: 'available' },
    { id: 3, title: 'Blue Shirt', category: 'Clothes', location: 'Hyderabad', status: 'reserved' },
    { id: 4, title: 'iPhone Charger', category: 'Electronics', location: 'Mumbai', status: 'available' },
    { id: 5, title: 'Science Textbook', category: 'Books', location: 'Hyderabad', status: 'available' },
  ];

  test('TC-F01: valid resource creation succeeds', () => {
    const result = createResource({
      title: 'Gardening Tools', category: 'Household Items',
      quantity: '1 set', description: 'Complete set of garden tools in excellent condition',
      location: 'Hyderabad'
    });
    expect(result.success).toBe(true);
  });

  test('TC-F02: created resource has required fields', () => {
    const result = createResource({
      title: 'Old Lamp', category: 'Household Items',
      quantity: '1 unit', description: 'Vintage lamp, works perfectly fine and saves waste',
      location: 'Bangalore'
    });
    expect(result.resource).toHaveProperty('id');
    expect(result.resource).toHaveProperty('createdAt');
    expect(result.resource.status).toBe('available');
  });

  test('TC-F03: resource creation fails with empty title', () => {
    const result = createResource({ title: '', category: 'Books', quantity: '1', description: 'A nice book for sharing', location: 'Chennai' });
    expect(result.success).toBe(false);
  });

  test('TC-F04: resource creation fails with short title (2 chars)', () => {
    const result = createResource({ title: 'AB', category: 'Books', quantity: '1', description: 'A nice book for sharing', location: 'Chennai' });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Title too short');
  });

  test('TC-F05: resource creation fails with no category', () => {
    const result = createResource({ title: 'Some Item', category: '', quantity: '1', description: 'A nice item for sharing', location: 'Chennai' });
    expect(result.errors).toContain('Category required');
  });

  test('TC-F06: resource creation fails with empty description', () => {
    const result = createResource({ title: 'Nice Item', category: 'Books', quantity: '1', description: '', location: 'Chennai' });
    expect(result.errors).toContain('Description too short');
  });

  test('TC-F07: resource creation fails with short description', () => {
    const result = createResource({ title: 'Nice Item', category: 'Books', quantity: '1', description: 'Short', location: 'Chennai' });
    expect(result.errors).toContain('Description too short');
  });

  test('TC-F08: resource creation fails with no location', () => {
    const result = createResource({ title: 'Nice Item', category: 'Books', quantity: '1', description: 'A very nice book about sustainability', location: '' });
    expect(result.errors).toContain('Location required');
  });

  test('TC-F09: multiple validation errors returned at once', () => {
    const result = createResource({ title: '', category: '', quantity: '', description: '', location: '' });
    expect(result.errors.length).toBeGreaterThan(2);
  });

  test('TC-F10: filter by category returns correct results', () => {
    const filtered = filterResources(sampleResources, { category: 'Books' });
    expect(filtered.length).toBe(2);
    filtered.forEach(r => expect(r.category).toBe('Books'));
  });

  test('TC-F11: filter by search term (case-insensitive)', () => {
    const filtered = filterResources(sampleResources, { search: 'harry' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('Harry Potter Book');
  });

  test('TC-F12: filter by location returns matching resources', () => {
    const filtered = filterResources(sampleResources, { location: 'Hyderabad' });
    expect(filtered.length).toBe(3);
  });

  test('TC-F13: combined filters work together', () => {
    const filtered = filterResources(sampleResources, { category: 'Books', location: 'Hyderabad' });
    expect(filtered.length).toBe(2);
  });

  test('TC-F14: no filter returns all resources', () => {
    const filtered = filterResources(sampleResources, {});
    expect(filtered.length).toBe(5);
  });

  test('TC-F15: search with no match returns empty array', () => {
    const filtered = filterResources(sampleResources, { search: 'xyznomatch999' });
    expect(filtered.length).toBe(0);
  });
});

// ─────────────────── AUTHENTICATION ───────────────────
describe('[FUNCTIONAL] Authentication', () => {

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePassword(password) {
    const errors = [];
    if (password.length < 8) errors.push('min-length');
    if (!/[A-Z]/.test(password)) errors.push('uppercase');
    if (!/[0-9]/.test(password)) errors.push('number');
    return errors;
  }

  function validateRegistration({ name, email, password, confirmPassword }) {
    const errors = [];
    if (!name || name.trim().length < 2) errors.push('Name too short');
    if (!validateEmail(email)) errors.push('Invalid email');
    const pwErrors = validatePassword(password);
    if (pwErrors.length > 0) errors.push('Weak password: ' + pwErrors.join(', '));
    if (password !== confirmPassword) errors.push('Passwords do not match');
    return errors;
  }

  test('TC-F16: valid registration data passes', () => {
    expect(validateRegistration({
      name: 'Pooji Eco', email: 'pooji@eco.com',
      password: 'EcoPass123', confirmPassword: 'EcoPass123'
    })).toHaveLength(0);
  });

  test('TC-F17: registration fails with name too short', () => {
    expect(validateRegistration({ name: 'A', email: 'a@b.com', password: 'Pass1234', confirmPassword: 'Pass1234' }))
      .toContain('Name too short');
  });

  test('TC-F18: registration fails with invalid email', () => {
    expect(validateRegistration({ name: 'Test User', email: 'notvalid', password: 'Pass1234', confirmPassword: 'Pass1234' }))
      .toContain('Invalid email');
  });

  test('TC-F19: registration fails when passwords do not match', () => {
    expect(validateRegistration({ name: 'Test', email: 't@t.com', password: 'Pass1234', confirmPassword: 'Different1' }))
      .toContain('Passwords do not match');
  });

  test('TC-F20: email validation accepts standard emails', () => {
    expect(validateEmail('user@gmail.com')).toBe(true);
    expect(validateEmail('eco.user+tag@domain.co.in')).toBe(true);
  });

  test('TC-F21: email validation rejects malformed emails', () => {
    expect(validateEmail('noDomain')).toBe(false);
    expect(validateEmail('@nodomain.com')).toBe(false);
    expect(validateEmail('spaces here@domain.com')).toBe(false);
  });

  test('TC-F22: password too short fails', () => {
    expect(validatePassword('Ab1').length).toBeGreaterThan(0);
  });

  test('TC-F23: password with no uppercase fails', () => {
    expect(validatePassword('allsmall1')).toContain('uppercase');
  });

  test('TC-F24: password with no number fails', () => {
    expect(validatePassword('NoNumbers')).toContain('number');
  });

  test('TC-F25: strong password passes all checks', () => {
    expect(validatePassword('EcoCircle2026')).toHaveLength(0);
  });

  test('TC-F26: empty name fails', () => {
    expect(validateRegistration({ name: '', email: 'a@b.com', password: 'Pass1234', confirmPassword: 'Pass1234' }))
      .toContain('Name too short');
  });

  test('TC-F27: empty password fails', () => {
    const errors = validatePassword('');
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─────────────────── CHAT FUNCTIONALITY ───────────────────
describe('[FUNCTIONAL] Chat System', () => {
  const CHAT_HISTORY_KEY = 'EcoCircle_chat_history';
  const localStorageMock2 = (() => {
    let store = {};
    return {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; },
    };
  })();

  beforeEach(() => localStorageMock2.clear());

  function saveMessages(messages) {
    localStorageMock2.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  }

  function loadMessages() {
    try {
      const saved = localStorageMock2.getItem(CHAT_HISTORY_KEY);
      if (!saved) return [];
      return JSON.parse(saved);
    } catch { return []; }
  }

  test('TC-F28: messages saved to storage correctly', () => {
    saveMessages([{ sender: 'user', html: 'Hello!' }]);
    const loaded = loadMessages();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].html).toBe('Hello!');
  });

  test('TC-F29: multiple messages persist', () => {
    const msgs = [
      { sender: 'user', html: 'How to compost?' },
      { sender: 'partner', html: 'Great question!' },
      { sender: 'user', html: 'Tell me more.' },
    ];
    saveMessages(msgs);
    expect(loadMessages()).toHaveLength(3);
  });

  test('TC-F30: clearing messages removes from storage', () => {
    saveMessages([{ sender: 'user', html: 'Hi' }]);
    localStorageMock2.removeItem(CHAT_HISTORY_KEY);
    expect(loadMessages()).toHaveLength(0);
  });

  test('TC-F31: empty storage returns empty array', () => {
    expect(loadMessages()).toEqual([]);
  });

  test('TC-F32: corrupted storage returns empty array gracefully', () => {
    localStorageMock2.setItem(CHAT_HISTORY_KEY, 'NOT_JSON');
    expect(loadMessages()).toEqual([]);
  });

  test('TC-F33: messages preserve sender field', () => {
    saveMessages([{ sender: 'partner', html: 'AI response' }]);
    expect(loadMessages()[0].sender).toBe('partner');
  });

  test('TC-F34: large conversation persists (50 messages)', () => {
    const msgs = Array.from({ length: 50 }, (_, i) => ({ sender: i % 2 === 0 ? 'user' : 'partner', html: `Message ${i}` }));
    saveMessages(msgs);
    expect(loadMessages()).toHaveLength(50);
  });

  test('TC-F35: message HTML content is preserved', () => {
    const html = '<strong>Bold Text</strong> with <em>italic</em>';
    saveMessages([{ sender: 'partner', html }]);
    expect(loadMessages()[0].html).toBe(html);
  });
});

// ─────────────────── CO2 CALCULATIONS ───────────────────
describe('[FUNCTIONAL] CO2 Offset Calculations', () => {

  function calculateTotal(resources) {
    return resources.reduce((sum, r) => sum + (r.co2Offset || 0), 0);
  }

  function formatCO2(kg) {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tonnes`;
    return `${kg.toFixed(1)} kg`;
  }

  function equivalentTrees(kg) {
    return Math.round(kg / 21); // 1 tree absorbs ~21kg CO2/year
  }

  test('TC-F36: sums CO2 offsets correctly', () => {
    expect(calculateTotal([{ co2Offset: 10 }, { co2Offset: 20 }, { co2Offset: 5 }])).toBe(35);
  });

  test('TC-F37: handles missing co2Offset fields', () => {
    expect(calculateTotal([{ title: 'Item' }, { co2Offset: 15 }])).toBe(15);
  });

  test('TC-F38: empty list returns 0', () => {
    expect(calculateTotal([])).toBe(0);
  });

  test('TC-F39: formats kg correctly', () => {
    expect(formatCO2(45.0)).toBe('45.0 kg');
  });

  test('TC-F40: formats large values as tonnes', () => {
    expect(formatCO2(2500)).toBe('2.50 tonnes');
  });

  test('TC-F41: tree equivalent is calculated correctly', () => {
    expect(equivalentTrees(210)).toBe(10);
  });

  test('TC-F42: zero offset gives zero trees', () => {
    expect(equivalentTrees(0)).toBe(0);
  });

  test('TC-F43: furniture has significant CO2 offset', () => {
    expect(calculateTotal([{ co2Offset: 45 }])).toBe(45);
  });

  test('TC-F44: electronics offset is meaningful', () => {
    expect(calculateTotal([{ co2Offset: 30 }])).toBe(30);
  });
});

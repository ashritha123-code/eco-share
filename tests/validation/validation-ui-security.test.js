/**
 * EcoCircle - Validation, UI/UX & Security Tests
 * Covers form validation, UI rendering logic, input sanitization, and security
 */

// ─────────────────── VALIDATION TESTS ───────────────────
describe('[VALIDATION] Form Field Validation', () => {

  const validators = {
    title: (v) => !!(v && v.trim().length >= 3 && v.trim().length <= 100),
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || ''),
    phone: (v) => /^[+]?[\d\s\-()]{7,15}$/.test(v || ''),
    url: (v) => { try { new URL(v); return true; } catch { return false; } },
    quantity: (v) => !!(v && v.trim().length > 0 && v.trim().length <= 50),
    description: (v) => !!(v && v.trim().length >= 10 && v.trim().length <= 1000),
    location: (v) => !!(v && v.trim().length >= 2),
    co2Offset: (v) => typeof v === 'number' && v >= 0 && isFinite(v),
    name: (v) => !!(v && v.trim().length >= 2 && v.trim().length <= 60),
    category: (v) => ['Food', 'Clothes', 'Books', 'Furniture', 'Electronics',
      'Kitchen Items', 'Medical Supplies', 'Educational Materials', 'Household Items', 'Other'].includes(v),
  };

  // Title validation
  test('TC-V01: title with 3 chars passes', () => expect(validators.title('ABC')).toBe(true));
  test('TC-V02: title with 50 chars passes', () => expect(validators.title('A'.repeat(50))).toBe(true));
  test('TC-V03: title with 2 chars fails', () => expect(validators.title('AB')).toBe(false));
  test('TC-V04: empty title fails', () => expect(validators.title('')).toBe(false));
  test('TC-V05: null title fails', () => expect(validators.title(null)).toBe(false));
  test('TC-V06: title with 101 chars fails', () => expect(validators.title('A'.repeat(101))).toBe(false));
  test('TC-V07: whitespace-only title fails', () => expect(validators.title('   ')).toBe(false));

  // Email validation
  test('TC-V08: standard email passes', () => expect(validators.email('user@domain.com')).toBe(true));
  test('TC-V09: subdomain email passes', () => expect(validators.email('u@sub.domain.co')).toBe(true));
  test('TC-V10: email with plus alias passes', () => expect(validators.email('a+b@c.com')).toBe(true));
  test('TC-V11: email without @ fails', () => expect(validators.email('nodomain.com')).toBe(false));
  test('TC-V12: email without TLD fails', () => expect(validators.email('a@b')).toBe(false));
  test('TC-V13: email starting with @ fails', () => expect(validators.email('@domain.com')).toBe(false));
  test('TC-V14: empty email fails', () => expect(validators.email('')).toBe(false));
  test('TC-V15: email with spaces fails', () => expect(validators.email('a b@c.com')).toBe(false));

  // Description validation
  test('TC-V16: description with 10 chars passes', () => expect(validators.description('Exactly ten')).toBe(true));
  test('TC-V17: description with 9 chars fails', () => expect(validators.description('Only nine')).toBe(false));
  test('TC-V18: empty description fails', () => expect(validators.description('')).toBe(false));
  test('TC-V19: null description fails', () => expect(validators.description(null)).toBe(false));
  test('TC-V20: long description (1000 chars) passes', () => expect(validators.description('A'.repeat(1000))).toBe(true));
  test('TC-V21: too long description (1001 chars) fails', () => expect(validators.description('A'.repeat(1001))).toBe(false));

  // Category validation
  test('TC-V22: Food is a valid category', () => expect(validators.category('Food')).toBe(true));
  test('TC-V23: Books is a valid category', () => expect(validators.category('Books')).toBe(true));
  test('TC-V24: Electronics is a valid category', () => expect(validators.category('Electronics')).toBe(true));
  test('TC-V25: invalid category fails', () => expect(validators.category('Weapons')).toBe(false));
  test('TC-V26: empty string fails category validation', () => expect(validators.category('')).toBe(false));
  test('TC-V27: case-sensitive category (lowercase) fails', () => expect(validators.category('food')).toBe(false));

  // CO2 Offset validation
  test('TC-V28: positive CO2 offset is valid', () => expect(validators.co2Offset(25.5)).toBe(true));
  test('TC-V29: zero CO2 offset is valid', () => expect(validators.co2Offset(0)).toBe(true));
  test('TC-V30: negative CO2 offset fails', () => expect(validators.co2Offset(-1)).toBe(false));
  test('TC-V31: string CO2 offset fails', () => expect(validators.co2Offset('25')).toBe(false));
  test('TC-V32: Infinity fails', () => expect(validators.co2Offset(Infinity)).toBe(false));
  test('TC-V33: NaN fails', () => expect(validators.co2Offset(NaN)).toBe(false));

  // Location validation
  test('TC-V34: valid location passes', () => expect(validators.location('Hyderabad')).toBe(true));
  test('TC-V35: single character location fails', () => expect(validators.location('A')).toBe(false));
  test('TC-V36: empty location fails', () => expect(validators.location('')).toBe(false));

  // Name validation
  test('TC-V37: valid name passes', () => expect(validators.name('Pooji')).toBe(true));
  test('TC-V38: single character name fails', () => expect(validators.name('A')).toBe(false));
  test('TC-V39: empty name fails', () => expect(validators.name('')).toBe(false));
  test('TC-V40: name with 60 chars passes', () => expect(validators.name('A'.repeat(60))).toBe(true));
  test('TC-V41: name with 61 chars fails', () => expect(validators.name('A'.repeat(61))).toBe(false));
});

// ─────────────────── UI/UX RENDERING TESTS ───────────────────
describe('[UI/UX] Rendering & Display Logic', () => {

  function formatTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  }

  function truncateText(text, maxLen = 80) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
  }

  function getStatusBadge(status) {
    const badges = {
      available: { label: 'Available', color: '#27ae60' },
      reserved: { label: 'Reserved', color: '#f39c12' },
      taken: { label: 'Taken', color: '#e74c3c' },
    };
    return badges[status] || { label: 'Unknown', color: '#95a5a6' };
  }

  function formatCO2Display(kg) {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t CO₂`;
    if (kg >= 1) return `${kg.toFixed(1)}kg CO₂`;
    return `${(kg * 1000).toFixed(0)}g CO₂`;
  }

  function getCategoryIcon(category) {
    const icons = {
      'Food': '🥗', 'Books': '📚', 'Electronics': '💻',
      'Furniture': '🪑', 'Clothes': '👕', 'Other': '📦'
    };
    return icons[category] || '📦';
  }

  test('TC-UI01: formatTimeAgo shows "just now" for recent times', () => {
    expect(formatTimeAgo(new Date())).toBe('just now');
  });

  test('TC-UI02: formatTimeAgo shows minutes for 5 min ago', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatTimeAgo(d)).toBe('5 min ago');
  });

  test('TC-UI03: formatTimeAgo shows hours for 3 hrs ago', () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatTimeAgo(d)).toBe('3 hr ago');
  });

  test('TC-UI04: formatTimeAgo shows days for yesterday', () => {
    const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(d)).toContain('days ago');
  });

  test('TC-UI05: truncateText returns full text when under limit', () => {
    expect(truncateText('Short text')).toBe('Short text');
  });

  test('TC-UI06: truncateText adds ellipsis when text is too long', () => {
    const long = 'A'.repeat(100);
    const result = truncateText(long, 80);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBe(80);
  });

  test('TC-UI07: truncateText at exact limit is not truncated', () => {
    const exact = 'A'.repeat(80);
    expect(truncateText(exact, 80)).toBe(exact);
  });

  test('TC-UI08: available status badge has green color', () => {
    expect(getStatusBadge('available').color).toBe('#27ae60');
  });

  test('TC-UI09: reserved status badge has orange color', () => {
    expect(getStatusBadge('reserved').color).toBe('#f39c12');
  });

  test('TC-UI10: taken status badge has red color', () => {
    expect(getStatusBadge('taken').color).toBe('#e74c3c');
  });

  test('TC-UI11: unknown status returns fallback badge', () => {
    expect(getStatusBadge('mystery').label).toBe('Unknown');
  });

  test('TC-UI12: CO2 display formats grams for small values', () => {
    expect(formatCO2Display(0.5)).toBe('500g CO₂');
  });

  test('TC-UI13: CO2 display formats kg for medium values', () => {
    expect(formatCO2Display(25.5)).toBe('25.5kg CO₂');
  });

  test('TC-UI14: CO2 display formats tonnes for large values', () => {
    expect(formatCO2Display(1500)).toBe('1.5t CO₂');
  });

  test('TC-UI15: Books category shows book emoji', () => {
    expect(getCategoryIcon('Books')).toBe('📚');
  });

  test('TC-UI16: Electronics category shows laptop emoji', () => {
    expect(getCategoryIcon('Electronics')).toBe('💻');
  });

  test('TC-UI17: Food category shows food emoji', () => {
    expect(getCategoryIcon('Food')).toBe('🥗');
  });

  test('TC-UI18: unknown category returns default emoji', () => {
    expect(getCategoryIcon('Mystery')).toBe('📦');
  });
});

// ─────────────────── SECURITY TESTS ───────────────────
describe('[SECURITY] Input Sanitization & XSS Prevention', () => {

  function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  function isSafeApiKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (key.length < 10 || key.length > 200) return false;
    if (/[\s<>\"'&]/.test(key)) return false;
    return true;
  }

  function containsSQLInjection(input) {
    const sqlPatterns = /(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b|\bSELECT\b.*\bFROM\b|--|;.*--|\/\*)/i;
    return sqlPatterns.test(input);
  }

  test('TC-S01: XSS script tag is escaped', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toContain('&lt;script&gt;');
  });

  test('TC-S02: HTML tags are escaped', () => {
    expect(sanitizeInput('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });

  test('TC-S03: double quotes are escaped', () => {
    expect(sanitizeInput('say "hello"')).toContain('&quot;');
  });

  test('TC-S04: single quotes are escaped', () => {
    expect(sanitizeInput("it's fine")).toContain('&#x27;');
  });

  test('TC-S05: ampersand is escaped', () => {
    expect(sanitizeInput('cats & dogs')).toContain('&amp;');
  });

  test('TC-S06: normal text passes through sanitization unchanged (except chars)', () => {
    const result = sanitizeInput('Hello World 123');
    expect(result).toBe('Hello World 123');
  });

  test('TC-S07: null input returns empty string', () => {
    expect(sanitizeInput(null)).toBe('');
  });

  test('TC-S08: non-string input returns empty string', () => {
    expect(sanitizeInput(123)).toBe('');
    expect(sanitizeInput([])).toBe('');
  });

  test('TC-S09: valid API key is considered safe', () => {
    expect(isSafeApiKey('AQ.Ab8RN6validkeyformat1234567890')).toBe(true);
  });

  test('TC-S10: API key with spaces is unsafe', () => {
    expect(isSafeApiKey('key with spaces')).toBe(false);
  });

  test('TC-S11: empty API key is unsafe', () => {
    expect(isSafeApiKey('')).toBe(false);
  });

  test('TC-S12: null API key is unsafe', () => {
    expect(isSafeApiKey(null)).toBe(false);
  });

  test('TC-S13: API key with HTML tags is unsafe', () => {
    expect(isSafeApiKey('<script>key</script>')).toBe(false);
  });

  test('TC-S14: SQL injection pattern detected in title', () => {
    expect(containsSQLInjection("'; DROP TABLE users; --")).toBe(true);
  });

  test('TC-S15: SQL SELECT detected', () => {
    expect(containsSQLInjection('SELECT * FROM resources')).toBe(true);
  });

  test('TC-S16: normal text has no SQL injection', () => {
    expect(containsSQLInjection('A nice book about gardening')).toBe(false);
  });

  test('TC-S17: slash in input is escaped', () => {
    expect(sanitizeInput('path/to/file')).toContain('&#x2F;');
  });
});

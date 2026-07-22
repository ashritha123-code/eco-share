'use strict';

/**
 * EcoShare - Authentication Test Suite
 * Tests: Registration, Login, Logout, Session, Role Assignment, Validation
 * Total: ~40 tests
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return { valid: false, errors: ['Password is required'] };
  const errors = [];
  if (password.length < 8) errors.push('Too short');
  if (!/[A-Z]/.test(password)) errors.push('Missing uppercase');
  if (!/[0-9]/.test(password)) errors.push('Missing number');
  return { valid: errors.length === 0, errors };
}

function validateName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 60;
}

function validateLocation(location) {
  if (!location || typeof location !== 'string') return false;
  return location.trim().length >= 2;
}

function isAdminEmail(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return ['admin@gmail.com', 'admin@ecocircle.com', 'admin@ecoshare.com', 'ashrithap2200.sse@saveetha.com'].includes(normalized);
}

function assignRole(email) {
  return isAdminEmail(email) ? 'admin' : 'resident';
}

function simulateRegister(name, email, password, location) {
  const errors = [];
  if (!validateName(name)) errors.push('Invalid name');
  if (!validateEmail(email)) errors.push('Invalid email');
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) errors.push(...pwCheck.errors);
  if (!validateLocation(location)) errors.push('Invalid location');
  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    user: {
      uid: `uid_${Date.now()}`,
      email,
      displayName: name,
      location,
      role: assignRole(email),
      approved: isAdminEmail(email),
      status: isAdminEmail(email) ? 'approved' : 'pending',
      createdAt: new Date().toISOString()
    }
  };
}

function simulateLogin(email, password, users) {
  const user = users.find(u => u.email === email);
  if (!user) return { success: false, error: 'Invalid email or password.' };
  if (user.password !== password) return { success: false, error: 'Invalid email or password.' };
  if (user.status === 'pending') return { success: false, error: 'Account pending approval.' };
  if (user.status === 'rejected') return { success: false, error: 'Account has been rejected.' };
  return { success: true, user };
}

function simulateLogout(session) {
  if (!session) return { success: false, error: 'No active session' };
  return { success: true, sessionCleared: true };
}

// ── Mocked Users DB ───────────────────────────────────────────────────────────
const MOCK_USERS = [
  { uid: 'admin_1', email: 'admin@ecoshare.com', password: 'EcoPass123', displayName: 'Admin', role: 'admin', status: 'approved' },
  { uid: 'user_1', email: 'john@example.com', password: 'UserPass1', displayName: 'John', role: 'resident', status: 'approved' },
  { uid: 'user_2', email: 'pending@example.com', password: 'Pending1A', displayName: 'Pending', role: 'resident', status: 'pending' },
  { uid: 'user_3', email: 'rejected@example.com', password: 'Reject1A', displayName: 'Rejected', role: 'resident', status: 'rejected' },
];

// ─────────────────────────────────────────────────────────────────────────────
describe('[AUTH] Registration Validation', () => {
  test('TC-AUTH-01: valid registration data passes', () => {
    const r = simulateRegister('Jane Doe', 'jane@example.com', 'SecurePass1', 'Downtown');
    expect(r.success).toBe(true);
    expect(r.user.email).toBe('jane@example.com');
  });

  test('TC-AUTH-02: registered user gets resident role by default', () => {
    const r = simulateRegister('Jane Doe', 'jane@example.com', 'SecurePass1', 'Downtown');
    expect(r.user.role).toBe('resident');
  });

  test('TC-AUTH-03: registered user status is pending by default', () => {
    const r = simulateRegister('Jane Doe', 'jane@example.com', 'SecurePass1', 'Downtown');
    expect(r.user.status).toBe('pending');
  });

  test('TC-AUTH-04: admin email gets admin role on registration', () => {
    const r = simulateRegister('Admin', 'admin@ecoshare.com', 'EcoPass123', 'HQ');
    expect(r.user.role).toBe('admin');
  });

  test('TC-AUTH-05: admin is auto-approved on registration', () => {
    const r = simulateRegister('Admin', 'admin@ecoshare.com', 'EcoPass123', 'HQ');
    expect(r.user.approved).toBe(true);
    expect(r.user.status).toBe('approved');
  });

  test('TC-AUTH-06: empty name fails registration', () => {
    const r = simulateRegister('', 'jane@example.com', 'SecurePass1', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-07: single character name fails registration', () => {
    const r = simulateRegister('J', 'jane@example.com', 'SecurePass1', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-08: 61-character name fails registration', () => {
    const r = simulateRegister('A'.repeat(61), 'jane@example.com', 'SecurePass1', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-09: 60-character name passes registration', () => {
    const r = simulateRegister('A'.repeat(60), 'jane@example.com', 'SecurePass1', 'Downtown');
    expect(r.success).toBe(true);
  });

  test('TC-AUTH-10: invalid email fails registration', () => {
    const r = simulateRegister('Jane Doe', 'not-an-email', 'SecurePass1', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-11: email without domain fails', () => {
    const r = simulateRegister('Jane Doe', 'jane@', 'SecurePass1', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-12: email with spaces fails', () => {
    const r = simulateRegister('Jane Doe', 'jane @example.com', 'SecurePass1', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-13: short password fails registration', () => {
    const r = simulateRegister('Jane Doe', 'jane@example.com', 'Sh0rt', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-14: password without uppercase fails', () => {
    const r = simulateRegister('Jane Doe', 'jane@example.com', 'nouppercase1', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-15: password without number fails', () => {
    const r = simulateRegister('Jane Doe', 'jane@example.com', 'NoNumberHere', 'Downtown');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-16: empty location fails registration', () => {
    const r = simulateRegister('Jane Doe', 'jane@example.com', 'SecurePass1', '');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-17: single character location fails', () => {
    const r = simulateRegister('Jane Doe', 'jane@example.com', 'SecurePass1', 'A');
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-18: multiple validation errors returned at once', () => {
    const r = simulateRegister('', 'bad-email', 'weak', '');
    expect(r.success).toBe(false);
    expect(r.errors.length).toBeGreaterThan(1);
  });

  test('TC-AUTH-19: registered user has uid assigned', () => {
    const r = simulateRegister('Test User', 'test@example.com', 'TestPass1', 'Central');
    expect(r.user.uid).toBeTruthy();
  });

  test('TC-AUTH-20: registered user has createdAt timestamp', () => {
    const r = simulateRegister('Test User', 'test@example.com', 'TestPass1', 'Central');
    expect(r.user.createdAt).toBeTruthy();
    expect(new Date(r.user.createdAt).getFullYear()).toBeGreaterThanOrEqual(2024);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[AUTH] Login Validation', () => {
  test('TC-AUTH-21: valid credentials login succeeds', () => {
    const r = simulateLogin('john@example.com', 'UserPass1', MOCK_USERS);
    expect(r.success).toBe(true);
    expect(r.user.email).toBe('john@example.com');
  });

  test('TC-AUTH-22: admin can login', () => {
    const r = simulateLogin('admin@ecoshare.com', 'EcoPass123', MOCK_USERS);
    expect(r.success).toBe(true);
    expect(r.user.role).toBe('admin');
  });

  test('TC-AUTH-23: wrong password returns invalid credentials error', () => {
    const r = simulateLogin('john@example.com', 'WrongPass1', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid/i);
  });

  test('TC-AUTH-24: non-existent email returns invalid credentials error', () => {
    const r = simulateLogin('nobody@example.com', 'AnyPass1', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid/i);
  });

  test('TC-AUTH-25: pending account cannot login', () => {
    const r = simulateLogin('pending@example.com', 'Pending1A', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/pending/i);
  });

  test('TC-AUTH-26: rejected account cannot login', () => {
    const r = simulateLogin('rejected@example.com', 'Reject1A', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/rejected/i);
  });

  test('TC-AUTH-27: empty email returns invalid error', () => {
    const r = simulateLogin('', 'AnyPass1', MOCK_USERS);
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-28: empty password returns invalid error', () => {
    const r = simulateLogin('john@example.com', '', MOCK_USERS);
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-29: login returns user object on success', () => {
    const r = simulateLogin('john@example.com', 'UserPass1', MOCK_USERS);
    expect(r.success).toBe(true);
    expect(r.user).toBeDefined();
    expect(r.user.uid).toBeDefined();
  });

  test('TC-AUTH-30: successful login user has correct role', () => {
    const r = simulateLogin('john@example.com', 'UserPass1', MOCK_USERS);
    expect(r.user.role).toBe('resident');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[AUTH] Logout & Session', () => {
  test('TC-AUTH-31: logout with active session succeeds', () => {
    const r = simulateLogout({ userId: 'user_1', token: 'abc123' });
    expect(r.success).toBe(true);
    expect(r.sessionCleared).toBe(true);
  });

  test('TC-AUTH-32: logout with no session fails gracefully', () => {
    const r = simulateLogout(null);
    expect(r.success).toBe(false);
  });

  test('TC-AUTH-33: logout with undefined session fails gracefully', () => {
    const r = simulateLogout(undefined);
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[AUTH] Role Management', () => {
  test('TC-AUTH-34: admin@ecoshare.com is recognized as admin', () => {
    expect(isAdminEmail('admin@ecoshare.com')).toBe(true);
  });

  test('TC-AUTH-35: admin@ecocircle.com is recognized as admin', () => {
    expect(isAdminEmail('admin@ecocircle.com')).toBe(true);
  });

  test('TC-AUTH-36: admin@gmail.com is recognized as admin', () => {
    expect(isAdminEmail('admin@gmail.com')).toBe(true);
  });

  test('TC-AUTH-37: saveetha email is recognized as admin', () => {
    expect(isAdminEmail('ashrithap2200.sse@saveetha.com')).toBe(true);
  });

  test('TC-AUTH-38: regular user email is not admin', () => {
    expect(isAdminEmail('john@example.com')).toBe(false);
  });

  test('TC-AUTH-39: email check is case-insensitive', () => {
    expect(isAdminEmail('ADMIN@ECOSHARE.COM')).toBe(true);
  });

  test('TC-AUTH-40: role assignment gives admin role to admin emails', () => {
    expect(assignRole('admin@ecoshare.com')).toBe('admin');
  });

  test('TC-AUTH-41: role assignment gives resident role to normal emails', () => {
    expect(assignRole('user@example.com')).toBe('resident');
  });

  test('TC-AUTH-42: null email is not admin', () => {
    expect(isAdminEmail(null)).toBe(false);
  });

  test('TC-AUTH-43: empty email is not admin', () => {
    expect(isAdminEmail('')).toBe(false);
  });
});

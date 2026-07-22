'use strict';

/**
 * EcoShare - Admin Workflow Test Suite
 * Tests: User approval, rejection, role management, dashboard stats
 * Total: ~30 tests
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
function approveUser(userId, users) {
  const user = users.find(u => u.uid === userId);
  if (!user) return { success: false, error: 'User not found' };
  if (user.status === 'approved') return { success: false, error: 'User already approved' };
  if (user.status === 'rejected') return { success: false, error: 'Cannot approve a rejected user' };
  return { success: true, user: { ...user, status: 'approved', approved: true, approvedAt: new Date().toISOString() } };
}

function rejectUser(userId, reason, users) {
  const user = users.find(u => u.uid === userId);
  if (!user) return { success: false, error: 'User not found' };
  if (user.status === 'rejected') return { success: false, error: 'User already rejected' };
  if (user.status === 'approved') return { success: false, error: 'Cannot reject an already approved user' };
  if (!reason || reason.trim().length < 3) return { success: false, error: 'Rejection reason required' };
  return { success: true, user: { ...user, status: 'rejected', approved: false, rejectedAt: new Date().toISOString(), rejectionReason: reason.trim() } };
}

function getPendingUsers(users) {
  return users.filter(u => u.status === 'pending');
}

function getApprovedUsers(users) {
  return users.filter(u => u.status === 'approved');
}

function getRejectedUsers(users) {
  return users.filter(u => u.status === 'rejected');
}

function getDashboardStats(users, resources) {
  return {
    totalUsers: users.length,
    pendingCount: users.filter(u => u.status === 'pending').length,
    approvedCount: users.filter(u => u.status === 'approved').length,
    rejectedCount: users.filter(u => u.status === 'rejected').length,
    adminCount: users.filter(u => u.role === 'admin').length,
    totalResources: resources.length,
    availableResources: resources.filter(r => r.status === 'Available').length,
    takenResources: resources.filter(r => r.status === 'Taken').length,
    totalCO2: resources.reduce((s, r) => s + (r.co2Offset || 0), 0)
  };
}

function canAccessAdminPanel(user) {
  if (!user) return false;
  return user.role === 'admin' && user.status === 'approved';
}

function changeUserRole(adminUser, targetUserId, newRole, users) {
  if (!canAccessAdminPanel(adminUser)) return { success: false, error: 'Unauthorized' };
  const target = users.find(u => u.uid === targetUserId);
  if (!target) return { success: false, error: 'User not found' };
  const validRoles = ['resident', 'admin', 'volunteer', 'ngo'];
  if (!validRoles.includes(newRole)) return { success: false, error: 'Invalid role' };
  return { success: true, user: { ...target, role: newRole } };
}

// ── Sample Data ───────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { uid: 'admin_1', email: 'admin@ecoshare.com', displayName: 'Admin', role: 'admin', status: 'approved' },
  { uid: 'user_1', email: 'alice@example.com', displayName: 'Alice', role: 'resident', status: 'approved' },
  { uid: 'user_2', email: 'bob@example.com', displayName: 'Bob', role: 'resident', status: 'pending' },
  { uid: 'user_3', email: 'charlie@example.com', displayName: 'Charlie', role: 'resident', status: 'pending' },
  { uid: 'user_4', email: 'dave@example.com', displayName: 'Dave', role: 'resident', status: 'rejected' },
];

const MOCK_RESOURCES = [
  { resourceId: 1, ownerId: 'user_1', status: 'Available', co2Offset: 500 },
  { resourceId: 2, ownerId: 'user_1', status: 'Taken', co2Offset: 200 },
  { resourceId: 3, ownerId: 'user_2', status: 'Available', co2Offset: 1500 },
];

const ADMIN_USER = MOCK_USERS[0];

// ─────────────────────────────────────────────────────────────────────────────
describe('[ADMIN] User Approval', () => {
  test('TC-ADM-01: admin can approve a pending user', () => {
    const r = approveUser('user_2', MOCK_USERS);
    expect(r.success).toBe(true);
    expect(r.user.status).toBe('approved');
    expect(r.user.approved).toBe(true);
  });

  test('TC-ADM-02: approved user gets approvedAt timestamp', () => {
    const r = approveUser('user_2', MOCK_USERS);
    expect(r.user.approvedAt).toBeTruthy();
  });

  test('TC-ADM-03: cannot approve already approved user', () => {
    const r = approveUser('user_1', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/already approved/i);
  });

  test('TC-ADM-04: cannot approve rejected user', () => {
    const r = approveUser('user_4', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/rejected/i);
  });

  test('TC-ADM-05: approving non-existent user fails', () => {
    const r = approveUser('nonexistent', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[ADMIN] User Rejection', () => {
  test('TC-ADM-06: admin can reject a pending user with reason', () => {
    const r = rejectUser('user_2', 'Not a resident of this area', MOCK_USERS);
    expect(r.success).toBe(true);
    expect(r.user.status).toBe('rejected');
    expect(r.user.approved).toBe(false);
  });

  test('TC-ADM-07: rejected user has rejectionReason stored', () => {
    const r = rejectUser('user_2', 'Not a resident of this area', MOCK_USERS);
    expect(r.user.rejectionReason).toBe('Not a resident of this area');
  });

  test('TC-ADM-08: rejected user gets rejectedAt timestamp', () => {
    const r = rejectUser('user_2', 'Not valid', MOCK_USERS);
    expect(r.user.rejectedAt).toBeTruthy();
  });

  test('TC-ADM-09: cannot reject without a reason', () => {
    const r = rejectUser('user_2', '', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/reason/i);
  });

  test('TC-ADM-10: cannot reject with reason less than 3 chars', () => {
    const r = rejectUser('user_2', 'No', MOCK_USERS);
    expect(r.success).toBe(false);
  });

  test('TC-ADM-11: cannot reject already rejected user', () => {
    const r = rejectUser('user_4', 'Duplicate', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/already rejected/i);
  });

  test('TC-ADM-12: cannot reject approved user', () => {
    const r = rejectUser('user_1', 'Changed mind', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/approved/i);
  });

  test('TC-ADM-13: rejecting non-existent user fails', () => {
    const r = rejectUser('nobody', 'Some reason', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[ADMIN] User Queries', () => {
  test('TC-ADM-14: getPendingUsers returns only pending users', () => {
    const pending = getPendingUsers(MOCK_USERS);
    expect(pending.length).toBe(2);
    pending.forEach(u => expect(u.status).toBe('pending'));
  });

  test('TC-ADM-15: getApprovedUsers returns only approved users', () => {
    const approved = getApprovedUsers(MOCK_USERS);
    expect(approved.length).toBe(2);
    approved.forEach(u => expect(u.status).toBe('approved'));
  });

  test('TC-ADM-16: getRejectedUsers returns only rejected users', () => {
    const rejected = getRejectedUsers(MOCK_USERS);
    expect(rejected.length).toBe(1);
    rejected.forEach(u => expect(u.status).toBe('rejected'));
  });

  test('TC-ADM-17: empty user list returns empty pending array', () => {
    expect(getPendingUsers([])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[ADMIN] Dashboard Statistics', () => {
  test('TC-ADM-18: getDashboardStats total users is correct', () => {
    const stats = getDashboardStats(MOCK_USERS, MOCK_RESOURCES);
    expect(stats.totalUsers).toBe(5);
  });

  test('TC-ADM-19: getDashboardStats pendingCount is correct', () => {
    const stats = getDashboardStats(MOCK_USERS, MOCK_RESOURCES);
    expect(stats.pendingCount).toBe(2);
  });

  test('TC-ADM-20: getDashboardStats approvedCount is correct', () => {
    const stats = getDashboardStats(MOCK_USERS, MOCK_RESOURCES);
    expect(stats.approvedCount).toBe(2);
  });

  test('TC-ADM-21: getDashboardStats rejectedCount is correct', () => {
    const stats = getDashboardStats(MOCK_USERS, MOCK_RESOURCES);
    expect(stats.rejectedCount).toBe(1);
  });

  test('TC-ADM-22: getDashboardStats adminCount is correct', () => {
    const stats = getDashboardStats(MOCK_USERS, MOCK_RESOURCES);
    expect(stats.adminCount).toBe(1);
  });

  test('TC-ADM-23: getDashboardStats totalResources is correct', () => {
    const stats = getDashboardStats(MOCK_USERS, MOCK_RESOURCES);
    expect(stats.totalResources).toBe(3);
  });

  test('TC-ADM-24: getDashboardStats availableResources is correct', () => {
    const stats = getDashboardStats(MOCK_USERS, MOCK_RESOURCES);
    expect(stats.availableResources).toBe(2);
  });

  test('TC-ADM-25: getDashboardStats totalCO2 is correct', () => {
    const stats = getDashboardStats(MOCK_USERS, MOCK_RESOURCES);
    expect(stats.totalCO2).toBe(2200);
  });

  test('TC-ADM-26: getDashboardStats with empty data', () => {
    const stats = getDashboardStats([], []);
    expect(stats.totalUsers).toBe(0);
    expect(stats.totalResources).toBe(0);
    expect(stats.totalCO2).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[ADMIN] Access Control', () => {
  test('TC-ADM-27: admin user can access admin panel', () => {
    expect(canAccessAdminPanel(ADMIN_USER)).toBe(true);
  });

  test('TC-ADM-28: regular resident cannot access admin panel', () => {
    expect(canAccessAdminPanel(MOCK_USERS[1])).toBe(false);
  });

  test('TC-ADM-29: null user cannot access admin panel', () => {
    expect(canAccessAdminPanel(null)).toBe(false);
  });

  test('TC-ADM-30: admin can change user role to volunteer', () => {
    const r = changeUserRole(ADMIN_USER, 'user_1', 'volunteer', MOCK_USERS);
    expect(r.success).toBe(true);
    expect(r.user.role).toBe('volunteer');
  });

  test('TC-ADM-31: admin can change user role to ngo', () => {
    const r = changeUserRole(ADMIN_USER, 'user_1', 'ngo', MOCK_USERS);
    expect(r.success).toBe(true);
    expect(r.user.role).toBe('ngo');
  });

  test('TC-ADM-32: non-admin cannot change user role', () => {
    const r = changeUserRole(MOCK_USERS[1], 'user_2', 'volunteer', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unauthorized/i);
  });

  test('TC-ADM-33: admin cannot assign invalid role', () => {
    const r = changeUserRole(ADMIN_USER, 'user_1', 'superuser', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid role/i);
  });

  test('TC-ADM-34: admin cannot assign role to non-existent user', () => {
    const r = changeUserRole(ADMIN_USER, 'nobody', 'volunteer', MOCK_USERS);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

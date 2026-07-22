'use strict';

/**
 * EcoShare - Analytics & Metrics Test Suite
 * Tests: CO2 savings, category analytics, waste reduction, reports
 * Total: ~25 tests
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
function getCategoryBreakdown(resources) {
  return resources.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
}

function getCategoryCO2(resources) {
  return resources.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + (r.co2Offset || 0);
    return acc;
  }, {});
}

function getTopCategory(resources) {
  if (!resources || resources.length === 0) return null;
  const breakdown = getCategoryBreakdown(resources);
  return Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0][0];
}

function getMonthlyStats(resources) {
  const now = new Date();
  const thisMonth = resources.filter(r => {
    if (!r.createdAt) return false;
    const d = new Date(r.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  return {
    count: thisMonth.length,
    co2: thisMonth.reduce((s, r) => s + (r.co2Offset || 0), 0)
  };
}

function calculateTreeEquivalent(co2Grams) {
  const gramsPerTree = 21000;
  return Math.floor(co2Grams / gramsPerTree);
}

function calculateWasteReductionKg(resources) {
  const weights = {
    'Food': 0.5, 'Clothes': 0.3, 'Books': 0.5, 'Furniture': 15,
    'Electronics': 2, 'Kitchen Items': 1, 'Medical Supplies': 0.2,
    'Educational Materials': 0.4, 'Household Items': 1.5, 'Other': 0.5
  };
  return resources.reduce((s, r) => s + (weights[r.category] || 0.5), 0);
}

function getPassRate(tests) {
  if (!tests || tests.length === 0) return 0;
  const passed = tests.filter(t => t.status === 'PASSED').length;
  return Math.round((passed / tests.length) * 100);
}

function generateReportSummary(tests) {
  const total = tests.length;
  const passed = tests.filter(t => t.status === 'PASSED').length;
  const failed = tests.filter(t => t.status === 'FAILED').length;
  const skipped = tests.filter(t => t.status === 'SKIPPED').length;
  return { total, passed, failed, skipped, passRate: getPassRate(tests) };
}

// ── Sample Data ───────────────────────────────────────────────────────────────
const SAMPLE_RESOURCES = [
  { category: 'Food', co2Offset: 50, createdAt: new Date().toISOString() },
  { category: 'Books', co2Offset: 200, createdAt: new Date().toISOString() },
  { category: 'Electronics', co2Offset: 8000, createdAt: new Date().toISOString() },
  { category: 'Furniture', co2Offset: 5000, createdAt: new Date().toISOString() },
  { category: 'Clothes', co2Offset: 300, createdAt: new Date().toISOString() },
  { category: 'Food', co2Offset: 75, createdAt: new Date().toISOString() },
  { category: 'Books', co2Offset: 150, createdAt: new Date().toISOString() },
  { category: 'Electronics', co2Offset: 3000, createdAt: new Date().toISOString() },
];

// ─────────────────────────────────────────────────────────────────────────────
describe('[ANALYTICS] Category Breakdown', () => {
  test('TC-ANLYT-01: getCategoryBreakdown counts categories correctly', () => {
    const breakdown = getCategoryBreakdown(SAMPLE_RESOURCES);
    expect(breakdown['Food']).toBe(2);
    expect(breakdown['Books']).toBe(2);
    expect(breakdown['Electronics']).toBe(2);
    expect(breakdown['Furniture']).toBe(1);
  });

  test('TC-ANLYT-02: getCategoryBreakdown returns empty object for empty list', () => {
    const breakdown = getCategoryBreakdown([]);
    expect(Object.keys(breakdown).length).toBe(0);
  });

  test('TC-ANLYT-03: getTopCategory returns the most common category', () => {
    const top = getTopCategory(SAMPLE_RESOURCES);
    // Food, Books, and Electronics are all 2 - any of them is correct
    expect(['Food', 'Books', 'Electronics']).toContain(top);
  });

  test('TC-ANLYT-04: getTopCategory returns null for empty list', () => {
    expect(getTopCategory([])).toBeNull();
  });

  test('TC-ANLYT-05: getCategoryCO2 sums CO2 per category correctly', () => {
    const co2Map = getCategoryCO2(SAMPLE_RESOURCES);
    expect(co2Map['Food']).toBe(125);
    expect(co2Map['Electronics']).toBe(11000);
    expect(co2Map['Books']).toBe(350);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[ANALYTICS] CO2 & Environmental Impact', () => {
  test('TC-ANLYT-06: calculateTreeEquivalent from 21000g = 1 tree', () => {
    expect(calculateTreeEquivalent(21000)).toBe(1);
  });

  test('TC-ANLYT-07: calculateTreeEquivalent from 42000g = 2 trees', () => {
    expect(calculateTreeEquivalent(42000)).toBe(2);
  });

  test('TC-ANLYT-08: calculateTreeEquivalent from 0g = 0 trees', () => {
    expect(calculateTreeEquivalent(0)).toBe(0);
  });

  test('TC-ANLYT-09: calculateTreeEquivalent floors result', () => {
    expect(calculateTreeEquivalent(30000)).toBe(1);
  });

  test('TC-ANLYT-10: calculateWasteReductionKg for furniture is significant', () => {
    const resources = [{ category: 'Furniture' }];
    expect(calculateWasteReductionKg(resources)).toBe(15);
  });

  test('TC-ANLYT-11: calculateWasteReductionKg for mixed resources sums correctly', () => {
    const resources = [{ category: 'Furniture' }, { category: 'Electronics' }, { category: 'Food' }];
    const result = calculateWasteReductionKg(resources);
    expect(result).toBeCloseTo(17.5);
  });

  test('TC-ANLYT-12: calculateWasteReductionKg for empty list is 0', () => {
    expect(calculateWasteReductionKg([])).toBe(0);
  });

  test('TC-ANLYT-13: Electronics has higher CO2 offset than Food', () => {
    const electronics = SAMPLE_RESOURCES.filter(r => r.category === 'Electronics');
    const food = SAMPLE_RESOURCES.filter(r => r.category === 'Food');
    const elecCO2 = electronics.reduce((s, r) => s + r.co2Offset, 0);
    const foodCO2 = food.reduce((s, r) => s + r.co2Offset, 0);
    expect(elecCO2).toBeGreaterThan(foodCO2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[ANALYTICS] Monthly Statistics', () => {
  test('TC-ANLYT-14: this month resources are counted correctly', () => {
    const stats = getMonthlyStats(SAMPLE_RESOURCES);
    expect(stats.count).toBe(SAMPLE_RESOURCES.length);
  });

  test('TC-ANLYT-15: this month CO2 is summed correctly', () => {
    const stats = getMonthlyStats(SAMPLE_RESOURCES);
    const expected = SAMPLE_RESOURCES.reduce((s, r) => s + r.co2Offset, 0);
    expect(stats.co2).toBe(expected);
  });

  test('TC-ANLYT-16: resources without createdAt are excluded', () => {
    const resources = [...SAMPLE_RESOURCES, { category: 'Food', co2Offset: 100 }];
    const stats = getMonthlyStats(resources);
    expect(stats.count).toBe(SAMPLE_RESOURCES.length);
  });

  test('TC-ANLYT-17: old resources are not counted in this month', () => {
    const oldResource = { category: 'Books', co2Offset: 500, createdAt: '2020-01-01T00:00:00.000Z' };
    const stats = getMonthlyStats([oldResource]);
    expect(stats.count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[ANALYTICS] Report Generation', () => {
  const mockTests = [
    { id: 'T1', status: 'PASSED' },
    { id: 'T2', status: 'PASSED' },
    { id: 'T3', status: 'FAILED' },
    { id: 'T4', status: 'PASSED' },
    { id: 'T5', status: 'SKIPPED' },
  ];

  test('TC-ANLYT-18: getPassRate calculates correctly', () => {
    expect(getPassRate(mockTests)).toBe(60);
  });

  test('TC-ANLYT-19: getPassRate is 100 when all pass', () => {
    const allPass = [{ status: 'PASSED' }, { status: 'PASSED' }];
    expect(getPassRate(allPass)).toBe(100);
  });

  test('TC-ANLYT-20: getPassRate is 0 when all fail', () => {
    const allFail = [{ status: 'FAILED' }, { status: 'FAILED' }];
    expect(getPassRate(allFail)).toBe(0);
  });

  test('TC-ANLYT-21: getPassRate returns 0 for empty list', () => {
    expect(getPassRate([])).toBe(0);
  });

  test('TC-ANLYT-22: generateReportSummary counts correctly', () => {
    const summary = generateReportSummary(mockTests);
    expect(summary.total).toBe(5);
    expect(summary.passed).toBe(3);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
  });

  test('TC-ANLYT-23: generateReportSummary passRate is correct', () => {
    const summary = generateReportSummary(mockTests);
    expect(summary.passRate).toBe(60);
  });

  test('TC-ANLYT-24: generateReportSummary with all passing', () => {
    const allPass = [{ status: 'PASSED' }, { status: 'PASSED' }, { status: 'PASSED' }];
    const summary = generateReportSummary(allPass);
    expect(summary.passRate).toBe(100);
    expect(summary.failed).toBe(0);
  });

  test('TC-ANLYT-25: generateReportSummary with empty list', () => {
    const summary = generateReportSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.passRate).toBe(0);
  });
});

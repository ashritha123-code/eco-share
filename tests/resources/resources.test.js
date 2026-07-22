'use strict';

/**
 * EcoShare - Resource Management Test Suite
 * Tests: CRUD, validation, search, filter, CO2, categories, status
 * Total: ~50 tests
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
const VALID_CATEGORIES = ['Food', 'Clothes', 'Books', 'Furniture', 'Electronics',
  'Kitchen Items', 'Medical Supplies', 'Educational Materials', 'Household Items', 'Other'];

function validateResource(resource) {
  const errors = [];
  if (!resource.title || resource.title.trim().length < 3) errors.push('Title too short');
  if (resource.title && resource.title.trim().length > 100) errors.push('Title too long');
  if (!resource.description || resource.description.trim().length < 10) errors.push('Description too short');
  if (resource.description && resource.description.trim().length > 1000) errors.push('Description too long');
  if (!resource.category || !VALID_CATEGORIES.includes(resource.category)) errors.push('Invalid category');
  if (!resource.location || resource.location.trim().length < 2) errors.push('Invalid location');
  if (!resource.quantity || resource.quantity.trim().length < 1) errors.push('Quantity required');
  return { valid: errors.length === 0, errors };
}

function createResource(data, ownerUid, ownerName) {
  const validation = validateResource(data);
  if (!validation.valid) return { success: false, errors: validation.errors };
  return {
    success: true,
    resource: {
      resourceId: Date.now(),
      ownerId: ownerUid,
      ownerName,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category,
      quantity: data.quantity,
      location: data.location.trim(),
      imageUrl: data.imageUrl || null,
      status: 'Available',
      co2Offset: data.co2Offset || 0,
      createdAt: new Date().toISOString()
    }
  };
}

function updateResourceStatus(resource, newStatus) {
  const validStatuses = ['Available', 'Reserved', 'Taken', 'Completed'];
  if (!validStatuses.includes(newStatus)) return { success: false, error: 'Invalid status' };
  return { success: true, resource: { ...resource, status: newStatus } };
}

function deleteResource(resourceId, userId, resources) {
  const resource = resources.find(r => r.resourceId === resourceId);
  if (!resource) return { success: false, error: 'Resource not found' };
  if (resource.ownerId !== userId) return { success: false, error: 'Unauthorized' };
  return { success: true, deleted: true };
}

function searchResources(resources, query) {
  if (!query) return resources;
  const q = query.toLowerCase();
  return resources.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q) ||
    r.location.toLowerCase().includes(q)
  );
}

function filterByCategory(resources, category) {
  if (!category) return resources;
  return resources.filter(r => r.category === category);
}

function filterByStatus(resources, status) {
  if (!status) return resources;
  return resources.filter(r => r.status === status);
}

function calculateTotalCO2(resources) {
  return resources.reduce((sum, r) => sum + (Number(r.co2Offset) || 0), 0);
}

function formatCO2(grams) {
  if (grams >= 1000000) return `${(grams / 1000000).toFixed(2)} tonnes`;
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${grams} g`;
}

// ── Sample Resources ──────────────────────────────────────────────────────────
const SAMPLE_RESOURCES = [
  { resourceId: 1, ownerId: 'u1', ownerName: 'Alice', title: 'Old Sofa', description: 'Brown three-seater in good condition', category: 'Furniture', quantity: '1', location: 'Westside', status: 'Available', co2Offset: 5000 },
  { resourceId: 2, ownerId: 'u2', ownerName: 'Bob', title: 'Python Textbook', description: 'Introduction to Python programming', category: 'Books', quantity: '1', location: 'Central', status: 'Available', co2Offset: 200 },
  { resourceId: 3, ownerId: 'u1', ownerName: 'Alice', title: 'Vegetable Bundle', description: 'Fresh vegetables from garden', category: 'Food', quantity: '5 kg', location: 'Eastside', status: 'Reserved', co2Offset: 50 },
  { resourceId: 4, ownerId: 'u3', ownerName: 'Charlie', title: 'Old Laptop', description: 'Working condition but slow, good for study', category: 'Electronics', quantity: '1', location: 'Westside', status: 'Available', co2Offset: 8000 },
  { resourceId: 5, ownerId: 'u2', ownerName: 'Bob', title: 'Kids Clothes', description: 'Bundle of 5-7 year old size clothes', category: 'Clothes', quantity: '10 items', location: 'Downtown', status: 'Taken', co2Offset: 300 },
];

// ─────────────────────────────────────────────────────────────────────────────
describe('[RESOURCES] Resource Creation Validation', () => {
  test('TC-RES-01: valid resource creation succeeds', () => {
    const r = createResource({ title: 'Nice Table', description: 'Wooden dining table good condition', category: 'Furniture', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(true);
    expect(r.resource.title).toBe('Nice Table');
  });

  test('TC-RES-02: new resource has Available status by default', () => {
    const r = createResource({ title: 'Nice Table', description: 'Wooden dining table good condition', category: 'Furniture', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.resource.status).toBe('Available');
  });

  test('TC-RES-03: new resource has resourceId assigned', () => {
    const r = createResource({ title: 'Nice Table', description: 'Wooden dining table good condition', category: 'Furniture', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.resource.resourceId).toBeTruthy();
  });

  test('TC-RES-04: new resource has createdAt timestamp', () => {
    const r = createResource({ title: 'Nice Table', description: 'Wooden dining table good condition', category: 'Furniture', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.resource.createdAt).toBeTruthy();
  });

  test('TC-RES-05: resource with no title fails', () => {
    const r = createResource({ description: 'Some description here', category: 'Food', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-06: resource with 2-char title fails', () => {
    const r = createResource({ title: 'Ab', description: 'Some description here', category: 'Food', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-07: resource with 3-char title passes', () => {
    const r = createResource({ title: 'Abc', description: 'Some description here', category: 'Food', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(true);
  });

  test('TC-RES-08: resource with 101-char title fails', () => {
    const r = createResource({ title: 'A'.repeat(101), description: 'Some description here', category: 'Food', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-09: resource with short description fails', () => {
    const r = createResource({ title: 'Valid Title', description: 'Short', category: 'Food', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-10: resource with description too long fails', () => {
    const r = createResource({ title: 'Valid Title', description: 'A'.repeat(1001), category: 'Food', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-11: resource with invalid category fails', () => {
    const r = createResource({ title: 'Valid Title', description: 'Some description here', category: 'InvalidCategory', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-12: resource with no category fails', () => {
    const r = createResource({ title: 'Valid Title', description: 'Some description here', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-13: resource with no location fails', () => {
    const r = createResource({ title: 'Valid Title', description: 'Some description here', category: 'Food', quantity: '1' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-14: resource with single char location fails', () => {
    const r = createResource({ title: 'Valid Title', description: 'Some description here', category: 'Food', quantity: '1', location: 'A' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-15: resource missing quantity fails', () => {
    const r = createResource({ title: 'Valid Title', description: 'Some description here', category: 'Food', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });

  test('TC-RES-16: multiple validation errors returned at once', () => {
    const r = createResource({ title: 'A', description: 'Too short', category: 'Bad', location: 'X' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
    expect(r.errors.length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[RESOURCES] Valid Categories', () => {
  const categories = ['Food', 'Clothes', 'Books', 'Furniture', 'Electronics',
    'Kitchen Items', 'Medical Supplies', 'Educational Materials', 'Household Items', 'Other'];

  categories.forEach((cat, i) => {
    test(`TC-RES-CAT-${String(i + 1).padStart(2, '0')}: ${cat} is a valid category`, () => {
      const r = createResource({ title: 'Test Item', description: 'This is a test item description', category: cat, quantity: '1', location: 'Central' }, 'u1', 'Alice');
      expect(r.success).toBe(true);
      expect(r.resource.category).toBe(cat);
    });
  });

  test('TC-RES-CAT-11: lowercase category fails validation', () => {
    const r = createResource({ title: 'Test Item', description: 'This is a test item description', category: 'food', quantity: '1', location: 'Central' }, 'u1', 'Alice');
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[RESOURCES] Status Management', () => {
  const sampleResource = SAMPLE_RESOURCES[0];

  test('TC-RES-ST-01: resource can be set to Reserved', () => {
    const r = updateResourceStatus(sampleResource, 'Reserved');
    expect(r.success).toBe(true);
    expect(r.resource.status).toBe('Reserved');
  });

  test('TC-RES-ST-02: resource can be set to Taken', () => {
    const r = updateResourceStatus(sampleResource, 'Taken');
    expect(r.success).toBe(true);
    expect(r.resource.status).toBe('Taken');
  });

  test('TC-RES-ST-03: resource can be set to Completed', () => {
    const r = updateResourceStatus(sampleResource, 'Completed');
    expect(r.success).toBe(true);
    expect(r.resource.status).toBe('Completed');
  });

  test('TC-RES-ST-04: resource can be set back to Available', () => {
    const r = updateResourceStatus({ ...sampleResource, status: 'Reserved' }, 'Available');
    expect(r.success).toBe(true);
    expect(r.resource.status).toBe('Available');
  });

  test('TC-RES-ST-05: invalid status string fails', () => {
    const r = updateResourceStatus(sampleResource, 'Disposed');
    expect(r.success).toBe(false);
  });

  test('TC-RES-ST-06: empty status string fails', () => {
    const r = updateResourceStatus(sampleResource, '');
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[RESOURCES] Delete Authorization', () => {
  test('TC-RES-DEL-01: owner can delete their own resource', () => {
    const r = deleteResource(1, 'u1', SAMPLE_RESOURCES);
    expect(r.success).toBe(true);
  });

  test('TC-RES-DEL-02: non-owner cannot delete resource', () => {
    const r = deleteResource(1, 'u2', SAMPLE_RESOURCES);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unauthorized/i);
  });

  test('TC-RES-DEL-03: non-existent resource returns not found error', () => {
    const r = deleteResource(9999, 'u1', SAMPLE_RESOURCES);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[RESOURCES] Search & Filtering', () => {
  test('TC-RES-SRCH-01: search by title returns matching resources', () => {
    const results = searchResources(SAMPLE_RESOURCES, 'Sofa');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Old Sofa');
  });

  test('TC-RES-SRCH-02: search is case-insensitive', () => {
    const results = searchResources(SAMPLE_RESOURCES, 'sofa');
    expect(results.length).toBe(1);
  });

  test('TC-RES-SRCH-03: search by location returns matching resources', () => {
    const results = searchResources(SAMPLE_RESOURCES, 'Westside');
    expect(results.length).toBe(2);
  });

  test('TC-RES-SRCH-04: search with no match returns empty array', () => {
    const results = searchResources(SAMPLE_RESOURCES, 'ZZZnonexistent');
    expect(results.length).toBe(0);
  });

  test('TC-RES-SRCH-05: empty search returns all resources', () => {
    const results = searchResources(SAMPLE_RESOURCES, '');
    expect(results.length).toBe(SAMPLE_RESOURCES.length);
  });

  test('TC-RES-SRCH-06: null search returns all resources', () => {
    const results = searchResources(SAMPLE_RESOURCES, null);
    expect(results.length).toBe(SAMPLE_RESOURCES.length);
  });

  test('TC-RES-FILTER-01: filter by Books category returns correct results', () => {
    const results = filterByCategory(SAMPLE_RESOURCES, 'Books');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Python Textbook');
  });

  test('TC-RES-FILTER-02: filter by Electronics returns correct results', () => {
    const results = filterByCategory(SAMPLE_RESOURCES, 'Electronics');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Old Laptop');
  });

  test('TC-RES-FILTER-03: filter by non-existent category returns empty', () => {
    const results = filterByCategory(SAMPLE_RESOURCES, 'NonExistent');
    expect(results.length).toBe(0);
  });

  test('TC-RES-FILTER-04: filter by status Available returns correct count', () => {
    const results = filterByStatus(SAMPLE_RESOURCES, 'Available');
    expect(results.length).toBe(3);
  });

  test('TC-RES-FILTER-05: filter by status Reserved returns correct count', () => {
    const results = filterByStatus(SAMPLE_RESOURCES, 'Reserved');
    expect(results.length).toBe(1);
  });

  test('TC-RES-FILTER-06: null category returns all resources', () => {
    const results = filterByCategory(SAMPLE_RESOURCES, null);
    expect(results.length).toBe(SAMPLE_RESOURCES.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('[RESOURCES] CO2 Analytics', () => {
  test('TC-RES-CO2-01: total CO2 calculated correctly', () => {
    const total = calculateTotalCO2(SAMPLE_RESOURCES);
    expect(total).toBe(5000 + 200 + 50 + 8000 + 300);
  });

  test('TC-RES-CO2-02: handles resources with missing co2Offset', () => {
    const resources = [{ co2Offset: 100 }, { title: 'No offset' }];
    expect(calculateTotalCO2(resources)).toBe(100);
  });

  test('TC-RES-CO2-03: empty resource list returns 0', () => {
    expect(calculateTotalCO2([])).toBe(0);
  });

  test('TC-RES-CO2-04: formats grams correctly', () => {
    expect(formatCO2(500)).toBe('500 g');
  });

  test('TC-RES-CO2-05: formats kg correctly', () => {
    expect(formatCO2(5000)).toBe('5.00 kg');
  });

  test('TC-RES-CO2-06: formats tonnes correctly', () => {
    expect(formatCO2(5000000)).toBe('5.00 tonnes');
  });

  test('TC-RES-CO2-07: Electronics category has high CO2 offset', () => {
    const electronics = SAMPLE_RESOURCES.filter(r => r.category === 'Electronics');
    expect(electronics[0].co2Offset).toBeGreaterThan(1000);
  });

  test('TC-RES-CO2-08: Furniture category has high CO2 offset', () => {
    const furniture = SAMPLE_RESOURCES.filter(r => r.category === 'Furniture');
    expect(furniture[0].co2Offset).toBeGreaterThan(1000);
  });
});

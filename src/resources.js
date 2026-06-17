// Resource management module for EcoShare
import { dbService, storageService, authService } from './firebase-config.js';
import { getLoggedInUser } from './auth.js';
import { initMainMap, updateMainMapMarkers, initFormMapPicker } from './map.js';

let allResources = [];
let currentCategoryFilter = 'All';
let currentTabFilter = 'recent'; // 'recent', 'nearby', 'saved', 'my-resources', 'map'
let currentSearchQuery = '';
let currentStatusFilter = 'All';

let addMapPicker = null;
let editMapPicker = null;
let mainMap = null;

export function getResourcesState() {
  return allResources;
}

export function initResources(showToast) {
  const resourcesGrid = document.getElementById('resourcesGrid');
  const searchInput = document.getElementById('searchInput');
  const statusFilterSelect = document.getElementById('statusFilter');
  const locationFilterSelect = document.getElementById('locationFilter');
  
  // Forms & Modal controls
  const addResourceBtn = document.getElementById('addResourceBtn');
  const addResourceModal = document.getElementById('addResourceModal');
  const addResourceForm = document.getElementById('addResourceForm');
  const cancelAddBtn = document.getElementById('cancelAddBtn');
  
  const detailModal = document.getElementById('detailModal');
  const detailModalClose = document.getElementById('detailModalClose');
  const userProfileModal = document.getElementById('userProfileModal');
  const profileModalClose = document.getElementById('profileModalClose');
  const profileModalCloseBtn = document.getElementById('profileModalCloseBtn');

  // File Upload Elements
  const imageUploadZone = document.getElementById('imageUploadZone');
  const resourceImageFile = document.getElementById('resourceImageFile');
  const uploadPreviewContainer = document.getElementById('uploadPreviewContainer');
  const uploadPreviewImg = document.getElementById('uploadPreviewImg');
  const uploadRemoveBtn = document.getElementById('uploadRemoveBtn');
  const uploadProgressBarContainer = document.getElementById('uploadProgressBarContainer');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  let uploadedImageUrl = '';

  // Tab Filtering Listeners (Recent, Nearby, Saved, My Resources, Map View)
  const tabs = {
    recent: document.getElementById('tabRecent'),
    nearby: document.getElementById('tabNearby'),
    saved: document.getElementById('tabSaved'),
    my: document.getElementById('tabMyResources'),
    map: document.getElementById('tabMapView')
  };

  Object.entries(tabs).forEach(([key, element]) => {
    if (element) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        Object.values(tabs).forEach(t => {
          if (t) {
            t.classList.remove('active');
            t.style.borderBottom = '2px solid transparent';
          }
        });
        element.classList.add('active');
        element.style.borderBottom = '2px solid var(--primary)';
        currentTabFilter = key;
        renderResources();
      });
    }
  });

  // Category Chip Filtering
  const categoryContainer = document.getElementById('categoriesScroll');
  if (categoryContainer) {
    categoryContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;
      
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategoryFilter = chip.dataset.category;
      renderResources();
    });
  }

  // Real-time Search and Filter Input Listeners
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.toLowerCase().trim();
    renderResources();
  });

  statusFilterSelect.addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    renderResources();
  });

  // Modal Open/Close handling
  addResourceBtn.addEventListener('click', () => {
    if (!getLoggedInUser()) {
      showToast('Please log in or register to share a resource.', 'warning');
      return;
    }
    // Set default location field in form
    document.getElementById('resourceLocation').value = getLoggedInUser().location || '';
    addResourceForm.reset();
    resetImageUpload();
    addResourceModal.classList.add('active');
    const modalBody = addResourceModal.querySelector('.modal-body');
    if (modalBody) modalBody.scrollTop = 0;

    // Initialize Add Location Map Picker
    if (!addMapPicker) {
      addMapPicker = initFormMapPicker('addMapPicker', 'addResourceLat', 'addResourceLng', 45.5152, -122.6784);
    } else {
      addMapPicker.setLocation(45.5152, -122.6784);
    }
    addMapPicker.invalidateSize();
  });

  cancelAddBtn.addEventListener('click', () => {
    addResourceModal.classList.remove('active');
  });

  detailModalClose.addEventListener('click', () => {
    detailModal.classList.remove('active');
  });

  if (profileModalClose) {
    profileModalClose.addEventListener('click', () => {
      userProfileModal.classList.remove('active');
    });
  }

  if (profileModalCloseBtn) {
    profileModalCloseBtn.addEventListener('click', () => {
      userProfileModal.classList.remove('active');
    });
  }

  // Window clicks to close modals
  window.addEventListener('click', (e) => {
    if (e.target === addResourceModal) {
      addResourceModal.classList.remove('active');
    }
    if (e.target === detailModal) {
      detailModal.classList.remove('active');
    }
    if (e.target === userProfileModal) {
      userProfileModal.classList.remove('active');
    }
  });

  // Drag and Drop files handling
  imageUploadZone.addEventListener('click', () => resourceImageFile.click());

  imageUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUploadZone.classList.add('dragover');
  });

  imageUploadZone.addEventListener('dragleave', () => {
    imageUploadZone.classList.remove('dragover');
  });

  imageUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageSelection(files[0]);
    }
  });

  resourceImageFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageSelection(e.target.files[0]);
    }
  });

  uploadRemoveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetImageUpload();
  });

  const resourceImageUrlInput = document.getElementById('resourceImageUrlInput');
  if (resourceImageUrlInput) {
    resourceImageUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url) {
        uploadPreviewImg.src = url;
        imageUploadZone.style.display = 'none';
        uploadPreviewContainer.classList.add('active');
        uploadedImageUrl = url;
      } else {
        if (!resourceImageFile.value) {
          resetImageUpload();
        }
      }
    });
  }

  async function handleImageSelection(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', 'warning');
      return;
    }

    const submitBtn = addResourceForm.querySelector('button[type="submit"]');
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading Image...';
      }
      // Show local preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadPreviewImg.src = e.target.result;
        imageUploadZone.style.display = 'none';
        uploadPreviewContainer.classList.add('active');
      };
      reader.readAsDataURL(file);

      // Perform canvas compression to stay within LocalStorage limits for mock uploads
      // This is a premium touch to ensure robustness!
      let uploadFile = file;
      if (file.size > 200000) {
        showToast('Compressing image...', 'info');
        const compressedBase64 = await compressImage(file, 600, 600);
        uploadFile = base64ToFile(compressedBase64, file.name);
      }

      uploadProgressBarContainer.classList.add('active');
      uploadProgressBar.style.width = '0%';

      // Upload to Storage (Firebase or Mock)
      uploadedImageUrl = await storageService.uploadImage(uploadFile, (progress) => {
        uploadProgressBar.style.width = `${progress}%`;
      });
      console.log('Image upload resolved to:', uploadedImageUrl);
      if (resourceImageUrlInput) {
        resourceImageUrlInput.value = uploadedImageUrl;
      }

      showToast('Image uploaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Image upload failed: ' + err.message, 'error');
      resetImageUpload();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Share Resource';
      }
      setTimeout(() => {
        uploadProgressBarContainer.classList.remove('active');
      }, 500);
    }
  }

  function resetImageUpload() {
    resourceImageFile.value = '';
    uploadPreviewImg.src = '';
    imageUploadZone.style.display = 'flex';
    uploadPreviewContainer.classList.remove('active');
    uploadProgressBarContainer.classList.remove('active');
    uploadProgressBar.style.width = '0%';
    uploadedImageUrl = '';
    const urlInput = document.getElementById('resourceImageUrlInput');
    if (urlInput) {
      urlInput.value = '';
    }
  }

  // Create Resource Submission
  addResourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = addResourceForm.querySelector('button[type="submit"]');

    const title = document.getElementById('resourceTitle').value.trim();
    const category = document.getElementById('resourceCategory').value;
    const quantity = document.getElementById('resourceQuantity').value.trim();
    const location = document.getElementById('resourceLocation').value.trim();
    const description = document.getElementById('resourceDescription').value.trim();
    
    const latitude = document.getElementById('addResourceLat').value;
    const longitude = document.getElementById('addResourceLng').value;

    if (!title || !category || !quantity || !location || !description) {
      showToast('Please complete all form fields.', 'warning');
      return;
    }

    try {
      setLoading(submitBtn, true, 'Posting...');
      
      const imageUrlInputVal = resourceImageUrlInput ? resourceImageUrlInput.value.trim() : '';
      const finalImageUrl = uploadedImageUrl || imageUrlInputVal;
      
      const payload = {
        title,
        category,
        quantity,
        location,
        description,
        imageUrl: finalImageUrl,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null
      };
      console.log('Submitting resource payload:', payload);

      await dbService.addResource(payload);
      showToast('Resource shared successfully! Thank you.', 'success');
      addResourceModal.classList.remove('active');
      addResourceForm.reset();
      resetImageUpload();
    } catch (err) {
      console.error(err);
      showToast('Failed to add resource: ' + err.message, 'error');
    } finally {
      setLoading(submitBtn, false, 'Share Resource');
    }
  });

  // Listen for Live Firestore/Mock resource snapshots
  let unsubscribeSnapshots = null;

  document.addEventListener('auth-changed', (e) => {
    // Clear and re-subscribe to resource changes
    if (unsubscribeSnapshots) {
      unsubscribeSnapshots();
      unsubscribeSnapshots = null;
    }

    const user = e.detail;
    if (user && user.approved === true) {
      // Subscribe to Firestore updates
      unsubscribeSnapshots = dbService.onResourcesChanged((resources) => {
        allResources = resources;
        populateLocationFilters(resources);
        renderResources();
        renderDashboardPanels();
      });
    } else {
      allResources = [];
      renderResources();
      renderDashboardPanels();
    }
  });
}

// Render dynamic card outputs
export function renderResources() {
  const resourcesGrid = document.getElementById('resourcesGrid');
  const mapViewContainer = document.getElementById('mapViewContainer');
  const user = getLoggedInUser();

  if (!resourcesGrid) return;

  // Handle Map Tab Switch
  if (currentTabFilter === 'map') {
    resourcesGrid.style.display = 'none';
    if (mapViewContainer) {
      mapViewContainer.style.display = 'block';
      
      // Dynamically filter resources for the map
      let mapFiltered = [...allResources];
      if (currentCategoryFilter !== 'All') {
        mapFiltered = mapFiltered.filter(r => r.category === currentCategoryFilter);
      }
      if (currentStatusFilter !== 'All') {
        mapFiltered = mapFiltered.filter(r => r.status === currentStatusFilter);
      }
      const locationSelect = document.getElementById('locationFilter');
      const selectedLocation = locationSelect ? locationSelect.value : 'All';
      if (selectedLocation !== 'All') {
        mapFiltered = mapFiltered.filter(r => r.location === selectedLocation);
      }
      if (currentSearchQuery) {
        mapFiltered = mapFiltered.filter(r => 
          r.title.toLowerCase().includes(currentSearchQuery) || 
          r.description.toLowerCase().includes(currentSearchQuery)
        );
      }

      if (!mainMap) {
        mainMap = initMainMap('mapViewContainer', mapFiltered, (resourceId) => {
          const found = allResources.find(r => r.resourceId === resourceId);
          if (found) {
            openDetailModal(found);
          }
        });
      } else {
        updateMainMapMarkers(mapFiltered);
      }
      
      if (mainMap) {
        setTimeout(() => mainMap.invalidateSize(), 50);
      }
    }
    return;
  } else {
    resourcesGrid.style.display = 'grid';
    if (mapViewContainer) {
      mapViewContainer.style.display = 'none';
    }
  }

  resourcesGrid.innerHTML = '';

  let filtered = [...allResources];

  // 1. Category Filter
  if (currentCategoryFilter !== 'All') {
    filtered = filtered.filter(r => r.category === currentCategoryFilter);
  }

  // 2. Dropdown Status Filter
  if (currentStatusFilter !== 'All') {
    filtered = filtered.filter(r => r.status === currentStatusFilter);
  }

  // 3. Dropdown Location Filter
  const locationSelect = document.getElementById('locationFilter');
  const selectedLocation = locationSelect ? locationSelect.value : 'All';
  if (selectedLocation !== 'All') {
    filtered = filtered.filter(r => r.location === selectedLocation);
  }

  // 4. Tab selection filters
  if (currentTabFilter === 'saved') {
    if (!user) {
      resourcesGrid.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <p>Please log in to view your bookmarked/saved resources.</p>
        </div>
      `;
      return;
    }
    const savedIds = user.savedResources || [];
    filtered = filtered.filter(r => savedIds.includes(r.resourceId));
  } else if (currentTabFilter === 'my') {
    if (!user) {
      resourcesGrid.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <p>Please log in to view resources you shared.</p>
        </div>
      `;
      return;
    }
    filtered = filtered.filter(r => r.ownerId === user.uid);
  } else if (currentTabFilter === 'nearby') {
    if (!user) {
      resourcesGrid.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <p>Please log in to discover resources nearby.</p>
        </div>
      `;
      return;
    }
    // Filter matching location of current user
    const userLoc = (user.location || '').toLowerCase();
    filtered = filtered.filter(r => (r.location || '').toLowerCase().includes(userLoc) || userLoc.includes((r.location || '').toLowerCase()));
  }

  // 5. Search filtering matching title and description
  if (currentSearchQuery) {
    filtered = filtered.filter(r => 
      r.title.toLowerCase().includes(currentSearchQuery) || 
      r.description.toLowerCase().includes(currentSearchQuery)
    );
  }

  if (filtered.length === 0) {
    resourcesGrid.innerHTML = `
      <div class="no-results">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3>No resources found</h3>
        <p>Try matching different categories, keywords, or filters.</p>
      </div>
    `;
    return;
  }

  // Render cards
  filtered.forEach(resource => {
    const card = document.createElement('div');
    card.className = 'resource-card';
    
    const isSaved = user && user.savedResources && user.savedResources.includes(resource.resourceId);
    
    card.innerHTML = `
      <div class="card-img-wrapper">
        <img class="card-img" src="${resource.imageUrl || getDefaultBanner(resource.category)}" alt="${resource.title}" loading="lazy">
        <span class="card-badge badge-${resource.status.toLowerCase()}">${resource.status}</span>
        ${user ? `
          <button class="card-save-btn ${isSaved ? 'saved' : ''}" data-id="${resource.resourceId}" aria-label="Save resource">
            <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </button>
        ` : ''}
      </div>
      <div class="card-content">
        <div class="card-category" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span>${resource.category}</span>
          <span class="card-owner-link" style="color: var(--primary); text-decoration: underline; font-weight: 500; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;">
            👤 ${resource.ownerName}
          </span>
        </div>
        <h3 class="card-title">${resource.title}</h3>
        <p class="card-desc">${resource.description}</p>
        <div class="card-footer">
          <div class="card-footer-item">
            <svg viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span>${resource.location}</span>
          </div>
          <div class="card-footer-item">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>${formatTimeAgo(resource.createdAt)}</span>
          </div>
        </div>
      </div>
    `;

    // Click handler for Card Owner Link
    const ownerLink = card.querySelector('.card-owner-link');
    if (ownerLink) {
      ownerLink.addEventListener('click', (e) => {
        e.stopPropagation();
        openUserProfileModal(resource.ownerId, resource.ownerName);
      });
    }

    // Click handler for Card Bookmark
    const saveBtn = card.querySelector('.card-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Avoid opening details
        const resId = saveBtn.dataset.id;
        try {
          if (saveBtn.classList.contains('saved')) {
            await dbService.unsaveResource(user.uid, resId);
            saveBtn.classList.remove('saved');
            const toastFunc = window.showToastNotification || console.log;
            toastFunc('Removed from bookmarks.', 'info');
          } else {
            await dbService.saveResource(user.uid, resId);
            saveBtn.classList.add('saved');
            const toastFunc = window.showToastNotification || console.log;
            toastFunc('Saved to bookmarks!', 'success');
          }
          renderResources();
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Card click opens Resource Details modal
    card.addEventListener('click', () => {
      openDetailModal(resource);
    });

    resourcesGrid.appendChild(card);
  });
}

// Side panels details list
function renderDashboardPanels() {
  const user = getLoggedInUser();
  
  // My Impact sidebar widget
  const myImpactPanel = document.getElementById('myImpactPanel');
  if (myImpactPanel) {
    if (!user) {
      myImpactPanel.style.display = 'none';
    } else {
      myImpactPanel.style.display = 'block';
      const mySharedItems = allResources.filter(r => r.ownerId === user.uid);
      const shareCount = mySharedItems.length;
      const co2Saved = (shareCount * 2.5).toFixed(1);
      
      let badgeIcon = '🌱';
      let badgeLabel = 'Eco Seedling';
      if (shareCount >= 1 && shareCount <= 2) {
        badgeIcon = '🌿';
        badgeLabel = 'Green Sprout';
      } else if (shareCount >= 3 && shareCount <= 5) {
        badgeIcon = '🌳';
        badgeLabel = 'Forest Guardian';
      } else if (shareCount > 5) {
        badgeIcon = '👑';
        badgeLabel = 'Eco Champion';
      }
      
      document.getElementById('myImpactShares').textContent = shareCount;
      document.getElementById('myImpactCarbon').textContent = `${co2Saved} kg`;
      document.getElementById('myImpactBadgeIcon').textContent = badgeIcon;
      document.getElementById('myImpactBadgeLabel').textContent = badgeLabel;
    }
  }
  
  // Recent items sidebar widget
  const recentPanel = document.getElementById('recentPanelList');
  if (recentPanel) {
    recentPanel.innerHTML = '';
    const sorted = [...allResources]
      .filter(r => r.status === 'Available')
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);
      
    if (sorted.length === 0) {
      recentPanel.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No active items.</p>';
    } else {
      sorted.forEach(r => {
        const item = document.createElement('div');
        item.className = 'mini-card';
        item.innerHTML = `
          <img class="mini-img" src="${r.imageUrl || getDefaultBanner(r.category)}" alt="">
          <div class="mini-info">
            <div class="mini-title">${r.title}</div>
            <div class="mini-meta">${r.category} &bull; ${r.location}</div>
          </div>
        `;
        item.addEventListener('click', () => openDetailModal(r));
        recentPanel.appendChild(item);
      });
    }
  }

  // Saved items sidebar widget
  const savedPanel = document.getElementById('savedPanelList');
  if (savedPanel) {
    savedPanel.innerHTML = '';
    if (!user) {
      savedPanel.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Login to view saved items.</p>';
    } else {
      const savedIds = user.savedResources || [];
      const saved = allResources.filter(r => savedIds.includes(r.resourceId)).slice(0, 3);
      
      if (saved.length === 0) {
        savedPanel.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No bookmarked items yet.</p>';
      } else {
        saved.forEach(r => {
          const item = document.createElement('div');
          item.className = 'mini-card';
          item.innerHTML = `
            <img class="mini-img" src="${r.imageUrl || getDefaultBanner(r.category)}" alt="">
            <div class="mini-info">
              <div class="mini-title">${r.title}</div>
              <div class="mini-meta">${r.category} &bull; ${r.status}</div>
            </div>
          `;
          item.addEventListener('click', () => openDetailModal(r));
          savedPanel.appendChild(item);
        });
      }
    }
  }
}

// Open Detail Modal
function openDetailModal(resource) {
  const detailModal = document.getElementById('detailModal');
  const detailBody = document.getElementById('detailModalBody');
  const detailFooter = document.getElementById('detailModalFooter');
  const user = getLoggedInUser();
  const isOwner = user && (resource.ownerId === user.uid || resource.ownerName === user.displayName);
  console.log('Resource details opened. Resource:', resource.title, 'OwnerId:', resource.ownerId, 'CurrentUser:', user ? user.uid : 'none', 'isOwner:', isOwner);

  if (!detailModal || !detailBody || !detailFooter) return;

  const dateString = new Date(resource.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Render main body
  detailBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-img-container">
        <img class="detail-img" src="${resource.imageUrl || getDefaultBanner(resource.category)}" alt="${resource.title}">
      </div>
      <div class="detail-info">
        <div class="detail-header-block">
          <span class="card-badge badge-${resource.status.toLowerCase()}" style="position: static; width: fit-content; margin-bottom: 0.5rem;">${resource.status}</span>
          <h2>${resource.title}</h2>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Posted by <span class="detail-owner-link" style="color: var(--primary); text-decoration: underline; font-weight: 600; cursor: pointer;">${resource.ownerName}</span></p>
        </div>
        
        <div class="detail-meta-list">
          <div class="detail-meta-item">
            <span class="meta-label">Category</span>
            <span class="meta-value">${resource.category}</span>
          </div>
          <div class="detail-meta-item">
            <span class="meta-label">Quantity</span>
            <span class="meta-value">${resource.quantity}</span>
          </div>
          <div class="detail-meta-item">
            <span class="meta-label">Location</span>
            <span class="meta-value">${resource.location}</span>
          </div>
          <div class="detail-meta-item">
            <span class="meta-label">Posted Date</span>
            <span class="meta-value">${dateString}</span>
          </div>
        </div>

        <div class="detail-desc-block">
          <h4>Description</h4>
          <p>${resource.description}</p>
        </div>
      </div>
    </div>
  `;

  // Bind owner profile click handler
  const detailOwnerLink = detailBody.querySelector('.detail-owner-link');
  if (detailOwnerLink) {
    detailOwnerLink.addEventListener('click', () => {
      detailModal.classList.remove('active');
      openUserProfileModal(resource.ownerId, resource.ownerName);
    });
  }

  // Render Footer Buttons
  detailFooter.innerHTML = '';

  // Setup toast notifier link
  const toastFunc = window.showToastNotification || console.log;

  if (isOwner) {
    // Owner view: Status changer & Edit / Delete Buttons
    const statusSelectContainer = document.createElement('div');
    statusSelectContainer.style.marginRight = 'auto';
    statusSelectContainer.style.display = 'flex';
    statusSelectContainer.style.alignItems = 'center';
    statusSelectContainer.style.gap = '0.5rem';
    statusSelectContainer.innerHTML = `
      <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Status:</label>
      <select class="filter-select" id="detailStatusChanger" style="padding: 0.5rem 1rem;">
        <option value="Available" ${resource.status === 'Available' ? 'selected' : ''}>Available</option>
        <option value="Pending" ${resource.status === 'Pending' ? 'selected' : ''}>Pending</option>
        <option value="Shared" ${resource.status === 'Shared' ? 'selected' : ''}>Shared</option>
        <option value="Completed" ${resource.status === 'Completed' ? 'selected' : ''}>Completed</option>
      </select>
    `;

    detailFooter.appendChild(statusSelectContainer);

    // Bind Status Selector changes
    const select = statusSelectContainer.querySelector('#detailStatusChanger');
    select.addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      try {
        await dbService.updateResource(resource.resourceId, { status: newStatus });
        toastFunc(`Status updated to ${newStatus}.`, 'success');
        // Update local status badge in current dialog
        const badge = detailBody.querySelector('.card-badge');
        badge.className = `card-badge badge-${newStatus.toLowerCase()}`;
        badge.textContent = newStatus;
      } catch (err) {
        console.error(err);
        toastFunc('Failed to update status: ' + err.message, 'error');
      }
    });

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      console.log('Delete button clicked for resource:', resource.resourceId);
      if (confirm(`Are you sure you want to delete "${resource.title}"?`)) {
        try {
          await dbService.deleteResource(resource.resourceId);
          toastFunc('Resource deleted successfully.', 'info');
          detailModal.classList.remove('active');
        } catch (err) {
          console.error('Failed to delete resource:', err);
          toastFunc('Failed to delete: ' + (err.message || err), 'error');
        }
      }
    });

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.textContent = 'Edit Details';
    editBtn.addEventListener('click', () => {
      detailModal.classList.remove('active');
      openEditModal(resource);
    });

    detailFooter.appendChild(editBtn);
    detailFooter.appendChild(deleteBtn);
  } else {
    // Non-owner view: Request button & Bookmark toggle
    const isSaved = user && user.savedResources && user.savedResources.includes(resource.resourceId);
    
    const saveBtn = document.createElement('button');
    saveBtn.className = `btn btn-secondary ${isSaved ? 'saved' : ''}`;
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" style="color: #ef4444;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      <span>${isSaved ? 'Saved' : 'Save'}</span>
    `;
    saveBtn.addEventListener('click', async () => {
      if (!user) {
        toastFunc('Please log in to bookmark resources.', 'warning');
        return;
      }
      try {
        if (isSaved) {
          await dbService.unsaveResource(user.uid, resource.resourceId);
          toastFunc('Removed from bookmarks.', 'info');
        } else {
          await dbService.saveResource(user.uid, resource.resourceId);
          toastFunc('Saved to bookmarks!', 'success');
        }
        // Reopen modal to refresh values
        const resources = getResourcesState();
        const freshResource = resources.find(r => r.resourceId === resource.resourceId);
        openDetailModal(freshResource || resource);
      } catch (err) {
        console.error(err);
      }
    });

    const requestBtn = document.createElement('button');
    requestBtn.className = 'btn btn-primary';
    requestBtn.textContent = 'Request Resource';
    
    // Manage Request button state
    if (resource.status !== 'Available') {
      requestBtn.disabled = true;
      requestBtn.textContent = resource.status;
      requestBtn.style.opacity = '0.5';
    } else {
      requestBtn.addEventListener('click', async () => {
        if (!user) {
          toastFunc('Please log in to request resources.', 'warning');
          return;
        }
        try {
          // Update status to Pending
          await dbService.updateResource(resource.resourceId, { status: 'Pending' });
          toastFunc('Resource requested! Status updated to Pending. The owner has been notified.', 'success');
          // Re-fetch and update modal
          const fresh = getResourcesState().find(r => r.resourceId === resource.resourceId);
          openDetailModal(fresh || { ...resource, status: 'Pending' });
        } catch (err) {
          console.error(err);
          toastFunc('Failed to send request.', 'error');
        }
      });
    }

    // Direct Chat Trigger Button
    const messageBtn = document.createElement('button');
    messageBtn.className = 'btn btn-secondary';
    messageBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <span>Message Owner</span>
    `;
    messageBtn.addEventListener('click', () => {
      detailModal.classList.remove('active');
      window.startDirectChat(resource.ownerId, resource.resourceId, resource.title, resource.ownerName);
    });

    detailFooter.appendChild(saveBtn);
    detailFooter.appendChild(messageBtn);
    detailFooter.appendChild(requestBtn);
  }

  detailModal.classList.add('active');
  const modalBody = detailModal.querySelector('.modal-body');
  if (modalBody) modalBody.scrollTop = 0;
}

// Open Contributor Profile View Modal
function openUserProfileModal(ownerId, ownerName) {
  const profileModal = document.getElementById('userProfileModal');
  const headerArea = document.getElementById('profileHeaderArea');
  const resourcesGrid = document.getElementById('profileResourcesGrid');

  if (!profileModal || !headerArea || !resourcesGrid) return;

  // Find location and details from existing resources
  const ownerResources = allResources.filter(r => r.ownerId === ownerId || r.ownerName === ownerName);
  const sharesCount = ownerResources.length;
  const co2Saved = (sharesCount * 2.5).toFixed(1);

  // Determine Level badge
  let badgeIcon = '🌱';
  let badgeLabel = 'Eco Seedling';
  if (sharesCount >= 6) {
    badgeIcon = '👑';
    badgeLabel = 'Eco Champion';
  } else if (sharesCount >= 3) {
    badgeIcon = '🌳';
    badgeLabel = 'Forest Guardian';
  } else if (sharesCount >= 1) {
    badgeIcon = '🌿';
    badgeLabel = 'Green Sprout';
  }

  // Find location
  let ownerLocation = 'EcoShare Community';
  if (ownerResources.length > 0) {
    ownerLocation = ownerResources[0].location;
  }

  // Hydrate header
  const firstLetter = (ownerName || 'A')[0].toUpperCase();
  headerArea.innerHTML = `
    <div class="user-avatar" style="width: 60px; height: 60px; font-size: 1.75rem; border-radius: 50%; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: var(--shadow-sm);">
      ${firstLetter}
    </div>
    <div style="flex: 1;">
      <h3 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem; margin-top: 0;">${ownerName}</h3>
      <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        <span>${ownerLocation}</span>
      </div>
    </div>
    <div style="background: linear-gradient(135deg, var(--primary-light) 0%, var(--bg-card) 100%); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center; min-width: 140px;">
      <div style="font-size: 1.25rem;">${badgeIcon}</div>
      <div style="font-weight: 700; font-size: 0.8rem; color: var(--primary); margin-top: 0.15rem;">${badgeLabel}</div>
      <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-top: 0.25rem; white-space: nowrap;">${sharesCount} Shared &bull; ${co2Saved}kg saved</div>
    </div>
  `;

  // Hydrate resources list
  resourcesGrid.innerHTML = '';
  if (ownerResources.length === 0) {
    resourcesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 2rem;">No shared items found.</p>`;
  } else {
    ownerResources.forEach(r => {
      const itemCard = document.createElement('div');
      itemCard.className = 'resource-card';
      itemCard.style.cursor = 'pointer';
      itemCard.style.boxShadow = 'none';
      itemCard.style.border = '1px solid var(--border-color)';
      itemCard.innerHTML = `
        <div class="card-img-wrapper" style="height: 100px;">
          <img class="card-img" src="${r.imageUrl || getDefaultBanner(r.category)}" alt="${r.title}">
          <span class="card-badge badge-${r.status.toLowerCase()}" style="font-size: 0.65rem; padding: 0.15rem 0.4rem;">${r.status}</span>
        </div>
        <div class="card-content" style="padding: 0.75rem;">
          <h5 class="card-title" style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0;">${r.title}</h5>
          <div class="card-category" style="font-size: 0.7rem; margin-bottom: 0;">${r.category}</div>
        </div>
      `;
      itemCard.addEventListener('click', () => {
        profileModal.classList.remove('active');
        openDetailModal(r);
      });
      resourcesGrid.appendChild(itemCard);
    });
  }

  // Also export this function to window so other files can trigger it
  window.openUserProfileModal = openUserProfileModal;

  profileModal.classList.add('active');
  const modalBody = profileModal.querySelector('.modal-body');
  if (modalBody) modalBody.scrollTop = 0;
}

// Open Edit Modal Form
function openEditModal(resource) {
  const editModal = document.getElementById('editResourceModal');
  const editForm = document.getElementById('editResourceForm');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const toastFunc = window.showToastNotification || console.log;

  if (!editModal || !editForm || !cancelEditBtn) return;

  // Populate fields
  document.getElementById('editResourceTitle').value = resource.title;
  document.getElementById('editResourceCategory').value = resource.category;
  document.getElementById('editResourceQuantity').value = resource.quantity;
  document.getElementById('editResourceLocation').value = resource.location;
  document.getElementById('editResourceDescription').value = resource.description;

  const editResourceImageUrlInput = document.getElementById('editResourceImageUrlInput');
  if (editResourceImageUrlInput) {
    editResourceImageUrlInput.value = resource.imageUrl || '';
  }

  // Initialize and center Edit Location Map Picker
  const defaultLat = resource.latitude !== undefined && resource.latitude !== null ? Number(resource.latitude) : 45.5152;
  const defaultLng = resource.longitude !== undefined && resource.longitude !== null ? Number(resource.longitude) : -122.6784;

  if (!editMapPicker) {
    editMapPicker = initFormMapPicker('editMapPicker', 'editResourceLat', 'editResourceLng', defaultLat, defaultLng);
  } else {
    editMapPicker.setLocation(defaultLat, defaultLng);
  }
  editMapPicker.invalidateSize();

  // Setup preview
  const previewZone = document.getElementById('editImageUploadZone');
  const fileInput = document.getElementById('editResourceImageFile');
  const previewContainer = document.getElementById('editUploadPreviewContainer');
  const previewImg = document.getElementById('editUploadPreviewImg');
  const removeBtn = document.getElementById('editUploadRemoveBtn');
  const progressBarContainer = document.getElementById('editUploadProgressBarContainer');
  const progressBar = document.getElementById('editUploadProgressBar');
  let currentEditedImageUrl = resource.imageUrl || '';

  if (currentEditedImageUrl) {
    previewImg.src = currentEditedImageUrl;
    previewZone.style.display = 'none';
    previewContainer.classList.add('active');
  } else {
    previewImg.src = '';
    previewZone.style.display = 'flex';
    previewContainer.classList.remove('active');
  }

  // Bind file interactions for Edit
  const clickHandler = () => fileInput.click();
  previewZone.addEventListener('click', clickHandler);

  const urlInputHandler = (e) => {
    const url = e.target.value.trim();
    if (url) {
      previewImg.src = url;
      previewZone.style.display = 'none';
      previewContainer.classList.add('active');
      currentEditedImageUrl = url;
    } else {
      if (!fileInput.value) {
        fileInput.value = '';
        previewImg.src = '';
        previewZone.style.display = 'flex';
        previewContainer.classList.remove('active');
        currentEditedImageUrl = '';
      }
    }
  };
  if (editResourceImageUrlInput) {
    editResourceImageUrlInput.addEventListener('input', urlInputHandler);
  }

  const changeHandler = async (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        toastFunc('Please upload an image file.', 'warning');
        return;
      }
      const submitBtn = editForm.querySelector('button[type="submit"]');
      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Uploading Image...';
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          previewZone.style.display = 'none';
          previewContainer.classList.add('active');
        };
        reader.readAsDataURL(file);

        let uploadFile = file;
        if (file.size > 200000) {
          const compressed = await compressImage(file, 600, 600);
          uploadFile = base64ToFile(compressed, file.name);
        }

        progressBarContainer.classList.add('active');
        progressBar.style.width = '0%';

        currentEditedImageUrl = await storageService.uploadImage(uploadFile, (progress) => {
          progressBar.style.width = `${progress}%`;
        });
        if (editResourceImageUrlInput) {
          editResourceImageUrlInput.value = currentEditedImageUrl;
        }
        toastFunc('Image updated successfully.', 'success');
      } catch (err) {
        console.error(err);
        toastFunc('Image upload failed: ' + err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Changes';
        }
        setTimeout(() => progressBarContainer.classList.remove('active'), 500);
      }
    }
  };
  fileInput.addEventListener('change', changeHandler);

  const removeHandler = (e) => {
    e.stopPropagation();
    fileInput.value = '';
    previewImg.src = '';
    previewZone.style.display = 'flex';
    previewContainer.classList.remove('active');
    currentEditedImageUrl = '';
    if (editResourceImageUrlInput) {
      editResourceImageUrlInput.value = '';
    }
  };
  removeBtn.addEventListener('click', removeHandler);

  // Bind Form Submit
  const submitHandler = async (e) => {
    e.preventDefault();
    const submitBtn = editForm.querySelector('button[type="submit"]');

    const title = document.getElementById('editResourceTitle').value.trim();
    const category = document.getElementById('editResourceCategory').value;
    const quantity = document.getElementById('editResourceQuantity').value.trim();
    const location = document.getElementById('editResourceLocation').value.trim();
    const description = document.getElementById('editResourceDescription').value.trim();

    const latitude = document.getElementById('editResourceLat').value;
    const longitude = document.getElementById('editResourceLng').value;

    if (!title || !category || !quantity || !location || !description) {
      toastFunc('Please fill in all fields.', 'warning');
      return;
    }

    try {
      setLoading(submitBtn, true, 'Updating...');
      const imageUrlInputVal = editResourceImageUrlInput ? editResourceImageUrlInput.value.trim() : '';
      const finalImageUrl = currentEditedImageUrl || imageUrlInputVal;

      await dbService.updateResource(resource.resourceId, {
        title,
        category,
        quantity,
        location,
        description,
        imageUrl: finalImageUrl,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null
      });
      toastFunc('Resource updated successfully!', 'success');
      editModal.classList.remove('active');
      cleanupListeners();
    } catch (err) {
      console.error(err);
      toastFunc('Failed to update: ' + err.message, 'error');
    } finally {
      setLoading(submitBtn, false, 'Save Changes');
    }
  };
  editForm.addEventListener('submit', submitHandler);

  // Close cleanup helper
  const cleanupListeners = () => {
    editForm.removeEventListener('submit', submitHandler);
    fileInput.removeEventListener('change', changeHandler);
    previewZone.removeEventListener('click', clickHandler);
    removeBtn.removeEventListener('click', removeHandler);
    cancelEditBtn.removeEventListener('click', closeHandler);
    window.removeEventListener('click', windowHandler);
    if (editResourceImageUrlInput) {
      editResourceImageUrlInput.removeEventListener('input', urlInputHandler);
    }
  };

  const closeHandler = () => {
    editModal.classList.remove('active');
    cleanupListeners();
  };
  cancelEditBtn.addEventListener('click', closeHandler);

  const windowHandler = (e) => {
    if (e.target === editModal) {
      editModal.classList.remove('active');
      cleanupListeners();
    }
  };
  window.addEventListener('click', windowHandler);

  editModal.classList.add('active');
  const modalBody = editModal.querySelector('.modal-body');
  if (modalBody) modalBody.scrollTop = 0;
}

// Helpers
function populateLocationFilters(resources) {
  const select = document.getElementById('locationFilter');
  if (!select) return;
  const currentVal = select.value;
  
  // Extract unique locations
  const locations = [...new Set(resources.map(r => r.location).filter(Boolean))].sort();
  
  select.innerHTML = '<option value="All">All Locations</option>';
  locations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    select.appendChild(opt);
  });
  
  // Restore value if still present
  if (locations.includes(currentVal)) {
    select.value = currentVal;
  }
}

function setLoading(button, isLoading, text) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.original = button.textContent;
    button.textContent = text;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.original || text;
  }
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay}d ago`;
}

function getDefaultBanner(category) {
  const banners = {
    'Food': 'https://images.unsplash.com/photo-1488459718432-36c85098938a?w=600&auto=format&fit=crop&q=60',
    'Clothes': 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&auto=format&fit=crop&q=60',
    'Books': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=60',
    'Furniture': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&auto=format&fit=crop&q=60',
    'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&auto=format&fit=crop&q=60',
    'Kitchen Items': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=60',
    'Medical Supplies': 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=60',
    'Educational Materials': 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&auto=format&fit=crop&q=60',
    'Household Items': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=60',
    'Other': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60'
  };
  return banners[category] || banners['Other'];
}

// Canvas downscaler
function compressImage(file, maxWidth = 600, maxHeight = 600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.onerror = (err) => reject(err);
  });
}

function base64ToFile(base64Data, filename) {
  const arr = base64Data.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

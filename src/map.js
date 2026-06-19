// Map controller module using Leaflet.js
// Provides main map visualization and form location pickers

let mainMapInstance = null;
let mainMapMarkers = [];

// Custom green pin icon matching the EcoCircle forest theme
const createCustomIcon = (category) => {
  // We can vary the color slightly by category if we want, or use a beautiful emerald green
  const color = 'var(--primary)'; // #10b981
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        border: 2px solid #ffffff;
        transform: rotate(-45deg);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 12px;
          height: 12px;
          background-color: #ffffff;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

/**
 * Initialize the main interactive map on the dashboard
 * @param {string} containerId - The map div ID
 * @param {Array} resources - List of resources to plot
 * @param {Function} onMarkerClick - Callback when details button in popup is clicked
 */
export function initMainMap(containerId, resources, onMarkerClick) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  // Clean up existing map instance if any
  if (mainMapInstance) {
    mainMapInstance.remove();
    mainMapInstance = null;
  }
  mainMapMarkers = [];

  // Default coordinates centered around Portland/Greenwood cluster
  const defaultCenter = [45.5152, -122.6784];
  
  // Create map instance
  mainMapInstance = L.map(containerId, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView(defaultCenter, 13);

  // Add OpenStreetMap tile layer with beautiful clean styling
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mainMapInstance);

  // Add event listener to the map container for popup button clicks (event delegation)
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.map-popup-btn');
    if (btn) {
      const resourceId = btn.getAttribute('data-resource-id');
      if (resourceId && onMarkerClick) {
        onMarkerClick(resourceId);
      }
    }
  });

  // Plot resources
  updateMainMapMarkers(resources);

  return mainMapInstance;
}

/**
 * Updates the markers plotted on the main map
 * @param {Array} resources - List of resources to plot
 */
export function updateMainMapMarkers(resources) {
  if (!mainMapInstance) return;

  // Clear existing markers
  mainMapMarkers.forEach(m => mainMapInstance.removeLayer(m));
  mainMapMarkers = [];

  const availableResources = resources.filter(r => r.status === 'Available' || r.status === 'Pending');

  if (availableResources.length === 0) return;

  const latLngs = [];

  availableResources.forEach(res => {
    // If resource doesn't have coordinates, don't plot it
    if (res.latitude === undefined || res.longitude === undefined || res.latitude === null || res.longitude === null) {
      return;
    }

    const lat = Number(res.latitude);
    const lng = Number(res.longitude);
    latLngs.push([lat, lng]);

    const defaultBanners = {
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
    const popupImgSrc = res.imageUrl || defaultBanners[res.category] || defaultBanners['Other'];

    // Popup content layout matching premium glassmorphism theme
    const popupContent = `
      <div class="map-popup-container">
        <img class="map-popup-image" src="${popupImgSrc}" alt="${res.title}" onerror="this.src='https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60'">
        <div class="map-popup-body">
          <span class="map-popup-category">${res.category}</span>
          <h4 class="map-popup-title">${res.title}</h4>
          <div class="map-popup-meta">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>Qty: ${res.quantity}</span>
          </div>
          <div class="map-popup-meta" style="margin-top: 0.2rem;">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${res.location}</span>
          </div>
          <button class="btn btn-primary map-popup-btn" data-resource-id="${res.resourceId}">View Details</button>
        </div>
      </div>
    `;

    const marker = L.marker([lat, lng], {
      icon: createCustomIcon(res.category)
    })
    .bindPopup(popupContent)
    .addTo(mainMapInstance);

    mainMapMarkers.push(marker);
  });

  // Fit bounds if we have plotted markers
  if (latLngs.length > 0) {
    try {
      const bounds = L.latLngBounds(latLngs);
      mainMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } catch (e) {
      console.error("Error fitting map bounds:", e);
    }
  }
}

/**
 * Initialize an interactive map picker for forms
 * @param {string} containerId - The map div ID
 * @param {string} latInputId - The hidden latitude input field ID
 * @param {string} lngInputId - The hidden longitude input field ID
 * @param {number} defaultLat - Default latitude
 * @param {number} defaultLng - Default longitude
 */
export function initFormMapPicker(containerId, latInputId, lngInputId, defaultLat = 45.5152, defaultLng = -122.6784) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const latInput = document.getElementById(latInputId);
  const lngInput = document.getElementById(lngInputId);

  // Set default initial values to inputs if they don't have them
  if (latInput && !latInput.value) latInput.value = defaultLat;
  if (lngInput && !lngInput.value) lngInput.value = defaultLng;

  const initialLat = latInput && latInput.value ? Number(latInput.value) : defaultLat;
  const initialLng = lngInput && lngInput.value ? Number(lngInput.value) : defaultLng;

  // Create picker map instance
  const map = L.map(containerId, {
    zoomControl: true,
    scrollWheelZoom: false
  }).setView([initialLat, initialLng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; contributors'
  }).addTo(map);

  // Expose a custom icon for pickers
  const pickerIcon = L.divIcon({
    className: 'custom-picker-icon',
    html: `
      <div style="
        background-color: var(--accent);
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        border: 2px solid #ffffff;
        transform: rotate(-45deg);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: #ffffff;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });

  // Put a marker
  const marker = L.marker([initialLat, initialLng], {
    icon: pickerIcon,
    draggable: true
  }).addTo(map);

  // Helper to update inputs
  const updateInputs = (lat, lng) => {
    if (latInput) latInput.value = Number(lat).toFixed(6);
    if (lngInput) lngInput.value = Number(lng).toFixed(6);
  };

  // Event: Marker dragged
  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    updateInputs(pos.lat, pos.lng);
  });

  // Event: Map clicked
  map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    updateInputs(e.latlng.lat, e.latlng.lng);
  });

  // Return helper handlers so parent can interact
  return {
    mapInstance: map,
    markerInstance: marker,
    invalidateSize: () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 50);
    },
    setLocation: (lat, lng) => {
      const targetLat = Number(lat || defaultLat);
      const targetLng = Number(lng || defaultLng);
      marker.setLatLng([targetLat, targetLng]);
      map.setView([targetLat, targetLng], 14);
      updateInputs(targetLat, targetLng);
    }
  };
}

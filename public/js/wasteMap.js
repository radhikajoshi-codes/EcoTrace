/**
 * EcoTrace Interactive Waste & Location Map Module
 * 
 * Centered on:
 * Acropolis Institute of Technology and Research (AITR)
 * Bypass Road, Square, Manglaya Sadak, Indore, Madhya Pradesh 453771
 * Coordinates: [22.724, 75.874]
 * 
 * Features:
 * - 📍 Geolocation with Haversine nearest distance calculation & sorting
 * - 🎓 Prominent AITR, Indore Campus Central Hub Marker
 * - 🏷️ Dynamic categorized facilities (Recycling, E-Waste, Waste Collection, High-Risk)
 * - 🔍 Search & Category Filtering
 * - ⚠️ Visual Environmental Risk Halos
 * - 📋 Selected Facility Detail Drawer / Bottom Panel
 * - 🧭 Nearest Facilities list sorted by actual distance (e.g. "1.8 km away")
 * - 🛡️ Graceful fallback to AITR, Indore if location is denied
 */

class WasteMap {
  constructor(mapContainerId = 'live-waste-map-container') {
    this.containerId = mapContainerId;
    this.map = null;
    this.markersGroup = null;
    this.userLocationMarker = null;
    this.aitrMarker = null;
    this.riskCirclesGroup = null;
    this.locations = [];
    this.currentFilter = 'all';
    
    // Default: AITR Indore (Acropolis Institute of Technology & Research)
    const defaultLoc = (window.DEMO_DATA && window.DEMO_DATA.defaultLocation) 
      ? window.DEMO_DATA.defaultLocation 
      : { lat: 22.724, lng: 75.874, name: 'AITR, Indore' };
      
    this.userCoords = { lat: defaultLoc.lat, lng: defaultLoc.lng };
    this.selectedLocation = null;
    this.isLeafletLoaded = typeof L !== 'undefined';
    this.init();
  }

  async init() {
    this.bindControls();
    await this.fetchLocations();
    this.initializeMap();
  }

  bindControls() {
    // "Use My Location" Button
    const btnLoc = document.getElementById('btn-use-my-location');
    if (btnLoc) {
      btnLoc.addEventListener('click', () => this.requestUserLocation());
    }

    // Filter Buttons
    document.querySelectorAll('.map-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        this.filterLocations(type);
      });
    });

    // Indore Localities Navigation Pills
    document.querySelectorAll('.map-city-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const city = btn.getAttribute('data-city');
        this.panToCity(city);
        document.querySelectorAll('.map-city-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Search Input
    const searchInput = document.getElementById('map-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.searchLocations(e.target.value));
    }

    // Zoom Controls
    const btnZoomIn = document.getElementById('map-btn-zoom-in');
    const btnZoomOut = document.getElementById('map-btn-zoom-out');
    const btnResetView = document.getElementById('map-btn-reset-view');

    if (btnZoomIn) btnZoomIn.addEventListener('click', () => this.zoom(1));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => this.zoom(-1));
    if (btnResetView) btnResetView.addEventListener('click', () => this.resetView());
  }

  panToCity(city) {
    if (!this.map) return;
    const localityCoords = {
      all: { lat: 22.7240, lng: 75.8740, zoom: 12 },
      aitr: { lat: 22.7240, lng: 75.8740, zoom: 15 },
      mangliya: { lat: 22.7480, lng: 75.8920, zoom: 14 },
      vijaynagar: { lat: 22.7533, lng: 75.8937, zoom: 14 },
      palasia: { lat: 22.7206, lng: 75.8824, zoom: 14 },
      bhanwarkuan: { lat: 22.6892, lng: 75.8647, zoom: 14 },
      rau: { lat: 22.6284, lng: 75.8115, zoom: 13 }
    };

    if (localityCoords[city]) {
      const c = localityCoords[city];
      this.map.flyTo([c.lat, c.lng], c.zoom, { duration: 1.2 });
    } else if (city === 'all') {
      this.resetView();
    }
  }

  async fetchLocations() {
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      if (data.success && data.locations && data.locations.length > 0) {
        this.locations = data.locations;
      } else if (window.DEMO_DATA && window.DEMO_DATA.facilities) {
        this.locations = [...window.DEMO_DATA.facilities];
      }
    } catch (err) {
      console.warn('Using client DEMO_DATA facilities fallback:', err);
      if (window.DEMO_DATA && window.DEMO_DATA.facilities) {
        this.locations = [...window.DEMO_DATA.facilities];
      }
    }

    this.updateDistancesAndSort();
  }

  updateDistancesAndSort() {
    this.locations.forEach(loc => {
      const dist = this.calculateDistance(this.userCoords.lat, this.userCoords.lng, loc.lat, loc.lng);
      loc.distance = dist;
      loc.distanceText = `${dist} km away`;
    });
    // Sort ascending: nearest facilities first
    this.locations.sort((a, b) => a.distance - b.distance);
  }

  initializeMap() {
    const el = document.getElementById(this.containerId);
    if (!el) return;

    if (typeof L === 'undefined') {
      console.warn('Leaflet not loaded; rendering fallback view.');
      this.renderFallbackMap();
      return;
    }

    try {
      // Default to AITR, Indore [22.724, 75.874]
      this.map = L.map(this.containerId, {
        center: [22.724, 75.874],
        zoom: 13,
        zoomControl: false
      });

      // Free OpenStreetMap Tile Layer
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors | EcoTrace Indore (AITR)'
      });

      tileLayer.addTo(this.map);

      // Create Layer Groups
      this.riskCirclesGroup = L.layerGroup().addTo(this.map);
      this.markersGroup = L.layerGroup().addTo(this.map);

      // Add prominent AITR Campus Marker
      this.addAITRMarker();

      // Render Markers & Risk Circles
      this.renderMarkers(this.locations);
      this.renderRiskHalos();
      this.renderNearestFacilitiesDrawer();

      // Initial Default Label
      const locStatus = document.getElementById('user-location-display');
      if (locStatus) {
        locStatus.innerText = '📍 Location: AITR, Indore (Central Hub)';
      }

    } catch (err) {
      console.error('Leaflet initialization error:', err);
      this.renderFallbackMap();
    }
  }

  addAITRMarker() {
    if (!this.map) return;

    if (this.aitrMarker) {
      this.map.removeLayer(this.aitrMarker);
    }

    const aitrIcon = L.divIcon({
      className: 'aitr-campus-marker-icon',
      html: `
        <div class="aitr-pin-container">
          <div class="aitr-pin-pulse"></div>
          <div class="aitr-pin-badge">🎓 AITR Indore</div>
        </div>
      `,
      iconSize: [110, 36],
      iconAnchor: [55, 18]
    });

    this.aitrMarker = L.marker([22.7240, 75.8740], { icon: aitrIcon, zIndexOffset: 1500 })
      .bindPopup(`
        <div style="font-family:Inter,sans-serif; padding:6px; min-width:220px;">
          <div style="font-size:0.75rem; font-weight:700; color:#059669; text-transform:uppercase; letter-spacing:0.04em;">★ Central Smart Waste Hub</div>
          <h4 style="font-size:0.95rem; font-weight:700; color:#0F172A; margin:3px 0 2px;">Acropolis Institute (AITR)</h4>
          <p style="font-size:0.78rem; color:#64748B; margin:0 0 8px;">Bypass Road, Square, Manglaya Sadak, Indore 453771</p>
          <div style="display:inline-block; font-size:0.72rem; background:#ECFDF5; color:#065F46; padding:3px 8px; border-radius:4px; font-weight:600;">
            Primary Sorting & Monitoring Hub
          </div>
        </div>
      `)
      .addTo(this.map);
  }

  renderMarkers(locList) {
    if (!this.map || !this.markersGroup) return;

    this.markersGroup.clearLayers();

    locList.forEach(loc => {
      const iconHtml = this.createMarkerHtml(loc);
      const customIcon = L.divIcon({
        className: 'custom-map-div-icon',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon });

      marker.on('click', () => {
        this.selectLocation(loc);
      });

      const distText = loc.distanceText || `${(loc.distance || 0).toFixed(1)} km away`;
      marker.bindTooltip(`
        <strong>${loc.name}</strong><br>
        <span style="font-size:11px; opacity:0.85;">${loc.type.replace('_', ' ').toUpperCase()} · ${distText}</span>
      `, {
        direction: 'top',
        className: 'custom-map-tooltip'
      });

      this.markersGroup.addLayer(marker);
    });
  }

  renderRiskHalos() {
    if (!this.map || !this.riskCirclesGroup) return;

    this.riskCirclesGroup.clearLayers();

    this.locations.forEach(loc => {
      if (loc.riskLevel === 'High' || loc.riskLevel === 'Critical' || loc.riskLevel === 'Moderate') {
        const color = loc.riskLevel === 'Critical' ? '#DC2626' : (loc.riskLevel === 'High' ? '#EA580C' : '#D97706');
        const circle = L.circle([loc.lat, loc.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.15,
          radius: loc.riskLevel === 'Critical' ? 900 : 600,
          weight: 1.5,
          dashArray: '4, 4'
        });
        circle.bindTooltip(`<strong>Monitored Buffer: ${loc.riskLevel} Risk</strong><br>${loc.name}`, { direction: 'center' });
        this.riskCirclesGroup.addLayer(circle);
      }
    });
  }

  renderNearestFacilitiesDrawer() {
    const drawer = document.getElementById('map-nearest-facilities-drawer');
    if (!drawer) return;

    const nearestThree = this.locations.slice(0, 4);
    drawer.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Nearest Facilities to Current Location:</span>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${nearestThree.map(loc => `
          <button onclick="window.wasteMap.selectLocationById('${loc.id}')" class="nearest-facility-pill" style="display:flex; align-items:center; gap:6px; padding:6px 12px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:6px; cursor:pointer; font-size:0.78rem;">
            <span style="font-weight:600; color:var(--text-main);">${loc.name}</span>
            <span style="font-weight:700; color:#059669; background:rgba(5,150,105,0.1); padding:2px 6px; border-radius:4px;">${loc.distanceText || (loc.distance + ' km')}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  selectLocationById(id) {
    const loc = this.locations.find(l => l.id === id);
    if (loc) this.selectLocation(loc);
  }

  createMarkerHtml(loc) {
    const typeColorMap = {
      recycling: '#059669',
      e_waste: '#D97706',
      waste_collection: '#2563EB',
      high_risk: '#DC2626',
      landfill: '#475569',
      monitored: '#0D9488'
    };

    const typeEmojiMap = {
      recycling: '♻️',
      e_waste: '🔋',
      waste_collection: '🗑️',
      high_risk: '⚠️',
      landfill: '🏭',
      monitored: '🌿'
    };

    const color = typeColorMap[loc.type] || '#059669';
    const emoji = typeEmojiMap[loc.type] || '📍';
    const isCritical = loc.riskLevel === 'Critical' || loc.riskLevel === 'High';

    return `
      <div class="ecotrace-map-pin ${isCritical ? 'pin-pulse-risk' : ''}" style="--pin-color: ${color};">
        <div class="pin-head">
          <span class="pin-emoji">${emoji}</span>
        </div>
        <div class="pin-point"></div>
      </div>
    `;
  }

  selectLocation(loc) {
    this.selectedLocation = loc;

    if (this.map) {
      this.map.panTo([loc.lat, loc.lng], { animate: true, duration: 0.8 });
    }

    const panel = document.getElementById('map-location-detail-panel');
    if (!panel) return;

    const riskColorMap = {
      Low: '#059669',
      Moderate: '#D97706',
      High: '#EA580C',
      Critical: '#DC2626'
    };
    const riskColor = riskColorMap[loc.riskLevel] || '#4B5563';
    const distText = loc.distanceText || `${this.calculateDistance(this.userCoords.lat, this.userCoords.lng, loc.lat, loc.lng)} km away`;

    panel.innerHTML = `
      <div class="location-detail-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div>
            <span class="status-pill ${loc.type === 'recycling' ? 'online' : (loc.type === 'e_waste' ? 'attention' : 'maintenance')}">
              ${(loc.type || 'FACILITY').replace('_', ' ').toUpperCase()}
            </span>
            <h3 style="font-size:1.15rem; font-weight:700; color:#0F172A; margin:6px 0 2px;">${loc.name}</h3>
            <div style="font-size:0.78rem; color:#64748B;">${loc.address}</div>
          </div>
          <button onclick="document.getElementById('map-location-detail-panel').style.display='none'" class="icon-button" style="width:28px; height:28px; font-size:1rem;">&times;</button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:14px;">
          <div class="loc-spec-box">
            <span class="loc-spec-lbl">Status</span>
            <span class="loc-spec-val" style="color:#059669;">${loc.status || 'Active'}</span>
          </div>
          <div class="loc-spec-box">
            <span class="loc-spec-lbl">Risk Level</span>
            <span class="loc-spec-val" style="color:${riskColor};">${loc.riskLevel || 'Low'}</span>
          </div>
          <div class="loc-spec-box">
            <span class="loc-spec-lbl">Capacity</span>
            <span class="loc-spec-val">${loc.capacity || 50}% Full</span>
          </div>
          <div class="loc-spec-box">
            <span class="loc-spec-lbl">Proximity</span>
            <span class="loc-spec-val" style="color:#2563EB; font-weight:700;">${distText}</span>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#64748B; margin-bottom:4px;">
            <span>Current Daily Throughput</span>
            <span>${loc.wasteCollected || '400 kg'} processed</span>
          </div>
          <div class="progress-track" style="height:6px;">
            <div class="progress-fill" style="width:${loc.capacity || 50}%; background-color:${(loc.capacity || 50) > 85 ? '#DC2626' : ((loc.capacity || 50) > 65 ? '#F59E0B' : '#10B981')};"></div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; margin-bottom:6px;">Accepted Waste Categories:</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${(loc.acceptedTypes || 'Dry Waste, Recyclables').split(',').map(tag => `
              <span class="accepted-waste-tag">${tag.trim()}</span>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button onclick="window.wasteMap.getDirections('${loc.name}', ${loc.lat}, ${loc.lng})" class="btn-primary" style="flex:1; height:38px; font-size:0.82rem;">
            🗺️ Directions (${distText})
          </button>
          <button onclick="window.app.switchTab('sorting')" class="btn-secondary-action" style="flex:1; height:38px; font-size:0.82rem;">
            ⚙️ Connect Sorting Station
          </button>
        </div>
      </div>
    `;

    panel.style.display = 'block';
  }

  requestUserLocation() {
    const locStatus = document.getElementById('user-location-display');
    if (!navigator.geolocation) {
      this.fallbackToAITR();
      return;
    }

    if (locStatus) locStatus.innerText = 'Acquiring GPS location...';
    window.app.showToast('📍 Requesting browser location permission...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        if (locStatus) {
          locStatus.innerText = `📍 GPS Active: ${this.userCoords.lat.toFixed(4)}, ${this.userCoords.lng.toFixed(4)}`;
        }

        this.addUserLocationMarker('Your Current GPS Location');
        if (this.map) {
          this.map.flyTo([this.userCoords.lat, this.userCoords.lng], 14, { duration: 1.2 });
        }

        // Recalculate distances from user GPS and sort
        this.updateDistancesAndSort();
        this.renderMarkers(this.locations);
        this.renderNearestFacilitiesDrawer();
        window.app.showToast(`✓ GPS locked! Nearest facility is ${this.locations[0].name} (${this.locations[0].distanceText}).`);
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err.message);
        this.fallbackToAITR();
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  }

  fallbackToAITR() {
    const locStatus = document.getElementById('user-location-display');
    if (locStatus) {
      locStatus.innerText = '📍 Location: AITR, Indore';
    }
    window.app.showToast('Location unavailable — showing facilities near AITR, Indore.');

    this.userCoords = { lat: 22.724, lng: 75.874 };
    if (this.map) {
      this.map.flyTo([22.724, 75.874], 13, { duration: 1.2 });
    }
    this.updateDistancesAndSort();
    this.renderMarkers(this.locations);
    this.renderNearestFacilitiesDrawer();
    this.addAITRMarker();
  }

  addUserLocationMarker(label = 'Your Location') {
    if (!this.map) return;

    if (this.userLocationMarker) {
      this.map.removeLayer(this.userLocationMarker);
    }

    const userIcon = L.divIcon({
      className: 'user-location-radar-icon',
      html: `
        <div class="user-radar-beacon">
          <div class="radar-dot"></div>
          <div class="radar-ring"></div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    this.userLocationMarker = L.marker([this.userCoords.lat, this.userCoords.lng], { icon: userIcon })
      .bindPopup(`<strong>📍 ${label}</strong><br>Coordinates: ${this.userCoords.lat.toFixed(4)}, ${this.userCoords.lng.toFixed(4)}`)
      .addTo(this.map);
  }

  filterLocations(type) {
    this.currentFilter = type;

    document.querySelectorAll('.map-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-type') === type);
    });

    let filtered = this.locations;
    if (type === 'recycling') {
      filtered = this.locations.filter(l => l.type === 'recycling');
    } else if (type === 'e_waste') {
      filtered = this.locations.filter(l => l.type === 'e_waste');
    } else if (type === 'waste_collection') {
      filtered = this.locations.filter(l => l.type === 'waste_collection' || l.type === 'landfill');
    } else if (type === 'high_risk') {
      filtered = this.locations.filter(l => l.type === 'high_risk' || l.riskLevel === 'High' || l.riskLevel === 'Critical' || l.riskLevel === 'Moderate');
    }

    this.renderMarkers(filtered);
    window.app.showToast(`Showing ${filtered.length} facilities matching "${type.toUpperCase()}"`);
  }

  searchLocations(query = '') {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.filterLocations(this.currentFilter);
      return;
    }

    const matched = this.locations.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q) ||
      l.type.toLowerCase().includes(q) ||
      (l.acceptedTypes || '').toLowerCase().includes(q)
    );

    this.renderMarkers(matched);
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  }

  zoom(delta) {
    if (this.map) {
      if (delta > 0) this.map.zoomIn();
      else this.map.zoomOut();
    }
  }

  resetView() {
    if (this.map) {
      this.map.flyTo([22.724, 75.874], 13, { duration: 1 });
    }
  }

  getDirections(name, lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  }

  renderFallbackMap() {
    const el = document.getElementById(this.containerId);
    if (!el) return;
    el.innerHTML = `
      <div style="padding:48px 24px; text-align:center; color:#94A3B8;">
        <h3>AITR Indore Waste Map</h3>
        <p>Central Hub: Acropolis Institute of Technology & Research (22.724° N, 75.874° E)</p>
      </div>
    `;
  }
}

window.WasteMap = WasteMap;

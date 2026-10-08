/**
 * EcoTrace Regional Waste Impact Map — India National Smart Grid
 * 
 * Replicates the visual treatment of the Stitch Regional Impact Map:
 * - India national geography, river basins (Ganges, Yamuna, Narmada, Godavari, Krishna)
 * - Contamination & recovery density envelopes (Normal, Elevated, Critical)
 * - Interconnected circular recovery transit corridors
 * - Interactive station pins for Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Pune
 * - Station detail popover with one-click "Launch Sorting at Station"
 */

class ImpactMap {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.stations = [];
    this.zoomLevel = 1.0;
    this.init();
  }

  init() {
    if (!this.container) return;
    this.renderBaseMap();
  }

  setStations(stations) {
    this.stations = stations || [];
    this.renderMarkers();
  }

  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.2, 2.0);
    this.applyTransform();
  }

  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.2, 0.8);
    this.applyTransform();
  }

  resetZoom() {
    this.zoomLevel = 1.0;
    this.applyTransform();
  }

  applyTransform() {
    const mapGroup = document.getElementById('map-interactive-group');
    if (mapGroup) {
      mapGroup.setAttribute('transform', `scale(${this.zoomLevel}) translate(${(1 - this.zoomLevel) * 270}, ${(1 - this.zoomLevel) * 150})`);
    }
  }

  renderBaseMap() {
    this.container.innerHTML = `
      <svg class="map-svg" viewBox="0 0 600 320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="grad-critical" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#EF4444" stop-opacity="0.38"/>
            <stop offset="60%" stop-color="#EF4444" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#EF4444" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="grad-elevated" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.32"/>
            <stop offset="60%" stop-color="#F59E0B" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="grad-normal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.28"/>
            <stop offset="60%" stop-color="#10B981" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
          </radialGradient>
          <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g id="map-interactive-group" style="transition: transform 0.25s ease;">
          <!-- Geographic land outline (India Subcontinent Map) -->
          <path d="M 280,22 
                   C 292,18 305,25 310,38 
                   L 318,52 C 340,65 375,85 410,95 
                   L 445,90 C 458,92 468,102 462,115 
                   L 435,128 C 418,135 412,148 402,158 
                   L 390,165 C 382,180 372,205 352,228 
                   L 332,250 C 315,272 292,295 272,308 
                   C 265,304 252,285 242,265 
                   L 225,235 C 205,205 190,185 188,168 
                   L 165,152 C 158,142 162,130 178,122 
                   L 198,118 C 212,105 218,88 232,70 
                   L 255,42 Z" 
                fill="#EDF2F7" stroke="#CBD5E1" stroke-width="1.3" stroke-dasharray="2,2" />

          <!-- Ganges & Yamuna River Corridors -->
          <path d="M 268,52 Q 295,78 345,102 T 402,158" 
                fill="none" stroke="#93C5FD" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>
          <!-- Narmada River Corridor -->
          <path d="M 285,145 Q 235,150 188,154" 
                fill="none" stroke="#93C5FD" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/>
          <!-- Godavari & Krishna River Corridors -->
          <path d="M 218,178 Q 275,195 348,225" 
                fill="none" stroke="#93C5FD" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/>

          <!-- High-Speed Circular Interconnect Corridors -->
          <path d="M 280,75 L 205,175 L 220,185 L 275,245 L 305,250 L 285,200 Z"
                fill="none" stroke="#059669" stroke-width="1.2" stroke-dasharray="4,4" opacity="0.55"/>
          <path d="M 280,75 L 285,200 L 275,245"
                fill="none" stroke="#059669" stroke-width="1.2" stroke-dasharray="4,4" opacity="0.4"/>

          <!-- Contamination & Recovery Envelopes -->
          <!-- Critical Zone Envelope (Red) at Delhi NCR -->
          <ellipse cx="280" cy="75" rx="46" ry="32" fill="url(#grad-critical)" />
          <!-- Elevated Zone Envelope (Amber) at Mumbai / Western Corridor -->
          <ellipse cx="205" cy="175" rx="42" ry="32" fill="url(#grad-elevated)" />
          <!-- Normal High Recovery Zone (Green) at Bengaluru / Southern Corridor -->
          <ellipse cx="275" cy="245" rx="52" ry="38" fill="url(#grad-normal)" />

          <!-- Region Label -->
          <text x="35" y="48" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="#64748B" letter-spacing="1.2">INDIA NATIONAL GRID</text>
          <text x="35" y="62" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#94A3B8">METROPOLITAN WASTE CORRIDORS</text>

          <!-- Dynamic Station Markers Layer -->
          <g id="station-markers-group"></g>
        </g>
      </svg>
      <div id="map-station-popover" style="display:none; position:absolute; z-index:50;"></div>
    `;

    this.renderMarkers();
  }

  renderMarkers() {
    const group = document.getElementById('station-markers-group');
    if (!group) return;

    if (!this.stations || this.stations.length === 0) {
      // Default India metropolitan positions for initial render
      this.stations = [
        { id: 'ST-01', name: 'Central Sorting Hub (Okhla)', location: 'Okhla Phase III · New Delhi', status: 'CRITICAL', x: 280, y: 75, itemsToday: 512, recoveryRate: 78.4, contaminationRate: 11.8, specialHandlingCount: 14, lastActivity: '2 min ago' },
        { id: 'ST-02', name: 'Western Recovery Terminal (BKC)', location: 'Bandra Kurla Complex · Mumbai', status: 'NORMAL', x: 205, y: 175, itemsToday: 438, recoveryRate: 84.1, contaminationRate: 4.9, specialHandlingCount: 9, lastActivity: '5 min ago' },
        { id: 'ST-03', name: 'Tech Corridor Depository', location: 'Whitefield Tech Zone · Bengaluru', status: 'ELEVATED', x: 275, y: 245, itemsToday: 342, recoveryRate: 72.5, contaminationRate: 12.2, specialHandlingCount: 21, lastActivity: '7 min ago' },
        { id: 'ST-04', name: 'Cyberabad Automated MRF', location: 'HITEC City Sector 2 · Hyderabad', status: 'NORMAL', x: 285, y: 200, itemsToday: 310, recoveryRate: 81.2, contaminationRate: 5.8, specialHandlingCount: 11, lastActivity: '12 min ago' },
        { id: 'ST-05', name: 'Southern Coastal Hub', location: 'Guindy Industrial Estate · Chennai', status: 'NORMAL', x: 305, y: 250, itemsToday: 415, recoveryRate: 85.0, contaminationRate: 4.5, specialHandlingCount: 16, lastActivity: '15 min ago' },
        { id: 'ST-06', name: 'Deccan Circular Materials Line', location: 'Hadapsar Industrial Area · Pune', status: 'NORMAL', x: 220, y: 185, itemsToday: 280, recoveryRate: 76.9, contaminationRate: 6.7, specialHandlingCount: 8, lastActivity: '24 min ago' }
      ];
    }

    // Map stations to coordinates on the India SVG
    const coordMap = {
      'ST-01': { x: 280, y: 75 },  // Delhi
      'ST-02': { x: 205, y: 175 }, // Mumbai
      'ST-03': { x: 275, y: 245 }, // Bengaluru
      'ST-04': { x: 285, y: 200 }, // Hyderabad
      'ST-05': { x: 305, y: 250 }, // Chennai
      'ST-06': { x: 220, y: 185 }  // Pune
    };

    let markersHtml = '';

    this.stations.forEach((st, idx) => {
      const fixedCoord = coordMap[st.id];
      const x = fixedCoord ? fixedCoord.x : (st.x || 200 + (idx * 30));
      const y = fixedCoord ? fixedCoord.y : (st.y || 80 + (idx * 25));

      const colorMap = {
        CRITICAL: '#EF4444',
        ELEVATED: '#F59E0B',
        NORMAL: '#10B981'
      };
      const color = colorMap[st.status] || '#10B981';

      markersHtml += `
        <g class="station-pin" data-id="${st.id}" style="cursor: pointer;" transform="translate(${x}, ${y})">
          <!-- Pulse ring for critical/elevated -->
          ${st.status !== 'NORMAL' ? `
            <circle cx="0" cy="0" r="14" fill="${color}" opacity="0.25">
              <animate attributeName="r" values="8;18;8" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2s" repeatCount="indefinite" />
            </circle>
          ` : ''}
          <circle cx="0" cy="0" r="8" fill="#FFFFFF" stroke="${color}" stroke-width="2.5" />
          <circle cx="0" cy="0" r="3.5" fill="${color}" />
          <text x="12" y="3" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#334155">${st.name.split(' ')[0]}</text>
        </g>
      `;
    });

    group.innerHTML = markersHtml;

    // Attach click events
    group.querySelectorAll('.station-pin').forEach(pin => {
      pin.addEventListener('click', (e) => {
        const id = pin.getAttribute('data-id');
        this.showStationPopover(id, e);
      });
    });
  }

  showStationPopover(stationId, event) {
    const station = this.stations.find(s => s.id === stationId);
    if (!station) return;

    const popover = document.getElementById('map-station-popover');
    if (!popover) return;

    const statusBadgeClass = station.status.toLowerCase();

    popover.innerHTML = `
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.12); padding:16px; width:260px; font-family:Inter,sans-serif;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h4 style="font-size:0.92rem; font-weight:700; color:#0F172A; margin:0;">${station.name}</h4>
          <span class="status-pill ${statusBadgeClass}">${station.status}</span>
        </div>
        <div style="font-size:0.75rem; color:#64748B; margin-bottom:12px;">${station.location || 'India Sorting Grid Hub'}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.78rem; margin-bottom:12px;">
          <div style="background:#F8FAFC; padding:6px 8px; border-radius:6px;">
            <div style="color:#64748B; font-size:0.68rem;">Items Today</div>
            <div style="font-weight:700; color:#0F172A;">${station.itemsToday}</div>
          </div>
          <div style="background:#F8FAFC; padding:6px 8px; border-radius:6px;">
            <div style="color:#64748B; font-size:0.68rem;">Recovery</div>
            <div style="font-weight:700; color:#059669;">${station.recoveryRate}%</div>
          </div>
          <div style="background:#F8FAFC; padding:6px 8px; border-radius:6px;">
            <div style="color:#64748B; font-size:0.68rem;">Contamination</div>
            <div style="font-weight:700; color:${station.contaminationRate > 10 ? '#DC2626' : '#D97706'};">${station.contaminationRate}%</div>
          </div>
          <div style="background:#F8FAFC; padding:6px 8px; border-radius:6px;">
            <div style="color:#64748B; font-size:0.68rem;">Special Items</div>
            <div style="font-weight:700; color:#B45309;">${station.specialHandlingCount}</div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button onclick="window.app.openSortingStationFor('${station.id}')" style="flex:1; background:#059669; color:#FFF; border:none; padding:7px 10px; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer;">
            Launch Station
          </button>
          <button onclick="document.getElementById('map-station-popover').style.display='none'" style="background:#F1F5F9; color:#475569; border:none; padding:7px 10px; border-radius:6px; font-size:0.78rem; font-weight:500; cursor:pointer;">
            Close
          </button>
        </div>
      </div>
    `;

    popover.style.left = '32%';
    popover.style.top = '22%';
    popover.style.display = 'block';
  }
}

window.ImpactMap = ImpactMap;

/**
 * EcoTrace Sorting Station Module
 * 
 * Implements:
 * 1. Controlled Virtual Sorting Tray (6 multi-object demo tray with SVG artwork & bounding boxes)
 * 2. Real-time 10-state session state machine
 * 3. Optical before/after physical verification comparison
 * 4. Special-handling (E-waste battery) protocol
 * 5. Contamination detection & local rules routing
 * 6. Low-confidence unknown review & manual override logging
 * 7. Live webcam feed mode support
 */

class SortingStation {
  constructor() {
    this.activeSession = null;
    this.currentMode = 'DEMO'; // DEMO, WEBCAM, UPLOAD
    this.selectedStationId = 'ST-01';
    this.simulateFailure = false;
    this.webcamStream = null;
    this.trayCustomImage = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.renderInitialTray();
  }

  bindEvents() {
    // Station Select Dropdown
    const stationSelect = document.getElementById('station-selector');
    if (stationSelect) {
      stationSelect.addEventListener('change', (e) => {
        this.selectedStationId = e.target.value;
        this.updateRulesetBadge();
        this.resetSession();
      });
    }

    // Mode Toggle (Demo vs Webcam vs Upload)
    const demoBtn = document.getElementById('mode-demo-btn');
    const webcamBtn = document.getElementById('mode-webcam-btn');
    const uploadBtn = document.getElementById('mode-upload-btn');
    const uploadInput = document.getElementById('tray-upload-input');
    const captureBtn = document.getElementById('btn-tray-capture-camera');

    if (demoBtn) demoBtn.addEventListener('click', () => this.switchMode('DEMO'));
    if (webcamBtn) webcamBtn.addEventListener('click', () => this.switchMode('WEBCAM'));
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.switchMode('UPLOAD');
        if (uploadInput) uploadInput.click();
      });
    }

    if (uploadInput) {
      uploadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleTrayFileUpload(e.target.files[0]);
        }
      });
    }

    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.captureTrayPhoto());
    }

    // Simulate Failure Toggle
    const failToggle = document.getElementById('toggle-simulate-failure');
    if (failToggle) {
      failToggle.addEventListener('change', (e) => {
        this.simulateFailure = e.target.checked;
      });
    }
  }

  updateRulesetBadge() {
    const badge = document.getElementById('station-ruleset-badge');
    if (!badge) return;
    const rulesetMap = {
      'ST-01': 'Ruleset: standard_urban',
      'ST-02': 'Ruleset: high_recovery',
      'ST-03': 'Ruleset: industrial',
      'ST-04': 'Ruleset: standard_urban',
      'ST-05': 'Ruleset: high_recovery',
      'ST-06': 'Ruleset: standard_urban'
    };
    badge.innerText = rulesetMap[this.selectedStationId] || 'Ruleset: standard_urban';
  }

  switchMode(mode) {
    this.currentMode = mode;
    const demoBtn = document.getElementById('mode-demo-btn');
    const webcamBtn = document.getElementById('mode-webcam-btn');
    const uploadBtn = document.getElementById('mode-upload-btn');
    const videoEl = document.getElementById('webcam-video');
    const captureBtn = document.getElementById('btn-tray-capture-camera');

    if (demoBtn) demoBtn.classList.toggle('active', mode === 'DEMO');
    if (webcamBtn) webcamBtn.classList.toggle('active', mode === 'WEBCAM');
    if (uploadBtn) uploadBtn.classList.toggle('active', mode === 'UPLOAD');

    if (mode === 'WEBCAM') {
      if (videoEl) videoEl.style.display = 'block';
      if (captureBtn) captureBtn.style.display = 'inline-flex';
      this.startWebcam();
    } else {
      if (videoEl) videoEl.style.display = 'none';
      if (captureBtn) captureBtn.style.display = 'none';
      this.stopWebcam();
    }
  }

  async startWebcam() {
    const videoEl = document.getElementById('webcam-video');
    if (!videoEl) return;
    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      videoEl.srcObject = this.webcamStream;
      videoEl.play();
      window.app.showToast('📹 Overhead webcam active. Place waste on tray & click "Capture Tray Photo".');
    } catch (err) {
      console.warn('Webcam access not granted or unavailable:', err);
      window.app.showToast('Camera access unavailable. You can upload any waste photo to tray!');
      this.switchMode('DEMO');
    }
  }

  stopWebcam() {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }
  }

  captureTrayPhoto() {
    const videoEl = document.getElementById('webcam-video');
    if (!videoEl) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    this.trayCustomImage = dataUrl;

    // Stop and hide webcam preview
    this.stopWebcam();
    videoEl.style.display = 'none';
    const captureBtn = document.getElementById('btn-tray-capture-camera');
    if (captureBtn) captureBtn.style.display = 'none';

    window.app.showToast('📸 Exact tray photo captured! Running computer vision scan...');
    this.scanTrayWithImage(dataUrl, 'webcam_tray_capture.jpg');
  }

  handleTrayFileUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      window.app.showToast('Please upload an image file (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.trayCustomImage = e.target.result;
      window.app.showToast(`📁 Uploaded ${file.name}. Scanning waste photo...`);
      this.scanTrayWithImage(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }

  async scanTrayWithImage(imageBase64, filename) {
    try {
      this.updateStateBadge('SCANNING', 'state-scanning');

      // 1. Ensure active session exists
      if (!this.activeSession) {
        const startRes = await fetch('/api/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stationId: this.selectedStationId, mode: 'PHOTO' })
        });
        const startData = await startRes.json();
        this.activeSession = startData.session;
      }

      // Laser sweep animation
      const scannerLine = document.getElementById('tray-scanner-line');
      if (scannerLine) scannerLine.classList.add('scanning');

      // 2. Scan exact image
      const res = await fetch('/api/session/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, filename })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (scannerLine) scannerLine.classList.remove('scanning');

      this.activeSession = data.session;
      this.updateStateBadge('1 ITEM DETECTED', 'state-active');

      // Draw exact captured image on tray with bounding box
      this.renderTrayObjects(this.activeSession.detectedItems);
      this.renderDirectiveItemsDetected();
      this.selectItem(0);

      window.app.showToast('✓ Optical detection complete. Target item queued for segregation.');
    } catch (err) {
      console.error('Scan error:', err);
      window.app.showToast(`Error scanning photo: ${err.message}`);
      this.updateStateBadge('ERROR', 'state-idle');
    }
  }

  renderScannedItemTray(item) {
    if (!item) return;
    this.trayCustomImage = item.imageUrl || null;
    this.updateStateBadge('1 ITEM READY TO SORT', 'state-active');
    this.renderTrayObjects([item]);
    this.renderDirectiveItemsDetected();
    this.selectItem(0);
  }

  renderInitialTray() {
    this.updateRulesetBadge();
    const stage = document.getElementById('tray-objects-layer');
    if (!stage) return;

    // Render idle tray with scan prompt
    stage.innerHTML = `
      <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#94A3B8; font-family:Inter,sans-serif;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.5">
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <div style="font-size:0.95rem; font-weight:600; color:#E2E8F0; margin-top:12px;">Optical Sorting Surface Ready</div>
        <div style="font-size:0.78rem; color:#64748B; margin-top:4px;">Place mixed waste tray under overhead camera and initiate scan</div>
      </div>
    `;

    this.renderDirectiveIdle();
  }

  renderDirectiveIdle() {
    const container = document.getElementById('directive-stage-container');
    if (!container) return;

    container.innerHTML = `
      <div style="padding:16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px;">
        <div style="font-size:0.8rem; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">
          Sorting Session Setup
        </div>
        <p style="font-size:0.84rem; color:#475569; line-height:1.45; margin-bottom:16px;">
          EcoTrace guides human operators to physically segregate mixed waste streams using computer vision verification.
        </p>
        <button id="btn-start-session" onclick="window.sortingStation.startSession()" class="btn-big-action btn-verify-removal" style="width:100%;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
          </svg>
          Start Sorting Session & Scan Tray
        </button>
      </div>
    `;

    this.updateStateBadge('IDLE', 'state-idle');
  }

  updateStateBadge(text, className) {
    const badge = document.getElementById('station-state-badge');
    if (badge) {
      badge.className = `state-badge ${className}`;
      badge.innerText = text;
    }
  }

  // Step 1: Start Session & Trigger Scanning
  async startSession() {
    try {
      this.updateStateBadge('SCANNING', 'state-scanning');

      // 1. API Call: Start session
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: this.selectedStationId,
          mode: this.currentMode
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.activeSession = data.session;

      // Animate optical laser sweep
      const scannerLine = document.getElementById('tray-scanner-line');
      if (scannerLine) scannerLine.classList.add('scanning');

      window.app.showToast(`Session ${this.activeSession.id} started. Optical sensors scanning tray...`);

      // 2. Simulate optical camera sweep duration (1.2s)
      setTimeout(async () => {
        if (scannerLine) scannerLine.classList.remove('scanning');
        await this.scanTrayObjects();
      }, 1200);

    } catch (err) {
      console.error(err);
      window.app.showToast(`Error starting session: ${err.message}`);
      this.updateStateBadge('ERROR', 'state-idle');
    }
  }

  // Step 2: Scan Tray & Receive Detected Objects
  async scanTrayObjects() {
    try {
      const res = await fetch('/api/session/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.activeSession = data.session;
      this.updateStateBadge('6 ITEMS DETECTED', 'state-active');

      // Draw objects with bounding boxes on the virtual tray
      this.renderTrayObjects(this.activeSession.detectedItems);

      // Render Detected Stage
      this.renderDirectiveItemsDetected();
      window.app.showToast('✓ 6 distinct objects detected & classified by rules engine.');

    } catch (err) {
      console.error(err);
      window.app.showToast(`Scan error: ${err.message}`);
    }
  }

  // Render SVG Artwork & Bounding Boxes on Controlled Tray
  renderTrayObjects(items) {
    const layer = document.getElementById('tray-objects-layer');
    if (!layer) return;

    if (!items || items.length === 0) {
      layer.innerHTML = `
        <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#10B981; font-family:Inter,sans-serif;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div style="font-size:1.1rem; font-weight:700; margin-top:12px;">Sorting Tray Clean & Empty</div>
          <div style="font-size:0.8rem; opacity:0.8; margin-top:4px;">All items physically verified and sorted</div>
        </div>
      `;
      return;
    }

    let html = '';

    // If custom tray photo (webcam capture, photo upload, or scanner transfer) exists:
    if (this.trayCustomImage) {
      html += `
        <div style="position:absolute; inset:8px; display:flex; align-items:center; justify-content:center; z-index:1; pointer-events:none;">
          <img src="${this.trayCustomImage}" style="max-width:92%; max-height:92%; object-fit:contain; border-radius:8px; opacity:0.95; filter:drop-shadow(0 6px 16px rgba(0,0,0,0.5));">
        </div>
      `;
    }

    items.forEach((item, idx) => {
      const bbox = item.bbox || { x: 15, y: 15, width: 70, height: 70 };
      const isSelected = this.activeSession && this.activeSession.currentItem && this.activeSession.currentItem.id === item.id;
      const isSpecial = item.specialHandling === 1;
      const isContaminated = item.contamination && item.contamination !== 'None';

      let artContent = '';
      if (!this.trayCustomImage) {
        if (item.imageUrl && item.imageUrl.startsWith('data:image')) {
          artContent = `<img src="${item.imageUrl}" style="max-width:85%; max-height:85%; object-fit:contain; border-radius:6px;">`;
        } else {
          artContent = this.getObjectSvgArt(item.category, item.label, isContaminated);
        }
      }

      html += `
        <div class="tray-object-wrapper ${isSelected ? 'selected' : ''} ${isSpecial ? 'special-handling-box' : ''}" 
             data-id="${item.id}"
             data-index="${idx}"
             onclick="window.sortingStation.selectItem(${idx})"
             style="left:${bbox.x}%; top:${bbox.y}%; width:${bbox.width}%; height:${bbox.height}%; z-index:5;">
          
          <div class="bbox-label-tag ${isSelected ? 'active' : ''} ${isSpecial ? 'special' : ''}">
            ${isSpecial ? '⚡ ' : ''}${isContaminated ? '⚠ ' : ''}${item.label} · ${(item.confidence * 100).toFixed(1)}%
          </div>

          <div class="tray-object-art" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
            ${artContent}
          </div>
        </div>
      `;
    });

    layer.innerHTML = html;
  }

  getObjectSvgArt(category, label, isContaminated) {
    if (label.includes('PET Bottle')) {
      return `
        <svg viewBox="0 0 60 100" style="width:70%; height:70%; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
          <!-- Bottle cap -->
          <rect x="25" y="5" width="10" height="7" rx="1.5" fill="#3B82F6"/>
          <!-- Bottle neck -->
          <path d="M26 12 L26 22 L18 32 L18 88 Q18 95 30 95 Q42 95 42 88 L42 32 L34 22 L34 12 Z" fill="#60A5FA" opacity="0.82" stroke="#93C5FD" stroke-width="1.5"/>
          <!-- Liquid & Reflection -->
          <path d="M22 45 L38 45 L38 86 Q30 90 22 86 Z" fill="#93C5FD" opacity="0.35"/>
          <line x1="22" y1="36" x2="22" y2="82" stroke="#FFFFFF" stroke-width="1.2" opacity="0.6"/>
        </svg>
      `;
    } else if (label.includes('Aluminium Can')) {
      return `
        <svg viewBox="0 0 60 90" style="width:70%; height:70%; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
          <!-- Can body -->
          <rect x="15" y="10" width="30" height="70" rx="6" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
          <ellipse cx="30" cy="12" rx="15" ry="4" fill="#94A3B8"/>
          <!-- Tab -->
          <ellipse cx="30" cy="12" rx="5" ry="2" fill="#475569"/>
          <!-- Soda brand stripe -->
          <rect x="15" y="32" width="30" height="26" fill="#EF4444" opacity="0.9"/>
          <text x="30" y="48" font-size="8" font-weight="900" fill="#FFF" text-anchor="middle" font-family="sans-serif">CAN</text>
        </svg>
      `;
    } else if (label.includes('Banana Peel')) {
      return `
        <svg viewBox="0 0 80 80" style="width:75%; height:75%; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
          <!-- Banana curved peel -->
          <path d="M15 65 Q 40 10 70 25 Q 50 45 65 65 Q 45 50 15 65 Z" fill="#FACC15" stroke="#CA8A04" stroke-width="1.5"/>
          <!-- Brown tips -->
          <circle cx="15" cy="65" r="3.5" fill="#78350F"/>
          <circle cx="70" cy="25" r="3" fill="#78350F"/>
          <path d="M35 38 Q 45 42 50 55" stroke="#A16207" stroke-width="1.5" fill="none"/>
        </svg>
      `;
    } else if (label.includes('Paper Cup')) {
      return `
        <svg viewBox="0 0 70 80" style="width:70%; height:70%; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
          <!-- Cup lid -->
          <rect x="18" y="10" width="34" height="6" rx="2" fill="#1E293B"/>
          <!-- Cup body -->
          <polygon points="20,16 50,16 44,72 26,72" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
          <!-- Kraft sleeve -->
          <polygon points="21,30 49,30 46,54 24,54" fill="#D97706" opacity="0.75"/>
        </svg>
      `;
    } else if (label.includes('Household Battery')) {
      return `
        <svg viewBox="0 0 60 80" style="width:65%; height:65%; filter:drop-shadow(0 4px 8px rgba(245,158,11,0.5));">
          <!-- Positive terminal nub -->
          <rect x="26" y="6" width="8" height="5" rx="1.5" fill="#D97706"/>
          <!-- Cylindrical Battery Body -->
          <rect x="18" y="11" width="24" height="60" rx="3" fill="#1E293B" stroke="#F59E0B" stroke-width="2"/>
          <rect x="18" y="11" width="24" height="20" fill="#F59E0B"/>
          <text x="30" y="24" font-size="8" font-weight="900" fill="#000" text-anchor="middle" font-family="sans-serif">AA</text>
          <!-- Warning symbol -->
          <polygon points="30,42 24,54 36,54" fill="#EF4444"/>
          <circle cx="30" cy="50" r="1" fill="#FFF"/>
        </svg>
      `;
    } else {
      // Food Container
      return `
        <svg viewBox="0 0 90 70" style="width:80%; height:80%; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
          <!-- Plastic box container -->
          <rect x="12" y="15" width="66" height="42" rx="6" fill="#F8FAFC" opacity="0.8" stroke="#94A3B8" stroke-width="1.5"/>
          <rect x="16" y="18" width="58" height="36" rx="4" fill="#E2E8F0" opacity="0.5"/>
          <!-- Food residue grease stains (contamination) -->
          ${isContaminated ? `
            <circle cx="32" cy="35" r="7" fill="#EA580C" opacity="0.6"/>
            <ellipse cx="50" cy="40" rx="9" ry="5" fill="#D97706" opacity="0.65"/>
            <circle cx="62" cy="28" r="4" fill="#B45309" opacity="0.7"/>
          ` : ''}
        </svg>
      `;
    }
  }

  renderDirectiveItemsDetected() {
    const container = document.getElementById('directive-stage-container');
    if (!container) return;

    container.innerHTML = `
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:1.05rem; font-weight:700; color:#0F172A; margin:0;">
            Optical Tray Scan Complete
          </h4>
          <span class="state-badge state-active">6 Items Found</span>
        </div>
        
        <p style="font-size:0.82rem; color:#475569; margin-bottom:14px;">
          The multi-object detector identified 6 targets on the tray. Location-aware rules assigned optimal sorting streams based on <strong>${this.activeSession.ruleset}</strong>.
        </p>

        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:18px;">
          ${this.activeSession.detectedItems.map((item, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; background:#F8FAFC; border-radius:6px; font-size:0.78rem;">
              <span style="font-weight:600; color:#1E293B;">${i + 1}. ${item.label}</span>
              <span style="color:#059669; font-weight:500;">${item.route}</span>
            </div>
          `).join('')}
        </div>

        <button onclick="window.sortingStation.beginSortingQueue()" class="btn-big-action btn-verify-removal" style="width:100%;">
          Begin Step-by-Step Sorting Queue →
        </button>
      </div>
    `;
  }

  // Step 3: Begin Active Sorting Queue
  async beginSortingQueue() {
    try {
      const res = await fetch('/api/session/start-queue', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.activeSession = data.session;
      this.updateActiveItemView();
    } catch (err) {
      console.error(err);
      window.app.showToast(`Error: ${err.message}`);
    }
  }

  // Select Item by index
  async selectItem(index) {
    if (!this.activeSession || !this.activeSession.detectedItems) return;
    try {
      const res = await fetch('/api/session/select-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.activeSession = data.session;
      this.updateActiveItemView();
    } catch (err) {
      console.error(err);
    }
  }

  // Step 4: Active Sorting Directive UI (Matches Section 8, 10, 11 of prompt)
  updateActiveItemView() {
    const item = this.activeSession.currentItem;
    if (!item) return;

    this.updateStateBadge(`SORTING: ITEM ${this.activeSession.currentIndex + 1} OF ${this.activeSession.itemCount}`, 'state-active');

    // Update tray visual highlight
    this.renderTrayObjects(this.activeSession.remainingTrayItems);

    const container = document.getElementById('directive-stage-container');
    if (!container) return;

    const isBattery = item.specialHandling === 1 || item.material === 'Household Battery';
    const isContaminated = item.contamination && item.contamination !== 'None';

    container.innerHTML = `
      <div class="item-spotlight-box">
        <div class="spotlight-sequence">ITEM ${this.activeSession.currentIndex + 1} OF ${this.activeSession.itemCount}</div>
        <div class="spotlight-title">${item.label}</div>

        <div class="spotlight-specs-grid">
          <div class="spec-cell">
            <div class="spec-label">Material</div>
            <div class="spec-value">${item.material}</div>
          </div>
          <div class="spec-cell">
            <div class="spec-label">Condition</div>
            <div class="spec-value" style="color:${isContaminated ? '#DC2626' : (isBattery ? '#D97706' : '#059669')};">
              ${item.condition}
            </div>
          </div>
          <div class="spec-cell">
            <div class="spec-label">Optical Confidence</div>
            <div class="spec-value">${(item.confidence * 100).toFixed(1)}%</div>
          </div>
          <div class="spec-cell">
            <div class="spec-label">Contamination</div>
            <div class="spec-value" style="color:${isContaminated ? '#DC2626' : '#475569'};">
              ${item.contamination} ${item.contaminationIssue ? `(${item.contaminationIssue})` : ''}
            </div>
          </div>
        </div>

        ${isBattery ? `
          <div class="special-handling-callout">
            <div class="special-handling-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              HOUSEHOLD BATTERY — E-WASTE / SPECIAL HANDLING
            </div>
            <div><strong>DO NOT PLACE IN GENERAL WASTE OR RECYCLING STREAM</strong></div>
            <div style="font-size:0.76rem; margin-top:4px;">Hazardous electrochemical cells present ignition risk. Place in certified terminal collection bin.</div>
          </div>
        ` : ''}

        ${isContaminated ? `
          <div style="background:#FFFBEB; border:1px solid #FCD34D; border-radius:8px; padding:12px; font-size:0.8rem; color:#92400E; margin-bottom:14px;">
            <div style="font-weight:700; margin-bottom:2px;">⚠ CONTAMINATION DETECTED</div>
            <div>${item.contaminationIssue || 'Food residue present'}. Local ruleset: <em>${this.activeSession.ruleset}</em> routing applied.</div>
          </div>
        ` : ''}

        <div class="route-callout-box">
          <div class="route-callout-label">Recommended Route</div>
          <div class="route-callout-dest">${item.route}</div>
          <div class="route-callout-instruction">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 16 16 12 12 8"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            ${item.instruction || 'REMOVE THIS ITEM FROM THE SORTING TRAY'}
          </div>
        </div>

        <div class="operator-actions-group">
          <button onclick="window.sortingStation.confirmItemRemoval()" class="btn-big-action btn-verify-removal">
            ${isBattery ? '⚡ MARK AS SEPARATED' : '✓ ITEM REMOVED (VERIFY)'}
          </button>

          <div class="sub-actions-row">
            <button onclick="window.sortingStation.flagCurrentItem()" class="btn-secondary-action">
              ⚠ FLAG ITEM
            </button>
            <button onclick="window.sortingStation.openManualOverrideModal()" class="btn-secondary-action">
              ✏ MANUAL OVERRIDE
            </button>
          </div>
        </div>
      </div>

      <!-- Sorting Queue Drawer -->
      <div class="queue-panel">
        <div class="queue-title">Sorting Queue (${this.activeSession.verifiedCount}/${this.activeSession.itemCount} Verified)</div>
        <div class="queue-list">
          ${this.activeSession.detectedItems.map((qItem, qIdx) => {
            const isCurrent = qIdx === this.activeSession.currentIndex;
            const isDone = qItem.status === 'VERIFIED';
            const isOverridden = qItem.status === 'MANUAL_OVERRIDE';
            return `
              <div class="queue-item ${isCurrent ? 'current' : ''} ${isDone ? 'verified' : ''}" onclick="window.sortingStation.selectItem(${qIdx})">
                <div class="queue-item-info">
                  <span style="font-weight:600; color:#475569;">${qIdx + 1}.</span>
                  <span style="font-weight:${isCurrent ? '700' : '500'}; color:#1E293B;">${qItem.label}</span>
                </div>
                <div>
                  ${isCurrent ? '<span class="queue-status-tag tag-current">Current Target</span>' : ''}
                  ${isDone ? '<span class="queue-status-tag tag-verified">Verified ✓</span>' : ''}
                  ${isOverridden ? '<span class="queue-status-tag tag-special">Override ✏</span>' : ''}
                  ${!isCurrent && !isDone && !isOverridden ? '<span class="queue-status-tag tag-pending">Pending</span>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Step 5: Physical Sorting Verification (Section 9 of Prompt)
  async confirmItemRemoval() {
    try {
      this.updateStateBadge('VERIFYING REMOVAL...', 'state-verifying');

      const container = document.getElementById('directive-stage-container');
      if (container) {
        container.innerHTML = `
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:28px; text-align:center;">
            <div class="live-indicator" style="margin:0 auto 12px; width:12px; height:12px;"></div>
            <h4 style="font-size:1.1rem; font-weight:700; color:#0F172A; margin-bottom:6px;">
              Physical Removal Verification
            </h4>
            <p style="font-size:0.82rem; color:#64748B; margin-bottom:18px;">
              Overhead optical sensor rescanning sorting tray surface... Comparing BEFORE vs AFTER...
            </p>
            <div style="font-size:0.75rem; color:#94A3B8; font-family:monospace;">
              Delta algorithm: object count & target disappearance check
            </div>
          </div>
        `;
      }

      // Simulate optical verification scan delay (800ms)
      setTimeout(async () => {
        const res = await fetch('/api/session/verify-removal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulateFailure: this.simulateFailure })
        });
        const result = await res.json();

        this.renderVerificationResult(result);
      }, 800);

    } catch (err) {
      console.error(err);
      window.app.showToast(`Verification error: ${err.message}`);
    }
  }

  // Display Verification Result (Pass vs Fail)
  renderVerificationResult(result) {
    const container = document.getElementById('directive-stage-container');
    if (!container) return;

    if (result.success) {
      // VERIFIED! Target item disappeared
      this.activeSession = result.session;
      this.updateStateBadge('✓ ITEM REMOVED', 'state-active');

      // Update virtual tray: target item is now absent!
      this.renderTrayObjects(this.activeSession.remainingTrayItems);

      const v = result.verification;

      container.innerHTML = `
        <div class="verification-banner-box verified">
          <div class="verification-status-header">
            <div class="verification-badge-label">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              ${v.title}
            </div>
            <span class="status-pill online">VERIFIED</span>
          </div>

          <div style="font-size:1.25rem; font-weight:800; color:#065F46;">${v.label}</div>

          <div class="verification-details-table">
            <div><strong>Source:</strong> ${v.source}</div>
            <div><strong>Destination:</strong> ${v.destination}</div>
            <div><strong>Optical Delta:</strong> Item removed from tray. Count decreased to ${this.activeSession.remainingTrayItems.length}.</div>
            <div style="font-size:0.74rem; color:#059669; margin-top:4px;">Record created in city traceability log.</div>
          </div>

          <button onclick="window.sortingStation.proceedToNextItem()" class="btn-big-action btn-verify-removal" style="margin-top:8px;">
            Proceed to Next Item →
          </button>
        </div>
      `;

      window.app.showToast(`✓ Removal verified: ${v.label} routed to ${v.destination}`);

    } else {
      // FAILED / MISMATCH! Target item still detected on tray
      this.updateStateBadge('SORT NOT VERIFIED', 'state-idle');
      const v = result.verification;

      container.innerHTML = `
        <div class="verification-banner-box failed">
          <div class="verification-status-header">
            <div class="verification-badge-label">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              ${v.title}
            </div>
            <span class="status-pill attention">MISMATCH</span>
          </div>

          <p style="font-size:0.86rem; color:#991B1B; font-weight:600; margin:0;">
            ${v.message}
          </p>

          <p style="font-size:0.78rem; color:#7F1D1D; margin:0;">
            Optical comparison indicates target item <strong>${v.label}</strong> is still detected on tray. Please remove item physically, or override if camera was obstructed.
          </p>

          <div class="sub-actions-row" style="margin-top:8px;">
            <button onclick="window.sortingStation.confirmItemRemoval()" class="btn-big-action btn-verify-removal">
              Rescan Tray
            </button>
            <button onclick="window.sortingStation.openManualOverrideModal()" class="btn-secondary-action">
              Mark Manually (Override)
            </button>
          </div>
        </div>
      `;

      window.app.showToast('⚠ Verification mismatch: item still detected on tray surface.');
    }
  }

  // Step 6: Advance to Next Item or Complete
  async proceedToNextItem() {
    try {
      const res = await fetch('/api/session/next-item', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.activeSession = data.session;

      if (this.activeSession.state === 'COMPLETED') {
        this.renderSessionCompleted();
      } else {
        this.updateActiveItemView();
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Step 7: Session Completed (Updates City Stats)
  renderSessionCompleted() {
    this.updateStateBadge('SESSION COMPLETED', 'state-completed');

    const container = document.getElementById('directive-stage-container');
    if (!container) return;

    container.innerHTML = `
      <div style="background:#FFFFFF; border:1.5px solid #10B981; border-radius:12px; padding:24px; text-align:center;">
        <div style="width:52px; height:52px; background:#ECFDF5; border-radius:9999px; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:#059669;">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <h3 style="font-size:1.3rem; font-weight:800; color:#065F46; margin-bottom:4px;">
          Sorting Session Complete!
        </h3>
        <p style="font-size:0.84rem; color:#475569; margin-bottom:18px;">
          All 6 waste items successfully verified, sorted, and indexed into the city traceability registry.
        </p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; font-size:0.8rem;">
          <div style="background:#F8FAFC; padding:10px; border-radius:8px;">
            <div style="color:#64748B;">Items Verified</div>
            <div style="font-size:1.15rem; font-weight:800; color:#0F172A;">${this.activeSession.verifiedCount} / ${this.activeSession.itemCount}</div>
          </div>
          <div style="background:#F8FAFC; padding:10px; border-radius:8px;">
            <div style="color:#64748B;">Station Metric Delta</div>
            <div style="font-size:1.15rem; font-weight:800; color:#059669;">+6 Items Today</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <button onclick="window.app.switchTab('reports')" class="btn-big-action btn-verify-removal">
            View Traceability Records in Reports →
          </button>
          <button onclick="window.sortingStation.resetSession()" class="btn-secondary-action" style="height:42px;">
            Start New Session
          </button>
        </div>
      </div>
    `;

    // Trigger global refresh to update Overview KPI cards and Alerts
    window.app.refreshAll();
    window.app.showToast('🎉 Session completed! City KPIs updated immediately.');
  }

  // Manual Override Modal Handling
  openManualOverrideModal() {
    const modal = document.getElementById('modal-manual-override');
    if (!modal) return;
    modal.classList.add('open');
  }

  async submitManualOverride() {
    const routeSelect = document.getElementById('override-route-select');
    const reasonInput = document.getElementById('override-reason-input');
    const modal = document.getElementById('modal-manual-override');

    const correctedRoute = routeSelect ? routeSelect.value : 'Residual Waste';
    const reason = reasonInput ? reasonInput.value : 'Operator manual confirmation';

    try {
      const res = await fetch('/api/session/manual-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctedRoute, reason })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (modal) modal.classList.remove('open');
      this.activeSession = data.session;

      window.app.showToast(`Manual override recorded: ${correctedRoute}`);
      this.proceedToNextItem();
    } catch (err) {
      console.error(err);
      window.app.showToast(`Override error: ${err.message}`);
    }
  }

  async flagCurrentItem() {
    try {
      const res = await fetch('/api/session/flag-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Operator flagged item for supervisor inspection' })
      });
      const data = await res.json();
      if (data.success) {
        window.app.showToast('Item flagged for inspection. Routing to Quarantine Bay.');
        this.proceedToNextItem();
      }
    } catch (err) {
      console.error(err);
    }
  }

  resetSession() {
    this.activeSession = null;
    this.renderInitialTray();
  }
}

window.SortingStation = SortingStation;

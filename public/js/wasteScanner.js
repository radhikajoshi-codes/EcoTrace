/**
 * EcoTrace AI Waste Scanner Module
 * 
 * Hackathon Requirements:
 * - 📷 Camera Scan (live webcam preview, frame capture, permission handling)
 * - 🖼️ Image Upload (drag-and-drop, preview, real base64 image pipeline)
 * - ⚡ Preset Gallery (1-click demo items including Textile)
 * - 🧠 Neural analysis pipeline with 10 categories & realistic confidence (never 100%)
 * - 📋 Verification Result Card (Status, Category, Confidence, Recyclability, Disposal, Explanation, Location)
 * - ⚙️ Direct Integration: "Send to Sorting Station" loads item into live sorting tray
 * - 🗺️ Direct Integration: "Find Nearest Disposal Point →" highlights nearest Indian facility on Leaflet Map
 * - 🕒 Recent Scans history with real thumbnails, location, and verification status
 */

class WasteScanner {
  constructor() {
    this.currentMode = 'upload'; // 'upload', 'camera', 'presets'
    this.stream = null;
    this.selectedImageData = null;
    this.selectedFilename = null;
    this.selectedPreset = null;
    this.currentResult = null;
    this.recentScans = [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.fetchRecentScans();
  }

  bindEvents() {
    // Mode Switcher Buttons
    const btnUpload = document.getElementById('scanner-mode-upload');
    const btnCamera = document.getElementById('scanner-mode-camera');
    const btnPresets = document.getElementById('scanner-mode-presets');

    if (btnUpload) btnUpload.addEventListener('click', () => this.switchMode('upload'));
    if (btnCamera) btnCamera.addEventListener('click', () => this.switchMode('camera'));
    if (btnPresets) btnPresets.addEventListener('click', () => this.switchMode('presets'));

    // Camera Controls
    const btnStartCamera = document.getElementById('btn-start-camera');
    const btnCapture = document.getElementById('btn-capture-camera');
    const btnScanCaptured = document.getElementById('btn-scan-captured');
    const btnStopCamera = document.getElementById('btn-stop-camera');
    const btnRetake = document.getElementById('btn-retake-camera');

    if (btnStartCamera) btnStartCamera.addEventListener('click', () => this.startCamera());
    if (btnCapture) btnCapture.addEventListener('click', () => this.captureCameraFrame());
    if (btnScanCaptured) btnScanCaptured.addEventListener('click', () => this.analyzeCurrent());
    if (btnStopCamera) btnStopCamera.addEventListener('click', () => this.stopCamera());
    if (btnRetake) btnRetake.addEventListener('click', () => this.retakeCamera());

    // File Upload Controls
    const fileInput = document.getElementById('waste-file-input');
    const dropzone = document.getElementById('waste-dropzone');
    const btnAnalyzeUpload = document.getElementById('btn-analyze-upload');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          this.handleFileSelect(e.dataTransfer.files[0]);
        }
      });
      dropzone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    if (btnAnalyzeUpload) {
      btnAnalyzeUpload.addEventListener('click', () => this.analyzeCurrent());
    }

    // Preset Sample Cards
    document.querySelectorAll('.preset-sample-card').forEach(card => {
      card.addEventListener('click', () => {
        const presetKey = card.getAttribute('data-preset');
        this.selectPreset(presetKey, card);
      });
    });
  }

  switchMode(mode) {
    this.currentMode = mode;

    document.querySelectorAll('.scanner-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    const panelCamera = document.getElementById('scanner-panel-camera');
    const panelUpload = document.getElementById('scanner-panel-upload');
    const panelPresets = document.getElementById('scanner-panel-presets');

    if (panelCamera) panelCamera.style.display = mode === 'camera' ? 'block' : 'none';
    if (panelUpload) panelUpload.style.display = mode === 'upload' ? 'block' : 'none';
    if (panelPresets) panelPresets.style.display = mode === 'presets' ? 'block' : 'none';

    if (mode === 'camera') {
      this.startCamera();
    } else {
      this.stopCamera();
    }
  }

  // Camera Management
  async startCamera() {
    const video = document.getElementById('scanner-video');
    const placeholder = document.getElementById('camera-placeholder');
    const liveControls = document.getElementById('camera-live-controls');
    const freezeControls = document.getElementById('camera-freeze-controls');
    const errorBox = document.getElementById('camera-error-msg');

    if (!video) return;

    try {
      if (errorBox) errorBox.style.display = 'none';
      if (freezeControls) freezeControls.style.display = 'none';

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      });

      video.srcObject = this.stream;
      await video.play();

      if (placeholder) placeholder.style.display = 'none';
      video.style.display = 'block';
      if (liveControls) liveControls.style.display = 'flex';

      window.app.showToast('📷 Camera connected. Align waste item in optical frame.');
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      if (placeholder) placeholder.style.display = 'flex';
      video.style.display = 'none';
      if (liveControls) liveControls.style.display = 'none';
      if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.innerHTML = `
          <strong>Camera Unavailable:</strong> ${err.message || 'Permission denied or no webcam detected'}.<br>
          <em>You can upload an image file or test 1-click preset samples!</em>
        `;
      }
      window.app.showToast('Camera access unavailable. Use Upload or Demo Presets.');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    const video = document.getElementById('scanner-video');
    if (video) video.style.display = 'none';
    const liveControls = document.getElementById('camera-live-controls');
    if (liveControls) liveControls.style.display = 'none';
    const freezeControls = document.getElementById('camera-freeze-controls');
    if (freezeControls) freezeControls.style.display = 'none';
    const placeholder = document.getElementById('camera-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
  }

  captureCameraFrame() {
    const video = document.getElementById('scanner-video');
    const canvas = document.getElementById('scanner-capture-canvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    this.selectedImageData = dataUrl;
    this.selectedFilename = 'camera_capture.jpg';
    this.selectedPreset = null;

    // Freeze video display
    video.pause();

    const liveControls = document.getElementById('camera-live-controls');
    const freezeControls = document.getElementById('camera-freeze-controls');
    if (liveControls) liveControls.style.display = 'none';
    if (freezeControls) freezeControls.style.display = 'flex';

    window.app.showToast('📸 Waste frame captured! Click "Scan Captured Waste" to analyze.');
  }

  retakeCamera() {
    const video = document.getElementById('scanner-video');
    if (video) video.play();

    const liveControls = document.getElementById('camera-live-controls');
    const freezeControls = document.getElementById('camera-freeze-controls');
    if (liveControls) liveControls.style.display = 'flex';
    if (freezeControls) freezeControls.style.display = 'none';

    this.selectedImageData = null;
  }

  // File Upload Handling
  handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
      window.app.showToast('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    this.selectedFilename = file.name;
    this.selectedPreset = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.selectedImageData = e.target.result;
      this.showUploadPreview(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }

  showUploadPreview(dataUrl, name) {
    const dropzoneContent = document.getElementById('dropzone-prompt');
    const previewContainer = document.getElementById('upload-preview-container');
    const previewImg = document.getElementById('upload-preview-img');
    const previewName = document.getElementById('upload-preview-name');
    const btnAnalyze = document.getElementById('btn-analyze-upload');

    if (dropzoneContent) dropzoneContent.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'block';
    if (previewImg) previewImg.src = dataUrl;
    if (previewName) previewName.innerText = name;
    if (btnAnalyze) btnAnalyze.disabled = false;
  }

  // Preset Selection
  selectPreset(presetKey, cardEl) {
    document.querySelectorAll('.preset-sample-card').forEach(c => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');

    this.selectedPreset = presetKey;
    this.selectedFilename = `${presetKey.replace('preset:', '')}.jpg`;
    this.selectedImageData = null;

    window.app.showToast(`Selected demo sample: ${presetKey.replace('preset:', '').toUpperCase()}`);
    this.analyzeCurrent();
  }

  // Run AI Analysis
  async analyzeCurrent() {
    if (!this.selectedImageData && !this.selectedPreset && !this.selectedFilename) {
      window.app.showToast('Please upload an image, capture from camera, or pick a sample preset.');
      return;
    }

    const locSelect = document.getElementById('scanner-location-select');
    const location = locSelect ? locSelect.value : 'AITR, Indore';

    this.setScanningState(true);

    try {
      const payload = {
        imageBase64: this.selectedImageData || '',
        filename: this.selectedFilename || '',
        preset: this.selectedPreset || '',
        location
      };

      const res = await fetch('/api/scanner/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.currentResult = data.result;

      // Realistic inference display delay (800ms)
      setTimeout(() => {
        this.setScanningState(false);
        this.renderResultCard(this.currentResult);
        this.fetchRecentScans();
        window.app.refreshAll();
        window.app.showToast(`✓ Identified: ${this.currentResult.wasteType} (${this.currentResult.confidencePercent})`);
      }, 800);

    } catch (err) {
      console.error('Scan error:', err);
      this.setScanningState(false);
      window.app.showToast(`Analysis failed: ${err.message}`);
    }
  }

  setScanningState(isScanning) {
    const loadingOverlay = document.getElementById('scanner-loading-overlay');
    const resultCard = document.getElementById('scanner-result-card');
    const scanStages = document.getElementById('scanner-stages-text');

    if (loadingOverlay) {
      loadingOverlay.style.display = isScanning ? 'flex' : 'none';
    }

    if (isScanning) {
      if (resultCard) resultCard.style.display = 'none';

      const messages = [
        'Extracting visual contours & edge signatures...',
        'Matching municipal polymer & material neural models...',
        'Evaluating surface contamination & moisture...',
        'Synthesizing optimal disposal & recovery routing...'
      ];
      let idx = 0;
      if (scanStages) scanStages.innerText = messages[0];
      this.stageTimer = setInterval(() => {
        idx = (idx + 1) % messages.length;
        if (scanStages) scanStages.innerText = messages[idx];
      }, 250);
    } else {
      if (this.stageTimer) clearInterval(this.stageTimer);
    }
  }

  // Render Full Result Card
  renderResultCard(res) {
    const card = document.getElementById('scanner-result-card');
    const emptyState = document.getElementById('scanner-empty-state');
    if (!card) return;
    if (emptyState) emptyState.style.display = 'none';

    const isRecyclable = res.recyclable;
    const isSpecialHandling = res.category === 'E-Waste' || res.category === 'Hazardous Waste';
    const isHighConfidence = res.confidence >= 0.75;

    const riskColorMap = {
      Low: '#059669',
      Medium: '#D97706',
      High: '#EA580C',
      Critical: '#DC2626'
    };
    const riskColor = riskColorMap[res.riskLevel] || '#4B5563';

    card.innerHTML = `
      <div class="result-header-row">
        <div>
          <span class="category-badge ${res.badgeClass || ''}">${res.category}</span>
          <h2 class="result-waste-title">${res.wasteType}</h2>
        </div>
        <div class="confidence-ring-box">
          <div class="confidence-ring-val">${res.confidencePercent}</div>
          <div class="confidence-ring-label">AI CONFIDENCE</div>
        </div>
      </div>

      <!-- Verification Assessment Banner (Requirement 6) -->
      <div style="margin:12px 0; padding:10px 14px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; background:${isHighConfidence ? '#ECFDF5' : '#FFFBEB'}; border:1px solid ${isHighConfidence ? '#A7F3D0' : '#FDE68A'};">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.15rem;">${isHighConfidence ? '✓' : '⚠️'}</span>
          <div>
            <div style="font-size:0.84rem; font-weight:700; color:${isHighConfidence ? '#065F46' : '#92400E'};">
              Verification: ${res.verificationStatus || (isHighConfidence ? '✓ Waste identified successfully' : '⚠ Low confidence — manual verification required')}
            </div>
            <div style="font-size:0.72rem; color:${isHighConfidence ? '#047857' : '#B45309'};">
              ${isHighConfidence ? 'Algorithmic profile match confirmed.' : 'Material stamp manual inspection advised.'}
            </div>
          </div>
        </div>
        <span style="font-size:0.75rem; font-weight:600; color:#475569; background:#FFF; padding:4px 8px; border-radius:6px; border:1px solid #CBD5E1;">
          📍 ${res.location || 'India'}
        </span>
      </div>

      <!-- Recyclability & Risk Banner -->
      <div class="result-status-banner ${isRecyclable ? 'status-recyclable' : 'status-non-recyclable'}">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            ${isRecyclable ? 
              '<polyline points="20 6 9 17 4 12"/>' : 
              '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
          </svg>
          <strong>${isRecyclable ? 'RECYCLABLE WASTE' : (isSpecialHandling ? 'CRITICAL SPECIAL HANDLING' : 'NON-RECYCLABLE RESIDUAL')}</strong>
        </div>
        <div class="risk-badge" style="background:${riskColor}15; color:${riskColor}; border:1px solid ${riskColor}40;">
          Risk: ${res.riskLevel}
        </div>
      </div>

      ${res.alertWarning ? `
        <div class="alert-warning-callout">
          ${res.alertWarning}
        </div>
      ` : ''}

      <!-- Specs Grid -->
      <div class="result-specs-grid">
        <div class="result-spec-item">
          <div class="result-spec-label">Recommended Disposal Method</div>
          <div class="result-spec-value">${res.disposalMethod}</div>
        </div>
        <div class="result-spec-item">
          <div class="result-spec-label">Material Category</div>
          <div class="result-spec-value">${res.category}</div>
        </div>
      </div>

      <!-- Recommendation Box -->
      <div class="recommendation-callout">
        <div class="recommendation-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 16 16 12 12 8"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Recommended Action
        </div>
        <p class="recommendation-text">${res.recommendation}</p>
      </div>

      <!-- Explanation Box -->
      <div class="explanation-box">
        <strong>Why this category:</strong> ${res.explanation}
      </div>

      <!-- ACTION BUTTONS: Send to Sorting Station + Map Routing + Scan Again -->
      <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          
          <!-- KEY REQUIREMENT 7: SEND TO SORTING STATION -->
          <button id="btn-send-to-sorting" onclick="window.wasteScanner.sendToSortingStation()" class="btn-primary" style="flex:1; min-width:200px; height:44px; background:#2563EB; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 12px rgba(37,99,235,0.25);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Send to Sorting Station ⚙️
          </button>

          <!-- ROUTE TO NEAREST FACILITY -->
          <button onclick="window.wasteScanner.routeToNearestFacility('${res.suitableFacilityType}', '${res.wasteType}')" class="btn-primary btn-accent" style="flex:1; min-width:200px; height:44px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
            ${res.mapActionLabel || 'Find Nearest Disposal Point →'}
          </button>
        </div>

        <button onclick="window.wasteScanner.resetScanner()" class="btn-secondary-action" style="width:100%; height:38px;">
          Scan Again ↻
        </button>
      </div>
    `;

    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // KEY REQUIREMENT 7: Send Scanned Item to Sorting Station Tray
  async sendToSortingStation() {
    if (!this.currentResult) return;

    try {
      const res = await fetch('/api/session/load-scanned-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scannedItem: this.currentResult,
          stationId: window.sortingStation ? window.sortingStation.selectedStationId : 'ST-01'
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      window.app.switchTab('sorting');

      if (window.sortingStation) {
        window.sortingStation.activeSession = data.session;
        window.sortingStation.renderScannedItemTray(data.session.currentItem);
      }

      window.app.showToast(`✓ Loaded ${this.currentResult.wasteType} into Sorting Station tray.`);
    } catch (err) {
      console.error('Error sending to sorting station:', err);
      window.app.showToast(`Transfer error: ${err.message}`);
    }
  }

  // Connects Scanner + Map: Filter & Highlight on Leaflet Map
  async routeToNearestFacility(facilityType, wasteLabel) {
    if (!window.wasteMap) {
      window.app.switchTab('map');
      return;
    }

    window.app.switchTab('map');
    await window.wasteMap.routeForWasteType(facilityType, wasteLabel);
  }

  resetScanner() {
    this.selectedImageData = null;
    this.selectedFilename = null;
    this.selectedPreset = null;
    this.currentResult = null;

    const fileInput = document.getElementById('waste-file-input');
    if (fileInput) fileInput.value = '';

    const dropzonePrompt = document.getElementById('dropzone-prompt');
    const previewContainer = document.getElementById('upload-preview-container');
    const btnAnalyze = document.getElementById('btn-analyze-upload');

    if (dropzonePrompt) dropzonePrompt.style.display = 'block';
    if (previewContainer) previewContainer.style.display = 'none';
    if (btnAnalyze) btnAnalyze.disabled = true;

    const resultCard = document.getElementById('scanner-result-card');
    const emptyState = document.getElementById('scanner-empty-state');
    if (resultCard) resultCard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';

    document.querySelectorAll('.preset-sample-card').forEach(c => c.classList.remove('selected'));

    if (this.currentMode === 'camera') {
      this.retakeCamera();
    }
  }

  async fetchRecentScans() {
    try {
      const res = await fetch('/api/scanner/recent?limit=10');
      const data = await res.json();
      if (!data.success) return;

      this.recentScans = data.scans;
      this.renderRecentScans(this.recentScans);
      this.renderDashboardRecentScans(this.recentScans);
    } catch (err) {
      console.error('Error fetching recent scans:', err);
    }
  }

  renderRecentScans(scans) {
    const listEl = document.getElementById('scanner-recent-list');
    if (!listEl) return;

    if (!scans || scans.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#94A3B8; font-size:0.8rem;">No scans yet. Try scanning an item above!</div>`;
      return;
    }

    listEl.innerHTML = scans.map(s => {
      const icon = this.getCategoryEmoji(s.category);
      const isHigh = s.confidence >= 0.75;
      return `
        <div class="recent-scan-item" onclick="window.wasteScanner.viewHistoricalScan('${s.id}')" style="display:flex; align-items:center; gap:12px; padding:10px 14px; background:var(--bg-card-subtle); border:1px solid var(--border-subtle); border-radius:8px; margin-bottom:8px; cursor:pointer;">
          <div class="recent-scan-thumb" style="width:48px; height:48px; border-radius:6px; overflow:hidden; background:#F1F5F9; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${s.imageUrl && s.imageUrl.startsWith('data:image') ? 
              `<img src="${s.imageUrl}" style="width:100%; height:100%; object-fit:cover;">` : 
              `<span style="font-size:1.6rem;">${icon}</span>`}
          </div>
          <div class="recent-scan-info" style="flex:1;">
            <div style="font-weight:700; color:var(--text-main); font-size:0.86rem;">${s.wasteType}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              ${s.category} · ${(s.confidence * 100).toFixed(1)}% confidence
            </div>
            <div style="font-size:0.72rem; color:${isHigh ? '#059669' : '#D97706'}; margin-top:2px; font-weight:600;">
              ${s.verificationStatus || (isHigh ? '✓ Verified' : '⚠ Manual review')}
            </div>
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted); text-align:right;">
            <div style="font-weight:600;">📍 ${s.location || 'India'}</div>
            <div style="margin-top:3px;">${s.scannedAt}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderDashboardRecentScans(scans) {
    const dashList = document.getElementById('dashboard-recent-scans-feed');
    if (!dashList) return;

    if (!scans || scans.length === 0) {
      dashList.innerHTML = `<div style="padding:16px; text-align:center; color:#94A3B8; font-size:0.8rem;">No recent scans recorded</div>`;
      return;
    }

    dashList.innerHTML = scans.slice(0, 4).map(s => {
      const icon = this.getCategoryEmoji(s.category);
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-card-subtle); border:1px solid var(--border-subtle); border-radius:8px; margin-bottom:8px; cursor:pointer;" onclick="window.app.switchTab('scanner')">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:6px; background:#FFFFFF; border:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
              ${icon}
            </div>
            <div>
              <div style="font-weight:600; font-size:0.83rem; color:var(--text-main);">${s.wasteType}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">${s.category} · ${(s.confidence * 100).toFixed(1)}%</div>
            </div>
          </div>
          <span class="status-pill ${s.recyclable ? 'online' : 'attention'}" style="font-size:0.7rem;">
            ${s.recyclable ? 'Recyclable' : 'Special Handling'}
          </span>
        </div>
      `;
    }).join('');
  }

  getCategoryEmoji(category) {
    const map = {
      'Plastic': '🍾',
      'Paper/Cardboard': '📦',
      'Glass': '🍷',
      'Metal': '🥫',
      'Organic/Wet Waste': '🍌',
      'E-Waste': '🔋',
      'Textile': '👕',
      'Hazardous Waste': '⚠️',
      'Mixed Waste': '🥡',
      'Other/Unknown': '❓',
      'Unknown': '❓'
    };
    return map[category] || '♻️';
  }

  viewHistoricalScan(scanId) {
    const scan = this.recentScans.find(s => s.id === scanId);
    if (!scan) return;
    this.renderResultCard(scan);
  }
}

window.WasteScanner = WasteScanner;

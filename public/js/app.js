/**
 * EcoTrace Main Application Controller
 * Coordinates:
 * - Real-time Overview synchronization (Indian Smart Grid Facilities & Metrics)
 * - Live Waste Operations Alerts panel & "Mark read" action
 * - Navigation tabs (Overview, Waste Scanner, Live Map, Sorting Station, Facilities, Reports)
 * - Bi-lingual Localization Engine (English & हिन्दी dynamic UI translation)
 * - Toasts & modal dialogs
 * - Dark mode theme persistence
 */

const I18N = {
  en: {
    brand_title: 'EcoTrace',
    tab_overview: 'Overview',
    tab_scanner: 'Waste Scanner',
    tab_map: 'Live Map',
    tab_sorting: 'Sorting Station',
    tab_facilities: 'Facilities',
    tab_reports: 'Reports',
    live_monitoring: 'LIVE MONITORING · WASTE MANAGEMENT',
    page_header_title_overview: 'National Impact Map',
    page_header_title_scanner: 'AI Garbage & Waste Scanner',
    page_header_title_map: 'Interactive Waste & Facility Map',
    page_header_title_sorting: 'Active Sorting Station',
    page_header_title_facilities: 'Waste Facilities & Transfer Hubs',
    page_header_title_reports: 'Traceability & Audit Reports',
    export_report: 'Export Report',
    items_processed: 'Items Processed',
    sorting_accuracy: 'Sorting Accuracy',
    recovery_rate: 'Material Recovery Rate',
    contamination_rate: 'Contamination Rate',
    live_alerts: 'Live Waste Operations Alerts',
    upload_image: 'Upload Image',
    open_camera: 'Open Camera',
    scan_waste: 'Scan Waste ✦',
    scan_again: 'Scan Again ↻',
    recent_scans: 'Recent Waste Scans',
    sorting_station: 'Sorting Station',
    waste_category: 'Waste Category',
    confidence: 'Confidence',
    verification: 'Verification',
    location: 'Location',
    recyclable: 'Recyclable',
    non_recyclable: 'Non-Recyclable',
    recommended_action: 'Recommended Action',
    alerts: 'Alerts',
    map: 'Live Map',
    start_camera: 'Start Camera',
    capture_waste: 'Capture Waste',
    scan_captured_waste: 'Scan Captured Waste ✦',
    stop_camera: 'Stop Camera',
    send_to_sorting: 'Send to Sorting Station'
  },
  hi: {
    brand_title: 'इको-ट्रेस',
    tab_overview: 'डैशबोर्ड',
    tab_scanner: 'अपशिष्ट स्कैनर',
    tab_map: 'लाइव मानचित्र',
    tab_sorting: 'छंटाई स्टेशन',
    tab_facilities: 'सुविधाएं',
    tab_reports: 'रिपोर्ट्स',
    live_monitoring: 'लाइव मॉनिटरिंग · अपशिष्ट प्रबंधन',
    page_header_title_overview: 'राष्ट्रीय प्रभाव मानचित्र',
    page_header_title_scanner: 'एआई कचरा एवं अपशिष्ट स्कैनर',
    page_header_title_map: 'इंटरैक्टिव अपशिष्ट एवं सुविधा मानचित्र',
    page_header_title_sorting: 'सक्रिय छंटाई स्टेशन',
    page_header_title_facilities: 'अपशिष्ट सुविधाएं एवं केंद्र',
    page_header_title_reports: 'ट्रेसेबिलिटी एवं ऑडिट रिपोर्ट',
    export_report: 'रिपोर्ट निर्यात करें',
    items_processed: 'प्रसंस्कृत वस्तुएं',
    sorting_accuracy: 'छंटाई सटीकता',
    recovery_rate: 'पुनर्प्राप्ति दर',
    contamination_rate: 'संदूषण दर',
    live_alerts: 'लाइव संचालन अलर्ट',
    upload_image: 'छवि अपलोड करें',
    open_camera: 'कैमरा खोलें',
    scan_waste: 'कचरा स्कैन करें ✦',
    scan_again: 'पुनः स्कैन करें ↻',
    recent_scans: 'हाल के स्कैन',
    sorting_station: 'छंटाई स्टेशन',
    waste_category: 'कचरे की श्रेणी',
    confidence: 'सटीकता / विश्वास',
    verification: 'सत्यापन',
    location: 'स्थान',
    recyclable: 'पुनर्चक्रण योग्य',
    non_recyclable: 'गैर-पुनर्चक्रण योग्य',
    recommended_action: 'अनुशंसित कार्रवाई',
    alerts: 'अलर्ट',
    map: 'मानचित्र',
    start_camera: 'कैमरा शुरू करें',
    capture_waste: 'कचरे की फोटो लें',
    scan_captured_waste: 'कैप्चर किया गया कचरा स्कैन करें ✦',
    stop_camera: 'कैमरा बंद करें',
    send_to_sorting: 'छंटाई स्टेशन पर भेजें'
  }
};

class EcoTraceApp {
  constructor() {
    this.currentTab = 'overview';
    this.currentLang = localStorage.getItem('ecotrace-lang') || 'en';
    this.stations = [];
    this.alerts = [];
    this.init();
  }

  async init() {
    this.bindNavigation();
    this.bindHeaderActions();
    this.initModules();
    this.setLanguage(this.currentLang);
    await this.refreshAll();

    // Polling every 15s for background updates
    setInterval(() => {
      this.fetchOverviewStats();
      this.fetchAlerts();
    }, 15000);
  }

  initModules() {
    window.trendChart = new TrendChart('emissions-trend-canvas');
    window.impactMap = new ImpactMap('impact-map-container');
    window.wasteScanner = new WasteScanner();
    window.wasteMap = new WasteMap('live-waste-map-container');
    window.sortingStation = new SortingStation();
    window.facilitiesManager = new FacilitiesManager();
    window.reportsManager = new ReportsManager();
  }

  bindNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });
  }

  bindHeaderActions() {
    // Language Selector
    const langSelect = document.getElementById('lang-selector');
    if (langSelect) {
      langSelect.value = this.currentLang;
      langSelect.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
        this.showToast(e.target.value === 'hi' ? '🇮🇳 भाषा बदलकर हिन्दी की गई' : '🇬🇧 Language switched to English');
      });
    }

    // Theme Toggle (Dark / Light Mode)
    const themeBtn = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    if (localStorage.getItem('ecotrace-theme') === 'dark') {
      document.body.classList.add('dark-mode');
      if (themeIcon) themeIcon.innerText = '☀️';
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        if (themeIcon) themeIcon.innerText = isDark ? '☀️' : '🌙';
        localStorage.setItem('ecotrace-theme', isDark ? 'dark' : 'light');
        this.showToast(isDark ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
      });
    }

    // Export Report button in subheader
    const exportBtn = document.getElementById('btn-export-report-header');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.reportsManager.exportCsv();
      });
    }

    // Mark Read in Live Alerts
    const markReadBtn = document.getElementById('btn-mark-alerts-read');
    if (markReadBtn) {
      markReadBtn.addEventListener('click', async () => {
        await this.markAlertsRead();
      });
    }

    // Modal Close buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      });
    });

    // Close modal on click outside card
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Manual override submit
    const submitOverrideBtn = document.getElementById('btn-submit-override');
    if (submitOverrideBtn) {
      submitOverrideBtn.addEventListener('click', () => {
        window.sortingStation.submitManualOverride();
      });
    }
  }

  setLanguage(lang) {
    this.currentLang = lang || 'en';
    localStorage.setItem('ecotrace-lang', this.currentLang);
    const dict = I18N[this.currentLang] || I18N.en;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.innerText = dict[key];
      }
    });

    const langSelect = document.getElementById('lang-selector');
    if (langSelect) langSelect.value = this.currentLang;

    // Update navigation links text dynamically
    const navMap = {
      overview: dict.tab_overview,
      scanner: dict.tab_scanner,
      map: dict.tab_map,
      sorting: dict.tab_sorting,
      facilities: dict.tab_facilities,
      reports: dict.tab_reports
    };

    document.querySelectorAll('.nav-link').forEach(link => {
      const tab = link.getAttribute('data-tab');
      if (navMap[tab]) {
        const badge = link.querySelector('.nav-badge');
        link.childNodes[0].nodeValue = navMap[tab] + ' ';
      }
    });

    // Update Subheader Title
    const titleEl = document.getElementById('page-header-title');
    if (titleEl) {
      const titleKey = `page_header_title_${this.currentTab}`;
      if (dict[titleKey]) titleEl.innerText = dict[titleKey];
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-tab') === tabName);
    });

    // Show/hide view sections
    const views = ['overview', 'scanner', 'map', 'sorting', 'facilities', 'reports'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = v === tabName ? 'flex' : 'none';
    });

    // Update Subheader Title according to active language
    const dict = I18N[this.currentLang] || I18N.en;
    const titleEl = document.getElementById('page-header-title');
    if (titleEl) {
      const titleKey = `page_header_title_${tabName}`;
      titleEl.innerText = dict[titleKey] || 'EcoTrace';
    }

    // Trigger tab specific refreshes
    if (tabName === 'overview') {
      if (window.trendChart) window.trendChart.resize();
    } else if (tabName === 'map') {
      if (window.wasteMap && window.wasteMap.map) {
        setTimeout(() => {
          window.wasteMap.map.invalidateSize();
        }, 120);
      }
    } else if (tabName === 'scanner') {
      if (window.wasteScanner) {
        window.wasteScanner.fetchRecentScans();
      }
    } else if (tabName === 'facilities') {
      window.facilitiesManager.setStations(this.stations);
    } else if (tabName === 'reports') {
      window.reportsManager.fetchRecords();
    }
  }

  openSortingStationFor(stationId) {
    this.switchTab('sorting');
    const select = document.getElementById('station-selector');
    if (select) {
      select.value = stationId;
      select.dispatchEvent(new Event('change'));
    }
    this.showToast(`Switched active terminal to ${stationId}`);
  }

  async refreshAll() {
    await Promise.all([
      this.fetchOverviewStats(),
      this.fetchStations(),
      this.fetchAlerts()
    ]);
  }

  async fetchOverviewStats() {
    try {
      const d = (window.DEMO_DATA && window.DEMO_DATA.metrics) ? window.DEMO_DATA.metrics : {
        itemsProcessed: '1,284',
        sortingAccuracy: '94.6%',
        recoveredMaterial: '842 kg',
        aiWasteScans: '56',
        activeFacilities: 12,
        recyclableDiverted: '78%',
        collectionEfficiency: '91%',
        wasteSortedToday: '326 kg',
        activeAlerts: 3
      };

      let s = { ...d };
      try {
        const res = await fetch('/api/overview');
        const data = await res.json();
        if (data.success && data.stats) {
          s = { ...d, ...data.stats };
        }
      } catch (e) {
        console.warn('Network stats fallback:', e);
      }

      const safe = (val, fb = '0') => (val !== undefined && val !== null && val !== '') ? String(val) : fb;

      const itemsProcessed = safe(s.itemsProcessed || s.totalItemsProcessed, d.itemsProcessed);
      const accuracy = safe(s.sortingAccuracy || s.accuracy, d.sortingAccuracy);
      const recovery = safe(s.recoveredMaterial || s.materialRecoveryRate || s.recoveredMaterialRate, d.recoveredMaterial);
      const scansCount = safe(s.aiWasteScans || (s.scannerStats ? s.scannerStats.totalScans : null), d.aiWasteScans);
      const scansRate = safe(s.recyclableDiverted || (s.scannerStats ? s.scannerStats.recyclingRate : null), d.recyclableDiverted);
      const facilities = safe(s.activeFacilities, String(d.activeFacilities || 12));
      const alerts = safe(s.activeAlerts, String(d.activeAlerts || 3));

      // Update Top 4 KPI Cards
      const elProcessed = document.getElementById('kpi-items-processed');
      const elAccuracy = document.getElementById('kpi-accuracy');
      const elRecovery = document.getElementById('kpi-recovery');
      const elScannerCount = document.getElementById('kpi-scanner-count');
      const elScannerRate = document.getElementById('kpi-scanner-rate');

      if (elProcessed) elProcessed.innerText = itemsProcessed;
      if (elAccuracy) elAccuracy.innerText = accuracy.endsWith('%') ? accuracy : `${accuracy}%`;
      if (elRecovery) elRecovery.innerText = recovery.endsWith('kg') ? recovery : `${recovery} kg`;
      if (elScannerCount) elScannerCount.innerText = scansCount.includes('Scan') ? scansCount : `${scansCount} Scans`;
      if (elScannerRate) elScannerRate.innerText = scansRate.includes('Diverted') ? scansRate : `${scansRate} Recyclable Diverted`;

      // Update Badges with realistic demo metrics
      const elProcessedBadge = document.getElementById('kpi-items-processed-badge');
      const elAccuracyBadge = document.getElementById('kpi-accuracy-badge');
      if (elProcessedBadge) elProcessedBadge.innerText = `↗ Waste Sorted Today: ${d.wasteSortedToday || '326 kg'}`;
      if (elAccuracyBadge) elAccuracyBadge.innerText = `↗ Collection Efficiency: ${d.collectionEfficiency || '91%'}`;

      // Meta counters in subheader
      const elFac = document.getElementById('meta-facility-count');
      const elAlt = document.getElementById('meta-alert-count');
      if (elFac) elFac.innerText = facilities;
      if (elAlt) elAlt.innerText = alerts;

    } catch (err) {
      console.error('Error fetching overview stats:', err);
    }
  }

  async fetchStations() {
    try {
      const res = await fetch('/api/stations');
      const data = await res.json();
      if (data.success && data.stations && data.stations.length > 0) {
        this.stations = data.stations;
      } else if (window.DEMO_DATA && window.DEMO_DATA.stations) {
        this.stations = [...window.DEMO_DATA.stations];
      }
      if (window.impactMap) window.impactMap.setStations(this.stations);
      if (window.facilitiesManager) window.facilitiesManager.setStations(this.stations);
    } catch (err) {
      console.warn('Error fetching stations, using demoData:', err);
      if (window.DEMO_DATA && window.DEMO_DATA.stations) {
        this.stations = [...window.DEMO_DATA.stations];
        if (window.impactMap) window.impactMap.setStations(this.stations);
        if (window.facilitiesManager) window.facilitiesManager.setStations(this.stations);
      }
    }
  }

  async fetchAlerts() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (!data.success) return;

      this.alerts = data.alerts;
      this.renderAlerts(this.alerts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  }

  renderAlerts(alerts) {
    const list = document.getElementById('alerts-feed-list');
    const badge = document.querySelector('.badge-dot');
    if (!list) return;

    if (!alerts || alerts.length === 0) {
      list.innerHTML = `
        <div style="padding:24px; text-align:center; color:#94A3B8; font-size:0.85rem;">
          ✓ All municipal sorting lines operating within safety parameters. No active alerts.
        </div>
      `;
      if (badge) badge.style.display = 'none';
      return;
    }

    if (badge) badge.style.display = 'block';

    list.innerHTML = alerts.map(a => {
      const borderClass = a.severity === 'CRITICAL' ? 'border-critical' : (a.severity === 'WARNING' ? 'border-warning' : 'border-notice');
      const badgeClass = a.severity.toLowerCase();

      return `
        <div class="alert-item ${borderClass}">
          <div class="alert-item-header">
            <span class="status-pill ${badgeClass}">${a.severity}</span>
            <span class="alert-time">${a.timestamp}</span>
          </div>
          <div class="alert-title">${a.title}</div>
          <p class="alert-desc">${a.description}</p>
          ${a.location ? `<div class="alert-location">📍 ${a.location}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  async markAlertsRead() {
    try {
      const res = await fetch('/api/alerts/mark-read', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.fetchAlerts();
        this.showToast('All alerts marked as read.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new EcoTraceApp();
});

const express = require('express');
const router = express.Router();
const {
  db,
  getOverviewStats,
  getStations,
  getStationById,
  getAlerts,
  markAlertsAsRead,
  getRoutingRules,
  getWasteRecords,
  getItemEvents,
  saveScan,
  getRecentScans,
  getScannerStats,
  getWasteLocations,
  getWasteLocationById,
  getNearestLocations
} = require('./db');
const { sessionManager } = require('./sessionStateMachine');
const { scannerService } = require('./scannerService');

// 1. Executive City Overview & Environmental/Waste KPIs
router.get('/overview', (req, res) => {
  try {
    const stats = getOverviewStats();
    
    // Emissions/Recovery trend data (Jan - Jun) matching Stitch line chart
    const trends = [
      { month: 'Jan', actual: 16.2, baseline: 17.0, recovered: 12.1 },
      { month: 'Feb', actual: 16.8, baseline: 17.0, recovered: 12.8 },
      { month: 'Mar', actual: 17.1, baseline: 17.0, recovered: 13.4 },
      { month: 'Apr', actual: 17.4, baseline: 17.0, recovered: 14.1 },
      { month: 'May', actual: 18.2, baseline: 17.0, recovered: 14.9 },
      { month: 'Jun', actual: 18.4, baseline: 17.0, recovered: 15.6 }
    ];

    // Sustainability Compliance Status
    const compliance = [
      { name: 'Clean Stream Diversion', percent: 92, target: '95%' },
      { name: 'Waste Recovery Rate', percent: 78, target: '85%' },
      { name: 'Hazardous Isolation', percent: 61, target: '75%' }
    ];

    // Diversion & Carbon Offset Metrics (matching Stitch UI metrics)
    const offsetMetrics = {
      treesPlanted: '12,450',
      treesSub: '+1,200 this quarter',
      co2Offset: '840 t',
      co2Sub: '+4.8% vs last year',
      netFootprint: '17.6k t',
      netSub: 'After diversion applied',
      creditsIssued: '3,920',
      creditsSub: 'Verified & audited'
    };

    res.json({
      success: true,
      stats,
      trends,
      compliance,
      offsetMetrics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Stations / Facilities
router.get('/stations', (req, res) => {
  try {
    const stations = getStations();
    res.json({ success: true, stations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stations/:id', (req, res) => {
  try {
    const station = getStationById(req.params.id);
    if (!station) return res.status(404).json({ success: false, error: 'Station not found' });
    const rules = getRoutingRules(station.id);
    res.json({ success: true, station, rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Live Waste Operations Alerts
router.get('/alerts', (req, res) => {
  try {
    const alerts = getAlerts();
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/alerts/mark-read', (req, res) => {
  try {
    const result = markAlertsAsRead();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Traceable Waste Records & Auditing
router.get('/waste-records', (req, res) => {
  try {
    const records = getWasteRecords(req.query);
    res.json({ success: true, records, count: records.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/waste-records/:id/events', (req, res) => {
  try {
    const events = getItemEvents(req.params.id);
    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. CSV Export Report
router.get('/reports/export', (req, res) => {
  try {
    const records = getWasteRecords(req.query);
    let csv = 'Record_ID,Session_ID,Station_ID,Label,Material,Condition,Confidence,Route,Special_Handling,Contamination,Status,Detected_At,Verified_At,Operator_Note\n';
    
    for (const r of records) {
      csv += [
        r.id,
        r.sessionId,
        r.stationId,
        `"${(r.label || '').replace(/"/g, '""')}"`,
        `"${(r.material || '').replace(/"/g, '""')}"`,
        r.condition,
        (r.confidence * 100).toFixed(1) + '%',
        `"${(r.route || '').replace(/"/g, '""')}"`,
        r.specialHandling ? 'YES' : 'NO',
        r.contamination,
        r.status,
        r.detectedAt || '',
        r.verifiedAt || '',
        `"${(r.operatorNote || '').replace(/"/g, '""')}"`
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="EcoTrace_Report_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Contamination Monitor
router.get('/contamination', (req, res) => {
  try {
    const stations = getStations();
    const categorized = {
      HIGH: stations.filter(s => s.contaminationRate >= 10),
      MEDIUM: stations.filter(s => s.contaminationRate >= 6 && s.contaminationRate < 10),
      LOW: stations.filter(s => s.contaminationRate < 6)
    };
    res.json({ success: true, categorized });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Sorting Session Management Endpoints
router.get('/session/active', (req, res) => {
  res.json({ success: true, session: sessionManager.getActiveSession() });
});

router.post('/session/start', (req, res) => {
  try {
    const { stationId, mode } = req.body;
    const session = sessionManager.startSession(stationId || 'ST-01', mode || 'DEMO');
    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/scan', async (req, res) => {
  try {
    const session = await sessionManager.scanTray(req.body);
    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/load-scanned-item', (req, res) => {
  try {
    const { scannedItem, stationId } = req.body;
    if (!scannedItem) return res.status(400).json({ success: false, error: 'scannedItem required' });
    const session = sessionManager.loadScannedItem(scannedItem, stationId || 'ST-01');
    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/start-queue', (req, res) => {
  try {
    const session = sessionManager.startSortingQueue();
    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/select-item', (req, res) => {
  try {
    const { index } = req.body;
    const session = sessionManager.selectItemByIndex(index);
    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/request-removal', (req, res) => {
  try {
    const session = sessionManager.requestRemoval();
    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/verify-removal', async (req, res) => {
  try {
    const { simulateFailure } = req.body;
    const result = await sessionManager.verifyItemRemoval(!!simulateFailure);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/manual-override', (req, res) => {
  try {
    const { correctedRoute, reason } = req.body;
    const result = sessionManager.manualOverride(correctedRoute, reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/flag-item', (req, res) => {
  try {
    const { reason } = req.body;
    const result = sessionManager.flagItem(reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/resolve-unknown', (req, res) => {
  try {
    const { selectedMaterial, assignedRoute } = req.body;
    const result = sessionManager.resolveUnknown(selectedMaterial, assignedRoute);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/next-item', (req, res) => {
  try {
    const session = sessionManager.advanceToNextItem();
    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/session/complete', (req, res) => {
  try {
    const session = sessionManager.completeSession();
    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================================
// AI WASTE SCANNER ENDPOINTS
// ============================================================

router.post('/scanner/analyze', async (req, res) => {
  try {
    const result = await scannerService.analyzeWaste(req.body);
    saveScan(result);

    // If critical or e-waste, generate a real-time operations alert
    if (result.riskLevel === 'Critical' || result.category === 'E-Waste' || result.category === 'Hazardous Waste') {
      const alertId = `ALT-${Date.now().toString().slice(-4)}`;
      db.prepare(`
        INSERT INTO alerts (id, stationId, severity, title, description, location, timestamp, read)
        VALUES (?, NULL, 'WARNING', ?, ?, 'Mobile AI Scanner Unit', 'Just now', 0)
      `).run(
        alertId,
        `AI Scanner flagged ${result.wasteType} (${result.category})`,
        `Identified ${result.category} with risk level ${result.riskLevel}. Recommended: ${result.disposalMethod}`
      );
    }

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scanner/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const scans = getRecentScans(limit);
    res.json({ success: true, scans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scanner/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const scans = getRecentScans(limit);
    res.json({ success: true, scans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scanner/stats', (req, res) => {
  try {
    const stats = getScannerStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// INTERACTIVE WASTE MAP & LOCATION ENDPOINTS
// ============================================================

router.get('/locations', (req, res) => {
  try {
    const locations = getWasteLocations(req.query.type);
    res.json({ success: true, locations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/locations/nearest', (req, res) => {
  try {
    const { lat, lng, category, limit } = req.query;
    const locations = getNearestLocations(lat, lng, category, parseInt(limit, 10) || 5);
    res.json({ success: true, locations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/locations/:id', (req, res) => {
  try {
    const location = getWasteLocationById(req.params.id);
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });
    res.json({ success: true, location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

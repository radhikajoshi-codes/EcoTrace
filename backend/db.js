const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'ecotrace.db');
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL, -- NORMAL, ELEVATED, CRITICAL
      ruleset TEXT NOT NULL, -- standard_urban, high_recovery, industrial
      itemsToday INTEGER DEFAULT 0,
      recoveryRate REAL DEFAULT 0.0,
      contaminationRate REAL DEFAULT 0.0,
      specialHandlingCount INTEGER DEFAULT 0,
      lastActivity TEXT,
      lat REAL,
      lng REAL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sorting_sessions (
      id TEXT PRIMARY KEY,
      stationId TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      status TEXT NOT NULL,
      itemCount INTEGER DEFAULT 0,
      verifiedCount INTEGER DEFAULT 0,
      failedCount INTEGER DEFAULT 0,
      manualOverrideCount INTEGER DEFAULT 0,
      mode TEXT DEFAULT 'DEMO',
      FOREIGN KEY (stationId) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS waste_items (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      stationId TEXT NOT NULL,
      label TEXT NOT NULL,
      material TEXT NOT NULL,
      condition TEXT NOT NULL,
      confidence REAL NOT NULL,
      route TEXT NOT NULL,
      specialHandling INTEGER DEFAULT 0,
      contamination TEXT DEFAULT 'None',
      contaminationIssue TEXT,
      status TEXT NOT NULL,
      operatorNote TEXT,
      detectedAt TEXT NOT NULL,
      verifiedAt TEXT,
      FOREIGN KEY (sessionId) REFERENCES sorting_sessions(id),
      FOREIGN KEY (stationId) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS sorting_events (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      itemId TEXT,
      eventType TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      stationId TEXT,
      severity TEXT NOT NULL, -- CRITICAL, WARNING, NOTICE
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT,
      timestamp TEXT NOT NULL,
      read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY,
      stationId TEXT,
      ruleset TEXT,
      material TEXT NOT NULL,
      condition TEXT,
      specialHandling INTEGER DEFAULT 0,
      route TEXT NOT NULL,
      instructions TEXT
    );

    CREATE TABLE IF NOT EXISTS system_metrics (
      key TEXT PRIMARY KEY,
      numValue REAL,
      strValue TEXT
    );

    -- AI Scanner Scans Table
    CREATE TABLE IF NOT EXISTS waste_scans (
      id TEXT PRIMARY KEY,
      wasteType TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence REAL NOT NULL,
      recyclable INTEGER NOT NULL,
      disposalMethod TEXT NOT NULL,
      riskLevel TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      explanation TEXT NOT NULL,
      suitableFacilityType TEXT NOT NULL,
      imageUrl TEXT,
      location TEXT,
      verificationStatus TEXT,
      scannedAt TEXT NOT NULL
    );

    -- Rich Waste & Facility Locations for Interactive Map
    CREATE TABLE IF NOT EXISTS waste_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- recycling, e_waste, waste_collection, high_risk, landfill, monitored
      status TEXT NOT NULL, -- Active, Near Capacity, Operational, Attention
      riskLevel TEXT NOT NULL, -- Low, Medium, High, Critical
      lastUpdated TEXT NOT NULL,
      wasteCollected TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      available INTEGER NOT NULL,
      acceptedTypes TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      phone TEXT,
      operatingHours TEXT
    );
  `);

  // Schema migrations for columns added to waste_scans
  try { db.exec('ALTER TABLE waste_scans ADD COLUMN location TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE waste_scans ADD COLUMN verificationStatus TEXT;'); } catch (_) {}

  // Check if Indore / AITR data exists in stations or waste_locations; if not, migrate to Indore
  try {
    const aitrCheck = db.prepare("SELECT COUNT(*) as count FROM waste_locations WHERE name LIKE '%AITR%'").get();
    if (!aitrCheck || aitrCheck.count === 0) {
      console.log('Migrating facilities and stations to AITR Indore Smart Grid...');
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('DELETE FROM waste_locations;');
      db.exec('DELETE FROM stations;');
      db.exec('PRAGMA foreign_keys = ON;');
    }
  } catch (e) {
    console.warn('AITR migration check error:', e.message);
  }

  seedInitialData();
  seedLocationsAndScans();
}

function seedInitialData() {
  const stationCount = db.prepare('SELECT COUNT(*) as count FROM stations').get();
  if (stationCount.count > 0) {
    return; // Already seeded
  }

  // 1. Seed System Metrics (Baseline)
  const insertMetric = db.prepare('INSERT OR REPLACE INTO system_metrics (key, numValue, strValue) VALUES (?, ?, ?)');
  insertMetric.run('baseline_items_processed', 14280, 'Baseline items count');
  insertMetric.run('baseline_accuracy', 92.6, 'Target accuracy %');
  insertMetric.run('baseline_recovery_rate', 71.4, 'Material recovery %');
  insertMetric.run('baseline_special_handling', 214, 'Special handling total');
  insertMetric.run('baseline_contamination_rate', 7.8, 'Contamination rate %');

  // 2. Seed Stations (Indian Metropolitan Corridors)
  const insertStation = db.prepare(`
    INSERT OR REPLACE INTO stations (id, name, location, status, ruleset, itemsToday, recoveryRate, contaminationRate, specialHandlingCount, lastActivity, lat, lng, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const stations = [
    ['ST-01', 'AITR Central Sorting Hub (Indore)', 'Campus & Bypass Road MRF', 'ACTIVE', 'standard_urban', 512, 94.6, 5.4, 4, '2 min ago', 22.7240, 75.8740, '2026-01-15T08:00:00Z'],
    ['ST-02', 'Mangliya Materials Recovery Facility', 'AB Road Industrial Zone', 'ACTIVE', 'high_recovery', 420, 93.8, 6.2, 8, '8 min ago', 22.7480, 75.8920, '2026-01-15T08:00:00Z'],
    ['ST-03', 'Vijay Nagar High-Speed Sorting Terminal', 'Scheme 54 Commercial Depot', 'ACTIVE', 'battery_strict', 285, 96.2, 3.8, 12, '15 min ago', 22.7533, 75.8937, '2026-01-15T08:00:00Z'],
    ['ST-04', 'Palasia Circular Depository', 'AB Road Tech Corridor', 'ACTIVE', 'standard_urban', 190, 97.4, 2.6, 15, '22 min ago', 22.7206, 75.8824, '2026-01-20T08:00:00Z'],
    ['ST-05', 'Rau Hazardous & Industrial Remediation', 'Pithampur Link Road', 'ACTIVE', 'hazmat_containment', 340, 91.2, 8.8, 22, '35 min ago', 22.6284, 75.8115, '2026-01-22T08:00:00Z'],
    ['ST-06', 'Bhanwarkuan Wet & Bio-Compost Line', 'South Indore Suburb', 'ACTIVE', 'organic_compost', 310, 95.1, 4.9, 3, '40 min ago', 22.6892, 75.8647, '2026-02-01T08:00:00Z']
  ];

  for (const s of stations) {
    insertStation.run(...s);
  }

  // 3. Seed Routing Rules
  const insertRule = db.prepare(`
    INSERT OR REPLACE INTO routing_rules (id, stationId, ruleset, material, condition, specialHandling, route, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rules = [
    ['RR-01', null, 'standard_urban', 'PET Plastic', 'Recyclable', 0, 'Dry / Recyclable Waste', 'Place in Bin A (Rigid Plastics)'],
    ['RR-02', null, 'standard_urban', 'PET Plastic', 'Contaminated', 0, 'Contaminated Stream / Pre-Wash', 'Rinse required or route to secondary wash bin'],
    ['RR-03', null, 'standard_urban', 'Aluminium', 'Recyclable', 0, 'Dry / Metal Recovery', 'Compress and route to Non-Ferrous Metals Bin B'],
    ['RR-04', null, 'standard_urban', 'Organic', 'Compostable', 0, 'Wet / Organic Compost', 'Place in Aerated Compost Stream Bin C'],
    ['RR-05', null, 'standard_urban', 'Paper', 'Recyclable', 0, 'Dry / Fiber & Cardboard', 'Ensure dry; place in Clean Fiber Bin D'],
    ['RR-06', null, 'standard_urban', 'Household Battery', 'Special Handling', 1, 'Authorized E-Waste Collection', 'DO NOT DROP IN GENERAL RECYCLING. Place in insulated terminal bin.'],
    ['RR-07', null, 'standard_urban', 'Plastic Container', 'Contaminated', 0, 'Residual Waste / Wash Facility', 'Food residue present; route to Residual sorting or industrial washer.'],
    ['RR-08', null, 'high_recovery', 'PET Plastic', 'Recyclable', 0, 'High-Grade Optical Sorting Bin 1', 'Clean optical sensor routing'],
    ['RR-09', null, 'high_recovery', 'Plastic Container', 'Contaminated', 0, 'On-Site EcoWash Station', 'High recovery facility has wash bath'],
    ['RR-10', null, 'standard_urban', 'Textile Fabric', 'Recyclable', 0, 'Dry / Fiber Recovery Stream', 'Keep dry and route to Textile Segregation Bin E']
  ];

  for (const r of rules) {
    insertRule.run(...r);
  }

  // 4. Seed Live Operations Alerts (Indian Metropolitan Grid)
  const insertAlert = db.prepare(`
    INSERT OR REPLACE INTO alerts (id, stationId, severity, title, description, location, timestamp, read)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const alerts = [
    ['ALT-001', 'ST-01', 'CRITICAL', 'High organic contamination at AITR Central Sorting Hub', 'Food residue threshold exceeded (5.4% vs 4.0% limit) in dry plastics stream. Automated re-routing active.', 'AITR Bypass Road Campus · Indore', '2m ago', 0],
    ['ALT-002', 'ST-02', 'WARNING', 'Special-handling battery influx — Mangliya Recovery Facility', '14 lithium battery units detected in stream within 1 hour. Approaching batch threshold.', 'AB Road Industrial Zone · Indore', '18m ago', 0],
    ['ALT-003', null, 'NOTICE', 'Indore smart waste audit scheduled', 'MPPCB environmental compliance review for Indore sorting stations begins next week. Check sensor calibration.', 'Indore Smart Grid · AITR Hub', '1h ago', 0],
    ['ALT-004', 'ST-03', 'WARNING', 'Optical throughput alert at Vijay Nagar Hub', 'Sensor lens dust accumulation detected. Optical classification latency increased by 12ms.', 'Scheme 54 · Vijay Nagar, Indore', '3h ago', 0],
    ['ALT-005', 'ST-04', 'NOTICE', 'New AI optical scanner operational at Palasia Depository', 'Palasia sorting tray online and streaming real-time metrics. Calibration nominal.', 'Old Palasia AB Road · Indore', 'Yesterday', 1]
  ];

  for (const a of alerts) {
    insertAlert.run(...a);
  }

  // Historical Session
  db.prepare(`
    INSERT OR REPLACE INTO sorting_sessions (id, stationId, startedAt, completedAt, status, itemCount, verifiedCount, failedCount, manualOverrideCount, mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('SES-2026-0089', 'ST-01', '2026-10-08T09:15:00Z', '2026-10-08T09:22:15Z', 'COMPLETED', 6, 6, 0, 0, 'DEMO');

  const historicalItems = [
    ['WST-2026-004278', 'SES-2026-0089', 'ST-01', 'PET Water Bottle', 'PET Plastic', 'Recyclable', 0.965, 'Dry / Recyclable Waste', 0, 'None', null, 'VERIFIED', null, '09:15', '09:16'],
    ['WST-2026-004279', 'SES-2026-0089', 'ST-01', 'Soda Can', 'Aluminium', 'Recyclable', 0.982, 'Dry / Metal Recovery', 0, 'None', null, 'VERIFIED', null, '09:15', '09:17'],
    ['WST-2026-004280', 'SES-2026-0089', 'ST-01', 'Banana Peel', 'Organic', 'Compostable', 0.941, 'Wet / Organic Compost', 0, 'None', null, 'VERIFIED', null, '09:15', '09:18'],
    ['WST-2026-004281', 'SES-2026-0089', 'ST-01', 'Coffee Paper Cup', 'Paper', 'Recyclable', 0.893, 'Dry / Fiber & Cardboard', 0, 'None', null, 'VERIFIED', null, '09:15', '09:19'],
    ['WST-2026-004282', 'SES-2026-0089', 'ST-01', 'Household Battery AA', 'Household Battery', 'Special Handling', 0.991, 'Authorized E-Waste Collection', 1, 'None', null, 'VERIFIED', 'Separated in insulated bin', '09:15', '09:20'],
    ['WST-2026-004283', 'SES-2026-0089', 'ST-01', 'Food Container', 'Plastic Container', 'Contaminated', 0.912, 'Residual Waste / Wash Facility', 0, 'Medium', 'Food grease residue', 'VERIFIED', null, '09:15', '09:21']
  ];

  for (const item of historicalItems) {
    db.prepare(`
      INSERT OR REPLACE INTO waste_items (id, sessionId, stationId, label, material, condition, confidence, route, specialHandling, contamination, contaminationIssue, status, operatorNote, detectedAt, verifiedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...item);
  }
}

function seedLocationsAndScans() {
  const locCount = db.prepare('SELECT COUNT(*) as count FROM waste_locations').get();
  if (locCount.count === 0) {
    const insertLoc = db.prepare(`
      INSERT OR REPLACE INTO waste_locations (id, name, type, status, riskLevel, lastUpdated, wasteCollected, capacity, available, acceptedTypes, address, lat, lng, phone, operatingHours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Indore Waste Management Facilities from central DEMO_DATA
    const demoFacilities = require('./demoData').facilities;
    for (const loc of demoFacilities) {
      insertLoc.run(
        loc.id,
        loc.name,
        loc.type,
        loc.status,
        loc.riskLevel,
        loc.lastUpdated,
        loc.wasteCollected,
        loc.capacity,
        loc.available,
        loc.acceptedTypes,
        loc.address,
        loc.lat,
        loc.lng,
        loc.phone || '+91 731 400 0000',
        loc.operatingHours || 'Daily: 8:00 AM - 8:00 PM'
      );
    }
  }

  // Seed sample initial scans if table empty
  const scanCount = db.prepare('SELECT COUNT(*) as count FROM waste_scans').get();
  if (scanCount.count === 0) {
    const insertScan = db.prepare(`
      INSERT OR REPLACE INTO waste_scans (id, wasteType, category, confidence, recyclable, disposalMethod, riskLevel, recommendation, explanation, suitableFacilityType, imageUrl, location, verificationStatus, scannedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialScans = [
      [
        'SCN-2026-01',
        'PET Water Bottle',
        'Plastic',
        0.964,
        1,
        'Dry Recyclable Bin (Blue Container)',
        'Medium',
        'Rinse bottle thoroughly and compress to save bin volume. Leave cap attached.',
        'PET (Polyethylene Terephthalate, #1) is 100% recyclable into new polymers and polyester fiber.',
        'recycling',
        'preset:bottle',
        'AITR Campus, Indore',
        '✓ Waste identified successfully',
        '5 min ago'
      ],
      [
        'SCN-2026-02',
        'Lithium AA Battery',
        'E-Waste',
        0.988,
        0,
        'Certified E-Waste & Battery Depository',
        'Critical',
        'Do NOT place in general waste or municipal bins. High thermal runaway fire risk.',
        'Contains heavy metals and reactive chemical cells requiring specialized pyro/hydrometallurgical recycling.',
        'e_waste',
        'preset:battery',
        'Bengaluru (Whitefield Tech Hub)',
        '✓ Waste identified successfully',
        '18 min ago'
      ],
      [
        'SCN-2026-03',
        'Organic Banana Peel',
        'Organic/Wet Waste',
        0.952,
        1,
        'Wet / Organic Aerated Compost Bin (Green Container)',
        'Low',
        'Route to aerated compost line or municipal food organics collection.',
        'Fast-decaying organic nitrogen source. Landfilling generates fugitive methane emissions.',
        'waste_collection',
        'preset:banana',
        'Mumbai (BKC Eco Hub)',
        '✓ Waste identified successfully',
        '32 min ago'
      ],
      [
        'SCN-2026-04',
        'Aluminium Soda Can',
        'Metal',
        0.982,
        1,
        'Dry Non-Ferrous Metal Recovery Stream',
        'Low',
        'Empty contents and compress. Highly infinite circular recycling loop.',
        'Recycling aluminium saves 95% of energy required to manufacture primary aluminium from bauxite.',
        'recycling',
        'preset:can',
        'Pune (Hadapsar Facility)',
        '✓ Waste identified successfully',
        '1 hour ago'
      ]
    ];

    for (const s of initialScans) {
      insertScan.run(...s);
    }
  }
}

function getOverviewStats() {
  const d = require('./demoData').metrics;
  return {
    itemsProcessed: d.itemsProcessed,
    totalItemsProcessed: d.itemsProcessed,
    accuracy: d.sortingAccuracy,
    sortingAccuracy: d.sortingAccuracy,
    materialRecoveryRate: d.recoveredMaterial,
    recoveredMaterial: d.recoveredMaterial,
    recoveredMaterialRate: d.recoveredMaterial,
    aiWasteScans: d.aiWasteScans,
    activeFacilities: d.activeFacilities,
    recyclableDiverted: d.recyclableDiverted,
    collectionEfficiency: d.collectionEfficiency,
    wasteSortedToday: d.wasteSortedToday,
    specialHandlingCount: d.specialHandlingCount,
    activeAlerts: d.activeAlerts,
    activeContaminationRate: d.contaminationRate,
    monitoringNodes: d.monitoringNodes,
    scannerStats: {
      totalScans: parseInt(d.aiWasteScans, 10) || 56,
      recyclingRate: d.recyclableDiverted
    }
  };
}

function getStations() {
  return db.prepare('SELECT * FROM stations ORDER BY id ASC').all();
}

function getStationById(id) {
  return db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
}

function getAlerts() {
  return db.prepare('SELECT * FROM alerts WHERE read = 0 ORDER BY rowid DESC').all();
}

function markAlertsAsRead() {
  db.prepare('UPDATE alerts SET read = 1').run();
  return { updated: true };
}

function getRoutingRules(stationId = null) {
  if (stationId) {
    const station = getStationById(stationId);
    if (station && station.ruleset) {
      return db.prepare('SELECT * FROM routing_rules WHERE ruleset = ? OR stationId = ?').all(station.ruleset, stationId);
    }
  }
  return db.prepare('SELECT * FROM routing_rules').all();
}

function getWasteRecords(filters = {}) {
  let query = 'SELECT * FROM waste_items WHERE 1=1';
  const params = [];

  if (filters.stationId) {
    query += ' AND stationId = ?';
    params.push(filters.stationId);
  }
  if (filters.condition) {
    query += ' AND condition = ?';
    params.push(filters.condition);
  }
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.specialHandling !== undefined) {
    query += ' AND specialHandling = ?';
    params.push(Number(filters.specialHandling));
  }

  query += ' ORDER BY rowid DESC LIMIT 50';
  return db.prepare(query).all(...params);
}

function getItemEvents(itemId) {
  return db.prepare('SELECT * FROM sorting_events WHERE itemId = ? ORDER BY timestamp ASC').all(itemId);
}

// AI Scanner DB Functions
function saveScan(scan) {
  const insert = db.prepare(`
    INSERT INTO waste_scans (id, wasteType, category, confidence, recyclable, disposalMethod, riskLevel, recommendation, explanation, suitableFacilityType, imageUrl, location, verificationStatus, scannedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    scan.id,
    scan.wasteType,
    scan.category,
    scan.confidence,
    scan.recyclable ? 1 : 0,
    scan.disposalMethod,
    scan.riskLevel,
    scan.recommendation,
    scan.explanation,
    scan.suitableFacilityType,
    scan.imageUrl || null,
    scan.location || 'India (National Grid)',
    scan.verificationStatus || '✓ Waste identified successfully',
    scan.scannedAt || 'Just now'
  );

  return scan;
}

function getRecentScans(limit = 10) {
  return db.prepare('SELECT * FROM waste_scans ORDER BY rowid DESC LIMIT ?').all(limit);
}

function getScannerStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM waste_scans').get().count;
  const recyclable = db.prepare('SELECT COUNT(*) as count FROM waste_scans WHERE recyclable = 1').get().count;
  const ewaste = db.prepare("SELECT COUNT(*) as count FROM waste_scans WHERE category = 'E-Waste'").get().count;
  const nonRecyclable = total - recyclable;
  const recyclingRate = total > 0 ? ((recyclable / total) * 100).toFixed(1) : '75.0';

  return {
    totalScans: total,
    recyclableWaste: recyclable,
    nonRecyclableWaste: nonRecyclable,
    ewasteDetected: ewaste,
    recyclingRate: `${recyclingRate}%`
  };
}

// Waste Locations Methods
function getWasteLocations(filterType = null) {
  if (filterType && filterType !== 'all') {
    return db.prepare('SELECT * FROM waste_locations WHERE type = ? ORDER BY name ASC').all(filterType);
  }
  return db.prepare('SELECT * FROM waste_locations ORDER BY name ASC').all();
}

function getWasteLocationById(id) {
  return db.prepare('SELECT * FROM waste_locations WHERE id = ?').get(id);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getNearestLocations(lat, lng, targetType = null, limit = 5) {
  // Default to AITR, Indore coordinates
  const userLat = parseFloat(lat) || 22.724;
  const userLng = parseFloat(lng) || 75.874;

  let query = 'SELECT * FROM waste_locations';
  const params = [];

  if (targetType && targetType !== 'all') {
    query += ' WHERE type = ?';
    params.push(targetType);
  }

  const locations = db.prepare(query).all(...params);

  const withDistance = locations.map(loc => {
    const dist = haversineDistance(userLat, userLng, loc.lat, loc.lng);
    return {
      ...loc,
      distanceKm: parseFloat(dist.toFixed(2)),
      distanceMiles: parseFloat((dist * 0.621371).toFixed(2))
    };
  });

  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
  return withDistance.slice(0, limit);
}

module.exports = {
  db,
  initDatabase,
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
};

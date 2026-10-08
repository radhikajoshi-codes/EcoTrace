/**
 * EcoTrace Sorting Session State Machine
 * 
 * Implements the 10-state physical sorting lifecycle:
 * IDLE -> SCANNING -> ITEMS_DETECTED -> SORTING_STARTED ->
 * ITEM_SELECTED -> REMOVAL_REQUESTED -> VERIFICATION ->
 * VERIFIED / FAILED -> NEXT_ITEM -> COMPLETED
 */

const { db } = require('./db');
const { detectionProvider } = require('./detectionService');
const { evaluateRouting } = require('./rulesEngine');

const SESSION_STATES = {
  IDLE: 'IDLE',
  SCANNING: 'SCANNING',
  ITEMS_DETECTED: 'ITEMS_DETECTED',
  SORTING_STARTED: 'SORTING_STARTED',
  ITEM_SELECTED: 'ITEM_SELECTED',
  REMOVAL_REQUESTED: 'REMOVAL_REQUESTED',
  VERIFICATION: 'VERIFICATION',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  NEXT_ITEM: 'NEXT_ITEM',
  COMPLETED: 'COMPLETED'
};

class SortingSessionManager {
  constructor() {
    this.activeSession = null;
  }

  logEvent(sessionId, itemId, eventType, metadata = {}) {
    const eventId = `EVT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO sorting_events (id, sessionId, itemId, eventType, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(eventId, sessionId, itemId, eventType, now, JSON.stringify(metadata));
    } catch (e) {
      console.error('Error logging event:', e);
    }
  }

  startSession(stationId = 'ST-01', mode = 'DEMO') {
    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(stationId);
    if (!station) {
      throw new Error(`Station not found: ${stationId}`);
    }

    const sessionId = `SES-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sorting_sessions (id, stationId, startedAt, status, itemCount, verifiedCount, failedCount, manualOverrideCount, mode)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?)
    `).run(sessionId, stationId, now, SESSION_STATES.IDLE, mode);

    this.activeSession = {
      id: sessionId,
      stationId,
      stationName: station.name,
      ruleset: station.ruleset,
      state: SESSION_STATES.IDLE,
      mode,
      startedAt: now,
      completedAt: null,
      detectedItems: [],
      remainingTrayItems: [],
      currentIndex: -1,
      currentItem: null,
      verifiedCount: 0,
      failedCount: 0,
      manualOverrideCount: 0,
      history: []
    };

    this.logEvent(sessionId, null, 'SESSION_INITIALIZED', { stationId, mode });
    return this.activeSession;
  }

  async scanTray(input = null) {
    if (!this.activeSession) {
      throw new Error('No active sorting session. Start a session first.');
    }

    let remainingItemIds = null;
    let imageBase64 = null;
    let filename = null;
    let scannedItem = null;

    if (Array.isArray(input)) {
      remainingItemIds = input;
    } else if (input && typeof input === 'object') {
      remainingItemIds = input.remainingItemIds || null;
      imageBase64 = input.imageBase64 || null;
      filename = input.filename || null;
      scannedItem = input.scannedItem || null;
    }

    this.activeSession.state = SESSION_STATES.SCANNING;
    this.logEvent(this.activeSession.id, null, 'SCANNING', { timestamp: new Date().toISOString() });

    // Detect objects using DetectionProvider
    const rawObjects = await detectionProvider.detect({
      remainingIds: remainingItemIds,
      customItems: this.activeSession.detectedItems,
      imageBase64,
      filename,
      scannedItem
    });

    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(this.activeSession.stationId);

    // Apply Location-Aware Rules Engine to each detected item
    const items = rawObjects.map((obj, idx) => {
      const routingResult = evaluateRouting(obj, station);
      const itemId = `WST-2026-${String(4300 + idx + Math.floor(Math.random() * 50)).padStart(6, '0')}`;
      return {
        ...obj,
        wasteItemId: itemId,
        route: routingResult.route,
        reviewRequired: routingResult.reviewRequired,
        instruction: routingResult.instruction,
        warning: routingResult.warning,
        status: 'PENDING'
      };
    });

    this.activeSession.detectedItems = items;
    this.activeSession.remainingTrayItems = [...items];
    this.activeSession.itemCount = items.length;
    this.activeSession.state = SESSION_STATES.ITEMS_DETECTED;

    db.prepare(`
      UPDATE sorting_sessions 
      SET status = ?, itemCount = ?
      WHERE id = ?
    `).run(SESSION_STATES.ITEMS_DETECTED, items.length, this.activeSession.id);

    // Log DETECTED and ROUTE_ASSIGNED events
    for (const item of items) {
      this.logEvent(this.activeSession.id, item.wasteItemId, 'DETECTED', {
        label: item.label,
        material: item.material,
        confidence: item.confidence,
        bbox: item.bbox
      });
      this.logEvent(this.activeSession.id, item.wasteItemId, 'ROUTE_ASSIGNED', {
        route: item.route,
        ruleset: this.activeSession.ruleset
      });
    }

    return this.activeSession;
  }

  loadScannedItem(scannedItem, stationId = 'ST-01') {
    let validStationId = stationId;
    const stationCheck = db.prepare('SELECT id FROM stations WHERE id = ?').get(validStationId);
    if (!stationCheck) {
      const fallbackStation = db.prepare('SELECT id FROM stations LIMIT 1').get();
      validStationId = fallbackStation ? fallbackStation.id : 'ST-01';
    }

    if (!this.activeSession || this.activeSession.stationId !== validStationId) {
      this.startSession(validStationId, 'PHOTO');
    }

    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(this.activeSession.stationId) ||
                    db.prepare('SELECT * FROM stations LIMIT 1').get();

    const isSpecial = scannedItem.category === 'E-Waste' || scannedItem.category === 'Hazardous Waste';
    const isContaminated = scannedItem.category === 'Hazardous Waste' || (scannedItem.recommendation && scannedItem.recommendation.toLowerCase().includes('rinse'));

    const rawObj = {
      id: 'OBJ-SCN-001',
      label: scannedItem.wasteType || 'Scanned Waste Item',
      material: scannedItem.category || 'Plastic',
      condition: scannedItem.recyclable ? 'Recyclable' : (isSpecial ? 'Special Handling' : 'Contaminated'),
      confidence: scannedItem.confidence || 0.948,
      contamination: isContaminated ? 'Low' : 'None',
      contaminationIssue: isContaminated ? 'Residue wash check required' : null,
      specialHandling: isSpecial ? 1 : 0,
      bbox: { x: 22, y: 16, width: 56, height: 68 },
      category: (scannedItem.category || 'PLASTIC').toUpperCase(),
      imageUrl: scannedItem.imageUrl || null,
      disposalMethod: scannedItem.disposalMethod,
      recommendation: scannedItem.recommendation,
      icon: 'custom'
    };

    const routingResult = evaluateRouting(rawObj, station);
    const itemId = `WST-2026-${String(4300 + Math.floor(Math.random() * 50)).padStart(6, '0')}`;
    const item = {
      ...rawObj,
      wasteItemId: itemId,
      route: routingResult.route,
      reviewRequired: routingResult.reviewRequired,
      instruction: routingResult.instruction,
      warning: routingResult.warning,
      status: 'PENDING'
    };

    this.activeSession.detectedItems = [item];
    this.activeSession.remainingTrayItems = [item];
    this.activeSession.itemCount = 1;
    this.activeSession.state = SESSION_STATES.ITEMS_DETECTED;
    this.activeSession.currentIndex = 0;
    this.activeSession.currentItem = item;

    db.prepare(`
      UPDATE sorting_sessions 
      SET status = ?, itemCount = ?
      WHERE id = ?
    `).run(SESSION_STATES.ITEMS_DETECTED, 1, this.activeSession.id);

    this.logEvent(this.activeSession.id, item.wasteItemId, 'DETECTED', {
      label: item.label,
      material: item.material,
      confidence: item.confidence,
      bbox: item.bbox
    });

    return this.activeSession;
  }


  startSortingQueue() {
    if (!this.activeSession || this.activeSession.detectedItems.length === 0) {
      throw new Error('No items detected to sort.');
    }

    this.activeSession.state = SESSION_STATES.SORTING_STARTED;
    this.logEvent(this.activeSession.id, null, 'SORTING_STARTED', {});

    // Select the first item in the queue
    return this.selectItemByIndex(0);
  }

  selectItemByIndex(index) {
    if (!this.activeSession) throw new Error('No active session');
    if (index < 0 || index >= this.activeSession.detectedItems.length) {
      throw new Error('Invalid item index');
    }

    this.activeSession.currentIndex = index;
    this.activeSession.currentItem = this.activeSession.detectedItems[index];
    this.activeSession.state = SESSION_STATES.ITEM_SELECTED;

    this.logEvent(this.activeSession.id, this.activeSession.currentItem.wasteItemId, 'ITEM_SELECTED', {
      index,
      label: this.activeSession.currentItem.label
    });

    return this.activeSession;
  }

  requestRemoval() {
    if (!this.activeSession || !this.activeSession.currentItem) {
      throw new Error('No item currently selected');
    }

    this.activeSession.state = SESSION_STATES.REMOVAL_REQUESTED;
    this.logEvent(this.activeSession.id, this.activeSession.currentItem.wasteItemId, 'REMOVAL_REQUESTED', {
      instruction: this.activeSession.currentItem.instruction
    });

    return this.activeSession;
  }

  /**
   * PHYSICAL SORTING VERIFICATION
   * Operator presses "ITEM REMOVED"
   * System rescans tray, compares BEFORE vs AFTER
   */
  async verifyItemRemoval(simulateFailure = false) {
    if (!this.activeSession || !this.activeSession.currentItem) {
      throw new Error('No item selected for verification');
    }

    const currentItem = this.activeSession.currentItem;
    this.activeSession.state = SESSION_STATES.VERIFICATION;
    this.logEvent(this.activeSession.id, currentItem.wasteItemId, 'VERIFICATION_STARTED', {
      targetId: currentItem.id,
      label: currentItem.label
    });

    // Before tray state
    const beforeTray = [...this.activeSession.remainingTrayItems];

    // Compute expected after tray (target item removed if verified)
    let afterTray;
    if (simulateFailure) {
      afterTray = [...beforeTray]; // target item still present!
    } else {
      afterTray = beforeTray.filter(item => item.id !== currentItem.id);
    }

    // Call optical verification comparator
    const verificationResult = await detectionProvider.verifyRemoval(
      beforeTray,
      afterTray,
      currentItem.id,
      simulateFailure
    );

    if (verificationResult.verified) {
      // Physical removal confirmed
      this.activeSession.remainingTrayItems = afterTray;
      currentItem.status = 'VERIFIED';
      currentItem.verifiedAt = new Date().toISOString();
      this.activeSession.verifiedCount += 1;
      this.activeSession.state = SESSION_STATES.VERIFIED;

      this.logEvent(this.activeSession.id, currentItem.wasteItemId, 'VERIFIED', {
        beforeCount: verificationResult.beforeCount,
        afterCount: verificationResult.afterCount,
        route: currentItem.route
      });

      // Save persistent waste record into SQLite
      this.persistWasteItem(currentItem, 'VERIFIED');

      return {
        success: true,
        session: this.activeSession,
        verification: {
          status: 'VERIFIED',
          title: '✓ ITEM REMOVED',
          label: currentItem.label,
          material: currentItem.material,
          source: `Sorting Tray (${this.activeSession.stationName})`,
          destination: currentItem.route,
          verified: true,
          message: verificationResult.message
        }
      };
    } else {
      // Physical removal failed / target still present
      this.activeSession.failedCount += 1;
      this.activeSession.state = SESSION_STATES.FAILED;

      this.logEvent(this.activeSession.id, currentItem.wasteItemId, 'VERIFICATION_FAILED', {
        reason: verificationResult.reason,
        message: verificationResult.message
      });

      return {
        success: false,
        session: this.activeSession,
        verification: {
          status: 'FAILED',
          title: 'SORT NOT VERIFIED',
          label: currentItem.label,
          material: currentItem.material,
          source: `Sorting Tray (${this.activeSession.stationName})`,
          destination: currentItem.route,
          verified: false,
          message: verificationResult.message
        }
      };
    }
  }

  manualOverride(correctedRoute, reason = 'Operator visual confirmation') {
    if (!this.activeSession || !this.activeSession.currentItem) {
      throw new Error('No item selected');
    }

    const currentItem = this.activeSession.currentItem;
    const originalRoute = currentItem.route;
    currentItem.route = correctedRoute || currentItem.route;
    currentItem.status = 'MANUAL_OVERRIDE';
    currentItem.operatorNote = reason;
    currentItem.verifiedAt = new Date().toISOString();

    // Remove from tray since operator physically handled it
    this.activeSession.remainingTrayItems = this.activeSession.remainingTrayItems.filter(i => i.id !== currentItem.id);
    this.activeSession.manualOverrideCount += 1;
    this.activeSession.state = SESSION_STATES.VERIFIED;

    this.logEvent(this.activeSession.id, currentItem.wasteItemId, 'MANUAL_OVERRIDE', {
      originalRoute,
      correctedRoute: currentItem.route,
      reason,
      operator: 'Station Operator #42'
    });

    this.persistWasteItem(currentItem, 'MANUAL_OVERRIDE', reason);

    return {
      success: true,
      session: this.activeSession,
      item: currentItem
    };
  }

  flagItem(reason = 'Contamination / Anomaly') {
    if (!this.activeSession || !this.activeSession.currentItem) {
      throw new Error('No item selected');
    }

    const currentItem = this.activeSession.currentItem;
    currentItem.status = 'FLAGGED';
    currentItem.operatorNote = reason;

    this.logEvent(this.activeSession.id, currentItem.wasteItemId, 'ITEM_FLAGGED', {
      reason
    });

    return { success: true, session: this.activeSession, item: currentItem };
  }

  resolveUnknown(selectedMaterial, assignedRoute) {
    if (!this.activeSession || !this.activeSession.currentItem) {
      throw new Error('No item selected');
    }

    const currentItem = this.activeSession.currentItem;
    currentItem.material = selectedMaterial;
    currentItem.route = assignedRoute;
    currentItem.confidence = 1.0;
    currentItem.reviewRequired = false;

    this.logEvent(this.activeSession.id, currentItem.wasteItemId, 'UNKNOWN_RESOLVED', {
      selectedMaterial,
      assignedRoute
    });

    return { success: true, session: this.activeSession, item: currentItem };
  }

  advanceToNextItem() {
    if (!this.activeSession) throw new Error('No active session');

    const nextIndex = this.activeSession.currentIndex + 1;
    if (nextIndex < this.activeSession.detectedItems.length) {
      return this.selectItemByIndex(nextIndex);
    } else {
      return this.completeSession();
    }
  }

  completeSession() {
    if (!this.activeSession) throw new Error('No active session');

    this.activeSession.state = SESSION_STATES.COMPLETED;
    this.activeSession.completedAt = new Date().toISOString();

    // Update session table in SQLite
    db.prepare(`
      UPDATE sorting_sessions
      SET status = ?, completedAt = ?, verifiedCount = ?, failedCount = ?, manualOverrideCount = ?
      WHERE id = ?
    `).run(
      SESSION_STATES.COMPLETED,
      this.activeSession.completedAt,
      this.activeSession.verifiedCount,
      this.activeSession.failedCount,
      this.activeSession.manualOverrideCount,
      this.activeSession.id
    );

    // Update station today's metrics
    db.prepare(`
      UPDATE stations
      SET itemsToday = itemsToday + ?,
          lastActivity = 'Just now'
      WHERE id = ?
    `).run(this.activeSession.verifiedCount, this.activeSession.stationId);

    this.logEvent(this.activeSession.id, null, 'SESSION_COMPLETED', {
      verifiedCount: this.activeSession.verifiedCount,
      totalCount: this.activeSession.itemCount,
      manualOverrides: this.activeSession.manualOverrideCount
    });

    // Check if high contamination or special items trigger an alert
    const hasBattery = this.activeSession.detectedItems.some(i => i.specialHandling === 1);
    if (hasBattery) {
      const alertId = `ALT-${Date.now().toString().slice(-4)}`;
      db.prepare(`
        INSERT INTO alerts (id, stationId, severity, title, description, location, timestamp, read)
        VALUES (?, ?, 'WARNING', 'Special-handling battery safely segregated', ?, ?, 'Just now', 0)
      `).run(
        alertId,
        this.activeSession.stationId,
        `Session ${this.activeSession.id} isolated hazardous lithium/alkaline cell into certified bin.`,
        this.activeSession.stationName
      );
    }

    return this.activeSession;
  }

  persistWasteItem(item, finalStatus, note = null) {
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT OR REPLACE INTO waste_items (
          id, sessionId, stationId, label, material, condition, confidence,
          route, specialHandling, contamination, contaminationIssue, status, operatorNote, detectedAt, verifiedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.wasteItemId,
        this.activeSession.id,
        this.activeSession.stationId,
        item.label,
        item.material,
        item.condition,
        item.confidence,
        item.route,
        item.specialHandling ? 1 : 0,
        item.contamination || 'None',
        item.contaminationIssue || null,
        finalStatus,
        note || item.operatorNote || null,
        now,
        now
      );
    } catch (e) {
      console.error('Error persisting waste item:', e);
    }
  }

  getActiveSession() {
    return this.activeSession;
  }
}

const sessionManager = new SortingSessionManager();

module.exports = {
  SESSION_STATES,
  SortingSessionManager,
  sessionManager
};

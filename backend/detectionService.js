/**
 * EcoTrace Computer Vision & Detection Service
 * 
 * Provides an extensible DetectionProvider abstraction.
 * Includes DemoDetectionProvider with deterministic multi-object tray coordinates,
 * real uploaded/captured photo classification, bounding boxes, confidence scoring,
 * condition assessment, and physical verification comparison logic.
 */

class DetectionProvider {
  async detect(input) {
    throw new Error('detect() must be implemented by provider');
  }

  async verifyRemoval(beforeItems, afterItems, targetItemId) {
    throw new Error('verifyRemoval() must be implemented by provider');
  }
}

/**
 * Standard 6-Object Controlled Demo Tray for benchmark comparisons
 */
const CANONICAL_DEMO_OBJECTS = [
  {
    id: 'OBJ-001',
    label: 'PET Bottle',
    material: 'PET Plastic',
    condition: 'Recyclable',
    confidence: 0.962,
    contamination: 'None',
    contaminationIssue: null,
    specialHandling: 0,
    bbox: { x: 14, y: 18, width: 22, height: 38 },
    category: 'PLASTIC',
    icon: 'bottle'
  },
  {
    id: 'OBJ-002',
    label: 'Aluminium Can',
    material: 'Aluminium',
    condition: 'Recyclable',
    confidence: 0.985,
    contamination: 'None',
    contaminationIssue: null,
    specialHandling: 0,
    bbox: { x: 42, y: 15, width: 18, height: 30 },
    category: 'METAL',
    icon: 'can'
  },
  {
    id: 'OBJ-003',
    label: 'Banana Peel',
    material: 'Organic',
    condition: 'Compostable',
    confidence: 0.943,
    contamination: 'None',
    contaminationIssue: null,
    specialHandling: 0,
    bbox: { x: 68, y: 22, width: 24, height: 28 },
    category: 'ORGANIC',
    icon: 'banana'
  },
  {
    id: 'OBJ-004',
    label: 'Paper Cup',
    material: 'Paper',
    condition: 'Recyclable',
    confidence: 0.898,
    contamination: 'None',
    contaminationIssue: null,
    specialHandling: 0,
    bbox: { x: 16, y: 62, width: 19, height: 26 },
    category: 'PAPER',
    icon: 'cup'
  },
  {
    id: 'OBJ-005',
    label: 'Household Battery',
    material: 'Household Battery',
    condition: 'Special Handling',
    confidence: 0.989,
    contamination: 'None',
    contaminationIssue: null,
    specialHandling: 1,
    bbox: { x: 45, y: 60, width: 14, height: 25 },
    category: 'SPECIAL HANDLING',
    icon: 'battery'
  },
  {
    id: 'OBJ-006',
    label: 'Food Container',
    material: 'Plastic Container',
    condition: 'Contaminated',
    confidence: 0.915,
    contamination: 'Medium',
    contaminationIssue: 'Food grease residue detected',
    specialHandling: 0,
    bbox: { x: 68, y: 56, width: 25, height: 32 },
    category: 'PLASTIC',
    icon: 'container'
  }
];

class DemoDetectionProvider extends DetectionProvider {
  constructor() {
    super();
  }

  /**
   * Scans the sorting tray. Supports:
   * 1. Scanned item from AI Waste Scanner
   * 2. Direct photo / webcam imageBase64 capture
   * 3. Controlled benchmark tray (6 items)
   */
  async detect(input = {}) {
    // If specific item IDs were provided as remaining on tray:
    if (input.remainingIds && Array.isArray(input.remainingIds)) {
      if (input.customItems && input.customItems.length) {
        return input.customItems.filter(item => input.remainingIds.includes(item.id));
      }
      return CANONICAL_DEMO_OBJECTS.filter(item => input.remainingIds.includes(item.id));
    }

    // Scenario A: Scanned item transferred from AI Waste Scanner
    if (input.scannedItem) {
      const s = input.scannedItem;
      const isSpecial = s.category === 'E-Waste' || s.category === 'Hazardous Waste';
      const isContaminated = s.category === 'Hazardous Waste' || (s.recommendation && s.recommendation.toLowerCase().includes('rinse'));

      return [{
        id: 'OBJ-SCN-001',
        label: s.wasteType || 'Scanned Waste Item',
        material: s.category || 'Plastic',
        condition: s.recyclable ? 'Recyclable' : (isSpecial ? 'Special Handling' : 'Contaminated'),
        confidence: s.confidence || 0.948,
        contamination: isContaminated ? 'Low' : 'None',
        contaminationIssue: isContaminated ? 'Residue wash check required' : null,
        specialHandling: isSpecial ? 1 : 0,
        bbox: { x: 22, y: 16, width: 56, height: 68 },
        category: (s.category || 'PLASTIC').toUpperCase(),
        imageUrl: s.imageUrl || null,
        disposalMethod: s.disposalMethod,
        recommendation: s.recommendation,
        icon: 'custom'
      }];
    }

    // Scenario B: Real webcam frame or uploaded photo
    if (input.imageBase64) {
      const { scannerService } = require('./scannerService');
      const scan = await scannerService.analyzeWaste({
        imageBase64: input.imageBase64,
        filename: input.filename,
        location: input.location
      });

      const isSpecial = scan.category === 'E-Waste' || scan.category === 'Hazardous Waste';
      return [{
        id: 'OBJ-CAM-001',
        label: scan.wasteType || 'Captured Waste Item',
        material: scan.category || 'Plastic',
        condition: scan.recyclable ? 'Recyclable' : (isSpecial ? 'Special Handling' : 'Contaminated'),
        confidence: scan.confidence || 0.935,
        contamination: scan.category === 'Hazardous Waste' ? 'High' : 'None',
        contaminationIssue: null,
        specialHandling: isSpecial ? 1 : 0,
        bbox: { x: 20, y: 15, width: 60, height: 70 },
        category: (scan.category || 'PLASTIC').toUpperCase(),
        imageUrl: input.imageBase64,
        disposalMethod: scan.disposalMethod,
        recommendation: scan.recommendation,
        icon: 'custom'
      }];
    }

    // Scenario C: Canonical benchmark objects
    return JSON.parse(JSON.stringify(CANONICAL_DEMO_OBJECTS));
  }

  /**
   * Physical Verification:
   * Compares the tray state before removal vs after removal.
   */
  async verifyRemoval(beforeItems, afterItems, targetItemId, simulateFailure = false) {
    if (simulateFailure) {
      return {
        verified: false,
        reason: 'OBJECT_STILL_PRESENT',
        message: 'The selected item still appears to be on the sorting tray.',
        beforeCount: beforeItems.length,
        afterCount: afterItems.length,
        targetItemId
      };
    }

    const wasPresentBefore = beforeItems.some(i => i.id === targetItemId);
    const isPresentAfter = afterItems.some(i => i.id === targetItemId);

    if (wasPresentBefore && !isPresentAfter) {
      return {
        verified: true,
        reason: 'ITEM_REMOVED_SUCCESSFULLY',
        message: 'Physical removal confirmed by optical tray comparison.',
        beforeCount: beforeItems.length,
        afterCount: afterItems.length,
        targetItemId
      };
    }

    return {
      verified: false,
      reason: 'VERIFICATION_MISMATCH',
      message: 'Visual tray scan could not confirm removal of target item.',
      beforeCount: beforeItems.length,
      afterCount: afterItems.length,
      targetItemId
    };
  }
}

// Singleton detection service instance
const detectionProvider = new DemoDetectionProvider();

module.exports = {
  DetectionProvider,
  DemoDetectionProvider,
  detectionProvider,
  CANONICAL_DEMO_OBJECTS
};

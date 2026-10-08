/**
 * EcoTrace Location-Aware Routing Engine
 * 
 * Determines routing destination, special handling protocol,
 * and physical operator instructions based on:
 * - Station configuration & facility ruleset (standard_urban, high_recovery, industrial)
 * - Material classification
 * - Physical condition (clean, contaminated, damaged)
 * - Contamination level & type
 * - Special handling / Hazardous flagging
 */

const CONFIDENCE_THRESHOLD = 0.70;

function evaluateRouting(item, station) {
  const ruleset = station ? station.ruleset : 'standard_urban';
  const confidence = item.confidence || 0.95;

  // 1. Confidence Evaluation
  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      route: 'Manual Inspection Bay / Pending Review',
      reviewRequired: true,
      specialHandling: false,
      instruction: 'ATTENTION: Low confidence classification (<70%). Verify item visually or select category manually.',
      warning: 'Item confidence below threshold. Operator review required.'
    };
  }

  // 2. Special Handling (E-Waste / Household Batteries)
  if (item.specialHandling || item.material === 'Household Battery' || item.label.toLowerCase().includes('battery')) {
    return {
      route: 'Authorized E-Waste Collection',
      reviewRequired: false,
      specialHandling: true,
      instruction: 'DO NOT PLACE IN GENERAL WASTE OR RECYCLING STREAM. Deposit into fire-safe, insulated collection terminal Bin E.',
      warning: 'E-WASTE / SPECIAL HANDLING ALERT: Contains reactive chemical cells. Segregate immediately.'
    };
  }

  // 3. Organics / Compostable
  if (item.material === 'Organic' || item.label.toLowerCase().includes('banana') || item.label.toLowerCase().includes('apple')) {
    return {
      route: 'Wet / Organic Compost',
      reviewRequired: false,
      specialHandling: false,
      instruction: 'Divert to aerated organic processing line Bin C. Keep separated from synthetic plastics.',
      warning: null
    };
  }

  // 4. Metals (Aluminium cans, non-ferrous)
  if (item.material === 'Aluminium' || item.material === 'Metal' || item.label.toLowerCase().includes('can')) {
    return {
      route: 'Dry / Metal Recovery',
      reviewRequired: false,
      specialHandling: false,
      instruction: 'Compress and place into non-ferrous recovery stream Bin B.',
      warning: null
    };
  }

  // 5. Paper / Fiber
  if (item.material === 'Paper' || item.material === 'Cardboard' || item.label.toLowerCase().includes('paper cup')) {
    if (item.contamination && item.contamination !== 'None') {
      return {
        route: 'Residual Waste (Soiled Fiber)',
        reviewRequired: false,
        specialHandling: false,
        instruction: 'Liquid/wax soiled paper cannot be processed in clean fiber mill. Route to Residual Waste.',
        warning: 'Soiled fiber detected.'
      };
    }
    return {
      route: 'Dry / Fiber & Cardboard',
      reviewRequired: false,
      specialHandling: false,
      instruction: 'Check for moisture; deposit into Clean Paper & Cardboard stream Bin D.',
      warning: null
    };
  }

  // 6. Plastics (PET bottles, food containers)
  if (item.material.includes('Plastic') || item.material.includes('PET')) {
    // Check contamination level and station ruleset
    if (item.contamination === 'High' || item.contamination === 'Medium') {
      if (ruleset === 'high_recovery') {
        // High recovery stations have an automated hot-wash facility!
        return {
          route: 'High-Recovery EcoWash Line',
          reviewRequired: false,
          specialHandling: false,
          instruction: 'Food residue detected. Station equipped with eco-wash: Route to Stage-2 Wash Basin.',
          warning: 'Contaminated plastic routed to local EcoWash.'
        };
      } else if (ruleset === 'industrial') {
        return {
          route: 'Industrial Refuse-Derived Fuel (RDF)',
          reviewRequired: false,
          specialHandling: false,
          instruction: 'Contaminated rigid polymer: Route to secondary thermal energy recovery feed.',
          warning: 'Contaminated plastic diverted from clean recycling.'
        };
      } else {
        // Standard urban ruleset
        return {
          route: 'Residual Waste / Wash Facility',
          reviewRequired: false,
          specialHandling: false,
          instruction: 'Food residue detected. Standard line lacks on-site washer. Place in Secondary Residual Bin.',
          warning: 'Food grease residue detected. Re-routed according to standard urban ruleset.'
        };
      }
    }

    // Clean Plastic
    return {
      route: 'Dry / Recyclable Waste',
      reviewRequired: false,
      specialHandling: false,
      instruction: 'Clean polymer verified. Place in Rigid Plastics Bin A.',
      warning: null
    };
  }

  // Default fallback
  return {
    route: 'General Sorting Stream',
    reviewRequired: false,
    specialHandling: false,
    instruction: 'Place in designated general sorting stream.',
    warning: null
  };
}

module.exports = {
  evaluateRouting,
  CONFIDENCE_THRESHOLD
};

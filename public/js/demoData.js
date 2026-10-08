/**
 * EcoTrace Centralized Demo Data Configuration
 * Single source of truth for all dashboard metrics, Indore facilities, and stations.
 * Modify values here to update the entire application.
 */
const DEMO_DATA = {
  // Primary Dashboard Metrics
  metrics: {
    itemsProcessed: '1,284',
    sortingAccuracy: '94.6%',
    recoveredMaterial: '842 kg',
    aiWasteScans: '56',
    activeFacilities: 12,
    recyclableDiverted: '78%',
    collectionEfficiency: '91%',
    wasteSortedToday: '326 kg',
    activeAlerts: 3,
    contaminationRate: '5.4%',
    specialHandlingCount: '48',
    monitoringNodes: '1,284 / 1,290'
  },

  // Default Map & Geographic Center (AITR Indore)
  defaultLocation: {
    name: 'AITR, Indore',
    collegeName: 'Acropolis Institute of Technology and Research (AITR)',
    fullAddress: 'Bypass Road, Square, Manglaya Sadak, Indore, Madhya Pradesh 453771, India',
    lat: 22.724,
    lng: 75.874,
    zoom: 13,
    displayLabel: 'AITR, Indore'
  },

  // Realistic Indore Waste Facilities
  facilities: [
    {
      id: 'FAC-IN-01',
      name: 'AITR Waste Collection Point',
      type: 'waste_collection',
      status: 'Operational',
      riskLevel: 'Low',
      lastUpdated: 'Just now',
      wasteCollected: '142 kg',
      capacity: 42,
      available: 1,
      acceptedTypes: 'Plastic Bottles, Paper/Cardboard, Glass, Organic Food Scraps, Campus E-Waste',
      address: 'Acropolis Institute Campus, Bypass Road, Manglaya Sadak, Indore',
      lat: 22.7240,
      lng: 75.8740,
      phone: '+91 731 473 0000',
      operatingHours: 'Daily: 7:00 AM - 8:00 PM',
      distance: 0.1,
      distanceText: '0.1 km away'
    },
    {
      id: 'FAC-IN-02',
      name: 'Mangliya Recycling Center',
      type: 'recycling',
      status: 'Operational',
      riskLevel: 'Low',
      lastUpdated: '12 min ago',
      wasteCollected: '640 kg',
      capacity: 72,
      available: 1,
      acceptedTypes: 'PET Plastic, HDPE Polymers, Corrugated Boxes, Aluminium Scrap',
      address: 'AB Road, Mangliya Industrial Cluster, Indore',
      lat: 22.7480,
      lng: 75.8920,
      phone: '+91 731 280 2144',
      operatingHours: 'Mon-Sat: 8:00 AM - 7:00 PM',
      distance: 3.2,
      distanceText: '3.2 km away'
    },
    {
      id: 'FAC-IN-03',
      name: 'Vijay Nagar Collection Hub',
      type: 'waste_collection',
      status: 'Operational',
      riskLevel: 'Low',
      lastUpdated: '8 min ago',
      wasteCollected: '520 kg',
      capacity: 68,
      available: 1,
      acceptedTypes: 'Dry Municipal Waste, Multilayer Packaging, Cardboard, Beverage Cans',
      address: 'Scheme No. 54, Near Velocity III Mirage, Vijay Nagar, Indore',
      lat: 22.7533,
      lng: 75.8937,
      phone: '+91 731 257 8899',
      operatingHours: '24/7 Smart Automated Bins',
      distance: 3.8,
      distanceText: '3.8 km away'
    },
    {
      id: 'FAC-IN-04',
      name: 'Palasia E-Waste Point',
      type: 'e_waste',
      status: 'Active',
      riskLevel: 'Low',
      lastUpdated: '25 min ago',
      wasteCollected: '185 kg',
      capacity: 54,
      available: 1,
      acceptedTypes: 'Lithium Cells, Laptop Batteries, Circuit Boards, Mobile Devices, Peripherals',
      address: 'Industry House Square, Old Palasia, A.B. Road, Indore',
      lat: 22.7206,
      lng: 75.8824,
      phone: '+91 731 249 1102',
      operatingHours: 'Mon-Sat: 9:00 AM - 6:00 PM',
      distance: 4.5,
      distanceText: '4.5 km away'
    },
    {
      id: 'FAC-IN-05',
      name: 'Bhanwarkuan Collection Center',
      type: 'waste_collection',
      status: 'Operational',
      riskLevel: 'Low',
      lastUpdated: '18 min ago',
      wasteCollected: '390 kg',
      capacity: 60,
      available: 1,
      acceptedTypes: 'Paper, Notebooks, Food Containers, Organic Wet Waste',
      address: 'Bhanwarkuan Main Road, Near Holkar Science College, Indore',
      lat: 22.6892,
      lng: 75.8647,
      phone: '+91 731 246 5530',
      operatingHours: 'Daily: 6:30 AM - 9:00 PM',
      distance: 5.6,
      distanceText: '5.6 km away'
    },
    {
      id: 'FAC-IN-06',
      name: 'Rau Waste Processing Facility',
      type: 'high_risk',
      status: 'Operational',
      riskLevel: 'Moderate',
      lastUpdated: '15 min ago',
      wasteCollected: '880 kg',
      capacity: 82,
      available: 1,
      acceptedTypes: 'Industrial Chemical Canisters, Paint Residue, Solvent Containers, Composite RDF',
      address: 'Pithampur Link Road, Industrial Area, Rau, Indore',
      lat: 22.6284,
      lng: 75.8115,
      phone: '+91 731 285 6700',
      operatingHours: 'Monitored Industrial Hazmat Depository',
      distance: 12.4,
      distanceText: '12.4 km away'
    },
    {
      id: 'FAC-IN-07',
      name: 'Devguradia Bio-CNG & Composting Terminal',
      type: 'waste_collection',
      status: 'Operational',
      riskLevel: 'Low',
      lastUpdated: '10 min ago',
      wasteCollected: '1,240 kg',
      capacity: 76,
      available: 1,
      acceptedTypes: 'Organic Wet Waste, Vegetable Scraps, Market Greens, Kitchen Solids',
      address: 'Devguradia Trenching Ground Road, Nemawar Road, Indore',
      lat: 22.6780,
      lng: 75.9250,
      phone: '+91 731 270 4422',
      operatingHours: 'Daily: 6:00 AM - 10:00 PM',
      distance: 7.2,
      distanceText: '7.2 km away'
    },
    {
      id: 'FAC-IN-08',
      name: 'Sanwer Road Industrial Recovery Terminal',
      type: 'recycling',
      status: 'Active',
      riskLevel: 'Low',
      lastUpdated: '32 min ago',
      wasteCollected: '710 kg',
      capacity: 65,
      available: 1,
      acceptedTypes: 'Non-Ferrous Metals, Rigid Polypropylene, Packaging Drums',
      address: 'Sector F, Sanwer Road Industrial Area, Indore',
      lat: 22.7820,
      lng: 75.8520,
      phone: '+91 731 272 1980',
      operatingHours: 'Mon-Sat: 7:00 AM - 7:00 PM',
      distance: 6.8,
      distanceText: '6.8 km away'
    },
    {
      id: 'FAC-IN-09',
      name: 'Annapurna Road Recycling Depot',
      type: 'recycling',
      status: 'Operational',
      riskLevel: 'Low',
      lastUpdated: '20 min ago',
      wasteCollected: '480 kg',
      capacity: 58,
      available: 1,
      acceptedTypes: 'Newspapers, Shredded Paper, Glass Containers, Milk Pouches',
      address: 'Near Annapurna Temple, Annapurna Road, Indore',
      lat: 22.6980,
      lng: 75.8340,
      phone: '+91 731 278 3344',
      operatingHours: 'Daily: 8:00 AM - 8:00 PM',
      distance: 5.1,
      distanceText: '5.1 km away'
    },
    {
      id: 'FAC-IN-10',
      name: 'Sukhlia Smart Collection Hub',
      type: 'waste_collection',
      status: 'Operational',
      riskLevel: 'Low',
      lastUpdated: '14 min ago',
      wasteCollected: '310 kg',
      capacity: 48,
      available: 1,
      acceptedTypes: 'Mixed Dry Packaging, Tin Containers, Rigid Plastic Crates',
      address: 'MR-10 Junction, Sukhlia Main Road, Indore',
      lat: 22.7580,
      lng: 75.8650,
      phone: '+91 731 255 1200',
      operatingHours: '24/7 Smart Automated Bins',
      distance: 3.9,
      distanceText: '3.9 km away'
    },
    {
      id: 'FAC-IN-11',
      name: 'Pithampur Industrial Hazmat Terminal',
      type: 'high_risk',
      status: 'Active',
      riskLevel: 'High',
      lastUpdated: '40 min ago',
      wasteCollected: '1,120 kg',
      capacity: 88,
      available: 1,
      acceptedTypes: 'Automotive Lubricant Barrels, Chemical Liners, Toxic Ash',
      address: 'Sector 3, Pithampur Industrial Corridor, Near Indore',
      lat: 22.6050,
      lng: 75.6820,
      phone: '+91 729 240 5500',
      operatingHours: 'Monitored Hazardous Depository',
      distance: 18.2,
      distanceText: '18.2 km away'
    },
    {
      id: 'FAC-IN-12',
      name: 'Rajwada Heritage Zone Clean Stream Center',
      type: 'waste_collection',
      status: 'Operational',
      riskLevel: 'Low',
      lastUpdated: '5 min ago',
      wasteCollected: '560 kg',
      capacity: 62,
      available: 1,
      acceptedTypes: 'Food Grade Packaging, Compostable Leaf Plates, Beverage Cans',
      address: 'MG Road, Heritage Corridor, Rajwada, Indore',
      lat: 22.7196,
      lng: 75.8577,
      phone: '+91 731 253 4411',
      operatingHours: 'Daily: 6:00 AM - 11:00 PM',
      distance: 4.8,
      distanceText: '4.8 km away'
    }
  ],

  // Sorting Stations (Indore Smart Grid)
  stations: [
    {
      id: 'ST-01',
      name: 'AITR Central Sorting Hub (Indore)',
      location: 'Campus & Bypass Road MRF',
      ruleset: 'standard_urban',
      status: 'ACTIVE',
      itemsToday: 512,
      recoveryRate: 94.6,
      contaminationRate: 5.4,
      specialHandlingCount: 4,
      lastActivity: '2 min ago'
    },
    {
      id: 'ST-02',
      name: 'Mangliya Materials Recovery Facility',
      location: 'AB Road Industrial Zone',
      ruleset: 'high_throughput',
      status: 'ACTIVE',
      itemsToday: 420,
      recoveryRate: 93.8,
      contaminationRate: 6.2,
      specialHandlingCount: 8,
      lastActivity: '8 min ago'
    },
    {
      id: 'ST-03',
      name: 'Vijay Nagar High-Speed Sorting Terminal',
      location: 'Scheme 54 Commercial Depot',
      ruleset: 'battery_strict',
      status: 'ACTIVE',
      itemsToday: 285,
      recoveryRate: 96.2,
      contaminationRate: 3.8,
      specialHandlingCount: 12,
      lastActivity: '15 min ago'
    },
    {
      id: 'ST-04',
      name: 'Palasia Circular Depository',
      location: 'AB Road Tech Corridor',
      ruleset: 'battery_strict',
      status: 'ACTIVE',
      itemsToday: 190,
      recoveryRate: 97.4,
      contaminationRate: 2.6,
      specialHandlingCount: 15,
      lastActivity: '22 min ago'
    },
    {
      id: 'ST-05',
      name: 'Rau Hazardous & Industrial Remediation',
      location: 'Pithampur Link Road',
      ruleset: 'hazmat_containment',
      status: 'ACTIVE',
      itemsToday: 340,
      recoveryRate: 91.2,
      contaminationRate: 8.8,
      specialHandlingCount: 22,
      lastActivity: '35 min ago'
    },
    {
      id: 'ST-06',
      name: 'Bhanwarkuan Wet & Bio-Compost Line',
      location: 'South Indore Suburb',
      ruleset: 'organic_compost',
      status: 'ACTIVE',
      itemsToday: 310,
      recoveryRate: 95.1,
      contaminationRate: 4.9,
      specialHandlingCount: 3,
      lastActivity: '40 min ago'
    }
  ]
};

// Safe Getter Utility to prevent "undefined" or "null" across the UI
DEMO_DATA.getMetric = function(key, fallback = 'N/A') {
  if (this.metrics && this.metrics[key] !== undefined && this.metrics[key] !== null) {
    return this.metrics[key];
  }
  return fallback;
};

// Helper: Haversine distance in km
DEMO_DATA.calcDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DEMO_DATA;
} else if (typeof window !== 'undefined') {
  window.DEMO_DATA = DEMO_DATA;
}

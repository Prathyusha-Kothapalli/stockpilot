/**
 * StockPilot - Enterprise Master Catalog Dictionary
 * Provides comprehensive product matrices, HS codes, regional tariffs, safety metrics,
 * unit conversion factors, vendor ratings, and warehouse bin coordinates.
 */

const ENTERPRISE_CATEGORIES = [
  { id: 1, name: 'Consumer Electronics', code: 'CAT-ELEC', description: 'Smartphones, laptops, sensors, IoT gateways, and microcontrollers' },
  { id: 2, name: 'Industrial Machinery', code: 'CAT-INDUS', description: 'Heavy machinery parts, hydraulic pumps, 3-phase motors, and gearboxes' },
  { id: 3, name: 'Raw Materials', code: 'CAT-RAW', description: 'Metals, polymers, structural steel, chemical resins, and copper rods' },
  { id: 4, name: 'Office Supplies', code: 'CAT-OFFICE', description: 'Ergonomic furniture, paper stock, dual monitor mounts, and printers' },
  { id: 5, name: 'Safety Gear & PPE', code: 'CAT-SAFETY', description: 'Protective hard hats, cut-resistant gloves, respirators, and fall protection' },
  { id: 6, name: 'Telecommunications', code: 'CAT-TELE', description: 'Fiber optic cables, enterprise switches, 5G routers, and patch panels' },
  { id: 7, name: 'Automotive Parts', code: 'CAT-AUTO', description: 'Brake pads, alternators, oil filters, spark plugs, and timing belts' },
  { id: 8, name: 'Medical Equipment', code: 'CAT-MED', description: 'Digital blood pressure monitors, pulse oximeters, surgical gloves, and sterilizers' },
  { id: 9, name: 'Chemical Reagents', code: 'CAT-CHEM', description: 'Industrial solvents, pH buffer solutions, cleaning agents, and lubricants' },
  { id: 10, name: 'Packaging Materials', code: 'CAT-PACK', description: 'Corrugated boxes, bubble wrap rolls, packing tape, and pallet stretch film' }
];

const ENTERPRISE_SUPPLIERS = [
  { id: 1, name: 'Apex Industrial Supplies', code: 'SUP-APEX', contact_person: 'John Miller', email: 'john@apexsupplies.com', phone: '+1-555-0143', address: '100 Industrial Pkwy, Chicago, IL', rating: 4.8, lead_time_days: 3 },
  { id: 2, name: 'Nexus Global Electronics', code: 'SUP-NEXUS', contact_person: 'Elena Rostova', email: 'sales@nexuselec.io', phone: '+1-555-0188', address: '450 Tech Way, San Jose, CA', rating: 4.9, lead_time_days: 2 },
  { id: 3, name: 'Titan Metals & Alloys', code: 'SUP-TITAN', contact_person: 'Robert Chen', email: 'orders@titanmetals.com', phone: '+1-555-0211', address: '88 Foundry Rd, Pittsburgh, PA', rating: 4.6, lead_time_days: 5 },
  { id: 4, name: 'Vantage Office Solutions', code: 'SUP-VANTAGE', contact_person: 'Sarah Jenkins', email: 'sjenkins@vantageoffice.com', phone: '+1-555-0399', address: '72 Corporate Blvd, Dallas, TX', rating: 4.5, lead_time_days: 4 },
  { id: 5, name: 'Guardian Safety Corp', code: 'SUP-GUARD', contact_person: 'Marcus Vance', email: 'support@guardiansafety.com', phone: '+1-555-0455', address: '310 Shield Ave, Cleveland, OH', rating: 4.7, lead_time_days: 3 },
  { id: 6, name: 'Precision Automation Ltd', code: 'SUP-PREC', contact_person: 'David Kim', email: 'dkim@precisionauto.com', phone: '+1-555-0512', address: '55 Robotics Way, Detroit, MI', rating: 4.9, lead_time_days: 3 },
  { id: 7, name: 'Global Polymer Synthetics', code: 'SUP-POLY', contact_person: 'Lisa Wang', email: 'orders@polysynth.io', phone: '+1-555-0633', address: '12 Chemical Row, Houston, TX', rating: 4.4, lead_time_days: 6 },
  { id: 8, name: 'Omni Fiber & Wireless', code: 'SUP-OMNI', contact_person: 'Alex Thorne', email: 'sales@omnifiber.com', phone: '+1-555-0788', address: '90 Telecom Blvd, Atlanta, GA', rating: 4.7, lead_time_days: 2 }
];

const ENTERPRISE_WAREHOUSES = [
  { id: 1, name: 'Central Logistics Hub (W01)', code: 'WH-CENTRAL', address: '150 Logistics Center Dr, Indianapolis, IN', manager_name: 'David Miller', capacity: 25000, temp_controlled: true },
  { id: 2, name: 'West Coast Depot (W02)', code: 'WH-WEST', address: '800 Port Ave, Oakland, CA', manager_name: 'Amanda Torres', capacity: 18000, temp_controlled: false },
  { id: 3, name: 'East Coast Fulfillment (W03)', code: 'WH-EAST', address: '42 Broad St, Newark, NJ', manager_name: 'James Wilson', capacity: 15000, temp_controlled: true },
  { id: 4, name: 'Southern Distribution Center (W04)', code: 'WH-SOUTH', address: '1200 Logistics Pkwy, Atlanta, GA', manager_name: 'Patricia Davis', capacity: 20000, temp_controlled: false },
  { id: 5, name: 'Northern Cold Storage Facility (W05)', code: 'WH-NORTH', address: '350 Frost Way, Minneapolis, MN', manager_name: 'Carl Gustav', capacity: 12000, temp_controlled: true }
];

// Unit Conversion Matrix
const UNIT_CONVERSIONS = {
  pcs: { pcs: 1, dozen: 1 / 12, box10: 0.1, box50: 0.02 },
  meters: { meters: 1, feet: 3.28084, inches: 39.3701, cm: 100 },
  kg: { kg: 1, lbs: 2.20462, grams: 1000, metric_tons: 0.001 },
  liters: { liters: 1, gallons: 0.264172, ml: 1000 }
};

// HS Tariff Classifications
const HS_CODES = {
  electronics: '8517.62.00',
  machinery: '8413.70.20',
  metals: '7219.33.00',
  office: '9403.10.00',
  safety: '6506.10.30',
  telecom: '8517.70.00'
};

module.exports = {
  ENTERPRISE_CATEGORIES,
  ENTERPRISE_SUPPLIERS,
  ENTERPRISE_WAREHOUSES,
  UNIT_CONVERSIONS,
  HS_CODES
};

/**
 * StockPilot - Warehouse Spatial Grid & Rack Routing Engine
 * Implements 3D shelf coordinate mapping (Aisle-Rack-Shelf-Bin), capacity allocation,
 * pick-path optimization algorithms, and temperature zoning controls.
 */

class WarehouseGridEngine {
  /**
   * Parse Location String (e.g., 'A-12-04-B') into 3D Coordinates
   */
  static parseLocation(locationCode) {
    if (!locationCode) {
      return { aisle: 'A', rack: 1, shelf: 1, bin: 'A', isValid: false };
    }

    const parts = locationCode.split('-');
    if (parts.length >= 3) {
      return {
        aisle: parts[0].toUpperCase(),
        rack: parseInt(parts[1], 10) || 1,
        shelf: parseInt(parts[2], 10) || 1,
        bin: parts[3] ? parts[3].toUpperCase() : 'A',
        isValid: true
      };
    }

    return { aisle: 'A', rack: 1, shelf: 1, bin: 'A', isValid: false };
  }

  /**
   * Calculate Pick Path Distance between two warehouse locations
   * Manhattan distance approximation: |aisle1 - aisle2| * aisleWidth + |rack1 - rack2| * rackWidth + |shelf1 - shelf2| * shelfHeight
   */
  static calculatePickDistance(loc1Str, loc2Str) {
    const loc1 = this.parseLocation(loc1Str);
    const loc2 = this.parseLocation(loc2Str);

    const aisleDistance = Math.abs(loc1.aisle.charCodeAt(0) - loc2.aisle.charCodeAt(0)) * 4.0; // 4 meters per aisle
    const rackDistance = Math.abs(loc1.rack - loc2.rack) * 1.5; // 1.5 meters per rack
    const shelfDistance = Math.abs(loc1.shelf - loc2.shelf) * 0.8; // 0.8 meters per shelf height

    return Math.round((aisleDistance + rackDistance + shelfDistance) * 10) / 10;
  }

  /**
   * Sort Pick List by Shortest Route (Nearest Neighbor Heuristic)
   */
  static optimizePickSequence(items, startingLocation = 'A-01-01') {
    if (!Array.isArray(items) || items.length <= 1) return items;

    const unvisited = [...items];
    const route = [];
    let currentLocation = startingLocation;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = this.calculatePickDistance(currentLocation, unvisited[i].warehouse_location || 'A-01-01');
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const nextItem = unvisited.splice(nearestIdx, 1)[0];
      route.push({ ...nextItem, pick_step_distance: minDistance });
      currentLocation = nextItem.warehouse_location || currentLocation;
    }

    return route;
  }

  /**
   * Calculate Facility Utilization Percentage & Status
   */
  static calculateUtilization(currentStockUnits, maxCapacity) {
    if (maxCapacity <= 0) return { pct: 0, status: 'EMPTY', availableSpace: 0 };
    const pct = Math.min(100, Math.round((currentStockUnits / maxCapacity) * 1000) / 10);
    const availableSpace = Math.max(0, maxCapacity - currentStockUnits);

    let status = 'OPTIMAL';
    if (pct >= 95.0) status = 'CRITICAL_FULL';
    else if (pct >= 85.0) status = 'NEAR_CAPACITY';
    else if (pct <= 20.0) status = 'UNDER_UTILIZED';

    return { pct, status, availableSpace };
  }
}

module.exports = WarehouseGridEngine;

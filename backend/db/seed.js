const bcrypt = require('bcryptjs');
const { get, all, run, exec, initSchema } = require('./database');

async function seedDatabase(force = false) {
  try {
    await initSchema();

    // Check if user already exists
    const existingUser = await get("SELECT * FROM users WHERE email = ?", ['admin@stockpilot.com']);
    if (existingUser && !force) {
      console.log('Database already populated with seed data.');
      return;
    }

    console.log('Seeding StockPilot Database...');

    if (force) {
      await exec(`
        DELETE FROM stock_movements;
        DELETE FROM purchase_order_items;
        DELETE FROM purchase_orders;
        DELETE FROM product_warehouse_stock;
        DELETE FROM products;
        DELETE FROM warehouses;
        DELETE FROM suppliers;
        DELETE FROM categories;
        DELETE FROM users;
      `);
    }

    // 1. Seed Users
    const saltRounds = process.env.NODE_ENV === 'test' ? 1 : 10;
    const adminPasswordHash = await bcrypt.hash('Demo@123', saltRounds);
    const adminRes = await run(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      ['System Administrator', 'admin@stockpilot.com', adminPasswordHash, 'admin']
    );
    const managerRes = await run(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      ['Operations Manager', 'manager@stockpilot.com', adminPasswordHash, 'manager']
    );
    const adminId = adminRes.lastID;
    const managerId = managerRes.lastID;

    // 2. Seed Categories (5)
    const categoriesData = [
      { name: 'Consumer Electronics', code: 'CAT-ELEC', description: 'Smartphones, laptops, sensors, and electronic components' },
      { name: 'Industrial Machinery', code: 'CAT-INDUS', description: 'Heavy machinery parts, hydraulic pumps, and motors' },
      { name: 'Raw Materials', code: 'CAT-RAW', description: 'Metals, polymers, wood stock, and chemical reagents' },
      { name: 'Office Supplies', code: 'CAT-OFFICE', description: 'Paper stock, ergonomic furniture, and stationery' },
      { name: 'Safety Gear & PPE', code: 'CAT-SAFETY', description: 'Protective helmets, safety gloves, respirators, and harnesses' }
    ];

    const categoryIds = [];
    for (const cat of categoriesData) {
      const res = await run(
        "INSERT INTO categories (name, code, description) VALUES (?, ?, ?)",
        [cat.name, cat.code, cat.description]
      );
      categoryIds.push(res.lastID);
    }

    // 3. Seed Suppliers (5)
    const suppliersData = [
      { name: 'Apex Industrial Supplies', code: 'SUP-APEX', contact: 'John Miller', email: 'john@apexsupplies.com', phone: '+1-555-0143', address: '100 Industrial Pkwy, Chicago, IL', rating: 4.8 },
      { name: 'Nexus Global Electronics', code: 'SUP-NEXUS', contact: 'Elena Rostova', email: 'sales@nexuselec.io', phone: '+1-555-0188', address: '450 Tech Way, San Jose, CA', rating: 4.9 },
      { name: 'Titan Metals & Alloys', code: 'SUP-TITAN', contact: 'Robert Chen', email: 'orders@titanmetals.com', phone: '+1-555-0211', address: '88 Foundry Rd, Pittsburgh, PA', rating: 4.6 },
      { name: 'Vantage Office Solutions', code: 'SUP-VANTAGE', contact: 'Sarah Jenkins', email: 'sjenkins@vantageoffice.com', phone: '+1-555-0399', address: '72 Corporate Blvd, Dallas, TX', rating: 4.5 },
      { name: 'Guardian Safety Corp', code: 'SUP-GUARD', contact: 'Marcus Vance', email: 'support@guardiansafety.com', phone: '+1-555-0455', address: '310 Shield Ave, Cleveland, OH', rating: 4.7 }
    ];

    const supplierIds = [];
    for (const sup of suppliersData) {
      const res = await run(
        "INSERT INTO suppliers (name, code, contact_person, email, phone, address, rating) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [sup.name, sup.code, sup.contact, sup.email, sup.phone, sup.address, sup.rating]
      );
      supplierIds.push(res.lastID);
    }

    // 4. Seed Warehouses (3)
    const warehousesData = [
      { name: 'Central Logistics Hub (W01)', code: 'WH-CENTRAL', address: '150 Logistics Center Dr, Indianapolis, IN', manager: 'David Miller', capacity: 25000 },
      { name: 'West Coast Depot (W02)', code: 'WH-WEST', address: '800 Port Ave, Oakland, CA', manager: 'Amanda Torres', capacity: 18000 },
      { name: 'East Coast Fulfillment (W03)', code: 'WH-EAST', address: '42 Broad St, Newark, NJ', manager: 'James Wilson', capacity: 15000 }
    ];

    const warehouseIds = [];
    for (const wh of warehousesData) {
      const res = await run(
        "INSERT INTO warehouses (name, code, address, manager_name, capacity) VALUES (?, ?, ?, ?, ?)",
        [wh.name, wh.code, wh.address, wh.manager, wh.capacity]
      );
      warehouseIds.push(res.lastID);
    }

    // 5. Seed Products (30)
    const productsData = [
      // Electronics (cat 0)
      { sku: 'SKU-ELEC-001', barcode: '890100100101', name: 'Industrial IoT Gateway v2', catIdx: 0, brand: 'Nexus', cost: 120.00, sell: 195.00, qty: 85, reorder: 20, unit: 'pcs', loc: 'A-12-01', whIdx: 0 },
      { sku: 'SKU-ELEC-002', barcode: '890100100102', name: 'High-Temp Thermocouple Sensor', catIdx: 0, brand: 'Sensotech', cost: 45.00, sell: 79.99, qty: 150, reorder: 30, unit: 'pcs', loc: 'A-12-02', whIdx: 0 },
      { sku: 'SKU-ELEC-003', barcode: '890100100103', name: 'Programmable Logic Controller (PLC)', catIdx: 0, brand: 'Siemens', cost: 380.00, sell: 550.00, qty: 12, reorder: 15, unit: 'pcs', loc: 'A-14-05', whIdx: 1 }, // Low stock!
      { sku: 'SKU-ELEC-004', barcode: '890100100104', name: 'Wireless RFID Scanner Handheld', catIdx: 0, brand: 'Zebra', cost: 210.00, sell: 320.00, qty: 40, reorder: 10, unit: 'pcs', loc: 'A-15-02', whIdx: 2 },
      { sku: 'SKU-ELEC-005', barcode: '890100100105', name: '24V Industrial Power Supply Unit', catIdx: 0, brand: 'MeanWell', cost: 35.00, sell: 65.00, qty: 95, reorder: 25, unit: 'pcs', loc: 'A-10-04', whIdx: 0 },
      { sku: 'SKU-ELEC-006', barcode: '890100100106', name: 'Digital Multimeter Pro 600V', catIdx: 0, brand: 'Fluke', cost: 110.00, sell: 175.00, qty: 8, reorder: 10, unit: 'pcs', loc: 'A-08-01', whIdx: 1 }, // Low stock!

      // Industrial Machinery (cat 1)
      { sku: 'SKU-IND-001', barcode: '890200200201', name: 'Hydraulic Piston Pump 3000 PSI', catIdx: 1, brand: 'Bosch Rexroth', cost: 450.00, sell: 720.00, qty: 22, reorder: 10, unit: 'units', loc: 'B-01-01', whIdx: 0 },
      { sku: 'SKU-IND-002', barcode: '890200200202', name: '3-Phase Electric Motor 15HP', catIdx: 1, brand: 'WEG', cost: 680.00, sell: 990.00, qty: 14, reorder: 8, unit: 'units', loc: 'B-02-03', whIdx: 1 },
      { sku: 'SKU-IND-003', barcode: '890200200203', name: 'Heavy Duty Pneumatic Cylinder', catIdx: 1, brand: 'SMC', cost: 85.00, sell: 140.00, qty: 65, reorder: 15, unit: 'pcs', loc: 'B-03-02', whIdx: 0 },
      { sku: 'SKU-IND-004', barcode: '890200200204', name: 'Industrial Gearbox 50:1 Ratio', catIdx: 1, brand: 'SEW', cost: 310.00, sell: 490.00, qty: 18, reorder: 5, unit: 'units', loc: 'B-04-01', whIdx: 2 },
      { sku: 'SKU-IND-005', barcode: '890200200205', name: 'Automated Conveyor Roller 1m', catIdx: 1, brand: 'Interroll', cost: 60.00, sell: 105.00, qty: 120, reorder: 30, unit: 'pcs', loc: 'B-05-06', whIdx: 0 },
      { sku: 'SKU-IND-006', barcode: '890200200206', name: 'Vibration Control Mount Set', catIdx: 1, brand: 'VibraTech', cost: 28.00, sell: 52.00, qty: 5, reorder: 15, unit: 'sets', loc: 'B-06-02', whIdx: 2 }, // Low stock!

      // Raw Materials (cat 2)
      { sku: 'SKU-RAW-001', barcode: '890300300301', name: 'Stainless Steel Sheet 304 (4x8ft)', catIdx: 2, brand: 'Titan', cost: 180.00, sell: 260.00, qty: 210, reorder: 50, unit: 'sheets', loc: 'C-01-01', whIdx: 0 },
      { sku: 'SKU-RAW-002', barcode: '890300300302', name: 'Aluminum Extrusion Profile 2040', catIdx: 2, brand: 'AluTech', cost: 14.50, sell: 26.00, qty: 450, reorder: 100, unit: 'meters', loc: 'C-02-04', whIdx: 1 },
      { sku: 'SKU-RAW-003', barcode: '890300300303', name: 'Carbon Fiber Rod 10mm x 1m', catIdx: 2, brand: 'PolyCom', cost: 22.00, sell: 42.00, qty: 180, reorder: 40, unit: 'pcs', loc: 'C-03-01', whIdx: 0 },
      { sku: 'SKU-RAW-004', barcode: '890300300304', name: 'Industrial Polyurethane Resin 20L', catIdx: 2, brand: 'ChemCorp', cost: 95.00, sell: 160.00, qty: 35, reorder: 10, unit: 'drums', loc: 'C-04-02', whIdx: 2 },
      { sku: 'SKU-RAW-005', barcode: '890300300305', name: 'Copper Rod 99.9% Pure 25mm', catIdx: 2, brand: 'Titan', cost: 65.00, sell: 105.00, qty: 85, reorder: 20, unit: 'meters', loc: 'C-05-01', whIdx: 0 },
      { sku: 'SKU-RAW-006', barcode: '890300300306', name: 'Structural Steel I-Beam 6m', catIdx: 2, brand: 'Titan', cost: 320.00, sell: 480.00, qty: 9, reorder: 15, unit: 'pcs', loc: 'C-06-01', whIdx: 1 }, // Low stock!

      // Office Supplies (cat 3)
      { sku: 'SKU-OFF-001', barcode: '890400400401', name: 'Ergonomic Executive Mesh Chair', catIdx: 3, brand: 'Vantage', cost: 145.00, sell: 249.99, qty: 60, reorder: 15, unit: 'pcs', loc: 'D-01-01', whIdx: 0 },
      { sku: 'SKU-OFF-002', barcode: '890400400402', name: 'Dual Monitor Arm Desk Mount', catIdx: 3, brand: 'ErgoFlex', cost: 38.00, sell: 75.00, qty: 110, reorder: 20, unit: 'pcs', loc: 'D-01-04', whIdx: 1 },
      { sku: 'SKU-OFF-003', barcode: '890400400403', name: 'Recycled Copy Paper A4 Box (5 Reams)', catIdx: 3, brand: 'PaperLine', cost: 18.00, sell: 29.99, qty: 320, reorder: 50, unit: 'boxes', loc: 'D-02-02', whIdx: 2 },
      { sku: 'SKU-OFF-004', barcode: '890400400404', name: 'Heavy Duty Thermal Label Printer', catIdx: 3, brand: 'Zebra', cost: 190.00, sell: 299.00, qty: 25, reorder: 8, unit: 'pcs', loc: 'D-03-01', whIdx: 0 },
      { sku: 'SKU-OFF-005', barcode: '890400400405', name: 'Motorized Electric Standing Desk', catIdx: 3, brand: 'Vantage', cost: 260.00, sell: 430.00, qty: 18, reorder: 10, unit: 'pcs', loc: 'D-04-01', whIdx: 1 },
      { sku: 'SKU-OFF-006', barcode: '890400400406', name: 'High-Capacity Cross-Cut Shredder', catIdx: 3, brand: 'Fellowes', cost: 85.00, sell: 149.00, qty: 6, reorder: 10, unit: 'pcs', loc: 'D-05-02', whIdx: 2 }, // Low stock!

      // Safety Gear & PPE (cat 4)
      { sku: 'SKU-SAF-001', barcode: '890500500501', name: 'Vented Hard Hat with Ratchet Suspension', catIdx: 4, brand: 'Guardian', cost: 12.50, sell: 24.99, qty: 450, reorder: 80, unit: 'pcs', loc: 'E-01-01', whIdx: 0 },
      { sku: 'SKU-SAF-002', barcode: '890500500502', name: 'Cut-Resistant Level 5 Safety Gloves (10 pk)', catIdx: 4, brand: 'Ansell', cost: 25.00, sell: 45.00, qty: 220, reorder: 40, unit: 'packs', loc: 'E-01-05', whIdx: 1 },
      { sku: 'SKU-SAF-003', barcode: '890500500503', name: 'Full Body Fall Protection Harness', catIdx: 4, brand: '3M DBI-SALA', cost: 140.00, sell: 230.00, qty: 35, reorder: 10, unit: 'pcs', loc: 'E-02-01', whIdx: 0 },
      { sku: 'SKU-SAF-004', barcode: '890500500504', name: 'Half Mask Respirator with P100 Filters', catIdx: 4, brand: '3M', cost: 32.00, sell: 58.00, qty: 160, reorder: 30, unit: 'pcs', loc: 'E-03-02', whIdx: 2 },
      { sku: 'SKU-SAF-005', barcode: '890500500505', name: 'Steel Toe Waterproof Work Boots size 10', catIdx: 4, brand: 'Timberland PRO', cost: 75.00, sell: 135.00, qty: 55, reorder: 15, unit: 'pairs', loc: 'E-04-03', whIdx: 1 },
      { sku: 'SKU-SAF-006', barcode: '890500500506', name: 'Emergency Eyewash Station Wall Mount', catIdx: 4, brand: 'Guardian', cost: 95.00, sell: 170.00, qty: 4, reorder: 8, unit: 'pcs', loc: 'E-05-01', whIdx: 0 } // Low stock!
    ];

    const productIds = [];
    for (const p of productsData) {
      const catId = categoryIds[p.catIdx];
      const whId = warehouseIds[p.whIdx];
      const res = await run(
        `INSERT INTO products 
         (sku, barcode, name, category_id, brand, cost_price, selling_price, quantity, reorder_level, unit, warehouse_location, primary_warehouse_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.sku, p.barcode, p.name, catId, p.brand, p.cost, p.sell, p.qty, p.reorder, p.unit, p.loc, whId]
      );
      const prodId = res.lastID;
      productIds.push(prodId);

      // Initialize warehouse stock map
      await run(
        "INSERT INTO product_warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)",
        [prodId, whId, p.qty]
      );
    }

    // 6. Seed Purchase Orders (20)
    const poStatuses = ['Received', 'Approved', 'Submitted', 'Draft', 'Cancelled'];
    const poIds = [];
    for (let i = 1; i <= 20; i++) {
      const poNumber = `PO-2026-${String(i).padStart(3, '0')}`;
      const supId = supplierIds[(i - 1) % supplierIds.length];
      const whId = warehouseIds[(i - 1) % warehouseIds.length];
      const status = poStatuses[(i - 1) % poStatuses.length];
      const deliveryDays = (i * 2) % 30;
      const expectedDelivery = new Date(Date.now() + deliveryDays * 86400000).toISOString().split('T')[0];

      const poRes = await run(
        `INSERT INTO purchase_orders 
         (po_number, supplier_id, warehouse_id, status, total_amount, notes, created_by, expected_delivery)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [poNumber, supId, whId, status, 0, `Quarterly procurement cycle batch #${i}`, adminId, expectedDelivery]
      );
      const poId = poRes.lastID;
      poIds.push(poId);

      // Line items for each PO
      let totalPoAmount = 0;
      const itemCount = (i % 3) + 1; // 1 to 3 items
      for (let k = 0; k < itemCount; k++) {
        const prodIdx = (i + k * 4) % productIds.length;
        const prodId = productIds[prodIdx];
        const prod = productsData[prodIdx];
        const qtyOrdered = (k + 1) * 20 + i * 5;
        const qtyReceived = status === 'Received' ? qtyOrdered : (status === 'Approved' ? Math.floor(qtyOrdered / 2) : 0);
        const itemCost = prod.cost;
        totalPoAmount += qtyOrdered * itemCost;

        await run(
          `INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, quantity_received, unit_cost)
           VALUES (?, ?, ?, ?, ?)`,
          [poId, prodId, qtyOrdered, qtyReceived, itemCost]
        );
      }

      // Update PO total amount
      await run("UPDATE purchase_orders SET total_amount = ? WHERE id = ?", [totalPoAmount, poId]);
    }

    // 7. Seed Stock Movements (50 records)
    const movementTypes = ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'];
    const reasons = [
      'Supplier Delivery Receipt',
      'Customer Order Dispatch',
      'Inter-Warehouse Rebalancing',
      'Annual Physical Audit Adjustment',
      'Damaged Inventory Write-off',
      'Promotional Event Dispatch'
    ];

    for (let m = 1; m <= 50; m++) {
      const refNo = `SM-2026-${String(m).padStart(4, '0')}`;
      const mType = movementTypes[m % movementTypes.length];
      const prodId = productIds[(m * 3) % productIds.length];
      const prod = productsData[(m * 3) % productIds.length];
      const srcWh = warehouseIds[m % warehouseIds.length];
      const tgtWh = warehouseIds[(m + 1) % warehouseIds.length];
      const qty = (m % 10) + 5;
      const reason = reasons[m % reasons.length];
      const perfBy = m % 2 === 0 ? adminId : managerId;
      
      // Calculate timestamp spanning past 60 days
      const daysAgo = 60 - (m * 1.1);
      const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();

      await run(
        `INSERT INTO stock_movements 
         (reference_no, movement_type, product_id, source_warehouse_id, target_warehouse_id, quantity, unit_cost, reason, performed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [refNo, mType, prodId, mType === 'IN' ? null : srcWh, mType === 'OUT' ? null : tgtWh, qty, prod.cost, reason, perfBy, createdAt]
      );
    }

    console.log('StockPilot Database Seeding Completed Successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    if (require.main === module) {
      process.exit(1);
    } else {
      throw error;
    }
  }
}

if (require.main === module) {
  seedDatabase(true);
}

module.exports = { seedDatabase };


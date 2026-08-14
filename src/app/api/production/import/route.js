import pool from '@/lib/db';
import { recalculateEfficiency } from '@/lib/efficiency';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { date, shift, rows, productDecisions } = body;

        if (!date || !shift || !rows || !Array.isArray(rows)) {
            return NextResponse.json({ success: false, error: 'Invalid payload. Date, shift, and rows are required.' }, { status: 400 });
        }

        // 1. Fetch caches for resolution
        const [workers] = await pool.query('SELECT id, employee_id FROM workers WHERE is_active = 1');
        const [machines] = await pool.query(`
            SELECT m.id, m.name, l.name as line_name
            FROM machines m
            JOIN \`lines\` l ON l.id = m.line_id
        `);
        const [products] = await pool.query('SELECT id, name FROM products');

        const workerMap = new Map(workers.map(w => [w.employee_id.toLowerCase(), w.id]));
        const machineMap = new Map(machines.map(m => [`${m.line_name.toLowerCase()}:${m.name.toLowerCase()}`, m.id]));
        const machineSimpleMap = new Map(machines.map(m => [m.name.toLowerCase(), m.id]));
        let productMap = new Map(products.map(p => [p.name.toLowerCase(), p.id]));

        const results = {
            total: rows.length,
            imported: 0,
            skipped: 0,
            errors: [],
            productsCreated: []
        };

        const affectedWorkerIds = new Set();
        const logsToInsert = [];

        // 2. Process product decisions and create/update productMap
        if (productDecisions && Object.keys(productDecisions).length > 0) {
            for (const [originalName, decision] of Object.entries(productDecisions)) {
                const action = decision.action;
                const finalName = decision.name;

                if (action === 'create' || action === 'correct') {
                    const [existingProd] = await pool.query(
                        'SELECT id FROM products WHERE name = ? OR sap_code = ?',
                        [finalName, finalName]
                    );

                    let productId;
                    if (existingProd.length > 0) {
                        productId = existingProd[0].id;
                    } else {
                        try {
                            const [insertRes] = await pool.query(
                                'INSERT INTO products (name, sap_code) VALUES (?, ?)',
                                [finalName, finalName]
                            );
                            productId = insertRes.insertId;
                            results.productsCreated.push(finalName);
                        } catch (err) {
                            if (err.code === 'ER_DUP_ENTRY') {
                                const [fallback] = await pool.query('SELECT id FROM products WHERE sap_code = ? OR name = ? LIMIT 1', [finalName, finalName]);
                                if (fallback.length > 0) {
                                    productId = fallback[0].id;
                                } else {
                                    throw err;
                                }
                            } else {
                                throw err;
                            }
                        }
                    }

                    productMap.set(originalName.toLowerCase(), productId);
                    productMap.set(finalName.toLowerCase(), productId);
                }
            }
        }

        // 3. Resolve entities and prepare logs
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const empId = String(row.worker_id || '').trim().toLowerCase();
            const machineName = String(row.machine_name || '').trim().toLowerCase();
            const lineName = String(row.line_name || '').trim().toLowerCase();
            const productName = String(row.product_name || '').trim().toLowerCase();
            const originalProductName = String(row.product_name || '').trim();
            const role = String(row.role || '').trim().toUpperCase() || null;

            // Skip rows without line and cell
            if (!lineName || !machineName) {
                results.skipped++;
                results.errors.push(`Row ${i + 2}: Missing LOCATION (line) or CELL. Skipped.`);
                continue;
            }

            const worker_id = workerMap.get(empId);

            // Resolve machine using Line context
            let machine_id = null;
            if (lineName && machineName) {
                machine_id = machineMap.get(`${lineName}:${machineName}`);
            }
            if (!machine_id) {
                machine_id = machineSimpleMap.get(machineName);
            }

            // Check if product should be skipped
            if (productDecisions && productDecisions[originalProductName]?.action === 'skip') {
                results.skipped++;
                results.errors.push(`Row ${i + 2}: Product "${originalProductName}" was skipped by user.`);
                continue;
            }

            // Get product_id
            let product_id = null;
            if (productName) {
                product_id = productMap.get(productName) || null;
            }

            if (!worker_id) {
                results.skipped++;
                results.errors.push(`Row ${i + 2}: Worker ID "${row.worker_id}" not found.`);
                continue;
            }

            if (!machine_id) {
                results.skipped++;
                results.errors.push(`Row ${i + 2}: Machine "${row.machine_name}" in line "${row.line_name}" not found.`);
                continue;
            }

            logsToInsert.push({
                worker_id,
                machine_id,
                product_id,
                target_units: parseInt(row.target_units) || 0,
                actual_units: parseInt(row.actual_units) || 0,
                role
            });
            affectedWorkerIds.add(worker_id);
        }

        // 4. Perform database operations
        if (logsToInsert.length > 0) {
            for (const log of logsToInsert) {
                await pool.query(
                    `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units, role)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        machine_id = VALUES(machine_id),
                        product_id = VALUES(product_id),
                        target_units = VALUES(target_units),
                        actual_units = VALUES(actual_units),
                        role = VALUES(role)`,
                    [log.worker_id, log.machine_id, log.product_id, date, shift, log.target_units, log.actual_units, log.role]
                );
                results.imported++;
            }

            // 5. Recalculate efficiency for affected workers
            for (const workerId of affectedWorkerIds) {
                try {
                    await recalculateEfficiency(date, workerId);
                } catch (effErr) {
                    console.error(`Failed to recalculate efficiency for worker ${workerId}:`, effErr);
                }
            }
        }

        return NextResponse.json({ success: true, ...results });
    } catch (error) {
        console.error('Import Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

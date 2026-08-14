import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { rows } = body;

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ success: false, error: 'Rows are required.' }, { status: 400 });
        }

        // 1. Fetch reference data
        const [products] = await pool.query('SELECT id, name FROM products');
        const [machines] = await pool.query(`
            SELECT m.id, m.name, l.name as line_name
            FROM machines m
            JOIN \`lines\` l ON l.id = m.line_id
        `);

        const productMap = new Map(products.map(p => [p.name.toLowerCase(), p.id]));
        const machineMap = new Map(machines.map(m => [`${m.line_name.toLowerCase()}:${m.name.toLowerCase()}`, m.id]));
        const machineSimpleMap = new Map(machines.map(m => [m.name.toLowerCase(), m.id]));

        // 2. Identify unknown entities
        const unknownProducts = [];
        const unknownSet = new Set();
        const unknownMachines = [];
        const unknownMachineSet = new Set();

        for (const row of rows) {
            const productName = String(row.product_name || '').trim();
            const machineName = String(row.machine_name || '').trim();
            const lineName = String(row.line_name || '').trim();

            // Check Products
            if (productName && !productMap.has(productName.toLowerCase())) {
                if (!unknownSet.has(productName.toLowerCase())) {
                    unknownSet.add(productName.toLowerCase());
                    unknownProducts.push({
                        name: productName,
                        count: rows.filter(r => String(r.product_name || '').trim().toLowerCase() === productName.toLowerCase()).length
                    });
                }
            }

            // Check Machines/Lines
            if (machineName) {
                const combinedKey = `${lineName.toLowerCase()}:${machineName.toLowerCase()}`;
                const exists = machineMap.has(combinedKey) || machineSimpleMap.has(machineName.toLowerCase());
                
                if (!exists) {
                    const errorKey = `${lineName}:${machineName}`;
                    if (!unknownMachineSet.has(errorKey.toLowerCase())) {
                        unknownMachineSet.add(errorKey.toLowerCase());
                        unknownMachines.push({
                            line: lineName,
                            machine: machineName,
                            worker_id: row.code
                        });
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            unknownProducts,
            unknownMachines
        });
    } catch (error) {
        console.error('Validation Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

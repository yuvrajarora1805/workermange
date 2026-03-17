import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all manual efficiency overrides (optional filter by worker_id)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const workerId = searchParams.get('worker_id');

        let query = `
            SELECT me.*, w.name as worker_name, w.employee_id, 
                   m.name as machine_name, p.name as product_name
            FROM manual_efficiency me
            JOIN workers w ON w.id = me.worker_id
            JOIN machines m ON m.id = me.machine_id
            LEFT JOIN products p ON p.id = me.product_id
        `;
        const params = [];

        if (workerId) {
            query += ' WHERE me.worker_id = ?';
            params.push(workerId);
        }

        query += ' ORDER BY me.updated_at DESC';

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - add or update manual efficiency
export async function POST(request) {
    try {
        const { worker_id, machine_id, product_id, efficiency_pct } = await request.json();

        if (!worker_id || !machine_id || efficiency_pct === undefined) {
            return NextResponse.json({ success: false, error: 'Worker, Machine and Efficiency are required' }, { status: 400 });
        }

        await pool.query(`
            INSERT INTO manual_efficiency (worker_id, machine_id, product_id, efficiency_pct)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                efficiency_pct = VALUES(efficiency_pct),
                updated_at = CURRENT_TIMESTAMP
        `, [worker_id, machine_id, product_id || null, efficiency_pct]);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE - remove an override
export async function DELETE(request) {
    try {
        const { id } = await request.json();
        await pool.query('DELETE FROM manual_efficiency WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

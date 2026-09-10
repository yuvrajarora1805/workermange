import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET production logs
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const worker_id = searchParams.get('worker_id');

        let query = `
            SELECT pl.*, w.name as worker_name, w.employee_id, 
                   m.name as machine_name, l.name as line_name,
                   p.name as product_name
            FROM production_logs pl
            JOIN workers w ON w.id = pl.worker_id
            LEFT JOIN machines m ON m.id = pl.machine_id
            LEFT JOIN \`lines\` l ON l.id = m.line_id
            LEFT JOIN products p ON p.id = pl.product_id
        `;
        const conditions = [];
        const params = [];

        if (date) { conditions.push('pl.date = ?'); params.push(date); }
        if (worker_id) { conditions.push('pl.worker_id = ?'); params.push(parseInt(worker_id)); }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY pl.date DESC, w.name ASC';

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - log production (supports single or bulk)
export async function POST(request) {
    try {
        const body = await request.json();
        const logs = Array.isArray(body) ? body : [body];

        if (logs.length === 0) {
            return NextResponse.json({ success: false, error: 'No data provided' }, { status: 400 });
        }

        const prodDate = logs[0].date || new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        const shift = logs[0].shift || (((hour > 7 || (hour === 7 && new Date().getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date().getMinutes() < 30))) ? 'day' : 'night');

        // Validate all entries
        for (const log of logs) {
            if (!log.worker_id || log.target_units === undefined || log.actual_units === undefined) {
                return NextResponse.json({ success: false, error: 'Worker ID, target units, and actual units are required for all entries' }, { status: 400 });
            }
            if (!log.machine_id) {
                return NextResponse.json({ success: false, error: `Worker ${log.worker_id} must be assigned to a machine to log production.` }, { status: 400 });
            }
        }

        // Process logs
        // We can use a loop for now to use ON DUPLICATE KEY UPDATE individually
        // For very large sets, a batch insert with DUPLICATE KEY might be better
        const results = [];
        for (const log of logs) {
            const [result] = await pool.query(
                `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    actual_units = VALUES(actual_units),
                    target_units = VALUES(target_units),
                    product_id   = VALUES(product_id)`,
                [
                    log.worker_id, 
                    log.machine_id, 
                    log.product_id || null, 
                    log.date || prodDate, 
                    log.shift || shift, 
                    log.target_units, 
                    log.actual_units
                ]
            );
            results.push(result.insertId);
        }

        return NextResponse.json({ success: true, message: `Logged ${logs.length} entries`, ids: results, shift }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE production log
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ success: false, error: 'Log ID required' }, { status: 400 });

        await pool.query('DELETE FROM production_logs WHERE id = ?', [id]);
        return NextResponse.json({ success: true, message: 'Log deleted successfully' });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

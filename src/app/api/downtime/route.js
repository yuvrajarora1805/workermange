import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET downtime logs
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        let query = `
            SELECT d.*, l.name as line_name 
            FROM downtime_logs d
            LEFT JOIN \`lines\` l ON l.id = d.line_id
        `;
        let params = [];
        if (date) {
            query += ` WHERE DATE(d.start_time) = ?`;
            params.push(date);
        }
        query += ` ORDER BY d.start_time DESC`;

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST log downtime
export async function POST(request) {
    try {
        const { line_id, is_all_lines, start_time, end_time, reason } = await request.json();
        
        if (!start_time) {
            return NextResponse.json({ success: false, error: 'Start time is required' }, { status: 400 });
        }

        if (line_id) {
            const [line] = await pool.query('SELECT is_active FROM `lines` WHERE id = ?', [line_id]);
            if (line.length > 0 && !line[0].is_active) {
                return NextResponse.json({ success: false, error: 'Cannot log downtime for a deactivated line.' }, { status: 400 });
            }
        }

        const [result] = await pool.query(
            `INSERT INTO downtime_logs (line_id, is_all_lines, start_time, end_time, reason) 
             VALUES (?, ?, ?, ?, ?)`,
            [line_id || null, is_all_lines ? 1 : 0, start_time, end_time || null, reason || '']
        );
        return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT end downtime (update end_time)
export async function PUT(request) {
    try {
        const { id, end_time } = await request.json();
        if (!id || !end_time) {
            return NextResponse.json({ success: false, error: 'ID and End time are required' }, { status: 400 });
        }

        await pool.query(
            `UPDATE downtime_logs SET end_time = ? WHERE id = ?`,
            [end_time, id]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

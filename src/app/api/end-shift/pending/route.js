import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerScope } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const cookieHeader = request.headers.get('cookie') || '';
        const scope = getServerScope(cookieHeader);

        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');
        
        // Auto-close stale shift logs older than 16 hours
        await pool.query(`
            UPDATE worker_shift_logs 
            SET end_time = DATE_ADD(start_time, INTERVAL 8 HOUR), total_hours = 8.00 
            WHERE end_time IS NULL AND start_time < NOW() - INTERVAL 16 HOUR
        `);

        let query = `
            SELECT wsl.id as log_id, 
                   wsl.worker_id, 
                   wsl.machine_id, 
                   wsl.start_time,
                   w.name as worker_name, 
                   w.employee_id,
                   m.name as machine_name,
                   m.position as machine_position,
                   l.id as line_id,
                   l.name as line_name,
                   COALESCE(wsl.product_id, m.current_product_id) as product_id,
                   p.name as product_name,
                   p.hourly_target
            FROM worker_shift_logs wsl
            JOIN workers w ON w.id = wsl.worker_id
            JOIN machines m ON m.id = wsl.machine_id
            JOIN \`lines\` l ON l.id = m.line_id
            LEFT JOIN products p ON p.id = COALESCE(wsl.product_id, m.current_product_id)
            WHERE wsl.end_time IS NULL
        `;
        const params = [];
        
        if (dateParam) {
            query += ' AND DATE(wsl.start_time) = ?';
            params.push(dateParam);
        } else {
            query += ' AND wsl.start_time >= NOW() - INTERVAL 16 HOUR';
        }

        if (scope.role === 'line_lead' && scope.lineId) {
            query += ' AND m.line_id = ?';
            params.push(scope.lineId);
        }
        query += ' ORDER BY l.name, m.position ASC';

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const worker_id = searchParams.get('worker_id');
        const worker_ids = searchParams.getAll('worker_ids[]');

        const idsToFetch = worker_id ? [worker_id] : worker_ids;

        if (!idsToFetch.length) {
            return NextResponse.json({ success: false, error: 'Worker ID(s) required' }, { status: 400 });
        }

        const query = `
            SELECT wsl.*, 
                   m.name as machine_name, 
                   p.name as product_name, 
                   p.hourly_target,
                   w.name as worker_name,
                   w.employee_id
            FROM worker_shift_logs wsl
            JOIN workers w ON w.id = wsl.worker_id
            JOIN machines m ON m.id = wsl.machine_id
            LEFT JOIN products p ON p.id = wsl.product_id
            WHERE wsl.worker_id IN (?) AND wsl.end_time IS NULL
              AND wsl.start_time >= NOW() - INTERVAL 16 HOUR
        `;

        const [rows] = await pool.query(query, [idsToFetch]);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

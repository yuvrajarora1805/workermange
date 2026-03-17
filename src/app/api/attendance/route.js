import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET today's attendance
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const shift = searchParams.get('shift') || 'day';

        const [rows] = await pool.query(`
            SELECT a.*, w.name as worker_name, w.employee_id
            FROM attendance a
            JOIN workers w ON w.id = a.worker_id
            WHERE a.date = ? AND a.shift = ?
            ORDER BY a.check_in_time ASC
        `, [date, shift]);

        // Also get workers without attendance for this specific shift
        const [allWorkers] = await pool.query(`
            SELECT w.id, w.name, w.employee_id, w.is_active,
                   a.status, a.check_in_time, a.id as attendance_id, a.shift
            FROM workers w
            LEFT JOIN attendance a ON a.worker_id = w.id AND a.date = ? AND a.shift = ?
            WHERE w.is_active = 1
            ORDER BY w.name ASC
        `, [date, shift]);

        return NextResponse.json({
            success: true,
            data: {
                attendance: rows,
                workers: allWorkers,
                summary: {
                    total: allWorkers.length,
                    present: allWorkers.filter(w => w.status === 'present').length,
                    late: allWorkers.filter(w => w.status === 'late').length,
                    absent: allWorkers.filter(w => w.status === 'absent').length,
                    unmarked: allWorkers.filter(w => !w.status).length,
                }
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - mark attendance
export async function POST(request) {
    try {
        const body = await request.json();
        const { worker_id, status, check_in_time, date, shift } = body;

        if (!worker_id) {
            return NextResponse.json({ success: false, error: 'Worker ID is required' }, { status: 400 });
        }

        const attendanceDate = date || new Date().toISOString().split('T')[0];
        const time = check_in_time || new Date().toTimeString().split(' ')[0];
        const attendanceShift = shift || ((new Date().getHours() >= 7 && new Date().getHours() < 19) ? 'day' : 'night');

        // Upsert
        await pool.query(`
            INSERT INTO attendance (worker_id, date, shift, check_in_time, status) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE check_in_time = VALUES(check_in_time), status = VALUES(status)
        `, [worker_id, attendanceDate, attendanceShift, time, status || 'present']);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

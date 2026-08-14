import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const shift = searchParams.get('shift') || 'day';

        // 1. Total Workers (Active)
        const [workerRes] = await pool.query('SELECT COUNT(*) as count FROM workers WHERE is_active = 1');
        
        // 2. Attendance Summary for the date/shift
        const [attRes] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
            FROM attendance 
            WHERE date = ? AND shift = ?
        `, [date, shift]);

        // 3. Line/Machine Summary
        const [lineRes] = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM \`lines\` WHERE is_active = 1) as total_lines,
                (SELECT COUNT(*) FROM machines WHERE is_active = 1) as total_machines
        `);

        // 4. Assignment Summary (count ACTIVE shifts only)
        const [assignRes] = await pool.query(`
            SELECT COUNT(*) as assigned
            FROM worker_shift_logs
            WHERE DATE(start_time) = ? AND end_time IS NULL
        `, [date]);

        const stats = {
            totalWorkers: workerRes[0].count,
            presentToday: attRes[0].present || 0,
            absentToday: attRes[0].absent || 0,
            totalLines: lineRes[0].total_lines || 0,
            totalMachines: lineRes[0].total_machines || 0,
            assignedToday: assignRes[0].assigned || 0,
            benchToday: Math.max(0, (attRes[0].present || 0) - (assignRes[0].assigned || 0))
        };

        return NextResponse.json({ success: true, data: stats });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

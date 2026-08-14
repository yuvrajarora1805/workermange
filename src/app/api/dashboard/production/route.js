import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const period = searchParams.get('period') || 'day'; // day, week, month, year
        const shift = searchParams.get('shift');

        let shiftCondition = shift ? ' AND shift = ? ' : '';
        let dateCondition = 'date = ?';
        let params = [date];

        if (period === 'week') {
            dateCondition = 'YEARWEEK(date, 1) = YEARWEEK(?, 1)';
        } else if (period === 'month') {
            dateCondition = 'YEAR(date) = YEAR(?) AND MONTH(date) = MONTH(?)';
            params = [date, date];
        } else if (period === 'year') {
            dateCondition = 'YEAR(date) = YEAR(?)';
        }

        if (shift) params.push(shift);

        // 1. Total Production Stats
        const [prodStats] = await pool.query(`
            SELECT 
                SUM(actual_units) as total_products,
                SUM(defective_count) as total_defective
            FROM production_logs
            WHERE ${dateCondition} ${shiftCondition}
        `, params);
        
        const totalProducts = parseInt(prodStats[0].total_products || 0);
        const totalDefective = parseInt(prodStats[0].total_defective || 0);
        const totalCorrect = totalProducts - totalDefective;

        // 2. Active Worker Efficiency (Live Working Efficiency)
        // Get all active assignments and current shift logs to calculate live expected vs actuals
        const [activeWorkers] = await pool.query(`
            SELECT wsl.id as log_id, 
                   wsl.start_time,
                   w.id as worker_id,
                   w.name as worker_name, 
                   w.employee_id,
                   m.name as machine_name,
                   p.name as product_name,
                   p.hourly_target
            FROM worker_shift_logs wsl
            JOIN workers w ON w.id = wsl.worker_id
            JOIN machines m ON m.id = wsl.machine_id
            LEFT JOIN products p ON p.id = wsl.product_id
            WHERE wsl.end_time IS NULL
              AND wsl.start_time >= NOW() - INTERVAL 16 HOUR
        `);

        // We can't know REAL actuals until End Shift, but we know "Expected so far"
        // Wait, "Expected vs Actual" for live workers usually implies we can see what they've produced IF we have a way to input live production. 
        // We only input production at swap or end shift. So live dashboard shows their elapsed time and Expected units.
        const liveEfficiency = activeWorkers.map(w => {
            const hrs = (new Date() - new Date(w.start_time)) / 3600000;
            const expected = w.hourly_target ? Math.round(w.hourly_target * hrs) : 0;
            return {
                log_id: w.log_id,
                worker_id: w.worker_id,
                worker_name: w.worker_name,
                employee_id: w.employee_id,
                machine_name: w.machine_name,
                product_name: w.product_name || 'N/A',
                hours_active: hrs.toFixed(2),
                expected_target: expected
            };
        });

        // 3. Historical Production Logs for today (Closed shifts)
        const [closedLogs] = await pool.query(`
            SELECT pl.*, 
                   w.name as worker_name, 
                   w.employee_id,
                   m.name as machine_name,
                   p.name as product_name
            FROM production_logs pl
            JOIN workers w ON w.id = pl.worker_id
            JOIN machines m ON m.id = pl.machine_id
            LEFT JOIN products p ON p.id = pl.product_id
            WHERE ${dateCondition} ${shiftCondition}
            ORDER BY pl.date DESC, pl.id DESC
        `, params);

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalProducts,
                    totalCorrect,
                    totalDefective
                },
                liveWorkers: liveEfficiency,
                closedLogs: closedLogs
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

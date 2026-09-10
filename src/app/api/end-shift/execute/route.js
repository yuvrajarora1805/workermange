import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { date, shift, entries } = await request.json();

        if (!entries || entries.length === 0) {
            return NextResponse.json({ success: false, error: 'No entries provided to end shift.' }, { status: 400 });
        }

        const closeDate = date || new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        const activeShift = shift || (((hour > 7 || (hour === 7 && new Date().getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date().getMinutes() < 30))) ? 'day' : 'night');
        
        // Use local Date object directly for database queries to avoid the 5:30 timezone offset issue
        const now = new Date();

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Check for active downtimes for these specific lines or globally
            const lineIds = [...new Set(entries.map(e => e.line_id).filter(id => id != null))];
            let activeDowntimes = [];
            if (lineIds.length > 0) {
                const [dows] = await connection.query(`
                    SELECT id FROM downtime_logs 
                    WHERE end_time IS NULL AND (is_all_lines = 1 OR line_id IN (?))
                `, [lineIds]);
                activeDowntimes = dows;
            } else {
                const [dows] = await connection.query('SELECT id FROM downtime_logs WHERE end_time IS NULL AND is_all_lines = 1');
                activeDowntimes = dows;
            }

            if (activeDowntimes.length > 0) {
                throw new Error('Please end all active Downtime Logs for your lines before closing the shift.');
            }

            for (const entry of entries) {
                const { log_id, worker_id, machine_id, product_id, target_units, actual_units, defective_count, machine_fault_flag, line_id, low_efficiency_reason } = entry;
                
                // Get the start time of the shift log
                const [log] = await connection.query('SELECT start_time FROM worker_shift_logs WHERE id = ?', [log_id]);
                if (log.length === 0) continue;

                const hrs = (now - new Date(log[0].start_time)) / 3600000;

                // Close shift log
                await connection.query('UPDATE worker_shift_logs SET end_time = ?, total_hours = ?, product_id = COALESCE(product_id, ?) WHERE id = ?', [now, hrs, product_id, log_id]);

                // Insert into production logs
                await connection.query(
                    `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units, defective_count, machine_fault_flag, low_efficiency_reason) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                        actual_units = actual_units + VALUES(actual_units), 
                        target_units = target_units + VALUES(target_units),
                        defective_count = defective_count + VALUES(defective_count),
                        machine_fault_flag = IF(VALUES(machine_fault_flag) > 0, 1, machine_fault_flag),
                        low_efficiency_reason = COALESCE(VALUES(low_efficiency_reason), low_efficiency_reason)`,
                    [worker_id, machine_id, product_id, closeDate, activeShift, target_units, actual_units, defective_count || 0, machine_fault_flag ? 1 : 0, low_efficiency_reason]
                );
            }

            // Clear daily assignments unconditionally for the checked-out workers so machine cells become empty
            const workerIds = entries.map(e => e.worker_id);
            if (workerIds.length > 0) {
                await connection.query('DELETE FROM daily_assignments WHERE worker_id IN (?)', [workerIds]);
            }

            await connection.commit();
            return NextResponse.json({ success: true, message: 'Shift ended successfully. All logs closed.' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

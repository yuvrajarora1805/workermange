import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { date, shift, new_product_id, entries, machine_ids } = await request.json();

        if (!entries || entries.length === 0 || !new_product_id || !machine_ids || machine_ids.length === 0) {
            return NextResponse.json({ success: false, error: 'Missing required fields for changeover.' }, { status: 400 });
        }

        // Determine date and shift safely on the server as fallback
        const closeDate = date || new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
        const hour = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
        const activeShift = shift || (((hour > 7 || (hour === 7 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() < 30))) ? 'day' : 'night');
        
        const now = new Date();

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Close current shift segments
            for (const entry of entries) {
                const { log_id, worker_id, machine_id, product_id, target_units, actual_units, defective_count, machine_fault_flag, low_efficiency_reason } = entry;

                // Close the old worker_shift_logs
                const [wsl] = await connection.query('SELECT start_time FROM worker_shift_logs WHERE id = ?', [log_id]);
                if (wsl.length === 0) continue;

                const diffMs = now - new Date(wsl[0].start_time);
                const hrs = (diffMs / 3600000).toFixed(2);

                await connection.query(
                    'UPDATE worker_shift_logs SET end_time = ?, total_hours = ?, product_id = COALESCE(product_id, ?) WHERE id = ?', 
                    [now, hrs, product_id, log_id]
                );

                // Log production for the old product segment
                await connection.query(
                    `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units, defective_count, machine_fault_flag, low_efficiency_reason) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [worker_id, machine_id, product_id, closeDate, activeShift, target_units, actual_units, defective_count || 0, machine_fault_flag ? 1 : 0, low_efficiency_reason || null]
                );
                
                // Update daily_assignments to the new product
                await connection.query(
                    'UPDATE daily_assignments SET product_id = ? WHERE worker_id = ? AND date = ? AND shift = ?',
                    [new_product_id, worker_id, closeDate, activeShift]
                );

                // Open a NEW worker_shift_logs segment for the new product
                await connection.query(
                    'INSERT INTO worker_shift_logs (worker_id, machine_id, product_id, start_time) VALUES (?, ?, ?, ?)',
                    [worker_id, machine_id, new_product_id, now]
                );
            }

            // 2. Update the machine's current_product_id for all affected machines
            for (const m_id of machine_ids) {
                await connection.query(
                    'UPDATE machines SET current_product_id = ? WHERE id = ?',
                    [new_product_id, m_id]
                );
            }

            await connection.commit();
            return NextResponse.json({ success: true });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Changeover Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

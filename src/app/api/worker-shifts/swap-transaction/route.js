import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { source, targetWorkerId, targetMachineId, date, shift, sourceActuals, targetActuals, sourceShiftId, targetShiftId } = body;

        const swapDate = date || new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
        const hour = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
        const activeShift = shift || (((hour > 7 || (hour === 7 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() < 30))) ? 'day' : 'night');
        
        // Use local Date object directly for database queries to avoid the 5:30 timezone offset issue
        const now = new Date();

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const p1 = sourceActuals || 0;
            const p2 = targetActuals || 0;

            let sourceOriginalStartTime = null;
            let targetOriginalStartTime = null;

            const todayStr = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
            const isToday = (swapDate === todayStr);

            // 1. Close current shifts and log partial production if they exist (Only if swap is for today)
            // For Source Worker
            if (isToday && sourceShiftId) {
                const [sourceShift] = await connection.query('SELECT worker_id, machine_id, product_id, start_time FROM worker_shift_logs WHERE id = ?', [sourceShiftId]);
                if (sourceShift.length > 0) {
                    const ss = sourceShift[0];
                    sourceOriginalStartTime = ss.start_time;
                    const hrs = (now - new Date(ss.start_time)) / 3600000;
                    await connection.query('UPDATE worker_shift_logs SET end_time = ?, total_hours = ? WHERE id = ?', [now, hrs, sourceShiftId]);
                    
                    // Insert into production_logs
                    const [prodInfo] = await connection.query('SELECT hourly_target FROM products WHERE id = ?', [ss.product_id]);
                    const targetUnits = prodInfo[0] ? Math.round(prodInfo[0].hourly_target * hrs) : 0;
                    
                    await connection.query(
                        `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE actual_units = actual_units + VALUES(actual_units), target_units = target_units + VALUES(target_units)`,
                        [ss.worker_id, ss.machine_id, ss.product_id, swapDate, activeShift, targetUnits, p1]
                    );
                }
            }

            // For Target Worker (if Swap) (Only if swap is for today)
            if (isToday && targetShiftId) {
                const [targetShift] = await connection.query('SELECT worker_id, machine_id, product_id, start_time FROM worker_shift_logs WHERE id = ?', [targetShiftId]);
                if (targetShift.length > 0) {
                    const ts = targetShift[0];
                    targetOriginalStartTime = ts.start_time;
                    const hrs = (now - new Date(ts.start_time)) / 3600000;
                    await connection.query('UPDATE worker_shift_logs SET end_time = ?, total_hours = ? WHERE id = ?', [now, hrs, targetShiftId]);
                    
                    const [prodInfo] = await connection.query('SELECT hourly_target FROM products WHERE id = ?', [ts.product_id]);
                    const targetUnits = prodInfo[0] ? Math.round(prodInfo[0].hourly_target * hrs) : 0;
                    
                    await connection.query(
                        `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE actual_units = actual_units + VALUES(actual_units), target_units = target_units + VALUES(target_units)`,
                        [ts.worker_id, ts.machine_id, ts.product_id, swapDate, activeShift, targetUnits, p2]
                    );
                }
            }

            // 2. Perform assignments swap/move (simulating what the other endpoint did)
            const [a1] = await connection.query('SELECT machine_id, line_id, product_id FROM daily_assignments WHERE worker_id = ? AND date = ? AND shift = ?', [source.worker_id, swapDate, activeShift]);
            const [a2] = await connection.query('SELECT machine_id, line_id, product_id FROM daily_assignments WHERE worker_id = ? AND date = ? AND shift = ?', [targetWorkerId, swapDate, activeShift]);

            const assign1 = a1[0] || null;
            const assign2 = a2[0] || null;

            await connection.query(
                'DELETE FROM daily_assignments WHERE worker_id IN (?, ?) AND date = ? AND shift = ?',
                [source.worker_id, targetWorkerId || -1, swapDate, activeShift]
            );

            let newMachine1 = null;
            let newMachine2 = null;

            if (targetWorkerId && assign2) {
                // Swap
                if (assign2) {
                    await connection.query('INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual, assigned_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())', 
                                          [source.worker_id, assign2.machine_id, assign2.line_id, assign2.product_id, swapDate, activeShift]);
                    newMachine1 = assign2;
                }
                if (assign1) {
                    await connection.query('INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual, assigned_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())', 
                                          [targetWorkerId, assign1.machine_id, assign1.line_id, assign1.product_id, swapDate, activeShift]);
                    newMachine2 = assign1;
                }
            } else if (targetMachineId) {
                // Move logic
                const [machines] = await connection.query('SELECT line_id, current_product_id, worker_capacity FROM machines WHERE id = ?', [targetMachineId]);
                if (machines.length > 0) {
                    const machine = machines[0];
                    await connection.query('INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual, assigned_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())', 
                                          [source.worker_id, targetMachineId, machine.line_id, machine.current_product_id, swapDate, activeShift]);
                    newMachine1 = { machine_id: targetMachineId, product_id: machine.current_product_id };
                }
            }

            // 3. Open NEW shifts for the workers in their new locations (Only if swap is for today)
            // We use 'now' as the start_time because the previous production has already been logged.
            if (isToday) {
                if (newMachine1 && source.worker_id) {
                    await connection.query('INSERT INTO worker_shift_logs (worker_id, machine_id, product_id, start_time) VALUES (?, ?, ?, ?)', 
                                          [source.worker_id, newMachine1.machine_id, newMachine1.product_id, now]);
                }
                if (newMachine2 && targetWorkerId) {
                    await connection.query('INSERT INTO worker_shift_logs (worker_id, machine_id, product_id, start_time) VALUES (?, ?, ?, ?)', 
                                          [targetWorkerId, newMachine2.machine_id, newMachine2.product_id, now]);
                }
            }

            await connection.commit();
            return NextResponse.json({ success: true, message: 'Swap/Move successful' });
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

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    let connection;
    try {
        const body = await request.json();
        const { assignments, date, shift } = body;
        // assignments is an array of { worker_id, machine_id, actuals, defective, target }

        if (!Array.isArray(assignments) || assignments.length === 0) {
            return NextResponse.json({ success: false, error: 'No assignments provided' }, { status: 400 });
        }

        const assignDate = date || new Date().toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = (assignDate === todayStr);

        const hour = new Date().getHours();
        const activeShift = shift || ((hour >= 7 && hour < 19) ? 'day' : 'night');
        const now = new Date();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        for (const assignment of assignments) {
            const { worker_id, machine_id, actuals, defective, target } = assignment;

            // 1. Get current assignment for this worker to close their logs/production
            const [currentAssignment] = await connection.query(
                'SELECT id, machine_id, product_id, line_id FROM daily_assignments WHERE worker_id = ? AND date = ? AND shift = ?',
                [worker_id, assignDate, activeShift]
            );

            // If the worker is already assigned to a machine and it's today, close their shift log
            if (isToday && currentAssignment.length > 0) {
                const assignData = currentAssignment[0];
                const [activeLog] = await connection.query(
                    'SELECT id, start_time FROM worker_shift_logs WHERE worker_id = ? AND machine_id = ? AND end_time IS NULL LIMIT 1',
                    [worker_id, assignData.machine_id]
                );

                if (activeLog.length > 0) {
                    const hrs = (now - new Date(activeLog[0].start_time)) / 3600000;
                    let targetUnits = 0;
                    
                    if (target != null) {
                        targetUnits = target;
                    } else if (assignData.product_id) {
                        const [p] = await connection.query('SELECT hourly_target FROM products WHERE id = ?', [assignData.product_id]);
                        if (p.length > 0) {
                            targetUnits = Math.round(p[0].hourly_target * hrs);
                        }
                    }

                    // Close shift log
                    await connection.query('UPDATE worker_shift_logs SET end_time = ?, total_hours = ? WHERE id = ?', [now, hrs, activeLog[0].id]);
                    
                    // Log production
                    await connection.query(
                        `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units, defective_count) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                            actual_units = actual_units + VALUES(actual_units), 
                            target_units = target_units + VALUES(target_units),
                            defective_count = defective_count + VALUES(defective_count)`,
                        [worker_id, assignData.machine_id, assignData.product_id, assignDate, activeShift, targetUnits, actuals || 0, defective || 0]
                    );
                }
            }

            // 2. Delete the old assignment for this worker
            await connection.query(
                'DELETE FROM daily_assignments WHERE worker_id = ? AND date = ? AND shift = ?',
                [worker_id, assignDate, activeShift]
            );

            // 3. Insert new assignment (if a target machine is provided)
            // If machine_id is null/empty, it means they were sent to the bench
            if (machine_id) {
                // Get machine details
                const [machines] = await connection.query('SELECT line_id, current_product_id FROM machines WHERE id = ?', [machine_id]);
                if (machines.length > 0) {
                    const machine = machines[0];
                    await connection.query(
                        'INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual, assigned_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
                        [worker_id, machine_id, machine.line_id, machine.current_product_id, assignDate, activeShift]
                    );
                    
                    if (isToday) {
                        await connection.query(
                            'INSERT INTO worker_shift_logs (worker_id, machine_id, product_id, start_time) VALUES (?, ?, ?, NOW())',
                            [worker_id, machine_id, machine.current_product_id]
                        );
                    }
                }
            }
        }

        await connection.commit();
        return NextResponse.json({ success: true, message: 'Batch rearrangement saved successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

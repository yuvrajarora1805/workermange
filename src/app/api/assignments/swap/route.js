import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { worker1_id, worker2_id, date, shift, worker1_actuals, worker1_defective, worker1_target, worker2_actuals, worker2_defective, worker2_target } = body;

        if (!worker1_id || !worker2_id) {
            return NextResponse.json({ success: false, error: 'Two worker IDs required' }, { status: 400 });
        }

        const swapDate = date || new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
        const hour = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
        const activeShift = shift || (((hour > 7 || (hour === 7 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() < 30))) ? 'day' : 'night');

        // Get current assignments for both workers
        const [a1] = await pool.query(
            'SELECT machine_id, line_id, product_id FROM daily_assignments WHERE worker_id = ? AND date = ? AND shift = ?',
            [worker1_id, swapDate, activeShift]
        );
        const [a2] = await pool.query(
            'SELECT machine_id, line_id, product_id FROM daily_assignments WHERE worker_id = ? AND date = ? AND shift = ?',
            [worker2_id, swapDate, activeShift]
        );

        // If neither worker is assigned, we can't swap
        if (a1.length === 0 && a2.length === 0) {
            return NextResponse.json({ success: false, error: 'Neither worker is currently assigned' }, { status: 400 });
        }

        const assign1 = a1[0] || null;
        const assign2 = a2[0] || null;

        const now = new Date();
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            const todayStr = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
            const isToday = (swapDate === todayStr);

            // 1. Process Worker 1 logs & production (Only if swap is for today)
            if (isToday && assign1) {
                const [log1] = await connection.query(
                    'SELECT id, start_time FROM worker_shift_logs WHERE worker_id = ? AND machine_id = ? AND end_time IS NULL LIMIT 1',
                    [worker1_id, assign1.machine_id]
                );
                
                if (log1.length > 0) {
                    const hrs = (now - new Date(log1[0].start_time)) / 3600000;
                    let targetUnits = 0;
                    
                    if (worker1_target != null) {
                        targetUnits = worker1_target;
                    } else if (assign1.product_id) {
                        const [p1] = await connection.query('SELECT hourly_target FROM products WHERE id = ?', [assign1.product_id]);
                        if (p1.length > 0) {
                            targetUnits = Math.round(p1[0].hourly_target * hrs);
                        }
                    }

                    // Close shift log
                    await connection.query('UPDATE worker_shift_logs SET end_time = ?, total_hours = ? WHERE id = ?', [now, hrs, log1[0].id]);
                    
                    // Log production
                    await connection.query(
                        `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units, defective_count) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                            actual_units = actual_units + VALUES(actual_units), 
                            target_units = target_units + VALUES(target_units),
                            defective_count = defective_count + VALUES(defective_count)`,
                        [worker1_id, assign1.machine_id, assign1.product_id, swapDate, activeShift, targetUnits, worker1_actuals || 0, worker1_defective || 0]
                    );
                }
            }

            // 2. Process Worker 2 logs & production (Only if swap is for today)
            if (isToday && assign2) {
                const [log2] = await connection.query(
                    'SELECT id, start_time FROM worker_shift_logs WHERE worker_id = ? AND machine_id = ? AND end_time IS NULL LIMIT 1',
                    [worker2_id, assign2.machine_id]
                );
                
                if (log2.length > 0) {
                    const hrs = (now - new Date(log2[0].start_time)) / 3600000;
                    let targetUnits = 0;
                    
                    if (worker2_target != null) {
                        targetUnits = worker2_target;
                    } else if (assign2.product_id) {
                        const [p2] = await connection.query('SELECT hourly_target FROM products WHERE id = ?', [assign2.product_id]);
                        if (p2.length > 0) {
                            targetUnits = Math.round(p2[0].hourly_target * hrs);
                        }
                    }

                    // Close shift log
                    await connection.query('UPDATE worker_shift_logs SET end_time = ?, total_hours = ? WHERE id = ?', [now, hrs, log2[0].id]);
                    
                    // Log production
                    await connection.query(
                        `INSERT INTO production_logs (worker_id, machine_id, product_id, date, shift, target_units, actual_units, defective_count) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                            actual_units = actual_units + VALUES(actual_units), 
                            target_units = target_units + VALUES(target_units),
                            defective_count = defective_count + VALUES(defective_count)`,
                        [worker2_id, assign2.machine_id, assign2.product_id, swapDate, activeShift, targetUnits, worker2_actuals || 0, worker2_defective || 0]
                    );
                }
            }

            // 3. Clear existing assignments for both
            await connection.query(
                'DELETE FROM daily_assignments WHERE worker_id IN (?, ?) AND date = ? AND shift = ?',
                [worker1_id, worker2_id, swapDate, activeShift]
            );

            // 4. If Worker 1 was assigned, move them to Worker 2's old spot & open new log
            if (assign2) {
                await connection.query(
                    'INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual, assigned_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
                    [worker1_id, assign2.machine_id, assign2.line_id, assign2.product_id, swapDate, activeShift]
                );
                
                if (isToday) {
                    await connection.query(
                        'INSERT INTO worker_shift_logs (worker_id, machine_id, product_id, start_time) VALUES (?, ?, ?, NOW())',
                        [worker1_id, assign2.machine_id, assign2.product_id]
                    );
                }
            }

            // 5. If Worker 2 was assigned, move them to Worker 1's old spot & open new log
            if (assign1) {
                await connection.query(
                    'INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual, assigned_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
                    [worker2_id, assign1.machine_id, assign1.line_id, assign1.product_id, swapDate, activeShift]
                );
                
                if (isToday) {
                    await connection.query(
                        'INSERT INTO worker_shift_logs (worker_id, machine_id, product_id, start_time) VALUES (?, ?, ?, NOW())',
                        [worker2_id, assign1.machine_id, assign1.product_id]
                    );
                }
            }

            await connection.commit();
            return NextResponse.json({ success: true, message: 'Workers swapped successfully' });
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

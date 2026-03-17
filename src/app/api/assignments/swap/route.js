import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { worker1_id, worker2_id, date, shift } = body;

        if (!worker1_id || !worker2_id) {
            return NextResponse.json({ success: false, error: 'Two worker IDs required' }, { status: 400 });
        }

        const swapDate = date || new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        const activeShift = shift || ((hour >= 7 && hour < 19) ? 'day' : 'night');

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

        // Perform the swap in a transaction
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Clear existing assignments for both
            await connection.query(
                'DELETE FROM daily_assignments WHERE worker_id IN (?, ?) AND date = ? AND shift = ?',
                [worker1_id, worker2_id, swapDate, activeShift]
            );

            // If Worker 1 was assigned, move them to Worker 2's old spot
            if (assign2) {
                await connection.query(
                    'INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual) VALUES (?, ?, ?, ?, ?, ?, 1)',
                    [worker1_id, assign2.machine_id, assign2.line_id, assign2.product_id, swapDate, activeShift]
                );
            }

            // If Worker 2 was assigned, move them to Worker 1's old spot
            if (assign1) {
                await connection.query(
                    'INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual) VALUES (?, ?, ?, ?, ?, ?, 1)',
                    [worker2_id, assign1.machine_id, assign1.line_id, assign1.product_id, swapDate, activeShift]
                );
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

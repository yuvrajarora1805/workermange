import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { worker_id, machine_id, date } = body;

        if (!worker_id || !machine_id) {
            return NextResponse.json({ success: false, error: 'Worker ID and Machine ID required' }, { status: 400 });
        }

        const assignDate = date || new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        const shift = (hour >= 7 && hour < 19) ? 'day' : 'night';

        // Ensure machine and line info
        const [machines] = await pool.query('SELECT line_id, current_product_id, worker_capacity FROM machines WHERE id = ?', [machine_id]);
        if (machines.length === 0) return NextResponse.json({ success: false, error: 'Invalid machine' }, { status: 400 });

        const machine = machines[0];

        // Delete any existing assignment for this worker+shift on this date (always, as a worker can only be at one place)
        await pool.query('DELETE FROM daily_assignments WHERE worker_id = ? AND date = ? AND shift = ?', [worker_id, assignDate, shift]);
        
        // Check current assignments for this machine
        const [existing] = await pool.query(
            'SELECT id FROM daily_assignments WHERE machine_id = ? AND date = ? AND shift = ? ORDER BY assigned_at ASC',
            [machine_id, assignDate, shift]
        );

        // If at or over capacity, remove the oldest assignment to make room
        if (existing.length >= machine.worker_capacity) {
            const toDeleteCount = (existing.length - machine.worker_capacity) + 1;
            const idsToDelete = existing.slice(0, toDeleteCount).map(r => r.id);
            await pool.query('DELETE FROM daily_assignments WHERE id IN (?)', [idsToDelete]);
        }

        // Check for current active shift and close it if exists
        const [activeShift] = await pool.query('SELECT id, start_time FROM worker_shift_logs WHERE worker_id = ? AND end_time IS NULL LIMIT 1', [worker_id]);
        if (activeShift.length > 0) {
            const hrs = (new Date() - new Date(activeShift[0].start_time)) / 3600000;
            await pool.query('UPDATE worker_shift_logs SET end_time = NOW(), total_hours = ? WHERE id = ?', [hrs, activeShift[0].id]);
        }

        // Insert new manual assignment with shift
        await pool.query(
            'INSERT INTO daily_assignments (worker_id, machine_id, line_id, product_id, date, shift, is_manual) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [worker_id, machine_id, machine.line_id, machine.current_product_id, assignDate, shift]
        );

        // Open new shift log only if assigning for today
        const todayStr = new Date().toISOString().split('T')[0];
        if (assignDate === todayStr) {
            await pool.query(
                'INSERT INTO worker_shift_logs (worker_id, machine_id, product_id, start_time) VALUES (?, ?, ?, NOW())',
                [worker_id, machine_id, machine.current_product_id]
            );
        }

        return NextResponse.json({ success: true, message: `Manual ${shift} shift assignment saved` });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

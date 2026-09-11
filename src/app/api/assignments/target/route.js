import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// PATCH - update target_override for all assignments on a specific machine/date/shift
export async function PATCH(request) {
    try {
        const { machine_id, date, shift, target_override } = await request.json();
        if (!machine_id) return NextResponse.json({ success: false, error: 'Machine ID is required' }, { status: 400 });

        const targetDate = date || new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
        const hour = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
        const activeShift = shift || (((hour > 7 || (hour === 7 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() < 30))) ? 'day' : 'night');

        // First ensure the column exists
        try {
            await pool.query('SELECT target_override FROM daily_assignments LIMIT 0');
        } catch {
            await pool.query('ALTER TABLE daily_assignments ADD COLUMN target_override INT NULL DEFAULT NULL');
        }

        // Update all assignments for this machine on this date/shift
        const [result] = await pool.query(
            'UPDATE daily_assignments SET target_override = ? WHERE machine_id = ? AND date = ? AND shift = ?',
            [target_override || null, machine_id, targetDate, activeShift]
        );

        return NextResponse.json({ 
            success: true, 
            message: `Updated estimated production for ${result.affectedRows} assignment(s)` 
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

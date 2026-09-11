import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
        const shift = searchParams.get('shift') || 'day';

        // Find machines without a current product that have attendance on this date
        const [machinesWithoutProduct] = await pool.query(`
            SELECT DISTINCT m.id, m.name as machine_name, l.name as line_name
            FROM machines m
            JOIN \`lines\` l ON l.id = m.line_id
            WHERE m.is_active = 1 AND l.is_active = 1
            AND (m.current_product_id IS NULL OR m.current_product_id = 0)
            AND m.id IN (
                SELECT DISTINCT da.machine_id
                FROM daily_assignments da
                WHERE da.date = ? AND da.shift = ?
            )
            ORDER BY l.name, m.position
        `, [date, shift]);

        return NextResponse.json({
            success: true,
            data: {
                machinesWithoutProduct: machinesWithoutProduct
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

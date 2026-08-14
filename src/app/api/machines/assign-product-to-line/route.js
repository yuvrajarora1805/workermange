import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { line_id, product_id } = await request.json();

        if (!line_id || !product_id) {
            return NextResponse.json(
                { success: false, error: 'Line ID and Product ID are required' },
                { status: 400 }
            );
        }

        // Update all machines in this line to have the specified product
        const [result] = await pool.query(
            'UPDATE machines SET current_product_id = ? WHERE line_id = ? AND is_active = 1',
            [product_id, line_id]
        );

        return NextResponse.json({
            success: true,
            data: {
                message: `Assigned product to ${result.affectedRows} machines in this line`,
                updated_count: result.affectedRows
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

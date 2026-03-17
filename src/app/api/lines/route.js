import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all lines (with machine count)
export async function GET() {
    try {
        const [rows] = await pool.query(`
            SELECT l.*, COUNT(m.id) as machine_count 
            FROM \`lines\` l 
            LEFT JOIN machines m ON m.line_id = l.id AND m.is_active = 1
            GROUP BY l.id 
            ORDER BY l.name ASC
        `);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - create line
export async function POST(request) {
    try {
        const body = await request.json();
        const { name, description } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: 'Line name is required' }, { status: 400 });
        }

        const [result] = await pool.query(
            'INSERT INTO `lines` (name, description) VALUES (?, ?)',
            [name, description || null]
        );

        return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT - update line
export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, name, description, is_active } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Line ID is required' }, { status: 400 });
        }

        const fields = [];
        const params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (description !== undefined) { fields.push('description = ?'); params.push(description); }
        if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active); }

        if (fields.length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        params.push(id);
        await pool.query(`UPDATE \`lines\` SET ${fields.join(', ')} WHERE id = ?`, params);

        // If toggling line active status, cascade to all machines in this line
        if (is_active !== undefined) {
            await pool.query('UPDATE machines SET is_active = ? WHERE line_id = ?', [is_active, id]);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Line ID is required' }, { status: 400 });
        }

        await pool.query('DELETE FROM `lines` WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

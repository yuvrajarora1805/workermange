import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET machines (optionally by line_id)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const line_id = searchParams.get('line_id');

        let query = `
            SELECT m.*, l.name as line_name 
            FROM machines m 
            JOIN \`lines\` l ON l.id = m.line_id
        `;
        const params = [];

        if (line_id) {
            query += ' WHERE m.line_id = ?';
            params.push(parseInt(line_id));
        }

        query += ' ORDER BY m.line_id, m.position ASC';

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - create machine
export async function POST(request) {
    try {
        const body = await request.json();
        const { line_id, name, position, worker_capacity } = body;

        if (!line_id || !name) {
            return NextResponse.json({ success: false, error: 'Line ID and machine name are required' }, { status: 400 });
        }

        // Auto-assign position if not provided
        let pos = position;
        if (!pos) {
            const [maxPos] = await pool.query(
                'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM machines WHERE line_id = ?',
                [line_id]
            );
            pos = maxPos[0].next_pos;
        }

        const [result] = await pool.query(
            'INSERT INTO machines (line_id, name, position, worker_capacity) VALUES (?, ?, ?, ?)',
            [line_id, name, pos, worker_capacity || 1]
        );

        return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT - update machine
export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, name, position, is_active, line_id, current_product_id, worker_capacity } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Machine ID is required' }, { status: 400 });
        }

        const fields = [];
        const params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (position !== undefined) { fields.push('position = ?'); params.push(position); }
        if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active); }
        if (line_id !== undefined) { fields.push('line_id = ?'); params.push(line_id); }
        if (current_product_id !== undefined) { fields.push('current_product_id = ?'); params.push(current_product_id); }
        if (worker_capacity !== undefined) { fields.push('worker_capacity = ?'); params.push(worker_capacity); }

        if (fields.length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        params.push(id);
        await pool.query(`UPDATE machines SET ${fields.join(', ')} WHERE id = ?`, params);

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
            return NextResponse.json({ success: false, error: 'Machine ID is required' }, { status: 400 });
        }

        await pool.query('DELETE FROM machines WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

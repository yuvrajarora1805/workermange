import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all workers
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const active = searchParams.get('active');
        const id = searchParams.get('id');

        let query = 'SELECT id, name, employee_id, phone, skill_level, gender, is_active FROM workers';
        const params = [];
        const conditions = [];

        if (id) {
            conditions.push('id = ?');
            params.push(parseInt(id));
        }
        if (search) {
            conditions.push('(name LIKE ? OR employee_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        if (active !== null && active !== undefined && active !== '') {
            conditions.push('is_active = ?');
            params.push(parseInt(active));
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY name ASC';

        const [rows] = await pool.query(query, params);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - create new worker
export async function POST(request) {
    try {
        const body = await request.json();
        const { name, phone, employee_id, skill_level, gender } = body;

        if (!name || !employee_id) {
            return NextResponse.json({ success: false, error: 'Name and Employee ID are required' }, { status: 400 });
        }

        const [result] = await pool.query(
            'INSERT INTO workers (name, phone, employee_id, skill_level, gender) VALUES (?, ?, ?, ?, ?)',
            [name, phone || null, employee_id, skill_level || 'intermediate', gender || null]
        );

        return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ success: false, error: 'Employee ID already exists' }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT - update worker
export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, name, phone, employee_id, skill_level, is_active, gender } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Worker ID is required' }, { status: 400 });
        }

        const fields = [];
        const params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
        if (employee_id !== undefined) { fields.push('employee_id = ?'); params.push(employee_id); }
        if (skill_level !== undefined) { fields.push('skill_level = ?'); params.push(skill_level); }
        if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active); }
        if (gender !== undefined) { fields.push('gender = ?'); params.push(gender); }

        if (fields.length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        params.push(id);
        await pool.query(`UPDATE workers SET ${fields.join(', ')} WHERE id = ?`, params);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE - remove worker
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Worker ID is required' }, { status: 400 });
        }

        await pool.query('DELETE FROM workers WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

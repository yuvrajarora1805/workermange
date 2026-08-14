import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const empId = searchParams.get('emp_id');

    if (!empId) {
        return NextResponse.json({ success: false, error: 'Employee ID is required' }, { status: 400 });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Case-insensitive exact match
            const [rows] = await connection.query(
                'SELECT name FROM workers WHERE LOWER(employee_id) = LOWER(?) LIMIT 1',
                [empId]
            );

            if (rows.length > 0) {
                return NextResponse.json({ success: true, name: rows[0].name });
            } else {
                return NextResponse.json({ success: false, name: null });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching worker by ID:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { line_id, employee_id, worker_name } = body;

        if (!line_id || !employee_id) {
            return NextResponse.json({ success: false, error: 'Line and Employee ID are required' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.query(
                'INSERT INTO temp_allocations (line_id, employee_id, worker_name) VALUES (?, ?, ?)',
                [line_id, employee_id, worker_name || null]
            );

            return NextResponse.json({ success: true, message: 'Temporary allocation recorded successfully!' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error saving temp allocation:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

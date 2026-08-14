import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// Handle CORS preflight requests
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

// GET all products
export async function GET(request) {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY name ASC');
        return NextResponse.json({ success: true, data: rows }, {
            headers: {
                'Access-Control-Allow-Origin': '*', // Allows fetching from your other website
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - create a new product
export async function POST(request) {
    try {
        const { name, sap_code, description, hourly_target } = await request.json();
        if (!name) return NextResponse.json({ success: false, error: 'Product name is required' }, { status: 400 });

        const [result] = await pool.query(
            'INSERT INTO products (name, sap_code, description, hourly_target) VALUES (?, ?, ?, ?)',
            [name, sap_code || null, description || null, hourly_target || 0]
        );
        return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT - update a product
export async function PUT(request) {
    try {
        const { id, name, sap_code, description, hourly_target } = await request.json();
        if (!id) return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });

        await pool.query(
            'UPDATE products SET name = ?, sap_code = ?, description = ?, hourly_target = ? WHERE id = ?',
            [name, sap_code || null, description || null, hourly_target || 0, id]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PATCH - quick update hourly_target only
export async function PATCH(request) {
    try {
        const { id, hourly_target } = await request.json();
        if (!id) return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });

        await pool.query('UPDATE products SET hourly_target = ? WHERE id = ?', [hourly_target || 0, id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE a product
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
        await pool.query('DELETE FROM products WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

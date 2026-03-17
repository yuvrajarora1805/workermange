import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all products
export async function GET(request) {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY name ASC');
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST - create a new product
export async function POST(request) {
    try {
        const { name, sku, description } = await request.json();
        if (!name) return NextResponse.json({ success: false, error: 'Product name is required' }, { status: 400 });

        const [result] = await pool.query(
            'INSERT INTO products (name, sku, description) VALUES (?, ?, ?)',
            [name, sku || null, description || null]
        );
        return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT - update a product
export async function PUT(request) {
    try {
        const { id, name, sku, description } = await request.json();
        if (!id) return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });

        await pool.query(
            'UPDATE products SET name = ?, sku = ?, description = ? WHERE id = ?',
            [name, sku || null, description || null, id]
        );
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

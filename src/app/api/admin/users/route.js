import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getSessionUser } from '@/lib/auth-server';

// Helper to check if requester is Admin
async function checkAdmin() {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
        return null;
    }
    return user;
}

export async function GET() {
    const requester = await checkAdmin();
    if (!requester) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Admin role required.' }, { status: 403 });
    }

    try {
        const [users] = await db.query(
            'SELECT id, username, role, full_name, is_active, created_at FROM users ORDER BY created_at DESC'
        );
        return NextResponse.json({ success: true, data: users });
    } catch (e) {
        console.error('GET users error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req) {
    const requester = await checkAdmin();
    if (!requester) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Admin role required.' }, { status: 403 });
    }

    try {
        const { username, password, role, fullName } = await req.json();

        if (!username || !password || !role) {
            return NextResponse.json({ success: false, error: 'Username, password and role are required' }, { status: 400 });
        }

        const validRoles = ['admin', 'hr', 'supervisor', 'line_lead', 'production_team'];
        if (!validRoles.includes(role)) {
            return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
        }

        // Check if username already exists
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return NextResponse.json({ success: false, error: 'Username is already taken' }, { status: 409 });
        }

        // Hash password
        const passwordHash = hashPassword(password);

        // Insert user
        const [result] = await db.query(
            'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
            [username, passwordHash, role, fullName || '']
        );

        return NextResponse.json({
            success: true,
            data: {
                id: result.insertId,
                username,
                role,
                fullName
            }
        });
    } catch (e) {
        console.error('POST user error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(req) {
    const requester = await checkAdmin();
    if (!requester) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Admin role required.' }, { status: 403 });
    }

    try {
        const { id, username, password, role, fullName, isActive } = await req.json();

        if (!id) {
            return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        // Check if user exists
        const [existing] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
        if (existing.length === 0) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        let query = 'UPDATE users SET ';
        const params = [];
        const updates = [];

        if (username) {
            // Check if username taken by another user
            const [taken] = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
            if (taken.length > 0) {
                return NextResponse.json({ success: false, error: 'Username is already taken' }, { status: 409 });
            }
            updates.push('username = ?');
            params.push(username);
        }

        if (password) {
            updates.push('password_hash = ?');
            params.push(hashPassword(password));
        }

        if (role) {
            const validRoles = ['admin', 'hr', 'supervisor', 'line_lead', 'production_team'];
            if (!validRoles.includes(role)) {
                return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
            }
            updates.push('role = ?');
            params.push(role);
        }

        if (fullName !== undefined) {
            updates.push('full_name = ?');
            params.push(fullName);
        }

        if (isActive !== undefined) {
            updates.push('is_active = ?');
            params.push(isActive ? 1 : 0);
        }

        if (updates.length === 0) {
            return NextResponse.json({ success: false, error: 'No update parameters provided' }, { status: 400 });
        }

        query += updates.join(', ') + ' WHERE id = ?';
        params.push(id);

        await db.query(query, params);

        return NextResponse.json({ success: true, message: 'User updated successfully' });
    } catch (e) {
        console.error('PUT user error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

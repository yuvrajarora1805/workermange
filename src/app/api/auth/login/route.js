import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { signJWT } from '@/lib/jwt';

export async function POST(req) {
    try {
        const { username, password } = await req.json();
        
        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Username and password are required' }, { status: 400 });
        }

        // Query database
        const [users] = await db.query(
            'SELECT id, username, password_hash, role, full_name, is_active FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
        }

        const user = users[0];
        
        if (!user.is_active) {
            return NextResponse.json({ success: false, error: 'Account is deactivated' }, { status: 403 });
        }

        // Verify password
        const isPasswordCorrect = verifyPassword(password, user.password_hash);
        if (!isPasswordCorrect) {
            return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
        }

        // Check for line leader details if role is line_lead
        let assignedLines = [];
        if (user.role === 'line_lead') {
            const [assignments] = await db.query(
                'SELECT lla.line_id, l.name FROM line_leader_assignments lla JOIN `lines` l ON lla.line_id = l.id WHERE lla.user_id = ?',
                [user.id]
            );
            assignedLines = assignments.map(a => ({ id: a.line_id, name: a.name }));
        }

        // Sign JWT
        const tokenPayload = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        const token = await signJWT(tokenPayload);

        // Prepare response and set HTTP-only cookie
        const response = NextResponse.json({
            success: true,
            data: {
                id: user.id,
                username: user.username,
                role: user.role,
                fullName: user.full_name,
                assignedLines
            }
        });

        const maxAge = 30 * 24 * 60 * 60; // 30 days
        response.cookies.set('workermanage_session', token, {
            httpOnly: true,
            secure: req.headers.get('x-forwarded-proto') === 'https',
            sameSite: 'lax',
            path: '/',
            maxAge: maxAge
        });

        // Set non-HTTP-only cookies for UI reference / legacy code compatibility
        response.cookies.set('workermanage_role', user.role, { path: '/', maxAge: maxAge });
        response.cookies.set('workermanage_full_name', encodeURIComponent(user.full_name), { path: '/', maxAge: maxAge });
        
        if (assignedLines.length > 0) {
            response.cookies.set('workermanage_line_id', assignedLines[0].id.toString(), { path: '/', maxAge: maxAge });
            response.cookies.set('workermanage_line_name', encodeURIComponent(assignedLines[0].name), { path: '/', maxAge: maxAge });
        } else {
            response.cookies.delete('workermanage_line_id', { path: '/' });
            response.cookies.delete('workermanage_line_name', { path: '/' });
        }

        return response;
    } catch (e) {
        console.error('Login API error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

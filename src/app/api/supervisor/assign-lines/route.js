import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth-server';

// Helper to check if requester is Supervisor or Admin
async function checkAuthorized() {
    const user = await getSessionUser();
    if (!user || (user.role !== 'supervisor' && user.role !== 'admin')) {
        return null;
    }
    return user;
}

export async function GET(req) {
    const requester = await checkAuthorized();
    if (!requester) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Supervisor or Admin role required.' }, { status: 403 });
    }

    try {
        // Get all users who have the role of line_lead
        const [lineLeaders] = await db.query(
            'SELECT id, username, full_name, is_active FROM users WHERE role = "line_lead"'
        );

        // Get all line leader assignments
        const [assignments] = await db.query(
            'SELECT lla.user_id, lla.line_id, l.name as line_name FROM line_leader_assignments lla JOIN `lines` l ON lla.line_id = l.id'
        );

        // Group assignments by user_id
        const assignmentsMap = {};
        assignments.forEach(a => {
            if (!assignmentsMap[a.user_id]) {
                assignmentsMap[a.user_id] = [];
            }
            assignmentsMap[a.user_id].push({ id: a.line_id, name: a.line_name });
        });

        // Attach assignments to line leaders
        const result = lineLeaders.map(ll => ({
            ...ll,
            assignedLines: assignmentsMap[ll.id] || []
        }));

        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error('GET line assignments error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req) {
    const requester = await checkAuthorized();
    if (!requester) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Supervisor or Admin role required.' }, { status: 403 });
    }

    try {
        const { userId, lineIds } = await req.json();

        if (!userId || !Array.isArray(lineIds)) {
            return NextResponse.json({ success: false, error: 'userId and lineIds array are required' }, { status: 400 });
        }

        // Verify the user exists and is a line_lead
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }
        if (users[0].role !== 'line_lead') {
            return NextResponse.json({ success: false, error: 'User must be a Line Leader' }, { status: 400 });
        }

        // Syncing assignments: run in a transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Delete existing assignments for this user
            await connection.query('DELETE FROM line_leader_assignments WHERE user_id = ?', [userId]);

            // Insert new assignments
            if (lineIds.length > 0) {
                const insertValues = lineIds.map(lineId => [userId, lineId, requester.id]);
                await connection.query(
                    'INSERT INTO line_leader_assignments (user_id, line_id, assigned_by) VALUES ?',
                    [insertValues]
                );
            }

            await connection.commit();
            connection.release();

            return NextResponse.json({ success: true, message: 'Line assignments updated successfully' });
        } catch (transactionError) {
            await connection.rollback();
            connection.release();
            throw transactionError;
        }

    } catch (e) {
        console.error('POST line assignments error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

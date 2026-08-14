import { cookies } from 'next/headers';
import db from './db';
import { verifyJWT } from './jwt';

// Server authentication helper for App Router API Routes and Page Components
export async function getSessionUser() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('workermanage_session');
        
        if (!sessionCookie || !sessionCookie.value) {
            return null;
        }
        
        const payload = await verifyJWT(sessionCookie.value);
        if (!payload) return null;
        
        // Fetch fresh user data and assigned lines from the DB
        const [users] = await db.query(
            'SELECT id, username, role, full_name, is_active FROM users WHERE id = ? AND is_active = 1',
            [payload.id]
        );
        
        if (users.length === 0) return null;
        const user = users[0];
        
        // If line_lead, fetch assigned lines
        let assignedLines = [];
        if (user.role === 'line_lead') {
            const [assignments] = await db.query(
                'SELECT lla.line_id, l.name FROM line_leader_assignments lla JOIN `lines` l ON lla.line_id = l.id WHERE lla.user_id = ?',
                [user.id]
            );
            assignedLines = assignments.map(a => ({ id: a.line_id, name: a.name }));
        }
        
        return {
            ...user,
            assignedLines
        };
    } catch (e) {
        console.error('Error fetching session user:', e);
        return null;
    }
}

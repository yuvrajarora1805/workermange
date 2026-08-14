import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
        
        // Clear all authentication cookies
        response.cookies.delete('workermanage_session', { path: '/' });
        response.cookies.delete('workermanage_role', { path: '/' });
        response.cookies.delete('workermanage_full_name', { path: '/' });
        response.cookies.delete('workermanage_line_id', { path: '/' });
        response.cookies.delete('workermanage_line_name', { path: '/' });
        
        return response;
    } catch (e) {
        console.error('Logout API error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

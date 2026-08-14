import { NextResponse } from 'next/server';
import { verifyJWT } from './lib/jwt';

// Define which roles are allowed to access which page route paths
const ROLE_ROUTES = {
    admin: [
        '/',
        '/admin',
        '/workers',
        '/lines',
        '/products',
        '/attendance',
        '/assignments',
        '/efficiency',
        '/ratings',
        '/production',
        '/downtime',
        '/end-shift',
        '/supervisor/assign-lines',
        '/dashboard/production'
    ],
    supervisor: [
        '/',
        '/workers',
        '/lines',
        '/products',
        '/attendance',
        '/assignments',
        '/efficiency',
        '/ratings',
        '/production',
        '/downtime',
        '/end-shift',
        '/supervisor/assign-lines',
        '/dashboard/production'
    ],
    hr: [
        '/workers',
        '/attendance'
    ],
    line_lead: [
        '/',
        '/attendance',
        '/assignments',
        '/production',
        '/downtime',
        '/end-shift',
        '/dashboard/production'
    ],
    production_team: [
        '/lines',
        '/products',
        '/downtime'
    ]
};

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // 1. Allow public files and auth APIs to pass through without checks
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth') ||
        pathname === '/favicon.ico' ||
        pathname === '/login'
    ) {
        return NextResponse.next();
    }

    // 2. Retrieve session cookie
    const sessionToken = request.cookies.get('workermanage_session')?.value;

    // 3. If no session, handle redirection or JSON responses
    if (!sessionToken) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 4. Verify session token
    const payload = await verifyJWT(sessionToken);
    if (!payload) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ success: false, error: 'Session expired' }, { status: 401 });
        }
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('workermanage_session');
        return response;
    }

    const { role } = payload;

    // 5. If logged-in user tries to go to login, redirect to overview or their home page
    if (pathname === '/login') {
        const defaultPage = role === 'hr' ? '/attendance' : role === 'production_team' ? '/lines' : '/';
        return NextResponse.redirect(new URL(defaultPage, request.url));
    }

    // 6. API Routes pass-through: Let the API endpoints handle fine-grained scoping & role checks
    if (pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // 7. Page Access Control: Check if role has permission for this page path
    const allowedPaths = ROLE_ROUTES[role] || [];
    
    // Check if the current pathname starts with any of the allowed route prefixes
    const isAllowed = allowedPaths.some(allowedPath => {
        if (allowedPath === '/') {
            return pathname === '/';
        }
        return pathname.startsWith(allowedPath);
    });

    if (!isAllowed) {
        // Redirect to their default page if they access unauthorized paths
        const defaultPage = role === 'hr' ? '/attendance' : role === 'production_team' ? '/lines' : '/';
        return NextResponse.redirect(new URL(defaultPage, request.url));
    }

    return NextResponse.next();
}

// Apply middleware to all paths except static files or public folders
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|public/|assets/).*)',
    ],
};

import crypto from 'crypto';

// Password hashing helper using PBKDF2
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

// Password verification helper
export function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

// SERVER SIDE SCOPING HELPER (Synchronous, parsed from request headers, client safe)
export function getServerScope(cookieString = '') {
    const parsedCookies = {};
    if (cookieString) {
        cookieString.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts[0]) {
                parsedCookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
            }
        });
    }

    const role = parsedCookies['workermanage_role'] || 'guest';
    const lineId = parsedCookies['workermanage_line_id'];
    const lineName = parsedCookies['workermanage_line_name'] || 'N/A';
    const fullName = parsedCookies['workermanage_full_name'] || 'User';

    return {
        role,
        fullName: decodeURIComponent(fullName),
        lineId: lineId ? parseInt(lineId) : null,
        lineName: decodeURIComponent(lineName)
    };
}

// CLIENT SIDE HELPER
export function getClientScope() {
    if (typeof window === 'undefined') {
        return { role: 'guest', lineId: null, lineName: 'N/A' };
    }

    const parsedCookies = {};
    document.cookie.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        if (parts[0]) {
            parsedCookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
        }
    });

    const role = parsedCookies['workermanage_role'] || 'guest';
    const lineId = parsedCookies['workermanage_line_id'];
    const lineName = parsedCookies['workermanage_line_name'] || 'N/A';
    const fullName = parsedCookies['workermanage_full_name'] || 'User';

    return {
        role,
        fullName: decodeURIComponent(fullName),
        lineId: lineId ? parseInt(lineId) : null,
        lineName: decodeURIComponent(lineName)
    };
}

export function setClientScope(role, lineId = null, lineName = 'N/A', fullName = '') {
    if (typeof window === 'undefined') return;
    
    const maxAge = 30 * 24 * 60 * 60;
    document.cookie = `workermanage_role=${role}; path=/; max-age=${maxAge}`;
    if (fullName) {
        document.cookie = `workermanage_full_name=${encodeURIComponent(fullName)}; path=/; max-age=${maxAge}`;
    }
    if (lineId) {
        document.cookie = `workermanage_line_id=${lineId}; path=/; max-age=${maxAge}`;
        document.cookie = `workermanage_line_name=${encodeURIComponent(lineName)}; path=/; max-age=${maxAge}`;
    } else {
        document.cookie = `workermanage_line_id=; path=/; max-age=0`;
        document.cookie = `workermanage_line_name=; path=/; max-age=0`;
    }
}

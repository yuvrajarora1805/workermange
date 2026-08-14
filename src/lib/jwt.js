// Runtime-agnostic JWT library using Web Crypto API (works in Node and Edge Middleware)

const JWT_SECRET = process.env.JWT_SECRET || 'workermanage-super-secret-key-123456!';

function base64urlEncode(str) {
    const base64 = btoa(str);
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return atob(base64);
}

// Convert string to ArrayBuffer
function textToBuffer(text) {
    return new TextEncoder().encode(text);
}

async function getHmacKey(secret) {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

export async function signJWT(payload, expSeconds = 30 * 24 * 60 * 60) {
    const header = { alg: 'HS256', typ: 'JWT' };
    
    // Add expiration
    const now = Math.floor(Date.now() / 1000);
    const expPayload = {
        ...payload,
        iat: now,
        exp: now + expSeconds
    };
    
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(expPayload));
    
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    const key = await getHmacKey(JWT_SECRET);
    
    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        textToBuffer(dataToSign)
    );
    
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureString = String.fromCharCode(...signatureArray);
    const encodedSignature = base64urlEncode(signatureString);
    
    return `${dataToSign}.${encodedSignature}`;
}

export async function verifyJWT(token) {
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;
    
    try {
        const key = await getHmacKey(JWT_SECRET);
        
        // Decode signature back to binary characters, then to ArrayBuffer
        const signatureString = base64urlDecode(encodedSignature);
        const signatureBytes = new Uint8Array(
            signatureString.split('').map(c => c.charCodeAt(0))
        );
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            textToBuffer(dataToVerify)
        );
        
        if (!isValid) return null;
        
        const payload = JSON.parse(base64urlDecode(encodedPayload));
        
        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && now > payload.exp) {
            return null; // Expired
        }
        
        return payload;
    } catch (e) {
        console.error('JWT verify error:', e);
        return null;
    }
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setClientScope } from '@/lib/auth';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await res.json();
            
            if (res.ok && result.success) {
                const { role, fullName, assignedLines } = result.data;
                
                // Initialize client scope cookie settings
                const activeLine = assignedLines && assignedLines.length > 0 ? assignedLines[0] : null;
                setClientScope(
                    role,
                    activeLine ? activeLine.id : null,
                    activeLine ? activeLine.name : 'N/A',
                    fullName
                );
                
                // Redirect user based on role
                if (role === 'hr') {
                    router.push('/attendance');
                } else if (role === 'production_team') {
                    router.push('/lines');
                } else {
                    router.push('/');
                }
                
                // Force a reload to refresh layouts/state
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            } else {
                setError(result.error || 'Invalid credentials');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100%',
            background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 11, 20) 90%)',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            padding: '20px',
            boxSizing: 'border-box',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                padding: '40px',
                width: '100%',
                maxWidth: '440px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
                textAlign: 'center'
            }}>
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ 
                        fontSize: '42px', 
                        marginBottom: '12px',
                        animation: 'pulse 3s infinite'
                    }}>⚙️</div>
                    <h2 style={{
                        color: '#fff',
                        fontSize: '28px',
                        fontWeight: '800',
                        margin: '0 0 8px 0',
                        letterSpacing: '-0.5px',
                        background: 'linear-gradient(135deg, #fff 0%, #cbd5e1 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>WorkerManage</h2>
                    <p style={{
                        color: '#94a3b8',
                        fontSize: '14px',
                        margin: 0
                    }}>Sign in to access your factory dashboard</p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        color: '#f87171',
                        fontSize: '13px',
                        marginBottom: '24px',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label style={{
                            color: '#94a3b8',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            display: 'block',
                            marginBottom: '8px'
                        }}>Username</label>
                        <input
                            type="text"
                            required
                            placeholder="Enter username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                padding: '14px 16px',
                                color: '#fff',
                                fontSize: '15px',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => {
                                e.target.style.border = '1px solid #3b82f6';
                                e.target.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.2)';
                            }}
                            onBlur={(e) => {
                                e.target.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label style={{
                            color: '#94a3b8',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            display: 'block',
                            marginBottom: '8px'
                        }}>Password</label>
                        <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                padding: '14px 16px',
                                color: '#fff',
                                fontSize: '15px',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => {
                                e.target.style.border = '1px solid #3b82f6';
                                e.target.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.2)';
                            }}
                            onBlur={(e) => {
                                e.target.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '14px',
                            fontSize: '16px',
                            fontWeight: '700',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                            transition: 'all 0.2s ease',
                            marginTop: '10px'
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) e.target.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) e.target.style.transform = 'translateY(0)';
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

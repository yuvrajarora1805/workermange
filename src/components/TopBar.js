'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClientScope, setClientScope } from '@/lib/auth';

export default function TopBar({ onMenuClick }) {
    const [scope, setScope] = useState({ role: 'guest', lineId: null, lineName: 'N/A', fullName: 'User' });
    const [lines, setLines] = useState([]);
    const [assignedLines, setAssignedLines] = useState([]);
    const router = useRouter();

    useEffect(() => {
        // Load initial client scope cookies
        setScope(getClientScope());

        // Fetch current user and their assigned lines
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(result => {
                if (result.success && result.data) {
                    const user = result.data;
                    setScope(prev => ({
                        ...prev,
                        fullName: user.full_name,
                        role: user.role
                    }));
                    if (user.assignedLines) {
                        setAssignedLines(user.assignedLines);
                    }
                }
            })
            .catch(err => console.error('Failed to load profile in TopBar:', err));

        // Fetch all active lines (for Admins/Supervisors)
        fetch('/api/lines')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setLines(data.data.filter(l => l.is_active));
                }
            })
            .catch(err => console.error('Failed to load lines for switcher:', err));
    }, []);

    const handleLineChange = (e) => {
        const value = e.target.value;
        if (value === 'all') {
            // Full factory view
            setClientScope(scope.role, null, 'N/A', scope.fullName);
            // Delete cookies for active line to reset scope
            document.cookie = `workermanage_active_line_id=; path=/; max-age=0`;
        } else {
            const lineId = parseInt(value);
            const lineList = scope.role === 'line_lead' ? assignedLines : lines;
            const line = lineList.find(l => l.id === lineId || l.line_id === lineId);
            const name = line ? (line.name || line.line_name) : 'N/A';
            
            setClientScope(scope.role, lineId, name, scope.fullName);
            // Set cookie for active line id
            const maxAge = 30 * 24 * 60 * 60;
            document.cookie = `workermanage_active_line_id=${lineId}; path=/; max-age=${maxAge}`;
        }
        window.location.reload();
    };

    const handleLogout = async () => {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                router.push('/login');
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            }
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const getRoleBadgeColor = (role) => {
        switch(role) {
            case 'admin': return '#ef4444'; // Red
            case 'supervisor': return '#f59e0b'; // Amber
            case 'hr': return '#3b82f6'; // Blue
            case 'line_lead': return '#10b981'; // Emerald
            case 'production_team': return '#8b5cf6'; // Purple
            default: return '#6b7280'; // Gray
        }
    };

    // Determine line context options to display
    const showLineSwitcher = ['admin', 'supervisor', 'line_lead'].includes(scope.role);
    const lineOptions = scope.role === 'line_lead' ? assignedLines : lines;
    
    // Determine active value
    const activeValue = scope.lineId || 'all';

    return (
        <header className="topbar" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', height: '60px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="menu-toggle" onClick={onMenuClick} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '22px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>
                    ☰
                </button>
                {/* Logo — only visible on mobile (desktop sidebar already shows it) */}
                <div className="topbar-logo" style={{ fontWeight: 800, fontSize: '17px', background: 'var(--gradient-1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    ⚙️ WorkerManage
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {/* Dynamic Line Context Switcher */}
                {showLineSwitcher && lineOptions.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="hide-on-mobile" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            🏭 Line Scope:
                        </span>
                        <select
                            value={activeValue}
                            onChange={handleLineChange}
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '6px',
                                color: 'white',
                                padding: '8px 12px',
                                fontSize: '16px',
                                fontWeight: '600',
                                outline: 'none',
                                cursor: 'pointer',
                                transition: 'var(--transition)',
                                maxWidth: '160px'
                            }}
                        >
                            {scope.role !== 'line_lead' && (
                                <option value="all" style={{ color: '#1e293b', background: '#ffffff' }}>👑 Full Factory</option>
                            )}
                            {lineOptions.map(line => (
                                <option key={line.id || line.line_id} value={line.id || line.line_id} style={{ color: '#1e293b', background: '#ffffff' }}>
                                    👷 {line.name || line.line_name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Profile and Logout Actions */}
                <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
                    <div style={{ textAlign: 'right', display: 'none', md: 'block' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{scope.fullName || 'User'}</div>
                        <span style={{
                            display: 'inline-block',
                            fontSize: '9px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            background: getRoleBadgeColor(scope.role),
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginTop: '2px'
                        }}>
                            {scope.role}
                        </span>
                    </div>

                    <button
                        onClick={handleLogout}
                        title="Logout"
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '6px',
                            color: '#ef4444',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                    >
                        <span>🚪</span>
                        <span className="hide-on-mobile"> Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
}

'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getClientScope } from '@/lib/auth';

export default function Sidebar({ isOpen, onClose, pendingCount = 0, alertActive = false }) {
    const pathname = usePathname();
    const [scope, setScope] = useState({ role: 'guest', lineId: null, lineName: 'N/A' });

    useEffect(() => {
        setScope(getClientScope());
    }, [pathname]);

    // Role-based navigation configuration
    const navLinks = [
        { href: '/', label: 'Overview', icon: '📊', roles: ['admin', 'supervisor', 'line_lead'] },
        { href: '/dashboard/production', label: 'Dashboard', icon: '📈', roles: ['admin', 'supervisor', 'line_lead'] },
        { href: '/admin/users', label: 'Users & Roles', icon: '👤', roles: ['admin'] },
        { href: '/supervisor/assign-lines', label: 'Line Assignments', icon: '⛓️', roles: ['admin', 'supervisor'] },
        { href: '/workers', label: 'Workers', icon: '👷', roles: ['admin', 'supervisor', 'hr'] },
        { href: '/lines', label: 'Lines & Machines', icon: '🏭', roles: ['admin', 'supervisor', 'production_team'] },
        { href: '/products', label: 'Products & Targets', icon: '📦', roles: ['admin', 'supervisor', 'production_team'] },
        { href: '/attendance', label: 'Attendance', icon: '📋', roles: ['admin', 'supervisor', 'hr', 'line_lead'] },
        { href: '/assignments', label: 'Assignments', icon: '🔧', roles: ['admin', 'supervisor', 'line_lead'] },
        { href: '/efficiency', label: 'Efficiency', icon: '📈', roles: ['admin', 'supervisor'] },
        { href: '/ratings', label: 'Ratings', icon: '⭐', roles: ['admin', 'supervisor'] },
        { href: '/production', label: 'Production Logs', icon: '🏭', roles: ['admin', 'supervisor', 'line_lead'] },
        { href: '/downtime', label: 'Downtime Logs', icon: '⏱️', roles: ['admin', 'supervisor', 'line_lead', 'production_team'] },
        { href: '/changeover', label: 'Changeover', icon: '🔄', roles: ['admin', 'supervisor', 'line_lead'] },
        { href: '/end-shift', label: 'End Shift', icon: '🏁', roles: ['admin', 'supervisor', 'line_lead'] },
    ];

    const filteredLinks = navLinks.filter(link => link.roles.includes(scope.role));

    const getRoleDisplayName = (r) => {
        switch(r) {
            case 'admin': return 'Administrator';
            case 'supervisor': return 'Supervisor';
            case 'hr': return 'HR Manager';
            case 'line_lead': return 'Line Leader';
            case 'production_team': return 'Production Team';
            default: return 'Guest';
        }
    };

    return (
        <>
            <aside className={`sidebar ${isOpen ? 'show' : ''}`} id="sidebar">
                {/* Logo header — always rendered, brand text hidden on mobile via CSS */}
                <div className="sidebar-logo">
                    <div className="sidebar-brand">
                        <h1>⚙️ WorkerManage</h1>
                        <p style={{ color: scope.role === 'line_lead' ? 'var(--info)' : 'var(--text-muted)' }}>
                            {scope.role === 'line_lead' ? `${scope.lineName} Lead` : getRoleDisplayName(scope.role)}
                        </p>
                    </div>
                    {/* Close button — always visible on mobile (positioned by CSS flex) */}
                    <button
                        className="mobile-close"
                        onClick={onClose}
                        aria-label="Close menu"
                        style={{ fontSize: '22px', padding: '4px 8px' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable nav — flex:1 + min-height:0 + overflow-y:auto in CSS */}
                <nav className="sidebar-nav">
                    {filteredLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className={`nav-link ${pathname === link.href ? 'active' : ''}`}
                            onClick={onClose}
                            style={{ display: 'flex', alignItems: 'center' }}
                        >
                            <span className="nav-icon">{link.icon}</span>
                            <span>{link.label}</span>
                            {link.href === '/end-shift' && pendingCount > 0 && (
                                <span
                                    style={{
                                        marginLeft: 'auto',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        background: alertActive ? 'var(--danger, #ef4444)' : 'var(--info, #3b82f6)',
                                        color: 'white',
                                        flexShrink: 0
                                    }}
                                >
                                    {pendingCount}
                                </span>
                            )}
                        </a>
                    ))}
                </nav>
            </aside>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
        </>
    );
}

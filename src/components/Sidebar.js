'use client';

import { usePathname } from 'next/navigation';

export default function Sidebar({ isOpen, onClose }) {
    const pathname = usePathname();

    const navLinks = [
        { href: '/', label: 'Dashboard', icon: '📊' },
        { href: '/workers', label: 'Workers', icon: '👷' },
        { href: '/lines', label: 'Lines & Machines', icon: '🏭' },
        { href: '/products', label: 'Products', icon: '📦' },
        { href: '/attendance', label: 'Attendance', icon: '📋' },
        { href: '/assignments', label: 'Assignments', icon: '🔧' },
        { href: '/efficiency', label: 'Efficiency', icon: '📈' },
        { href: '/ratings', label: 'Ratings', icon: '⭐' },
        { href: '/production', label: 'Production Logs', icon: '🏭' },
    ];

    return (
        <>
            <aside className={`sidebar ${isOpen ? 'show' : ''}`} id="sidebar">
                <div className="sidebar-logo">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1>⚙️ WorkerManage</h1>
                            <p>Smart Allocation System</p>
                        </div>
                        <button className="mobile-close" onClick={onClose}>✕</button>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className={`nav-link ${pathname === link.href ? 'active' : ''}`}
                            onClick={onClose}
                        >
                            <span className="nav-icon">{link.icon}</span>
                            {link.label}
                        </a>
                    ))}
                </nav>
            </aside>
            {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
        </>
    );
}

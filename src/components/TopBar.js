'use client';

export default function TopBar({ onMenuClick }) {
    return (
        <header className="topbar">
            <button className="menu-toggle" onClick={onMenuClick}>
                ☰
            </button>
            <div className="topbar-logo">
                ⚙️ WorkerManage
            </div>
            <div style={{ width: '40px' }}></div> {/* Spacer */}
        </header>
    );
}

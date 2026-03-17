'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function LayoutShell({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="app-wrapper">
            <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
            <Sidebar 
                isOpen={isSidebarOpen} 
                onClose={() => setIsSidebarOpen(false)} 
            />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}

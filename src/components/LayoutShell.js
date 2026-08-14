'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function LayoutShell({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [alertActive, setAlertActive] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        checkPendingShifts();
    }, [pathname]);

    useEffect(() => {
        // Poll every 60 seconds
        const interval = setInterval(checkPendingShifts, 60000);
        return () => clearInterval(interval);
    }, []);

    async function checkPendingShifts() {
        try {
            const res = await fetch('/api/end-shift/pending');
            const result = await res.json();
            if (result.success && result.data) {
                const data = result.data;
                setPendingCount(data.length);
                
                if (data.length > 0) {
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentDay = now.getDate();
                    
                    const hasCompletedShifts = data.some(s => {
                        const start = new Date(s.start_time);
                        const startHour = start.getHours();
                        const startDay = start.getDate();
                        const diffHrs = (now - start) / 3600000;
                        
                        // Shift boundaries are 7:00 AM (7) and 7:00 PM (19)
                        // Day shift started: 7 AM - 7 PM
                        const isDayShiftCompleted = (startHour >= 7 && startHour < 19) && 
                            (currentHour >= 19 || currentHour < 7 || currentDay !== startDay);
                        
                        // Night shift started: 7 PM - 7 AM
                        const isNightShiftCompleted = (startHour >= 19 || startHour < 7) && 
                            (currentHour >= 7 && currentHour < 19 && currentDay !== startDay);
                            
                        return isDayShiftCompleted || isNightShiftCompleted || diffHrs >= 12;
                    });
                    
                    setAlertActive(hasCompletedShifts);
                } else {
                    setAlertActive(false);
                }
            }
        } catch (err) {
            console.error('Failed to check pending shifts:', err);
        }
    }

    return (
        <div className="app-wrapper">
            <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
            <Sidebar 
                isOpen={isSidebarOpen} 
                onClose={() => setIsSidebarOpen(false)} 
                pendingCount={pendingCount}
                alertActive={alertActive}
            />
            <main className="main-content">
                {alertActive && (
                    <div 
                        onClick={() => router.push('/end-shift')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            padding: '14px 20px',
                            marginBottom: '24px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.1)',
                            backdropFilter: 'blur(10px)',
                            color: '#fff',
                            gap: '12px'
                        }}
                        className="pending-checkout-alert"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '20px' }}>⏰</span>
                            <div style={{ textAlign: 'left' }}>
                                <strong style={{ color: '#f87171', fontSize: '15px' }}>Shift Completed Alert</strong>
                                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>
                                    The shift has ended. {pendingCount} worker{pendingCount > 1 ? 's are' : ' is'} still checked in. Click here to validate and close.
                                </div>
                            </div>
                        </div>
                        <button 
                            style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Check Out &rarr;
                        </button>
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}

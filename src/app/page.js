'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalWorkers: 0,
        presentToday: 0,
        totalLines: 0,
        totalMachines: 0,
        assignedToday: 0,
        benchToday: 0,
    });
    const [recentAssignments, setRecentAssignments] = useState([]);
    const [topWorkers, setTopWorkers] = useState([]);
    const [loading, setLoading] = useState(true);

    const currentShift = (() => {
        const hour = new Date().getHours();
        return (hour >= 7 && hour < 19) ? 'day' : 'night';
    })();

    useEffect(() => {
        loadDashboard();
    }, []);

    async function loadDashboard() {
        try {
            const [workersRes, linesRes, attendanceRes, assignmentsRes, efficiencyRes] = await Promise.all([
                fetch('/api/workers').then(r => r.json()),
                fetch('/api/lines').then(r => r.json()),
                fetch('/api/attendance').then(r => r.json()),
                fetch(`/api/assignments?shift=${currentShift}`).then(r => r.json()),
                fetch('/api/efficiency').then(r => r.json()),
            ]);

            const totalMachines = linesRes.data?.reduce((sum, l) => sum + parseInt(l.machine_count || 0), 0) || 0;

            setStats({
                totalWorkers: workersRes.data?.length || 0,
                presentToday: attendanceRes.data?.summary?.present || 0,
                totalLines: linesRes.data?.length || 0,
                totalMachines,
                assignedToday: assignmentsRes.data?.summary?.total_assigned || 0,
                benchToday: assignmentsRes.data?.summary?.total_bench || 0,
            });

            // Flatten assignments for recent view
            const allAssignments = [];
            if (assignmentsRes.data?.assignments) {
                for (const line of assignmentsRes.data.assignments) {
                    for (const m of line.machines) {
                        allAssignments.push(m);
                    }
                }
            }
            setRecentAssignments(allAssignments.slice(0, 10));

            // Top 5 workers
            if (efficiencyRes.data) {
                setTopWorkers(efficiencyRes.data.slice(0, 5));
            }
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    }

    function getEfficiencyClass(score) {
        if (score >= 70) return 'efficiency-high';
        if (score >= 50) return 'efficiency-medium';
        if (score >= 30) return 'efficiency-low';
        return 'efficiency-poor';
    }

    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="loader"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2>📊 Dashboard</h2>
                    <span className={`badge ${currentShift === 'day' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: '12px', padding: '4px 8px' }}>
                        {currentShift === 'day' ? '☀️ Day Shift' : '🌙 Night Shift'}
                    </span>
                </div>
                <p>Overview of today&apos;s operations ({new Date().toLocaleDateString()})</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👷</div>
                    <div className="stat-value">{stats.totalWorkers}</div>
                    <div className="stat-label">Total Workers</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-value">{stats.presentToday}</div>
                    <div className="stat-label">Present Today</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🏭</div>
                    <div className="stat-value">{stats.totalLines}</div>
                    <div className="stat-label">Active Lines</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🔧</div>
                    <div className="stat-value">{stats.assignedToday}/{stats.totalMachines}</div>
                    <div className="stat-label">Machines Filled</div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Top Workers */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">🏆 Top Workers by Efficiency</h3>
                    </div>
                    {topWorkers.length > 0 ? (
                        <div className="table-wrapper">
                            <table className="mobile-stack-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Worker</th>
                                        <th>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topWorkers.map((w, i) => (
                                        <tr key={w.worker_id}>
                                            <td data-label="Rank" style={{ fontWeight: 700, color: i === 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                            </td>
                                            <td data-label="Worker">
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.worker_name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{w.employee_id}</div>
                                            </td>
                                            <td data-label="Score">
                                                <span className={`efficiency-badge ${getEfficiencyClass(w.total_score)}`}>
                                                    {w.total_score}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">📈</div>
                            <h3>No efficiency data yet</h3>
                            <p>Add production logs and ratings to see scores</p>
                        </div>
                    )}
                </div>

                {/* Recent Assignments */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">🔧 Today&apos;s Assignments</h3>
                        <a href="/assignments" className="btn btn-ghost btn-sm">View All</a>
                    </div>
                    {recentAssignments.length > 0 ? (
                        <div className="table-wrapper">
                            <table className="mobile-stack-table">
                                <thead>
                                    <tr>
                                        <th>Worker</th>
                                        <th>Machine</th>
                                        <th>Line</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentAssignments.map((a, i) => (
                                        <tr key={i}>
                                            <td data-label="Worker" style={{ fontWeight: 500 }}>{a.worker_name}</td>
                                            <td data-label="Machine"><span className="badge badge-info">{a.machine_name}</span></td>
                                            <td data-label="Line" style={{ color: 'var(--text-muted)' }}>{a.line_name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">📋</div>
                            <h3>No assignments yet</h3>
                            <p>Mark attendance and run auto-assignment</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

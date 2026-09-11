'use client';

import { useState, useEffect } from 'react';

export default function ProductionDashboard() {
    const [data, setData] = useState({
        summary: { totalProducts: 0, totalCorrect: 0, totalDefective: 0 },
        liveWorkers: [],
        closedLogs: []
    });
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('day'); // day, week, month, year
    const [logFilter, setLogFilter] = useState({ worker: '', product: '' });
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return new Date(d.toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
    });
    
    // Auto refresh live data every minute
    const [lastRefresh, setLastRefresh] = useState(new Date());

    useEffect(() => {
        loadData();
        const interval = setInterval(() => {
            // Only auto-refresh if looking at "today" or "live" context
            // But we'll just refresh regardless for now
            loadData();
            setLastRefresh(new Date());
        }, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, [selectedDate, period]);

    async function loadData() {
        try {
            const res = await fetch(`/api/dashboard/production?date=${selectedDate}&period=${period}`);
            const result = await res.json();
            if (result.success) setData(result.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function deleteLog(id) {
        if (!confirm('Are you sure you want to delete this production log?')) return;
        try {
            const res = await fetch(`/api/production?id=${id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                loadData();
            } else {
                alert(result.error || 'Failed to delete');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting log');
        }
    }

    if (loading) return <div className="loading-overlay"><div className="loader"></div><p>Loading Dashboard...</p></div>;

    return (
        <>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2>📈 Production Dashboard</h2>
                    <p>Tracking shift goals, overall production quality, and active targets.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="btn-group" style={{ display: 'flex', background: 'var(--card-bg)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-color)' }}>
                        <button 
                            className={`btn btn-sm ${period === 'day' ? 'btn-primary' : 'btn-ghost'}`} 
                            style={{ borderRadius: '6px' }}
                            onClick={() => setPeriod('day')}
                        >Day</button>
                        <button 
                            className={`btn btn-sm ${period === 'week' ? 'btn-primary' : 'btn-ghost'}`} 
                            style={{ borderRadius: '6px' }}
                            onClick={() => setPeriod('week')}
                        >Week</button>
                        <button 
                            className={`btn btn-sm ${period === 'month' ? 'btn-primary' : 'btn-ghost'}`} 
                            style={{ borderRadius: '6px' }}
                            onClick={() => setPeriod('month')}
                        >Month</button>
                        <button 
                            className={`btn btn-sm ${period === 'year' ? 'btn-primary' : 'btn-ghost'}`} 
                            style={{ borderRadius: '6px' }}
                            onClick={() => setPeriod('year')}
                        >Year</button>
                    </div>
                    
                    <input 
                        type="date" 
                        className="form-input" 
                        style={{ width: 'auto', height: '38px' }}
                        value={selectedDate}
                        onChange={(e) => {
                            setSelectedDate(e.target.value);
                            setPeriod('day'); // Reset to day view when picking a specific date
                        }}
                    />

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>
                        Last updated: {lastRefresh.toLocaleTimeString()}
                    </div>
                </div>
            </div>

            <div className="stats-grid responsive-grid-3">
                <div className="stat-card" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>📦</div>
                    <div className="stat-value" style={{ color: '#3b82f6' }}>{data.summary.totalProducts}</div>
                    <div className="stat-label">Total Products Made</div>
                </div>
                <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>✅</div>
                    <div className="stat-value" style={{ color: '#10b981' }}>{data.summary.totalCorrect}</div>
                    <div className="stat-label">Total Correct Products</div>
                </div>
                <div className="stat-card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>⚠️</div>
                    <div className="stat-value" style={{ color: '#ef4444' }}>{data.summary.totalDefective}</div>
                    <div className="stat-label">Total Defective Products</div>
                </div>
            </div>

            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <h3 className="card-title">🟢 Current Working Efficiency (Live View)</h3>
                    <span className="badge badge-info">{data.liveWorkers.length} Active Workers</span>
                </div>
                {data.liveWorkers.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="mobile-stack-table">
                            <thead>
                                <tr>
                                    <th>Worker</th>
                                    <th>Machine / Product</th>
                                    <th>Hours Active</th>
                                    <th>Expected Target So Far</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.liveWorkers.map(w => (
                                    <tr key={w.log_id}>
                                        <td data-label="Worker">
                                            <div style={{ fontWeight: 600 }}>{w.worker_name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{w.employee_id}</div>
                                        </td>
                                        <td data-label="Task">
                                            <div>{w.machine_name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{w.product_name}</div>
                                        </td>
                                        <td data-label="Hours Active">
                                            <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{w.hours_active} hrs</span>
                                        </td>
                                        <td data-label="Expected Target">
                                            <span style={{ color: 'var(--info)', fontWeight: 600, fontSize: '15px' }}>
                                                {w.expected_target} units
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">💺</div>
                        <h3>No workers currently active</h3>
                        <p>Assign workers to machines to see live efficiency targets.</p>
                    </div>
                )}
            </div>

            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 className="card-title">📖 {period === 'day' ? (selectedDate === new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA") ? "Today's" : selectedDate) : period.charAt(0).toUpperCase() + period.slice(1) + "'s"} Closed Production Logs</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div className="search-box" style={{ width: '200px' }}>
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                className="form-input input-sm"
                                placeholder="Filter by worker..."
                                value={logFilter.worker}
                                onChange={(e) => setLogFilter({ ...logFilter, worker: e.target.value })}
                            />
                        </div>
                        <div className="search-box" style={{ width: '200px' }}>
                            <span className="search-icon">📦</span>
                            <input
                                type="text"
                                className="form-input input-sm"
                                placeholder="Filter by product..."
                                value={logFilter.product}
                                onChange={(e) => setLogFilter({ ...logFilter, product: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
                {data.closedLogs.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="mobile-stack-table">
                            <thead>
                                <tr>
                                    <th>Worker</th>
                                    <th>Machine / Product</th>
                                    <th>Target VS Actual</th>
                                    <th>Defects</th>
                                    <th>Efficiency</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.closedLogs
                                    .filter(log => {
                                        const workerMatch = log.worker_name.toLowerCase().includes(logFilter.worker.toLowerCase()) || 
                                                           log.employee_id.toLowerCase().includes(logFilter.worker.toLowerCase());
                                        const productMatch = (log.product_name || '').toLowerCase().includes(logFilter.product.toLowerCase());
                                        return workerMatch && productMatch;
                                    })
                                    .map(log => {
                                    const rawRatio = log.target_units > 0 ? (log.actual_units / log.target_units) * 80 : 0;
                                    const penalty = log.machine_fault_flag ? 0 : (log.defective_count || 0);
                                    let finalScore = Math.max(0, Math.min(80, rawRatio) - penalty);
                                    let cls = finalScore >= 70 ? 'var(--success)' : finalScore >= 50 ? 'var(--warning)' : 'var(--danger)';

                                    return (
                                        <tr key={log.id}>
                                            <td data-label="Worker">
                                                <div style={{ fontWeight: 600 }}>{log.worker_name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.employee_id}</div>
                                            </td>
                                            <td data-label="Task">
                                                <div>{log.machine_name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.product_name || '—'}</div>
                                            </td>
                                            <td data-label="Target vs Actual">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: 'var(--info)' }}>Exp: {log.target_units}</span>
                                                    <span>→</span>
                                                    <strong style={{ color: log.actual_units >= log.target_units ? 'var(--success)' : 'var(--text-primary)' }}>
                                                        Act: {log.actual_units}
                                                    </strong>
                                                </div>
                                            </td>
                                            <td data-label="Defects">
                                                {log.defective_count > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span className="badge badge-danger">{log.defective_count} Defects</span>
                                                        {log.machine_fault_flag ? (
                                                            <span style={{ fontSize: '10px', color: 'var(--warning)' }}>Machine Fault ✅</span>
                                                        ) : (
                                                            <span style={{ fontSize: '10px', color: 'var(--danger)' }}>Worker Penalty ❌</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>None</span>
                                                )}
                                            </td>
                                            <td data-label="Efficiency">
                                                <span style={{ color: cls, fontWeight: 700 }}>{finalScore.toFixed(1)}%</span>
                                            </td>
                                            <td data-label="Actions">
                                                <button 
                                                    className="btn btn-ghost btn-sm" 
                                                    style={{ color: 'var(--danger)' }}
                                                    onClick={() => deleteLog(log.id)}
                                                    title="Delete Log"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state" style={{ padding: '30px' }}>
                        <p style={{ color: 'var(--text-muted)' }}>No completed production logs for today.</p>
                    </div>
                )}
            </div>
        </>
    );
}

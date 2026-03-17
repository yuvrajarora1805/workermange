'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function WorkerProfilePage() {
    const { id } = useParams();
    const [worker, setWorker] = useState(null);
    const [logs, setLogs] = useState([]);
    const [manualEffs, setManualEffs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { if (id) loadData(); }, [id]);

    async function loadData() {
        try {
            const [wRes, lRes, mRes] = await Promise.all([
                fetch(`/api/workers?id=${id}`).then(r => r.json()),
                fetch(`/api/production?worker_id=${id}`).then(r => r.json()),
                fetch(`/api/efficiency/manual?worker_id=${id}`).then(r => r.json()),
            ]);
            if (wRes.success && wRes.data.length > 0) setWorker(wRes.data[0]);
            if (lRes.success) setLogs(lRes.data);
            if (mRes.success) setManualEffs(mRes.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    function getPerf(target, actual) {
        if (!target) return { pct: 0, cls: 'badge-neutral' };
        const pct = Math.round((actual / target) * 100);
        if (pct >= 90) return { pct, cls: 'badge-success' };
        if (pct >= 70) return { pct, cls: 'badge-info' };
        if (pct >= 50) return { pct, cls: 'badge-warning' };
        return { pct, cls: 'badge-danger' };
    }

    function getSkillBadge(level) {
        const map = { expert: 'badge-success', advanced: 'badge-info', intermediate: 'badge-warning', beginner: 'badge-danger' };
        return map[level] || 'badge-neutral';
    }

    if (loading) return <div className="loading-overlay"><div className="loader"></div></div>;
    if (!worker) return (
        <div className="empty-state">
            <div className="empty-state-icon">👷</div>
            <h3>Worker not found</h3>
            <a href="/workers" className="btn btn-primary">← Back to Workers</a>
        </div>
    );

    // Aggregate stats
    const totalLogs = logs.length;
    const avgEff = totalLogs > 0
        ? (logs.reduce((sum, l) => sum + (l.target_units > 0 ? (l.actual_units / l.target_units) * 100 : 0), 0) / totalLogs).toFixed(1)
        : 'N/A';

    // Group by machine+product for best-efficiency summary
    const machineMap = {};
    
    // First, seed with manual efficiency overrides
    for (const m of manualEffs) {
        const key = `${m.machine_id}-${m.product_id || 'none'}`;
        machineMap[key] = { 
            machine: m.machine_name, 
            product: m.product_name, 
            scores: [], 
            latest: null,
            manual: m.efficiency_pct 
        };
    }

    // Then add historical logs
    for (const l of logs) {
        const key = `${l.machine_id}-${l.product_id || 'none'}`;
        if (!machineMap[key]) {
            machineMap[key] = { machine: l.machine_name, product: l.product_name, scores: [], latest: null, manual: null };
        }
        const pct = l.target_units > 0 ? (l.actual_units / l.target_units) * 100 : 0;
        machineMap[key].scores.push(pct);
        if (!machineMap[key].latest || l.date > machineMap[key].latest.date) machineMap[key].latest = l;
    }

    const machineStats = Object.values(machineMap).map(m => {
        const avg = m.scores.length > 0 ? (m.scores.reduce((a, b) => a + b, 0) / m.scores.length).toFixed(1) : '—';
        const recentValue = m.latest ? (m.latest.target_units > 0 ? ((m.latest.actual_units / m.latest.target_units) * 100).toFixed(1) : 0) : null;
        
        return {
            ...m,
            avg: avg,
            recent: recentValue
        };
    }).sort((a, b) => (b.manual || b.recent || 0) - (a.manual || a.recent || 0));

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <a href="/workers" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none' }}>← Back to Workers</a>
                        <h2 style={{ marginTop: '4px' }}>👷 {worker.name}</h2>
                        <p>{worker.employee_id} · <span className={`badge ${getSkillBadge(worker.skill_level)}`}>{worker.skill_level}</span></p>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-icon">📋</div>
                    <div className="stat-value">{totalLogs}</div>
                    <div className="stat-label">Total Logs</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{avgEff}{totalLogs > 0 ? '%' : ''}</div>
                    <div className="stat-label">Avg Efficiency</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🔧</div>
                    <div className="stat-value">{machineStats.length}</div>
                    <div className="stat-label">Machine-Product Combos</div>
                </div>
            </div>

            {/* Per Machine/Product Efficiency */}
            {machineStats.length > 0 && (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div className="card-header"><h3 className="card-title">🎯 Efficiency by Machine & Product</h3></div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>Machine</th><th>Product</th><th>Logs</th><th>Avg Efficiency</th><th>Most Recent</th></tr>
                            </thead>
                            <tbody>
                                {machineStats.map((m, i) => {
                                    const recentValue = m.manual !== null ? m.manual : m.recent;
                                    const isManual = m.manual !== null;
                                    const perf = getPerf(100, parseFloat(recentValue || 0));
                                    
                                    return (
                                        <tr key={i} style={isManual ? { background: 'rgba(52, 211, 153, 0.05)' } : {}}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {m.machine || '—'}
                                                {isManual && <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--success)', verticalAlign: 'middle' }}>● MANUAL</span>}
                                            </td>
                                            <td>{m.product || '—'}</td>
                                            <td>{m.scores.length || '—'}</td>
                                            <td>{m.avg === '—' ? '—' : `${m.avg}%`}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span className={`badge ${perf.cls}`}>{parseFloat(recentValue || 0).toFixed(1)}%</span>
                                                    {isManual && m.recent !== null && (
                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>History: {m.recent}%</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Full Production Log */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">📋 Full Production Log</h3>
                    <span className="badge badge-info">{logs.length} entries</span>
                </div>
                {logs.length > 0 ? (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>Date</th><th>Machine</th><th>Product</th><th>Target</th><th>Actual</th><th>Performance</th></tr>
                            </thead>
                            <tbody>
                                {logs.map(l => {
                                    const perf = getPerf(l.target_units, l.actual_units);
                                    return (
                                        <tr key={l.id}>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                {new Date(l.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{l.machine_name || '—'}</td>
                                            <td>{l.product_name || '—'}</td>
                                            <td>{l.target_units}</td>
                                            <td>{l.actual_units}</td>
                                            <td>
                                                <span className={`badge ${perf.cls}`}>{perf.pct}%</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <h3>No production logs yet</h3>
                        <p>Production logs will appear here once they are recorded</p>
                    </div>
                )}
            </div>
        </>
    );
}

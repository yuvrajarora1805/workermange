'use client';

import React, { useState, useEffect } from 'react';

export default function EfficiencyPage() {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total_workers: 0, avg_score: 0, high_performers: 0, low_performers: 0 });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    const [activeTab, setActiveTab] = useState('leaderboard');
    const [manualEffs, setManualEffs] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [products, setProducts] = useState([]);
    const [formData, setFormData] = useState({ worker_id: '', machine_id: '', product_id: '', efficiency_pct: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { 
        loadEfficiency(page); 
        loadMetadata();
        loadManualEffs();
    }, [page]);

    async function loadEfficiency(p = 1) {
        setLoading(true);
        try {
            const res = await fetch(`/api/efficiency?page=${p}&limit=50`);
            const data = await res.json();
            if (data.success) {
                setScores(data.data);
                setStats(data.global_stats);
                setTotalPages(data.pagination.total_pages);
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    async function loadMetadata() {
        try {
            const [w, m, p] = await Promise.all([
                fetch('/api/workers').then(r => r.json()),
                fetch('/api/machines').then(r => r.json()),
                fetch('/api/products').then(r => r.json())
            ]);
            if (w.success) setWorkers(w.data);
            if (m.success) setMachines(m.data);
            if (p.success) setProducts(p.data);
        } catch (err) { console.error(err); }
    }

    async function loadManualEffs() {
        try {
            const res = await fetch('/api/efficiency/manual');
            const data = await res.json();
            if (data.success) setManualEffs(data.data);
        } catch (err) { console.error(err); }
    }

    async function handleAddManual(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/efficiency/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setFormData({ worker_id: '', machine_id: '', product_id: '', efficiency_pct: '' });
                loadManualEffs();
                loadEfficiency(); // Refresh leaderboard
            }
        } catch (err) { console.error(err); }
        finally { setSubmitting(false); }
    }

    async function handleDeleteManual(id) {
        if (!confirm('Are you sure you want to delete this override?')) return;
        try {
            const res = await fetch('/api/efficiency/manual', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                loadManualEffs();
                loadEfficiency(); // Refresh leaderboard
            }
        } catch (err) { console.error(err); }
    }

    function getEfficiencyClass(score) {
        if (score >= 70) return 'efficiency-high';
        if (score >= 50) return 'efficiency-medium';
        if (score >= 30) return 'efficiency-low';
        return 'efficiency-poor';
    }

    function getProgressColor(score) {
        if (score >= 70) return 'var(--success)';
        if (score >= 50) return 'var(--info)';
        if (score >= 30) return 'var(--warning)';
        return 'var(--danger)';
    }

    function getSkillBadge(val) {
        const map = {
            4: 'badge-success', 'expert': 'badge-success',
            3: 'badge-info', 'advanced': 'badge-info',
            2: 'badge-warning', 'intermediate': 'badge-warning',
            1: 'badge-danger', 'beginner': 'badge-danger'
        };
        return map[val?.toString().toLowerCase()] || 'badge-neutral';
    }

    function getSkillLabel(val) {
        const map = {
            4: 'Expert', 'expert': 'Expert',
            3: 'Advanced', 'advanced': 'Advanced',
            2: 'Intermediate', 'intermediate': 'Intermediate',
            1: 'Beginner', 'beginner': 'Beginner'
        };
        return map[val?.toString().toLowerCase()] || val || 'Unknown';
    }

    if (loading) {
        return <div className="loading-overlay"><div className="loader"></div><p>Calculating efficiency...</p></div>;
    }

    const avgScore = stats.avg_score || 0;
    const highPerformers = stats.high_performers || 0;
    const lowPerformers = stats.low_performers || 0;
    const totalWorkers = stats.total_workers || 0;

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>📈 Efficiency Reports</h2>
                    <p>Worker performance based on production (80%) + manager rating (20%)</p>
                </div>
            </div>

            <div className="stats-grid responsive-grid-4">
                <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-value">{avgScore}%</div>
                    <div className="stat-label">Average Score</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🏆</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{highPerformers}</div>
                    <div className="stat-label">High Performers (≥70)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">⚠️</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{lowPerformers}</div>
                    <div className="stat-label">Need Improvement (&lt;30)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">👷</div>
                    <div className="stat-value">{totalWorkers}</div>
                    <div className="stat-label">Total Workers</div>
                </div>
            </div>

            <div className="tabs">
                <div className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>🏆 Leaderboard</div>
                <div className={`tab ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>✍️ Manual Overrides</div>
            </div>

            {activeTab === 'leaderboard' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Efficiency Leaderboard</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Production (80%) + Rating (20%) = Total Score
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table className="mobile-stack-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Worker</th>
                                    <th style={{ width: '120px' }}>Perf (80%)</th>
                                    <th>Best Machine/Product</th>
                                    <th>Rating (20%)</th>
                                    <th>Score</th>
                                    <th className="hide-mobile">Progress</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scores.map((s, i) => {
                                    const rank = (i + (page - 1) * 50);
                                    const isSpecial = rank < 3;
                                    const rankDisplay = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`;
                                    
                                    return (
                                        <React.Fragment key={s.worker_id}>
                                            {/* separator line for every worker row */}
                                            <tr>
                                                <td colSpan="7" style={{ padding: '0', borderBottom: '1px solid var(--border-color)', opacity: 0.5 }}></td>
                                            </tr>
                                            <tr style={{ borderBottom: 'none' }}>
                                                <td data-label="Rank" style={{ fontWeight: 700, fontSize: '16px', color: isSpecial ? '#fbbf24' : 'var(--text-muted)', width: '50px' }}>
                                                    {rankDisplay}
                                                </td>
                                                <td data-label="Worker">
                                                    <div style={{ fontWeight: 700, color: 'black', textTransform: 'uppercase', fontSize: '14px' }}>{s.worker_name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                        {s.employee_id} 
                                                        <span className={`badge ${getSkillBadge(s.skill_level || s.rating)}`} style={{ padding: '0 4px', fontSize: '9px', lineHeight: '1.4' }}>
                                                            {getSkillLabel(s.skill_level || s.rating)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td data-label="Production">
                                                    <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '15px' }}>{parseFloat(s.production_score || 0).toFixed(2)}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>/80</span>
                                                </td>
                                                <td data-label="Specialty">
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                                                        {s.line_name && s.line_name !== '—' ? `${s.line_name} / ` : ''}
                                                        {s.best_machine || '—'}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.best_product || '—'}</div>
                                                </td>
                                                <td data-label="Rating">
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{parseFloat(s.rating_score || 0).toFixed(2)}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>/20</span>
                                                </td>
                                                <td data-label="Total">
                                                    <span className={`efficiency-badge ${getEfficiencyClass(s.total_score)}`} style={{ fontWeight: 700 }}>
                                                        {parseFloat(s.total_score || 0).toFixed(2)}%
                                                    </span>
                                                </td>
                                                <td className="hide-mobile" style={{ minWidth: '150px' }}>
                                                    <div className="progress-bar">
                                                        <div className="progress-fill" style={{ width: `${s.total_score}%`, background: getProgressColor(s.total_score) }}></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px', padding: '16px' }}>
                        <button 
                            className="btn btn-ghost" 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            ← Previous
                        </button>
                        <span style={{ fontWeight: 600 }}>Page {page} of {totalPages}</span>
                        <button 
                            className="btn btn-ghost" 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'manual' && (
                <>
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div className="card-header"><h3 className="card-title">Add/Update Manual Efficiency</h3></div>
                        <form onSubmit={handleAddManual} className="responsive-grid-sidebar" style={{ alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Worker</label>
                                <select
                                    id="manual-eff-worker"
                                    name="worker_id"
                                    className="form-select"
                                    value={formData.worker_id}
                                    onChange={e => setFormData({...formData, worker_id: e.target.value})}
                                    required
                                >
                                    <option value="">Select worker...</option>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.employee_id})</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Machine</label>
                                <select
                                    id="manual-eff-machine"
                                    name="machine_id"
                                    className="form-select"
                                    value={formData.machine_id}
                                    onChange={e => setFormData({...formData, machine_id: e.target.value})}
                                    required
                                >
                                    <option value="">Select machine...</option>
                                    {machines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.line_name})</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Product</label>
                                <select
                                    id="manual-eff-product"
                                    name="product_id"
                                    className="form-select"
                                    value={formData.product_id}
                                    onChange={e => setFormData({...formData, product_id: e.target.value})}
                                    required
                                >
                                    <option value="">Select product...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Eff. %</label>
                                <input
                                    id="manual-efficiency-pct"
                                    name="efficiency_pct"
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    max="100"
                                    value={formData.efficiency_pct}
                                    onChange={e => setFormData({...formData, efficiency_pct: e.target.value})}
                                    required
                                    placeholder="0-100"
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? '⏳' : '➕ Add Record'}
                            </button>
                        </form>
                    </div>

                    <div className="card">
                        <div className="card-header"><h3 className="card-title">Manual Overrides List</h3></div>
                        <div className="table-wrapper">
                            <table className="mobile-stack-table">
                                <thead>
                                    <tr>
                                        <th>Worker</th>
                                        <th>Machine</th>
                                        <th>Product</th>
                                        <th>Efficiency %</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {manualEffs.map(m => (
                                        <tr key={m.id}>
                                            <td data-label="Worker">
                                                <div style={{ fontWeight: 600 }}>{m.worker_name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.employee_id}</div>
                                            </td>
                                            <td data-label="Machine">{m.machine_name}</td>
                                            <td data-label="Product">{m.product_name || <span style={{ color: 'var(--text-muted)' }}>Any</span>}</td>
                                            <td data-label="Efficiency">
                                                <span className={`efficiency-badge ${getEfficiencyClass(m.efficiency_pct)}`}>
                                                    {m.efficiency_pct}%
                                                </span>
                                            </td>
                                            <td data-label="Actions">
                                                <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteManual(m.id)}>🗑️ Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {manualEffs.length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No manual overrides set.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

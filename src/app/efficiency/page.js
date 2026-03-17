'use client';

import { useState, useEffect } from 'react';

export default function EfficiencyPage() {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('leaderboard');
    const [manualEffs, setManualEffs] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [products, setProducts] = useState([]);
    const [formData, setFormData] = useState({ worker_id: '', machine_id: '', product_id: '', efficiency_pct: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { 
        loadEfficiency(); 
        loadMetadata();
        loadManualEffs();
    }, []);

    async function loadEfficiency() {
        try {
            const res = await fetch('/api/efficiency');
            const data = await res.json();
            if (data.success) setScores(data.data);
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

    function getSkillBadge(level) {
        const map = {
            expert: 'badge-success',
            advanced: 'badge-info',
            intermediate: 'badge-warning',
            beginner: 'badge-danger',
        };
        return map[level] || 'badge-neutral';
    }

    if (loading) {
        return <div className="loading-overlay"><div className="loader"></div><p>Calculating efficiency...</p></div>;
    }

    const avgScore = scores.length > 0
        ? (scores.reduce((s, w) => s + w.total_score, 0) / scores.length).toFixed(1)
        : 0;

    const highPerformers = scores.filter(s => s.total_score >= 70).length;
    const lowPerformers = scores.filter(s => s.total_score < 30).length;

    return (
        <>
            <div className="page-header">
                <h2>📈 Efficiency Reports</h2>
                <p>Worker performance based on production (80%) + manager rating (20%)</p>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
                    <div className="stat-value">{scores.length}</div>
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
                        <table>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Worker</th>
                                    <th>Max Perf (80%)</th>
                                    <th>Best Machine</th>
                                    <th>Best Product</th>
                                    <th>Rating (20%)</th>
                                    <th>Total Score</th>
                                    <th>Progress</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scores.map((s, i) => (
                                    <tr key={s.worker_id}>
                                        <td style={{ fontWeight: 700, fontSize: '16px', color: i < 3 ? '#fbbf24' : 'var(--text-muted)', width: '50px' }}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.worker_name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {s.employee_id} 
                                                <span className={`badge ${getSkillBadge(s.skill_level)}`} style={{ padding: '0 4px', fontSize: '9px', lineHeight: '1.4' }}>{s.skill_level}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '15px' }}>{s.production_score}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>/80</span>
                                            {s.production_logs_count > 0 && (
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                    {s.production_logs_count} {s.production_logs_count === 1 ? 'entry' : 'entries'}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{s.best_machine || '—'}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{s.best_product}</div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.rating_score}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>/20</span>
                                        </td>
                                        <td>
                                            <span className={`efficiency-badge ${getEfficiencyClass(s.total_score)}`}>
                                                {s.total_score}%
                                            </span>
                                        </td>
                                        <td style={{ minWidth: '150px' }}>
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${s.total_score}%`, background: getProgressColor(s.total_score) }}></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'manual' && (
                <>
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div className="card-header"><h3 className="card-title">Add/Update Manual Efficiency</h3></div>
                        <form onSubmit={handleAddManual} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 140px', gap: '12px', alignItems: 'end' }}>
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
                            <table>
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
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{m.worker_name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.employee_id}</div>
                                            </td>
                                            <td>{m.machine_name}</td>
                                            <td>{m.product_name || <span style={{ color: 'var(--text-muted)' }}>Any</span>}</td>
                                            <td>
                                                <span className={`efficiency-badge ${getEfficiencyClass(m.efficiency_pct)}`}>
                                                    {m.efficiency_pct}%
                                                </span>
                                            </td>
                                            <td>
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

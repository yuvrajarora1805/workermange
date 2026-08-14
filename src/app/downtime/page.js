'use client';

import { useState, useEffect } from 'react';

export default function DowntimePage() {
    const [logs, setLogs] = useState([]);
    const [lines, setLines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [form, setForm] = useState({
        is_all_lines: false,
        line_id: '',
        start_time: '',
        reason: ''
    });

    useEffect(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setForm(f => ({ ...f, start_time: now.toISOString().slice(0, 16) }));
    }, []);

    useEffect(() => { loadData(); }, [filterDate]);

    async function loadData() {
        try {
            const [lRes, dRes] = await Promise.all([
                fetch('/api/lines').then(r => r.json()),
                fetch(`/api/downtime?date=${filterDate}`).then(r => r.json()),
            ]);
            if (lRes.success) setLines(lRes.data);
            if (dRes.success) setLogs(dRes.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/downtime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_id: form.is_all_lines ? null : (form.line_id || null),
                    is_all_lines: form.is_all_lines,
                    start_time: new Date(form.start_time).toISOString(),
                    reason: form.reason
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Downtime started!', 'success');
                setForm(f => ({ ...f, reason: '', line_id: '' }));
                loadData();
            } else {
                showToast(data.error || 'Failed to start downtime', 'error');
            }
        } catch (err) { showToast('Error starting downtime', 'error'); }
        finally { setSubmitting(false); }
    }

    async function handleEndDowntime(id) {
        try {
            const now = new Date().toISOString();
            const res = await fetch('/api/downtime', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, end_time: now })
            });
            if ((await res.json()).success) {
                showToast('Downtime ended', 'success');
                loadData();
            }
        } catch (err) { showToast('Failed to end downtime', 'error'); }
    }

    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast toast-${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    // Split logs
    const activeLogs = logs.filter(l => !l.end_time);
    const historyLogs = logs.filter(l => l.end_time);

    if (loading) return <div className="loading-overlay"><div className="loader"></div></div>;

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h2>⏱️ Downtime Logs</h2>
                        <p>Track production halts (power, machine limits) so efficiency isn't penalized.</p>
                    </div>
                    <input
                        type="date"
                        className="form-input"
                        style={{ width: '160px', height: '42px' }}
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                    />
                </div>
            </div>

            <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-header"><h3 className="card-title">Start New Downtime</h3></div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '42px', margin: 0 }}>
                            <input 
                                type="checkbox" 
                                checked={form.is_all_lines} 
                                onChange={e => setForm({ ...form, is_all_lines: e.target.checked, line_id: '' })}
                                style={{ width: '18px', height: '18px' }}
                            />
                            <strong>All Lines (Power Outage, etc.)</strong>
                        </label>
                    </div>

                    {!form.is_all_lines && (
                        <div className="form-group" style={{ minWidth: '200px', marginBottom: 0 }}>
                            <label className="form-label">Specific Line</label>
                            <select
                                className="form-select"
                                value={form.line_id}
                                onChange={e => setForm({ ...form, line_id: e.target.value })}
                                required={!form.is_all_lines}
                            >
                                {lines.filter(l => l.is_active).map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group" style={{ minWidth: '200px', marginBottom: 0 }}>
                        <label className="form-label">Start Time</label>
                        <input
                            type="datetime-local"
                            className="form-input"
                            required
                            value={form.start_time}
                            onChange={e => setForm({ ...form, start_time: e.target.value })}
                        />
                    </div>

                    <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label className="form-label">Reason</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Power failure, Maintenance..."
                            required
                            value={form.reason}
                            onChange={e => setForm({ ...form, reason: e.target.value })}
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                        {submitting ? '⏳' : '🔴 Start Downtime'}
                    </button>
                </form>
            </div>

            {activeLogs.length > 0 && (
                <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--danger)' }}>
                    <div className="card-header"><h3 className="card-title" style={{ color: 'var(--danger)' }}>Active Downtimes</h3></div>
                    <div className="table-wrapper">
                        <table className="mobile-stack-table">
                            <thead>
                                <tr><th>Scope</th><th>Start Time</th><th>Reason</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {activeLogs.map(l => (
                                    <tr key={l.id}>
                                        <td>{l.is_all_lines ? <span className="badge badge-danger">ALL LINES</span> : <strong>{l.line_name}</strong>}</td>
                                        <td>{new Date(l.start_time).toLocaleString()}</td>
                                        <td>{l.reason}</td>
                                        <td>
                                            <button className="btn btn-sm btn-success" onClick={() => handleEndDowntime(l.id)}>🟢 End Now</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Downtime History</h3>
                    <span className="badge badge-info">{historyLogs.length} finished</span>
                </div>
                {historyLogs.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="mobile-stack-table">
                            <thead>
                                <tr><th>Scope</th><th>Start Time</th><th>End Time</th><th>Duration</th><th>Reason</th></tr>
                            </thead>
                            <tbody>
                                {historyLogs.map(l => {
                                    const mins = Math.round((new Date(l.end_time) - new Date(l.start_time)) / 60000);
                                    const hours = Math.floor(mins / 60);
                                    const remMins = mins % 60;
                                    const durStr = hours > 0 ? `${hours}h ${remMins}m` : `${mins}m`;
                                    
                                    return (
                                        <tr key={l.id}>
                                            <td>{l.is_all_lines ? <span className="badge badge-warning">ALL LINES</span> : <strong>{l.line_name}</strong>}</td>
                                            <td>{new Date(l.start_time).toLocaleString()}</td>
                                            <td>{new Date(l.end_time).toLocaleString()}</td>
                                            <td><span className="badge badge-neutral">⏱️ {durStr}</span></td>
                                            <td style={{ color: 'var(--text-muted)' }}>{l.reason}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No historical downtime logged for this date.</p>
                    </div>
                )}
            </div>
        </>
    );
}

'use client';

import { useState, useEffect } from 'react';

export default function ProductionPage() {
    const [workers, setWorkers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ worker_id: '', target_units: '400', actual_units: '', machine_id: '', product_id: '' });
    const [submitting, setSubmitting] = useState(false);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [shift, setShift] = useState(() => {
        const hour = new Date().getHours();
        return (hour >= 7 && hour < 19) ? 'day' : 'night';
    });
    const currentShift = shift; // For backward compatibility with existing variable name in fetch

    const [bulkMode, setBulkMode] = useState(false);
    const [lines, setLines] = useState([]);
    const [selectedLineId, setSelectedLineId] = useState('');
    const [bulkData, setBulkData] = useState([]); // Array of { worker_id, target, actual, ... }

    useEffect(() => { loadData(); }, [filterDate, shift]);
    useEffect(() => { loadLines(); }, []);

    async function loadLines() {
        try {
            const res = await fetch('/api/lines').then(r => r.json());
            if (res.success) setLines(res.data);
        } catch (err) { console.error(err); }
    }

    async function loadData() {
        try {
            const [wRes, aRes, lRes] = await Promise.all([
                fetch('/api/workers').then(r => r.json()),
                fetch(`/api/assignments?date=${filterDate}&shift=${shift}`).then(r => r.json()),
                fetch(`/api/production?date=${filterDate}&shift=${shift}`).then(r => r.json()),
            ]);
            if (wRes.success) setWorkers(wRes.data);
            if (aRes.success) {
                // Flatten assignments from lines
                const allAssigned = [];
                aRes.data.assignments.forEach(line => {
                    allAssigned.push(...line.machines);
                });
                setAssignments(allAssigned);
                
                // If in bulk mode and a line is selected, update bulkData
                if (selectedLineId) {
                    const lineAssigned = allAssigned.filter(a => String(a.line_id) === String(selectedLineId));
                    prepareBulkData(lineAssigned, lRes.data || []);
                }
            }
            if (lRes.success) setLogs(lRes.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    function prepareBulkData(assignedWorkers, existingLogs) {
        const newData = assignedWorkers.map(aw => {
            const existing = existingLogs.find(l => l.worker_id === aw.worker_id);
            return {
                worker_id: aw.worker_id,
                worker_name: aw.worker_name,
                employee_id: aw.employee_id,
                machine_id: aw.machine_id,
                machine_name: aw.machine_name,
                product_id: aw.product_id,
                target_units: existing ? existing.target_units : 400,
                actual_units: existing ? existing.actual_units : '',
            };
        });
        setBulkData(newData);
    }

    const [quickFill, setQuickFill] = useState({ target: '400', actual: '' });

    function handleApplyAll() {
        if (!quickFill.target && !quickFill.actual) return;
        const newData = bulkData.map(d => ({
            ...d,
            target_units: quickFill.target || d.target_units,
            actual_units: quickFill.actual || d.actual_units
        }));
        setBulkData(newData);
        showToast('Applied to all workers!', 'info');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/production', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    worker_id: parseInt(form.worker_id),
                    target_units: parseInt(form.target_units),
                    actual_units: parseInt(form.actual_units),
                    machine_id: form.machine_id ? parseInt(form.machine_id) : null,
                    product_id: form.product_id ? parseInt(form.product_id) : null,
                    date: filterDate,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Production logged!', 'success');
                setForm({ worker_id: '', target_units: '400', actual_units: '', machine_id: '', product_id: '' });
                loadData();
            }
        } catch (err) { showToast('Failed to log', 'error'); }
        finally { setSubmitting(false); }
    }

    async function handleBulkSubmit(e) {
        e.preventDefault();
        const readyData = bulkData.filter(d => d.actual_units !== '').map(d => ({
            ...d,
            target_units: parseInt(d.target_units),
            actual_units: parseInt(d.actual_units),
            date: filterDate,
            shift: shift
        }));

        if (readyData.length === 0) return showToast('Enter units for at least one worker', 'warning');

        setSubmitting(true);
        try {
            const res = await fetch('/api/production', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(readyData),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Logged production for ${readyData.length} workers!`, 'success');
                loadData();
            }
        } catch (err) { showToast('Failed to log bulk production', 'error'); }
        finally { setSubmitting(false); }
    }

    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast toast-${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    function getPerformance(target, actual) {
        if (target === 0) return { pct: 0, cls: 'badge-neutral' };
        const pct = Math.round((actual / target) * 100);
        if (pct >= 90) return { pct, cls: 'badge-success' };
        if (pct >= 70) return { pct, cls: 'badge-info' };
        if (pct >= 50) return { pct, cls: 'badge-warning' };
        return { pct, cls: 'badge-danger' };
    }

    if (loading) return <div className="loading-overlay"><div className="loader"></div></div>;

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h2>🏭 Production Logs</h2>
                        <p>Record daily units target vs actual (contributes 80% to efficiency)</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="shift-tabs" style={{ background: 'var(--card-bg)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px', border: '1px solid var(--border-color)', height: '42px', alignItems: 'center' }}>
                            <button 
                                className={`btn btn-sm ${shift === 'day' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setShift('day')}
                                style={{ height: '32px' }}
                            >☀️ Day</button>
                            <button 
                                className={`btn btn-sm ${shift === 'night' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setShift('night')}
                                style={{ height: '32px' }}
                            >🌙 Night</button>
                        </div>
                        <input
                            id="production-date"
                            name="production_date"
                            type="date"
                            className="form-input"
                            style={{ width: '160px', height: '42px', flexShrink: 0 }}
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <button 
                    className={`btn ${!bulkMode ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setBulkMode(false)}
                >👤 Single Worker</button>
                <button 
                    className={`btn ${bulkMode ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setBulkMode(true)}
                >👥 Bulk Line Entry</button>
            </div>

            {/* Log form - Single Mode */}
            {!bulkMode && (
                <div className="card" style={{ marginBottom: '20px' }}>
                    <div className="card-header"><h3 className="card-title">Log Production</h3></div>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                            <label className="form-label">Worker</label>
                            <select
                                id="production-worker-id"
                                name="worker_id"
                                className="form-select"
                                value={form.worker_id}
                                onChange={e => {
                                    const wid = e.target.value;
                                    const assignment = assignments.find(a => String(a.worker_id) === String(wid));
                                    if (assignment) {
                                        setForm({ ...form, worker_id: wid, machine_id: assignment.machine_id, product_id: assignment.product_id });
                                    } else {
                                        setForm({ ...form, worker_id: wid, machine_id: '', product_id: '' });
                                    }
                                }}
                                required
                            >
                                <option value="">Select worker...</option>
                                {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.employee_id})</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ width: '150px', marginBottom: 0 }}>
                            <label className="form-label">Target Units</label>
                            <input
                                id="production-target-units"
                                name="target_units"
                                className="form-input"
                                type="number"
                                min="0"
                                required
                                value={form.target_units}
                                disabled={form.worker_id && !form.machine_id}
                                onChange={e => setForm({ ...form, target_units: e.target.value })}
                            />
                        </div>
                        <div className="form-group" style={{ width: '150px', marginBottom: 0 }}>
                            <label className="form-label">Actual Units</label>
                            <input
                                id="production-actual-units"
                                name="actual_units"
                                className="form-input"
                                type="number"
                                min="0"
                                required
                                value={form.actual_units}
                                disabled={form.worker_id && !form.machine_id}
                                onChange={e => setForm({ ...form, actual_units: e.target.value })}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={submitting || (form.worker_id && !form.machine_id)}>
                            {submitting ? '⏳' : '📝'} Log
                        </button>
                    </form>
                </div>
            )}

            {/* Bulk Mode */}
            {bulkMode && (
                <div className="card" style={{ marginBottom: '20px' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title">Bulk Entry — {lines.find(l => String(l.id) === selectedLineId)?.name || 'Select Line'}</h3>
                        <select 
                            className="form-select" 
                            style={{ width: '200px' }}
                            value={selectedLineId}
                            onChange={(e) => {
                                const lid = e.target.value;
                                setSelectedLineId(lid);
                                const lineAssigned = assignments.filter(a => String(a.line_id) === String(lid));
                                prepareBulkData(lineAssigned, logs);
                            }}
                        >
                            <option value="">Select Line...</option>
                            {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    
                    {selectedLineId ? (
                        <form onSubmit={handleBulkSubmit}>
                            {/* Quick Fill section */}
                            <div style={{ 
                                padding: '16px', 
                                background: 'rgba(255,255,255,0.03)', 
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-end',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        ⚡ Quick Fill (Apply to All)
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div className="form-group" style={{ marginBottom: 0, width: '120px' }}>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                placeholder="Target"
                                                value={quickFill.target}
                                                onChange={e => setQuickFill({ ...quickFill, target: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0, width: '120px' }}>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                placeholder="Actual" 
                                                value={quickFill.actual}
                                                onChange={e => setQuickFill({ ...quickFill, actual: e.target.value })}
                                            />
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn btn-ghost" 
                                            onClick={handleApplyAll}
                                            style={{ borderColor: 'var(--border-color)' }}
                                        >
                                            Apply to All
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="mobile-stack-table">
                                    <thead>
                                        <tr>
                                            <th>Worker</th>
                                            <th>Machine</th>
                                            <th style={{ width: '120px' }}>Target Units</th>
                                            <th style={{ width: '120px' }}>Actual Units</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkData.map((row, idx) => (
                                            <tr key={row.worker_id}>
                                                <td data-label="Worker">
                                                    <div style={{ fontWeight: 600 }}>{row.worker_name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.employee_id}</div>
                                                </td>
                                                <td data-label="Machine">{row.machine_name}</td>
                                                <td data-label="Target">
                                                    <input 
                                                        type="number" 
                                                        className="form-input" 
                                                        value={row.target_units} 
                                                        onChange={(e) => {
                                                            const d = [...bulkData];
                                                            d[idx].target_units = e.target.value;
                                                            setBulkData(d);
                                                        }}
                                                    />
                                                </td>
                                                <td data-label="Actual">
                                                    <input 
                                                        type="number" 
                                                        className="form-input" 
                                                        placeholder="Enter..."
                                                        value={row.actual_units} 
                                                        onChange={(e) => {
                                                            const d = [...bulkData];
                                                            d[idx].actual_units = e.target.value;
                                                            setBulkData(d);
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        {bulkData.length === 0 && (
                                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No workers assigned to this line today.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn btn-primary" disabled={submitting || bulkData.length === 0}>
                                    {submitting ? '⏳ Processing...' : '💾 Save Line Production'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📉</div>
                            <p>Select a production line to start bulk logging</p>
                        </div>
                    )}
                </div>
            )}

            {/* Logs Table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Production History — {new Date(filterDate).toLocaleDateString()}</h3>
                    <span className="badge badge-info">{logs.length} entries</span>
                </div>
                {logs.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="mobile-stack-table">
                            <thead>
                                <tr><th>Worker</th><th>Shift</th><th>Machine</th><th>Product</th><th>Target</th><th>Actual</th><th>Performance</th></tr>
                            </thead>
                            <tbody>
                                {logs.map(l => {
                                    const perf = getPerformance(l.target_units, l.actual_units);
                                    return (
                                        <tr key={l.id}>
                                            <td data-label="Worker">
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.worker_name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.employee_id}</div>
                                            </td>
                                            <td data-label="Shift">
                                                <span className={`badge ${l.shift === 'day' ? 'badge-info' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                                                    {l.shift === 'day' ? '☀️' : '🌙'} {l.shift}
                                                </span>
                                            </td>
                                            <td data-label="Machine">{l.machine_name || '—'}</td>
                                            <td data-label="Product">{l.product_name || '—'}</td>
                                            <td data-label="Target" style={{ fontWeight: 600 }}>{l.target_units}</td>
                                            <td data-label="Actual" style={{ fontWeight: 600 }}>{l.actual_units}</td>
                                            <td data-label="Perf">
                                                <span className={`badge ${perf.cls}`}>{perf.pct}%</span>
                                                <div className="progress-bar" style={{ width: '100px', marginTop: '4px' }}>
                                                    <div className="progress-fill" style={{
                                                        width: `${Math.min(perf.pct, 100)}%`,
                                                        background: perf.pct >= 90 ? 'var(--success)' : perf.pct >= 70 ? 'var(--info)' : perf.pct >= 50 ? 'var(--warning)' : 'var(--danger)'
                                                    }}></div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">🏭</div>
                        <h3>No production logs for this date</h3>
                        <p>Use the form above to log production data</p>
                    </div>
                )}
            </div>
        </>
    );
}

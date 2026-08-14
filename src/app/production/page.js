'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';

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
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
    const [importShift, setImportShift] = useState(shift);
    const [importProgress, setImportProgress] = useState(null); // { total, current, status }
    const [importResult, setImportResult] = useState(null);
    const [importRows, setImportRows] = useState([]); // Isolated rows for import
    const [unknownProducts, setUnknownProducts] = useState([]); // Products needing approval
    const [unknownMachines, setUnknownMachines] = useState([]); // Machines not found
    const [productDecisions, setProductDecisions] = useState({}); // { productName: 'create'|'correct'|'skip', correctedName: '' }

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
                    if (line.machines) {
                        line.machines.forEach(m => {
                            if (m.workers) {
                                m.workers.forEach(w => {
                                    allAssigned.push({
                                        ...w,
                                        line_id: line.line_id,
                                        machine_id: m.id,
                                        machine_name: m.machine_name,
                                        product_id: m.product_id || null
                                    });
                                });
                            }
                        });
                    }
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
        if (!c) return;
        const t = document.createElement('div');
        t.className = `toast toast-${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    async function handleStartImport() {
        if (!importFile) return showToast('Please select a file (CSV or XLSX)', 'warning');

        setSubmitting(true);
        setImportProgress({ status: 'Parsing file...' });

        const extension = importFile.name.split('.').pop().toLowerCase();
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                let rows = [];

                if (extension === 'csv') {
                    Papa.parse(importFile, {
                        header: true,
                        skipEmptyLines: true,
                        complete: async (results) => {
                            rows = parseProductRows(results.data);
                            await sendImport(rows);
                        }
                    });
                } else if (['xlsx', 'xls'].includes(extension)) {
                    const XLSX = require('xlsx');
                    const bstr = evt.target.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws);
                    rows = parseProductRows(data);
                    await sendImport(rows);
                }
            } catch (err) {
                showToast('Failed to parse file: ' + err.message, 'error');
                setSubmitting(false);
                setImportProgress(null);
            }
        };

        if (extension === 'csv') {
            reader.readAsText(importFile);
        } else {
            reader.readAsBinaryString(importFile);
        }
    }

    function parseProductRows(data) {
        // Helper: find a value from the row by trying multiple column name variants (case-insensitive, trimmed)
        function getCol(row, ...variants) {
            // Build a normalized key map for this row
            const keys = Object.keys(row);
            for (const variant of variants) {
                const normalized = variant.toLowerCase().trim();
                const match = keys.find(k => k.toLowerCase().trim() === normalized);
                if (match !== undefined && row[match] !== undefined && row[match] !== null && row[match] !== '') {
                    return row[match];
                }
            }
            return undefined;
        }

        if (data.length > 0) {
            console.log('Excel columns detected:', Object.keys(data[0]));
            console.log('First row sample:', JSON.stringify(data[0]));
        }

        return data.map(row => {
            const workerId = String(getCol(row, 'Code', 'User ID', 'Worker_id', 'Worker ID', 'worker id', 'EMP ID', 'Employee ID', 'Emp Code') || '').trim();
            return {
                code: workerId,
                worker_id: workerId,
                line_name: getCol(row, 'LOCATION', 'Location', 'Line', 'LINE', 'line_name'),
                machine_name: getCol(row, 'CELL', 'Cell', 'Machine', 'MACHINE', 'machine_name'),
                product_name: getCol(row, 'PRODUCT NAME', 'Product Name', 'Product', 'product_name', 'PRODUCT'),
                actual_units: getCol(row, 'ACTUAL O/P', 'Actual O/P', 'actual_units', 'ACTUAL', 'Actual'),
                target_units: getCol(row, 'STANDARD O/P', 'Standard O/P', 'target_units', 'STANDARD', 'Standard', 'TARGET')
            };
        }).filter(r => r.worker_id && (r.actual_units !== undefined && r.actual_units !== null && r.actual_units !== ''));
    }

    async function sendImport(rows) {
        if (rows.length === 0) {
            showToast('No valid rows found in file', 'warning');
            setSubmitting(false);
            setImportProgress(null);
            return;
        }

        setImportProgress({ status: 'Verifying entries...', total: rows.length, current: 0 });

        // Simulate live verification progress for UI feedback
        const step = Math.max(1, Math.floor(rows.length / 20)); // Update every 5% or at least 1 row
        for (let i = 0; i <= rows.length; i += step) {
            const current = Math.min(i, rows.length);
            setImportProgress(prev => ({ ...prev, current, status: `Verifying entry ${current}/${rows.length}...` }));
            if (rows.length < 500) await new Promise(r => setTimeout(r, 10)); // Tiny delay for small files to show animation
        }

        try {
            // Final actual validation
            const res = await fetch('/api/production/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows })
            });
            const data = await res.json();

            if (!data.success) {
                showToast(data.error || 'Validation failed', 'error');
                setSubmitting(false);
                setImportProgress(null);
                return;
            }

            // If there are unknown products or machines, handle accordingly
            if ((data.unknownProducts && data.unknownProducts.length > 0) || (data.unknownMachines && data.unknownMachines.length > 0)) {
                setUnknownProducts(data.unknownProducts || []);
                setUnknownMachines(data.unknownMachines || []);
                setProductDecisions({});
                setSubmitting(false);
                setImportProgress(null);
                // Store rows for later use
                setImportRows(rows);
                return;
            }

            // No unknown products, proceed with import
            await proceedWithImport(rows, {});
        } catch (err) {
            showToast('Network error during validation', 'error');
            setSubmitting(false);
            setImportProgress(null);
        }
    }

    async function proceedWithImport(rows, decisions) {
        setImportProgress({ status: 'Importing records...' });
        setSubmitting(true);

        try {
            const res = await fetch('/api/production/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: importDate,
                    shift: importShift,
                    rows,
                    productDecisions: decisions
                })
            });
            const data = await res.json();
            if (data.success) {
                setImportResult(data);
                setUnknownProducts([]);
                showToast(`Imported ${data.imported} records!`, 'success');
                loadData();
            } else {
                showToast(data.error || 'Import failed', 'error');
            }
        } catch (err) {
            showToast('Network error during import', 'error');
        } finally {
            setSubmitting(false);
            setImportProgress(null);
        }
    }

    function handleProductDecision(productName, decision, correctedName = null) {
        const newDecisions = { ...productDecisions };
        if (decision === 'create') {
            newDecisions[productName] = { action: 'create', name: productName };
        } else if (decision === 'correct') {
            newDecisions[productName] = { action: 'correct', name: correctedName };
        } else if (decision === 'skip') {
            newDecisions[productName] = { action: 'skip' };
        }
        setProductDecisions(newDecisions);
    }

    function handleConfirmProductDecisions() {
        // Check if all products have decisions
        const allDecided = unknownProducts.every(p => productDecisions[p.name]);
        if (!allDecided) {
            showToast('Please make a decision for all products', 'warning');
            return;
        }

        // Proceed with import using the decisions
        proceedWithImport(importRows, productDecisions);
        setUnknownProducts([]);
        setUnknownMachines([]);
        setImportRows([]);
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
                        <button 
                            className="btn btn-primary" 
                            onClick={() => {
                                setImportDate(filterDate);
                                setImportShift(shift);
                                setIsImportModalOpen(true);
                            }}
                            style={{ height: '42px', gap: '6px' }}
                        >
                            <span>📥</span> Bulk Import
                        </button>
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
                                            <th>Line</th>
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
                                                <td data-label="Line">{row.line_name || '—'}</td>
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
                                <tr><th>Worker</th><th>Shift</th><th>Line</th><th>Machine</th><th>Product</th><th>Target</th><th>Actual</th><th>Performance</th></tr>
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
                                            <td data-label="Line">{l.line_name || '—'}</td>
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

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h3>📥 Bulk Import Production Logs</h3>
                            <button className="modal-close" onClick={() => {
                                if (!submitting) {
                                    setIsImportModalOpen(false);
                                    setImportResult(null);
                                    setImportFile(null);
                                }
                            }}>&times;</button>
                        </div>

                        {!importResult ? (
                            <div className="modal-body">
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
                                    Upload a CSV file to import production logs for multiple workers at once.
                                </p>

                                <div className="form-row" style={{ marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Import Date</label>
                                        <input 
                                            type="date" 
                                            className="form-input" 
                                            value={importDate} 
                                            onChange={e => setImportDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Shift</label>
                                        <select 
                                            className="form-select" 
                                            value={importShift} 
                                            onChange={e => setImportShift(e.target.value)}
                                        >
                                            <option value="day">☀️ Day Shift</option>
                                            <option value="night">🌙 Night Shift</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Select CSV File</label>
                                    <div style={{ 
                                        border: '2px dashed var(--border-color)', 
                                        borderRadius: 'var(--radius)', 
                                        padding: '30px', 
                                        textAlign: 'center',
                                        background: 'var(--bg-glass)',
                                        cursor: 'pointer'
                                    }} onClick={() => document.getElementById('csv-upload').click()}>
                                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📄</div>
                                        <div style={{ fontWeight: 600 }}>{importFile ? importFile.name : 'Click to select or drag CSV'}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Format: Code, LOCATION, CELL, PRODUCT NAME, ACTUAL O/P, STANDARD O/P
                                        </div>
                                        <input
                                            id="csv-upload"
                                            type="file"
                                            accept=".csv, .xlsx, .xls"
                                            style={{ display: 'none' }}
                                            onChange={e => setImportFile(e.target.files[0])}
                                        />
                                    </div>
                                </div>

                                {importProgress && (
                                    <div style={{ marginTop: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
                                            <span style={{ color: 'var(--accent)' }}>{importProgress.status}</span>
                                            {importProgress.total && (
                                                <span style={{ color: 'var(--text-muted)' }}>
                                                    {Math.round((importProgress.current / importProgress.total) * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ height: '8px', background: 'var(--bg-glass)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                            <div style={{ 
                                                height: '100%', 
                                                width: `${(importProgress.current / (importProgress.total || 1)) * 100}%`, 
                                                background: 'var(--gradient-1)',
                                                transition: 'width 0.2s ease'
                                            }}></div>
                                        </div>
                                        {importProgress.total && (
                                            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                                Processed {importProgress.current} of {importProgress.total} records
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="modal-body">
                                <div style={{
                                    padding: '20px',
                                    background: 'var(--success-bg)',
                                    borderRadius: 'var(--radius)',
                                    marginBottom: '20px',
                                    border: '1px solid var(--success)'
                                }}>
                                    <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>✅</span> Import Complete
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '14px' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Imported</div>
                                            <div style={{ fontSize: '24px', fontWeight: 800 }}>{importResult.imported}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Skipped</div>
                                            <div style={{ fontSize: '24px', fontWeight: 800 }}>{importResult.skipped}</div>
                                        </div>
                                        {importResult.productsCreated && importResult.productsCreated.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Products Created</div>
                                                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)' }}>{importResult.productsCreated.length}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {importResult.errors && importResult.errors.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                            ⚠️ Issues Encountered ({importResult.errors.length})
                                        </div>
                                        <div style={{ 
                                            maxHeight: '200px', 
                                            overflowY: 'auto', 
                                            background: 'var(--bg-glass)', 
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '10px',
                                            fontSize: '12px',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            {importResult.errors.map((err, i) => (
                                                <div key={i} style={{ padding: '4px 0', borderBottom: i < importResult.errors.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                                    {err}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="modal-footer">
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportResult(null);
                                    setImportFile(null);
                                }}
                                disabled={submitting}
                            >
                                {importResult ? 'Close' : 'Cancel'}
                            </button>
                            {!importResult && (
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleStartImport}
                                    disabled={submitting || !importFile}
                                >
                                    {submitting ? '⏳ Importing...' : '🚀 Start Import'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Product & Machine Decisions Modal — rendered AFTER import modal so it layers on top */}
            {(unknownProducts.length > 0 || unknownMachines.length > 0) && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal" style={{ maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h3>⚠️ Import Validation Issues</h3>
                            <button className="modal-close" onClick={() => { setUnknownProducts([]); setUnknownMachines([]); }} disabled={submitting}>&times;</button>
                        </div>

                        <div className="modal-body">
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
                                The following products were not found in the system. For each, you can:
                            </p>
                            <ul style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', paddingLeft: '20px' }}>
                                <li><strong>Create</strong> - Add as a new product</li>
                                <li><strong>Correct</strong> - Fix the product name (typo entry)</li>
                                <li><strong>Skip</strong> - Don't import rows with this product</li>
                            </ul>

                            {unknownMachines.length > 0 && (
                                <div style={{ 
                                    padding: '12px 16px', 
                                    background: 'rgba(239, 68, 68, 0.1)', 
                                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                                    borderRadius: '8px',
                                    marginBottom: '20px'
                                }}>
                                    <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span>🚫</span> {unknownMachines.length} Unknown Machines/Lines Found
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        The following machine/line combinations do not exist in the system. Rows using these will be <strong>skipped</strong>:
                                    </p>
                                    <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '11px', color: 'var(--text-primary)' }}>
                                        {unknownMachines.map((m, i) => (
                                            <div key={i} style={{ padding: '2px 0' }}>
                                                • Worker: <strong>{m.worker_id}</strong> — Line: <strong>{m.line || '—'}</strong>, Machine: <strong>{m.machine}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {unknownProducts.map((product, idx) => (
                                    <div key={idx} style={{
                                        padding: '16px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius)',
                                        background: 'var(--bg-glass)'
                                    }}>
                                        <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--accent)' }}>
                                            {product.name}
                                        </div>

                                        {productDecisions[product.name]?.action === 'correct' ? (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '11px' }}>Corrected Name</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={productDecisions[product.name]?.name || product.name}
                                                        onChange={e => handleProductDecision(product.name, 'correct', e.target.value)}
                                                        placeholder="Enter correct product name"
                                                    />
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleProductDecision(product.name, 'create')}
                                                    style={{ whiteSpace: 'nowrap' }}
                                                >
                                                    Use Original
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    className={`btn btn-sm ${productDecisions[product.name]?.action === 'create' ? 'btn-primary' : 'btn-ghost'}`}
                                                    onClick={() => handleProductDecision(product.name, 'create')}
                                                >
                                                    ✅ Create New
                                                </button>
                                                <button
                                                    className={`btn btn-sm ${productDecisions[product.name]?.action === 'correct' ? 'btn-primary' : 'btn-ghost'}`}
                                                    onClick={() => handleProductDecision(product.name, 'correct', product.name)}
                                                >
                                                    ✏️ Correct Name
                                                </button>
                                                <button
                                                    className={`btn btn-sm ${productDecisions[product.name]?.action === 'skip' ? 'btn-danger' : 'btn-ghost'}`}
                                                    onClick={() => handleProductDecision(product.name, 'skip')}
                                                >
                                                    ⏭️ Skip
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-ghost"
                                onClick={() => { setUnknownProducts([]); setUnknownMachines([]); }}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleConfirmProductDecisions}
                                disabled={submitting}
                            >
                                {submitting ? '⏳ Processing...' : '✅ Confirm & Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

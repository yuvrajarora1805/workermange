'use client';

import { useState, useEffect } from 'react';

export default function LinesPage() {
    const [lines, setLines] = useState([]);
    const [machines, setMachines] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedLine, setSelectedLine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showLineModal, setShowLineModal] = useState(false);
    const [showMachineModal, setShowMachineModal] = useState(false);
    const [editLine, setEditLine] = useState(null);
    const [lineForm, setLineForm] = useState({ name: '', description: '' });
    const [machineForm, setMachineForm] = useState({ name: '', line_id: '', worker_capacity: 1 });

    useEffect(() => { loadLines(); }, []);

    async function loadLines() {
        try {
            const [linesRes, productsRes] = await Promise.all([
                fetch('/api/lines').then(r => r.json()),
                fetch('/api/products').then(r => r.json())
            ]);
            
            if (productsRes.success) setProducts(productsRes.data);
            
            if (linesRes.success) {
                setLines(linesRes.data);
                if (linesRes.data.length > 0 && !selectedLine) {
                    setSelectedLine(linesRes.data[0].id);
                    loadMachines(linesRes.data[0].id);
                }
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    async function loadMachines(lineId) {
        try {
            const res = await fetch(`/api/machines?line_id=${lineId}`);
            const data = await res.json();
            if (data.success) setMachines(data.data);
        } catch (err) { console.error(err); }
    }

    async function handleLineSubmit(e) {
        e.preventDefault();
        try {
            const method = editLine ? 'PUT' : 'POST';
            const body = editLine ? { ...lineForm, id: editLine.id } : lineForm;
            const res = await fetch('/api/lines', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setShowLineModal(false);
                setEditLine(null);
                setLineForm({ name: '', description: '' });
                loadLines();
                showToast(editLine ? 'Line updated!' : 'Line added!', 'success');
            }
        } catch (err) { showToast('Failed to save line', 'error'); }
    }

    async function handleMachineSubmit(e) {
        e.preventDefault();
        try {
            const res = await fetch('/api/machines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...machineForm, line_id: selectedLine }),
            });
            const data = await res.json();
            if (data.success) {
                setShowMachineModal(false);
                setMachineForm({ name: '', worker_capacity: 1 });
                loadMachines(selectedLine);
                loadLines();
                showToast('Machine added!', 'success');
            }
        } catch (err) { showToast('Failed to add machine', 'error'); }
    }

    async function deleteLine(id) {
        if (!confirm('Delete this line and all its machines?')) return;
        try {
            const res = await fetch(`/api/lines?id=${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                loadLines();
                setSelectedLine(null);
                setMachines([]);
                showToast('Line deleted', 'success');
            }
        } catch (err) { showToast('Failed to delete', 'error'); }
    }

    async function deleteMachine(id) {
        if (!confirm('Delete this machine?')) return;
        try {
            const res = await fetch(`/api/machines?id=${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                loadMachines(selectedLine);
                loadLines();
                showToast('Machine deleted', 'success');
            }
        } catch (err) { showToast('Failed to delete', 'error'); }
    }

    async function updateMachineProduct(machineId, productId) {
        try {
            const res = await fetch('/api/machines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: machineId, current_product_id: productId || null }),
            });
            const data = await res.json();
            if (data.success) {
                loadMachines(selectedLine);
                showToast('Product assigned saved!', 'success');
            }
        } catch (err) { showToast('Failed to assign product', 'error'); }
    }

    async function toggleMachineActive(machine) {
        try {
            const res = await fetch('/api/machines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: machine.id, is_active: machine.is_active ? 0 : 1 }),
            });
            if ((await res.json()).success) {
                loadMachines(selectedLine);
                showToast(machine.is_active ? 'Machine deactivated' : 'Machine activated', 'success');
            }
        } catch (err) { showToast('Failed to update', 'error'); }
    }

    async function updateMachineCapacity(machineId, capacity) {
        try {
            const res = await fetch('/api/machines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: machineId, worker_capacity: parseInt(capacity) || 1 }),
            });
            if ((await res.json()).success) {
                loadMachines(selectedLine);
                showToast('Capacity updated', 'success');
            }
        } catch (err) { showToast('Failed to update', 'error'); }
    }

    async function toggleLineActive(line) {
        try {
            const res = await fetch('/api/lines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: line.id, is_active: line.is_active ? 0 : 1 }),
            });
            if ((await res.json()).success) {
                loadLines();
                loadMachines(line.id);
                showToast(line.is_active ? 'Line deactivated — workers will NOT be assigned here' : 'Line activated', 'success');
            }
        } catch (err) { showToast('Failed to update', 'error'); }
    }

    function selectLine(id) {
        setSelectedLine(id);
        loadMachines(id);
    }

    function showToast(msg, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    if (loading) {
        return <div className="loading-overlay"><div className="loader"></div><p>Loading...</p></div>;
    }

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h2>🏭 Lines & Machines</h2>
                        <p>Manage production lines and their machines</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn btn-ghost" onClick={() => { setEditLine(null); setLineForm({ name: '', description: '' }); setShowLineModal(true); }}>
                            + Add Line
                        </button>
                        {selectedLine && (
                            <button className="btn btn-primary" onClick={() => { setMachineForm({ name: '' }); setShowMachineModal(true); }}>
                                + Add Machine
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="responsive-grid responsive-grid-sidebar">
                {/* Lines sidebar */}
                <div className="card" style={{ padding: '12px' }}>
                    <h3 style={{ padding: '12px 12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Production Lines
                    </h3>
                    {lines.map(line => (
                        <div
                            key={line.id}
                            onClick={() => selectLine(line.id)}
                            style={{
                                padding: '14px 16px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: selectedLine === line.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                                borderLeft: selectedLine === line.id ? '3px solid var(--accent)' : '3px solid transparent',
                                marginBottom: '4px',
                                transition: 'var(--transition)',
                                opacity: line.is_active ? 1 : 0.5,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                                    {line.is_active ? '' : '🔴 '}{line.name}
                                </div>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: '10px', padding: '2px 6px', color: line.is_active ? 'var(--warning)' : 'var(--success)' }}
                                    onClick={(e) => { e.stopPropagation(); toggleLineActive(line); }}
                                >
                                    {line.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {line.machine_count} machines {!line.is_active && '— skipped in assignment'}
                            </div>
                        </div>
                    ))}
                    {lines.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No lines yet
                        </div>
                    )}
                </div>

                {/* Machines grid */}
                <div>
                    {selectedLine ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                                    {lines.find(l => l.id === selectedLine)?.name} — Machines
                                </h3>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => {
                                        const line = lines.find(l => l.id === selectedLine);
                                        setEditLine(line);
                                        setLineForm({ name: line.name, description: line.description || '' });
                                        setShowLineModal(true);
                                    }}>✏️ Edit Line</button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => deleteLine(selectedLine)} style={{ color: 'var(--danger)' }}>
                                        🗑️ Delete Line
                                    </button>
                                </div>
                            </div>
                            <div className="machines-grid">
                                {machines.map(m => (
                                <div key={m.id} className="machine-card" style={{ opacity: m.is_active ? 1 : 0.5, border: m.is_active ? (m.worker_capacity > 1 ? '1px solid var(--accent)' : undefined) : '1px dashed var(--danger)' }}>
                                    <div className="machine-name">
                                        {m.is_active ? '' : '🔴 '}{m.name}
                                        {m.worker_capacity > 1 && <span style={{ marginLeft: '8px', fontSize: '10px', background: 'var(--accent)', color: 'white', padding: '1px 4px', borderRadius: '4px' }}>CAPACITY: {m.worker_capacity}</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Position #{m.position}
                                    </div>
                                    <div style={{ marginBottom: '10px' }}>
                                        <select 
                                            id={`machine-product-${m.id}`}
                                            name={`machine_product_${m.id}`}
                                            className="form-select select-sm" 
                                            style={{ fontSize: '12px', padding: '4px 8px', height: 'auto' }}
                                            value={m.current_product_id || ''}
                                            onChange={(e) => updateMachineProduct(m.id, e.target.value)}
                                            disabled={!m.is_active}
                                        >
                                            <option value="">No Product</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Capacity:</label>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="10"
                                                className="form-input" 
                                                style={{ padding: '2px 4px', height: '24px', fontSize: '11px', width: '45px' }}
                                                value={m.worker_capacity || 1}
                                                onChange={(e) => updateMachineCapacity(m.id, e.target.value)}
                                                disabled={!m.is_active}
                                            />
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ width: '100%', justifyContent: 'center', fontSize: '11px', color: m.is_active ? 'var(--warning)' : 'var(--success)' }}
                                            onClick={() => toggleMachineActive(m)}
                                        >
                                            {m.is_active ? '⏸ Deactivate' : '▶ Activate'}
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
                                            onClick={() => deleteMachine(m.id)}
                                        >
                                            🗑️ Remove
                                        </button>
                                    </div>
                                </div>
                                ))}
                            </div>
                            {machines.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🔧</div>
                                    <h3>No machines in this line</h3>
                                    <p>Add machines to start assigning workers</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">🏭</div>
                            <h3>Select a line</h3>
                            <p>Choose a production line to view its machines</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Line modal */}
            {showLineModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowLineModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editLine ? 'Edit Line' : 'Add New Line'}</h3>
                            <button className="modal-close" onClick={() => setShowLineModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleLineSubmit}>
                            <div className="form-group">
                                <label className="form-label">Line Name *</label>
                                <input
                                    id="line-name"
                                    name="line_name"
                                    className="form-input"
                                    required
                                    value={lineForm.name}
                                    onChange={e => setLineForm({ ...lineForm, name: e.target.value })}
                                    placeholder="e.g. Line D"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    id="line-description"
                                    name="line_description"
                                    className="form-textarea"
                                    value={lineForm.description}
                                    onChange={e => setLineForm({ ...lineForm, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowLineModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editLine ? 'Update' : 'Add Line'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Machine modal */}
            {showMachineModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowMachineModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Add Machine to {lines.find(l => l.id === selectedLine)?.name}</h3>
                            <button className="modal-close" onClick={() => setShowMachineModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleMachineSubmit}>
                            <div className="form-group">
                                <label className="form-label">Machine Name *</label>
                                <input
                                    id="machine-name"
                                    name="machine_name"
                                    className="form-input"
                                    required
                                    value={machineForm.name}
                                    onChange={e => setMachineForm({ ...machineForm, name: e.target.value })}
                                    placeholder="e.g. D-M1"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Worker Capacity (Number of workers)</label>
                                <input
                                    type="number"
                                    id="worker-capacity"
                                    name="worker_capacity"
                                    className="form-input"
                                    min="1"
                                    max="10"
                                    required
                                    value={machineForm.worker_capacity}
                                    onChange={e => setMachineForm({ ...machineForm, worker_capacity: parseInt(e.target.value) || 1 })}
                                />
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    How many workers can be assigned to this machine at once?
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowMachineModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Machine</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

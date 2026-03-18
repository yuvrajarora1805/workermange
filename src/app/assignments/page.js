'use client';

import { useState, useEffect } from 'react';

export default function AssignmentsPage() {
    const [data, setData] = useState({ assignments: [], bench: [], unassigned_machines: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [shift, setShift] = useState(() => {
        const hour = new Date().getHours();
        return (hour >= 7 && hour < 19) ? 'day' : 'night';
    });

    // Manual assignment state
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualMachine, setManualMachine] = useState(null);
    const [manualWorkerId, setManualWorkerId] = useState('');

    // Move/Swap selection state
    const [selection, setSelection] = useState(null); // { worker_id, machine_id, source: 'assigned' | 'bench' }

    useEffect(() => { loadAssignments(); }, [date, shift]);

    async function loadAssignments() {
        setLoading(true);
        try {
            const res = await fetch(`/api/assignments?date=${date}&shift=${shift}`);
            const result = await res.json();
            if (result.success) setData(result.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    async function runAutoAssign() {
        setAssigning(true);
        try {
            const res = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date }),
            });
            const result = await res.json();
            if (result.success) {
                showToast(result.data.message, 'success');
                loadAssignments();
            } else {
                showToast(result.error || 'Assignment failed', 'error');
            }
        } catch (err) {
            showToast('Auto-assignment failed', 'error');
        } finally {
            setAssigning(false);
        }
    }

    async function handleManualAssign(e) {
        e.preventDefault();
        try {
            const res = await fetch('/api/assignments/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ worker_id: manualWorkerId, machine_id: manualMachine.id, date })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Worker manually assigned!', 'success');
                setShowManualModal(false);
                setManualWorkerId('');
                loadAssignments();
            } else {
                showToast(result.error || 'Assignment failed', 'error');
            }
        } catch (err) {
            showToast('Failed to assign', 'error');
        }
    }

    function getEfficiencyClass(score) {
        if (score >= 70) return 'efficiency-high';
        if (score >= 50) return 'efficiency-medium';
        if (score >= 30) return 'efficiency-low';
        return 'efficiency-poor';
    }

    function showToast(msg, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    async function rejectWorker(workerId) {
        if (!confirm('Are you sure you want to reject this worker? They will be marked as absent for this shift.')) return;
        
        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    worker_id: workerId, 
                    status: 'absent', 
                    date, 
                    shift 
                })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Worker rejected (marked absent)', 'success');
                loadAssignments();
            } else {
                showToast(result.error || 'Failed to reject', 'error');
            }
        } catch (err) {
            showToast('Failed to reject worker', 'error');
        }
    }

    async function handleMoveSwap(targetWorkerId, targetMachineId) {
        if (!selection) return;

        const { worker_id: sourceWorkerId } = selection;

        // If clicking the same worker, cancel selection
        if (sourceWorkerId === targetWorkerId) {
            setSelection(null);
            return;
        }

        try {
            setLoading(true);
            
            // If we have a targetWorkerId, it's a swap or a move to that worker's spot
            // If we only have a targetMachineId, it's a move to an empty slot
            const endpoint = targetWorkerId ? '/api/assignments/swap' : '/api/assignments/manual';
            const body = targetWorkerId 
                ? { worker1_id: sourceWorkerId, worker2_id: targetWorkerId, date, shift }
                : { worker_id: sourceWorkerId, machine_id: targetMachineId, date, shift };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await res.json();
            if (result.success) {
                showToast(targetWorkerId ? 'Workers swapped/moved!' : 'Worker moved!', 'success');
                setSelection(null);
                loadAssignments();
            } else {
                showToast(result.error || 'Action failed', 'error');
            }
        } catch (err) {
            showToast('Action failed', 'error');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="loading-overlay"><div className="loader"></div><p>Loading assignments...</p></div>;
    }

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h2>🔧 Machine Assignments</h2>
                        <p>Worker-to-machine allocation based on efficiency</p>
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
                            id="assignments-date"
                            name="assignments_date"
                            type="date"
                            className="form-input"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            style={{ height: '42px', width: '160px', flexShrink: 0 }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={runAutoAssign}
                            disabled={assigning}
                            style={{ height: '42px', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                            {assigning ? (
                                <><div className="loader" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div> Assigning...</>
                            ) : (
                                <>⚡ Run Auto-Assignment</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="stats-grid responsive-grid-3">
                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{data.summary.total_assigned || 0}</div>
                    <div className="stat-label">Workers Assigned</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🪑</div>
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{data.summary.total_bench || 0}</div>
                    <div className="stat-label">On Bench</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🔧</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{data.summary.total_unassigned_machines || 0}</div>
                    <div className="stat-label">Empty Machines</div>
                </div>
            </div>

            {/* Assignment Lines */}
            {data.assignments.length > 0 ? (
                data.assignments.map(line => (
                    <div key={line.line_id} className="line-section">
                        <div className="line-header">
                            <span style={{ fontSize: '20px' }}>🏭</span>
                            <h3>{line.line_name}</h3>
                            <span className="badge badge-info">{line.machines.length} assigned</span>
                        </div>
                        <div className="machines-grid">
                            {line.machines.map(m => (
                                <div key={m.id} className="machine-card assigned" style={{ minHeight: '140px' }}>
                                    <div className="machine-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <div className="machine-name" style={{ marginBottom: 0 }}>{m.machine_name}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                            Cap: {m.workers.length}/{m.worker_capacity}
                                        </div>
                                    </div>
                                    
                                    <div className="machine-workers-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {m.workers.map(w => {
                                            const isSelected = selection?.worker_id === w.worker_id;
                                            return (
                                                <div 
                                                    key={w.assignment_id} 
                                                    className={`worker-mini-card ${isSelected ? 'selected' : ''}`} 
                                                    style={{ 
                                                        background: isSelected ? 'rgba(79, 70, 229, 0.2)' : 'rgba(255,255,255,0.03)', 
                                                        padding: '8px', 
                                                        borderRadius: '6px', 
                                                        border: isSelected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)',
                                                        cursor: selection ? 'pointer' : 'default',
                                                        position: 'relative'
                                                    }}
                                                    onClick={() => selection ? handleMoveSwap(w.worker_id, m.id) : null}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>{w.worker_name}</div>
                                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{w.employee_id}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                            {w.efficiency_score !== null && (
                                                                <span className={`efficiency-badge ${getEfficiencyClass(w.efficiency_score)}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                                                                    {parseFloat(w.efficiency_score).toFixed(0)}%
                                                                </span>
                                                            )}
                                                            <button 
                                                                className="btn btn-ghost btn-sm" 
                                                                style={{ fontSize: '10px', padding: '2px 4px', height: 'auto' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelection({ worker_id: w.worker_id, machine_id: m.id, source: 'assigned' });
                                                                }}
                                                            >
                                                                {selection?.worker_id === w.worker_id ? '❌' : '🔄'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {m.workers.length < m.worker_capacity && (
                                        <button 
                                            className="btn btn-primary btn-sm" 
                                            style={{ 
                                                marginTop: '12px', 
                                                width: '100%', 
                                                fontSize: '11px', 
                                                height: '28px', 
                                                background: selection ? 'var(--accent)' : 'transparent',
                                                borderColor: selection ? 'var(--accent)' : 'var(--border-color)',
                                                borderStyle: selection ? 'solid' : 'dashed'
                                            }}
                                            onClick={() => selection ? handleMoveSwap(null, m.id) : (() => { setManualMachine(m); setShowManualModal(true); })()}
                                        >
                                            {selection ? '📍 Move Here' : '+ Add Worker'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">🔧</div>
                        <h3>No assignments for this date</h3>
                        <p>Mark attendance first, then click &quot;Run Auto-Assignment&quot; to allocate workers</p>
                    </div>
                </div>
            )}

            {/* Unassigned machines */}
            {data.unassigned_machines?.length > 0 && (
                <div className="line-section" style={{ marginTop: '24px' }}>
                    <div className="line-header" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                        <span style={{ fontSize: '20px' }}>⚠️</span>
                        <h3>Empty Machines (0 Workers)</h3>
                        <span className="badge badge-danger">{data.unassigned_machines.length} unassigned</span>
                    </div>
                    <div className="machines-grid">
                        {data.unassigned_machines.map(m => (
                            <div key={m.id} className="machine-card unassigned">
                                <div className="machine-name">{m.machine_name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.line_name}</div>
                                <button 
                                    className="btn btn-sm" 
                                    style={{ 
                                        marginTop: '8px', 
                                        width: '100%', 
                                        justifyContent: 'center',
                                        background: selection ? 'var(--accent)' : 'transparent',
                                        color: selection ? 'white' : 'var(--text-primary)',
                                        borderColor: selection ? 'var(--accent)' : 'var(--border-color)'
                                    }}
                                    onClick={() => selection ? handleMoveSwap(null, m.id) : (() => { setManualMachine(m); setShowManualModal(true); })()}
                                >
                                    {selection ? '📍 Move Here' : 'Assign Worker'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bench Workers */}
            {data.bench?.length > 0 && (
                <div className="bench-section">
                    <div className="line-header" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                        <span style={{ fontSize: '20px' }}>🪑</span>
                        <h3>Bench Workers</h3>
                        <span className="badge badge-warning">{data.bench.length} waiting</span>
                    </div>
                    <div className="bench-grid">
                        {data.bench.map(w => {
                            const isSelected = selection?.worker_id === w.id;
                            return (
                                <div 
                                    key={w.id} 
                                    className={`bench-card ${isSelected ? 'selected' : ''}`} 
                                    style={{ 
                                        position: 'relative',
                                        background: isSelected ? 'rgba(79, 70, 229, 0.2)' : 'var(--card-bg)',
                                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                                        cursor: selection ? 'pointer' : 'default'
                                    }}
                                    onClick={() => selection ? handleMoveSwap(w.id, null) : null}
                                >
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); rejectWorker(w.id); }}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            color: 'var(--danger)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '14px',
                                            transition: 'all 0.2s',
                                            zIndex: 2
                                        }}
                                        title="Reject Worker"
                                    >
                                        ×
                                    </button>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{w.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{w.employee_id}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                        {w.efficiency_score !== null && w.efficiency_score !== undefined && (
                                            <span className={`efficiency-badge ${getEfficiencyClass(w.efficiency_score)}`} style={{ margin: 0 }}>
                                                {parseFloat(w.efficiency_score).toFixed(1)}%
                                            </span>
                                        )}
                                        <button 
                                            className="btn btn-ghost btn-sm" 
                                            style={{ fontSize: '10px', padding: '2px 4px', height: 'auto' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelection({ worker_id: w.id, machine_id: null, source: 'bench' });
                                            }}
                                        >
                                            {isSelected ? '❌' : '🔄'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {showManualModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowManualModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Assign Worker to {manualMachine?.machine_name}</h3>
                            <button className="modal-close" onClick={() => setShowManualModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleManualAssign}>
                            <div className="form-group">
                                <label className="form-label">Select Bench Worker</label>
                                <select
                                    id="manual-assignment-worker"
                                    name="manual_assignment_worker_id"
                                    className="form-select"
                                    value={manualWorkerId}
                                    onChange={e => setManualWorkerId(e.target.value)}
                                    required
                                >
                                    <option value="">Choose worker...</option>
                                    {data.bench.map(w => (
                                        <option key={w.id} value={w.id}>{w.name} ({w.employee_id})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowManualModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Assign Worker</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

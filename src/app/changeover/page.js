'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangeoverPage() {
    const router = useRouter();
    const [pendingShifts, setPendingShifts] = useState([]);
    const [lines, setLines] = useState([]);
    const [products, setProducts] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({}); // { log_id: { actual, defects, machine_fault } }
    
    // Selection state
    const [targetType, setTargetType] = useState('line'); // 'line' or 'machine'
    const [selectedTargetId, setSelectedTargetId] = useState('');
    const [selectedNewProductId, setSelectedNewProductId] = useState('');

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [sRes, lRes, pRes] = await Promise.all([
                fetch('/api/end-shift/pending').then(r => r.json()),
                fetch('/api/lines').then(r => r.json()),
                fetch('/api/products').then(r => r.json())
            ]);

            if (sRes.success) setPendingShifts(sRes.data);
            if (lRes.success) setLines(lRes.data);
            if (pRes.success) setProducts(pRes.data);
        } catch (err) { console.error('Failed to load data', err); }
        finally { setLoading(false); }
    }

    function handleInput(logId, field, value) {
        setFormData(prev => ({
            ...prev,
            [logId]: { ...prev[logId], [field]: value }
        }));
    }

    // Filter shifts based on selection
    const filteredShifts = pendingShifts.filter(s => {
        if (!selectedTargetId) return false;
        if (targetType === 'line') return s.line_id.toString() === selectedTargetId;
        if (targetType === 'machine') return s.machine_id.toString() === selectedTargetId;
        return false;
    });

    // Initialize form data when target changes
    useEffect(() => {
        const initForm = {};
        filteredShifts.forEach(s => {
            if (!formData[s.log_id]) {
                initForm[s.log_id] = { actual_units: '', defective_count: '0', machine_fault_flag: false };
            } else {
                initForm[s.log_id] = formData[s.log_id];
            }
        });
        setFormData(initForm);
    }, [selectedTargetId, targetType, pendingShifts]);


    // Extract unique machines for the dropdown if target is machine
    const availableMachines = [];
    if (targetType === 'machine') {
        const machineMap = new Map();
        pendingShifts.forEach(s => {
            if (!machineMap.has(s.machine_id)) {
                machineMap.set(s.machine_id, { id: s.machine_id, name: s.machine_name, line_name: s.line_name });
            }
        });
        availableMachines.push(...Array.from(machineMap.values()));
    }


    async function handleSubmit(e) {
        e.preventDefault();
        
        if (!selectedNewProductId) {
            return showToast('Please select the new product.', 'warning');
        }

        if (filteredShifts.length === 0) {
            return showToast('No workers active on this selection.', 'warning');
        }

        // Validation: all actual_units must be filled
        for (const s of filteredShifts) {
            const fd = formData[s.log_id];
            if (!fd || fd.actual_units === '' || isNaN(fd.actual_units)) {
                return showToast(`Please enter Actual Units for ${s.worker_name}`, 'warning');
            }
        }

        setSubmitting(true);
        try {
            const machineIds = new Set();
            const entries = filteredShifts.map(s => {
                machineIds.add(s.machine_id);
                const fd = formData[s.log_id];
                const hrs = (new Date() - new Date(s.start_time)) / 3600000;
                const calculated_target = s.hourly_target ? Math.round(s.hourly_target * hrs) : 0;
                const final_target = fd.target_override ? parseInt(fd.target_override) : calculated_target;
                
                return {
                    log_id: s.log_id,
                    worker_id: s.worker_id,
                    machine_id: s.machine_id,
                    product_id: s.product_id, // OLD product id
                    target_units: final_target,
                    actual_units: parseInt(fd.actual_units),
                    defective_count: parseInt(fd.defective_count) || 0,
                    machine_fault_flag: fd.machine_fault_flag,
                    low_efficiency_reason: fd.low_efficiency_reason || null
                };
            });

            // Date and shift will be safely handled server-side if omitted
            const res = await fetch('/api/changeover/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    new_product_id: selectedNewProductId,
                    entries,
                    machine_ids: Array.from(machineIds)
                })
            });
            const result = await res.json();
            
            if (result.success) {
                showToast('Changeover Executed Successfully!', 'success');
                setSelectedTargetId('');
                setSelectedNewProductId('');
                loadData(); // refresh active shifts
            } else {
                showToast(result.error || 'Failed to execute changeover', 'error');
            }
        } catch (err) {
            showToast('Failed to execute Changeover', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
        if(!c) return;
        const t = document.createElement('div');
        t.className = `toast toast-${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 4000);
    }

    function formatDuration(startTime) {
        const diffMs = new Date() - new Date(startTime);
        const totalMinutes = Math.floor(diffMs / 60000);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    }

    if (loading) return <div className="loading-overlay"><div className="loader"></div></div>;

    return (
        <div className="container-fluid" style={{ padding: '24px' }}>
            <div id="toast-container"></div>
            <div className="page-header" style={{ marginBottom: '32px' }}>
                <div>
                    <h2>🔄 Product Changeover</h2>
                    <p>Switch a Line or Machine to a new product mid-shift. This will log the partial production and start a new time segment.</p>
                </div>
            </div>
            
            <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                    
                    <div className="form-group">
                        <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>1. Target Type</label>
                        <select 
                            className="form-input" 
                            value={targetType} 
                            onChange={(e) => { setTargetType(e.target.value); setSelectedTargetId(''); }}
                        >
                            <option value="line">Entire Line</option>
                            <option value="machine">Specific Machine</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>2. Select {targetType === 'line' ? 'Line' : 'Machine'}</label>
                        <select 
                            className="form-input" 
                            value={selectedTargetId} 
                            onChange={(e) => setSelectedTargetId(e.target.value)}
                        >
                            <option value="">-- Choose {targetType === 'line' ? 'Line' : 'Machine'} --</option>
                            {targetType === 'line' ? (
                                lines.filter(l => l.is_active).map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))
                            ) : (
                                availableMachines.map(m => (
                                    <option key={m.id} value={m.id}>{m.line_name} - {m.name}</option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="form-group">
                        <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', color: 'var(--success)' }}>3. New Product</label>
                        <select 
                            className="form-input" 
                            value={selectedNewProductId} 
                            onChange={(e) => setSelectedNewProductId(e.target.value)}
                            style={{ borderColor: 'var(--success)', background: 'rgba(16,185,129,0.05)' }}
                        >
                            <option value="">-- Choose New Product --</option>
                            {products.filter(p => p.is_active).map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.hourly_target}/hr)</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {selectedTargetId && filteredShifts.length > 0 && (
                <form onSubmit={handleSubmit} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0, fontSize: '18px' }}>Enter Production for Old Product</h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                            Before changing over, log what these workers produced up to this point.
                        </p>
                    </div>
                    
                    <div className="table-wrapper" style={{ overflowX: 'visible' }}>
                        <table className="mobile-stack-table">
                            <thead>
                                <tr>
                                    <th>Worker</th>
                                    <th>Machine / Old Product</th>
                                    <th>Time Elapsed</th>
                                    <th>Standard Target</th>
                                    <th style={{ width: '120px' }}>Actual Units *</th>
                                    <th style={{ width: '160px' }}>Defects Logs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredShifts.map(s => {
                                    const hrs = ((new Date() - new Date(s.start_time)) / 3600000).toFixed(1);
                                    const expected = s.hourly_target ? Math.round(s.hourly_target * hrs) : '—';
                                    
                                    return (
                                        <tr key={s.log_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td data-label="Worker">
                                                <div style={{ fontWeight: 600 }}>{s.worker_name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.employee_id}</div>
                                            </td>
                                            <td data-label="Task">
                                                <div>{s.machine_name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--danger)' }}>{s.product_name || 'No Product'}</div>
                                            </td>
                                            <td data-label="Time">
                                                <div><strong>{formatDuration(s.start_time)}</strong> running</div>
                                            </td>
                                            <td data-label="Standard Target">
                                                <input 
                                                    type="number" 
                                                    className="form-input" 
                                                    style={{ width: '80px', fontWeight: 600, color: 'var(--info)' }}
                                                    value={formData[s.log_id]?.target_override !== undefined ? formData[s.log_id].target_override : (expected === '—' ? '' : expected)}
                                                    onChange={e => handleInput(s.log_id, 'target_override', e.target.value)}
                                                />
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>({s.hourly_target ? parseFloat(s.hourly_target) : 0}/hr std)</div>
                                            </td>
                                            <td data-label="Actuals">
                                                <input 
                                                    type="number" 
                                                    className="form-input" 
                                                    placeholder="e.g. 450"
                                                    required
                                                    value={formData[s.log_id]?.actual_units || ''}
                                                    onChange={e => handleInput(s.log_id, 'actual_units', e.target.value)}
                                                />
                                            </td>
                                            <td data-label="Defects" style={{ verticalAlign: 'top' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <input 
                                                        type="number" 
                                                        className="form-input" 
                                                        placeholder="Defects (0)"
                                                        min="0"
                                                        value={formData[s.log_id]?.defective_count || ''}
                                                        onChange={e => handleInput(s.log_id, 'defective_count', e.target.value)}
                                                    />
                                                    {(parseInt(formData[s.log_id]?.defective_count) > 0) && (
                                                        <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--warning)' }}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={formData[s.log_id]?.machine_fault_flag || false}
                                                                onChange={e => handleInput(s.log_id, 'machine_fault_flag', e.target.checked)}
                                                            />
                                                            Machine Fault? (No Penalty)
                                                        </label>
                                                    )}
                                                    
                                                    {formData[s.log_id]?.actual_units !== '' && !isNaN(expected) && expected > 0 && 
                                                    ((parseInt(formData[s.log_id]?.actual_units) / expected) * 80) < 50 && (
                                                        <input 
                                                            type="text" 
                                                            className="form-input" 
                                                            style={{ fontSize: '11px', borderColor: 'var(--danger)' }}
                                                            placeholder="Reason for low efficiency"
                                                            value={formData[s.log_id]?.low_efficiency_reason || ''}
                                                            onChange={e => handleInput(s.log_id, 'low_efficiency_reason', e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', background: 'var(--card-bg)' }}>
                        <button type="submit" className="btn btn-primary" style={{ height: '48px', padding: '0 30px', fontSize: '16px' }} disabled={submitting}>
                            {submitting ? '⏳ Processing...' : '✅ Confirm Changeover'}
                        </button>
                    </div>
                </form>
            )}

            {selectedTargetId && filteredShifts.length === 0 && (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>😴</div>
                    <h3 style={{ margin: '0 0 8px 0' }}>No Active Workers</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>There are no active workers assigned to this selection right now.</p>
                </div>
            )}
        </div>
    );
}

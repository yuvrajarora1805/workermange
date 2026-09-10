'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EndShiftPage() {
    const router = useRouter();
    const [pendingShifts, setPendingShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({}); // { log_id: { actual, defects, machine_fault } }
    const [selectedDate, setSelectedDate] = useState('');
    
    // Check if there are active downtimes
    const [activeDowntime, setActiveDowntime] = useState(false);

    useEffect(() => { loadData(); }, [selectedDate]);

    async function loadData() {
        try {
            setLoading(true);
            const url = selectedDate ? `/api/end-shift/pending?date=${selectedDate}` : '/api/end-shift/pending';
            const [pRes, dRes] = await Promise.all([
                fetch(url).then(r => r.json()),
                fetch('/api/downtime').then(r => r.json())
            ]);

            if (pRes.success) {
                setPendingShifts(pRes.data);
                const initForm = {};
                pRes.data.forEach(s => {
                    initForm[s.log_id] = { actual_units: '', defective_count: '0', machine_fault_flag: false };
                });
                setFormData(initForm);
            }
            if (dRes.success) {
                const pendingLineIds = new Set(pRes.success ? pRes.data.map(s => s.line_id) : []);
                const hasActive = dRes.data.some(d => 
                    !d.end_time && (d.is_all_lines || pendingLineIds.has(d.line_id))
                );
                setActiveDowntime(hasActive);
            }
        } catch (err) { console.error('Failed to load pending shifts', err); }
        finally { setLoading(false); }
    }

    function handleInput(logId, field, value) {
        setFormData(prev => ({
            ...prev,
            [logId]: { ...prev[logId], [field]: value }
        }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        
        // Validation: all actual_units must be filled
        for (const s of pendingShifts) {
            const fd = formData[s.log_id];
            if (fd.actual_units === '' || isNaN(fd.actual_units)) {
                return showToast(`Please enter Actual Units for ${s.worker_name}`, 'warning');
            }
        }

        if (activeDowntime) {
            return showToast('You must close all Active Downtimes before ending the shift.', 'error');
        }

        setSubmitting(true);
        try {
            const entries = pendingShifts.map(s => {
                const fd = formData[s.log_id];
                const hrs = (new Date() - new Date(s.start_time)) / 3600000;
                const calculated_target = s.hourly_target ? Math.round(s.hourly_target * hrs) : 0;
                const final_target = fd.target_override ? parseInt(fd.target_override) : calculated_target;
                
                return {
                    log_id: s.log_id,
                    worker_id: s.worker_id,
                    machine_id: s.machine_id,
                    product_id: s.product_id,
                    target_units: final_target,
                    actual_units: parseInt(fd.actual_units),
                    defective_count: parseInt(fd.defective_count) || 0,
                    machine_fault_flag: fd.machine_fault_flag,
                    low_efficiency_reason: fd.low_efficiency_reason || null
                };
            });

            const res = await fetch('/api/end-shift/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries })
            });
            const result = await res.json();
            
            if (result.success) {
                showToast('Shift Ended Successfully!', 'success');
                setPendingShifts([]);
                router.push('/dashboard/production'); // Redirect to dashboard
            } else {
                showToast(result.error || 'Failed to end shift', 'error');
            }
        } catch (err) {
            showToast('Failed to execute End Shift', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleEndShiftIndividual(s) {
        const fd = formData[s.log_id];
        if (!fd || fd.actual_units === '' || isNaN(fd.actual_units)) {
            return showToast(`Please enter Actual Units for ${s.worker_name}`, 'warning');
        }

        if (activeDowntime) {
            return showToast('You must close all Active Downtimes before ending the shift.', 'error');
        }

        if (!confirm(`Are you sure you want to end the shift early for ${s.worker_name}? This will check them out individually.`)) {
            return;
        }

        setSubmitting(true);
        try {
            const hrs = ((new Date() - new Date(s.start_time)) / 3600000).toFixed(1);
            const calculated_target = s.hourly_target ? Math.round(s.hourly_target * hrs) : 0;
            const final_target = fd.target_override ? parseInt(fd.target_override) : calculated_target;
            
            const entries = [{
                log_id: s.log_id,
                worker_id: s.worker_id,
                machine_id: s.machine_id,
                product_id: s.product_id,
                target_units: final_target,
                actual_units: parseInt(fd.actual_units),
                defective_count: parseInt(fd.defective_count) || 0,
                machine_fault_flag: fd.machine_fault_flag || false,
                low_efficiency_reason: fd.low_efficiency_reason || null
            }];

            const res = await fetch('/api/end-shift/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries })
            });
            const result = await res.json();
            
            if (result.success) {
                showToast(`Shift ended successfully for ${s.worker_name}!`, 'success');
                loadData();
            } else {
                showToast(result.error || 'Failed to end shift', 'error');
            }
        } catch (err) {
            showToast('Failed to execute End Shift', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
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

    // Group pending shifts by line
    const groupedShifts = {};
    if (pendingShifts.length > 0) {
        pendingShifts.forEach(s => {
            const lineKey = s.line_id || 'unassigned';
            if (!groupedShifts[lineKey]) {
                groupedShifts[lineKey] = {
                    line_name: s.line_name || 'Other',
                    shifts: []
                };
            }
            groupedShifts[lineKey].shifts.push(s);
        });
    }

    return (
        <>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2>🏁 End of Shift Validation</h2>
                    <p>Enter the final production and defect data for all active workers before closing the shift.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                        type="date" 
                        className="form-input" 
                        style={{ width: 'auto', height: '38px' }}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    {activeDowntime && (
                        <button className="btn btn-sm" style={{ background: 'var(--danger)', color: 'white', border: 'none', height: '38px' }} onClick={() => router.push('/downtime')}>
                            ⚠️ Active Downtime Detected - Click to Resolve
                        </button>
                    )}
                </div>
            </div>
            
            {pendingShifts.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <h3>No Active Shifts</h3>
                        <p>All worker assignments and shifts have been successfully closed for the selected date.</p>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                            {Object.values(groupedShifts).map(group => (
                                <div key={group.line_name} style={{ marginBottom: '32px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '20px', background: 'rgba(255,255,255,0.01)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>🏭 {group.line_name.toUpperCase()}</h3>
                                        <span className="badge badge-info" style={{ marginLeft: 'auto' }}>{group.shifts.length} Workers</span>
                                    </div>
                                    <div className="table-wrapper" style={{ overflowX: 'visible' }}>
                                        <table className="mobile-stack-table">
                                            <thead>
                                                <tr>
                                                    <th>Worker</th>
                                                    <th>Machine / Product</th>
                                                    <th>Time Matrix</th>
                                                    <th>Standard Target</th>
                                                    <th style={{ width: '120px' }}>Actual Units *</th>
                                                    <th style={{ width: '160px' }}>Defects Logs</th>
                                                    <th style={{ width: '110px' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.shifts.map(s => {
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
                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.product_name}</div>
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
                                                                    title="Edit standard target if required"
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
                                                            <td data-label="Action">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-sm"
                                                                    style={{ width: '100%', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                                                                    onClick={() => handleEndShiftIndividual(s)}
                                                                    disabled={submitting}
                                                                >
                                                                    ⏱️ End Early
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                            
                            <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', marginTop: '20px' }}>
                                <button type="submit" className="btn btn-primary" style={{ height: '48px', padding: '0 30px', fontSize: '16px' }} disabled={submitting || activeDowntime}>
                                    {submitting ? '⏳ Processing...' : '🏁 Confirm & End Shift For All'}
                                </button>
                            </div>
                        </form>
            )}
                </>
            );
}

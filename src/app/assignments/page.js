'use client';

import { useState, useEffect, useRef } from 'react';

export default function AssignmentsPage() {
    const [data, setData] = useState({ assignments: [], bench: [], unassigned_machines: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [shift, setShift] = useState('day');

    const [showManualModal, setShowManualModal] = useState(false);
    const [manualMachine, setManualMachine] = useState(null);
    const [manualWorkerId, setManualWorkerId] = useState('');
    const [manualSearch, setManualSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [benchSearch, setBenchSearch] = useState('');
    const [showProductAlert, setShowProductAlert] = useState(false);
    const [machinesWithoutProduct, setMachinesWithoutProduct] = useState([]);
    const [now, setNow] = useState(new Date());

    // Swap state
    const [swapSource, setSwapSource] = useState(null); // Step 1: selected source worker
    const [swapTarget, setSwapTarget] = useState(null); // Step 2: selected target worker
    const [swapForm, setSwapForm] = useState({ sourceTarget: '', sourceActuals: '', sourceDefective: '', targetTarget: '', targetActuals: '', targetDefective: '' });

    const [isDragMode, setIsDragMode] = useState(false);
    const lastTap = useRef({ time: 0, id: null });
    const [localData, setLocalData] = useState(null);
    const [pendingMoves, setPendingMoves] = useState([]);
    const [selectedWorkerForMove, setSelectedWorkerForMove] = useState(null); // { worker_id, worker_name, old_machine_id, new_machine_id, new_machine_name }
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchForm, setBatchForm] = useState({}); // worker_id -> { actuals, defective, target }


    // Live timer update
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const hour = new Date().getHours();
        setShift((hour >= 7 && hour < 19) ? 'day' : 'night');
    }, []);

    useEffect(() => { loadAssignments(); }, [date, shift]);

    useEffect(() => {
        if (!isDragMode) {
            setLocalData(JSON.parse(JSON.stringify(data)));
            setPendingMoves([]);
            setSelectedWorkerForMove(null);
        }
    }, [data, isDragMode]);


    async function loadAssignments() {
        setLoading(true);
        try {
            const res = await fetch(`/api/assignments?date=${date}&shift=${shift}`);
            const result = await res.json();
            if (result.success) setData(result.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    async function checkAndRunAutoAssign() {
        try {
            const res = await fetch(`/api/machines/check-products?date=${date}&shift=${shift}`);
            const result = await res.json();
            if (result.data?.machinesWithoutProduct && result.data.machinesWithoutProduct.length > 0) {
                setMachinesWithoutProduct(result.data.machinesWithoutProduct);
                setShowProductAlert(true);
            } else {
                await runAutoAssign(false);
            }
        } catch (err) { showToast('Failed to check machines', 'error'); }
    }

    async function runAutoAssign(useBestEfficiency = false) {
        setAssigning(true);
        setShowProductAlert(false);
        try {
            const res = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, shift, useBestEfficiency }),
            });
            const result = await res.json();
            if (result.success) { showToast(result.data.message, 'success'); loadAssignments(); }
            else { showToast(result.error || 'Assignment failed', 'error'); }
        } catch (err) { showToast('Auto-assignment failed', 'error'); }
        finally { setAssigning(false); }
    }

    async function handleManualAssign(e) {
        e.preventDefault();
        try {
            const res = await fetch('/api/assignments/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ worker_id: manualWorkerId, machine_id: manualMachine.id, date, shift })
            });
            const result = await res.json();
            if (result.success) { 
                showToast('Worker manually assigned!', 'success'); 
                setShowManualModal(false); 
                setManualWorkerId(''); 
                setManualSearch('');
                loadAssignments(); 
            }
            else { showToast(result.error || 'Assignment failed', 'error'); }
        } catch (err) { showToast('Failed to assign', 'error'); }
    }

    function getEfficiencyClass(score) {
        if (score >= 70) return 'efficiency-high';
        if (score >= 50) return 'efficiency-medium';
        if (score >= 30) return 'efficiency-low';
        return 'efficiency-poor';
    }

    
    function handleDragStart(e, worker, sourceMachine) {
        if (!isDragMode) return;
        e.dataTransfer.setData('application/json', JSON.stringify({ worker, sourceMachineId: sourceMachine.id }));
    }

    function handleDropOnMachine(e, targetMachine) {
        if (!isDragMode) return;
        e.preventDefault();
        try {
            const { worker, sourceMachineId } = JSON.parse(e.dataTransfer.getData('application/json'));
            if (sourceMachineId === targetMachine.id) return; // Same machine
            
            // Clone local data
            const newData = { ...localData };
            
            // Find source and target in newData
            let sourceList, targetList;
            
            // Function to find the worker's array
            const findListAndRemove = (wid) => {
                let removedWorker = null;
                newData.assignments.forEach(line => {
                    line.machines.forEach(m => {
                        const idx = m.workers.findIndex(w => w.worker_id === wid);
                        if (idx !== -1) {
                            removedWorker = m.workers.splice(idx, 1)[0];
                        }
                    });
                });
                return removedWorker;
            };

            const wToMove = findListAndRemove(worker.worker_id);
            if (!wToMove) return;

            // Target machine
            let tMachine = null;
            newData.assignments.forEach(line => {
                line.machines.forEach(m => {
                    if (m.id === targetMachine.id) tMachine = m;
                });
            });
            if (!tMachine) {
                newData.unassigned_machines.forEach(m => {
                    if (m.id === targetMachine.id) tMachine = m;
                });
            }

            if (tMachine) {
                if (!tMachine.workers) tMachine.workers = [];
                // If over capacity, displace the first worker
                if (tMachine.workers.length >= (tMachine.worker_capacity || 1)) {
                    const displaced = tMachine.workers.shift();
                    // Put displaced worker to bench or source machine?
                    // Let's put them in source machine if possible
                    let sMachine = null;
                    newData.assignments.forEach(line => {
                        line.machines.forEach(m => { if (m.id === sourceMachineId) sMachine = m; });
                    });
                    if (sMachine) {
                        sMachine.workers.push(displaced);
                        // Track displaced move
                        updatePendingMove(displaced, targetMachine.id, sMachine.id, sMachine.machine_name || sMachine.name);
                    }
                }
                tMachine.workers.push(wToMove);
                updatePendingMove(wToMove, sourceMachineId, tMachine.id, tMachine.machine_name || tMachine.name);
            }
            
            setLocalData(newData);
        } catch (err) { console.error(err); }
    }
    
    function updatePendingMove(worker, oldMid, newMid, newMName) {
        setPendingMoves(prev => {
            const existing = prev.find(p => p.worker_id === worker.worker_id);
            if (existing) {
                if (existing.original_machine_id === newMid) {
                    // Moved back to original, remove from pending
                    return prev.filter(p => p.worker_id !== worker.worker_id);
                } else {
                    return prev.map(p => p.worker_id === worker.worker_id ? { ...p, new_machine_id: newMid, new_machine_name: newMName } : p);
                }
            } else {
                return [...prev, { 
                    worker_id: worker.worker_id, 
                    worker_name: worker.worker_name, 
                    original_machine_id: oldMid, 
                    new_machine_id: newMid,
                    new_machine_name: newMName
                }];
            }
        });
    }

    function openBatchModal() {
        // init form
        const form = {};
        pendingMoves.forEach(p => {
            form[p.worker_id] = { actuals: '', defective: '', target: '' };
        });
        setBatchForm(form);
        setShowBatchModal(true);
    }

    async function handleBatchSubmit(e) {
        e.preventDefault();
        setAssigning(true);
        try {
            const assignments = pendingMoves.map(p => ({
                worker_id: p.worker_id,
                machine_id: p.new_machine_id,
                actuals: parseInt(batchForm[p.worker_id]?.actuals) || 0,
                defective: parseInt(batchForm[p.worker_id]?.defective) || 0,
                target: batchForm[p.worker_id]?.target ? parseInt(batchForm[p.worker_id].target) : null
            }));

            const res = await fetch('/api/assignments/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, shift, assignments })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Batch rearrangement saved!', 'success');
                setShowBatchModal(false);
                setIsDragMode(false);
                setPendingMoves([]);
                loadAssignments();
            } else {
                showToast(result.error || 'Failed to save', 'error');
            }
        } catch (err) {
            showToast('Error saving batch', 'error');
        } finally {
            setAssigning(false);
        }
    }


    function showToast(msg, type) {
        const container = document.getElementById('toast-container') || document.body;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        Object.assign(toast.style, { position: 'fixed', bottom: '20px', right: '20px', padding: '12px 24px', borderRadius: '8px', background: type === 'success' ? '#10b981' : '#ef4444', color: 'white', zIndex: '9999', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' });
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    }

    // --- Swap flow helpers ---
    function handleSwapClick(worker, machineName) {
        // Step 1: select source
        setSwapSource({ ...worker, machineName });
        setSwapTarget(null);
        setIsDragMode(false);
        setSwapForm({ sourceTarget: '', sourceActuals: '', sourceDefective: '', targetTarget: '', targetActuals: '', targetDefective: '' });
    }

    
    function handleWorkerCardClick(worker, machineName, e) {
        if (isDragMode) {
            e?.stopPropagation();
            if (selectedWorkerForMove && selectedWorkerForMove.worker.worker_id === worker.worker_id) {
                setSelectedWorkerForMove(null);
            } else if (selectedWorkerForMove) {
                let targetMachine = null;
                localData.assignments.forEach(line => {
                    line.machines.forEach(m => {
                        if (m.workers.some(w => w.worker_id === worker.worker_id)) {
                            targetMachine = m;
                        }
                    });
                });
                if (targetMachine) {
                    handleDropOnMachine({ preventDefault: () => {}, dataTransfer: { getData: () => JSON.stringify(selectedWorkerForMove) } }, targetMachine);
                    setSelectedWorkerForMove(null);
                }
            } else {
                let sourceMachineId = null;
                localData.assignments.forEach(line => {
                    line.machines.forEach(m => {
                        if (m.workers.some(w => w.worker_id === worker.worker_id)) {
                            sourceMachineId = m.id;
                        }
                    });
                });
                setSelectedWorkerForMove({ worker, sourceMachineId });
            }
            return;
        }
        
        if (!swapSource) return; // Not in swap mode
        if (worker.worker_id === swapSource.worker_id) return; // Can't swap with self
        
        // Step 2: select target, open modal
        const targetW = { ...worker, machineName };
        setSwapTarget(targetW);

        // Pre-fill form with estimated targets
        const sourceInfo = getWorkingInfo(swapSource);
        const targetInfo = getWorkingInfo(targetW);
        
        setSwapForm({
            sourceTarget: sourceInfo.estTarget || '',
            sourceActuals: '',
            sourceDefective: '',
            targetTarget: targetInfo.estTarget || '',
            targetActuals: '',
            targetDefective: ''
        });
    }

    function cancelSwap() {
        setSwapSource(null);
        setSwapTarget(null);
        setSwapForm({ sourceTarget: '', sourceActuals: '', sourceDefective: '', targetTarget: '', targetActuals: '', targetDefective: '' });
    }

    async function handleSwapSubmit(e) {
        e.preventDefault();
        try {
            const res = await fetch('/api/assignments/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    worker1_id: swapSource.worker_id,
                    worker2_id: swapTarget.worker_id,
                    date, shift,
                    worker1_actuals: parseInt(swapForm.sourceActuals) || 0,
                    worker1_defective: parseInt(swapForm.sourceDefective) || 0,
                    worker1_target: swapForm.sourceTarget ? parseInt(swapForm.sourceTarget) : null,
                    worker2_actuals: parseInt(swapForm.targetActuals) || 0,
                    worker2_defective: parseInt(swapForm.targetDefective) || 0,
                    worker2_target: swapForm.targetTarget ? parseInt(swapForm.targetTarget) : null
                })
            });
            const result = await res.json();
            if (result.success) {
                showToast('Workers successfully swapped!', 'success');
                cancelSwap();
                loadAssignments();
            } else { showToast(result.error || 'Swap failed', 'error'); }
        } catch (err) { showToast('Failed to swap', 'error'); }
    }

    // Check if a worker card is the source
    const isSource = (wid) => swapSource && swapSource.worker_id === wid;
    const isSelectable = (wid) => swapSource && !swapTarget && swapSource.worker_id !== wid;

    function getWorkingInfo(w) {
        if (!w.assigned_at) return { time: null, estTarget: null };
        const assigned = new Date(w.assigned_at);
        const diffMs = now - assigned;
        if (diffMs < 0) return { time: null, estTarget: null };
        const hrs = diffMs / 3600000;
        const totalMins = Math.floor(diffMs / 60000);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const time = h > 0 ? `${h}h ${m}m` : `${m}m`;
        const estTarget = w.hourly_target ? Math.round(w.hourly_target * hrs) : null;
        return { time, estTarget };
    }

    // Combine assigned and unassigned machines to get ALL machines grouped by line for printing
    const lineMap = {};
    const displayData = isDragMode && localData ? localData : data;
    (displayData.assignments || []).forEach(line => {
        lineMap[line.line_id] = {
            line_id: line.line_id,
            line_name: line.line_name,
            machines: {}
        };
        line.machines.forEach(m => {
            lineMap[line.line_id].machines[m.id] = {
                ...m,
                workers: m.workers || []
            };
        });
    });

    (displayData.unassigned_machines || []).forEach(m => {
        const lineId = m.line_id;
        if (!lineMap[lineId]) {
            lineMap[lineId] = {
                line_id: lineId,
                line_name: m.line_name,
                machines: {}
            };
        }
        if (!lineMap[lineId].machines[m.id]) {
            lineMap[lineId].machines[m.id] = {
                id: m.id,
                machine_name: m.name,
                position: m.position,
                product_name: m.product_name,
                worker_capacity: m.worker_capacity || 1,
                workers: []
            };
        }
    });

    const allPrintLines = Object.values(lineMap)
        .map(line => ({
            ...line,
            machines: Object.values(line.machines).sort((a, b) => a.position - b.position)
        }))
        .sort((a, b) => a.line_name.localeCompare(b.line_name));

    return (
        <div className="container-fluid" style={{ padding: '24px' }}>
            <div id="toast-container"></div>
            <div className="page-header" style={{ marginBottom: '32px' }}>
                <div className="page-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>🔧 Machine Assignments</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Worker-to-machine allocation for production</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ background: 'var(--card-bg)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px', border: '1px solid var(--border-color)', height: '42px', alignItems: 'center' }}>
                            <button className={`btn btn-sm ${shift === 'day' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShift('day')} style={{ height: '32px', padding: '0 16px' }}>☀️ Day</button>
                            <button className={`btn btn-sm ${shift === 'night' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShift('night')} style={{ height: '32px', padding: '0 16px' }}>🌙 Night</button>
                        </div>
                        <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} style={{ height: '42px', width: '160px', borderRadius: '8px' }} />
                        
                        <button className={`btn ${isDragMode ? 'btn-warning' : 'btn-ghost'}`} onClick={() => {
                            const newMode = !isDragMode;
                            setIsDragMode(newMode);
                            if (newMode) cancelSwap();
                        }} style={{ height: '42px', padding: '0 16px', borderRadius: '8px', fontWeight: '600', border: '1px solid var(--border-color)' }}>
                            {isDragMode ? '❌ Cancel Drag Mode' : '✋ Rearrange (Drag & Drop)'}
                        </button>
                        {isDragMode && pendingMoves.length > 0 && (
                            <button className="btn btn-success sticky-mobile-save" onClick={openBatchModal} style={{ height: '42px', padding: '0 16px', borderRadius: '8px', fontWeight: '600' }}>
                                💾 Save Changes ({pendingMoves.length})
                            </button>
                        )}

                        <button className="btn btn-ghost" onClick={() => window.print()} style={{ height: '42px', padding: '0 16px', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                            🖨️ Print Sheet
                        </button>
                        <button className="btn btn-primary" onClick={checkAndRunAutoAssign} disabled={assigning} style={{ height: '42px', padding: '0 20px', borderRadius: '8px', fontWeight: '600' }}>
                            {assigning ? '⏳ Assigning...' : '⚡ Run Auto-Assignment'}
                        </button>
                    </div>
                </div>
            </div>
             {/* Custom Styles for Portrait Printing */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    /* Hide non-print UI elements */
                    header, .topbar, .sidebar, nav, .menu-toggle, .topbar-logo,
                    .page-header, .stats-grid, #toast-container, .modal-overlay,
                    button, .btn, input, select, .no-print {
                        display: none !important;
                    }
                    
                    /* Hide all main screen siblings when printing */
                    .container-fluid > *:not(.print-sheet-container) {
                        display: none !important;
                    }
                    
                    /* Reset body & layout for printing */
                    body, html, main, #__next, .container-fluid {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                    }

                    /* Configure page size to Portrait */
                    @page {
                        size: portrait;
                        margin: 10mm;
                    }

                    /* Print container setup */
                    .print-sheet-container {
                        display: block !important;
                        width: 100% !important;
                        color: #000000 !important;
                        background: #ffffff !important;
                    }

                    .print-line-section {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        margin-bottom: 32px !important;
                        padding-top: 10px !important;
                        padding-bottom: 20px !important;
                        border-bottom: 1px dashed #999999 !important;
                    }
                    .print-line-section:last-child {
                        border-bottom: none !important;
                        margin-bottom: 0 !important;
                    }

                    .print-header-row {
                        display: flex !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        border-bottom: 2px solid #000000 !important;
                        padding-bottom: 8px !important;
                        margin-bottom: 16px !important;
                    }

                    .print-grid {
                        display: grid !important;
                        grid-template-columns: repeat(6, 1fr) !important;
                        gap: 10px !important;
                    }

                    .print-card {
                        border: 1px solid #cccccc !important;
                        border-radius: 8px !important;
                        overflow: hidden !important;
                        background: #ffffff !important;
                        display: flex !important;
                        flex-direction: column !important;
                        page-break-inside: avoid !important;
                    }

                    .print-card-header {
                        background-color: #f8fafc !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                        padding: 6px 4px !important;
                        text-align: center !important;
                        font-weight: 800 !important;
                        font-size: 11px !important;
                        text-transform: uppercase !important;
                        color: #000000 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .print-card-body {
                        padding: 8px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 6px !important;
                    }

                    .print-worker-item {
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .print-worker-item:not(:first-child) {
                        border-top: 1px solid #e2e8f0 !important;
                        margin-top: 6px !important;
                        padding-top: 6px !important;
                    }

                    .print-worker-name {
                        font-weight: 600 !important;
                        font-size: 11px !important;
                        color: #000000 !important;
                    }

                    .print-worker-id {
                        font-size: 9px !important;
                        color: #666666 !important;
                        margin-top: 1px !important;
                    }
                }
                @media screen {
                    .print-sheet-container {
                        display: none;
                    }
                }
                @media screen and (max-width: 600px) {
                    .page-header-actions > div:last-child > button {
                        flex: 1 1 calc(50% - 6px);
                    }
                    .page-header-actions > div:last-child > button:last-child {
                        flex: 1 1 100%;
                    }
                    .stats-grid {
                        grid-template-columns: 1fr 1fr !important;
                    }
                    .stats-grid > .stat-card:last-child {
                        grid-column: 1 / -1;
                    }
                }
            `}} />

            {/* Print-Only Layout */}
            <div className="print-sheet-container">
                {allPrintLines.map(line => {
                    // Helper to format date to DD-MMM-YYYY (e.g. 04-Jun-2026)
                    const formatPrintDate = (dateStr) => {
                        if (!dateStr) return '';
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return dateStr;
                        const day = String(d.getDate()).padStart(2, '0');
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const month = months[d.getMonth()];
                        const year = d.getFullYear();
                        return `${day}-${month}-${year}`;
                    };

                    const totalAssigned = line.machines.reduce((sum, m) => sum + (m.workers?.length || 0), 0);
                    const totalCapacity = line.machines.reduce((sum, m) => sum + (m.worker_capacity || 1), 0);

                    return (
                        <div key={line.line_id} className="print-line-section">
                            <div className="print-header-row">
                                <h1 style={{ fontSize: '24px', margin: 0, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: '#000000' }}>
                                    🏭 {line.line_name.toUpperCase()}
                                    <span style={{ color: '#ef4444', marginLeft: '8px', fontWeight: '800' }}>
                                        ({totalAssigned}/{totalCapacity})
                                    </span>
                                </h1>
                                <div style={{ fontSize: '13px', textAlign: 'right', color: '#000000', lineHeight: '1.4' }}>
                                    <div><strong>Date:</strong> {formatPrintDate(date)}</div>
                                    <div><strong>Shift:</strong> {shift.toUpperCase()}</div>
                                </div>
                            </div>
                            <div className="print-grid">
                                {line.machines.map(m => (
                                    <div key={m.id} className="print-card">
                                        <div className="print-card-header">
                                            {m.machine_name}
                                        </div>
                                        <div className="print-card-body">
                                            {m.workers.length === 0 ? (
                                                <div style={{ fontSize: '10px', color: '#888888', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
                                                    Unassigned
                                                </div>
                                            ) : (
                                                m.workers.map((w, wIdx) => (
                                                    <div key={`${m.id}-${w.worker_id || wIdx}`} className="print-worker-item">
                                                        <span className="print-worker-name">{w.worker_name}</span>
                                                        <span className="print-worker-id">{w.employee_id}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Swap mode banner */}
            {swapSource && !swapTarget && (
                <div style={{ marginBottom: '20px', padding: '14px 20px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>🔄</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Swap Mode Active</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Click on another worker to swap with <strong>{swapSource.worker_name}</strong> ({swapSource.machineName})
                            </div>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={cancelSwap} style={{ borderColor: 'rgba(239,68,68,0.3)', color: 'var(--danger)' }}>✕ Cancel</button>
                </div>
            )}

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div className="stat-card" style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Assigned</div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--success)' }}>{data.summary.total_assigned || 0}</div>
                </div>
                <div className="stat-card" style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>On Bench</div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--warning)' }}>{data.summary.total_bench || 0}</div>
                </div>
                <div className="stat-card" style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Empty Machines</div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--danger)' }}>{data.summary.total_unassigned_machines || 0}</div>
                </div>
            </div>

            {allPrintLines.length > 0 ? (
                allPrintLines.map(line => {
                    const totalAssigned = line.machines.reduce((sum, m) => sum + (m.workers?.length || 0), 0);
                    const totalCapacity = line.machines.reduce((sum, m) => sum + (m.worker_capacity || 1), 0);

                    return (
                        <div key={line.line_id} style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                <h3 style={{ fontSize: '20px', fontWeight: '600' }}>
                                    🏭 {line.line_name}
                                    <span style={{ color: 'var(--danger)', marginLeft: '8px', fontWeight: '700' }}>
                                        ({totalAssigned}/{totalCapacity})
                                    </span>
                                </h3>
                                <span className="badge badge-info" style={{ borderRadius: '20px' }}>{line.machines.length} Machines</span>
                            </div>
                        <div className="machines-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {line.machines.map(m => (
                                <div key={m.id} className="machine-card" 
                                    onDoubleClick={() => {
                                        if (isDragMode && selectedWorkerForMove) {
                                            handleDropOnMachine({ preventDefault: () => {}, dataTransfer: { getData: () => JSON.stringify(selectedWorkerForMove) } }, m);
                                            setSelectedWorkerForMove(null);
                                        }
                                    }}
                                    onDragOver={(e) => isDragMode && e.preventDefault()}
                                    onDrop={(e) => handleDropOnMachine(e, m)}
                                    style={{ border: isDragMode ? '2px dashed rgba(255,255,255,0.2)' : '', background: 'var(--card-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <div style={{ fontWeight: '700', fontSize: '18px' }}>{m.machine_name}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{m.product_name || 'No Product'}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {m.workers.map(w => {
                                            const sourceHighlight = isSource(w.worker_id);
                                            const selectable = isSelectable(w.worker_id);
                                            const isTapSelected = isDragMode && selectedWorkerForMove?.worker?.worker_id === w.worker_id;
                                            const { time, estTarget } = getWorkingInfo(w);
                                            return (
                                                <div
                                                    key={w.assignment_id}
                                                    draggable={isDragMode}
                                                    onDragStart={(e) => handleDragStart(e, w, m)}
                                                    onClick={(e) => {
                                                        const now = Date.now();
                                                        const DOUBLE_CLICK_DELAY = 400; // 400ms for mobile tap
                                                        const isDoubleClick = lastTap.current.id === w.worker_id && (now - lastTap.current.time) < DOUBLE_CLICK_DELAY;
                                                        
                                                        if (isDoubleClick) {
                                                            lastTap.current = { time: 0, id: null };
                                                            if (isDragMode) { 
                                                                handleWorkerCardClick(w, m.machine_name, e); 
                                                            } else {
                                                                e.stopPropagation();
                                                                if (!swapSource) {
                                                                    handleSwapClick(w, m.machine_name);
                                                                } else if (selectable) {
                                                                    handleWorkerCardClick(w, m.machine_name, e);
                                                                }
                                                            }
                                                        } else {
                                                            lastTap.current = { time: now, id: w.worker_id };
                                                            // We removed the single-click selection for swapping to enforce double-tap
                                                        }
                                                    }}
                                                    className={isTapSelected ? 'tap-selected' : ''}
                                                    style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        background: isTapSelected ? 'rgba(99, 102, 241, 0.2)' : sourceHighlight ? 'rgba(99, 102, 241, 0.2)' : selectable ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.03)',
                                                        padding: '10px', borderRadius: '8px',
                                                        border: isTapSelected ? '2px solid var(--accent)' : sourceHighlight ? '2px solid var(--accent)' : selectable ? '1px dashed rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                                                        cursor: selectable ? 'pointer' : 'default',
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '16px' }}>
                                                            {sourceHighlight && <span style={{ marginRight: '6px' }}>🔄</span>}
                                                            {w.worker_name}
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.3px' }}>{w.employee_id}</div>
                                                        {(time || estTarget) && (
                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                                {time && (
                                                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent)', fontWeight: 600 }}>
                                                                        ⏱ {time}
                                                                    </span>
                                                                )}
                                                                {estTarget !== null && (
                                                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', fontWeight: 600 }}>
                                                                        🎯 Est: {estTarget}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {w.efficiency_score && (
                                                            <span className={`badge ${getEfficiencyClass(w.efficiency_score)}`} style={{ fontSize: '10px' }}>
                                                                {parseFloat(w.efficiency_score).toFixed(0)}%
                                                            </span>
                                                        )}
                                                        {!swapSource ? (
                                                            <button
                                                                className="btn btn-ghost"
                                                                style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600' }}
                                                                onClick={(e) => { e.stopPropagation(); handleSwapClick(w, m.machine_name); }}
                                                            >🔄 Swap</button>
                                                        ) : selectable ? (
                                                            <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 700 }}>← Select</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {Array.from({ length: Math.max(0, (m.worker_capacity || 1) - m.workers.length) }).map((_, idx) => (
                                            <button
                                                key={`empty-${m.id}-${idx}`}
                                                className="btn btn-ghost"
                                                style={{ border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '16px', fontSize: '15px', fontWeight: '600', width: '100%', minHeight: '60px' }}
                                                onClick={(e) => { 
                                                    const now = Date.now();
                                                    const DOUBLE_CLICK_DELAY = 400;
                                                    const isDoubleClick = lastTap.current.id === `empty-${m.id}-${idx}` && (now - lastTap.current.time) < DOUBLE_CLICK_DELAY;
                                                    
                                                    if (isDoubleClick) {
                                                        lastTap.current = { time: 0, id: null };
                                                        if (isDragMode && selectedWorkerForMove) {
                                                            e.stopPropagation();
                                                            handleDropOnMachine({ preventDefault: () => {}, dataTransfer: { getData: () => JSON.stringify(selectedWorkerForMove) } }, m);
                                                            setSelectedWorkerForMove(null);
                                                        }
                                                    } else {
                                                        lastTap.current = { time: now, id: `empty-${m.id}-${idx}` };
                                                        if (!isDragMode) {
                                                            setManualMachine(m); setShowManualModal(true); setManualWorkerId(''); setManualSearch(''); setIsDropdownOpen(false); 
                                                        }
                                                    }
                                                }}
                                            >+ Assign Worker</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    );
                })
            ) : (
                <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--card-bg)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔧</div>
                    <h3 style={{ fontSize: '20px', fontWeight: '600' }}>No assignments found</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Mark attendance first, then click "Run Auto-Assignment" to allocate workers.</p>
                </div>
            )}

            
            {/* Batch Save Modal */}
            {showBatchModal && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal" style={{ background: 'var(--card-bg)', width: '600px', maxWidth: '95vw', borderRadius: '16px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '20px' }}>💾 Confirm Rearrangement</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '13px' }}>
                            Please enter the production logged so far for the workers being moved.
                        </p>
                        <form onSubmit={handleBatchSubmit}>
                            {pendingMoves.map(p => (
                                <div key={p.worker_id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{p.worker_name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--success)', marginBottom: '12px' }}>Moving to: {p.new_machine_name}</div>
                                    <div className="batch-inputs" style={{ display: 'flex', gap: '8px' }}>
                                        <input type="number" placeholder="Target Units" className="form-input" value={batchForm[p.worker_id]?.target || ''} onChange={e => setBatchForm({...batchForm, [p.worker_id]: {...batchForm[p.worker_id], target: e.target.value}})} style={{ width: '33%', height: '36px' }} />
                                        <input type="number" placeholder="Actual Units" className="form-input" value={batchForm[p.worker_id]?.actuals || ''} onChange={e => setBatchForm({...batchForm, [p.worker_id]: {...batchForm[p.worker_id], actuals: e.target.value}})} style={{ width: '33%', height: '36px' }} />
                                        <input type="number" placeholder="Defective" className="form-input" value={batchForm[p.worker_id]?.defective || ''} onChange={e => setBatchForm({...batchForm, [p.worker_id]: {...batchForm[p.worker_id], defective: e.target.value}})} style={{ width: '33%', height: '36px' }} />
                                    </div>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowBatchModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-success" disabled={assigning}>{assigning ? 'Saving...' : 'Confirm & Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* Worker Bench */}
            {data.bench && data.bench.length > 0 && (
                <div style={{ marginTop: '32px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: '600' }}>🪑 Worker Bench</h3>
                            <span className="badge badge-warning" style={{ borderRadius: '20px' }}>{data.bench.length} Unallocated</span>
                        </div>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Search workers..."
                            value={benchSearch}
                            onChange={e => setBenchSearch(e.target.value)}
                            style={{ width: '220px', height: '38px', borderRadius: '8px', fontSize: '13px' }}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {data.bench
                            .filter(w => {
                                if (!benchSearch) return true;
                                const q = benchSearch.toLowerCase();
                                return w.name.toLowerCase().includes(q) || w.employee_id.toLowerCase().includes(q);
                            })
                            .map(w => (
                                <div key={w.id} style={{
                                    background: 'var(--card-bg)', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '14px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s ease'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{w.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.3px' }}>{w.employee_id}</div>
                                    </div>
                                    {w.efficiency_score && (
                                        <span className={`badge ${getEfficiencyClass(w.efficiency_score)}`} style={{ fontSize: '10px' }}>
                                            {parseFloat(w.efficiency_score).toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            ))
                        }
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
                        💡 Click <strong>+ Assign Worker</strong> on any machine card above to allocate a bench worker.
                    </p>
                </div>
            )}

            {/* Manual Assign Modal */}
            {showManualModal && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal" style={{ background: 'var(--card-bg)', width: '450px', borderRadius: '16px', padding: '24px', overflow: 'visible' }}>
                        <h3 style={{ marginBottom: '20px' }}>Assign to {manualMachine?.machine_name}</h3>
                        <form onSubmit={handleManualAssign}>
                            <div className="form-group" style={{ marginBottom: '24px', position: 'relative' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Select Worker from Bench</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Type name or employee ID..."
                                        value={manualSearch}
                                        onChange={e => {
                                            setManualSearch(e.target.value);
                                            setManualWorkerId(''); // Reset selection when user types
                                            setIsDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                        required
                                        style={{ width: '100%', height: '42px', borderRadius: '8px' }}
                                    />
                                    {isDropdownOpen && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-active)',
                                            borderRadius: '8px',
                                            zIndex: 1100,
                                            boxShadow: 'var(--shadow-lg)',
                                            marginTop: '4px',
                                            backdropFilter: 'blur(20px)'
                                        }}>
                                            {data.bench
                                                .filter(w => {
                                                    const q = manualSearch.toLowerCase();
                                                    return w.employee_id.toLowerCase().includes(q);
                                                })
                                                .map(w => (
                                                    <div
                                                        key={w.id}
                                                        onClick={() => {
                                                            setManualWorkerId(w.id);
                                                            setManualSearch(`${w.name} (${w.employee_id})`);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        style={{
                                                            padding: '10px 14px',
                                                            cursor: 'pointer',
                                                            borderBottom: '1px solid var(--border-color)',
                                                            fontSize: '13px',
                                                            textAlign: 'left',
                                                            color: 'var(--text-primary)',
                                                            transition: 'background 0.2s ease'
                                                        }}
                                                    >
                                                        <strong>{w.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({w.employee_id})</span>
                                                    </div>
                                                ))}
                                            {data.bench.filter(w => {
                                                const q = manualSearch.toLowerCase();
                                                return w.employee_id.toLowerCase().includes(q);
                                            }).length === 0 && (
                                                <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                    No matching workers found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <input type="hidden" name="worker_id" value={manualWorkerId} required />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { setShowManualModal(false); setManualSearch(''); setManualWorkerId(''); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={!manualWorkerId}>Confirm Assignment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Swap Confirmation Modal — side-by-side cards */}
            {swapSource && swapTarget && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal" style={{ background: 'var(--card-bg)', width: '720px', maxWidth: '95vw', borderRadius: '16px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>🔄 Confirm Swap</h3>
                            <button className="modal-close" onClick={cancelSwap} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <form onSubmit={handleSwapSubmit}>
                            {/* Side-by-side worker cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'start', marginBottom: '24px' }}>
                                {/* Source worker card */}
                                <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, marginBottom: '12px', letterSpacing: '0.5px' }}>From</div>
                                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{swapSource.worker_name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{swapSource.employee_id}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>📍 {swapSource.machineName}</div>

                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Production So Far</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input type="number" placeholder="Target Units" className="form-input" value={swapForm.sourceTarget} onChange={e => setSwapForm({ ...swapForm, sourceTarget: e.target.value })} style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }} />
                                        <input type="number" placeholder="Actual Units" className="form-input" value={swapForm.sourceActuals} onChange={e => setSwapForm({ ...swapForm, sourceActuals: e.target.value })} style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }} />
                                        <input type="number" placeholder="Defective" className="form-input" value={swapForm.sourceDefective} onChange={e => setSwapForm({ ...swapForm, sourceDefective: e.target.value })} style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }} />
                                    </div>
                                </div>

                                {/* Arrow */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', paddingTop: '60px' }}>⇄</div>

                                {/* Target worker card */}
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--success)', fontWeight: 700, marginBottom: '12px', letterSpacing: '0.5px' }}>To</div>
                                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{swapTarget.worker_name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{swapTarget.employee_id}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>📍 {swapTarget.machineName}</div>

                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Production So Far</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input type="number" placeholder="Target Units" className="form-input" value={swapForm.targetTarget} onChange={e => setSwapForm({ ...swapForm, targetTarget: e.target.value })} style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }} />
                                        <input type="number" placeholder="Actual Units" className="form-input" value={swapForm.targetActuals} onChange={e => setSwapForm({ ...swapForm, targetActuals: e.target.value })} style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }} />
                                        <input type="number" placeholder="Defective" className="form-input" value={swapForm.targetDefective} onChange={e => setSwapForm({ ...swapForm, targetDefective: e.target.value })} style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                <button type="button" className="btn btn-ghost" onClick={cancelSwap}>Cancel</button>
                                <button type="submit" className="btn btn-primary">✅ Confirm Swap</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function AttendancePage() {
    const [data, setData] = useState({ workers: [], summary: {} });
    const [loading, setLoading] = useState(true);
    // Use local date (not UTC) — toISOString() returns UTC which can be yesterday in IST near midnight
        const [date, setDate] = useState(() => {
        const n = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        if (n.getHours() < 7 || (n.getHours() === 7 && n.getMinutes() < 30)) {
            n.setDate(n.getDate() - 1);
        }
        const y = n.getFullYear();
        const m = String(n.getMonth() + 1).padStart(2, '0');
        const d = String(n.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    const [shift, setShift] = useState(() => {
        const hour = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
        return ((hour > 7 || (hour === 7 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() >= 30)) && (hour < 19 || (hour === 19 && new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getMinutes() < 30))) ? 'day' : 'night';
    });
    const [markingAll, setMarkingAll] = useState(false);
    const [importStatus, setImportStatus] = useState({ active: false, current: 0, total: 0, success: 0, error: 0 });
    const [failedLogs, setFailedLogs] = useState([]);
    
    // Missing workers interactive import
    const [missingWorkers, setMissingWorkers] = useState([]);
    const [showMissingModal, setShowMissingModal] = useState(false);
    const [pendingUploadData, setPendingUploadData] = useState(null);
    const [creatingWorkers, setCreatingWorkers] = useState(false);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [usePageDate, setUsePageDate] = useState(true);

    useEffect(() => { loadAttendance(); }, [date, shift]);

    async function loadAttendance() {
        setLoading(true);
        try {
            const res = await fetch(`/api/attendance?date=${date}&shift=${shift}`);
            const result = await res.json();
            if (result.success) setData(result.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    async function markAttendance(workerId, status) {
        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ worker_id: workerId, status, date, shift }),
            });
            const result = await res.json();
            if (result.success) {
                loadAttendance();
            } else {
                showToast(result.error || 'Failed to mark attendance', 'error');
            }
        } catch (err) {
            showToast('Failed to mark attendance: Connection error', 'error');
        }
    }

    async function markAllPresent() {
        setMarkingAll(true);
        try {
            const unmarked = data.workers.filter(w => !w.status);
            if (unmarked.length === 0) {
                showToast('No unmarked workers found', 'info');
                return;
            }

            const records = unmarked.map(w => ({
                worker_id: w.id,
                status: 'present',
                date,
                shift
            }));

            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records }),
            });
            const result = await res.json();
            if (result.success) {
                loadAttendance();
                showToast(`Marked ${unmarked.length} workers as present`, 'success');
            } else {
                throw new Error(result.error || 'Failed to mark all');
            }
        } catch (err) {
            showToast(err.message || 'Failed to mark all', 'error');
        } finally {
            setMarkingAll(false);
        }
    }

    async function clearDayAttendance() {
        if (!confirm(`Clear all attendance records for ${date}? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/attendance?date=${date}&shift=${shift}`, {
                method: 'DELETE',
            });
            const result = await res.json();
            if (result.success) {
                loadAttendance();
                showToast(`Cleared attendance for ${date}`, 'success');
            } else {
                showToast(result.error || 'Failed to clear attendance', 'error');
            }
        } catch (err) {
            showToast('Failed to clear attendance: ' + err.message, 'error');
        }
    }

    function showToast(msg, type) {
        const container = document.getElementById('toast-container') || document.body;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.background = type === 'success' ? '#10b981' : '#ef4444';
        toast.style.color = 'white';
        toast.style.zIndex = '9999';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    const handleAttendanceUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        const extension = file.name.split('.').pop().toLowerCase();

        if (['xlsx', 'xls'].includes(extension)) {
            reader.onload = (evt) => {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
                processAttendanceData(data);
            };
            reader.readAsBinaryString(file);
        } else {
            showToast('Please upload an Excel file.', 'error');
        }
        e.target.value = '';
    };

    const parseRawSheet = (data) => {
        if (!data || data.length < 2) {
            showToast('No data found in file.', 'error');
            return null;
        }

        // 1. Find Header Row and Indices
        let headerRowIndex = -1;
        let indices = { id: -1, date: -1, time: -1, status: -1, skill: -1, name: -1 };

        const headerKeywords = {
            id: ['User ID', 'user id', 'IDNo', 'employee_id', 'token no', 'Worker_id', 'Contractor Token No'],
            name: ['Name', 'name', 'Labour Name', 'Worker Name', 'labour_name'],
            date: ['Date', 'date', 'Punch Time', 'punch time'],
            time: ['Punch Time', 'punch time', 'In Time', 'in_time', 'time'],
            status: ['I/O Type', 'i/o type', 'Status', 'status'],
            skill: ['Work Skill', 'work skill', 'Workskill', 'skill', 'rating']
        };

        for (let i = 0; i < Math.min(data.length, 5); i++) {
            const row = data[i].map(c => String(c || '').trim().toLowerCase());
            let foundCount = 0;
            
            for (const key in headerKeywords) {
                const idx = row.findIndex(cell => 
                    cell && headerKeywords[key].some(kw => cell === kw.toLowerCase() || cell.includes(kw.toLowerCase()))
                );
                if (idx !== -1) {
                    indices[key] = idx;
                    foundCount++;
                }
            }

            if (foundCount >= 3) { // Found most headers, this is likely our header row
                headerRowIndex = i;
                break;
            }
        }

        // If no header row found, fallback to original indices (for backward compatibility)
        if (headerRowIndex === -1) {
            console.log('No header row detected, using legacy mapping');
            indices = { id: 6, date: 12, time: 13, status: 18, skill: 9, name: 7 };
            headerRowIndex = 0; 
        }

        const rows = data.slice(headerRowIndex + 1).filter(r => r && r[indices.id]);
        if (rows.length === 0) {
            showToast('No valid attendance records found in file.', 'error');
            return null;
        }

        const skillMap = { '1': 'beginner', '2': 'intermediate', '3': 'advanced', '4': 'expert' };
        const statusMap = {
            'IN': 'present', 'OUT': 'present',
            'P': 'present', 'A': 'absent', 'L': 'late',
            'PRESENT': 'present', 'ABSENT': 'absent', 'LATE': 'late',
            'SP': 'present', 'SPECIAL PRESENT': 'present'
        };

        const parseTime = (t) => {
            if (!t) return null;
            if (typeof t === 'string') {
                const timeMatch = t.match(/(\d{1,2}):(\d{2}):(\d{2})/);
                if (timeMatch) return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:${timeMatch[3]}`;
                const ampmMatch = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (ampmMatch) {
                    let [_, h, m, meridiem] = ampmMatch;
                    h = parseInt(h);
                    if (meridiem.toUpperCase() === 'PM' && h < 12) h += 12;
                    if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
                    return `${String(h).padStart(2, '0')}:${m}:00`;
                }
                return null;
            }
            if (typeof t === 'number') {
                const timePortion = t % 1;
                const totalSeconds = Math.floor(timePortion * 24 * 3600);
                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = totalSeconds % 60;
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
            return null;
        };

        const parseDateString = (d) => {
            if (!d) return null;
            if (usePageDate) return date;
            if (typeof d === 'string') {
                const dateMatch = d.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
                if (dateMatch) return `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
                if (d.includes('/')) {
                    const parts = d.split('/');
                    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
                return d;
            }
            if (typeof d === 'number') {
                return new Date((d - 25569) * 86400 * 1000).toISOString().split('T')[0];
            }
            return d;
        };

        return { rows, indices, parseTime, parseDateString, skillMap, statusMap, headerRowIndex };
    };

    const uploadAttendanceRecords = async (records) => {
        setImportStatus({ active: true, current: 0, total: records.length, success: 0, error: 0 });
        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records }),
            });
            const result = await res.json();
            
            if (result.success) {
                const successMatch = (result.message || '').match(/(\d+) successful/);
                const errors = result.failedEntries || [];
                setFailedLogs(errors);
                                
                setImportStatus(prev => ({ 
                    ...prev, 
                    current: records.length, 
                    success: successMatch ? parseInt(successMatch[1]) : records.length, 
                    error: errors.length,
                    total: records.length 
                }));

                if (errors.length > 0) {
                    showToast(`Uploaded with ${errors.length} failed entries.`, 'warning');
                } else {
                    showToast('Attendance uploaded successfully.', 'success');
                    setTimeout(() => setImportStatus({ active: false, current: 0, total: 0, success: 0, error: 0 }), 2500);
                }
            } else {
                setImportStatus(prev => ({ ...prev, error: records.length }));
                showToast(result.error || 'Bulk upload failed', 'error');
            }
        } catch (err) { 
            showToast('Connection error during upload', 'error'); 
        } finally {
            loadAttendance();
        }
    };

    const handleApproveMissing = async () => {
        setCreatingWorkers(true);
        try {
            const approved = missingWorkers.filter(w => w.approved);
            
            if (approved.length > 0) {
                const promises = approved.map(w => 
                    fetch('/api/workers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: w.name,
                            employee_id: w.employee_id,
                            rating: parseInt(w.rating) || 2
                        })
                    })
                );
                
                await Promise.all(promises);
                showToast(`Successfully created ${approved.length} missing workers!`, 'success');
            }
            
            setShowMissingModal(false);
            
            const res = await fetch(`/api/attendance?date=${date}&shift=${shift}`);
            const result = await res.json();
            let freshWorkers = [];
            if (result.success && result.data) {
                setData(result.data);
                freshWorkers = result.data.workers || [];
            }
            
            if (pendingUploadData) {
                const approvedEmpIds = new Set(approved.map(w => String(w.employee_id || '').toUpperCase().trim()).filter(Boolean));
                const allEmpIdsInDB = new Set([
                    ...freshWorkers.map(w => String(w.employee_id || '').toUpperCase().trim()).filter(Boolean),
                    ...approved.map(w => String(w.employee_id || '').toUpperCase().trim()).filter(Boolean)
                ]);
                
                const filteredRecords = pendingUploadData.filter(rec => {
                    const cleanId = String(rec.employee_id || '').toUpperCase().trim();
                    return allEmpIdsInDB.has(cleanId) || approvedEmpIds.has(cleanId);
                });
                
                await uploadAttendanceRecords(filteredRecords);
            }
        } catch (err) {
            showToast('Failed to create missing workers: ' + err.message, 'error');
        } finally {
            setCreatingWorkers(false);
            setPendingUploadData(null);
            setMissingWorkers([]);
        }
    };

    const processAttendanceData = async (sheetData) => {
        const parsed = parseRawSheet(sheetData);
        if (!parsed) return;
        const { rows, indices, parseTime, parseDateString, skillMap, statusMap, headerRowIndex } = parsed;

        const allRecords = rows.map((row, idx) => ({
            row_index: headerRowIndex + 2 + idx,
            employee_id: String(row[indices.id] || '').trim(),
            worker_name: indices.name !== -1 && row[indices.name] ? String(row[indices.name]).trim() : "",
            date: parseDateString(row[indices.date]),
            in_time: parseTime(row[indices.time]),
            status: statusMap[String(row[indices.status] || 'P').toUpperCase().trim()] || 'present',
            skill_level: skillMap[String(row[indices.skill] || '').trim()] || null,
            shift: shift
        }));

        const currentIds = new Set(
            data && data.workers 
                ? data.workers.map(w => String(w.employee_id || '').toUpperCase().trim()).filter(Boolean) 
                : []
        );
        const missing = [];
        const seenMissing = new Set();
        
        allRecords.forEach(rec => {
            const eid = String(rec.employee_id || '').toUpperCase().trim();
            if (eid && !currentIds.has(eid) && !seenMissing.has(eid)) {
                missing.push({ employee_id: rec.employee_id, name: rec.worker_name, approved: true, rating: 2 });
                seenMissing.add(eid);
            }
        });

        if (missing.length > 0) {
            setMissingWorkers(missing);
            setPendingUploadData(allRecords);
            setShowMissingModal(true);
        } else {
            await uploadAttendanceRecords(allRecords);
        }
    };


    if (importStatus.active) {
        const percent = Math.round((importStatus.current / importStatus.total) * 100);
        const isFinished = importStatus.current === importStatus.total;
        
        return (
            <div className="loading-overlay">
                <div className="card" style={{ width: '480px', textAlign: 'center', padding: '32px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {!isFinished && <div className="loader" style={{ margin: '0 auto 24px' }}></div>}
                    <h3 style={{ marginBottom: '8px' }}>
                        {isFinished ? (importStatus.error > 0 ? '⚠️ Import Complete with Errors' : '✅ Import Successful!') : 'Updating Attendance...'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Processed {importStatus.current} of {importStatus.total} records
                    </p>
                    
                    <div style={{ background: 'var(--border-color)', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
                        <div style={{ background: importStatus.error > 0 ? 'var(--danger, #ef4444)' : 'var(--success, #10b981)', width: `${percent}%`, height: '100%', transition: 'width 0.3s ease' }}></div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--success, #10b981)', fontSize: '20px', fontWeight: 'bold' }}>{importStatus.success}</div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--success, #10b981)' }}>Success</div>
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--danger, #ef4444)', fontSize: '20px', fontWeight: 'bold' }}>{importStatus.error}</div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--danger, #ef4444)' }}>Failed</div>
                        </div>
                    </div>

                    {/* FAILED LOGS REPORT */}
                    {isFinished && failedLogs.length > 0 && (
                        <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Error Report ({failedLogs.length} entries)
                            </div>
                            <div style={{ 
                                maxHeight: '180px', 
                                overflowY: 'auto', 
                                background: 'rgba(0,0,0,0.2)', 
                                border: '1px solid var(--border-color, #333)', 
                                borderRadius: '6px', 
                                padding: '10px' 
                            }}>
                                {failedLogs.map((log, i) => (
                                    <div key={i} style={{ 
                                        fontSize: '12px', 
                                        padding: '6px 0', 
                                        borderBottom: i < failedLogs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                        color: '#f87171' 
                                    }}>
                                        <strong>Row {log.row}</strong> (ID: {log.employee_id}): {log.reason}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {isFinished && (
                        <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', height: '42px' }}
                            onClick={() => setImportStatus({ active: false, current: 0, total: 0, success: 0, error: 0 })}
                        >
                            Close Report
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="loading-overlay"><div className="loader"></div><p>Loading attendance...</p></div>;
    }

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h2>📋 Attendance</h2>
                        <p>Mark daily attendance for workers</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <div className="search-box" style={{ width: '200px' }}>
                            <span className="search-icon">🔍</span>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Search name/ID..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="form-select" 
                            style={{ width: '130px', height: '42px' }}
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="absent">Absent</option>
                            <option value="unmarked">Unmarked</option>
                        </select>
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
                            id="attendance-date"
                            name="attendance_date"
                            type="date"
                            className="form-input"
                            style={{ width: '150px', height: '42px' }}
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                        <input 
                            type="file" 
                            id="page-attendance-upload" 
                            style={{ display: 'none' }} 
                            onChange={handleAttendanceUpload} 
                            accept=".xlsx, .xls"
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <button className="btn btn-ghost" onClick={() => document.getElementById('page-attendance-upload').click()} style={{ height: '42px', whiteSpace: 'nowrap' }}>
                                🕒 Upload ManHour
                            </button>
                            <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <input type="checkbox" checked={usePageDate} onChange={e => setUsePageDate(e.target.checked)} /> Use selected date
                            </label>
                        </div>
                        <button className="btn btn-success" onClick={markAllPresent} disabled={markingAll} style={{ height: '42px', whiteSpace: 'nowrap' }}>
                            {markingAll ? '⏳' : '✅ Attendance'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-value">{data?.summary?.total || 0}</div>
                    <div className="stat-label">Total Workers</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{data?.summary?.present || 0}</div>
                    <div className="stat-label">Present</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{data?.summary?.late || 0}</div>
                    <div className="stat-label">Late</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{data?.summary?.absent || 0}</div>
                    <div className="stat-label">Absent</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{data?.summary?.unmarked || 0}</div>
                    <div className="stat-label">Unmarked</div>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    <table className="mobile-stack-table">
                        <thead>
                            <tr>
                                <th>Employee ID</th>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Check-in Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.workers
                .filter(w => {
                    const empId = (w.employee_id || '').toLowerCase();
                    const name = (w.name || '').toLowerCase();
                    const search = searchTerm.toLowerCase();
                    const matchesSearch = !searchTerm ||
                        name.includes(search) ||
                        empId.includes(search);
                    const matchesStatus = statusFilter === 'all' ||
                        (statusFilter === 'unmarked' ? !w.status : w.status === statusFilter);
                    return matchesSearch && matchesStatus;
                })
                                .map(w => (
                                <tr key={w.id}>
                                    <td data-label="ID" style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{w.employee_id}</td>
                                    <td data-label="Worker" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</td>
                                    <td data-label="Status">
                                        {w.status ? (
                                            <span className={`badge ${w.status === 'present' ? 'badge-success' : w.status === 'late' ? 'badge-warning' : w.status === 'absent' ? 'badge-danger' : 'badge-neutral'}`}>
                                                {w.status}
                                            </span>
                                        ) : (
                                            <span className="badge badge-neutral">unmarked</span>
                                        )}
                                    </td>
                                    <td data-label="Time" style={{ color: 'var(--text-muted)' }}>{w.check_in_time || '—'}</td>
                                    <td data-label="Mark">
                                        <div className="attendance-status" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                            <button
                                                className={`attendance-btn ${w.status === 'present' ? 'active-present' : ''}`}
                                                onClick={() => markAttendance(w.id, 'present')}
                                            >✅</button>
                                            <button
                                                className={`attendance-btn ${w.status === 'late' ? 'active-late' : ''}`}
                                                onClick={() => markAttendance(w.id, 'late')}
                                            >⏰</button>
                                            <button
                                                className={`attendance-btn ${w.status === 'absent' ? 'active-absent' : ''}`}
                                                onClick={() => markAttendance(w.id, 'absent')}
                                            >❌</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showMissingModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal" style={{ width: '650px', maxWidth: '90vw' }}>
                        <div className="modal-header">
                            <h3>🔍 Missing Workers Found in Upload</h3>
                            <button className="modal-close" onClick={() => {
                                setShowMissingModal(false);
                                setMissingWorkers([]);
                                setPendingUploadData(null);
                            }}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                The following employee IDs were found in the uploaded file but do **not** exist in your database. 
                                Please review their details, choose whether to import them, and edit their names/ratings as needed.
                            </p>
                            
                            <div className="table-wrapper">
                                <table className="mobile-stack-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}>Import</th>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Skill Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {missingWorkers.map((w, idx) => (
                                            <tr key={idx}>
                                                <td data-label="Import" style={{ textAlign: 'center' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={w.approved} 
                                                        onChange={e => {
                                                            const list = [...missingWorkers];
                                                            list[idx].approved = e.target.checked;
                                                            setMissingWorkers(list);
                                                        }}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    />
                                                </td>
                                                <td data-label="ID" style={{ fontWeight: 600, color: 'var(--accent-light, #60a5fa)' }}>
                                                    {w.employee_id}
                                                </td>
                                                <td data-label="Name">
                                                    <input 
                                                        type="text" 
                                                        className="form-input" 
                                                        value={w.name}
                                                        disabled={!w.approved}
                                                        onChange={e => {
                                                            const list = [...missingWorkers];
                                                            list[idx].name = e.target.value;
                                                            setMissingWorkers(list);
                                                        }}
                                                        style={{ height: '36px', fontSize: '13px', padding: '0 8px' }}
                                                    />
                                                </td>
                                                <td data-label="Rating">
                                                    <select 
                                                        className="form-select"
                                                        value={w.rating}
                                                        disabled={!w.approved}
                                                        onChange={e => {
                                                            const list = [...missingWorkers];
                                                            list[idx].rating = e.target.value;
                                                            setMissingWorkers(list);
                                                        }}
                                                        style={{ height: '36px', fontSize: '13px', padding: '0 8px' }}
                                                    >
                                                        <option value={1}>Beginner (1)</option>
                                                        <option value={2}>Intermediate (2)</option>
                                                        <option value={3}>Advanced (3)</option>
                                                        <option value={4}>Expert (4)</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => {
                                    setShowMissingModal(false);
                                    setMissingWorkers([]);
                                    setPendingUploadData(null);
                                }}
                                disabled={creatingWorkers}
                            >
                                Cancel Upload
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleApproveMissing}
                                disabled={creatingWorkers}
                            >
                                {creatingWorkers ? '⏳ Registering...' : 'Approve & Create Workers'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

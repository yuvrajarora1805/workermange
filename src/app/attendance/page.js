'use client';

import { useState, useEffect } from 'react';

export default function AttendancePage() {
    const [data, setData] = useState({ workers: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [shift, setShift] = useState(() => {
        const hour = new Date().getHours();
        return (hour >= 7 && hour < 19) ? 'day' : 'night';
    });
    const [markingAll, setMarkingAll] = useState(false);

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
            for (const w of unmarked) {
                const res = await fetch('/api/attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ worker_id: w.id, status: 'present', date, shift }),
                });
                const result = await res.json();
                if (!result.success) {
                    throw new Error(result.error || 'Failed at worker ' + w.name);
                }
            }
            loadAttendance();
            showToast(`Marked ${unmarked.length} workers as present`, 'success');
        } catch (err) {
            showToast(err.message || 'Failed to mark all', 'error');
        } finally {
            setMarkingAll(false);
        }
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
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap' }}>
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
                            style={{ width: '160px', height: '42px', flexShrink: 0 }}
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                        <button className="btn btn-success" onClick={markAllPresent} disabled={markingAll} style={{ height: '42px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {markingAll ? '⏳ Marking...' : '✅ Mark All Present'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-value">{data.summary.total || 0}</div>
                    <div className="stat-label">Total Workers</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{data.summary.present || 0}</div>
                    <div className="stat-label">Present</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{data.summary.late || 0}</div>
                    <div className="stat-label">Late</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{data.summary.absent || 0}</div>
                    <div className="stat-label">Absent</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{data.summary.unmarked || 0}</div>
                    <div className="stat-label">Unmarked</div>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    <table>
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
                            {data.workers.map(w => (
                                <tr key={w.id}>
                                    <td style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{w.employee_id}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</td>
                                    <td>
                                        {w.status ? (
                                            <span className={`badge ${w.status === 'present' ? 'badge-success' : w.status === 'late' ? 'badge-warning' : 'badge-danger'}`}>
                                                {w.status}
                                            </span>
                                        ) : (
                                            <span className="badge badge-neutral">unmarked</span>
                                        )}
                                    </td>
                                    <td style={{ color: 'var(--text-muted)' }}>{w.check_in_time || '—'}</td>
                                    <td>
                                        <div className="attendance-status">
                                            <button
                                                className={`attendance-btn ${w.status === 'present' ? 'active-present' : ''}`}
                                                onClick={() => markAttendance(w.id, 'present')}
                                            >✅ Present</button>
                                            <button
                                                className={`attendance-btn ${w.status === 'late' ? 'active-late' : ''}`}
                                                onClick={() => markAttendance(w.id, 'late')}
                                            >⏰ Late</button>
                                            <button
                                                className={`attendance-btn ${w.status === 'absent' ? 'active-absent' : ''}`}
                                                onClick={() => markAttendance(w.id, 'absent')}
                                            >❌ Absent</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function WorkersPage() {
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editWorker, setEditWorker] = useState(null);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ name: '', phone: '', employee_id: '', skill_level: 'intermediate', gender: '' });
    const fileInputRef = useRef(null);

    useEffect(() => { loadWorkers(); }, []);

    async function loadWorkers() {
        try {
            const res = await fetch(`/api/workers${search ? `?search=${search}` : ''}`);
            const data = await res.json();
            if (data.success) setWorkers(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const method = editWorker ? 'PUT' : 'POST';
            const body = editWorker ? { ...form, id: editWorker.id } : form;
            const res = await fetch('/api/workers', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setShowModal(false);
                setEditWorker(null);
                setForm({ name: '', phone: '', employee_id: '', skill_level: 'intermediate', gender: '' });
                loadWorkers();
                showToast(editWorker ? 'Worker updated!' : 'Worker added!', 'success');
            } else {
                showToast(data.error, 'error');
            }
        } catch (err) {
            showToast('Failed to save worker', 'error');
        }
    }

    async function deleteWorker(id, name) {
        if (!confirm(`Delete worker "${name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/workers?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadWorkers();
                showToast('Worker deleted', 'success');
            }
        } catch (err) {
            showToast('Failed to delete', 'error');
        }
    }

    function openEdit(worker) {
        setEditWorker(worker);
        setForm({
            name: worker.name,
            phone: worker.phone || '',
            employee_id: worker.employee_id,
            skill_level: worker.skill_level,
            gender: worker.gender || '',
        });
        setShowModal(true);
    }

    function openAdd() {
        setEditWorker(null);
        setForm({ name: '', phone: '', employee_id: '', skill_level: 'intermediate', gender: '' });
        setShowModal(true);
    }

    function showToast(msg, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function getSkillBadge(level) {
        const map = {
            expert: 'badge-success',
            advanced: 'badge-info',
            intermediate: 'badge-warning',
            beginner: 'badge-danger',
        };
        return map[level] || 'badge-neutral';
    }

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setTimeout(() => loadWorkers(), 300);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => processData(results.data),
            });
        } else if (['xlsx', 'xls'].includes(extension)) {
            reader.onload = (evt) => {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                processData(data);
            };
            reader.readAsBinaryString(file);
        } else {
            showToast('Unsupported file format. Please use CSV or Excel.', 'error');
        }
        // Clear input
        e.target.value = '';
    };

    const processData = async (data) => {
        setLoading(true);
        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
            const workerData = {
                name: row['Worker Name'] || row['name'],
                employee_id: row['Worker_id'] || row['employee_id'],
                gender: (row['Gender'] || row['gender'] || '').toUpperCase(),
                skill_level: 'intermediate', // Default
            };

            if (!workerData.name || !workerData.employee_id) {
                errorCount++;
                continue;
            }

            try {
                const res = await fetch('/api/workers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(workerData),
                });
                const result = await res.json();
                if (result.success) successCount++;
                else errorCount++;
            } catch (err) {
                errorCount++;
            }
        }

        loadWorkers();
        showToast(`Import complete! ${successCount} added, ${errorCount} failed.`, successCount > 0 ? 'success' : 'error');
        setLoading(false);
    };

    if (loading) {
        return <div className="loading-overlay"><div className="loader"></div><p>Loading workers...</p></div>;
    }

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h2>👷 Workers</h2>
                        <p>Manage your workforce</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="search-box">
                            <span className="search-icon">🔍</span>
                            <input
                                id="workers-search"
                                name="workers_search"
                                type="text"
                                className="form-input"
                                placeholder="Search workers..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".csv, .xlsx, .xls"
                            onChange={handleFileUpload}
                        />
                        <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()}>📤 Bulk Upload</button>
                        <button className="btn btn-primary" onClick={openAdd}>+ Add Worker</button>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    <table className="mobile-stack-table">
                        <thead>
                            <tr>
                                <th>Employee ID</th>
                                <th>Name</th>
                                <th>Gender</th>
                                <th>Phone</th>
                                <th>Skill Level</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workers.map(w => (
                                <tr key={w.id}>
                                    <td data-label="ID" style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{w.employee_id}</td>
                                    <td data-label="Name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</td>
                                    <td data-label="Gender">{w.gender || '—'}</td>
                                    <td data-label="Phone">{w.phone || '—'}</td>
                                    <td data-label="Skill"><span className={`badge ${getSkillBadge(w.skill_level)}`}>{w.skill_level}</span></td>
                                    <td data-label="Status">
                                        <span className={`badge ${w.is_active ? 'badge-success' : 'badge-danger'}`}>
                                            {w.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td data-label="Actions">
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                            <a href={`/workers/${w.id}`} className="btn btn-ghost btn-sm">📋</a>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(w)}>✏️</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => deleteWorker(w.id, w.name)}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {workers.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-icon">👷</div>
                        <h3>No workers found</h3>
                        <p>Add your first worker to get started</p>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editWorker ? 'Edit Worker' : 'Add New Worker'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Name *</label>
                                    <input
                                        id="worker-name"
                                        name="name"
                                        className="form-input"
                                        required
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="Full name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Employee ID *</label>
                                    <input
                                        id="worker-employee-id"
                                        name="employee_id"
                                        className="form-input"
                                        required
                                        value={form.employee_id}
                                        onChange={e => setForm({ ...form, employee_id: e.target.value })}
                                        placeholder="e.g. EMP036"
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input
                                        id="worker-phone"
                                        name="phone"
                                        className="form-input"
                                        value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                        placeholder="Phone number"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Gender</label>
                                    <select
                                        id="worker-gender"
                                        name="gender"
                                        className="form-select"
                                        value={form.gender}
                                        onChange={e => setForm({ ...form, gender: e.target.value })}>
                                        <option value="">Select Gender</option>
                                        <option value="MALE">MALE</option>
                                        <option value="FEMALE">FEMALE</option>
                                        <option value="OTHER">OTHER</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Skill Level</label>
                                    <select
                                        id="worker-skill-level"
                                        name="skill_level"
                                        className="form-select"
                                        value={form.skill_level}
                                        onChange={e => setForm({ ...form, skill_level: e.target.value })}>
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                        <option value="expert">Expert</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editWorker ? 'Update' : 'Add Worker'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

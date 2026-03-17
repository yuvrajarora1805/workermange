'use client';

import { useState, useEffect } from 'react';

export default function WorkersPage() {
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editWorker, setEditWorker] = useState(null);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ name: '', phone: '', employee_id: '', skill_level: 'intermediate' });

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
                setForm({ name: '', phone: '', employee_id: '', skill_level: 'intermediate' });
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
        });
        setShowModal(true);
    }

    function openAdd() {
        setEditWorker(null);
        setForm({ name: '', phone: '', employee_id: '', skill_level: 'intermediate' });
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
                        <button className="btn btn-primary" onClick={openAdd}>+ Add Worker</button>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Employee ID</th>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Skill Level</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workers.map(w => (
                                <tr key={w.id}>
                                    <td style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{w.employee_id}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</td>
                                    <td>{w.phone || '—'}</td>
                                    <td><span className={`badge ${getSkillBadge(w.skill_level)}`}>{w.skill_level}</span></td>
                                    <td>
                                        <span className={`badge ${w.is_active ? 'badge-success' : 'badge-danger'}`}>
                                            {w.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <a href={`/workers/${w.id}`} className="btn btn-ghost btn-sm">📋 Log</a>
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

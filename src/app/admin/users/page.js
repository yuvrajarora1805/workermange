'use client';

import { useState, useEffect } from 'react';

export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form states for creating new user
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('line_lead');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // State for editing existing user
    const [editingUserId, setEditingUserId] = useState(null);
    const [editUsername, setEditUsername] = useState('');
    const [editFullName, setEditFullName] = useState('');
    const [editRole, setEditRole] = useState('line_lead');
    const [editPassword, setEditPassword] = useState(''); // Optional password change

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            const result = await res.json();
            if (result.success) {
                setUsers(result.data);
            } else {
                setError(result.error || 'Failed to load users');
            }
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setSubmitting(true);

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role, fullName })
            });

            const result = await res.json();
            if (res.ok && result.success) {
                setSuccessMsg(`User ${username} created successfully!`);
                setUsername('');
                setPassword('');
                setFullName('');
                setRole('line_lead');
                loadUsers(); // Refresh list
            } else {
                setError(result.error || 'Failed to create user');
            }
        } catch (err) {
            console.error('Error submitting form:', err);
            setError('An error occurred during submission.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartEdit = (user) => {
        setEditingUserId(user.id);
        setEditUsername(user.username);
        setEditFullName(user.full_name);
        setEditRole(user.role);
        setEditPassword('');
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
    };

    const handleSaveEdit = async (userId) => {
        setError('');
        try {
            const updatePayload = {
                id: userId,
                username: editUsername,
                fullName: editFullName,
                role: editRole
            };
            
            if (editPassword) {
                updatePayload.password = editPassword;
            }

            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });

            const result = await res.json();
            if (res.ok && result.success) {
                setEditingUserId(null);
                loadUsers(); // Refresh list
            } else {
                alert(result.error || 'Failed to update user');
            }
        } catch (err) {
            console.error('Save edit error:', err);
            alert('Failed to save changes.');
        }
    };

    const handleToggleStatus = async (user) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    isActive: !user.is_active
                })
            });

            const result = await res.json();
            if (res.ok && result.success) {
                loadUsers(); // Reload to show state
            } else {
                alert(result.error || 'Failed to update user status');
            }
        } catch (err) {
            console.error('Status toggle error:', err);
            alert('Failed to update status.');
        }
    };

    const getRoleBadgeClass = (userRole) => {
        switch (userRole) {
            case 'admin': return 'badge-danger';
            case 'supervisor': return 'badge-warning';
            case 'hr': return 'badge-info';
            case 'line_lead': return 'badge-success';
            default: return 'badge-neutral';
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <h2>👤 User & Role Management</h2>
                <p>Add system users, assign security roles, and manage active directory permissions.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
                {/* User Creation Form Card */}
                <div className="card" style={{ padding: '24px', height: 'fit-content' }}>
                    <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>➕ Create User</h3>
                    
                    {error && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                            ⚠️ {error}
                        </div>
                    )}
                    
                    {successMsg && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                            ✅ {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Username</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. jdoe"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: '#fff', outline: 'none' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Full Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: '#fff', outline: 'none' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Password</label>
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: '#fff', outline: 'none' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Security Role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: '#fff', outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="admin" style={{ color: '#1e293b' }}>System Admin</option>
                                <option value="hr" style={{ color: '#1e293b' }}>HR Officer</option>
                                <option value="supervisor" style={{ color: '#1e293b' }}>Factory Supervisor</option>
                                <option value="line_lead" style={{ color: '#1e293b' }}>Line Leader</option>
                                <option value="production_team" style={{ color: '#1e293b' }}>Production Team</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                width: '100%',
                                background: 'var(--gradient-1, linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%))',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px',
                                fontWeight: '700',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                marginTop: '8px'
                            }}
                        >
                            {submitting ? 'Creating...' : 'Register User'}
                        </button>
                    </form>
                </div>

                {/* Users List Card */}
                <div className="card" style={{ padding: '24px', flexGrow: 2 }}>
                    <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>📋 Current Users</h3>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div className="loader" style={{ margin: '0 auto 10px auto' }}></div>
                            <p>Loading users...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                            No users found.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '12px' }}>Name</th>
                                        <th style={{ padding: '12px' }}>Username</th>
                                        <th style={{ padding: '12px' }}>Role</th>
                                        <th style={{ padding: '12px' }}>Status</th>
                                        <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => {
                                        const isEditing = editingUserId === u.id;
                                        return (
                                            <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', background: isEditing ? 'rgba(59,130,246,0.04)' : 'transparent' }}>
                                                {isEditing ? (
                                                    <>
                                                        <td style={{ padding: '8px' }}>
                                                            <input
                                                                type="text"
                                                                value={editFullName}
                                                                onChange={(e) => setEditFullName(e.target.value)}
                                                                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: '#fff', fontSize: '13px', width: '100%' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '8px' }}>
                                                            <input
                                                                type="text"
                                                                value={editUsername}
                                                                onChange={(e) => setEditUsername(e.target.value)}
                                                                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: '#fff', fontSize: '13px', width: '100%' }}
                                                            />
                                                            <input
                                                                type="password"
                                                                placeholder="New pass (opt)"
                                                                value={editPassword}
                                                                onChange={(e) => setEditPassword(e.target.value)}
                                                                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: '#fff', fontSize: '11px', width: '100%', marginTop: '4px' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '8px' }}>
                                                            <select
                                                                value={editRole}
                                                                onChange={(e) => setEditRole(e.target.value)}
                                                                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: '#fff', fontSize: '13px', width: '100%', cursor: 'pointer' }}
                                                            >
                                                                <option value="admin" style={{ color: '#1e293b' }}>Admin</option>
                                                                <option value="hr" style={{ color: '#1e293b' }}>HR</option>
                                                                <option value="supervisor" style={{ color: '#1e293b' }}>Supervisor</option>
                                                                <option value="line_lead" style={{ color: '#1e293b' }}>Line Lead</option>
                                                                <option value="production_team" style={{ color: '#1e293b' }}>Prod Team</option>
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '8px' }}>
                                                            <span className={`badge ${u.is_active ? 'badge-info' : 'badge-neutral'}`}>
                                                                {u.is_active ? 'Active' : 'Suspended'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '8px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                            <button
                                                                onClick={() => handleSaveEdit(u.id)}
                                                                style={{ background: '#10b981', border: 'none', borderRadius: '4px', padding: '6px 12px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '6px 12px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td style={{ padding: '12px', fontWeight: '500' }}>{u.full_name}</td>
                                                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>@{u.username}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span className={`badge ${getRoleBadgeClass(u.role)}`}>
                                                                {u.role.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span className={`badge ${u.is_active ? 'badge-info' : 'badge-neutral'}`}>
                                                                {u.is_active ? 'Active' : 'Suspended'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <button
                                                                onClick={() => handleStartEdit(u)}
                                                                style={{
                                                                    background: 'rgba(59, 130, 246, 0.15)',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    padding: '4px 10px',
                                                                    color: '#60a5fa',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleStatus(u)}
                                                                style={{
                                                                    background: u.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    padding: '4px 10px',
                                                                    color: u.is_active ? '#f87171' : '#34d399',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {u.is_active ? 'Suspend' : 'Activate'}
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

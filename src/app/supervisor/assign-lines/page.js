'use client';

import { useState, useEffect } from 'react';

export default function AssignLinesPage() {
    const [lineLeaders, setLineLeaders] = useState([]);
    const [lines, setLines] = useState([]);
    const [selectedLeader, setSelectedLeader] = useState(null);
    const [selectedLines, setSelectedLines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        setError('');
        try {
            const [leadersRes, linesRes] = await Promise.all([
                fetch('/api/supervisor/assign-lines').then(r => r.json()),
                fetch('/api/lines').then(r => r.json())
            ]);

            if (leadersRes.success && linesRes.success) {
                setLineLeaders(leadersRes.data);
                setLines(linesRes.data.filter(l => l.is_active));
            } else {
                setError(leadersRes.error || linesRes.error || 'Failed to load configuration data');
            }
        } catch (err) {
            console.error('Error loading assignment configuration:', err);
            setError('Failed to fetch data from server');
        } finally {
            setLoading(false);
        }
    }

    const handleSelectLeader = (leader) => {
        setSelectedLeader(leader);
        setSelectedLines(leader.assignedLines.map(l => l.id));
        setSuccess('');
        setError('');
    };

    const handleCheckboxChange = (lineId) => {
        if (selectedLines.includes(lineId)) {
            setSelectedLines(selectedLines.filter(id => id !== lineId));
        } else {
            setSelectedLines([...selectedLines, lineId]);
        }
    };

    const handleSaveAssignments = async () => {
        if (!selectedLeader) return;
        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/supervisor/assign-lines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedLeader.id,
                    lineIds: selectedLines
                })
            });

            const result = await res.json();
            if (res.ok && result.success) {
                setSuccess(`Successfully updated line assignments for ${selectedLeader.full_name || selectedLeader.username}`);
                loadData(); // Refresh list to update display
                // Update local select reference
                setSelectedLeader({
                    ...selectedLeader,
                    assignedLines: lines.filter(l => selectedLines.includes(l.id))
                });
            } else {
                setError(result.error || 'Failed to update line assignments');
            }
        } catch (err) {
            console.error('Error updating line assignments:', err);
            setError('An error occurred during save.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <h2>🏭 Line Leader Assignments</h2>
                <p>Assign specific production lines to Line Leaders. Assigned leaders will only have access to data for their assigned lines.</p>
            </div>

            {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
                    ⚠️ {error}
                </div>
            )}

            {success && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
                    ✅ {success}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Line Leaders List Card */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>👷 Line Leaders</h3>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '30px 0' }}>
                            <div className="loader" style={{ margin: '0 auto 10px auto' }}></div>
                            <p>Loading line leaders...</p>
                        </div>
                    ) : lineLeaders.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No line leaders found.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {lineLeaders.map(ll => {
                                const isSelected = selectedLeader?.id === ll.id;
                                return (
                                    <div
                                        key={ll.id}
                                        onClick={() => handleSelectLeader(ll)}
                                        style={{
                                            padding: '16px',
                                            borderRadius: '12px',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                            border: isSelected ? '1px solid var(--info)' : '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '600' }}>{ll.full_name || ll.username}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>@{ll.username}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '150px', justifyContent: 'flex-end' }}>
                                            {ll.assignedLines.length === 0 ? (
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None</span>
                                            ) : (
                                                ll.assignedLines.map(l => (
                                                    <span key={l.id} className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                        {l.name}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Assignment Control Card */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>🔧 Edit Line Assignments</h3>
                    
                    {!selectedLeader ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            <span style={{ fontSize: '32px', marginBottom: '10px' }}>👈</span>
                            <p>Select a Line Leader from the list to manage their assigned lines.</p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Selected Leader</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{selectedLeader.full_name || selectedLeader.username}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Role: Line Leader</div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '12px' }}>Assign Lines</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {lines.map(line => {
                                        const isChecked = selectedLines.includes(line.id);
                                        return (
                                            <label
                                                key={line.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    background: isChecked ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                                                    border: '1px solid var(--border-color)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleCheckboxChange(line.id)}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{line.name}</div>
                                                    {line.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{line.description}</div>}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                onClick={handleSaveAssignments}
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
                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {submitting ? 'Saving Assignments...' : 'Save Assignments'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

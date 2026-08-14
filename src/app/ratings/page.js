'use client';

import { useState, useEffect } from 'react';

export default function RatingsPage() {
    const [workers, setWorkers] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWorker, setSelectedWorker] = useState('');
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comments, setComments] = useState('');
    const [ratedBy, setRatedBy] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [workerSearch, setWorkerSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredWorkers, setFilteredWorkers] = useState([]);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            const [wRes, rRes] = await Promise.all([
                fetch('/api/workers').then(r => r.json()),
                fetch('/api/ratings').then(r => r.json()),
            ]);
            if (wRes.success) {
                setWorkers(wRes.data);
                setFilteredWorkers(wRes.data.slice(0, 100)); // Initial limited list
            }
            if (rRes.success) setRatings(rRes.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    // Handle worker search filtering
    useEffect(() => {
        if (!workerSearch) {
            setFilteredWorkers(workers.slice(0, 100));
            return;
        }
        const term = workerSearch.toLowerCase();
        const filtered = workers.filter(w => 
            w.name.toLowerCase().includes(term) || 
            w.employee_id.toLowerCase().includes(term)
        ).slice(0, 50); // Limit display for performance
        setFilteredWorkers(filtered);
    }, [workerSearch, workers]);

    function selectWorker(w) {
        setSelectedWorker(w.id);
        setWorkerSearch(`${w.name} (${w.employee_id})`);
        setShowDropdown(false);
    }

    async function submitRating(e) {
        e.preventDefault();
        if (!selectedWorker || !rating) { showToast('Select a worker and rating', 'error'); return; }
        setSubmitting(true);
        try {
            const res = await fetch('/api/ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ worker_id: parseInt(selectedWorker), rating, comments, rated_by: ratedBy || 'Manager' }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Rating submitted!', 'success');
                setSelectedWorker(''); setRating(0); setComments('');
                loadData();
            }
        } catch (err) { showToast('Failed to submit', 'error'); }
        finally { setSubmitting(false); }
    }

    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast toast-${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    const labels = ['', 'Poor', 'Below Avg', 'Good', 'Excellent'];
    const colors = ['', 'var(--danger)', 'var(--warning)', 'var(--info)', 'var(--success)'];

    if (loading) return <div className="loading-overlay"><div className="loader"></div></div>;

    return (
        <>
            <div className="page-header">
                <h2>⭐ Manager Ratings</h2>
                <p>Rate workers 1-4 (contributes 20% to efficiency)</p>
            </div>
            <div className="responsive-grid responsive-grid-2">
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Submit Rating</h3></div>
                    <form onSubmit={submitRating}>
                        <div className="form-group">
                            <label className="form-label">Worker *</label>
                            <div className="searchable-dropdown-container">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search by Name or ID (e.g. CHABILE)"
                                    value={workerSearch}
                                    onChange={(e) => {
                                        setWorkerSearch(e.target.value);
                                        setShowDropdown(true);
                                        if (selectedWorker) setSelectedWorker(''); // Clear selection if typing
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                    autoComplete="off"
                                />
                                {showDropdown && filteredWorkers.length > 0 && (
                                    <div className="searchable-dropdown-list">
                                        {filteredWorkers.map(w => (
                                            <div 
                                                key={w.id} 
                                                className="searchable-dropdown-item"
                                                onClick={() => selectWorker(w)}
                                            >
                                                <div style={{fontWeight: 600, fontSize: '14px'}}>{w.name}</div>
                                                <div className="searchable-dropdown-info">ID: {w.employee_id} • Currently: {w.rating_score ? w.rating_score + '/20' : 'No rating'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {showDropdown && workerSearch && filteredWorkers.length === 0 && (
                                    <div className="searchable-dropdown-list">
                                        <div className="searchable-dropdown-item" style={{color: 'var(--text-muted)', textAlign: 'center'}}>
                                            No workers found matching "{workerSearch}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Rating *</label>
                            <div className="star-rating">
                                {[1,2,3,4].map(s => (
                                    <span key={s} className={`star ${s <= (hoverRating||rating) ? 'filled' : ''}`}
                                        onClick={() => setRating(s)} onMouseEnter={() => setHoverRating(s)}
                                        onMouseLeave={() => setHoverRating(0)} style={{fontSize:'36px'}}>★</span>
                                ))}
                            </div>
                            {(hoverRating||rating) > 0 && (
                                <div style={{fontSize:'14px',fontWeight:600,color:colors[hoverRating||rating],marginTop:'4px'}}>
                                    {labels[hoverRating||rating]} — {((hoverRating||rating)/4*20).toFixed(1)} pts
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Rated By</label>
                            <input
                                id="rating-rated-by"
                                name="rated_by"
                                className="form-input"
                                value={ratedBy}
                                onChange={e => setRatedBy(e.target.value)}
                                placeholder="Manager name"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Comments</label>
                            <textarea
                                id="rating-comments"
                                name="comments"
                                className="form-textarea"
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                placeholder="Optional..."
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%',justifyContent:'center'}} disabled={submitting}>
                            {submitting ? '⏳ Submitting...' : '⭐ Submit Rating'}
                        </button>
                    </form>
                </div>
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Recent Ratings</h3></div>
                    {ratings.length > 0 ? (
                        <div className="table-wrapper" style={{maxHeight:'500px',overflowY:'auto'}}>
                            <table className="mobile-stack-table"><thead><tr><th>Worker</th><th>Rating</th><th className="hide-mobile">By</th><th className="hide-mobile">Date</th></tr></thead>
                                <tbody>{ratings.slice(0,20).map(r => (
                                    <tr key={r.id}>
                                        <td data-label="Worker"><div style={{fontWeight:600,color:'var(--text-primary)'}}>{r.worker_name}</div>
                                            <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{r.employee_id}</div></td>
                                        <td data-label="Stars"><div style={{display:'flex',gap:'2px'}}>
                                            {[1,2,3,4].map(s => <span key={s} style={{color:s<=r.rating?'#fbbf24':'var(--text-muted)',fontSize:'16px'}}>★</span>)}
                                        </div></td>
                                        <td className="hide-mobile" style={{fontSize:'13px',color:'var(--text-muted)'}}>{r.rated_by}</td>
                                        <td className="hide-mobile" style={{fontSize:'13px',color:'var(--text-muted)'}}>{new Date(r.date).toLocaleDateString()}</td>
                                    </tr>
                                ))}</tbody></table>
                        </div>
                    ) : (
                        <div className="empty-state"><div className="empty-state-icon">⭐</div><h3>No ratings yet</h3></div>
                    )}
                </div>
            </div>
        </>
    );
}

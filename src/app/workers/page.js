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
    const [importStatus, setImportStatus] = useState({ active: false, current: 0, total: 0, success: 0, error: 0 });
    const [form, setForm] = useState({ 
        name: '', phone: '', employee_id: '', rating: 2, gender: '', contractor_name: '', dob: '', joining_date: '',
        father_husband_name: '', division: '', section: '', nature_of_work: '', last_attendance: '',
        aadhaar_no: '', pf_no: '', esi_no: '', emergency_contact: '', state: '', district: '', qualification: ''
    });
    const contractorFileInputRef = useRef(null);

    const isMounted = useRef(false);

    useEffect(() => {
        if (!isMounted.current) {
            loadWorkers("");
            isMounted.current = true;
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            loadWorkers(search);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [search]);

    async function loadWorkers(query = search) {
        try {
            const res = await fetch(`/api/workers${query ? `?search=${encodeURIComponent(query)}` : ''}`);
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
                setForm({ 
                    name: '', phone: '', employee_id: '', rating: 2, gender: '', contractor_name: '', dob: '', joining_date: '',
                    father_husband_name: '', division: '', section: '', nature_of_work: '', last_attendance: '',
                    aadhaar_no: '', pf_no: '', esi_no: '', emergency_contact: '', state: '', district: '', qualification: ''
                });
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
            rating: worker.rating || 2,
            gender: worker.gender || '',
            contractor_name: worker.contractor_name || '',
            dob: worker.dob ? worker.dob.split('T')[0] : '',
            joining_date: worker.joining_date ? worker.joining_date.split('T')[0] : '',
            father_husband_name: worker.father_husband_name || '',
            division: worker.division || '',
            section: worker.section || '',
            nature_of_work: worker.nature_of_work || '',
            last_attendance: worker.last_attendance ? worker.last_attendance.split('T')[0] : '',
            aadhaar_no: worker.aadhaar_no || '',
            pf_no: worker.pf_no || '',
            esi_no: worker.esi_no || '',
            emergency_contact: worker.emergency_contact || '',
            state: worker.state || '',
            district: worker.district || '',
            qualification: worker.qualification || '',
        });
        setShowModal(true);
    }

    function openAdd() {
        setEditWorker(null);
        setForm({ 
            name: '', phone: '', employee_id: '', rating: 2, gender: '', contractor_name: '', dob: '', joining_date: '',
            father_husband_name: '', division: '', section: '', nature_of_work: '', last_attendance: '',
            aadhaar_no: '', pf_no: '', esi_no: '', emergency_contact: '', state: '', district: '', qualification: ''
        });
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

    function getSkillBadge(rating) {
        const map = {
            4: 'badge-success', // Expert
            3: 'badge-info',    // Advanced
            2: 'badge-warning', // Intermediate
            1: 'badge-danger',  // Beginner
        };
        return map[rating] || 'badge-neutral';
    }

    function getSkillLabel(rating) {
        const map = {
            4: 'Expert',
            3: 'Advanced',
            2: 'Intermediate',
            1: 'Beginner',
        };
        return map[rating] || 'Unknown';
    }

    const handleSearch = (e) => {
        setSearch(e.target.value);
    };


    const normalizeRow = (row) => {
        const normalized = {};
        Object.keys(row).forEach(key => {
            // Clean keys: trim and remove multiple spaces/newlines
            const cleanKey = key.trim().replace(/\s+/g, ' ');
            normalized[cleanKey] = row[key];
        });
        return normalized;
    };


    const handleContractorUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => processContractorData(results.data),
            });
        } else if (['xlsx', 'xls'].includes(extension)) {
            reader.onload = (evt) => {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Read sheet as 2D array of rows to find header dynamically
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                
                // Find the header row (has 'Code' and 'Name' or similar variants)
                const possibleCodeKeys = ['code', 'token', 'worker_id', 'employee_id', 's.n.', 'sn'];
                const possibleNameKeys = ['name', 'labour name', 'worker name'];
                
                let headerRowIndex = -1;
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || !Array.isArray(row)) continue;
                    
                    let hasCodeKey = false;
                    let hasNameKey = false;
                    
                    for (const cell of row) {
                        if (cell !== undefined && cell !== null) {
                            const val = String(cell).toLowerCase().trim();
                            if (possibleCodeKeys.some(key => val.includes(key))) {
                                hasCodeKey = true;
                            }
                            if (possibleNameKeys.some(key => val.includes(key))) {
                                hasNameKey = true;
                            }
                        }
                    }
                    
                    if (hasCodeKey && hasNameKey) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                let parsedData = [];
                if (headerRowIndex !== -1) {
                    const headers = rows[headerRowIndex].map(h => h !== undefined && h !== null ? String(h).trim() : '');
                    for (let i = headerRowIndex + 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;
                        
                        const rowObj = {};
                        let hasData = false;
                        headers.forEach((header, colIndex) => {
                            if (header) {
                                const val = row[colIndex];
                                rowObj[header] = val !== undefined && val !== null ? val : '';
                                if (val !== undefined && val !== null && String(val).trim() !== '') {
                                    hasData = true;
                                }
                            }
                        });
                        if (hasData) {
                            parsedData.push(rowObj);
                        }
                    }
                } else {
                    // Fallback to default
                    parsedData = XLSX.utils.sheet_to_json(ws);
                }
                processContractorData(parsedData);
            };
            reader.readAsBinaryString(file);
        } else {
            showToast('Unsupported file format.', 'error');
        }
        e.target.value = '';
    };

    const processContractorData = async (data) => {
        setImportStatus({ active: true, current: 0, total: data.length, success: 0, error: 0 });
        let successCount = 0;
        let errorCount = 0;
        let currentIndex = 0;

        const parseDate = (d) => {
            if (!d) return null;
            
            // Handle Excel serial date (numeric)
            if (typeof d === 'number') {
                const date = new Date(Math.round((d - 25569) * 86400 * 1000));
                return new Date(date.toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).toLocaleDateString("en-CA");
            }
            
            if (typeof d === 'string') {
                const clean = d.trim();
                // Check if already in YYYY-MM-DD format
                if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
                    return clean;
                }
                
                // Handle DD/MM/YYYY or DD-MM-YYYY
                const parts = clean.split(/[-/]/);
                if (parts.length === 3) {
                    // Check if it's YYYY-MM-DD
                    if (parts[0].length === 4) {
                        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                    } else {
                        // Convert DD-MM-YYYY / DD/MM/YYYY to YYYY-MM-DD
                        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }
                }
            }
            return d;
        };

        const mapSkillToRating = (skill) => {
            if (!skill) return 2;
            const s = String(skill).toLowerCase();
            if (s.includes('expert') || s === '4') return 4;
            if (s.includes('advanced') || s === '3') return 3;
            if (s.includes('beginner') || s === '1') return 1;
            return 2; // Default to Intermediate
        };

        for (let row of data) {
            currentIndex++;
            row = normalizeRow(row);
            const getVal = (keys) => {
                for (const k of keys) {
                    if (row[k] !== undefined && row[k] !== null) return row[k];
                }
                return '';
            };

            const workerData = {
                name: getVal(['Name', 'name', 'Labour Name', 'labour name', 'Worker Name']),
                employee_id: String(getVal(['Code', 'code', 'Contractor Token No', 'Contractor Token NO', 'Contractor Token No.', 'token no', 'Worker_id', 'employee_id']) || '').trim(),
                gender: getVal(['Gender', 'gender']).toString().toUpperCase(),
                contractor_name: getVal(['Contractor', 'contractor', 'Contractor Name', 'contractor name']),
                rating: mapSkillToRating(getVal(['Workskill', 'workskill', 'Work Skill', 'worker skill', 'skill level'])),
                dob: parseDate(getVal(['Date of Birth', 'date of birth', 'Date of Bir'])),
                joining_date: parseDate(getVal(['Date of Service', 'date of service', 'Date of Se', 'DOJ 1st', 'DOJ', 'doj'])),
                father_husband_name: getVal(['Son / Daughter / Wife of', 'Son / Daug', 'Father Name']),
                division: getVal(['Deptt.', 'deptt.', 'Division', 'division', 'Department']),
                section: getVal(['Section', 'section']),
                nature_of_work: getVal(['Desig.', 'desig.', 'Nature of Work', 'Nature Of W', 'nature_of_work']),
                last_attendance: parseDate(getVal(['Last Attendance', 'Last Atten', 'last_attendance'])),
                aadhaar_no: getVal(['Aadhaar No', 'Aadhaar N', 'aadhaar_no', 'Aadhar No']),
                pf_no: getVal(['PF No', 'pf_no']),
                esi_no: getVal(['ESI No', 'esi_no']),
                phone: getVal(['Phone', 'phone', 'Mobile', 'Mobile No']),
                emergency_contact: getVal(['Emergency Contact', 'Emergenc', 'emergency_contact']),
                state: getVal(['State', 'state']),
                district: getVal(['District', 'district']),
                qualification: getVal(['Qualification', 'Qualificati', 'qualification']),
            };

            if (!workerData.name || !workerData.employee_id) {
                errorCount++;
                setImportStatus(prev => ({ ...prev, current: currentIndex, error: errorCount }));
                continue;
            }

            try {
                const res = await fetch('/api/workers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...workerData, update_skill_only: true }),
                });
                const result = await res.json();
                if (result.success) successCount++;
                else errorCount++;
            } catch (err) {
                errorCount++;
            }
            
            setImportStatus(prev => ({ ...prev, current: currentIndex, success: successCount, error: errorCount }));
        }

        loadWorkers();
        showToast(`Import complete! ${successCount} added, ${errorCount} failed.`, successCount > 0 ? 'success' : 'error');
        setTimeout(() => setImportStatus({ active: false, current: 0, total: 0, success: 0, error: 0 }), 1500);
    };

    if (importStatus.active) {
        const percent = Math.round((importStatus.current / importStatus.total) * 100);
        return (
            <div className="loading-overlay">
                <div className="card" style={{ width: '400px', textAlign: 'center', padding: '32px' }}>
                    <div className="loader" style={{ margin: '0 auto 24px' }}></div>
                    <h3 style={{ marginBottom: '8px' }}>Importing Workers...</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Processing {importStatus.current} of {importStatus.total}
                    </p>
                    
                    <div style={{ background: 'var(--border-color)', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px', position: 'relative' }}>
                        <div style={{ 
                            background: 'var(--success)', 
                            width: `${percent}%`, 
                            height: '100%', 
                            transition: 'width 0.3s ease',
                            boxShadow: '0 0 10px var(--success)'
                        }}></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--success)', fontSize: '20px', fontWeight: 'bold' }}>{importStatus.success}</div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Success</div>
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--danger)', fontSize: '20px', fontWeight: 'bold' }}>{importStatus.error}</div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Failed</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                            ref={contractorFileInputRef}
                            style={{ display: 'none' }}
                            accept=".csv, .xlsx, .xls"
                            onChange={handleContractorUpload}
                        />
                        <button className="btn btn-ghost" onClick={() => contractorFileInputRef.current.click()}>👷 Total Manpower</button>
                        
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
                                    <td data-label="Skill">
                                        <span className={`badge ${getSkillBadge(w.rating)}`}>
                                            {getSkillLabel(w.rating)} ({w.rating || 2})
                                        </span>
                                    </td>
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
                                <div className="form-group">
                                    <label className="form-label">Son/Daughter/Wife of</label>
                                    <input
                                        id="worker-father-husband"
                                        name="father_husband_name"
                                        className="form-input"
                                        value={form.father_husband_name}
                                        onChange={e => setForm({ ...form, father_husband_name: e.target.value })}
                                        placeholder="Father/Husband Name"
                                    />
                                </div>
                            </div>
                            <div className="form-row">
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
                                    <label className="form-label">Rating (Efficiency 20%)</label>
                                    <select
                                        id="worker-rating"
                                        name="rating"
                                        className="form-select"
                                        value={form.rating}
                                        onChange={e => setForm({ ...form, rating: parseInt(e.target.value) })}>
                                        <option value={1}>1 - Beginner</option>
                                        <option value={2}>2 - Intermediate</option>
                                        <option value={3}>3 - Advanced</option>
                                        <option value={4}>4 - Expert</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Division</label>
                                    <input
                                        id="worker-division"
                                        name="division"
                                        className="form-input"
                                        value={form.division}
                                        onChange={e => setForm({ ...form, division: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Section</label>
                                    <input
                                        id="worker-section"
                                        name="section"
                                        className="form-input"
                                        value={form.section}
                                        onChange={e => setForm({ ...form, section: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nature of Work</label>
                                    <input
                                        id="worker-nature-of-work"
                                        name="nature_of_work"
                                        className="form-input"
                                        value={form.nature_of_work}
                                        onChange={e => setForm({ ...form, nature_of_work: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Contractor Name</label>
                                    <input
                                        id="worker-contractor"
                                        name="contractor_name"
                                        className="form-input"
                                        value={form.contractor_name}
                                        onChange={e => setForm({ ...form, contractor_name: e.target.value })}
                                        placeholder="Contractor Co. Name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date of Birth</label>
                                    <input
                                        id="worker-dob"
                                        name="dob"
                                        type="date"
                                        className="form-input"
                                        value={form.dob}
                                        onChange={e => setForm({ ...form, dob: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date of Service</label>
                                    <input
                                        id="worker-joining"
                                        name="joining_date"
                                        type="date"
                                        className="form-input"
                                        value={form.joining_date}
                                        onChange={e => setForm({ ...form, joining_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Aadhaar No</label>
                                    <input
                                        id="worker-aadhaar"
                                        name="aadhaar_no"
                                        className="form-input"
                                        value={form.aadhaar_no}
                                        onChange={e => setForm({ ...form, aadhaar_no: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">PF No</label>
                                    <input
                                        id="worker-pf"
                                        name="pf_no"
                                        className="form-input"
                                        value={form.pf_no}
                                        onChange={e => setForm({ ...form, pf_no: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ESI No</label>
                                    <input
                                        id="worker-esi"
                                        name="esi_no"
                                        className="form-input"
                                        value={form.esi_no}
                                        onChange={e => setForm({ ...form, esi_no: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Emergency Contact</label>
                                    <input
                                        id="worker-emergency"
                                        name="emergency_contact"
                                        className="form-input"
                                        value={form.emergency_contact}
                                        onChange={e => setForm({ ...form, emergency_contact: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Qualification</label>
                                    <input
                                        id="worker-qualification"
                                        name="qualification"
                                        className="form-input"
                                        value={form.qualification}
                                        onChange={e => setForm({ ...form, qualification: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Last Attendance</label>
                                    <input
                                        id="worker-last-attendance"
                                        name="last_attendance"
                                        type="date"
                                        className="form-input"
                                        value={form.last_attendance}
                                        onChange={e => setForm({ ...form, last_attendance: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">State</label>
                                    <input
                                        id="worker-state"
                                        name="state"
                                        className="form-input"
                                        value={form.state}
                                        onChange={e => setForm({ ...form, state: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">District</label>
                                    <input
                                        id="worker-district"
                                        name="district"
                                        className="form-input"
                                        value={form.district}
                                        onChange={e => setForm({ ...form, district: e.target.value })}
                                    />
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

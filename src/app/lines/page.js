'use client';

import { useState, useEffect } from 'react';

export default function LinesPage() {
    const [lines, setLines] = useState([]);
    const [machines, setMachines] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedLine, setSelectedLine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showLineModal, setShowLineModal] = useState(false);
    const [showMachineModal, setShowMachineModal] = useState(false);
    const [showEditMachineModal, setShowEditMachineModal] = useState(false);
    const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
    const [editLine, setEditLine] = useState(null);
    const [editMachine, setEditMachine] = useState(null);
    const [lineForm, setLineForm] = useState({ name: '', description: '' });
    const [machineForm, setMachineForm] = useState({ name: '', line_id: '', worker_capacity: 1 });
    const [editMachineForm, setEditMachineForm] = useState({ name: '' });
    const [bulkAssignForm, setBulkAssignForm] = useState({ product_id: '' });
    const [bulkAssigning, setBulkAssigning] = useState(false);
    const [lineSearch, setLineSearch] = useState('');

    useEffect(() => { loadLines(); }, []);

    async function loadLines() {
        try {
            const [linesRes, productsRes] = await Promise.all([
                fetch('/api/lines').then(r => r.json()),
                fetch('/api/products').then(r => r.json())
            ]);
            
            if (productsRes.success) setProducts(productsRes.data);
            
            if (linesRes.success) {
                setLines(linesRes.data);
                if (linesRes.data.length > 0 && !selectedLine) {
                    setSelectedLine(linesRes.data[0].id);
                    loadMachines(linesRes.data[0].id);
                }
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    async function loadMachines(lineId) {
        try {
            const res = await fetch(`/api/machines?line_id=${lineId}`);
            const data = await res.json();
            if (data.success) setMachines(data.data);
        } catch (err) { console.error(err); }
    }

    async function handleLineSubmit(e) {
        e.preventDefault();
        try {
            const method = editLine ? 'PUT' : 'POST';
            const body = editLine ? { ...lineForm, id: editLine.id } : lineForm;
            const res = await fetch('/api/lines', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setShowLineModal(false);
                setEditLine(null);
                setLineForm({ name: '', description: '' });
                loadLines();
                showToast(editLine ? 'Line updated!' : 'Line added!', 'success');
            }
        } catch (err) { showToast('Failed to save line', 'error'); }
    }

    async function handleMachineSubmit(e) {
        e.preventDefault();
        try {
            const res = await fetch('/api/machines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...machineForm, line_id: selectedLine }),
            });
            const data = await res.json();
            if (data.success) {
                setShowMachineModal(false);
                setMachineForm({ name: '', worker_capacity: 1 });
                loadMachines(selectedLine);
                loadLines();
                showToast('Machine added!', 'success');
            }
        } catch (err) { showToast('Failed to add machine', 'error'); }
    }

    async function handleEditMachineSubmit(e) {
        e.preventDefault();
        try {
            const res = await fetch('/api/machines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editMachine.id, name: editMachineForm.name }),
            });
            const data = await res.json();
            if (data.success) {
                setShowEditMachineModal(false);
                setEditMachine(null);
                setEditMachineForm({ name: '' });
                loadMachines(selectedLine);
                loadLines();
                showToast('Machine updated!', 'success');
            }
        } catch (err) { showToast('Failed to update machine', 'error'); }
    }

    async function deleteLine(id) {
        if (!confirm('Delete this line and all its machines?')) return;
        try {
            const res = await fetch(`/api/lines?id=${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                loadLines();
                setSelectedLine(null);
                setMachines([]);
                showToast('Line deleted', 'success');
            }
        } catch (err) { showToast('Failed to delete', 'error'); }
    }

    async function deleteMachine(id) {
        if (!confirm('Delete this machine?')) return;
        try {
            const res = await fetch(`/api/machines?id=${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                loadMachines(selectedLine);
                loadLines();
                showToast('Machine deleted', 'success');
            }
        } catch (err) { showToast('Failed to delete', 'error'); }
    }

    async function handleBulkAssignProduct(e) {
        e.preventDefault();
        if (!bulkAssignForm.product_id) {
            showToast('Please select a product', 'error');
            return;
        }

        setBulkAssigning(true);
        try {
            const res = await fetch('/api/machines/assign-product-to-line', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_id: selectedLine,
                    product_id: parseInt(bulkAssignForm.product_id)
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.data.message, 'success');
                setShowBulkAssignModal(false);
                setBulkAssignForm({ product_id: '' });
                loadMachines(selectedLine);
                loadLines();
            } else {
                showToast(data.error || 'Failed to assign', 'error');
            }
        } catch (err) {
            showToast('Failed to bulk assign product', 'error');
        } finally {
            setBulkAssigning(false);
        }
    }

    async function updateMachineProduct(machineId, productId) {
        try {
            const res = await fetch('/api/machines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: machineId, current_product_id: productId || null }),
            });
            const data = await res.json();
            if (data.success) {
                loadMachines(selectedLine);
                showToast('Product assigned saved!', 'success');
            }
        } catch (err) { showToast('Failed to assign product', 'error'); }
    }

    async function toggleMachineActive(machine) {
        try {
            const res = await fetch('/api/machines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: machine.id, is_active: machine.is_active ? 0 : 1 }),
            });
            if ((await res.json()).success) {
                loadMachines(selectedLine);
                showToast(machine.is_active ? 'Machine deactivated' : 'Machine activated', 'success');
            }
        } catch (err) { showToast('Failed to update', 'error'); }
    }

    async function updateMachineCapacity(machineId, capacity) {
        try {
            const res = await fetch('/api/machines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: machineId, worker_capacity: parseInt(capacity) || 1 }),
            });
            if ((await res.json()).success) {
                loadMachines(selectedLine);
                showToast('Capacity updated', 'success');
            }
        } catch (err) { showToast('Failed to update', 'error'); }
    }

    async function toggleLineActive(line) {
        try {
            const res = await fetch('/api/lines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: line.id, is_active: line.is_active ? 0 : 1 }),
            });
            if ((await res.json()).success) {
                loadLines();
                loadMachines(line.id);
                showToast(line.is_active ? 'Line deactivated — workers will NOT be assigned here' : 'Line activated', 'success');
            }
        } catch (err) { showToast('Failed to update', 'error'); }
    }

    function selectLine(id) {
        setSelectedLine(id);
        loadMachines(id);
    }

    function showToast(msg, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function exportMachineLayout() {
        if (!selectedLine) {
            showToast('Please select a line first', 'error');
            return;
        }

        const line = lines.find(l => l.id === selectedLine);
        const lineMachines = machines;

        // Create HTML content
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${line.name} - Machine Layout</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        background-color: #f5f5f5;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background-color: white;
                        padding: 30px;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #333;
                        border-bottom: 3px solid #6366f1;
                        padding-bottom: 10px;
                    }
                    .line-info {
                        background-color: #f8f9fa;
                        padding: 15px;
                        border-radius: 6px;
                        margin-bottom: 30px;
                        border-left: 4px solid #6366f1;
                    }
                    .line-info p {
                        margin: 8px 0;
                        color: #555;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th {
                        background-color: #6366f1;
                        color: white;
                        padding: 12px;
                        text-align: left;
                        font-weight: 600;
                    }
                    td {
                        padding: 12px;
                        border-bottom: 1px solid #ddd;
                    }
                    tr:nth-child(even) {
                        background-color: #f9fafb;
                    }
                    tr:hover {
                        background-color: #f0f0f0;
                    }
                    .status-active {
                        color: #10b981;
                        font-weight: 600;
                    }
                    .status-inactive {
                        color: #ef4444;
                        font-weight: 600;
                    }
                    .capacity-badge {
                        background-color: #6366f1;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                    }
                    .timestamp {
                        text-align: right;
                        margin-top: 30px;
                        color: #999;
                        font-size: 12px;
                    }
                    @media print {
                        body { background-color: white; }
                        .container { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🏭 Machine Layout Report</h1>

                    <div class="line-info">
                        <p><strong>Production Line:</strong> ${line.name}</p>
                        <p><strong>Description:</strong> ${line.description || 'No description'}</p>
                        <p><strong>Total Machines:</strong> ${lineMachines.length}</p>
                        <p><strong>Active Machines:</strong> ${lineMachines.filter(m => m.is_active).length}</p>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Position</th>
                                <th>Machine Name</th>
                                <th>Status</th>
                                <th>Worker Capacity</th>
                                <th>Current Product</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lineMachines.map(m => {
                                const product = products.find(p => p.id === m.current_product_id);
                                return `
                                    <tr>
                                        <td>#${m.position}</td>
                                        <td>${m.name}</td>
                                        <td><span class="${m.is_active ? 'status-active' : 'status-inactive'}">${m.is_active ? '✓ Active' : '✗ Inactive'}</span></td>
                                        <td><span class="capacity-badge">${m.worker_capacity} worker${m.worker_capacity > 1 ? 's' : ''}</span></td>
                                        <td>${product ? product.name : 'None'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>

                    <div class="timestamp">
                        Generated on ${new Date().toLocaleString()}
                    </div>
                </div>
            </body>
            </html>
        `;

        // Create blob and download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${line.name}-layout-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Machine layout exported!', 'success');
    }

    function exportToCSV() {
        if (!selectedLine) {
            showToast('Please select a line first', 'error');
            return;
        }

        const line = lines.find(l => l.id === selectedLine);
        const lineMachines = machines;

        // Create CSV content
        const headers = ['Position', 'Machine Name', 'Status', 'Worker Capacity', 'Current Product'];
        const rows = lineMachines.map(m => {
            const product = products.find(p => p.id === m.current_product_id);
            return [
                `#${m.position}`,
                m.name,
                m.is_active ? 'Active' : 'Inactive',
                m.worker_capacity,
                product ? product.name : 'None'
            ];
        });

        // Build CSV string
        let csvContent = `Machine Layout - ${line.name}\n`;
        csvContent += `Exported: ${new Date().toLocaleString()}\n\n`;
        csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
        csvContent += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${line.name}-layout-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Machine layout exported as CSV!', 'success');
    }

    async function exportAllLinesLayout() {
        if (lines.length === 0) {
            showToast('No lines to export', 'error');
            return;
        }

        // Fetch all machines for all lines
        const allMachinesData = {};
        for (const line of lines) {
            try {
                const res = await fetch(`/api/machines?line_id=${line.id}`);
                const data = await res.json();
                if (data.success) {
                    allMachinesData[line.id] = data.data;
                }
            } catch (err) {
                console.error(`Failed to load machines for line ${line.id}`, err);
                allMachinesData[line.id] = [];
            }
        }

        // Create HTML content
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>All Production Lines - Machine Layout</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        background-color: #f5f5f5;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    .header {
                        background-color: white;
                        padding: 30px;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        margin-bottom: 20px;
                    }
                    .header h1 {
                        color: #333;
                        border-bottom: 3px solid #6366f1;
                        padding-bottom: 10px;
                        margin: 0;
                    }
                    .header p {
                        color: #666;
                        margin: 10px 0 0 0;
                    }
                    .line-section {
                        background-color: white;
                        padding: 25px;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        margin-bottom: 20px;
                        page-break-inside: avoid;
                    }
                    .line-section h2 {
                        color: #6366f1;
                        border-bottom: 2px solid #6366f1;
                        padding-bottom: 10px;
                        margin-top: 0;
                    }
                    .line-info {
                        background-color: #f8f9fa;
                        padding: 12px;
                        border-radius: 6px;
                        margin-bottom: 15px;
                        border-left: 4px solid #6366f1;
                        font-size: 14px;
                    }
                    .line-info p {
                        margin: 5px 0;
                        color: #555;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th {
                        background-color: #6366f1;
                        color: white;
                        padding: 10px;
                        text-align: left;
                        font-weight: 600;
                        font-size: 13px;
                    }
                    td {
                        padding: 10px;
                        border-bottom: 1px solid #ddd;
                        font-size: 13px;
                    }
                    tr:nth-child(even) {
                        background-color: #f9fafb;
                    }
                    .status-active {
                        color: #10b981;
                        font-weight: 600;
                    }
                    .status-inactive {
                        color: #ef4444;
                        font-weight: 600;
                    }
                    .capacity-badge {
                        background-color: #6366f1;
                        color: white;
                        padding: 3px 6px;
                        border-radius: 3px;
                        font-size: 11px;
                    }
                    .empty-message {
                        color: #999;
                        font-style: italic;
                        padding: 15px;
                    }
                    .timestamp {
                        text-align: right;
                        margin-top: 30px;
                        color: #999;
                        font-size: 12px;
                        background-color: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    @media print {
                        body { background-color: white; }
                        .line-section { box-shadow: none; }
                        .header { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏭 Complete Production Lines & Machines Report</h1>
                        <p>All production lines and their machine layouts</p>
                    </div>

                    ${lines.map(line => {
                        const lineMachines = allMachinesData[line.id] || [];
                        return `
                            <div class="line-section">
                                <h2>${line.name}</h2>

                                <div class="line-info">
                                    <p><strong>Description:</strong> ${line.description || 'No description'}</p>
                                    <p><strong>Status:</strong> <span class="${line.is_active ? 'status-active' : 'status-inactive'}">${line.is_active ? '✓ Active' : '✗ Inactive'}</span></p>
                                    <p><strong>Total Machines:</strong> ${lineMachines.length} | <strong>Active:</strong> ${lineMachines.filter(m => m.is_active).length}</p>
                                </div>

                                ${lineMachines.length > 0 ? `
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Position</th>
                                                <th>Machine Name</th>
                                                <th>Status</th>
                                                <th>Worker Capacity</th>
                                                <th>Current Product</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${lineMachines.map(m => {
                                                const product = products.find(p => p.id === m.current_product_id);
                                                return `
                                                    <tr>
                                                        <td>#${m.position}</td>
                                                        <td>${m.name}</td>
                                                        <td><span class="${m.is_active ? 'status-active' : 'status-inactive'}">${m.is_active ? '✓ Active' : '✗ Inactive'}</span></td>
                                                        <td><span class="capacity-badge">${m.worker_capacity} worker${m.worker_capacity > 1 ? 's' : ''}</span></td>
                                                        <td>${product ? product.name : 'None'}</td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                ` : `
                                    <p class="empty-message">No machines in this line</p>
                                `}
                            </div>
                        `;
                    }).join('')}

                    <div class="timestamp">
                        Generated on ${new Date().toLocaleString()}
                    </div>
                </div>
            </body>
            </html>
        `;

        // Create blob and download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `all-lines-layout-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('All lines exported!', 'success');
    }

    async function exportAllLinesCSV() {
        if (lines.length === 0) {
            showToast('No lines to export', 'error');
            return;
        }

        // Fetch all machines for all lines
        const allMachinesData = {};
        for (const line of lines) {
            try {
                const res = await fetch(`/api/machines?line_id=${line.id}`);
                const data = await res.json();
                if (data.success) {
                    allMachinesData[line.id] = data.data;
                }
            } catch (err) {
                console.error(`Failed to load machines for line ${line.id}`, err);
                allMachinesData[line.id] = [];
            }
        }

        // Create CSV content
        let csvContent = `All Production Lines - Machine Layout Report\n`;
        csvContent += `Exported: ${new Date().toLocaleString()}\n\n`;

        lines.forEach(line => {
            const lineMachines = allMachinesData[line.id] || [];
            csvContent += `\n"${line.name}"\n`;
            csvContent += `"Description","${line.description || 'N/A'}"\n`;
            csvContent += `"Status","${line.is_active ? 'Active' : 'Inactive'}"\n`;
            csvContent += `"Total Machines","${lineMachines.length}"\n`;
            csvContent += `"Active Machines","${lineMachines.filter(m => m.is_active).length}"\n\n`;

            csvContent += `"Position","Machine Name","Status","Worker Capacity","Current Product"\n`;
            lineMachines.forEach(m => {
                const product = products.find(p => p.id === m.current_product_id);
                csvContent += `"#${m.position}","${m.name}","${m.is_active ? 'Active' : 'Inactive'}","${m.worker_capacity}","${product ? product.name : 'None'}"\n`;
            });
        });

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `all-lines-layout-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('All lines exported as CSV!', 'success');
    }

    if (loading) {
        return <div className="loading-overlay"><div className="loader"></div><p>Loading...</p></div>;
    }

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h2>🏭 Lines & Machines</h2>
                        <p>Manage production lines and their machines</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost" onClick={() => { setEditLine(null); setLineForm({ name: '', description: '' }); setShowLineModal(true); }}>
                            + Add Line
                        </button>
                        {selectedLine && (
                            <button className="btn btn-primary" onClick={() => { setMachineForm({ name: '', worker_capacity: 1 }); setShowMachineModal(true); }}>
                                + Add Machine
                            </button>
                        )}
                        <button className="btn btn-ghost" onClick={exportAllLinesLayout} title="Export all lines as HTML">
                            📄 Export All (HTML)
                        </button>
                        <button className="btn btn-ghost" onClick={exportAllLinesCSV} title="Export all lines as CSV">
                            📊 Export All (CSV)
                        </button>
                    </div>
                </div>
            </div>

            <div className="responsive-grid responsive-grid-sidebar">
                {/* Lines sidebar */}
                <div className="card" style={{ padding: '12px' }}>
                    <h3 style={{ padding: '12px 12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Production Lines
                    </h3>
                    <div style={{ padding: '0 12px 12px' }}>
                        <div className="search-box" style={{ width: '100%', marginBottom: '8px' }}>
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                className="form-input input-sm"
                                style={{ height: '32px', fontSize: '12px' }}
                                placeholder="Search lines..."
                                value={lineSearch}
                                onChange={(e) => setLineSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', padding: '0 4px' }}>
                        {lines
                            .filter(l => l.name.toLowerCase().includes(lineSearch.toLowerCase()))
                            .map(line => (
                            <div
                                key={line.id}
                                onClick={() => selectLine(line.id)}
                                style={{
                                    padding: '14px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: selectedLine === line.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    borderLeft: selectedLine === line.id ? '3px solid var(--accent)' : '3px solid transparent',
                                    marginBottom: '4px',
                                    transition: 'var(--transition)',
                                    opacity: line.is_active ? 1 : 0.5,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                                        {line.is_active ? '' : '🔴 '}{line.name}
                                    </div>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ fontSize: '10px', padding: '2px 6px', color: line.is_active ? 'var(--warning)' : 'var(--success)' }}
                                        onClick={(e) => { e.stopPropagation(); toggleLineActive(line); }}
                                    >
                                        {line.is_active ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {line.machine_count} machines {!line.is_active && '— skipped in assignment'}
                                </div>
                            </div>
                        ))}
                    </div>
                    {lines.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No lines yet
                        </div>
                    )}
                </div>

                {/* Machines grid */}
                <div>
                    {selectedLine ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                                    {lines.find(l => l.id === selectedLine)?.name} — Machines
                                </h3>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => {
                                        const line = lines.find(l => l.id === selectedLine);
                                        setEditLine(line);
                                        setLineForm({ name: line.name, description: line.description || '' });
                                        setShowLineModal(true);
                                    }}>✏️ Edit Line</button>
                                    <button className="btn btn-ghost btn-sm" onClick={exportMachineLayout}>
                                        📄 Export Layout
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={exportToCSV}>
                                        📊 Export CSV
                                    </button>
                                    <button className="btn btn-info btn-sm" onClick={() => setShowBulkAssignModal(true)}>
                                        🎯 Bulk Assign Product
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => deleteLine(selectedLine)} style={{ color: 'var(--danger)' }}>
                                        🗑️ Delete Line
                                    </button>
                                </div>
                            </div>
                            <div className="machines-grid">
                                {machines.map(m => (
                                <div key={m.id} className="machine-card" style={{ opacity: m.is_active ? 1 : 0.5, border: m.is_active ? (m.worker_capacity > 1 ? '1px solid var(--accent)' : undefined) : '1px dashed var(--danger)' }}>
                                    <div className="machine-name">
                                        {m.is_active ? '' : '🔴 '}{m.name}
                                        {m.worker_capacity > 1 && <span style={{ marginLeft: '8px', fontSize: '10px', background: 'var(--accent)', color: 'white', padding: '1px 4px', borderRadius: '4px' }}>CAPACITY: {m.worker_capacity}</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Position #{m.position}
                                    </div>
                                    <div style={{ marginBottom: '10px' }}>
                                        <select 
                                            id={`machine-product-${m.id}`}
                                            name={`machine_product_${m.id}`}
                                            className="form-select select-sm" 
                                            style={{ fontSize: '12px', padding: '4px 8px', height: 'auto' }}
                                            value={m.current_product_id || ''}
                                            onChange={(e) => updateMachineProduct(m.id, e.target.value)}
                                            disabled={!m.is_active}
                                        >
                                            <option value="">No Product</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Capacity:</label>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="10"
                                                className="form-input" 
                                                style={{ padding: '2px 4px', height: '24px', fontSize: '11px', width: '45px' }}
                                                value={m.worker_capacity || 1}
                                                onChange={(e) => updateMachineCapacity(m.id, e.target.value)}
                                                disabled={!m.is_active}
                                            />
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ width: '100%', justifyContent: 'center', fontSize: '11px', color: m.is_active ? 'var(--warning)' : 'var(--success)' }}
                                            onClick={() => toggleMachineActive(m)}
                                        >
                                            {m.is_active ? '⏸ Deactivate' : '▶ Activate'}
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
                                            onClick={() => {
                                                setEditMachine(m);
                                                setEditMachineForm({ name: m.name });
                                                setShowEditMachineModal(true);
                                            }}
                                        >
                                            ✏️ Edit Name
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
                                            onClick={() => deleteMachine(m.id)}
                                        >
                                            🗑️ Remove
                                        </button>
                                    </div>
                                </div>
                                ))}
                            </div>
                            {machines.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🔧</div>
                                    <h3>No machines in this line</h3>
                                    <p>Add machines to start assigning workers</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">🏭</div>
                            <h3>Select a line</h3>
                            <p>Choose a production line to view its machines</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Line modal */}
            {showLineModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowLineModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editLine ? 'Edit Line' : 'Add New Line'}</h3>
                            <button className="modal-close" onClick={() => setShowLineModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleLineSubmit}>
                            <div className="form-group">
                                <label className="form-label">Line Name *</label>
                                <input
                                    id="line-name"
                                    name="line_name"
                                    className="form-input"
                                    required
                                    value={lineForm.name}
                                    onChange={e => setLineForm({ ...lineForm, name: e.target.value })}
                                    placeholder="e.g. Line D"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    id="line-description"
                                    name="line_description"
                                    className="form-textarea"
                                    value={lineForm.description}
                                    onChange={e => setLineForm({ ...lineForm, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowLineModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editLine ? 'Update' : 'Add Line'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Machine modal */}
            {showMachineModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowMachineModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Add Machine to {lines.find(l => l.id === selectedLine)?.name}</h3>
                            <button className="modal-close" onClick={() => setShowMachineModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleMachineSubmit}>
                            <div className="form-group">
                                <label className="form-label">Machine Name *</label>
                                <input
                                    id="machine-name"
                                    name="machine_name"
                                    className="form-input"
                                    required
                                    value={machineForm.name}
                                    onChange={e => setMachineForm({ ...machineForm, name: e.target.value })}
                                    placeholder="e.g. D-M1"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Worker Capacity (Number of workers)</label>
                                <input
                                    type="number"
                                    id="worker-capacity"
                                    name="worker_capacity"
                                    className="form-input"
                                    min="1"
                                    max="10"
                                    required
                                    value={machineForm.worker_capacity}
                                    onChange={e => setMachineForm({ ...machineForm, worker_capacity: parseInt(e.target.value) || 1 })}
                                />
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    How many workers can be assigned to this machine at once?
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowMachineModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Machine</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Machine modal */}
            {showEditMachineModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEditMachineModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Edit Machine Name</h3>
                            <button className="modal-close" onClick={() => setShowEditMachineModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleEditMachineSubmit}>
                            <div className="form-group">
                                <label className="form-label">Machine Name *</label>
                                <input
                                    id="edit-machine-name"
                                    name="edit_machine_name"
                                    className="form-input"
                                    required
                                    value={editMachineForm.name}
                                    onChange={e => setEditMachineForm({ ...editMachineForm, name: e.target.value })}
                                    placeholder="e.g. D-M1"
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowEditMachineModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Update Machine</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Assign Product Modal */}
            {showBulkAssignModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowBulkAssignModal(false)}>
                    <div className="modal" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3>🎯 Bulk Assign Product to Line</h3>
                            <button className="modal-close" onClick={() => setShowBulkAssignModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleBulkAssignProduct}>
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '15px' }}>
                                <p style={{ marginBottom: '8px' }}>Assigning to: <strong style={{ color: 'var(--text-primary)' }}>{lines.find(l => l.id === selectedLine)?.name}</strong></p>
                                <p style={{ fontSize: '13px' }}>This will assign the selected product to all machines in this line</p>
                            </div>
                            <div className="form-group" style={{ padding: '0 20px' }}>
                                <label className="form-label">Select Product *</label>
                                <select
                                    className="form-input"
                                    required
                                    value={bulkAssignForm.product_id}
                                    onChange={e => setBulkAssignForm({ product_id: e.target.value })}
                                >
                                    <option value="">-- Choose a product --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.sap_code ? `(${p.sap_code})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowBulkAssignModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={bulkAssigning}>
                                    {bulkAssigning ? '⏳ Assigning...' : '✓ Assign to All Machines'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

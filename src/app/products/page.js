'use client';

import { useState, useEffect } from 'react';

export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [form, setForm] = useState({ name: '', sap_code: '', description: '', hourly_target: '', target_12h: '' });
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { loadProducts(); }, []);

    async function loadProducts() {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (data.success) setProducts(data.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    function openModal(product = null) {
        setEditProduct(product);
        const hourly = product ? (product.hourly_target !== null && product.hourly_target !== undefined ? parseFloat(product.hourly_target) : '') : '';
        const target12 = hourly !== '' ? Math.round(hourly * 12) : '';
        setForm(product ? { 
            name: product.name, 
            sap_code: product.sap_code || '', 
            description: product.description || '', 
            hourly_target: hourly,
            target_12h: target12
        } : { 
            name: '', 
            sap_code: '', 
            description: '', 
            hourly_target: '',
            target_12h: ''
        });
        setShowModal(true);
    }

    const handleTarget12hChange = (val) => {
        const num = val ? parseFloat(val) : '';
        const hourly = num !== '' ? parseFloat((num / 12).toFixed(4)) : '';
        setForm(prev => ({
            ...prev,
            target_12h: val,
            hourly_target: hourly
        }));
    };

    const handleHourlyTargetChange = (val) => {
        const num = val ? parseFloat(val) : '';
        const target12 = num !== '' ? Math.round(num * 12) : '';
        setForm(prev => ({
            ...prev,
            hourly_target: val,
            target_12h: target12
        }));
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const method = editProduct ? 'PUT' : 'POST';
            const body = editProduct ? { ...form, id: editProduct.id } : form;
            const res = await fetch('/api/products', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                showToast(editProduct ? 'Product updated!' : 'Product added!', 'success');
                setShowModal(false);
                loadProducts();
            } else {
                showToast(data.error || 'Failed to save', 'error');
            }
        } catch (err) { showToast('Error saving product', 'error'); }
        finally { setSubmitting(false); }
    }

    async function deleteProduct(id) {
        if (!confirm('Delete this product? It will be removed from any assigned machines.')) return;
        try {
            const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                showToast('Product deleted', 'success');
                loadProducts();
            }
        } catch (err) { showToast('Failed to delete', 'error'); }
    }

    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast toast-${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    if (loading) return <div className="loading-overlay"><div className="loader"></div></div>;

    return (
        <>
            <div className="page-header">
                <div className="page-header-actions">
                    <div>
                        <h2>📦 Products</h2>
                        <p>Manage products assigned to machines for efficiency tracking</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="search-box">
                            <span className="search-icon">🔍</span>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Search product/SKU..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={() => openModal()}>+ Add Product</button>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">All Products</h3>
                    <span className="badge badge-info">{products.length} total</span>
                </div>
                {products.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="mobile-stack-table">
                            <thead>
                                <tr>
                                    <th>Product Name</th>
                                    <th>SKU</th>
                                    <th>12-Hour Target</th>
                                    <th>Hourly Target</th>
                                    <th>Description</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products
                                    .filter(p => !searchTerm ||
                                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (p.sap_code && p.sap_code.toLowerCase().includes(searchTerm.toLowerCase())))
                                    .map(p => (
                                    <tr key={p.id}>
                                        <td data-label="Product" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                                        <td data-label="SKU">
                                            {p.sap_code ? <span className="badge badge-info">{p.sap_code}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td data-label="12h Target">
                                            {p.hourly_target ? <strong>{Math.round(parseFloat(p.hourly_target) * 12)} / 12hr</strong> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td data-label="Hourly Target">
                                            {p.hourly_target ? <strong>{parseFloat(p.hourly_target)} / hr</strong> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td data-label="Description" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{p.description || '—'}</td>
                                        <td data-label="Actions">
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openModal(p)}>✏️ Edit</button>
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteProduct(p.id)}>🗑️ Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">📦</div>
                        <h3>No products yet</h3>
                        <p>Add products to start assigning them to machines</p>
                        <button className="btn btn-primary" onClick={() => openModal()}>+ Add First Product</button>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editProduct ? 'Edit Product' : 'Add New Product'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Product Name *</label>
                                <input
                                    id="product-name"
                                    name="product_name"
                                    className="form-input"
                                    required
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Product A"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">SKU / Code</label>
                                <input
                                    id="product-sku"
                                    name="product_sap_code"
                                    className="form-input"
                                    value={form.sap_code}
                                    onChange={e => setForm({ ...form, sap_code: e.target.value })}
                                    placeholder="e.g. SKU-001 (optional)"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    id="product-description"
                                    name="product_description"
                                    className="form-textarea"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">12-Hour Target</label>
                                    <input
                                        type="number"
                                        id="product-target-12h"
                                        name="target_12h"
                                        className="form-input"
                                        value={form.target_12h}
                                        onChange={e => handleTarget12hChange(e.target.value)}
                                        placeholder="Expected in 12 hours"
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Hourly Target</label>
                                    <input
                                        type="number"
                                        step="any"
                                        id="product-target-hourly"
                                        name="hourly_target"
                                        className="form-input"
                                        value={form.hourly_target}
                                        onChange={e => handleHourlyTargetChange(e.target.value)}
                                        placeholder="Hourly (calculated)"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? '⏳' : (editProduct ? 'Update Product' : 'Add Product')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

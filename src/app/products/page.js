'use client';

import { useState, useEffect } from 'react';

export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [form, setForm] = useState({ name: '', sku: '', description: '' });
    const [submitting, setSubmitting] = useState(false);

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
        setForm(product ? { name: product.name, sku: product.sku || '', description: product.description || '' } : { name: '', sku: '', description: '' });
        setShowModal(true);
    }

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
                    <button className="btn btn-primary" onClick={() => openModal()}>+ Add Product</button>
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
                                    <th>Description</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(p => (
                                    <tr key={p.id}>
                                        <td data-label="Product" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                                        <td data-label="SKU">
                                            {p.sku ? <span className="badge badge-info">{p.sku}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
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
                                    name="product_sku"
                                    className="form-input"
                                    value={form.sku}
                                    onChange={e => setForm({ ...form, sku: e.target.value })}
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

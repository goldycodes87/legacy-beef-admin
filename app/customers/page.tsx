'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface Session {
  id: string;
  customer_id: string;
  animal_id: string;
  purchase_type: string;
  status: string;
  deposit_paid: boolean;
  cut_sheet_complete: boolean;
  created_at: string;
  animals: { name: string; butcher_date: string; animal_type: string } | null;
}

interface CustomerLink {
  id: string;
  customer_id_a: string;
  customer_id_b: string;
  relationship: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  created_at: string;
  archived_at?: string | null;
  sessions: Session[];
  links?: CustomerLink[];
  has_active_sessions?: boolean;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [mergeModal, setMergeModal] = useState<{ customer: Customer } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeFieldChoices, setMergeFieldChoices] = useState<{
    name: 'source' | 'target';
    email: 'source' | 'target';
    phone: 'source' | 'target';
    address: 'source' | 'target';
  }>({ name: 'target', email: 'target', phone: 'target', address: 'target' });
  const [linkModal, setLinkModal] = useState<{ customerId: string; customerName: string } | null>(null);
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('');

  const loadCustomers = async () => {
    const res = await fetch('/api/admin/customers');
    const data = await res.json();
    setCustomers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleEditCustomer = (customer: any) => {
    setEditingCustomer(customer);
    setEditForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zip: customer.zip || '',
    });
  };

  const handleSaveCustomer = async () => {
    const res = await fetch(`/api/admin/customers/${editingCustomer.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      loadCustomers();
      setEditingCustomer(null);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const res = await fetch(`/api/admin/customers/${customerId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      loadCustomers();
      setDeleteConfirm(null);
    } else {
      const { error } = await res.json();
      alert(`Error: ${error}`);
    }
  };

  const handleArchive = async (customer: Customer) => {
    const isArchived = !!customer.archived_at;
    const res = await fetch(
      `/api/admin/customers/${customer.id}/archive`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !isArchived })
      }
    );
    if (res.ok) loadCustomers();
    else alert('Archive action failed');
  };

  const handleMergeCustomers = async () => {
    if (!mergeModal || !mergeTargetId) return;
    const source = mergeModal.customer;
    const target = customers.find(c => c.id === mergeTargetId);
    if (!target) return;
    const mergedData = {
      name: mergeFieldChoices.name === 'source' ? source.name : target.name,
      email: mergeFieldChoices.email === 'source' ? source.email : target.email,
      phone: mergeFieldChoices.phone === 'source' ? source.phone : target.phone,
      address: mergeFieldChoices.address === 'source' ? source.address : target.address,
      city: mergeFieldChoices.address === 'source' ? source.city : target.city,
      state: mergeFieldChoices.address === 'source' ? source.state : target.state,
      zip: mergeFieldChoices.address === 'source' ? source.zip : target.zip,
    };
    const res = await fetch('/api/admin/customers/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: source.id,
        target_id: mergeTargetId,
        merged_data: mergedData,
      }),
    });
    if (res.ok) {
      setMergeModal(null);
      setMergeTargetId('');
      loadCustomers();
    } else {
      const d = await res.json();
      alert(d.error || 'Merge failed');
    }
  };

  const handleLinkCustomers = async () => {
    if (!linkModal || !linkTargetId || !linkRelationship) return;
    const res = await fetch('/api/admin/customers/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id_a: linkModal.customerId,
        customer_id_b: linkTargetId,
        relationship: linkRelationship,
      }),
    });
    if (res.ok) {
      loadCustomers();
      setLinkModal(null);
      setLinkTargetId('');
      setLinkRelationship('');
    } else {
      const { error } = await res.json();
      alert(`Error: ${error}`);
    }
  };

  const filtered = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchesFilter = filter === 'all' ? true :
      filter === 'archived' ? !!c.archived_at :
      !c.archived_at;
    return matchesSearch && matchesFilter;
  });

  const getActiveSessions = (c: Customer) =>
    c.sessions?.filter(
      s => s.status !== 'cancelled' && !(s.status === 'draft' && !s.deposit_paid)
    ) || [];

  const hasActiveSessions = (c: Customer) =>
    getActiveSessions(c).length > 0;

  const getLinkedCustomers = (customer: Customer) => {
    if (!customer.links) return [];
    return customer.links.map(link => {
      const otherCustomerId = link.customer_id_a === customer.id ? link.customer_id_b : link.customer_id_a;
      const linkedCustomer = customers.find(c => c.id === otherCustomerId);
      return {
        name: linkedCustomer?.name || 'Unknown',
        relationship: link.relationship,
      };
    });
  };

  const lastOrder = (c: Customer) => {
    const active = getActiveSessions(c);
    if (active.length === 0) return '—';
    const latest = active[0];
    return new Date(latest.created_at).toLocaleDateString();
  };

  if (loading) {
    return <AdminLayout title="Customers"><div>Loading...</div></AdminLayout>;
  }

  return (
    <AdminLayout title="Customers">
      <div className="space-y-6">
        <div className="flex gap-2 mb-4">
          {(['active', 'archived', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors ${filter === f
                ? 'bg-brand-dark text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'active' ? 'Active' : f === 'archived' ? 'Archived' : 'All'}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">{customers.length} customers total</p>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg w-80"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No customers yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">City/State</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Orders</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Last Order</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(c => (
                  <>
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          {getLinkedCustomers(c).length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {getLinkedCustomers(c).map((link, idx) => (
                                <p key={idx} className="text-xs text-gray-500">
                                  🔗 {link.name} ({link.relationship})
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.phone}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.city}, {c.state}</td>
                      <td className="px-6 py-4 text-sm font-medium">{getActiveSessions(c).length}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{lastOrder(c)}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() =>
                              setExpandedCustomer(expandedCustomer === c.id ? null : c.id)
                            }
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {expandedCustomer === c.id ? 'Hide' : 'View'}
                          </button>
                          <button
                            onClick={() => handleEditCustomer(c)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchive(c)}
                            className={`text-sm font-semibold ${
                              c.archived_at ? 'text-green-600 hover:text-green-800' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {c.archived_at ? 'Unarchive' : 'Archive'}
                          </button>
                          <button
                            onClick={() => {
                              setMergeModal({ customer: c });
                              setMergeTargetId('');
                              setMergeFieldChoices({ name: 'target', email: 'target', phone: 'target', address: 'target' });
                            }}
                            className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                          >
                            Merge
                          </button>
                          <button
                            onClick={() => setLinkModal({ customerId: c.id, customerName: c.name })}
                            className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                          >
                            Link
                          </button>
                          {!c.has_active_sessions && (
                            <button
                              onClick={() => setDeleteConfirm(c.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedCustomer === c.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <p className="font-semibold text-gray-900">Sessions:</p>
                            {getActiveSessions(c).map(s => (
                              <div
                                key={s.id}
                                className="bg-white border border-gray-200 rounded p-3 text-sm"
                              >
                                <p className="font-medium">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
                                    {s.purchase_type}
                                  </span>
                                  <span className="font-medium">
                                    {s.animals?.name || 'Unknown'}
                                  </span>
                                  <span className="text-gray-500 text-xs ml-1">
                                    • Butcher {s.animals?.butcher_date
                                      ? new Date(s.animals.butcher_date + 'T00:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})
                                      : 'TBD'}
                                  </span>
                                </p>
                                <p className="text-gray-600 mt-1">
                                  Status:{' '}
                                  <span className="font-semibold capitalize">{s.status}</span>
                                </p>
                                <p className="text-gray-600">
                                  Deposit:{' '}
                                  {s.deposit_paid ? (
                                    <span className="text-green-600 font-semibold">✓ Deposit Paid</span>
                                  ) : (
                                    <span className="text-red-500 font-semibold">✗ Deposit Pending</span>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Edit Customer</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Zip</label>
                  <input
                    type="text"
                    value={editForm.zip}
                    onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditingCustomer(null)}
                className="flex-1 px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomer}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-red-600">Delete Customer</h2>
            <p className="text-gray-700 mb-6">
              Delete <strong>{customers.find(c => c.id === deleteConfirm)?.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCustomer(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {mergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl my-4">
            <h2 className="text-xl font-bold mb-1">Merge Customers</h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose which information to keep. All sessions from <strong> {mergeModal.customer.name}</strong> will move to the target customer.
            </p>

            {/* Target selector */}
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-1">
                Merge into:
              </label>
              <select
                value={mergeTargetId}
                onChange={e => setMergeTargetId(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="">Select target customer...</option>
                {customers
                  .filter(c => c.id !== mergeModal.customer.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.email}
                    </option>
                  ))}
              </select>
            </div>

            {/* Field chooser — only show when target selected */}
            {mergeTargetId && (() => {
              const target = customers.find(c => c.id === mergeTargetId);
              if (!target) return null;
              const source = mergeModal.customer;
              const fields: { key: keyof typeof mergeFieldChoices; label: string; srcVal: string; tgtVal: string }[] = [
                { key: 'name', label: 'Name', srcVal: source.name, tgtVal: target.name },
                { key: 'email', label: 'Email', srcVal: source.email, tgtVal: target.email },
                { key: 'phone', label: 'Phone', srcVal: source.phone || '—', tgtVal: target.phone || '—' },
                { key: 'address', label: 'Address', srcVal: `${source.address || ''} ${source.city || ''} ${source.state || ''}`.trim() || '—', tgtVal: `${target.address || ''} ${target.city || ''} ${target.state || ''}`.trim() || '—' },
              ];
              return (
                <div className="border rounded-xl overflow-hidden mb-5">
                  <div className="grid grid-cols-3 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">
                    <div>Field</div>
                    <div className="text-center">
                      {source.name} (source)
                    </div>
                    <div className="text-center">
                      {target.name} (target)
                    </div>
                  </div>
                  {fields.map(f => (
                    <div key={f.key} className="grid grid-cols-3 px-4 py-3 border-t items-center text-sm">
                      <div className="font-semibold text-gray-700">
                        {f.label}
                      </div>
                      <div
                        onClick={() => setMergeFieldChoices(prev => ({ ...prev, [f.key]: 'source' }))}
                        className={`text-center cursor-pointer rounded-lg py-1.5 mx-2 transition-colors ${
                          mergeFieldChoices[f.key] === 'source'
                            ? 'bg-brand-orange text-white font-semibold'
                            : 'hover:bg-orange-50 text-gray-600'
                        }`}
                      >
                        {f.srcVal}
                      </div>
                      <div
                        onClick={() => setMergeFieldChoices(prev => ({ ...prev, [f.key]: 'target' }))}
                        className={`text-center cursor-pointer rounded-lg py-1.5 mx-2 transition-colors ${
                          mergeFieldChoices[f.key] === 'target'
                            ? 'bg-brand-orange text-white font-semibold'
                            : 'hover:bg-orange-50 text-gray-600'
                        }`}
                      >
                        {f.tgtVal}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <p className="text-xs text-red-500 mb-4">
              ⚠️ {mergeModal.customer.name} will be permanently deleted after merge.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMergeModal(null)}
                className="flex-1 py-2.5 border rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeCustomers}
                disabled={!mergeTargetId}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Merge Customers
              </button>
            </div>
          </div>
        </div>
      )}

      {linkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-2">Link {linkModal.customerName} to related customer</h2>
            <p className="text-sm text-gray-600 mb-4">
              Link family members, friends, or frequent group buyers together for easy reference.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Select customer to link</label>
                <select
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">— Choose a customer —</option>
                  {customers
                    .filter(c => c.id !== linkModal.customerId)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Relationship label</label>
                <input
                  type="text"
                  placeholder="e.g., Spouse, Friend, Business Partner"
                  value={linkRelationship}
                  onChange={(e) => setLinkRelationship(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setLinkModal(null);
                  setLinkTargetId('');
                  setLinkRelationship('');
                }}
                className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkCustomers}
                disabled={!linkTargetId || !linkRelationship}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Link Customers
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

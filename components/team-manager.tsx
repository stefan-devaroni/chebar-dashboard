'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, X, Pencil, Trash2, UserCircle } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'employee';
  department: 'foh' | 'kitchen';
  color: string;
  active: boolean;
}

const DEPT_COLORS: Record<string, string> = {
  foh: '#4f8cff',
  kitchen: '#e6884b',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  employee: 'Employee',
};

const DEPT_LABELS: Record<string, string> = {
  foh: 'Front of House',
  kitchen: 'Kitchen',
};

export function TeamManager({ initialMembers }: { initialMembers: TeamMember[] }) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState<'owner' | 'manager' | 'employee'>('employee');
  const [department, setDepartment] = useState<'foh' | 'kitchen'>('foh');

  function openNew() {
    setEditing(null);
    setName('');
    setRole('employee');
    setDepartment('foh');
    setShowForm(true);
  }

  function openEdit(m: TeamMember) {
    setEditing(m);
    setName(m.name);
    setRole(m.role);
    setDepartment(m.department || 'foh');
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      if (editing) {
        const res = await fetch('/api/team', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, name: name.trim(), role, department, color: DEPT_COLORS[department], active: editing.active }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to update. Make sure the database tables are created.');
          setSaving(false);
          return;
        }
        setMembers((prev) => prev.map((m) => (m.id === data.id ? data : m)));
      } else {
        const res = await fetch('/api/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), role, department, color: DEPT_COLORS[department] }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to add. Make sure the database tables are created.');
          setSaving(false);
          return;
        }
        setMembers((prev) => [...prev, data]);
      }
      setShowForm(false);
    } catch {
      setError('Network error. Try again.');
    }

    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this team member? Their shifts will also be deleted.')) return;
    const res = await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-neutral-600">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-gold text-ink px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-gold/80 transition"
        >
          <Plus size={14} strokeWidth={2} />
          Add member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <UserCircle size={40} className="mx-auto mb-3 text-neutral-300" strokeWidth={1} />
          <p className="text-sm text-neutral-500">No team members yet. Add your first employee above.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded divide-y divide-neutral-100">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-4 group">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                style={{ backgroundColor: DEPT_COLORS[m.department] || DEPT_COLORS.foh }}
              >
                {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-neutral-500">{ROLE_LABELS[m.role]} · {DEPT_LABELS[m.department] || 'Front of House'}</p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => openEdit(m)}
                  className="p-1.5 text-neutral-400 hover:text-ink transition rounded"
                >
                  <Pencil size={14} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 transition rounded"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-cream border border-neutral-200 rounded-lg w-full max-w-md p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl">{editing ? 'Edit' : 'Add'} team member</h2>
              <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-ink transition">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  placeholder="e.g. Maria"
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
                  >
                    <option value="foh">Front of House</option>
                    <option value="kitchen">Kitchen</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Color</label>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: DEPT_COLORS[department] }} />
                  <span className="text-xs text-neutral-500">Auto-assigned by department</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex-1 bg-ink text-cream py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add member'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 border border-neutral-300 rounded text-xs uppercase tracking-widest hover:bg-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

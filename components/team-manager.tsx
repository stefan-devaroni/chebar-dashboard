'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, X, UserCircle, ChevronRight } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'employee';
  department: 'foh' | 'kitchen';
  color: string;
  active: boolean;
  email?: string | null;
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

// Display order of the groups on the Team tab
const DEPARTMENTS = ['foh', 'kitchen'] as const;

// Older rows may have no department; they count as Front of House
function deptOf(m: TeamMember): 'foh' | 'kitchen' {
  return m.department === 'kitchen' ? 'kitchen' : 'foh';
}

export function TeamManager({ initialMembers }: { initialMembers: TeamMember[] }) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState<'owner' | 'manager' | 'employee'>('employee');
  const [department, setDepartment] = useState<'foh' | 'kitchen'>('foh');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function openNew() {
    setEditing(null);
    setName('');
    setRole('employee');
    setDepartment('foh');
    setEmail('');
    setPassword('');
    setShowForm(true);
  }

  function openEdit(m: TeamMember) {
    setEditing(m);
    setName(m.name);
    setRole(m.role);
    setDepartment(m.department || 'foh');
    setEmail(m.email ?? '');
    setPassword('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (password && !email.trim()) {
      setError('Add a login email to set a password.');
      return;
    }
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    let savedId: string | null = editing?.id ?? null;

    try {
      if (editing) {
        const res = await fetch('/api/team', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, name: name.trim(), role, department, color: DEPT_COLORS[department], active: editing.active, email: email.trim() || null }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to update. Make sure the database tables are created.');
          setSaving(false);
          return;
        }
        setMembers((prev) => prev.map((m) => (m.id === data.id ? data : m)));
        savedId = data.id;
      } else {
        const res = await fetch('/api/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), role, department, color: DEPT_COLORS[department], email: email.trim() || null }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to add. Make sure the database tables are created.');
          setSaving(false);
          return;
        }
        setMembers((prev) => [...prev, data]);
        savedId = data.id;
      }

      if (password) {
        const res = await fetch('/api/team/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: savedId, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(`Saved, but the password was not set: ${data.error || 'unknown error'}`);
          setSaving(false);
          return;
        }
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
      setShowForm(false);
    }
  }

  const inputClass = 'w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold';
  const labelClass = 'block text-xs uppercase tracking-wider text-neutral-500 mb-1.5';
  const choiceClass = (on: boolean) =>
    cn('py-3 rounded-xl text-sm font-medium transition', on ? 'bg-ink text-cream' : 'bg-white border border-neutral-200 text-neutral-600');

  return (
    <div className="max-w-2xl">
      <button
        onClick={openNew}
        className="w-full flex items-center justify-center gap-2 bg-gold text-ink py-3 rounded-xl text-sm font-medium mb-4"
      >
        <Plus size={16} strokeWidth={2} />
        Add team member
      </button>

      {members.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
          <UserCircle size={40} className="mx-auto mb-3 text-neutral-300" strokeWidth={1} />
          <p className="text-sm text-neutral-500">No team members yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {DEPARTMENTS.map((dept) => {
            const people = members.filter((m) => deptOf(m) === dept).sort((a, b) => a.name.localeCompare(b.name));
            return (
              <section key={dept}>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500 font-medium">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DEPT_COLORS[dept] }} />
                    {DEPT_LABELS[dept]}
                  </h2>
                  <span className="text-xs text-neutral-400">
                    {people.length} {people.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
                {people.length === 0 ? (
                  <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4 text-sm text-neutral-400">
                    No one here yet.
                  </div>
                ) : (
                  <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
                    {people.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => openEdit(m)}
                        className="w-full flex items-center gap-3 px-4 py-3 min-h-[64px] text-left hover:bg-neutral-50 active:bg-neutral-50 transition"
                      >
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                          style={{ backgroundColor: DEPT_COLORS[dept] }}
                        >
                          {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-medium truncate">{m.name}</span>
                          <span className="block text-xs text-neutral-500 truncate">
                            {ROLE_LABELS[m.role]}{m.email ? ` · ${m.email}` : ''}
                          </span>
                        </span>
                        <ChevronRight size={16} className="text-neutral-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 sm:px-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-cream w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl">{editing ? 'Edit team member' : 'New team member'}</h2>
              <button onClick={() => setShowForm(false)} aria-label="Close" className="w-10 h-10 -mr-2 flex items-center justify-center text-neutral-400 hover:text-ink">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Works in</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDepartment('foh')} className={choiceClass(department === 'foh')}>Front of House</button>
                  <button type="button" onClick={() => setDepartment('kitchen')} className={choiceClass(department === 'kitchen')}>Kitchen</button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Access</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['employee', 'manager', 'owner'] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setRole(r)} className={choiceClass(role === r)}>{ROLE_LABELS[r]}</button>
                  ))}
                </div>
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  {role === 'employee' ? 'Sees the schedule and checks in deliveries.' : 'Sees and manages everything.'}
                </p>
              </div>

              <div>
                <label className={labelClass}>Login email (optional)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. maria@gmail.com" className={inputClass} />
              </div>

              {email.trim() && (
                <div>
                  <label className={labelClass}>{editing?.email ? 'New password (optional)' : 'Password'}</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    placeholder="At least 8 characters"
                    className={inputClass}
                  />
                  <p className="text-[11px] text-neutral-500 mt-1.5">
                    They log in with their email and this password. Tell them in person.{editing?.email ? ' Leave empty to keep the current one.' : ''}
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-800">{error}</div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save' : 'Add team member'}
              </button>
              {editing && (
                <button onClick={() => handleDelete(editing.id)} className="w-full py-3 text-sm text-red-600">
                  Remove from team
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

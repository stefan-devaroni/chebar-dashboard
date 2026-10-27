// Who may open which part of the dashboard (Oct 2026). Pure rules, shared by the middleware (edge)
// and server code. Each team member has a role (owner / manager / employee) and, optionally, an
// explicit list of permissions in team_members.access, set per person on the Team tab by an owner.
// No list means the role's default. Owners (and ALLOWED_EMAILS) always have everything.

export const PERMISSIONS = [
  'today',
  'checklists',
  'checklists.edit',
  'purchasing',
  'deliveries',
  'schedule',
  'schedule.edit',
  'team',
  'reservations',
  'reservations.settings',
  'menu',
  'menu.edit',
  'handbook',
  'handbook.edit',
  'applicants',
  'tasks',
  'sales',
  'marketing',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** What staff had before per-person access: checklists, deliveries, schedule, bookings, read menu + handbook */
export const STAFF_DEFAULT: Permission[] = ['checklists', 'deliveries', 'schedule', 'reservations', 'menu', 'handbook'];
export const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

export type TeamRole = 'owner' | 'manager' | 'employee';

export function isPermission(p: unknown): p is Permission {
  return typeof p === 'string' && (PERMISSIONS as readonly string[]).includes(p);
}

/** The permissions a team member's role starts with */
export function roleDefault(role: TeamRole): Permission[] {
  return role === 'employee' ? STAFF_DEFAULT : ALL_PERMISSIONS;
}

/** Edit includes view; purchasing includes checking in deliveries */
export function withImplied(perms: Iterable<string>): Permission[] {
  const set = new Set<Permission>();
  for (const p of perms) {
    if (!isPermission(p)) continue;
    set.add(p);
    if (p.endsWith('.edit') || p === 'reservations.settings') set.add(p.split('.')[0] as Permission);
    if (p === 'purchasing') set.add('deliveries');
  }
  return PERMISSIONS.filter((p) => set.has(p));
}

/**
 * The permissions of a login. allowlisted = the email is in ALLOWED_EMAILS. Returns null when the
 * person may not use the dashboard at all.
 */
export function resolvePermissions(
  allowlisted: boolean,
  member: { role: string; active: boolean | null; access?: string[] | null } | null
): { perms: Permission[]; owner: boolean } | null {
  if (allowlisted) return { perms: ALL_PERMISSIONS, owner: true };
  if (!member || member.active === false) return null;
  const role: TeamRole = member.role === 'owner' ? 'owner' : member.role === 'manager' ? 'manager' : 'employee';
  if (role === 'owner') return { perms: ALL_PERMISSIONS, owner: true };
  const perms = withImplied(Array.isArray(member.access) ? member.access : roleDefault(role));
  return perms.length ? { perms, owner: false } : null;
}

const has = (perms: readonly string[], any: Permission[]) => any.some((p) => perms.includes(p));
const hasAll = (perms: readonly string[]) => PERMISSIONS.every((p) => perms.includes(p));

// Pages: the first matching prefix wins, so longer prefixes come first
const PAGES: [prefix: string, any: Permission[]][] = [
  ['/dashboard/purchasing', ['purchasing']],
  ['/dashboard/orders', ['purchasing', 'deliveries']],
  ['/dashboard/checklists', ['checklists']],
  ['/dashboard/schedule', ['schedule']],
  ['/dashboard/team', ['team']],
  ['/dashboard/reservations', ['reservations']],
  ['/dashboard/menu', ['menu']],
  ['/dashboard/handbook', ['handbook']],
  ['/dashboard/applicants', ['applicants']],
  ['/dashboard/tasks', ['tasks']],
  ['/dashboard/sales', ['sales']],
  ['/dashboard/metrics', ['sales']],
  ['/dashboard/reports', ['sales']],
  ['/dashboard/music', ['sales']],
  ['/dashboard/marketing', ['marketing']],
  ['/dashboard/reviews', ['marketing']],
];

/** Nav order, used to pick where someone lands when a page isn't theirs */
const LANDING: [path: string, any: Permission[]][] = [
  ['/dashboard', ['today']],
  ['/dashboard/checklists', ['checklists']],
  ['/dashboard/purchasing', ['purchasing']],
  ['/dashboard/schedule', ['schedule']],
  ['/dashboard/reservations', ['reservations']],
  ['/dashboard/menu', ['menu']],
  ['/dashboard/orders', ['deliveries']],
  ['/dashboard/handbook', ['handbook']],
  ['/dashboard/applicants', ['applicants']],
  ['/dashboard/tasks', ['tasks']],
  ['/dashboard/sales', ['sales']],
  ['/dashboard/marketing', ['marketing']],
  ['/dashboard/team', ['team']],
];

const READS = ['GET', 'HEAD'];

// APIs: `read` applies to readMethods (GET by default), `write` to every other method
type ApiRule = { prefix: string; read: Permission[]; write: Permission[]; readMethods?: string[] };
const APIS: ApiRule[] = [
  { prefix: '/api/applications', read: ['applicants'], write: ['applicants'] },
  { prefix: '/api/notifications', read: ['applicants'], write: ['applicants'] },
  { prefix: '/api/checklists/check', read: ['checklists'], write: ['checklists'] },
  { prefix: '/api/checklists/items', read: ['checklists.edit'], write: ['checklists.edit'] },
  { prefix: '/api/checklists', read: ['checklists'], write: ['checklists.edit'] },
  { prefix: '/api/handbook', read: ['handbook'], write: ['handbook.edit'] },
  { prefix: '/api/menu/photo', read: ['menu.edit'], write: ['menu.edit'] },
  { prefix: '/api/menu', read: ['menu'], write: ['menu.edit'] },
  { prefix: '/api/orders/receive', read: ['purchasing', 'deliveries'], write: ['purchasing', 'deliveries'] },
  { prefix: '/api/orders/po', read: ['purchasing'], write: ['purchasing'] },
  { prefix: '/api/orders', read: ['purchasing', 'deliveries'], write: ['purchasing'] },
  { prefix: '/api/inventory', read: ['purchasing'], write: ['purchasing'] },
  { prefix: '/api/suppliers', read: ['purchasing'], write: ['purchasing'] },
  { prefix: '/api/reservations/settings', read: ['reservations'], write: ['reservations.settings'] },
  // Staff see, add and change bookings; deleting one is for those with the settings
  { prefix: '/api/reservations', read: ['reservations'], write: ['reservations.settings'], readMethods: ['GET', 'HEAD', 'POST', 'PUT'] },
  { prefix: '/api/shifts', read: ['schedule'], write: ['schedule.edit'] },
  { prefix: '/api/time-off', read: ['schedule'], write: ['schedule.edit'], readMethods: ['GET', 'HEAD', 'POST'] },
  { prefix: '/api/team/login', read: ['team'], write: ['team'] },
  // Reading names is part of the schedule; adding someone from the schedule is part of editing it
  { prefix: '/api/team', read: ['schedule', 'team'], write: ['team', 'schedule.edit'] },
  { prefix: '/api/sales', read: ['sales'], write: ['sales'] },
  { prefix: '/api/reports', read: ['sales'], write: ['sales'] },
  { prefix: '/api/analyze-report', read: ['sales'], write: ['sales'] },
  { prefix: '/api/chat', read: ['sales'], write: ['sales'] },
  { prefix: '/api/marketing', read: ['marketing'], write: ['marketing'] },
  { prefix: '/api/reviews', read: ['marketing'], write: ['marketing'] },
];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

// The business summary for prospective buyers (Oct 2026) is for owners only: a manager who may
// open everything else still can't open these
const OWNER_ONLY = ['/dashboard/one-pager', '/api/one-pager'];

/** Is this page or API for owners only, whatever else someone may open? */
export function ownerOnly(pathname: string): boolean {
  return OWNER_ONLY.some((prefix) => under(pathname, prefix));
}

/** May these permissions open this dashboard page? Unknown pages are for full access only. */
export function canOpenPage(perms: readonly string[], pathname: string): boolean {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return has(perms, ['today']);
  const rule = PAGES.find(([prefix]) => under(pathname, prefix));
  return rule ? has(perms, rule[1]) : hasAll(perms);
}

/** May these permissions call this API? Unknown APIs are for full access only. */
export function canCallApi(perms: readonly string[], pathname: string, method: string): boolean {
  const rule = APIS.find((r) => under(pathname, r.prefix));
  if (!rule) return hasAll(perms);
  const readMethods = rule.readMethods ?? READS;
  return has(perms, readMethods.includes(method.toUpperCase()) ? rule.read : rule.write);
}

/** The first page in nav order this person may open (null: none) */
export function landingPage(perms: readonly string[]): string | null {
  return LANDING.find(([, any]) => has(perms, any))?.[0] ?? null;
}

export function can(perms: readonly string[] | undefined | null, perm: Permission): boolean {
  return !!perms?.includes(perm);
}

export const NO_ACCESS = "Your login doesn't have access to this";

type MemberAccess = { role: string; active?: boolean | null; access?: string[] | null };

/** Everything this member can open, ignoring whether they're active */
export function memberPermissions(member: MemberAccess): Permission[] {
  return resolvePermissions(false, { role: member.role, active: true, access: member.access })?.perms ?? [];
}

/**
 * May this login edit, remove or set a password for this member? Owners may for everyone. Others
 * (with Team access) only for staff who can't open anything they can't open themselves, so nobody
 * can give themselves more access through someone else's login.
 */
export function canManageMember(viewer: { perms: readonly string[]; owner: boolean }, member: MemberAccess): boolean {
  if (viewer.owner) return true;
  if (member.role !== 'employee') return false;
  return memberPermissions(member).every((p) => viewer.perms.includes(p));
}

// ── The Team tab's access editor ──────────────────────────────────────────────────────────────────

/** One row per part of the dashboard, in nav order. `edit` adds a View / Edit choice. */
export const SECTIONS: { key: Permission; edit?: Permission; label: string; hint: string }[] = [
  { key: 'today', label: 'Today', hint: 'The day at a glance: bookings, orders, who is working' },
  { key: 'checklists', edit: 'checklists.edit', label: 'Checklists', hint: 'View: see and tick off. Edit: change the lists' },
  { key: 'purchasing', label: 'Purchasing', hint: 'Orders, stock, suppliers and purchase orders' },
  { key: 'deliveries', label: 'Deliveries', hint: 'Check in what arrived' },
  { key: 'schedule', edit: 'schedule.edit', label: 'Schedule', hint: 'Edit: make the schedule, approve time off' },
  { key: 'team', label: 'Team', hint: 'Add staff and set their passwords' },
  { key: 'reservations', edit: 'reservations.settings', label: 'Reservations', hint: 'View: see, add and change bookings. Edit: also the settings' },
  { key: 'menu', edit: 'menu.edit', label: 'Menu & Recipes', hint: 'Edit: add and change dishes' },
  { key: 'handbook', edit: 'handbook.edit', label: 'Handbook', hint: 'Edit: write and change it' },
  { key: 'applicants', label: 'Applicants', hint: 'Job applications, and the alerts bell' },
  { key: 'tasks', label: 'Tasks', hint: 'The task list' },
  { key: 'sales', label: 'Sales', hint: 'Sales, products sold and reports' },
  { key: 'marketing', label: 'Marketing', hint: 'Facebook and Instagram numbers' },
];
export type Section = (typeof SECTIONS)[number];

/** 0 = off, 1 = view (or on), 2 = edit */
export function sectionLevel(perms: readonly string[], s: Section): 0 | 1 | 2 {
  return s.edit && perms.includes(s.edit) ? 2 : perms.includes(s.key) ? 1 : 0;
}

export function setSectionLevel(perms: readonly string[], s: Section, level: 0 | 1 | 2): Permission[] {
  const rest = perms.filter((p) => p !== s.key && p !== s.edit);
  if (level >= 1) rest.push(s.key);
  if (level === 2 && s.edit) rest.push(s.edit);
  return withImplied(rest);
}

export function sameAccess(a: readonly string[], b: readonly string[]): boolean {
  const x = withImplied(a);
  const y = withImplied(b);
  return x.length === y.length && x.every((p) => y.includes(p));
}

/** Ready-made sets on the Team tab */
export const PRESETS: { label: string; perms: Permission[] }[] = [
  { label: 'Staff', perms: STAFF_DEFAULT },
  { label: 'Staff + Purchasing', perms: withImplied([...STAFF_DEFAULT, 'purchasing']) },
  { label: 'Everything', perms: ALL_PERMISSIONS },
];

/** How someone's access differs from their role's default, e.g. "+ Purchasing" or "no Sales, Marketing" */
export function accessNote(member: MemberAccess): string | null {
  if (member.role === 'owner' || !Array.isArray(member.access)) return null;
  const mine = memberPermissions(member);
  const base = roleDefault(member.role === 'manager' ? 'manager' : 'employee');
  const added = SECTIONS.filter((s) => sectionLevel(mine, s) > sectionLevel(base, s));
  const removed = SECTIONS.filter((s) => sectionLevel(mine, s) < sectionLevel(base, s));
  if (added.length + removed.length === 0) return null;
  if (added.length + removed.length > 3) return 'Custom access';
  // A change between View and Edit names the edit part: "+ Menu & Recipes edit", "no Handbook edit"
  const name = (s: Section) => (sectionLevel(mine, s) && sectionLevel(base, s) ? `${s.label} edit` : s.label);
  const parts: string[] = [];
  if (added.length) parts.push(`+ ${added.map(name).join(', ')}`);
  if (removed.length) parts.push(`no ${removed.map(name).join(', ')}`);
  return parts.join(' · ');
}

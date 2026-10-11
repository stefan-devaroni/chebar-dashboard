// Pure role resolution — shared by middleware (edge) and server code.

export type DashRole = 'manager' | 'employee';

export function parseManagerEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// member: the team_members row whose email matches the login (null if none,
// or if the email column hasn't been migrated yet).
export function resolveRole(
  email: string,
  managerEmails: string[],
  member: { role: string; active: boolean | null } | null
): DashRole | null {
  if (managerEmails.includes(email.toLowerCase())) return 'manager';
  if (!member || member.active === false) return null;
  return member.role === 'owner' || member.role === 'manager' ? 'manager' : 'employee';
}

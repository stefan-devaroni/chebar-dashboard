// Shared by middleware (edge) and server code. What each login may open: lib/permissions.ts.

// ALLOWED_EMAILS: owner logins that always have full access, even without a team_members row
export function parseManagerEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

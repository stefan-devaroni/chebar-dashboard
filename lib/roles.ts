import { createClient } from '@/lib/supabase/server';
import { createSessionClient } from '@/lib/supabase/session';
import { parseManagerEmails } from '@/lib/role-logic';
import { can, resolvePermissions, type Permission } from '@/lib/permissions';

export interface SessionInfo {
  email: string;
  // What this login may open and change (lib/permissions.ts)
  perms: Permission[];
  // Owners (and ALLOWED_EMAILS) can open everything and decide who sees what
  owner: boolean;
  // team_members row linked to this login, if any (staff always have one)
  memberId: string | null;
  memberName: string | null;
}

export async function getSessionForEmail(email: string): Promise<SessionInfo | null> {
  const normalized = email.toLowerCase();
  const supabase = createClient(); // service role — read-only lookup
  const { data: member } = await supabase
    .from('team_members')
    .select('id, name, role, active, access')
    .eq('email', normalized)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  const access = resolvePermissions(parseManagerEmails(process.env.ALLOWED_EMAILS).includes(normalized), member);
  if (!access) return null;

  return {
    email: normalized,
    ...access,
    memberId: member?.id ?? null,
    memberName: member?.name ?? null,
  };
}

// For server components / API routes: who is making this request?
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const supabase = createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return getSessionForEmail(user.email);
}

// For API routes: the session if it has this permission, else null (answer 403 with NO_ACCESS)
export async function sessionWith(perm: Permission): Promise<SessionInfo | null> {
  const session = await getSessionInfo().catch(() => null);
  return session && can(session.perms, perm) ? session : null;
}

// The screens take a role: 'manager' shows their edit tools, for those with that edit permission
export function screenRole(session: SessionInfo | null, edit: Permission): 'manager' | 'employee' {
  return can(session?.perms, edit) ? 'manager' : 'employee';
}

import { createClient } from '@/lib/supabase/server';
import { createSessionClient } from '@/lib/supabase/session';
import { parseManagerEmails, resolveRole, type DashRole } from '@/lib/role-logic';

export type { DashRole };

export interface SessionInfo {
  email: string;
  role: DashRole;
  // team_members row linked to this login, if any (employees always have one)
  memberId: string | null;
  memberName: string | null;
}

export async function getRoleForEmail(email: string): Promise<SessionInfo | null> {
  const normalized = email.toLowerCase();
  const supabase = createClient(); // service role — read-only lookup
  const { data: member } = await supabase
    .from('team_members')
    .select('id, name, role, active')
    .eq('email', normalized)
    .maybeSingle();

  const role = resolveRole(normalized, parseManagerEmails(process.env.ALLOWED_EMAILS), member);
  if (!role) return null;

  return {
    email: normalized,
    role,
    memberId: member?.id ?? null,
    memberName: member?.name ?? null,
  };
}

// For server components / API routes: who is making this request?
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const supabase = createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return getRoleForEmail(user.email);
}

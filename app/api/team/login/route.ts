import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { parseManagerEmails } from '@/lib/role-logic';

// Set or reset a team member's dashboard password, so staff can log in
// without sign-in emails (Supabase's built-in email only reaches account members).
export async function POST(request: NextRequest) {
  const session = await getSessionInfo();
  if (!session || session.role !== 'manager') {
    return NextResponse.json({ error: 'Managers only' }, { status: 403 });
  }

  const { memberId, password } = await request.json();
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const supabase = createClient(); // service role: auth admin API
  const { data: member } = await supabase
    .from('team_members')
    .select('id, role, email')
    .eq('id', memberId)
    .single();
  if (!member?.email) {
    return NextResponse.json({ error: 'Add a login email for this person first' }, { status: 400 });
  }

  const email = String(member.email).toLowerCase();
  const owners = parseManagerEmails(process.env.ALLOWED_EMAILS);
  if (owners.includes(email)) {
    return NextResponse.json({ error: "The owner's own login can't be changed here" }, { status: 403 });
  }
  // Managers can set employee passwords; only the owner can set another manager's
  if ((member.role === 'manager' || member.role === 'owner') && !owners.includes(session.email)) {
    return NextResponse.json({ error: 'Only the owner can set passwords for managers' }, { status: 403 });
  }

  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) {
    // Account already exists (e.g. they used a sign-in link before) — update its password
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (listError || !user) return NextResponse.json({ error: created.error.message }, { status: 500 });

    const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}

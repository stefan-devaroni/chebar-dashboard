import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo, type SessionInfo } from '@/lib/roles';
import { can, canManageMember, isPermission, NO_ACCESS, roleDefault, sameAccess, withImplied, type TeamRole } from '@/lib/permissions';

// The team list. Names are part of the schedule; emails and access are for Team access.
// Owners may change anyone, including roles and what someone can open (`access`). Others with
// Team access only manage staff who can't open more than they can (canManageMember). Adding or
// removing someone on the schedule screen counts as editing the schedule.

const PUBLIC_COLUMNS = 'id, name, role, color, active, department, created_at';
const ROLES: TeamRole[] = ['owner', 'manager', 'employee'];

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const cleanEmail = (v: unknown) => (v ? String(v).trim().toLowerCase() : null);
const teamOrSchedule = (s: SessionInfo | null): s is SessionInfo => !!s && (can(s.perms, 'team') || can(s.perms, 'schedule.edit'));

/** The access list to store: null = the role's default (and always for owners) */
function storedAccess(role: TeamRole, access: unknown): { value: string[] | null } | null {
  if (access === null || role === 'owner') return { value: null };
  if (!Array.isArray(access) || !access.every(isPermission)) return null;
  const perms = withImplied(access);
  return { value: sameAccess(perms, roleDefault(role)) ? null : perms };
}

/** Two rows with one email would make that login ambiguous */
async function emailTaken(supabase: ReturnType<typeof createClient>, email: string | null, exceptId?: string) {
  if (!email) return false;
  let query = supabase.from('team_members').select('id').eq('email', email).limit(1);
  if (exceptId) query = query.neq('id', exceptId);
  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

export async function GET() {
  const session = await getSessionInfo();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('team_members')
    .select(can(session?.perms, 'team') ? '*' : PUBLIC_COLUMNS)
    .order('name');

  if (error) return json({ error: error.message }, 500);
  return json(data);
}

export async function POST(request: NextRequest) {
  const session = await getSessionInfo();
  if (!teamOrSchedule(session)) return json({ error: NO_ACCESS }, 403);
  const team = can(session.perms, 'team');
  const body = await request.json();

  const role: TeamRole = ROLES.includes(body.role) ? body.role : 'employee';
  if (role !== 'employee' && !session.owner) return json({ error: 'Only an owner can add managers and owners' }, 403);
  if (body.access != null && !session.owner) return json({ error: 'Only an owner can change what someone can open' }, 403);
  const access = storedAccess(role, body.access ?? null);
  if (!access) return json({ error: 'Unknown access setting' }, 400);

  const supabase = createClient();
  // Logins (email + password) are set up on the Team tab
  const email = team ? cleanEmail(body.email) : null;
  if (await emailTaken(supabase, email)) return json({ error: 'Another team member already uses this email' }, 409);

  const { data, error } = await supabase
    .from('team_members')
    .insert({
      name: body.name,
      role,
      department: body.department || 'foh',
      color: body.color || '#d4a45c',
      email,
      access: access.value,
    })
    .select(team ? '*' : PUBLIC_COLUMNS)
    .single();

  if (error) return json({ error: error.message }, 500);
  return json(data);
}

export async function PUT(request: NextRequest) {
  const session = await getSessionInfo();
  if (!session || !can(session.perms, 'team')) return json({ error: NO_ACCESS }, 403);
  const body = await request.json();

  const supabase = createClient();
  const { data: current } = await supabase.from('team_members').select('role, access').eq('id', body.id).maybeSingle();
  if (!current) return json({ error: 'Team member not found' }, 404);
  if (!canManageMember(session, current)) return json({ error: 'Only an owner can change this person' }, 403);

  const role: TeamRole = ROLES.includes(body.role) ? body.role : current.role;
  if (role !== current.role && !session.owner) return json({ error: 'Only an owner can change roles' }, 403);

  const update: Record<string, unknown> = {
    name: body.name,
    role,
    department: body.department,
    color: body.color,
    active: body.active,
  };
  if ('email' in body) {
    update.email = cleanEmail(body.email);
    if (await emailTaken(supabase, update.email as string | null, body.id)) {
      return json({ error: 'Another team member already uses this email' }, 409);
    }
  }
  if ('access' in body) {
    if (!session.owner) return json({ error: 'Only an owner can change what someone can open' }, 403);
    const access = storedAccess(role, body.access);
    if (!access) return json({ error: 'Unknown access setting' }, 400);
    update.access = access.value;
  } else if (role !== current.role) {
    update.access = null; // a new role starts from its own default
  }

  const { data, error } = await supabase
    .from('team_members')
    .update(update)
    .eq('id', body.id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionInfo();
  if (!teamOrSchedule(session)) return json({ error: NO_ACCESS }, 403);
  const { id } = await request.json();

  const supabase = createClient();
  const { data: current } = await supabase.from('team_members').select('role, access').eq('id', id).maybeSingle();
  if (current && !canManageMember(session, current)) return json({ error: 'Only an owner can remove this person' }, 403);

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id);

  if (error) return json({ error: error.message }, 500);
  return json({ status: 'deleted' });
}

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NavSidebar } from '@/components/nav-sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <NavSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-18 lg:p-10 lg:pt-10 max-w-6xl">{children}</main>
    </div>
  );
}

export async function load({ locals }) {
  const sb = locals.supabase;

  const [
    { count: waitlistCount },
    { count: userCount },
    { data: recentWaitlist },
    { data: recentUsers }
  ] = await Promise.all([
    sb.from('waitlist').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('waitlist').select('email, role, created_at').order('created_at', { ascending: false }).limit(5),
    sb.from('profiles').select('display_name, email, role, created_at').order('created_at', { ascending: false }).limit(5),
  ]);

  return { waitlistCount, userCount, recentWaitlist, recentUsers };
}

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  // 303 forces the browser to GET the target — without this, the POST is preserved
  // by Next.js's default 307 and /login (page-only) returns 405 Method Not Allowed.
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

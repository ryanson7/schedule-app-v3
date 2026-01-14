//src/pages/api/_utils/adminSupabase.t
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 서버 전용(절대 클라이언트로 노출 금지)
export const adminSupabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});


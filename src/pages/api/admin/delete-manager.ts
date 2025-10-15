export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.body;

    // 1) managers 테이블에서 먼저 삭제
    const { error: managerError } = await supabaseAdmin
      .from('managers')
      .delete()
      .eq('user_id', id);

    if (managerError) {
      return res.status(500).json({ error: 'Manager 정보 삭제 실패', details: managerError.message });
    }

    // 2) users 테이블에서 삭제 (또는 비활성화)
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        is_active: false,
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (userError) {
      return res.status(500).json({ error: 'User 상태 업데이트 실패', details: userError.message });
    }

    res.status(200).json({ success: true, message: '매니저가 삭제되었습니다.' });

  } catch (error) {
    res.status(500).json({ error: '서버 오류', details: error.message });
  }
}

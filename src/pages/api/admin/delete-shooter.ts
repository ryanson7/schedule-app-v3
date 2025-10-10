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

    if (!id) {
      return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
    }

    // ✅ users 테이블에서 촬영자 정보 조회 (auth_id도 함께)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, name')
      .eq('id', id)
      .eq('role', 'shooter')
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: '촬영자를 찾을 수 없습니다.' });
    }

    // ✅ shooters 테이블에서 삭제 (auth_id 기준)
    const { error: shooterDeleteError } = await supabaseAdmin
      .from('shooters')
      .delete()
      .eq('user_id', userData.auth_id);

    if (shooterDeleteError) {
      throw shooterDeleteError;
    }

    // ✅ users 테이블에서 삭제
    const { error: userDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (userDeleteError) {
      throw userDeleteError;
    }

    // ✅ Auth 사용자 삭제
    if (userData.auth_id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userData.auth_id);
      if (authDeleteError) {
        console.warn('Auth 사용자 삭제 실패:', authDeleteError);
      }
    }

    res.status(200).json({
      success: true,
      message: `촬영자 "${userData.name}"이(가) 성공적으로 삭제되었습니다.`
    });

  } catch (error: any) {
    console.error('촬영자 삭제 실패:', error);
    res.status(500).json({ 
      error: '촬영자 삭제 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
}

export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, newPassword } = req.body;

    if (!id) {
      return res.status(400).json({ error: '관리자 ID가 필요합니다' });
    }

    const finalPassword = newPassword?.toString().trim() || 'qwer1234!';

    console.log('🔍 비밀번호 재설정 요청:', id);

    // 1. 사용자 정보 조회
    const { data: userData, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, auth_user_id')
      .eq('id', id)
      .single();

    if (checkError || !userData) {
      return res.status(404).json({ error: '관리자를 찾을 수 없습니다.' });
    }

    // 2. Auth에서 비밀번호 업데이트
    let authUpdated = false;
    try {
      if (userData.auth_user_id) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userData.auth_user_id, {
          password: finalPassword
        });
        if (authError) throw authError;
        authUpdated = true;
      } else {
        // email로 찾아서 업데이트
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const authUser = authUsers.users.find(u => u.email === userData.email);
        if (authUser) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
            password: finalPassword
          });
          if (authError) throw authError;
          authUpdated = true;
        }
      }
    } catch (authError) {
      console.error('🚨 Auth 비밀번호 업데이트 에러:', authError);
      return res.status(400).json({ error: 'Authentication 업데이트 실패' });
    }

    // 3. DB에서 임시 비밀번호 정보 업데이트
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({
        temp_password: finalPassword,
        is_temp_password: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (dbError) {
      console.error('🚨 DB 비밀번호 정보 업데이트 에러:', dbError);
    }

    return res.status(200).json({
      success: true,
      message: `${userData.name}의 비밀번호가 성공적으로 재설정되었습니다.`,
      tempPassword: finalPassword,
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email
      },
      authUpdated
    });

  } catch (error) {
    console.error('🚨 API 에러:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}

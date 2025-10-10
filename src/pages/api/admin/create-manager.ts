// src/pages/api/admin/create-manager.ts
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, name, phone, manager_type, main_location_id, position_id } = req.body;

    console.log('🔍 매니저 생성 요청:', { email, name, manager_type, main_location_id, position_id });

    // 1) Auth에 사용자 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'eduwill1234!',
      email_confirm: true,
      user_metadata: {
        name,
        phone,
        role: 'manager'
      }
    });

    if (authError) {
      console.error('❌ Auth 사용자 생성 실패:', authError);
      return res.status(500).json({ error: 'Auth 사용자 생성 실패', details: authError.message });
    }

    // 2) public.users 테이블에 사용자 생성 (is_temp_password 제거)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_id: authData.user.id,
        email,
        name,
        phone: phone || null,
        role: 'manager',
        is_active: true,
        status: 'active'
        // is_temp_password 제거
      })
      .select('id')
      .single();

    if (userError) {
      console.error('❌ Users 테이블 생성 실패:', userError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Users 테이블 생성 실패', details: userError.message });
    }

    // 3) managers 테이블에 세부 정보 저장
    const managerData = {
      user_id: userData.id,
      manager_type: manager_type || 'online_manager',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (manager_type === 'academy_manager' && main_location_id) {
      managerData.main_location_id = parseInt(main_location_id);
    }

    if (position_id && position_id !== '' && position_id !== 'null') {
      managerData.position_id = parseInt(position_id);
    }

    const { error: managerError } = await supabaseAdmin
      .from('managers')
      .insert(managerData);

    if (managerError) {
      console.error('❌ 매니저 정보 저장 실패:', managerError);
      // 롤백
      await supabaseAdmin.from('users').delete().eq('id', userData.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: '매니저 정보 저장 실패', details: managerError.message });
    }

    res.status(200).json({ 
      success: true, 
      message: '매니저가 성공적으로 생성되었습니다.',
      userId: userData.id,
      authId: authData.user.id,
      managerType: manager_type,
      tempPassword: 'eduwill1234!'
    });

  } catch (error) {
    console.error('❌ 매니저 생성 오류:', error);
    res.status(500).json({ error: '서버 오류', details: error.message });
  }
}

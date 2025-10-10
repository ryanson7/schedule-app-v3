// src/pages/api/admin/create-admin.ts
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
    const { email, name, phone, role, organization_id, position_id } = req.body;

    console.log('🔍 관리자 생성 요청:', { email, name, role, organization_id, position_id });

    // 🎯 Authentication API로 사용자 생성 (트리거가 모든 테이블을 자동 처리)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email?.toString().trim(),
      password: 'qwer1234!',
      email_confirm: true,
      user_metadata: {
        name: name?.toString().trim(),
        role: role?.toString().trim() || 'schedule_admin',
        organization_id: organization_id || null,
        position_id: position_id || null
      }
    });

    if (authError) {
      console.error('🚨 Auth 생성 오류:', authError);
      return res.status(500).json({ error: `인증 사용자 생성 실패: ${authError.message}` });
    }

    console.log('✅ Auth 사용자 생성 완료:', authData.user.id);

    // 잠시 대기 (트리거 실행 완료 대기)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // users 테이블에서 생성된 레코드 확인 및 추가 정보 업데이트
    const { data: userData, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, auth_id')
      .eq('auth_id', authData.user.id)
      .single();

    if (findError) {
      console.error('🚨 생성된 사용자 찾기 실패:', findError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: '트리거 실행 실패: 사용자 생성 후 조회 불가' });
    }

    console.log('✅ 트리거로 생성된 사용자 확인:', userData);

    // 추가 정보 업데이트 (name, phone 등)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        name: name?.toString().trim(),
        phone: phone?.toString().trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id);

    if (updateError) {
      console.error('🚨 users 테이블 업데이트 오류:', updateError);
    }

    // admins 테이블 확인 (트리거로 자동 생성되었는지)
    const { data: adminData, error: adminCheckError } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('user_auth_id', authData.user.id)
      .single();

    if (adminCheckError) {
      console.error('🚨 admins 테이블 확인 실패:', adminCheckError);
    } else {
      console.log('✅ 트리거로 생성된 admin 레코드 확인:', adminData);
    }

    res.status(200).json({
      success: true,
      user: {
        id: userData.id,
        auth_id: authData.user.id,
        email: authData.user.email,
        name: name,
        role: role
      },
      admin_created: !!adminData,
      tempPassword: 'qwer1234!',
      message: '관리자가 성공적으로 생성되었습니다.'
    });

  } catch (error) {
    console.error('🚨 전체 프로세스 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '알 수 없는 서버 오류'
    });
  }
}

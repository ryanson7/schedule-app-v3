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

    // 필수 필드 검증
    if (!email || !name || !manager_type) {
      return res.status(400).json({ 
        error: '필수 필드 누락',
        missing: { email: !email, name: !name, manager_type: !manager_type }
      });
    }

    // manager_type 정규화
    const allowedManagerTypes = ['academy_manager', 'online_manager'] as const;
    const normalizedManagerType = allowedManagerTypes.includes(manager_type)
      ? manager_type
      : 'online_manager';

    // users 테이블에는 'manager'로 저장 (DB 제약 준수)
    const dbRole = 'manager';

    console.log('📝 역할 매핑:', { 
      manager_type: normalizedManagerType, 
      dbRole 
    });

    // 1) Auth에 사용자 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'eduwill1234!',
      email_confirm: true,
      user_metadata: {
        name,
        phone,
        role: normalizedManagerType
      }
    });

    if (authError) {
      console.error('❌ Auth 사용자 생성 실패:', authError);
      return res.status(500).json({ 
        error: 'Auth 사용자 생성 실패', 
        details: authError.message 
      });
    }

    if (!authData?.user) {
      return res.status(500).json({ error: 'Auth 응답 데이터 없음' });
    }

    console.log('✅ Auth 사용자 생성 완료:', authData.user.id);

    // 2) public.users 테이블에 사용자 생성
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_id: authData.user.id, // ✅ 확인됨!
        email,
        name,
        phone: phone || null,
        role: dbRole, // 'manager'
        is_active: true,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (userError) {
      console.error('❌ Users 테이블 생성 실패:', userError);
      console.error('❌ 상세 오류:', JSON.stringify(userError, null, 2));
      
      // 롤백: Auth 사용자 삭제
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return res.status(500).json({ 
        error: 'Users 테이블 생성 실패', 
        details: userError.message
      });
    }

    if (!userData) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Users 응답 데이터 없음' });
    }

    console.log('✅ Users 테이블 생성 완료:', userData.id);

    // 3) managers 테이블에 세부 정보 저장
    const managerData: any = {
      user_id: userData.id,
      manager_type: normalizedManagerType,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // academy_manager인 경우 지점 설정
    if (normalizedManagerType === 'academy_manager' && main_location_id) {
      const parsedLocationId = parseInt(main_location_id, 10);
      if (!isNaN(parsedLocationId)) {
        managerData.main_location_id = parsedLocationId;
      } else {
        managerData.main_location_id = null;
      }
    } else {
      managerData.main_location_id = null;
    }

    // 직책 설정
    if (position_id && position_id !== '' && position_id !== 'null') {
      const parsedPositionId = parseInt(position_id, 10);
      if (!isNaN(parsedPositionId)) {
        managerData.position_id = parsedPositionId;
      }
    }

    console.log('📝 매니저 데이터:', managerData);

    const { error: managerError } = await supabaseAdmin
      .from('managers')
      .insert(managerData);

    if (managerError) {
      console.error('❌ 매니저 정보 저장 실패:', managerError);
      console.error('❌ 상세 오류:', JSON.stringify(managerError, null, 2));
      
      // 롤백: users 삭제 및 Auth 삭제
      await supabaseAdmin.from('users').delete().eq('id', userData.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return res.status(500).json({ 
        error: '매니저 정보 저장 실패', 
        details: managerError.message 
      });
    }

    console.log('✅ 매니저 생성 완료:', {
      userId: userData.id,
      authId: authData.user.id,
      email,
      manager_type: normalizedManagerType
    });

    return res.status(201).json({ 
      success: true, 
      message: '매니저가 성공적으로 생성되었습니다.',
      data: {
        userId: userData.id,
        authId: authData.user.id,
        email,
        name,
        managerType: normalizedManagerType,
        tempPassword: 'eduwill1234!'
      }
    });

  } catch (error: any) {
    console.error('❌ 매니저 생성 오류:', error);
    console.error('❌ 스택 트레이스:', error?.stack);
    
    return res.status(500).json({ 
      error: '서버 오류', 
      details: error?.message || '알 수 없는 오류' 
    });
  }
}

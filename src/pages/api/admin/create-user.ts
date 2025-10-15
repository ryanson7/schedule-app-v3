export const config = { runtime: 'edge' };

// src/pages/api/admin/create-user.ts (완전 수정)
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

function safeParseInteger(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const stringValue = value.toString().trim();
  if (stringValue === '' || stringValue === 'null' || stringValue === 'undefined') {
    return null;
  }
  
  const parsed = parseInt(stringValue, 10);
  if (isNaN(parsed)) {
    return null;
  }
  
  return parsed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, name, phone, role, organization_id, position_id } = req.body;

    // 🎯 강력한 데이터 정제
    const processedData = {
      email: email?.toString().trim(),
      name: name?.toString().trim(),
      phone: phone?.toString().trim() || null,
      role: role?.toString().trim() || 'schedule_admin',
      organization_id: safeParseInteger(organization_id),
      position_id: safeParseInteger(position_id)
    };

    console.log('🔍 단일 관리자 처리 데이터:', processedData);

    // 필수 필드 검증
    if (!processedData.email || !processedData.name) {
      return res.status(400).json({ error: '이메일과 이름은 필수입니다' });
    }

    // 이메일 형식 검증
    if (!processedData.email.includes('@') || !processedData.email.includes('.')) {
      return res.status(400).json({ error: '유효하지 않은 이메일 형식입니다' });
    }

    // 중복 검사
    const { data: existingUser } = await supabaseAdmin
      .from('users_formatted')
      .select('id, name, email')
      .eq('email', processedData.email)
      .in('role', ['system_admin', 'schedule_admin', 'admin'])
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: `이미 등록된 이메일입니다: ${processedData.email}` });
    }

    // Admin API로 사용자 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: processedData.email,
      password: 'qwer1234!',
      email_confirm: true,
      user_metadata: {
        name: processedData.name,
        role: processedData.role,
        is_temp_password: true
      }
    });

    if (authError) {
      throw new Error(`인증 사용자 생성 실패: ${authError.message}`);
    }

    // 🎯 users 테이블에 저장 (완전히 검증된 데이터만)
    const insertData: any = {
      id: authData.user.id,
      name: processedData.name,
      email: processedData.email,
      temp_password: 'qwer1234!',
      is_temp_password: true,
      role: processedData.role,
      status: 'active',
      is_active: true,
      created_at: new Date().toISOString()
    };

    // null이 아닌 경우에만 추가
    if (processedData.phone) {
      insertData.phone = processedData.phone;
    }
    if (processedData.organization_id !== null) {
      insertData.organization_id = processedData.organization_id;
    }
    if (processedData.position_id !== null) {
      insertData.position_id = processedData.position_id;
    }

    console.log('🔍 단일 관리자 최종 insert 데이터:', insertData);

    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert(insertData);

    if (dbError) {
      console.error('🚨 단일 관리자 DB 삽입 오류:', dbError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`사용자 정보 저장 실패: ${dbError.message}`);
    }

    res.status(200).json({
      success: true,
      user: authData.user,
      tempPassword: 'qwer1234!'
    });

  } catch (error) {
    console.error('🚨 단일 관리자 생성 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}

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
    const { name, phone, professor_category_id } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: '이름과 전화번호는 필수입니다.' });
    }

    console.log('🔍 교수 등록/수정 시도:', { name, phone, professor_category_id });

    // ✅ 전화번호로만 기존 교수 확인 (이름 상관없음)
    const { data: existingUsers, error: checkError } = await supabaseAdmin
      .from('users')
      .select(`
        id, name, phone, email,
        professors!inner(user_id, professor_category_id, secondary_category_id)
      `)
      .eq('phone', phone)  // 전화번호로만 체크
      .eq('role', 'professor');

    if (checkError) {
      console.error('❌ 기존 교수 확인 오류:', checkError);
      return res.status(400).json({ error: checkError.message });
    }

    // ✅ 같은 전화번호가 있으면 secondary_category_id만 업데이트
    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      const existingProfessor = existingUser.professors[0];

      console.log('🔄 기존 전화번호 발견, secondary 카테고리 업데이트');
      console.log(`기존: ${existingUser.name} → 입력: ${name}`);

      // secondary_category_id 업데이트
      const { data: updatedProfessor, error: updateError } = await supabaseAdmin
        .from('professors')
        .update({
          secondary_category_id: professor_category_id, // 새로운 카테고리를 secondary로
        })
        .eq('user_id', existingUser.id)
        .select(`
          *,
          users!inner(id, name, email, phone, role, status, is_active, created_at, updated_at),
          professor_categories:professor_category_id(id, category_name),
          secondary_categories:secondary_category_id(id, category_name)
        `)
        .single();

      if (updateError) {
        console.error('❌ secondary 카테고리 업데이트 오류:', updateError);
        return res.status(400).json({ error: updateError.message });
      }

      console.log('✅ 교수 secondary 카테고리 업데이트 성공');

      return res.status(200).json({
        success: true,
        message: `전화번호 ${phone}의 보조 카테고리가 업데이트되었습니다. (기존: ${existingUser.name}, 추가: ${name})`,
        data: {
          user: updatedProfessor.users,
          professor: updatedProfessor,
          action: 'updated_secondary_category',
          original_name: existingUser.name,
          input_name: name
        }
      });
    }

    // ✅ 새 교수 등록 (전화번호가 없는 경우)
    console.log('🆕 새 교수 등록:', name);

    const email = `${phone.replace(/[^0-9]/g, '')}@professor.temp`;
    const temporaryPassword = `temp${Math.random().toString(36).substring(2, 10)}!A1`;

    // 1. Authentication Users에 사용자 생성
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name: name,
        phone: phone,
        role: 'professor'
      }
    });

    if (authError) {
      console.error('❌ Authentication 사용자 생성 오류:', authError);
      return res.status(400).json({ error: `Auth 오류: ${authError.message}` });
    }

    console.log('✅ Authentication 사용자 생성 성공:', authUser.user.id);

    // 2. users 테이블에 기본 정보 생성
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        name: name,
        phone: phone,
        email: email,
        role: 'professor',
        status: 'active',
        is_active: true,
        auth_id: authUser.user.id
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ users 테이블 생성 오류:', userError);
      
      // Authentication 사용자 롤백
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      
      return res.status(400).json({ error: userError.message });
    }

    // 3. professors 테이블에 교수 정보 생성
    const { data: newProfessor, error: profError } = await supabaseAdmin
      .from('professors')
      .insert({
        user_id: newUser.id,
        professor_category_id: professor_category_id || null,
        secondary_category_id: null, // 첫 등록시엔 secondary 없음
        is_active: true
      })
      .select()
      .single();

    if (profError) {
      console.error('❌ professors 테이블 생성 오류:', profError);
      
      // 롤백: users 및 Authentication 사용자 삭제
      await supabaseAdmin.from('users').delete().eq('id', newUser.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      
      return res.status(400).json({ error: profError.message });
    }

    console.log('✅ 새 교수 등록 성공:', name);

    return res.status(200).json({
      success: true,
      message: `${name} 교수가 새로 등록되었습니다.`,
      data: {
        auth_user: authUser.user,
        user: newUser,
        professor: newProfessor,
        temporary_password: temporaryPassword,
        action: 'created'
      }
    });

  } catch (error) {
    console.error('❌ 교수 등록/수정 API 오류:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : '서버 오류'
    });
  }
}

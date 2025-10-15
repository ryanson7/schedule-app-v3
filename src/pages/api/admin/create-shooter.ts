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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone, shooter_type, team_id, main_location_id, emergency_phone } = req.body;

    // 기본 검증
    if (!name || !phone || !shooter_type) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    if (shooter_type === 'dispatch' && !team_id) {
      return res.status(400).json({ error: '파견직은 팀을 선택해야 합니다.' });
    }

    if (shooter_type === 'freelancer' && !main_location_id) {
      return res.status(400).json({ error: '프리랜서는 학원을 선택해야 합니다.' });
    }

    // create-shooter.ts - 수정 후
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const email = `${cleanPhone}@shooter.eduwill.com`;
    const password = 'qwer1234!'; // 또는 'temp1234!'

    // ✅ Supabase Auth 사용자 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'shooter'
      }
    });

    if (authError) throw authError;

    // ✅ users 테이블에 저장 (auth_id에 UUID 저장)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        email,
        role: 'shooter',
        status: 'active',
        is_active: true,
        auth_id: authData.user.id  // ✅ UUID를 auth_id에 저장
      })
      .select('auth_id')
      .single();

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw userError;
    }

    // ✅ shooters 테이블에 저장 (user_id에 UUID 저장)
    const shooterData = {
      user_id: userData.auth_id,  // ✅ UUID 저장
      shooter_type,
      team_id: shooter_type === 'dispatch' ? parseInt(team_id) : null,
      main_location_id: shooter_type === 'freelancer' ? parseInt(main_location_id) : null,
      main_location_ids: shooter_type === 'freelancer' && main_location_id ? [parseInt(main_location_id)] : null,
      emergency_phone: emergency_phone || null,
      is_active: true
    };

    const { error: shooterError } = await supabaseAdmin
      .from('shooters')
      .insert(shooterData);

    if (shooterError) {
      // 실패 시 롤백
      await supabaseAdmin.from('users').delete().eq('auth_id', userData.auth_id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw shooterError;
    }

    res.status(201).json({
      success: true,
      message: '촬영자가 성공적으로 생성되었습니다.',
      tempPassword: password
    });

  } catch (error: any) {
    console.error('촬영자 생성 실패:', error);
    res.status(500).json({ 
      error: '촬영자 생성 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
}

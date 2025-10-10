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

// ✅ 안전한 정수 파싱 헬퍼 함수
const safeParseInt = (value: any, fieldName: string): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const stringValue = value.toString().trim();
  if (stringValue === '') {
    return null;
  }
  
  const parsed = parseInt(stringValue);
  if (isNaN(parsed)) {
    throw new Error(`${fieldName}는 유효한 숫자여야 합니다: "${value}"`);
  }
  
  return parsed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, name, phone, emergency_phone, shooter_type, team_id, main_location_id } = req.body;

    // 사용자 존재 확인
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .eq('id', id)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 전화번호 중복 체크 (본인 제외)
    if (phone) {
      const { data: duplicateUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone', phone)
        .neq('id', id)
        .single();

      if (duplicateUser) {
        return res.status(400).json({ error: '이미 사용 중인 전화번호입니다.' });
      }
    }

    // 1) users 테이블 업데이트
    const userUpdateData: any = {
      updated_at: new Date().toISOString()
    };

    if (name) userUpdateData.name = name;
    if (phone) userUpdateData.phone = phone;

    const { error: userError } = await supabaseAdmin
      .from('users')
      .update(userUpdateData)
      .eq('id', id);

    if (userError) {
      return res.status(500).json({ error: 'Users 테이블 업데이트 실패', details: userError.message });
    }

    // 2) shooters 테이블 업데이트
    const shooterUpdateData: any = {
      updated_at: new Date().toISOString()
    };

    if (emergency_phone !== undefined) shooterUpdateData.emergency_phone = emergency_phone || null;
    
    if (shooter_type) {
      shooterUpdateData.shooter_type = shooter_type;
      
      if (shooter_type === 'dispatch') {
        // ✅ 안전한 팀ID 처리
        const teamId = safeParseInt(team_id, '팀ID');
        shooterUpdateData.team_id = teamId;
        shooterUpdateData.main_location_id = null;
        shooterUpdateData.main_location_ids = null;
      } else if (shooter_type === 'freelancer') {
        // ✅ 안전한 학원ID 처리
        const locationId = safeParseInt(main_location_id, '학원ID');
        shooterUpdateData.team_id = null;
        shooterUpdateData.main_location_id = locationId;
        shooterUpdateData.main_location_ids = locationId ? [locationId] : null;
      }
    }

    const { error: shooterError } = await supabaseAdmin
      .from('shooters')
      .update(shooterUpdateData)
      .eq('user_id', id);

    if (shooterError) {
      return res.status(500).json({ error: 'Shooters 테이블 업데이트 실패', details: shooterError.message });
    }

    res.status(200).json({
      success: true,
      message: `촬영자 "${name || existingUser.name}"이(가) 성공적으로 업데이트되었습니다.`
    });

  } catch (error) {
    console.error('촬영자 업데이트 중 오류:', error);
    res.status(500).json({
      error: '서버 오류',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}

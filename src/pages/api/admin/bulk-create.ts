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

interface CSVRow {
  이름: string;
  전화번호: string;
  비상연락처?: string;
  타입: 'dispatch' | 'freelancer';
  팀ID?: string;
  학원ID?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { csvData }: { csvData: CSVRow[] } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ error: 'CSV 데이터가 올바르지 않습니다.' });
    }

    console.log('🔍 일괄 생성 요청:', csvData.length, '명');
    
    let successCount = 0;
    let errorCount = 0;
    const errorMessages: string[] = [];

    for (const row of csvData) {
      try {
        console.log(`🔄 처리 중: ${row.이름}`);

        // 기본 검증
        if (!row.이름 || !row.전화번호 || !row.타입) {
          throw new Error('필수 항목이 누락되었습니다');
        }

        if (row.타입 === 'dispatch' && !row.팀ID) {
          throw new Error('파견직은 팀ID가 필요합니다');
        }

        if (row.타입 === 'freelancer' && !row.학원ID) {
          throw new Error('프리랜서는 학원ID가 필요합니다');
        }

        // 중복 확인
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('phone', row.전화번호)
          .single();

        if (existingUser) {
          errorCount++;
          errorMessages.push(`${row.이름}: 이미 등록된 전화번호`);
          continue;
        }

        // bulk-create.ts - 수정 후
        const cleanPhone = row.전화번호.replace(/[^0-9]/g, '');
        const email = `${cleanPhone}@shooter.eduwill.com`;
        const password = 'qwer1234!'; // 또는 'temp1234!'

        // ✅ Auth 사용자 생성
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: row.이름,
            role: 'shooter'
          }
        });

        if (authError) throw authError;

        // ✅ users 테이블에 저장
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            name: row.이름.trim(),
            phone: row.전화번호.trim(),
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

        // ✅ shooters 테이블 데이터 준비
        const shooterData = {
          user_id: userData.auth_id,  // ✅ UUID 저장
          shooter_type: row.타입,
          emergency_phone: row.비상연락처 ? row.비상연락처.trim() : null,
          is_active: true
        };

        if (row.타입 === 'dispatch') {
          const teamId = parseInt(row.팀ID!);
          if (isNaN(teamId)) {
            throw new Error('팀ID는 숫자여야 합니다');
          }
          
          shooterData.team_id = teamId;
          shooterData.main_location_id = null;
          shooterData.main_location_ids = null;
        } 
        else if (row.타입 === 'freelancer') {
        let academyIds: number[] = [];
        
        if (row.학원ID) {
            // 콤마로 분리하여 복수 학원ID 처리
            const ids = row.학원ID.split(',').map(v => v.trim()).filter(Boolean);
            
            for (const aid of ids) {
            const parsedId = parseInt(aid);
            if (isNaN(parsedId)) {
                throw new Error(`학원ID에는 숫자만 가능합니다: ${row.학원ID}`);
            }
            academyIds.push(parsedId);
            }
        }
        
        if (academyIds.length === 0) {
            throw new Error('프리랜서는 최소 하나의 학원ID가 필요합니다');
        }

        // 모든 학원ID 존재 여부 확인
        for (const academyId of academyIds) {
            const { data: validLocation } = await supabaseAdmin
            .from('main_locations')
            .select('id')
            .eq('id', academyId)
            .eq('is_active', true)
            .single();
            
            if (!validLocation) {
            throw new Error(`존재하지 않는 학원ID: ${academyId}`);
            }
        }

        shooterData.team_id = null;
        shooterData.main_location_id = academyIds[0];  // 첫 번째를 대표 학원으로
        shooterData.main_location_ids = academyIds;    // 전체 학원ID 배열
        }

        // shooters 테이블에 저장
        const { error: shooterError } = await supabaseAdmin
          .from('shooters')
          .insert(shooterData);

        if (shooterError) {
          await supabaseAdmin.from('users').delete().eq('auth_id', userData.auth_id);
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw new Error(`DB 삽입 실패: ${shooterError.message}`);
        }

        successCount++;
        console.log(`✅ ${row.이름} 처리 완료`);

      } catch (error: any) {
        console.error(`❌ ${row.이름} 처리 실패:`, error);
        errorCount++;
        errorMessages.push(`${row.이름}: ${error.message}`);
      }
    }

    console.log(`🎯 일괄 생성 완료: 성공 ${successCount}명, 실패 ${errorCount}명`);

    res.status(200).json({
      success: true,
      successCount,
      errorCount,
      errorMessages: errorMessages.slice(0, 10) // 최대 10개만 반환
    });

  } catch (error: any) {
    console.error('❌ 일괄 생성 중 오류:', error);
    res.status(500).json({
      error: '서버 오류',
      details: error.message
    });
  }
}

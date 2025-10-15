export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS 헤더 추가
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 🔧 테스트 요청 처리 (가장 먼저 체크)
  if (req.body && req.body.test === true) {
    console.log('🧪 API 테스트 요청 받음');
    return res.status(200).json({
      success: true,
      message: 'API가 정상적으로 작동합니다!',
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!supabaseServiceRoleKey,
        supabaseClientReady: !!supabaseAdmin
      }
    });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ 
      error: '서버 설정 오류',
      details: 'Supabase 환경변수가 설정되지 않았습니다.'
    });
  }

  try {
    const { scheduleId, splitPoints, reason, adminUserId } = req.body;

    console.log('🔧 스케줄 분할 시작:', { scheduleId, splitPoints, reason });

    // 필수 파라미터 검증
    if (!scheduleId || !splitPoints || !Array.isArray(splitPoints) || splitPoints.length === 0) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: '분할 사유를 입력해주세요.' });
    }

    // 1. 원본 스케줄 조회
    const { data: originalSchedule, error: fetchError } = await supabaseAdmin
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (fetchError || !originalSchedule) {
      console.error('원본 스케줄 조회 실패:', fetchError);
      return res.status(404).json({ error: '스케줄을 찾을 수 없습니다.' });
    }

    // 2. 이미 분할된 스케줄인지 확인
    if (originalSchedule.is_admin_split || originalSchedule.parent_schedule_id) {
      return res.status(400).json({ error: '이미 분할된 스케줄입니다.' });
    }

    // 3. 분할 지점 검증 및 정렬
    const startMinutes = timeToMinutes(originalSchedule.start_time);
    const endMinutes = timeToMinutes(originalSchedule.end_time);
    
    const validSplitPoints = splitPoints
      .map(point => timeToMinutes(point.toString()))
      .filter(minutes => {
        const isValid = minutes > startMinutes && minutes < endMinutes;
        if (!isValid) {
          console.warn('유효하지 않은 분할 지점:', minutes, '범위:', startMinutes, '~', endMinutes);
        }
        return isValid;
      })
      .sort((a, b) => a - b);

    if (validSplitPoints.length === 0) {
      return res.status(400).json({ 
        error: '유효한 분할 지점이 없습니다.',
        details: `분할 지점은 ${originalSchedule.start_time}과 ${originalSchedule.end_time} 사이여야 합니다.`
      });
    }

    console.log('✅ 유효한 분할 지점:', validSplitPoints.map(minutesToTime));

    // 4. 분할된 스케줄들 생성
    const segments = [];
    let currentStart = startMinutes;

    validSplitPoints.forEach((splitPoint, index) => {
      segments.push({
        ...originalSchedule,
        id: undefined, // 새 ID 생성됨
        start_time: minutesToTime(currentStart),
        end_time: minutesToTime(splitPoint),
        parent_schedule_id: originalSchedule.id,
        is_admin_split: true,
        admin_split_reason: reason.trim(),
        split_by_admin_id: adminUserId ? parseInt(adminUserId.toString()) : null,
        original_start_time: originalSchedule.start_time,
        original_end_time: originalSchedule.end_time,
        segment_order: index + 1,
        approval_status: 'approved', // 관리자 분할은 자동 승인
        assigned_shooter_id: null, // 촬영자 재배정 필요
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      currentStart = splitPoint;
    });

    // 마지막 세그먼트 추가
    if (currentStart < endMinutes) {
      segments.push({
        ...originalSchedule,
        id: undefined,
        start_time: minutesToTime(currentStart),
        end_time: originalSchedule.end_time,
        parent_schedule_id: originalSchedule.id,
        is_admin_split: true,
        admin_split_reason: reason.trim(),
        split_by_admin_id: adminUserId ? parseInt(adminUserId.toString()) : null,
        original_start_time: originalSchedule.start_time,
        original_end_time: originalSchedule.end_time,
        segment_order: segments.length + 1,
        approval_status: 'approved',
        assigned_shooter_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    console.log('📝 생성될 세그먼트:', segments.length, '개');

    // 5. DB에 분할 스케줄들 저장
    const { data: savedSegments, error: insertError } = await supabaseAdmin
      .from('schedules')
      .insert(segments)
      .select();

    if (insertError) {
      console.error('분할 스케줄 저장 실패:', insertError);
      throw new Error(`분할 스케줄 저장 실패: ${insertError.message}`);
    }

    console.log('✅ 분할 스케줄 저장 완료:', savedSegments?.length, '개');

    // 6. 원본 스케줄을 비활성화 (삭제하지 않고 숨김)
    const { error: updateError } = await supabaseAdmin
      .from('schedules')
      .update({
        is_active: false,
        deletion_reason: 'admin_split',
        is_admin_split: true,
        admin_split_reason: reason.trim(),
        split_by_admin_id: adminUserId ? parseInt(adminUserId.toString()) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId);

    if (updateError) {
      console.error('원본 스케줄 비활성화 실패:', updateError);
      throw new Error(`원본 스케줄 비활성화 실패: ${updateError.message}`);
    }

    console.log('✅ 원본 스케줄 비활성화 완료');

    // 7. 히스토리 기록
    try {
      await supabaseAdmin
        .from('schedule_history')
        .insert({
          schedule_id: scheduleId,
          change_type: 'admin_split',
          changed_by: adminUserId ? parseInt(adminUserId.toString()) : null,
          description: `관리자 스케줄 분할 (${segments.length}개 세그먼트): ${reason.trim()}`,
          old_value: JSON.stringify({
            id: originalSchedule.id,
            start_time: originalSchedule.start_time,
            end_time: originalSchedule.end_time
          }),
          new_value: JSON.stringify({
            segments: savedSegments?.length || 0,
            reason: reason.trim()
          }),
          created_at: new Date().toISOString(),
          changed_at: new Date().toISOString()
        });

      console.log('✅ 히스토리 기록 완료');
    } catch (historyError) {
      console.warn('⚠️ 히스토리 기록 실패 (분할은 성공):', historyError);
    }

    return res.status(200).json({
      success: true,
      message: `스케줄이 ${segments.length}개 세그먼트로 분할되었습니다.`,
      data: {
        originalScheduleId: scheduleId,
        segments: savedSegments || [],
        segmentCount: segments.length
      }
    });

  } catch (error) {
    console.error('❌ 스케줄 분할 처리 오류:', error);
    return res.status(500).json({
      error: '스케줄 분할 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}

// 헬퍼 함수들
function timeToMinutes(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') {
    throw new Error(`유효하지 않은 시간 형식: ${timeString}`);
  }
  
  const parts = timeString.split(':');
  if (parts.length !== 2) {
    throw new Error(`유효하지 않은 시간 형식: ${timeString}`);
  }
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`유효하지 않은 시간 값: ${timeString}`);
  }
  
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  if (typeof minutes !== 'number' || minutes < 0 || minutes > 24 * 60) {
    throw new Error(`유효하지 않은 분 값: ${minutes}`);
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

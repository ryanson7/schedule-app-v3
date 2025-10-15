export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabaseClient';

interface ShooterActionRequest {
  schedule_id: number;
  shooter_id: number;
  action_type: 'schedule_check' | 'departure' | 'arrival' | 'start' | 'end' | 'completion';
  qr_code?: string;
  notes?: string;
  photo_url?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // POST 메소드만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.',
      error: 'INVALID_METHOD'
    });
  }

  try {
    const {
      schedule_id,
      shooter_id,
      action_type,
      qr_code,
      notes,
      photo_url
    }: ShooterActionRequest = req.body;

    // 필수 필드 검증
    if (!schedule_id || !shooter_id || !action_type) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다.',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // 유효한 액션 타입 검증
    const validActionTypes = ['schedule_check', 'departure', 'arrival', 'start', 'end', 'completion'];
    if (!validActionTypes.includes(action_type)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 액션 타입입니다.',
        error: 'INVALID_ACTION_TYPE'
      });
    }

    // 스케줄 존재 여부 및 shooter 배정 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('id, assigned_shooter_id, shoot_date, start_time, course_name, sub_location_id')
      .eq('id', schedule_id)
      .eq('is_active', true)
      .single();

    if (scheduleError || !schedule) {
      return res.status(404).json({
        success: false,
        message: '스케줄을 찾을 수 없습니다.',
        error: 'SCHEDULE_NOT_FOUND'
      });
    }

    // shooter 배정 확인
    if (schedule.assigned_shooter_id !== shooter_id) {
      return res.status(403).json({
        success: false,
        message: '해당 스케줄에 배정된 shooter가 아닙니다.',
        error: 'UNAUTHORIZED_SHOOTER'
      });
    }

    // QR 코드 검증 (arrival 액션인 경우)
    let location_verified = false;
    if (action_type === 'arrival' && qr_code) {
      // 스튜디오 위치 정보 조회
      const { data: locationData, error: locationError } = await supabase
        .from('sub_locations')
        .select('main_location_id')
        .eq('id', schedule.sub_location_id)
        .single();

      if (!locationError && locationData) {
        // QR 코드 검증
        const { data: qrData, error: qrError } = await supabase
          .from('location_qr_codes')
          .select('id')
          .eq('qr_code', qr_code)
          .eq('main_location_id', locationData.main_location_id)
          .eq('is_active', true)
          .gte('expires_at', new Date().toISOString())
          .single();

        if (!qrError && qrData) {
          location_verified = true;
        }
      }

      // QR 코드가 제공되었지만 검증 실패한 경우
      if (!location_verified) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않거나 만료된 QR 코드입니다.',
          error: 'INVALID_QR_CODE'
        });
      }
    }

    // 데드라인 확인
    let is_on_time = true;
    const { data: deadlineData } = await supabase
      .from('shooter_action_deadlines')
      .select('deadline_time')
      .eq('schedule_id', schedule_id)
      .eq('action_type', action_type)
      .single();

    if (deadlineData && deadlineData.deadline_time) {
      const deadline = new Date(deadlineData.deadline_time);
      const now = new Date();
      if (now > deadline) {
        is_on_time = false;
      }
    }

    // 중복 액션 확인
    const { data: existingAction } = await supabase
      .from('shooter_tracking')
      .select('id')
      .eq('schedule_id', schedule_id)
      .eq('action_type', action_type)
      .single();

    if (existingAction) {
      return res.status(409).json({
        success: false,
        message: '이미 기록된 액션입니다.',
        error: 'DUPLICATE_ACTION'
      });
    }

    // Supabase 함수 호출로 액션 기록
    const { data: actionResult, error: actionError } = await supabase
      .rpc('record_shooter_action', {
        p_schedule_id: schedule_id,
        p_shooter_id: shooter_id,
        p_action_type: action_type,
        p_qr_code: qr_code || null,
        p_notes: notes || null,
        p_photo_url: photo_url || null
      });

    if (actionError) {
      console.error('Supabase function error:', actionError);
      return res.status(500).json({
        success: false,
        message: '액션 기록 중 오류가 발생했습니다.',
        error: 'DATABASE_ERROR'
      });
    }

    // 액션 기록 성공 후 추가 처리
    let additional_data: any = {};

    // 완료 액션인 경우 정산 계산
    if (action_type === 'completion') {
      const { data: settlementResult } = await supabase
        .rpc('calculate_settlement', {
          p_schedule_id: schedule_id
        });

      if (settlementResult) {
        additional_data.settlement_amount = settlementResult;
      }
    }

    // 성공 응답
    return res.status(200).json({
      success: true,
      message: `${getActionKoreanName(action_type)} 액션이 성공적으로 기록되었습니다.`,
      data: {
        schedule_id,
        action_type,
        is_on_time,
        location_verified,
        timestamp: new Date().toISOString(),
        ...additional_data
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// 액션 타입 한국어 변환 함수
function getActionKoreanName(action_type: string): string {
  const actionNames: { [key: string]: string } = {
    'schedule_check': '스케줄 확인',
    'departure': '출발',
    'arrival': '도착',
    'start': '촬영 시작',
    'end': '촬영 종료',
    'completion': '업무 완료'
  };
  
  return actionNames[action_type] || action_type;
}

// 액션 순서 검증 함수
async function validateActionSequence(
  schedule_id: number, 
  new_action: string
): Promise<{ valid: boolean; message?: string }> {
  // 기존 액션들 조회
  const { data: existingActions } = await supabase
    .from('shooter_tracking')
    .select('action_type, action_timestamp')
    .eq('schedule_id', schedule_id)
    .order('action_timestamp', { ascending: true });

  if (!existingActions) {
    return { valid: true };
  }

  const actionOrder = ['schedule_check', 'departure', 'arrival', 'start', 'end', 'completion'];
  const lastAction = existingActions[existingActions.length - 1]?.action_type;
  
  if (!lastAction) {
    return { valid: true };
  }

  const lastActionIndex = actionOrder.indexOf(lastAction);
  const newActionIndex = actionOrder.indexOf(new_action);

  // 순서가 맞지 않는 경우
  if (newActionIndex <= lastActionIndex) {
    return {
      valid: false,
      message: `${getActionKoreanName(lastAction)} 이후에는 ${getActionKoreanName(new_action)}를 수행할 수 없습니다.`
    };
  }

  return { valid: true };
}

// 사진 업로드 검증 함수 (completion 액션용)
function validatePhotoUpload(action_type: string, photo_url?: string): boolean {
  if (action_type === 'completion') {
    return !!photo_url; // completion 액션은 사진 필수
  }
  return true;
}

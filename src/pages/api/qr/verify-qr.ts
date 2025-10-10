import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabaseClient';

interface QRVerifyRequest {
  qr_code: string;
  main_location_id?: number;
  shooter_id?: number;
  schedule_id?: number;
}

interface QRVerificationResult {
  is_valid: boolean;
  qr_code: string;
  location_name?: string;
  main_location_id?: number;
  generated_at?: string;
  expires_at?: string;
  time_remaining?: number; // 남은 시간 (초)
  verification_timestamp: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: QRVerificationResult;
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
      qr_code,
      main_location_id,
      shooter_id,
      schedule_id
    }: QRVerifyRequest = req.body;

    // 필수 필드 검증
    if (!qr_code) {
      return res.status(400).json({
        success: false,
        message: 'QR 코드가 필요합니다.',
        error: 'MISSING_QR_CODE'
      });
    }

    // QR 코드 형식 검증
    if (!isValidQRFormat(qr_code)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 QR 코드 형식입니다.',
        error: 'INVALID_QR_FORMAT',
        data: {
          is_valid: false,
          qr_code,
          verification_timestamp: new Date().toISOString()
        }
      });
    }

    // QR 코드 데이터베이스 조회
    const { data: qrData, error: qrError } = await supabase
      .from('location_qr_codes')
      .select(`
        qr_code,
        main_location_id,
        generated_at,
        expires_at,
        is_active,
        main_locations(name)
      `)
      .eq('qr_code', qr_code)
      .single();

    if (qrError || !qrData) {
      return res.status(404).json({
        success: false,
        message: 'QR 코드를 찾을 수 없습니다.',
        error: 'QR_NOT_FOUND',
        data: {
          is_valid: false,
          qr_code,
          verification_timestamp: new Date().toISOString()
        }
      });
    }

    // QR 코드 활성화 상태 확인
    if (!qrData.is_active) {
      return res.status(400).json({
        success: false,
        message: '비활성화된 QR 코드입니다.',
        error: 'QR_INACTIVE',
        data: {
          is_valid: false,
          qr_code,
          main_location_id: qrData.main_location_id,
          location_name: qrData.main_locations?.name,
          verification_timestamp: new Date().toISOString()
        }
      });
    }

    // QR 코드 만료 시간 확인
    const now = new Date();
    const expiresAt = new Date(qrData.expires_at);
    const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

    if (now > expiresAt) {
      // 만료된 QR 코드 비활성화
      await supabase
        .from('location_qr_codes')
        .update({ is_active: false })
        .eq('qr_code', qr_code);

      return res.status(400).json({
        success: false,
        message: '만료된 QR 코드입니다.',
        error: 'QR_EXPIRED',
        data: {
          is_valid: false,
          qr_code,
          main_location_id: qrData.main_location_id,
          location_name: qrData.main_locations?.name,
          expires_at: qrData.expires_at,
          time_remaining: 0,
          verification_timestamp: new Date().toISOString()
        }
      });
    }

    // 위치 일치 확인 (선택적)
    if (main_location_id && qrData.main_location_id !== main_location_id) {
      return res.status(400).json({
        success: false,
        message: '위치가 일치하지 않습니다.',
        error: 'LOCATION_MISMATCH',
        data: {
          is_valid: false,
          qr_code,
          main_location_id: qrData.main_location_id,
          location_name: qrData.main_locations?.name,
          verification_timestamp: new Date().toISOString()
        }
      });
    }

    // Shooter 권한 확인 (선택적)
    if (shooter_id && schedule_id) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('assigned_shooter_id, sub_location_id, sub_locations(main_location_id)')
        .eq('id', schedule_id)
        .eq('is_active', true)
        .single();

      if (scheduleError || !scheduleData) {
        return res.status(404).json({
          success: false,
          message: '스케줄을 찾을 수 없습니다.',
          error: 'SCHEDULE_NOT_FOUND'
        });
      }

      // Shooter 배정 확인
      if (scheduleData.assigned_shooter_id !== shooter_id) {
        return res.status(403).json({
          success: false,
          message: '해당 스케줄에 배정된 shooter가 아닙니다.',
          error: 'UNAUTHORIZED_SHOOTER'
        });
      }

      // 스케줄 위치와 QR 위치 일치 확인
      if (scheduleData.sub_locations?.main_location_id !== qrData.main_location_id) {
        return res.status(400).json({
          success: false,
          message: '스케줄 위치와 QR 코드 위치가 일치하지 않습니다.',
          error: 'SCHEDULE_LOCATION_MISMATCH'
        });
      }
    }

    // QR 검증 로그 기록 (선택적)
    await logQRVerification(qr_code, shooter_id, true, 'SUCCESS');

    // 검증 성공
    return res.status(200).json({
      success: true,
      message: 'QR 코드 검증이 완료되었습니다.',
      data: {
        is_valid: true,
        qr_code,
        main_location_id: qrData.main_location_id,
        location_name: qrData.main_locations?.name,
        generated_at: qrData.generated_at,
        expires_at: qrData.expires_at,
        time_remaining: timeRemaining,
        verification_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('QR 검증 API 오류:', error);
    
    // 검증 실패 로그 기록
    if (req.body.qr_code) {
      await logQRVerification(req.body.qr_code, req.body.shooter_id, false, 'SERVER_ERROR');
    }

    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// QR 코드 형식 검증 함수
function isValidQRFormat(qrCode: string): boolean {
  // LOC_{location_id}_{timestamp}_{random} 형식 검증
  const qrPattern = /^LOC_\d+_\d+_\d{4}$/;
  return qrPattern.test(qrCode);
}

// QR 검증 로그 기록 함수
async function logQRVerification(
  qrCode: string, 
  shooterId?: number, 
  isValid: boolean = false, 
  result: string = 'UNKNOWN'
): Promise<void> {
  try {
    // 검증 로그를 별도 테이블에 기록 (선택적)
    // 실제 구현시에는 qr_verification_logs 테이블을 생성하여 사용
    console.log('QR 검증 로그:', {
      qr_code: qrCode,
      shooter_id: shooterId,
      is_valid: isValid,
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('QR 로그 기록 오류:', error);
  }
}

// QR 코드에서 위치 ID 추출 함수
function extractLocationIdFromQR(qrCode: string): number | null {
  try {
    const parts = qrCode.split('_');
    if (parts.length >= 2 && parts[0] === 'LOC') {
      return parseInt(parts[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// QR 코드 만료까지 남은 시간 계산 (분:초 형식)
function formatTimeRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

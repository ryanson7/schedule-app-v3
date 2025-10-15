export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabaseClient';

interface QRGenerateRequest {
  main_location_id: number;
  force_regenerate?: boolean;
}

interface QRCodeData {
  qr_code: string;
  generated_at: string;
  expires_at: string;
  main_location_id: number;
  location_name?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: QRCodeData;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // GET, POST 메소드 허용
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET or POST.',
      error: 'INVALID_METHOD'
    });
  }

  try {
    let main_location_id: number;
    let force_regenerate = false;

    // 요청 방식에 따른 파라미터 추출
    if (req.method === 'GET') {
      main_location_id = parseInt(req.query.main_location_id as string);
      force_regenerate = req.query.force_regenerate === 'true';
    } else {
      const body: QRGenerateRequest = req.body;
      main_location_id = body.main_location_id;
      force_regenerate = body.force_regenerate || false;
    }

    // 필수 필드 검증
    if (!main_location_id || isNaN(main_location_id)) {
      return res.status(400).json({
        success: false,
        message: '유효한 위치 ID가 필요합니다.',
        error: 'INVALID_LOCATION_ID'
      });
    }

    // 위치 존재 여부 확인
    const { data: location, error: locationError } = await supabase
      .from('main_locations')
      .select('id, name, is_active')
      .eq('id', main_location_id)
      .eq('is_active', true)
      .single();

    if (locationError || !location) {
      return res.status(404).json({
        success: false,
        message: '위치를 찾을 수 없습니다.',
        error: 'LOCATION_NOT_FOUND'
      });
    }

    // 강제 재생성이 아닌 경우, 기존 유효한 QR 코드 확인
    if (!force_regenerate) {
      const { data: existingQR, error: qrError } = await supabase
        .from('location_qr_codes')
        .select('qr_code, generated_at, expires_at')
        .eq('main_location_id', main_location_id)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      // 유효한 QR 코드가 존재하는 경우 반환
      if (!qrError && existingQR) {
        return res.status(200).json({
          success: true,
          message: '기존 QR 코드를 반환합니다.',
          data: {
            qr_code: existingQR.qr_code,
            generated_at: existingQR.generated_at,
            expires_at: existingQR.expires_at,
            main_location_id: main_location_id,
            location_name: location.name
          }
        });
      }
    }

    // Supabase 함수를 통한 새 QR 코드 생성
    const { data: newQRCode, error: generateError } = await supabase
      .rpc('generate_location_qr_code', {
        location_id: main_location_id
      });

    if (generateError || !newQRCode) {
      console.error('QR 생성 오류:', generateError);
      return res.status(500).json({
        success: false,
        message: 'QR 코드 생성 중 오류가 발생했습니다.',
        error: 'QR_GENERATION_FAILED'
      });
    }

    // 생성된 QR 코드 정보 조회
    const { data: qrDetails, error: detailsError } = await supabase
      .from('location_qr_codes')
      .select('qr_code, generated_at, expires_at')
      .eq('qr_code', newQRCode)
      .eq('is_active', true)
      .single();

    if (detailsError || !qrDetails) {
      return res.status(500).json({
        success: false,
        message: '생성된 QR 코드 정보를 가져올 수 없습니다.',
        error: 'QR_DETAILS_FETCH_FAILED'
      });
    }

    // 성공 응답
    return res.status(200).json({
      success: true,
      message: force_regenerate ? 
        '새로운 QR 코드가 생성되었습니다.' : 
        'QR 코드가 생성되었습니다.',
      data: {
        qr_code: qrDetails.qr_code,
        generated_at: qrDetails.generated_at,
        expires_at: qrDetails.expires_at,
        main_location_id: main_location_id,
        location_name: location.name
      }
    });

  } catch (error) {
    console.error('QR API Error:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// QR 코드 만료 시간 계산 (1분)
function getExpirationTime(): string {
  const now = new Date();
  const expiration = new Date(now.getTime() + 60 * 1000); // 1분 후
  return expiration.toISOString();
}

// QR 코드 포맷 검증
function isValidQRFormat(qrCode: string): boolean {
  // LOC_{location_id}_{timestamp}_{random} 형식 검증
  const qrPattern = /^LOC_\d+_\d+_\d{4}$/;
  return qrPattern.test(qrCode);
}

// 만료된 QR 코드 정리 (선택적)
async function cleanupExpiredQRCodes(main_location_id: number): Promise<void> {
  try {
    await supabase
      .from('location_qr_codes')
      .update({ is_active: false })
      .eq('main_location_id', main_location_id)
      .lt('expires_at', new Date().toISOString());
  } catch (error) {
    console.error('QR 정리 오류:', error);
  }
}

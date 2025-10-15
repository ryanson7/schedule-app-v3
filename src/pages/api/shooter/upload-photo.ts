export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabaseClient';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

interface UploadPhotoRequest {
  shooter_id: string;
  schedule_id: string;
  file: formidable.File;
}

interface PhotoData {
  photo_url: string;
  file_name: string;
  file_size: number;
  upload_timestamp: string;
  watermarked_url?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: PhotoData;
  error?: string;
}

// formidable 설정
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.',
      error: 'INVALID_METHOD'
    });
  }

  try {
    // 파일 파싱
    const { fields, files } = await parseForm(req);
    
    const shooter_id = Array.isArray(fields.shooter_id) ? fields.shooter_id[0] : fields.shooter_id;
    const schedule_id = Array.isArray(fields.schedule_id) ? fields.schedule_id[0] : fields.schedule_id;
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    // 필수 필드 검증
    if (!shooter_id || !schedule_id || !file) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다.',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // 파일 유효성 검증
    const validationResult = validateFile(file);
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message || '유효하지 않은 파일입니다.',
        error: 'INVALID_FILE'
      });
    }

    // 스케줄 및 shooter 권한 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('id, assigned_shooter_id, course_name, shoot_date, professor_name')
      .eq('id', schedule_id)
      .eq('assigned_shooter_id', shooter_id)
      .eq('is_active', true)
      .single();

    if (scheduleError || !schedule) {
      return res.status(403).json({
        success: false,
        message: '권한이 없거나 스케줄을 찾을 수 없습니다.',
        error: 'UNAUTHORIZED_OR_NOT_FOUND'
      });
    }

    // 파일명 생성 (워터마크 정보 포함)
    const timestamp = new Date().toISOString();
    const fileExtension = path.extname(file.originalFilename || '.jpg');
    const fileName = `completion_${schedule_id}_${shooter_id}_${Date.now()}${fileExtension}`;

    // Supabase Storage에 업로드
    const fileBuffer = fs.readFileSync(file.filepath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('completion-photos')
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype || 'image/jpeg',
        metadata: {
          shooter_id: shooter_id,
          schedule_id: schedule_id,
          original_name: file.originalFilename || 'unknown',
          upload_timestamp: timestamp
        }
      });

    if (uploadError) {
      console.error('파일 업로드 오류:', uploadError);
      return res.status(500).json({
        success: false,
        message: '파일 업로드 중 오류가 발생했습니다.',
        error: 'UPLOAD_FAILED'
      });
    }

    // 업로드된 파일의 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('completion-photos')
      .getPublicUrl(fileName);

    const photoUrl = urlData.publicUrl;

    // 워터마크 추가 (선택적)
    let watermarkedUrl = photoUrl;
    try {
      watermarkedUrl = await addWatermark(photoUrl, {
        shooter_id: shooter_id,
        schedule_id: schedule_id,
        professor_name: schedule.professor_name,
        course_name: schedule.course_name,
        shoot_date: schedule.shoot_date,
        timestamp: timestamp
      });
    } catch (watermarkError) {
      console.error('워터마크 추가 오류:', watermarkError);
      // 워터마크 실패해도 원본 URL 사용
    }

    // 스케줄에 사진 URL 업데이트
    const { error: updateError } = await supabase
      .from('schedules')
      .update({
        completion_photo_url: watermarkedUrl,
        updated_at: timestamp
      })
      .eq('id', schedule_id);

    if (updateError) {
      console.error('스케줄 업데이트 오류:', updateError);
      // 사진은 업로드되었으므로 경고만 로그
    }

    // 업로드 로그 기록
    await logPhotoUpload({
      shooter_id: parseInt(shooter_id),
      schedule_id: parseInt(schedule_id),
      photo_url: watermarkedUrl,
      file_name: fileName,
      file_size: file.size || 0,
      original_name: file.originalFilename || 'unknown'
    });

    // 임시 파일 정리
    try {
      fs.unlinkSync(file.filepath);
    } catch (cleanupError) {
      console.error('임시 파일 정리 오류:', cleanupError);
    }

    // 성공 응답
    return res.status(200).json({
      success: true,
      message: '사진이 성공적으로 업로드되었습니다.',
      data: {
        photo_url: watermarkedUrl,
        file_name: fileName,
        file_size: file.size || 0,
        upload_timestamp: timestamp,
        watermarked_url: watermarkedUrl !== photoUrl ? watermarkedUrl : undefined
      }
    });

  } catch (error) {
    console.error('사진 업로드 API 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// 폼 파싱 함수
function parseForm(req: NextApiRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB 제한
      allowEmptyFiles: false,
      keepExtensions: true
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({ fields, files });
      }
    });
  });
}

// 파일 유효성 검증 함수
function validateFile(file: formidable.File): { valid: boolean; message?: string } {
  // 파일 크기 검증 (10MB 제한)
  if (file.size && file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      message: '파일 크기는 10MB를 초과할 수 없습니다.'
    };
  }

  // 파일 형식 검증
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      message: '지원되지 않는 파일 형식입니다. (JPEG, PNG, WebP만 허용)'
    };
  }

  // 파일 확장자 검증
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const fileExtension = path.extname(file.originalFilename || '').toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      message: '지원되지 않는 파일 확장자입니다.'
    };
  }

  return { valid: true };
}

// 워터마크 추가 함수
async function addWatermark(
  imageUrl: string, 
  watermarkData: {
    shooter_id: string;
    schedule_id: string;
    professor_name: string;
    course_name: string;
    shoot_date: string;
    timestamp: string;
  }
): Promise<string> {
  try {
    // 실제 구현에서는 이미지 처리 라이브러리 사용
    // 예: sharp, canvas, 또는 외부 이미지 처리 서비스
    
    // 워터마크 텍스트 생성
    const watermarkText = [
      `Shooter ID: ${watermarkData.shooter_id}`,
      `교수: ${watermarkData.professor_name}`,
      `강의: ${watermarkData.course_name}`,
      `날짜: ${watermarkData.shoot_date}`,
      `완료시간: ${new Date(watermarkData.timestamp).toLocaleString('ko-KR')}`
    ].join('\n');

    // 실제로는 이미지에 워터마크를 추가하고 새 URL 반환
    // 지금은 시뮬레이션으로 원본 URL 반환
    console.log('워터마크 텍스트:', watermarkText);
    
    // 실제 구현 예시:
    // const watermarkedBuffer = await addTextWatermark(imageBuffer, watermarkText);
    // const watermarkedFileName = `watermarked_${Date.now()}.jpg`;
    // const { data } = await supabase.storage
    //   .from('completion-photos')
    //   .upload(watermarkedFileName, watermarkedBuffer);
    // return supabase.storage.from('completion-photos').getPublicUrl(watermarkedFileName).data.publicUrl;

    return imageUrl; // 임시로 원본 URL 반환
  } catch (error) {
    console.error('워터마크 추가 실패:', error);
    return imageUrl; // 실패 시 원본 URL 반환
  }
}

// 사진 업로드 로그 기록 함수
async function logPhotoUpload(logData: {
  shooter_id: number;
  schedule_id: number;
  photo_url: string;
  file_name: string;
  file_size: number;
  original_name: string;
}): Promise<void> {
  try {
    // 업로드 로그를 별도 테이블에 기록 (선택적)
    // 실제 구현시에는 photo_upload_logs 테이블을 생성하여 사용
    console.log('사진 업로드 로그:', {
      ...logData,
      upload_timestamp: new Date().toISOString()
    });

    // 실제 로그 테이블 삽입 예시:
    // await supabase
    //   .from('photo_upload_logs')
    //   .insert({
    //     ...logData,
    //     upload_timestamp: new Date().toISOString()
    //   });

  } catch (error) {
    console.error('사진 업로드 로그 기록 오류:', error);
  }
}

// 이미지 메타데이터 추출 함수 (선택적)
function extractImageMetadata(file: formidable.File): any {
  return {
    size: file.size,
    type: file.mimetype,
    lastModified: file.lastModifiedDate,
    originalName: file.originalFilename
  };
}

// 파일 이름 안전화 함수
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

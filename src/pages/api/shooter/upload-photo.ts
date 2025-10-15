export const config = {
  runtime: 'edge',
};

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  uploadToGoogleDrive,
  makeFilePublic,
  refreshAccessToken
} from '@/lib/googleDrive';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405, headers }
    );
  }

  try {
    console.log('📸 구글 드라이브 업로드 시작');

    // FormData 파싱
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const scheduleId = formData.get('scheduleId') as string;
    const shooterId = formData.get('shooterId') as string;
    const location = formData.get('location') as string;

    // 필수 필드 검증
    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다' },
        { status: 400, headers }
      );
    }

    if (!scheduleId || !shooterId) {
      return NextResponse.json(
        { error: 'scheduleId와 shooterId는 필수입니다' },
        { status: 400, headers }
      );
    }

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: '파일 크기는 10MB 이하여야 합니다' },
        { status: 400, headers }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다 (JPG, PNG, WebP만 가능)' },
        { status: 400, headers }
      );
    }

    console.log('✅ 파일 검증 완료:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Access Token 가져오기
    let accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN!;
    
    // 토큰 만료 시 자동 갱신 (선택사항)
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      try {
        accessToken = await refreshAccessToken();
        console.log('🔄 Access token 갱신 완료');
      } catch (error) {
        console.error('⚠️  토큰 갱신 실패, 기존 토큰 사용:', error);
      }
    }

    // 파일을 ArrayBuffer로 변환
    const fileBuffer = await file.arrayBuffer();
    
    // 파일명 생성
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${shooterId}_${scheduleId}_${timestamp}.${fileExt}`;

    console.log('📤 구글 드라이브 업로드 시작:', fileName);

    // Google Drive에 업로드
    const driveFile = await uploadToGoogleDrive(
      fileBuffer,
      fileName,
      file.type,
      accessToken,
      process.env.GOOGLE_DRIVE_FOLDER_ID
    );

    console.log('✅ 구글 드라이브 업로드 완료:', driveFile);

    // 파일을 공개로 설정하고 공유 링크 생성
    const publicUrl = await makeFilePublic(driveFile.id, accessToken);

    console.log('🔗 공개 URL 생성:', publicUrl);

    // DB에 사진 정보 저장
    const { data: dbData, error: dbError } = await supabase
      .from('shooting_photos')
      .insert({
        schedule_id: scheduleId,
        shooter_id: shooterId,
        file_path: driveFile.id,
        file_url: publicUrl,
        file_name: fileName,
        file_size: file.size,
        file_type: file.type,
        location: location,
        storage_type: 'google_drive',
        drive_web_view_link: driveFile.webViewLink,
        uploaded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('⚠️  DB 저장 실패 (업로드는 성공):', dbError);
    }

    console.log('✅ 사진 업로드 완료!');

    return NextResponse.json(
      {
        success: true,
        message: '사진이 구글 드라이브에 성공적으로 업로드되었습니다',
        data: {
          fileId: driveFile.id,
          fileName: fileName,
          fileUrl: publicUrl,
          webViewLink: driveFile.webViewLink,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          dbRecord: dbData
        }
      },
      { status: 200, headers }
    );

  } catch (error: any) {
    console.error('❌ 업로드 처리 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || '알 수 없는 오류가 발생했습니다',
        details: error.toString()
      },
      { status: 500, headers }
    );
  }
}

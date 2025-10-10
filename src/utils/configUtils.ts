// src/utils/configUtils.ts
import { supabase } from '../utils/supabaseClient';
import { APP_CONFIG } from '../config/constants';

// 스튜디오 메인 위치 ID 동적 조회
export const getStudioMainLocationId = async (): Promise<number | null> => {
  try {
    const { data, error } = await supabase
      .from('main_locations')
      .select('id')
      .eq('location_type', 'studio')
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      console.warn('스튜디오 메인 위치를 찾을 수 없습니다.');
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('스튜디오 위치 조회 오류:', error);
    return null;
  }
};

// ✅ 수정된 변환 함수 (src/utils/configUtils.ts)
export const determineUserTypeFromShooterType = (shooterType: string | null | undefined): string => {
  // ✅ shooters 테이블에 정보가 없는 경우 (정규직)
  if (!shooterType) {
    console.log('⚠️ shooter_type이 없음, regular로 설정 (정규직)');
    return 'regular';
  }

  const normalizedType = shooterType.toLowerCase().trim();
  console.log(`🔄 shooter_type 변환: "${shooterType}" -> "${normalizedType}"`);
  
  switch (normalizedType) {
    case 'dispatch':
      return 'dispatch';
    case 'freelancer':
      return 'freelancer';
    default:
      return 'regular'; // ✅ 기타 값도 regular로 처리
  }
};


// ✅ shooter_type 기반 직급명
export const getPositionName = (shooterType: string | null | undefined): string => {
  if (!shooterType) {
    return '정규 촬영자';
  }

  const normalizedType = shooterType.toLowerCase().trim();
  
  switch (normalizedType) {
    case 'dispatch':
      return '파견 촬영자';
    case 'freelancer':
      return '프리랜서';
    case 'regular':
    case '':
    default:
      return '정규 촬영자';
  }
};

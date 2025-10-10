import { supabase } from './supabaseClient';

export const sendAdminResponseNotification = async (params: {
  schedule_id: number;
  action_type: string;
  admin_id: number;
  response_data: any;
}) => {
  try {
    // 🔥 recipient_id 다중 확인
    const recipientId = 
      params.response_data?.requested_by ||
      params.response_data?.recipient_id ||
      params.admin_id; // 최후 fallback

    if (!recipientId || recipientId === null || recipientId <= 0) {
      console.warn('⚠️ 알림 전송 실패: 유효하지 않은 recipient_id', recipientId);
      return { success: false, message: '수신자 정보 없음' };
    }

    console.log('📤 알림 전송 시도:', {
      schedule_id: params.schedule_id,
      recipient_id: recipientId,
      action_type: params.action_type,
      admin_id: params.admin_id
    });

    // 🔥 PostgreSQL 함수 파라미터 명시적 매핑
    const { error } = await supabase.rpc('send_admin_response_notification', {
      p_schedule_id: params.schedule_id,
      p_admin_id: params.admin_id,
      p_requester_id: recipientId,
      p_response_type: params.action_type
    });

    if (error) {
      console.error('⚠️ PostgreSQL 함수 실행 오류:', error);
      throw error;
    }
    
    console.log('✅ 알림 전송 성공');
    return { success: true, message: '알림 전송 완료' };
    
  } catch (error) {
    console.warn('⚠️ 알림 전송 실패:', error);
    return { success: false, message: '알림 전송 실패' };
  }
};

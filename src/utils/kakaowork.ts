// utils/kakaowork.ts
import type { 
  ScheduleInfo, 
  SendScheduleNotificationRequest,
  KakaoWorkBlock 
} from '../types/kakaowork';

/**
 * 스케줄 정보로 카카오워크 메시지 생성
 */
export function createScheduleMessage(
  schedule: ScheduleInfo, 
  customMessage?: string
): string {
  const defaultMessage = `🎬 **촬영 스케줄 알림**

안녕하세요! 이번주 촬영이 배정되었습니다. 확인해주세요.

📅 **촬영일**: ${schedule.shoot_date}
⏰ **시간**: ${schedule.start_time?.substring(0, 5)} ~ ${schedule.end_time?.substring(0, 5)}
📍 **장소**: ${schedule.sub_locations?.main_locations?.name} - ${schedule.sub_locations?.name}
👨‍🏫 **강사**: ${schedule.professor_name} / ${schedule.course_name}`;

  return customMessage 
    ? `${defaultMessage}\n\n📝 **전달사항**:\n${customMessage}`
    : defaultMessage;
}

/**
 * 카카오워크 메시지 발송
 */
export async function sendScheduleNotification(
  schedule: ScheduleInfo, 
  shooterInfo: { 
    kakaowork_user_id?: string; 
    auth_id: string; 
    name: string 
  },
  customMessage?: string
): Promise<boolean> {
  try {
    const kakaoworkUserId = shooterInfo.kakaowork_user_id || shooterInfo.auth_id;
    const message = createScheduleMessage(schedule, customMessage);

    const response = await fetch('/api/kakaowork/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: kakaoworkUserId,
        userName: shooterInfo.name,
        message: message,
        scheduleId: schedule.id
      } as SendScheduleNotificationRequest)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '메시지 발송 실패');
    }

    const result = await response.json();
    console.log('✅ 카카오워크 메시지 발송 성공:', result.messageId);
    return true;

  } catch (error: any) {
    console.error('❌ 카카오워크 메시지 발송 실패:', error.message);
    return false;
  }
}

/**
 * 카카오워크 사용자 ID 조회 (이메일 기반)
 */
export async function findKakaoworkUserByEmail(email: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/kakaowork/find-user?email=${encodeURIComponent(email)}`);
    
    if (response.ok) {
      const data = await response.json();
      return data.userId;
    }
    return null;
  } catch (error) {
    console.error('카카오워크 사용자 조회 오류:', error);
    return null;
  }
}

/**
 * 메시지 템플릿 생성
 */
export function createMessageBlocks(
  message: string, 
  scheduleId?: number
): KakaoWorkBlock[] {
  const blocks: KakaoWorkBlock[] = [
    {
      type: "text",
      text: message,
      markdown: true
    },
    {
      type: "divider"
    }
  ];

  // 버튼 추가
  if (scheduleId) {
    blocks.push({
      type: "button_group",
      buttons: [
        {
          type: "button",
          text: "스케줄 확인하기",
          style: "primary",
          action_type: "open_inapp_browser",
          value: `${process.env.NEXT_PUBLIC_BASE_URL}/shooter/schedule-check`
        },
        {
          type: "button",
          text: "문의하기",
          style: "default",
          action_type: "open_inapp_browser",
          value: `${process.env.NEXT_PUBLIC_BASE_URL}/contact`
        }
      ]
    });
  }

  return blocks;
}

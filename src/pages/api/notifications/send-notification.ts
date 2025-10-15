export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabaseClient';

interface SendNotificationRequest {
  recipient_ids?: number[];
  recipient_roles?: string[];
  sender_id: number;
  schedule_id?: number;
  notification_type: string;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  auto_read_timeout?: number; // 자동 읽음 처리 시간 (분)
}

interface NotificationRecipient {
  user_id: number;
  user_name: string;
  user_role: string;
  delivery_status: 'pending' | 'sent' | 'failed';
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    notification_id?: number;
    recipients: NotificationRecipient[];
    total_sent: number;
    failed_count: number;
  };
  error?: string;
}

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
    const {
      recipient_ids,
      recipient_roles,
      sender_id,
      schedule_id,
      notification_type,
      title,
      message,
      priority = 'normal',
      auto_read_timeout
    }: SendNotificationRequest = req.body;

    // 필수 필드 검증
    if (!sender_id || !notification_type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다.',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // 수신자 또는 역할 중 하나는 반드시 제공되어야 함
    if (!recipient_ids?.length && !recipient_roles?.length) {
      return res.status(400).json({
        success: false,
        message: '수신자 ID 또는 역할을 지정해야 합니다.',
        error: 'NO_RECIPIENTS'
      });
    }

    // 발신자 검증
    const { data: sender, error: senderError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', sender_id)
      .eq('deleted_at', null)
      .single();

    if (senderError || !sender) {
      return res.status(404).json({
        success: false,
        message: '발신자를 찾을 수 없습니다.',
        error: 'SENDER_NOT_FOUND'
      });
    }

    // 스케줄 검증 (선택적)
    if (schedule_id) {
      const { data: schedule, error: scheduleError } = await supabase
        .from('schedules')
        .select('id, course_name, professor_name')
        .eq('id', schedule_id)
        .eq('is_active', true)
        .single();

      if (scheduleError || !schedule) {
        return res.status(404).json({
          success: false,
          message: '관련 스케줄을 찾을 수 없습니다.',
          error: 'SCHEDULE_NOT_FOUND'
        });
      }
    }

    // 수신자 목록 구성
    let recipients: any[] = [];

    // ID로 지정된 수신자 조회
    if (recipient_ids?.length) {
      const { data: idRecipients, error: idError } = await supabase
        .from('users')
        .select('id, name, role')
        .in('id', recipient_ids)
        .eq('deleted_at', null);

      if (!idError && idRecipients) {
        recipients = [...recipients, ...idRecipients];
      }
    }

    // 역할로 지정된 수신자 조회
    if (recipient_roles?.length) {
      const { data: roleRecipients, error: roleError } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', recipient_roles)
        .eq('deleted_at', null);

      if (!roleError && roleRecipients) {
        recipients = [...recipients, ...roleRecipients];
      }
    }

    // 중복 제거
    const uniqueRecipients = recipients.filter((recipient, index, self) =>
      index === self.findIndex(r => r.id === recipient.id)
    );

    if (uniqueRecipients.length === 0) {
      return res.status(404).json({
        success: false,
        message: '유효한 수신자를 찾을 수 없습니다.',
        error: 'NO_VALID_RECIPIENTS'
      });
    }

    // 알림 발송 결과 추적
    const deliveryResults: NotificationRecipient[] = [];
    let successCount = 0;
    let failCount = 0;

    // 각 수신자에게 알림 발송
    for (const recipient of uniqueRecipients) {
      try {
        // 개별 알림 레코드 생성
        const { data: notificationData, error: insertError } = await supabase
          .from('push_notifications')
          .insert({
            user_id: recipient.id,
            sender_id: sender_id,
            related_schedule_id: schedule_id || null,
            notification_type: notification_type,
            title: title,
            message: message,
            is_read: false,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`수신자 ${recipient.id}에게 알림 발송 실패:`, insertError);
          deliveryResults.push({
            user_id: recipient.id,
            user_name: recipient.name,
            user_role: recipient.role,
            delivery_status: 'failed'
          });
          failCount++;
        } else {
          deliveryResults.push({
            user_id: recipient.id,
            user_name: recipient.name,
            user_role: recipient.role,
            delivery_status: 'sent'
          });
          successCount++;

          // 자동 읽음 처리 설정 (선택적)
          if (auto_read_timeout && auto_read_timeout > 0) {
            await scheduleAutoRead(notificationData.id, auto_read_timeout);
          }

          // 실시간 푸시 알림 발송 (WebSocket, FCM 등)
          await sendRealTimePush(recipient.id, {
            title,
            message,
            notification_type,
            priority,
            schedule_id
          });
        }
      } catch (error) {
        console.error(`수신자 ${recipient.id} 처리 중 오류:`, error);
        deliveryResults.push({
          user_id: recipient.id,
          user_name: recipient.name,
          user_role: recipient.role,
          delivery_status: 'failed'
        });
        failCount++;
      }
    }

    // 발송 로그 기록
    await logNotificationSent({
      sender_id,
      notification_type,
      title,
      total_recipients: uniqueRecipients.length,
      success_count: successCount,
      fail_count: failCount,
      schedule_id
    });

    // 응답 생성
    const responseMessage = failCount > 0 
      ? `알림 발송 완료 (성공: ${successCount}, 실패: ${failCount})`
      : `알림이 성공적으로 발송되었습니다 (${successCount}명)`;

    return res.status(200).json({
      success: true,
      message: responseMessage,
      data: {
        recipients: deliveryResults,
        total_sent: successCount,
        failed_count: failCount
      }
    });

  } catch (error) {
    console.error('알림 발송 API 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// 실시간 푸시 알림 발송 함수
async function sendRealTimePush(
  userId: number,
  notificationData: {
    title: string;
    message: string;
    notification_type: string;
    priority: string;
    schedule_id?: number;
  }
): Promise<void> {
  try {
    // 실제 구현에서는 WebSocket, FCM, 또는 기타 푸시 서비스 사용
    // 예: Firebase Cloud Messaging, Socket.io, Server-Sent Events 등
    
    console.log(`실시간 푸시 알림 발송 - 사용자 ${userId}:`, notificationData);
    
    // WebSocket 예시 (실제 구현 시):
    // const wsClients = getWebSocketClients();
    // const userSocket = wsClients.get(userId);
    // if (userSocket && userSocket.readyState === WebSocket.OPEN) {
    //   userSocket.send(JSON.stringify({
    //     type: 'notification',
    //     data: notificationData
    //   }));
    // }

    // FCM 예시 (실제 구현 시):
    // const fcmToken = await getUserFCMToken(userId);
    // if (fcmToken) {
    //   await admin.messaging().send({
    //     token: fcmToken,
    //     notification: {
    //       title: notificationData.title,
    //       body: notificationData.message
    //     },
    //     data: {
    //       notification_type: notificationData.notification_type,
    //       schedule_id: notificationData.schedule_id?.toString() || ''
    //     }
    //   });
    // }

  } catch (error) {
    console.error('실시간 푸시 발송 오류:', error);
    // 실시간 푸시 실패해도 DB 알림은 성공으로 처리
  }
}

// 자동 읽음 처리 스케줄링 함수
async function scheduleAutoRead(notificationId: number, timeoutMinutes: number): Promise<void> {
  try {
    // 실제 구현에서는 작업 큐나 스케줄러 사용
    // 예: Bull Queue, node-cron, 또는 Supabase Edge Functions
    
    console.log(`알림 ${notificationId} - ${timeoutMinutes}분 후 자동 읽음 처리 예약`);
    
    // 간단한 setTimeout 예시 (실제로는 지속적인 스케줄러 사용 권장)
    setTimeout(async () => {
      try {
        await supabase
          .from('push_notifications')
          .update({ 
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', notificationId)
          .eq('is_read', false); // 아직 읽지 않은 경우만
      } catch (error) {
        console.error('자동 읽음 처리 오류:', error);
      }
    }, timeoutMinutes * 60 * 1000);

  } catch (error) {
    console.error('자동 읽음 스케줄링 오류:', error);
  }
}

// 알림 발송 로그 기록 함수
async function logNotificationSent(logData: {
  sender_id: number;
  notification_type: string;
  title: string;
  total_recipients: number;
  success_count: number;
  fail_count: number;
  schedule_id?: number;
}): Promise<void> {
  try {
    // 발송 로그를 별도 테이블에 기록 (선택적)
    // 실제 구현시에는 notification_logs 테이블을 생성하여 사용
    console.log('알림 발송 로그:', {
      ...logData,
      sent_at: new Date().toISOString()
    });

    // 실제 로그 테이블 삽입 예시:
    // await supabase
    //   .from('notification_logs')
    //   .insert({
    //     ...logData,
    //     sent_at: new Date().toISOString()
    //   });

  } catch (error) {
    console.error('알림 로그 기록 오류:', error);
  }
}

// 알림 템플릿 적용 함수 (선택적)
function applyNotificationTemplate(
  templateType: string,
  variables: { [key: string]: any }
): { title: string; message: string } {
  const templates = {
    'shooter_departure': {
      title: 'Shooter 출발 알림',
      message: '{shooter_name}님이 {location_name} 촬영을 위해 출발했습니다.'
    },
    'shooter_arrival': {
      title: 'Shooter 도착 알림',
      message: '{shooter_name}님이 {location_name}에 도착했습니다.'
    },
    'shooting_completed': {
      title: '촬영 완료 알림',
      message: '{course_name} 촬영이 완료되었습니다. (교수: {professor_name})'
    },
    'schedule_approved': {
      title: '스케줄 승인 완료',
      message: '{course_name} 스케줄이 승인되었습니다.'
    },
    'schedule_rejected': {
      title: '스케줄 승인 거부',
      message: '{course_name} 스케줄이 거부되었습니다. 사유: {reason}'
    }
  };

  const template = templates[templateType as keyof typeof templates];
  if (!template) {
    return { title: '알림', message: '새로운 알림이 있습니다.' };
  }

  let title = template.title;
  let message = template.message;

  // 변수 치환
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    title = title.replace(new RegExp(placeholder, 'g'), String(value));
    message = message.replace(new RegExp(placeholder, 'g'), String(value));
  });

  return { title, message };
}

// 알림 우선순위별 처리 함수
function getPriorityConfig(priority: string) {
  const configs = {
    'low': {
      sound: false,
      vibrate: false,
      badge: false
    },
    'normal': {
      sound: true,
      vibrate: false,
      badge: true
    },
    'high': {
      sound: true,
      vibrate: true,
      badge: true
    },
    'urgent': {
      sound: true,
      vibrate: true,
      badge: true,
      persistent: true
    }
  };

  return configs[priority as keyof typeof configs] || configs.normal;
}

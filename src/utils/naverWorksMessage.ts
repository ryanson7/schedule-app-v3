// src/utils/naverWorksMessage.ts

// ✅ 1. 승인 요청 메시지
export const sendApprovalRequest = (schedule: any, requestType: 'edit' | 'cancel'): void => {
  console.log('📨 메시지 발송 (가상)');
  console.log(`✅ ${requestType === 'edit' ? '수정' : '취소'} 승인 요청`);
  console.log(`교수: ${schedule.professor_name}`);
  console.log(`날짜: ${schedule.shoot_date}`);
  console.log(`시간: ${schedule.start_time} ~ ${schedule.end_time}`);
};

// ✅ 2. 승인 완료 메시지
export const sendApprovalComplete = (schedule: any, managerUserId: string, approved: boolean): void => {
  console.log('📨 메시지 발송 (가상)');
  console.log(`✅ ${approved ? '승인' : '거부'} 완료`);
  console.log(`교수: ${schedule.professor_name}`);
};

// ✅ 3. 전체 공지 메시지
export const sendScheduleNotice = (noticeType: 'start' | 'end' | 'reminder'): void => {
  console.log('📨 메시지 발송 (가상)');
  console.log(`✅ 공지: ${noticeType}`);
};

// ✅ 4. 일반 메시지
export const sendMessage = (messageText: string, targetType: 'users' | 'channel', targets: string[]): void => {
  console.log('📨 메시지 발송 (가상)');
  console.log(`✅ 메시지: ${messageText}`);
};

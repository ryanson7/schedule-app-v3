// utils/naverWorksMessage.ts (백그라운드 처리 + 타임아웃 방지 버전)

// ✅ 1. 승인 요청 메시지 (매니저 → 관리자들) - 백그라운드 처리
export const sendApprovalRequest = (schedule: any, requestType: 'edit' | 'cancel'): void => {
  const messageText = `${requestType === 'edit' ? '수정' : '취소'} 승인 요청

교수명: ${schedule.professor_name}
촬영일: ${schedule.shoot_date}
시간: ${schedule.start_time?.substring(0,5)} ~ ${schedule.end_time?.substring(0,5)}
스튜디오: ${schedule.sub_locations?.name}번 스튜디오
촬영형식: ${schedule.shooting_type}

관리자 페이지에서 승인 처리해주세요.`;

  console.log('📨 승인 요청 메시지 발송 시작 (백그라운드)');

  // ✅ 백그라운드 발송 (await 없음)
  fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'approval_request',
      message: messageText,
      scheduleData: schedule
    })
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        console.log('✅ 승인 요청 메시지 발송 성공');
      } else {
        console.warn('⚠️ 승인 요청 메시지 발송 실패:', result.error);
      }
    })
    .catch(error => {
      console.error('❌ 승인 요청 메시지 발송 오류:', error);
    });
};

// ✅ 2. 승인 완료 메시지 (관리자 → 매니저) - 백그라운드 처리
export const sendApprovalComplete = (schedule: any, managerUserId: string, approved: boolean): void => {
  const messageText = `${approved ? '승인' : '거부'} 완료

교수명: ${schedule.professor_name}
촬영일: ${schedule.shoot_date}
시간: ${schedule.start_time?.substring(0,5)} ~ ${schedule.end_time?.substring(0,5)}

${approved ? '요청하신 작업을 진행하실 수 있습니다.' : '요청이 거부되었습니다. 문의사항이 있으시면 연락주세요.'}`;

  console.log('📨 승인 완료 메시지 발송 시작 (백그라운드)');

  // ✅ 백그라운드 발송 (await 없음)
  fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'approval_complete',
      targetUsers: [managerUserId],
      message: messageText
    })
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        console.log('✅ 승인 완료 메시지 발송 성공');
      } else {
        console.warn('⚠️ 승인 완료 메시지 발송 실패:', result.error);
      }
    })
    .catch(error => {
      console.error('❌ 승인 완료 메시지 발송 오류:', error);
    });
};

// ✅ 3. 전체 공지 메시지 (스케줄 등록 기간 안내) - 백그라운드 처리
export const sendScheduleNotice = (noticeType: 'start' | 'end' | 'reminder'): void => {
  let messageText = '';
  
  switch (noticeType) {
    case 'start':
      messageText = `스케줄 등록 기간 시작 안내

등록 기간: 오늘부터 2주간
대상: 차차주 촬영 스케줄
마감: 목요일 23:59

스케줄 등록 페이지에서 등록해주세요.`;
      break;
      
    case 'end':
      messageText = `스케줄 등록 마감 안내

오늘 23:59에 등록이 마감됩니다.
미등록 스케줄이 있다면 서둘러 등록해주세요.

이후 수정은 승인 절차가 필요합니다.`;
      break;
      
    case 'reminder':
      messageText = `스케줄 등록 알림

등록 마감까지 1일 남았습니다.
등록하지 않은 스케줄이 있는지 확인해주세요.`;
      break;
  }

  console.log('📨 공지 메시지 발송 시작 (백그라운드)');

  // ✅ 백그라운드 발송 (await 없음)
  fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'schedule_notice',
      message: messageText
    })
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        console.log('✅ 공지 메시지 발송 성공');
      } else {
        console.warn('⚠️ 공지 메시지 발송 실패:', result.error);
      }
    })
    .catch(error => {
      console.error('❌ 공지 메시지 발송 오류:', error);
    });
};

// ✅ 4. 일반 메시지 발송 (범용) - 백그라운드 처리
export const sendMessage = (messageText: string, targetType: 'users' | 'channel', targets: string[]): void => {
  console.log('📨 메시지 발송 시작 (백그라운드)');

  // ✅ 백그라운드 발송 (await 없음)
  fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: targetType === 'users' ? 'approval_complete' : 'schedule_notice',
      targetUsers: targetType === 'users' ? targets : undefined,
      channelId: targetType === 'channel' ? targets[0] : undefined,
      message: messageText
    })
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        console.log('✅ 메시지 발송 성공');
      } else {
        console.warn('⚠️ 메시지 발송 실패:', result.error);
      }
    })
    .catch(error => {
      console.error('❌ 메시지 발송 오류:', error);
    });
};

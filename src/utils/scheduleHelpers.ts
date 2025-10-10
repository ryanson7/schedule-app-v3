// 스케줄 상태 관리 헬퍼 함수들
export const scheduleStatusConfig = {
  pending: { bg: '#f8d7da', color: '#721c24', text: '임시저장' },
  approval_requested: { bg: '#fff3cd', color: '#856404', text: '승인요청' },
  approved: { bg: '#e8f5e8', color: '#155724', text: '승인완료' },
  modification_requested: { bg: '#e3f2fd', color: '#1565c0', text: '수정요청' },
  cancellation_requested: { bg: '#fff3e0', color: '#e65100', text: '취소요청' },
  cancelled: { bg: '#f5f5f5', color: '#666', text: '취소됨' },
  rejected: { bg: '#ffebee', color: '#c62828', text: '거부됨' }
};

export const getStatusInfo = (status: string) => {
  return scheduleStatusConfig[status as keyof typeof scheduleStatusConfig] || 
         { bg: '#f0f0f0', color: '#666', text: '기타' };
};

export const canManagerEdit = (status: string) => {
  return ['pending', 'modification_requested'].includes(status);
};

export const canManagerDelete = (status: string) => {
  return status === 'pending';
};

export const canManagerRequest = (status: string) => {
  return status === 'approved';
};

export const formatTime = (timeString: string) => {
  if (!timeString) return '';
  return timeString.substring(0, 5);
};

export const generateWeekDates = (currentWeek: Date) => {
  const startOfWeek = new Date(currentWeek);
  const dayOfWeek = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dates.push({
      date: dateStr,
      day: date.getDate(),
      dayOfWeek: ['월', '화', '수', '목', '금', '토', '일'][date.getDay() === 0 ? 6 : date.getDay() - 1],
      isHoliday: false // 공휴일 체크 로직 추가 필요
    });
  }
  return dates;
};

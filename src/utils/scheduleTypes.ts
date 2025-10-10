// 기존 스케줄 형태
export const basicScheduleTypes = ['academy', 'studio'];

// 내부업무용 스케줄 형태
export const internalScheduleTypes = ['행사', '기타', '장비/스튜디오대여', '당직', '근무', '고정휴무', '개인휴무'];

// 전체 스케줄 형태
export const allScheduleTypes = [...basicScheduleTypes, ...internalScheduleTypes];

// 스케줄 형태별 색상 정의
export const scheduleTypeColors: { [key: string]: { bg: string; border: string; text: string } } = {
  academy: { bg: '#fff3e0', border: '#f57c00', text: '#e65100' },
  studio: { bg: '#e3f2fd', border: '#1976d2', text: '#1565c0' },
  행사: { bg: '#f3e5f5', border: '#9c27b0', text: '#7b1fa2' },
  기타: { bg: '#e8f5e8', border: '#4caf50', text: '#2e7d32' },
  '장비/스튜디오대여': { bg: '#fff8e1', border: '#ffcc80', text: '#e65100' },
  당직: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
  근무: { bg: '#e0f2f1', border: '#009688', text: '#00695c' },
  고정휴무: { bg: '#fce4ec', border: '#e91e63', text: '#ad1457' },
  개인휴무: { bg: '#f1f8e9', border: '#8bc34a', text: '#558b2f' }
};

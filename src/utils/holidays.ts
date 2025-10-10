// 대한민국 공휴일 자동 계산
export const isHoliday = (dateStr: string, date: Date): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = date.getDay();
  
  // 주말 (토요일, 일요일)
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  
  // 고정 공휴일
  const fixedHolidays = [
    `${year}-01-01`, // 신정
    `${year}-03-01`, // 삼일절
    `${year}-05-05`, // 어린이날
    `${year}-06-06`, // 현충일
    `${year}-08-15`, // 광복절
    `${year}-10-03`, // 개천절
    `${year}-10-09`, // 한글날
    `${year}-12-25`, // 크리스마스
  ];
  
  if (fixedHolidays.includes(dateStr)) return true;
  
  // 음력 공휴일 (간단한 근사치 - 실제로는 더 정확한 계산 필요)
  const lunarHolidays2025 = [
    '2025-01-28', '2025-01-29', '2025-01-30', // 설날 연휴
    '2025-05-05', // 부처님오신날 (예시)
    '2025-09-06', '2025-09-07', '2025-09-08', // 추석 연휴 (예시)
  ];
  
  if (lunarHolidays2025.includes(dateStr)) return true;
  
  // 대체공휴일 로직 (간단 버전)
  const substitutes2025 = [
    '2025-05-06', // 어린이날 대체공휴일 (예시)
    '2025-10-06', // 개천절 대체공휴일 (예시)
  ];
  
  return substitutes2025.includes(dateStr);
};

// src/utils/breakTimeUtils.ts
export interface BreakTimeInfo {
  enabled: boolean;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface TimeConflictResult {
  hasConflict: boolean;
  conflictType: 'lunch' | 'dinner' | 'custom' | null;
  suggestedBreakTime?: BreakTimeInfo;
}

export interface ScheduleSplitResult {
  needsSplit: boolean;
  firstSchedule?: {
    startTime: string;
    endTime: string;
  };
  secondSchedule?: {
    startTime: string;
    endTime: string;
  };
  breakTime?: BreakTimeInfo;
}

// 시간을 분으로 변환
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// 분을 시간으로 변환
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// 휴식시간 충돌 체크
export const checkBreakTimeConflict = (
  startTime: string,
  endTime: string
): TimeConflictResult => {
  const scheduleStart = timeToMinutes(startTime);
  const scheduleEnd = timeToMinutes(endTime);
  
  // 점심시간 충돌 체크 (12:00-13:00)
  const lunchStart = timeToMinutes('12:00');
  const lunchEnd = timeToMinutes('13:00');
  
  if (scheduleStart < lunchEnd && scheduleEnd > lunchStart) {
    return {
      hasConflict: true,
      conflictType: 'lunch',
      suggestedBreakTime: {
        enabled: true,
        startTime: '12:00',
        endTime: '13:00',
        durationMinutes: 60
      }
    };
  }
  
  // 저녁시간 충돌 체크 (18:00-19:00)
  const dinnerStart = timeToMinutes('18:00');
  const dinnerEnd = timeToMinutes('19:00');
  
  if (scheduleStart < dinnerEnd && scheduleEnd > dinnerStart) {
    return {
      hasConflict: true,
      conflictType: 'dinner',
      suggestedBreakTime: {
        enabled: true,
        startTime: '18:00',
        endTime: '19:00',
        durationMinutes: 60
      }
    };
  }
  
  return {
    hasConflict: false,
    conflictType: null
  };
};

// 스케줄 분할 계산
export const calculateScheduleSplit = (
  startTime: string,
  endTime: string,
  breakTime: BreakTimeInfo
): ScheduleSplitResult => {
  if (!breakTime.enabled) {
    return { needsSplit: false };
  }
  
  const scheduleStart = timeToMinutes(startTime);
  const scheduleEnd = timeToMinutes(endTime);
  const breakStart = timeToMinutes(breakTime.startTime);
  const breakEnd = timeToMinutes(breakTime.endTime);
  
  // 휴식시간과 겹치지 않으면 분할 불필요
  if (scheduleEnd <= breakStart || scheduleStart >= breakEnd) {
    return { needsSplit: false };
  }
  
  // 분할 필요
  return {
    needsSplit: true,
    firstSchedule: {
      startTime: startTime,
      endTime: breakTime.startTime
    },
    secondSchedule: {
      startTime: breakTime.endTime,
      endTime: endTime
    },
    breakTime: breakTime
  };
};

// 실제 작업 시간 계산 (휴식시간 제외)
export const calculateEffectiveWorkTime = (
  startTime: string,
  endTime: string,
  breakTime?: BreakTimeInfo
): number => {
  const totalMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  
  if (!breakTime || !breakTime.enabled) {
    return totalMinutes;
  }
  
  const scheduleStart = timeToMinutes(startTime);
  const scheduleEnd = timeToMinutes(endTime);
  const breakStart = timeToMinutes(breakTime.startTime);
  const breakEnd = timeToMinutes(breakTime.endTime);
  
  // 휴식시간과 겹치는 부분 계산
  const overlapStart = Math.max(scheduleStart, breakStart);
  const overlapEnd = Math.min(scheduleEnd, breakEnd);
  const overlapMinutes = Math.max(0, overlapEnd - overlapStart);
  
  return totalMinutes - overlapMinutes;
};

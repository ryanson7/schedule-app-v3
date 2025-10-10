// 스케줄 정책 관리 클래스
export class SchedulePolicy {
  // 제작센터 연락처 정보
  static readonly CONTACT_INFO = {
    phone: '02-1234-5678',
    department: '제작센터',
    hours: '평일 09:00-18:00'
  };

  // 🔥 testDate를 고려한 현재 시간 반환
  private static getCurrentTime(testDate?: string | null): Date {
    if (testDate) {
      return new Date(testDate);
    }
    return new Date();
  }

  // 현재 주의 월요일(D-day) 계산
  static getCurrentWeekMonday(date: Date = new Date()): Date {
    const today = new Date(date);
    const dayOfWeek = today.getDay(); // 0: 일요일, 1: 월요일
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 -6, 아니면 1-현재요일
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    
    return monday;
  }

  // 다음 주 월요일(D+7) 계산
  static getNextWeekMonday(date: Date = new Date()): Date {
    const currentMonday = this.getCurrentWeekMonday(date);
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(currentMonday.getDate() + 7);
    return nextMonday;
  }

  // 다음 주 일요일(D+13) 계산
  static getNextWeekSunday(date: Date = new Date()): Date {
    const nextMonday = this.getNextWeekMonday(date);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999); // 일요일 끝까지
    return nextSunday;
  }

  // D+3 (목요일) 수정 마감일 계산
  static getEditDeadline(date: Date = new Date()): Date {
    const currentMonday = this.getCurrentWeekMonday(date);
    const thursday = new Date(currentMonday);
    thursday.setDate(currentMonday.getDate() + 3);
    thursday.setHours(23, 59, 59, 999); // 목요일 끝까지
    return thursday;
  }

  // 🔥 기존 온라인 수정 가능 여부 체크 (D+3 기준)
  static canEditOnline(testDate?: string | null): boolean {
    const today = this.getCurrentTime(testDate);
    const editDeadline = this.getEditDeadline(today);
    
    // 평일 09:00~23:59만 수정 가능
    const dayOfWeek = today.getDay();
    const currentHour = today.getHours();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('🔍 주말에는 온라인 수정 불가');
      return false;
    }
    
    if (currentHour < 9 || currentHour >= 24) {
      console.log('🔍 업무시간 외에는 온라인 수정 불가');
      return false;
    }
    
    console.log('🔍 수정 가능 여부 체크:', {
      현재시간: today.toLocaleString('ko-KR'),
      마감시간: editDeadline.toLocaleString('ko-KR'),
      수정가능: today <= editDeadline
    });
    
    return today <= editDeadline;
  }

  // 🔥 D+4 정책 체크 (스케줄별 개별 체크)
  static checkScheduleEditPolicy(scheduleDate: string, testDate?: string | null): {
    canDirectEdit: boolean;
    needsContact: boolean;
    daysLeft: number;
    message: string;
    urgencyLevel: 'safe' | 'warning' | 'danger' | 'contact';
  } {
    const now = this.getCurrentTime(testDate);
    const schedule = new Date(scheduleDate);
    
    // 날짜 차이 계산 (일 단위)
    const timeDiff = schedule.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    // 과거 날짜 체크
    if (daysLeft < 0) {
      return {
        canDirectEdit: false,
        needsContact: false,
        daysLeft: daysLeft,
        message: '과거 스케줄은 수정할 수 없습니다.',
        urgencyLevel: 'danger'
      };
    }
    
    // D+4 이상: 온라인 직접 수정 가능
    if (daysLeft >= 4) {
      const canEdit = this.canEditOnline(testDate);
      return {
        canDirectEdit: canEdit,
        needsContact: false,
        daysLeft: daysLeft,
        message: canEdit ? 
          `D+${daysLeft} - 온라인 직접 수정이 가능합니다.` : 
          '업무시간(평일 09:00~23:59)에만 수정 가능합니다.',
        urgencyLevel: 'safe'
      };
    }
    
    // D+3 ~ D+1: 제작센터 연락 필요
    if (daysLeft >= 1 && daysLeft <= 3) {
      return {
        canDirectEdit: false,
        needsContact: true,
        daysLeft: daysLeft,
        message: `D+${daysLeft} - 제작센터로 직접 연락해주세요. (온라인 수정 불가)`,
        urgencyLevel: 'contact'
      };
    }
    
    // D-Day: 수정 불가
    return {
      canDirectEdit: false,
      needsContact: false,
      daysLeft: daysLeft,
      message: 'D-Day - 수정이 불가능합니다.',
      urgencyLevel: 'danger'
    };
  }

  // 🔥 매니저 페이지에서 사용할 getEditPolicy 함수 추가
  static getEditPolicy(scheduleDate: string, testDate?: string | null): {
    canDirectEdit: boolean;
    canRequestEdit: boolean;
    needsContact: boolean;
    reason: string;
    message: string;
    daysLeft: number;
    contactInfo?: string;
  } {
    const policy = this.checkScheduleEditPolicy(scheduleDate, testDate);
    
    return {
      canDirectEdit: policy.canDirectEdit,
      canRequestEdit: policy.canDirectEdit, // 직접 수정 가능하면 요청도 가능
      needsContact: policy.needsContact,
      reason: policy.urgencyLevel === 'contact' ? 'needs_contact' : 
              policy.urgencyLevel === 'danger' ? 'past_or_today' : 'normal',
      message: policy.message,
      daysLeft: policy.daysLeft,
      contactInfo: policy.needsContact ? 
        `${this.CONTACT_INFO.department}: ${this.CONTACT_INFO.phone}\n운영시간: ${this.CONTACT_INFO.hours}` : 
        undefined
    };
  }

  // 🔥 매니저 페이지에서 사용할 getCancelPolicy 함수 추가
  static getCancelPolicy(scheduleDate: string, testDate?: string | null): {
    canDirectEdit: boolean;
    canRequestEdit: boolean;
    needsContact: boolean;
    reason: string;
    message: string;
    daysLeft: number;
    contactInfo?: string;
  } {
    // 취소 정책은 수정 정책과 동일하게 적용
    return this.getEditPolicy(scheduleDate, testDate);
  }

  // 등록 가능한 날짜 범위 반환
  static getRegistrationDateRange(testDate?: string | null): {
    startDate: string;
    endDate: string;
    weekInfo: string;
    period: string;
  } {
    const today = this.getCurrentTime(testDate);
    const nextMonday = this.getNextWeekMonday(today);
    const nextSunday = this.getNextWeekSunday(today);
    
    return {
      startDate: nextMonday.toISOString().split('T')[0],
      endDate: nextSunday.toISOString().split('T')[0],
      weekInfo: `${nextMonday.getMonth() + 1}/${nextMonday.getDate()}(월) ~ ${nextSunday.getMonth() + 1}/${nextSunday.getDate()}(일)`,
      period: `${nextMonday.getFullYear()}년 ${nextMonday.getMonth() + 1}월 ${Math.ceil(nextMonday.getDate() / 7)}주차`
    };
  }

  // 수정 가능 기간 남은 시간 계산
  static getRemainingEditTime(testDate?: string | null): {
    days: number;
    hours: number;
    minutes: number;
    totalMinutes: number;
  } {
    const today = this.getCurrentTime(testDate);
    const editDeadline = this.getEditDeadline(today);
    const remainingMs = editDeadline.getTime() - today.getTime();
    
    if (remainingMs <= 0) {
      return { days: 0, hours: 0, minutes: 0, totalMinutes: 0 };
    }
    
    const totalMinutes = Math.floor(remainingMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    
    return { days, hours, minutes, totalMinutes };
  }

  // 🔥 상태 메시지 생성 (testDate 지원)
  static getStatusMessage(testDate?: string | null): {
    canEdit: boolean;
    message: string;
    contactInfo?: string;
    urgencyLevel: 'safe' | 'warning' | 'danger';
    remainingTime?: ReturnType<typeof SchedulePolicy.getRemainingEditTime>;
  } {
    const canEdit = this.canEditOnline(testDate);
    const today = this.getCurrentTime(testDate);
    const editDeadline = this.getEditDeadline(today);
    const remainingTime = this.getRemainingEditTime(testDate);
    
    if (canEdit) {
      const { days, hours } = remainingTime;
      let urgencyLevel: 'safe' | 'warning' | 'danger' = 'safe';
      let message = '';
      
      if (days === 0 && hours <= 12) {
        urgencyLevel = 'danger';
        message = `수정 마감 임박! ${hours}시간 ${remainingTime.minutes}분 남음`;
      } else if (days === 0 || (days === 1 && hours <= 12)) {
        urgencyLevel = 'warning';
        message = `수정 가능 기간: ${days}일 ${hours}시간 남음`;
      } else {
        urgencyLevel = 'safe';
        message = `온라인 수정 가능 (${days}일 남음, ${editDeadline.getMonth() + 1}/${editDeadline.getDate()}(목) 23:59까지)`;
      }
      
      return {
        canEdit: true,
        message,
        urgencyLevel,
        remainingTime
      };
    } else {
      return {
        canEdit: false,
        message: '온라인 수정 기간이 종료되었습니다. 제작센터로 연락해주세요.',
        contactInfo: `${this.CONTACT_INFO.department}: ${this.CONTACT_INFO.phone}\n운영시간: ${this.CONTACT_INFO.hours}`,
        urgencyLevel: 'danger'
      };
    }
  }

  // 날짜가 등록 가능 범위 내인지 체크
  static isDateInRegistrationRange(targetDate: string | Date, testDate?: string | null): boolean {
    const today = this.getCurrentTime(testDate);
    const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    const { startDate, endDate } = this.getRegistrationDateRange(testDate);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return target >= start && target <= end;
  }

  // 현재 주차 정보 반환
  static getCurrentWeekInfo(testDate?: string | null): {
    weekStart: string;
    weekEnd: string;
    weekInfo: string;
    isRegistrationWeek: boolean;
  } {
    const today = this.getCurrentTime(testDate);
    const monday = this.getCurrentWeekMonday(today);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    // 매주 월요일이 등록 주간
    const isRegistrationWeek = today.getDay() === 1; // 월요일
    
    return {
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: sunday.toISOString().split('T')[0],
      weekInfo: `${monday.getMonth() + 1}/${monday.getDate()}(월) ~ ${sunday.getMonth() + 1}/${sunday.getDate()}(일)`,
      isRegistrationWeek
    };
  }

  // 🔥 D+4 정책을 포함한 디버깅용 전체 정보 출력
  static debugInfo(testDate?: string | null, scheduleDate?: string): any {
    const today = this.getCurrentTime(testDate);
    
    const info = {
      현재시간: today.toLocaleString('ko-KR'),
      testDate: testDate || '(실제 시간)',
      현재주_월요일: this.getCurrentWeekMonday(today).toLocaleString('ko-KR'),
      다음주_월요일: this.getNextWeekMonday(today).toLocaleString('ko-KR'),
      다음주_일요일: this.getNextWeekSunday(today).toLocaleString('ko-KR'),
      수정마감_목요일: this.getEditDeadline(today).toLocaleString('ko-KR'),
      등록가능범위: this.getRegistrationDateRange(testDate),
      수정가능여부: this.canEditOnline(testDate),
      상태메시지: this.getStatusMessage(testDate),
      남은시간: this.getRemainingEditTime(testDate)
    };
    
    console.log('📅 스케줄 정책 디버그 정보:', info);
    
    // 🔥 특정 스케줄 날짜에 대한 D+4 정책 체크
    if (scheduleDate) {
      const policy = this.checkScheduleEditPolicy(scheduleDate, testDate);
      console.log('🔧 D+4 정책 체크:', {
        스케줄날짜: scheduleDate,
        남은일수: policy.daysLeft,
        직접수정가능: policy.canDirectEdit,
        제작센터연락필요: policy.needsContact,
        메시지: policy.message,
        위험도: policy.urgencyLevel
      });
      
      return { ...info, D4정책: policy };
    }
    
    return info;
  }

  // 🔥 개별 스케줄의 수정 가능 여부 종합 체크
  static canEditSchedule(schedule: {
    approval_status: string;
    shoot_date: string;
  }, registrationEndDate: string, testDate?: string | null): boolean {
    const scheduleDate = new Date(schedule.shoot_date);
    const registrationEnd = new Date(registrationEndDate);
    
    // 확정된 스케줄(approved)은 수정요청만 가능
    if (schedule.approval_status === 'approved') {
      console.log('🔒 확정된 스케줄은 수정요청만 가능');
      return false;
    }
    
    // 등록 가능 범위 내의 스케줄이면 언제든 수정 가능 (pending 상태)
    if (scheduleDate <= registrationEnd) {
      console.log('✅ 등록 기간 내 스케줄 - 직접 수정 가능');
      return true;
    }
    
    // D+4 정책 적용
    const policy = this.checkScheduleEditPolicy(schedule.shoot_date, testDate);
    
    console.log('🔍 D+4 정책 체크:', {
      스케줄날짜: schedule.shoot_date,
      남은일수: policy.daysLeft,
      직접수정가능: policy.canDirectEdit,
      제작센터연락필요: policy.needsContact,
      메시지: policy.message
    });
    
    return policy.canDirectEdit;
  }
}

// 🔥 전역 객체에 디버깅 함수 등록 (개발용)
if (typeof window !== 'undefined') {
  (window as any).debugSchedulePolicy = (testDate?: string, scheduleDate?: string) => {
    return SchedulePolicy.debugInfo(testDate, scheduleDate);
  };
  
  console.log('🔧 브라우저 콘솔에서 debugSchedulePolicy() 실행 가능');
  console.log('🔧 사용법: debugSchedulePolicy("2025-08-01", "2025-08-05")');
}

// 🔥 기본 export 추가 (매니저 페이지 호환성)
export default SchedulePolicy;

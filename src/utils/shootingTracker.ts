// utils/shootingTracker.ts
import { useState, useEffect } from 'react';

export interface Schedule {
  id: string;
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export interface TrackingState {
  scheduleIndex: number;
  totalSchedules: number;
  currentState: 'PENDING' | 'TRAVELING' | 'ARRIVED' | 'SHOOTING' | 'COMPLETED' | 'FINISHED';
  timestamps: Record<string, string>;
}

export class ShootingTracker {
  
  // 🎯 수정된 버튼 로직 (QR체크 + 사진업로드 포함)
  static getAvailableActions(scheduleIndex: number, totalSchedules: number, currentState: string): string[] {
    const isFirst = scheduleIndex === 0;
    const isLast = scheduleIndex === totalSchedules - 1;
    
    switch (currentState) {
      case 'PENDING':
        return isFirst ? ['출발'] : ['시작'];
        
      case 'TRAVELING': // 첫 번째 스케줄만
        return ['QR체크']; // 도착 대신 QR체크
        
      case 'ARRIVED': // QR체크 완료 후
        return ['시작'];
        
      case 'SHOOTING':
        return ['종료'];
        
      case 'COMPLETED':
        return isLast ? ['퇴근'] : []; // 마지막이면 퇴근, 아니면 빈 배열 (자동으로 다음 스케줄로)
        
      case 'FINISHED': // 퇴근 완료
        return [];
        
      default:
        return [];
    }
  }
  
  // 🕒 현재 시간 정확하게 반환
  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }
  
  // 📅 현재 날짜 반환 (YYYY-MM-DD)
  static getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }
  
  // ⏰ 시간 포맷팅 (HH:MM)
  static formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }
  
  // 📍 상태 전환 로직
  static getNextState(currentState: string, action: string): string {
    const stateTransitions: Record<string, Record<string, string>> = {
      'PENDING': {
        '출발': 'TRAVELING',
        '시작': 'SHOOTING'
      },
      'TRAVELING': {
        'QR체크': 'ARRIVED'
      },
      'ARRIVED': {
        '시작': 'SHOOTING'
      },
      'SHOOTING': {
        '종료': 'COMPLETED'
      },
      'COMPLETED': {
        '퇴근': 'FINISHED'
      }
    };
    
    return stateTransitions[currentState]?.[action] || currentState;
  }

  // 🏢 location 정보 조합 함수
    // src/utils/shootingTracker.ts - 수정된 formatLocation 함수
    static formatLocation(schedule: any, subLocations?: any[], mainLocations?: any[]): string {
    console.log('formatLocation 입력 데이터:', schedule);
    
    // subLocationId가 있고, locations 배열들이 전달된 경우 (admin tracking 패턴)
    if (schedule.sub_location_id && subLocations && mainLocations) {
        const subLocation = subLocations.find(s => s.id === schedule.sub_location_id);
        if (!subLocation) return '촬영지 확인중';
        
        const mainLocation = mainLocations.find(m => m.id === subLocation.main_location_id);
        const mainName = mainLocation ? mainLocation.name : '미정';
        
        return `${mainName} ${subLocation.name}`;
    }
    
    // 기존 로직 (하위 호환성)
    if (schedule.location_name && schedule.location_name.trim()) {
        return schedule.location_name.trim();
    }
    
    if (schedule.locations && schedule.locations.name) {
        return schedule.locations.name;
    }
    
    if (schedule.main_location && schedule.sub_location) {
        return `${schedule.main_location.trim()} ${schedule.sub_location.trim()}`;
    }
    
    if (schedule.locations) {
        const loc = schedule.locations;
        if (loc.main_location && loc.sub_location) {
        return `${loc.main_location.trim()} ${loc.sub_location.trim()}`;
        }
    }
    
    return schedule.location || '촬영지 확인중';
    }


  // 📚 course_name 처리 함수
  static formatCourseName(schedule: any): string {
    if (schedule.course_name && schedule.course_name.trim()) {
      return schedule.course_name;
    }
    return '강좌명 체크';
  }

  // 📱 QR 코드 검증 함수
    // utils/shootingTracker.ts
    static validateQRCode(qrData: string, expectedLocation: string): boolean {
    // QR 코드에서 장소 정보 추출 및 검증
    try {
        // JSON 형태인 경우
        const qrLocation = JSON.parse(qrData);
        return qrLocation.location === expectedLocation || 
            qrLocation.name === expectedLocation;
    } catch {
        // 단순 문자열인 경우
        const normalizedQrData = qrData.toLowerCase();
        const normalizedLocation = expectedLocation.toLowerCase();
        
        return normalizedQrData.includes(normalizedLocation) ||
            normalizedLocation.includes(normalizedQrData);
    }
    }

     // ✅ QR 코드 검증 함수 업데이트
    static validateQRCode(qrData: string, locationName: string): boolean {
    try {
      // QR 데이터 파싱: "LOCATION_ID_MINUTE"
      const parts = qrData.split('_');
      if (parts.length !== 3 || parts[0] !== 'LOCATION') {
        console.log('❌ QR 형식 오류:', qrData);
        return false;
      }

      const locationId = parseInt(parts[1]);
      const qrMinute = parseInt(parts[2]);
      
      // 현재 시간 기준 ±1분 허용
      const now = new Date();
      const currentMinute = Math.floor(now.getTime() / (60 * 1000));
      
      const isTimeValid = Math.abs(currentMinute - qrMinute) <= 1;
      
      if (!isTimeValid) {
        console.log('❌ QR 시간 만료:', { qrMinute, currentMinute });
        return false;
      }

      // 위치 검증 (실제로는 locationName과 locationId 매핑 필요)
      console.log('✅ QR 검증 성공:', { locationId, locationName });
      return true;
      
    } catch (error) {
      console.error('❌ QR 검증 오류:', error);
      return false;
    }
  }


}

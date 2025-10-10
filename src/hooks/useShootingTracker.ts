// src/hooks/useShootingTracker.ts
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { Schedule, TrackingState, ShootingTracker } from '../utils/shootingTracker';

export const useShootingTracker = (initialSchedules: Schedule[]) => {
  const router = useRouter();
  
  // ✅ 촬영자 앱 상태 -> DB 상태 매핑
  const stateToDBStatus = (appState: string): string => {
    const mapping: Record<string, string> = {
      'PENDING': 'scheduled',      // 대기중 -> 확인됨
      'TRAVELING': 'departed',     // 이동중 -> 출발  
      'ARRIVED': 'arrived',        // 도착완료 -> 도착
      'SHOOTING': 'in_progress',   // 촬영중 -> 진행중
      'COMPLETED': 'completed',    // 촬영완료 -> 종료
      'FINISHED': 'completed'      // 퇴근완료 -> 종료
    };
    return mapping[appState] || 'scheduled';
  };

  console.log('🔧 useShootingTracker 초기화:', { 
    schedulesCount: initialSchedules.length,
    firstScheduleId: initialSchedules[0]?.id 
  });
  
  // 상태 초기화 - SessionStorage에서 복원
  const [trackingState, setTrackingState] = useState<TrackingState>(() => {
    if (typeof window !== 'undefined') {
      const savedState = sessionStorage.getItem(`trackingState_${initialSchedules[0]?.id}`);
      if (savedState) {
        console.log('🔄 이전 촬영 상태 복원:', JSON.parse(savedState));
        return JSON.parse(savedState);
      }
    }
    return {
      scheduleIndex: 0,
      totalSchedules: initialSchedules.length,
      currentState: 'PENDING',
      timestamps: {}
    };
  });

  const [schedules] = useState<Schedule[]>(initialSchedules);
  const [currentScheduleIndex, setCurrentScheduleIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  // 현재 스케줄 정보
  const currentSchedule = schedules.length > 0 ? schedules[currentScheduleIndex] : null;
  
  // 가능한 액션들
  const availableActions = ShootingTracker.getAvailableActions(
    trackingState.scheduleIndex,
    trackingState.totalSchedules,
    trackingState.currentState
  );

  // 상태 변경 시 SessionStorage에 저장
  useEffect(() => {
    if (initialSchedules.length > 0 && typeof window !== 'undefined') {
      sessionStorage.setItem(
        `trackingState_${initialSchedules[0].id}`, 
        JSON.stringify(trackingState)
      );
      console.log('💾 촬영 상태 저장:', trackingState);
    }
  }, [trackingState, initialSchedules]);

  // QR 체크 함수
    const handleQRCheck = useCallback(async (qrData: string) => {
    if (!currentSchedule) return;
    
    const isValid = ShootingTracker.validateQRCode(qrData, currentSchedule.location);
    
    if (isValid) {
        await executeAction('QR체크');
        setShowQRScanner(false);
        
        // ✅ 사용자 이름 가져오기
        const getUserName = () => {
        const storedUserName = localStorage.getItem('userName');
        if (storedUserName) return storedUserName;
        
        const storedUserData = localStorage.getItem('userData');
        if (storedUserData) {
            try {
            const parsed = JSON.parse(storedUserData);
            if (parsed.userName || parsed.name) {
                return parsed.userName || parsed.name;
            }
            } catch (e) {
            console.error('localStorage 파싱 오류:', e);
            }
        }
        return '사용자';
        };
        
        const userName = getUserName();
        
        // ✅ PC 진행 안내 얼럿 메시지
        alert(`QR 체크 완료! 현장 도착이 확인되었습니다.\n\n${userName} PD님\안녕하세요.\n\n촬영시작부터는 PC에서 진행해 주세요.`);
    } else {
        alert('올바른 장소가 아닙니다. 다시 확인해주세요.');
    }
    }, [currentSchedule]);

  // 사진 업로드 함수
  const handlePhotoUpload = useCallback(async (photoFile: File) => {
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      formData.append('scheduleId', currentSchedule!.id);
      formData.append('timestamp', ShootingTracker.getCurrentTimestamp());
      
      const response = await fetch('/api/upload-completion-photo', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        await executeAction('퇴근');
        setShowPhotoUpload(false);
        alert('퇴근 완료! 수고하셨습니다.');
      } else {
        throw new Error('사진 업로드 실패');
      }
    } catch (error) {
      console.error('사진 업로드 오류:', error);
      alert('사진 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSchedule]);

  // ✅ Supabase로 tracking_status + 실제 시간 직접 업데이트
  const updateScheduleWithActualTime = async (scheduleId: string, appState: string, action: string, timestamp: string) => {
    try {
      const dbStatus = stateToDBStatus(appState);
      
      // ✅ 업데이트할 필드들
      const updateFields: any = {
        tracking_status: dbStatus,
        updated_at: new Date().toISOString()
      };

      // ✅ 액션별 실제 시간 저장
      if (action === '시작' && trackingState.currentState === 'ARRIVED') {
        updateFields.actual_start_time = timestamp;
        console.log('📅 촬영 시작 시간 저장:', timestamp);
      }
      
      if (action === '종료' && trackingState.currentState === 'SHOOTING') {
        updateFields.actual_end_time = timestamp;
        console.log('📅 촬영 종료 시간 저장:', timestamp);
      }

      console.log('📡 DB 업데이트 준비:', {
        scheduleId,
        appState,
        dbStatus,
        action,
        updateFields
      });

      const { error } = await supabase
        .from('schedules')
        .update(updateFields)
        .eq('id', parseInt(scheduleId));

      if (error) {
        throw error;
      }

      console.log('✅ DB 상태 + 실제시간 업데이트 성공:', { 
        scheduleId, 
        dbStatus,
        actualTimes: {
          start: updateFields.actual_start_time,
          end: updateFields.actual_end_time
        }
      });
      return true;

    } catch (error) {
      console.error('❌ DB 상태 업데이트 실패:', error);
      throw error;
    }
  };

  // ✅ 액션 실행 - 실제 시간 저장 포함
  const executeAction = useCallback(async (action: string) => {
    console.log('🎯 executeAction 호출:', { 
      action, 
      currentScheduleId: currentSchedule?.id,
      currentState: trackingState.currentState,
      schedulesLength: schedules.length,
      scheduleExists: !!currentSchedule
    });

    // 스케줄 체크
    if (!currentSchedule) {
      console.error('❌ currentSchedule이 없습니다. schedules:', schedules);
      alert('스케줄 데이터 오류가 발생했습니다. 대시보드로 이동합니다.');
      router.push('/shooter/ShooterDashboard');
      return;
    }

    if (!currentSchedule.id) {
      console.error('❌ currentSchedule.id가 없습니다:', currentSchedule);
      alert('스케줄 ID가 없습니다. 대시보드로 이동합니다.');
      router.push('/shooter/ShooterDashboard');
      return;
    }

    // ✅ 퇴근만 특별 처리, 나머지는 일반 처리
    if (action === '퇴근') {
      setShowPhotoUpload(true);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const timestamp = ShootingTracker.getCurrentTimestamp();
      const nextState = ShootingTracker.getNextState(trackingState.currentState, action);
      
      // 타임스탬프 기록
      const newTimestamps = {
        ...trackingState.timestamps,
        [`${action}_${trackingState.scheduleIndex}`]: timestamp
      };
      
      // 상태 업데이트
      let newScheduleIndex = trackingState.scheduleIndex;
      let finalNextState = nextState;
      
      // 스케줄 완료 후 다음 스케줄로 이동
      if (action === '종료' && trackingState.currentState === 'SHOOTING') {
        if (trackingState.scheduleIndex < trackingState.totalSchedules - 1) {
          newScheduleIndex = trackingState.scheduleIndex + 1;
          finalNextState = 'PENDING'; // 다음 스케줄은 새로 시작
        }
      }

      // ✅ 1. DB에 tracking_status + 실제 시간 저장
      await updateScheduleWithActualTime(currentSchedule.id, finalNextState, action, timestamp);
      
      // ✅ 2. 로컬 상태 업데이트
      const updatedState = {
        ...trackingState,
        scheduleIndex: newScheduleIndex,
        currentState: finalNextState,
        timestamps: newTimestamps
      };
      
      setTrackingState(updatedState);
      setCurrentScheduleIndex(newScheduleIndex);
      
      console.log(`✅ ${action} 완료 + 실제시간 저장:`, {
        스케줄ID: currentSchedule.id,
        이전상태: trackingState.currentState,
        새상태: finalNextState,
        액션시간: timestamp,
        스케줄인덱스: `${trackingState.scheduleIndex} → ${newScheduleIndex}`
      });
      
    } catch (error) {
      console.error('❌ 액션 실행 실패:', error);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [schedules, currentSchedule, trackingState, router]);

  // 진행률 계산
  const progress = ((trackingState.scheduleIndex * 2 + (trackingState.currentState === 'COMPLETED' ? 2 : trackingState.currentState === 'SHOOTING' ? 1 : 0)) / (trackingState.totalSchedules * 2)) * 100;

  return {
    schedules,
    currentSchedule,
    currentScheduleIndex,
    trackingState,
    availableActions,
    executeAction,
    isLoading,
    progress,
    showQRScanner,
    setShowQRScanner,
    showPhotoUpload,
    setShowPhotoUpload,
    handleQRCheck,
    handlePhotoUpload
  };
};

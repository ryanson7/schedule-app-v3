"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useWeek } from "../../contexts/WeekContext";
import { hasAccess, safeUserRole } from "../../core/permissions";
import { useScheduleData, useModal } from "../../core/hooks";
import { UserRole } from "../../core/types";
import BaseScheduleGrid from "../../components/core/BaseScheduleGrid";
import ScheduleModal from "../../ui/ScheduleModal";

interface StudioAdminPanelProps {
  currentUserRole?: UserRole;
}

export default function StudioAdminPanel({ currentUserRole }: StudioAdminPanelProps) {
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);

  const { currentWeek, navigateWeek } = useWeek();
  
  // 공통 훅 사용
  const {
    schedules,
    locations,
    userInfo,
    selectedAcademies,
    isManager,
    loading,
    error,
    saveSchedule,
    refreshSchedules
  } = useScheduleData('studio', currentWeek);

  const { modalOpen, modalData, openModal, closeModal } = useModal();

  // 권한 체크
  useEffect(() => {
    let role = currentUserRole;
    
    if (!role) {
      const userRole = localStorage.getItem('userRole');
      role = userRole ? safeUserRole(userRole) : 'staff';
    }

    const granted = hasAccess(role, 'studio');
    setAccessGranted(granted);
    setAccessLoading(false);
  }, [currentUserRole]);

  // 실시간 업데이트 구독
  useEffect(() => {
    if (!accessGranted) return;
    
    const subscription = supabase
      .channel('studio_schedule_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'schedules',
          filter: 'schedule_type=eq.studio'
        }, 
        (payload) => {
          console.log('📡 스튜디오 스케줄 변경 감지:', payload);
          if (!modalOpen) {
            refreshSchedules();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [accessGranted, refreshSchedules, modalOpen]);

  // 핸들러들
  const handleCellClick = (date: string, location: any) => {
    if (!accessGranted) return;
    
    openModal({
      date,
      locationId: location.id
    });
  };

  const getScheduleForCell = (date: string, location: any) => {
    return schedules.filter(s => s.shoot_date === date && s.sub_location_id === location.id);
  };

  const getLocationColor = (locationId: number) => {
    return { bg: '#f8fafc', border: '#e2e8f0', text: '#1f2937' };
  };

  const renderScheduleCard = (schedule: any) => {
    const statusInfo = getStatusInfo(schedule.approval_status);
    
    return (
      <div 
        key={schedule.id}
        onClick={(e) => {
          e.stopPropagation();
          openModal({
            date: schedule.shoot_date,
            locationId: schedule.sub_location_id,
            scheduleData: schedule
          });
        }}
        style={{ 
          padding: '8px',
          background: '#f8fafc',
          borderRadius: '6px',
          border: '2px solid #e2e8f0',
          cursor: 'pointer',
          marginBottom: '4px',
          position: 'relative'
        }}
      >
        <div style={{ 
          fontWeight: '700', 
          color: '#1f2937',
          fontSize: '12px',
          marginBottom: '4px'
        }}>
          {schedule.start_time?.substring(0, 5)}~{schedule.end_time?.substring(0, 5)}
        </div>
        
        <div style={{ 
          fontSize: '10px', 
          marginBottom: '4px', 
          color: '#1f2937',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {schedule.professor_name}
        </div>
        
        <div style={{ 
          fontSize: '9px', 
          color: '#6b7280',
          fontWeight: '400',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '4px'
        }}>
          {schedule.course_name}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{
            fontSize: 7, 
            padding: '1px 3px', 
            borderRadius: 2,
            background: statusInfo.bg, 
            color: statusInfo.color,
            fontWeight: 600
          }}>
            {statusInfo.text}
          </span>
        </div>
      </div>
    );
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: '#22c55e', color: '#ffffff', text: '촬영확정' };
      case 'pending':
        return { bg: '#f59e0b', color: '#ffffff', text: '검토중' };
      case 'cancelled':
        return { bg: '#dc2626', color: '#ffffff', text: '촬영취소' };
      case 'completed':
        return { bg: '#3b82f6', color: '#ffffff', text: '촬영완료' };
      default:
        return { bg: '#6b7280', color: '#ffffff', text: '기타' };
    }
  };

  // 렌더링 (학원과 동일한 구조)
  if (accessLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh'
      }}>
        권한을 확인하는 중...
      </div>
    );
  }

  if (!accessGranted) {
    return (
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '40px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>
            접근 권한이 없습니다
          </h3>
          <p>스튜디오 관리는 시스템 관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh'
      }}>
        🎬 스튜디오 데이터를 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>
            오류가 발생했습니다
          </h3>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <BaseScheduleGrid
        title="🎬 스튜디오 관리 패널"
        leftColumnTitle="스튜디오"
        locations={locations.map(loc => ({
          id: loc.id,
          name: `${loc.name}`,
        }))}
        schedules={schedules}
        currentWeek={currentWeek}
        onWeekChange={navigateWeek}
        onCellClick={handleCellClick}
        getScheduleForCell={getScheduleForCell}
        renderScheduleCard={renderScheduleCard}
        showAddButton={true}
        onCopyPreviousWeek={undefined}
        userRole={userInfo?.role === 'system_admin' ? 'admin' : 'manager'}
        pageType="studio"
        getLocationColor={getLocationColor}
      />

      {/* 통합 스케줄 모달 */}
      <ScheduleModal
        open={modalOpen}
        onClose={closeModal}
        scheduleType="studio"
        initialData={modalData}
        locations={locations}
        userRole={userInfo?.role === 'system_admin' ? 'admin' : 'manager'}
        onSave={saveSchedule}
      />
    </>
  );
}

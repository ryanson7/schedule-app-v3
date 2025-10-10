"use client";
import React from 'react';

interface CopyScheduleModalProps {
  open: boolean;
  onClose: () => void;
  schedules: any[];
  selected: number[];
  onToggle: (id: number) => void;
  onCopy: () => void;
  loading: boolean;
}

export default function CopyScheduleModal({
  open,
  onClose,
  schedules,
  selected,
  onToggle,
  onCopy,
  loading
}: CopyScheduleModalProps) {
  if (!open) return null;

  // 학원별 그룹화
  const schedulesByAcademy = schedules.reduce((acc: any, schedule: any) => {
    const academyId = schedule.sub_locations?.main_location_id;
    const academyName = schedule.sub_locations?.main_locations?.name || '알 수 없는 학원';
    
    if (!acc[academyId]) {
      acc[academyId] = {
        academyName,
        schedules: []
      };
    }
    
    acc[academyId].schedules.push(schedule);
    return acc;
  }, {});

  // 학원별 전체 선택/해제
  const toggleAcademySchedules = (academySchedules: any[]) => {
    const academyIds = academySchedules.map(s => s.id);
    const allSelected = academyIds.every(id => selected.includes(id));
    
    if (allSelected) {
      // 모두 선택된 경우 해제
      academyIds.forEach(id => {
        if (selected.includes(id)) {
          onToggle(id);
        }
      });
    } else {
      // 일부 또는 전체 미선택인 경우 모두 선택
      academyIds.forEach(id => {
        if (!selected.includes(id)) {
          onToggle(id);
        }
      });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 24,
        maxWidth: '80vw',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            지난 주 스케줄 복사 ({schedules.length}개)
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {/* 선택 상태 및 전체 선택 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>
            선택된 스케줄: {selected.length}개
          </span>
          <button
            onClick={() => {
              if (selected.length === schedules.length) {
                // 전체 해제
                schedules.forEach(s => {
                  if (selected.includes(s.id)) {
                    onToggle(s.id);
                  }
                });
              } else {
                // 전체 선택
                schedules.forEach(s => {
                  if (!selected.includes(s.id)) {
                    onToggle(s.id);
                  }
                });
              }
            }}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: 'white',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            {selected.length === schedules.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>

        {/* 학원별 스케줄 목록 */}
        <div style={{ marginBottom: 20 }}>
          {Object.entries(schedulesByAcademy).map(([academyId, academyData]: [string, any]) => {
            const academyScheduleIds = academyData.schedules.map((s: any) => s.id);
            const selectedCount = academyScheduleIds.filter((id: number) => selected.includes(id)).length;
            const allSelected = selectedCount === academyScheduleIds.length;
            const partialSelected = selectedCount > 0 && selectedCount < academyScheduleIds.length;
            
            return (
              <div key={academyId} style={{ marginBottom: 24 }}>
                {/* 🔥 기존 스타일 유지: 학원 헤더 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12,
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
                onClick={() => toggleAcademySchedules(academyData.schedules)}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => {
                      if (input) input.indeterminate = partialSelected;
                    }}
                    onChange={() => {}}
                    style={{ marginRight: 8, transform: 'scale(1.2)' }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 16 }}>
                    {academyData.academyName} ({selectedCount}/{academyData.schedules.length})
                  </span>
                </div>
                
                {/* 🔥 기존 스타일 유지: 한 줄에 2개씩 그리드 */}
                <div style={{ 
                  marginLeft: 24,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',  // 한 줄에 2개
                  gap: 8
                }}>
                  {academyData.schedules.map((schedule: any) => (
                    <div
                      key={schedule.id}
                      onClick={() => onToggle(schedule.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: selected.includes(schedule.id) ? '#eff6ff' : 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(schedule.id)}
                        onChange={() => {}}
                        style={{ marginRight: 8, transform: 'scale(1.1)' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 13 }}>
                          {schedule.start_time?.substring(0, 5)}-{schedule.end_time?.substring(0, 5)} | {schedule.professor_name}
                        </div>
                        <div style={{ 
                          fontSize: 11, 
                          color: '#6b7280',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {schedule.course_name} | {schedule.shooting_type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* 푸터 */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          paddingTop: 16,
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: 'white',
              cursor: 'pointer'
            }}
          >
            취소
          </button>
          <button
            onClick={onCopy}
            disabled={selected.length === 0 || loading}
            style={{
              padding: '10px 20px',
              backgroundColor: selected.length > 0 ? '#2563eb' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '복사 중...' : `선택한 ${selected.length}개 복사`}
          </button>
        </div>
      </div>
    </div>
  );
}

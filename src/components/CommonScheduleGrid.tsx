"use client";
import { useState, useEffect } from "react";
import { isHoliday } from "../utils/holidays";

const getDayOfWeek = (date: Date) => {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  return days[date.getDay() === 0 ? 6 : date.getDay() - 1];
};

interface CommonScheduleGridProps {
  title: string;
  leftColumnTitle: string;
  locations: any[];
  schedules: any[];
  currentWeek: Date;
  onWeekChange: (direction: number) => void;
  onCellClick: (date: string, location: any) => void;
  getScheduleForCell: (date: string, location: any) => any[];
  renderScheduleCard: (schedule: any) => React.ReactNode;
  showAddButton?: boolean;
  onCopyPreviousWeek?: () => void; // 지난 주 복사 함수
  userRole?: string; // 권한 확인용
}

export default function CommonScheduleGrid({
  title,
  leftColumnTitle,
  locations,
  schedules,
  currentWeek,
  onWeekChange,
  onCellClick,
  getScheduleForCell,
  renderScheduleCard,
  showAddButton = false,
  onCopyPreviousWeek,
  userRole
}: CommonScheduleGridProps) {
  
  const generateWeekDates = () => {
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
        dayName: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
      });
    }
    return dates;
  };

  const weekDates = generateWeekDates();
  const isManagerOrAdmin = userRole === 'manager' || userRole === 'admin';

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
      {/* 제목 (있을 경우만) */}
      {title && (
        <div style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid #e2e8f0',
          fontSize: 18,
          fontWeight: 700,
          color: '#1e293b'
        }}>
          {title}
        </div>
      )}

      {/* 툴바 - 주간 네비게이션 + 지난 주 복사 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        <button 
          onClick={() => onWeekChange(-1)}
          style={{
            padding: '6px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            background: '#fff',
            color: '#1e293b',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          ← 이전 주
        </button>
        
        {/* 지난 주 복사 버튼 (매니저/관리자만) */}
        {isManagerOrAdmin && onCopyPreviousWeek && (
          <button
            onClick={onCopyPreviousWeek}
            style={{
              padding: '6px 12px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            지난 주 복사
          </button>
        )}
        
        <button 
          onClick={() => onWeekChange(1)}
          style={{
            padding: '6px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            background: '#fff',
            color: '#1e293b',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          다음 주 →
        </button>
      </div>

      {/* 스케줄 그리드 */}
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          {/* 헤더 */}
          <thead>
            <tr>
              <th style={{
                padding: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: 14,
                fontWeight: 600,
                color: '#64748b',
                minWidth: 120
              }}>
                {leftColumnTitle}
              </th>
              {weekDates.map(({ date, day, dayName }) => (
                <th key={date} style={{
                  padding: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#64748b',
                  minWidth: 150
                }}>
                  {dayName} {day}
                </th>
              ))}
            </tr>
          </thead>

          {/* 바디 */}
          <tbody>
            {locations.map((location) => (
              <tr key={location.id}>
                <td style={{
                  padding: 12,
                  border: '1px solid #e2e8f0',
                  background: '#fafbfc',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151'
                }}>
                  {location.name}
                </td>
                {weekDates.map(({ date }) => {
                  const cellSchedules = getScheduleForCell(date, location);
                  return (
                    <td
                      key={`${location.id}-${date}`}
                      onClick={() => showAddButton && onCellClick(date, location)}
                      style={{
                        padding: 8,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        cursor: showAddButton ? 'pointer' : 'default',
                        verticalAlign: 'top',
                        minHeight: 80,
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'grid', gap: 4 }}>
                        {cellSchedules.map((schedule) => renderScheduleCard(schedule))}
                      </div>
                      
                      {/* 추가 버튼 (빈 셀일 때) */}
                      {showAddButton && cellSchedules.length === 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          color: '#94a3b8',
                          fontSize: 24,
                          opacity: 0.3
                        }}>
                          +
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

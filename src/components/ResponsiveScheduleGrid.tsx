// src/components/ResponsiveScheduleGrid.tsx
"use client";
import { useState, useEffect } from "react";
import { isHoliday } from "../utils/holidays";

export default function ResponsiveScheduleGrid({
  title,
  leftColumnTitle,
  locations,
  schedules,
  currentWeek,
  onWeekChange,
  onCellClick,
  getScheduleForCell,
  renderScheduleCard,
  showAddButton = false
}: CommonScheduleGridProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setViewMode('day');
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const dates = generateWeekDates();

  return (
    <div style={{ 
      width: '100%', 
      margin: 0, 
      padding: isMobile ? '10px' : '20px',
      background: 'var(--bg-primary)', 
      minHeight: '100vh'
    }}>
      {/* 반응형 헤더 */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '10px' : '0',
        marginBottom: '20px'
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: isMobile ? '20px' : '24px',
          color: 'var(--text-primary)'
        }}>
          {title}
        </h2>

        {/* 뷰 모드 전환 (모바일에서만) */}
        {isMobile && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setViewMode('week')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'week' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: viewMode === 'week' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              주간
            </button>
            <button 
              onClick={() => setViewMode('day')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'day' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: viewMode === 'day' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              일간
            </button>
          </div>
        )}

        {/* 주간 네비게이션 */}
        <div style={{ 
          display: 'flex', 
          gap: isMobile ? '8px' : '12px', 
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button 
            onClick={() => onWeekChange(-1)}
            style={{
              padding: isMobile ? '8px 12px' : '10px 16px',
              fontSize: isMobile ? '12px' : '14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {isMobile ? '←' : '← 이전 주'}
          </button>
          
          <span style={{
            padding: isMobile ? '8px 12px' : '10px 20px',
            fontSize: isMobile ? '12px' : '14px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            {getWeekRange()}
          </span>
          
          <button 
            onClick={() => onWeekChange(1)}
            style={{
              padding: isMobile ? '8px 12px' : '10px 16px',
              fontSize: isMobile ? '12px' : '14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {isMobile ? '→' : '다음 주 →'}
          </button>
        </div>
      </div>

      {/* 모바일 일간 뷰 */}
      {isMobile && viewMode === 'day' ? (
        <DailyView 
          dates={dates}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          locations={locations}
          getScheduleForCell={getScheduleForCell}
          renderScheduleCard={renderScheduleCard}
          onCellClick={onCellClick}
          showAddButton={showAddButton}
        />
      ) : (
        /* 데스크탑/모바일 주간 뷰 */
        <WeeklyView 
          dates={dates}
          locations={locations}
          leftColumnTitle={leftColumnTitle}
          getScheduleForCell={getScheduleForCell}
          renderScheduleCard={renderScheduleCard}
          onCellClick={onCellClick}
          showAddButton={showAddButton}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

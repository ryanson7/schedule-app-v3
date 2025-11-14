"use client";
import { ReactNode, useState, useCallback } from "react";
import { canApprove, canRequestOnly, AppRole } from '../core/permissions';


interface BaseScheduleGridProps {
  title?: string;
  leftColumnTitle?: string;
  locations?: Array<{ 
    id: number | string; 
    name: string; 
    type?: string; 
    studioId?: number; 
    studioName?: string; 
    shootingTypes?: string[];
    primaryShootingType?: string;
  }>;
  schedules?: any[];
  currentWeek?: Date;
  onWeekChange?: (direction: number) => void;
  onCellClick?: (date: string, location: any) => void;
  getScheduleForCell?: (date: string, location: any) => any[];
  renderScheduleCard?: (schedule: any) => ReactNode;
  showAddButton?: boolean;
  onCopyPreviousWeek?: () => void;
  userRole?: 'admin' | 'manager' | 'user';
  pageType?: 'academy' | 'studio' | 'internal' | 'integrated' | 'all';
  hideHeader?: boolean;
  getLocationColor?: (locationId: number | string) => { bg: string; border: string; text: string };
  customFilters?: ReactNode;
  getStudioShootingTypes?: (studioId: number) => string | null;
  onCellDrop?: (date: string, location: any, draggedData: any) => void;
  draggedSchedule?: any;
  isStudioCompatible?: (studioId: number, shootingType: string) => boolean;
  onBulkApproval?: (type: 'selected' | 'all') => void; // 🔥 추가
  selectedSchedules?: number[]; // 🔥 추가
}

export default function BaseScheduleGrid({
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
  userRole = 'user',
  pageType,
  hideHeader = false,
  getLocationColor,
  customFilters,
  getStudioShootingTypes,
  onCellDrop,
  draggedSchedule,
  isStudioCompatible,
  onBulkApproval,        // 🔥 추가
  selectedSchedules     // 🔥 추가
}: BaseScheduleGridProps) {

  console.log('🔍 BaseScheduleGrid userRole:', userRole);
  
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [cellDropStates, setCellDropStates] = useState<{[key: string]: 'ok' | 'no' | ''}>({});
  
  
  const safeTitle = title || "스케줄 관리";
  const safeLeftColumnTitle = leftColumnTitle || "위치";
  const safeLocations = locations || [];
  const safeSchedules = schedules || [];
  const safeCurrentWeek = currentWeek || new Date();
  const safePageType = pageType || 'integrated';
  
  const safeOnWeekChange = onWeekChange || (() => {
    console.warn('onWeekChange not provided');
  });
  
  const safeOnCellClick = onCellClick || (() => {
    console.warn('onCellClick not provided');
  });
  
  const safeGetScheduleForCell = getScheduleForCell || ((date: string, location: any) => {
    return safeSchedules.filter(s => 
      s.shoot_date === date && s.sub_location_id === location.id
    );
  });
  
  const defaultCardRenderer = (schedule: any) => {
    return (
      <div 
        key={schedule.id}
        className="default-schedule-card"
      >
        <div className="card-time">
          {schedule.start_time?.substring(0, 5) || '00:00'}~{schedule.end_time?.substring(0, 5) || '00:00'}
        </div>
        <div className="card-content">
          {schedule.professor_name || schedule.task_name || '제목 없음'}
        </div>
        <div className="card-sub">
          {schedule.course_name || schedule.department || '내용 없음'}
        </div>
      </div>
    );
  };
  
  const safeRenderScheduleCard = renderScheduleCard || defaultCardRenderer;
  
  const checkDropAllowed = useCallback((location: any, draggedData: any) => {
    if (!draggedData || !isStudioCompatible) return true;
    
    if (draggedData.sub_location_id === location.id) return true;
    
    if (draggedData.shooting_type) {
      return isStudioCompatible(location.id, draggedData.shooting_type);
    }
    
    return true;
  }, [isStudioCompatible]);
  
  const handleCellDragEnter = useCallback((e: React.DragEvent, date: string, location: any) => {
    e.preventDefault();
    const cellKey = `${location.id}-${date}`;
    setDragOverCell(cellKey);
    
    console.log('🟢 셀 드래그 진입:', location.name);
    
    if (draggedSchedule) {
      const dropAllowed = checkDropAllowed(location, draggedSchedule);
      setCellDropStates(prev => ({
        ...prev,
        [cellKey]: dropAllowed ? 'ok' : 'no'
      }));
    }
  }, [draggedSchedule, checkDropAllowed]);

  const handleCellDragOver = useCallback((e: React.DragEvent, date: string, location: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    const cellKey = `${location.id}-${date}`;
    const dropState = cellDropStates[cellKey];
    e.dataTransfer.dropEffect = dropState === 'no' ? 'none' : 'move';
  }, [cellDropStates]);

  const handleCellDragLeave = useCallback((e: React.DragEvent, date: string, location: any) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    
    if (!currentTarget.contains(relatedTarget)) {
      const cellKey = `${location.id}-${date}`;
      console.log('🔴 셀 드래그 떠남:', location.name);
      setDragOverCell(null);
      setCellDropStates(prev => ({
        ...prev,
        [cellKey]: ''
      }));
    }
  }, []);

  const handleCellDrop = useCallback((e: React.DragEvent, date: string, location: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    const cellKey = `${location.id}-${date}`;
    
    console.log('🟦 셀 드롭:', location.name);
    
    let dragDataJson = e.dataTransfer.getData('application/json');
    if (!dragDataJson) {
      dragDataJson = e.dataTransfer.getData('text/plain');
    }
    
    if (dragDataJson && onCellDrop) {
      try {
        const draggedData = JSON.parse(dragDataJson);
        console.log('🎯 드래그 데이터 파싱 성공:', draggedData);
        
        setDragOverCell(null);
        setCellDropStates(prev => ({
          ...prev,
          [cellKey]: ''
        }));
        
        onCellDrop(date, location, draggedData);
        
      } catch (error) {
        console.error('드래그 데이터 파싱 오류:', error);
        
        setDragOverCell(null);
        setCellDropStates(prev => ({
          ...prev,
          [cellKey]: ''
        }));
      }
    } else {
      console.warn('드래그 데이터가 없거나 onCellDrop이 없음');
      
      setDragOverCell(null);
      setCellDropStates(prev => ({
        ...prev,
        [cellKey]: ''
      }));
    }
  }, [onCellDrop]);

  const handleCellClick = useCallback((date: string, location: any, e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    safeOnCellClick(date, location);
  }, [safeOnCellClick]);
  
  const isHoliday = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    } catch {
      return false;
    }
  };

  const generateWeekDates = () => {
  let startOfWeek = new Date(safeCurrentWeek);
  
  // 🔥 이중 안전장치 (개선된 버전)
  if (isNaN(startOfWeek.getTime()) || !safeCurrentWeek) {
    console.error('❌ BaseScheduleGrid에서 Invalid date 감지, 현재 날짜 사용');
    console.error('상세정보:', { safeCurrentWeek, typeof: typeof safeCurrentWeek });
    startOfWeek = new Date();
  }
  
  // 월요일을 주의 시작으로 설정
  const dayOfWeek = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  
  const dates = [];
  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    
    // 🔥 각 날짜별 안전성 재확인
    if (isNaN(date.getTime())) {
      console.error('❌ Invalid date generated at index:', i, 'startDate:', startOfWeek);
      continue;
    }
    
    // 🔥 안전한 날짜 문자열 생성
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // 🔥 날짜 문자열 유효성 검증
    if (!year || year < 2000 || year > 2100 || !month || !day) {
      console.error('❌ Invalid date components:', { year, month, day, dateStr });
      continue;
    }
    
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    
    dates.push({
      date: dateStr,
      day: date.getDate(),
      dayName: dayNames[i] || `Day${i}`,
      isWeekend,
      isToday
    });
  }
  
  // 🔥 중복 제거 및 정렬
  const uniqueDates = dates.filter((date, index, self) => 
    index === self.findIndex(d => d.date === date.date)
  );
  
  // 🔥 7개 날짜가 정확히 생성되었는지 확인
  if (uniqueDates.length !== 7) {
    console.error('❌ Expected 7 dates, got:', uniqueDates.length, uniqueDates);
  }
  
  console.log('✅ Generated week dates:', uniqueDates.map(d => d.date));
  return uniqueDates;
};


  const weekDates = generateWeekDates();
  const canManage = userRole === 'admin' || userRole === 'manager';
  
  const formatDateRange = () => {
    if (weekDates.length < 7) return "날짜 로딩 중...";
    
    const start = weekDates[0];
    const end = weekDates[6];
    const startFormatted = `${start.date.slice(2, 4)}.${start.date.slice(5, 7)}.${start.date.slice(8, 10)}`;
    const endFormatted = `${end.date.slice(2, 4)}.${end.date.slice(5, 7)}.${end.date.slice(8, 10)}`;
    return `${startFormatted} ~ ${endFormatted}`;
  };

  const getBrandColor = () => {
    switch(safePageType) {
      case 'academy': return '#2563eb';
      case 'studio': return '#059669';
      case 'internal': return '#7c3aed';
      case 'integrated': return '#d97706';
      case 'all': return '#d97706';
      default: return '#6b7280';
    }
  };

  const brandColor = getBrandColor();

  return (
    <div className="schedule-grid-container">
      {!hideHeader && (
        <div className="schedule-header">
          <h2 className="schedule-title">{safeTitle}</h2>
          <div className="schedule-info">
            <span className="page-type" style={{ backgroundColor: brandColor }}>
              {safePageType.toUpperCase()}
            </span>
            <span className="schedule-count">{safeSchedules.length}개</span>
          </div>
        </div>
      )}

      <div className="schedule-toolbar">
        <div className="toolbar-left">
          {customFilters}
        </div>

        
        
        <div className="navigation-section">

          
            {/* 🔥 일괄 승인 버튼들 추가 (지난 주 복사 앞에) */}
          {canManage && userRole === 'admin' && onBulkApproval && (
            <div style={{ display: 'flex', gap: 8, marginRight: 12 }}>
              <button 
                onClick={() => onBulkApproval('selected')}
                style={{
                  padding: '8px 16px',        // 🔥 기존 크기
                  fontSize: '13px',           // 🔥 기존 폰트 크기
                  backgroundColor: '#3b82f6', // 🔥 기존 파란색
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',        // 🔥 기존 둥근 모서리
                  cursor: 'pointer',
                  fontWeight: '500'           // 🔥 기존 굵기
                }}
              >
                선택 승인
              </button>
              <button 
                onClick={() => onBulkApproval('all')}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  backgroundColor: '#059669',  // 🔥 기존 초록색
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                전체 승인
              </button>
            </div>
          )}

          {canManage && onCopyPreviousWeek && (
            <button onClick={onCopyPreviousWeek} className="copy-button" style={{ backgroundColor: brandColor }}>
              지난 주 복사
            </button>
          )}
          <button onClick={() => safeOnWeekChange(-1)} className="nav-button">
            &lt; 이전 주
          </button>
          <div className="week-display">{formatDateRange()}</div>
          <button onClick={() => safeOnWeekChange(1)} className="nav-button">
            다음 주 &gt;
          </button>
        </div>
      </div>

      <div className="scrollable-table-container">
        <table className="schedule-table">
          <thead className="sticky-header">
            <tr className="table-header-row">
              <th className="location-header">
                <span className="header-title">{safeLeftColumnTitle}</span>
              </th>
              {/* 🔥 헤더 Key 중복 해결 */}
              {weekDates.map((dateInfo, headerIndex) => (
                <th key={`header-${dateInfo.date}-${headerIndex}`} className="date-header">
                  <div className="date-header-content">
                    <div className={`date-day-format ${dateInfo.isWeekend ? 'weekend-text' : ''} ${dateInfo.isToday ? 'today-text' : ''}`}>
                      {dateInfo.day} ({dateInfo.dayName})
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody>
            {safeLocations.length === 0 ? (
              <tr className="schedule-row">
                <td className="location-cell">
                  <div className="location-name">데이터 없음</div>
                </td>
                {weekDates.map((dateInfo, emptyIndex) => (
                  <td key={`empty-${dateInfo.date}-${emptyIndex}`} className="schedule-cell empty-data">
                    <div className="cell-wrapper">
                      <div className="empty-message">위치 정보 없음</div>
                    </div>
                  </td>
                ))}
              </tr>
            ) : (
              safeLocations.map((location, locationIndex) => {
                const locationColor = getLocationColor ? getLocationColor(location.id) : null;
                
                return (
                  <tr key={`row-${location.id}-${locationIndex}`} className="schedule-row">
                    <td 
                      className="location-cell"
                      style={locationColor ? {
                        backgroundColor: locationColor.bg,
                        borderLeft: `4px solid ${locationColor.border}`,
                        color: locationColor.text
                      } : {}}
                    >
                      <div className="location-name">{location.name || '이름 없음'}</div>
                      {location.type === 'studio' && getStudioShootingTypes && location.studioId && (
                        <div className="studio-shooting-types">
                          {getStudioShootingTypes(location.studioId)}
                        </div>
                      )}
                      {location.shootingTypes && location.shootingTypes.length > 0 && (
                        <div className="studio-shooting-types">
                          {location.shootingTypes.slice(0, 2).join(', ')}
                          {location.shootingTypes.length > 2 && ' 등'}
                        </div>
                      )}
                    </td>
                    {/* 🔥 셀 Key 중복 해결 */}
                    {weekDates.map((dateInfo, dayIndex) => {
                      const cellSchedules = safeGetScheduleForCell(dateInfo.date, location);
                      const hasSchedules = cellSchedules.length > 0;
                      const cellKey = `${location.id}-${dateInfo.date}`;
                      const isDragOver = dragOverCell === cellKey;
                      const dropState = cellDropStates[cellKey] || '';
                      
                      return (
                        <td 
                          key={`cell-${location.id}-${dateInfo.date}-${dayIndex}`}
                          data-cell={cellKey}
                          data-drop-state={dropState}
                          className={`schedule-cell ${hasSchedules ? 'has-schedules' : 'empty-cell'} ${isDragOver ? 'drag-over' : ''}`}
                          onDragEnter={(e) => handleCellDragEnter(e, dateInfo.date, location)}
                          onDragOver={(e) => handleCellDragOver(e, dateInfo.date, location)}
                          onDragLeave={(e) => handleCellDragLeave(e, dateInfo.date, location)}
                          onDrop={(e) => handleCellDrop(e, dateInfo.date, location)}
                          onClick={(e) => handleCellClick(dateInfo.date, location, e)}
                          style={{
                            backgroundColor: dropState === 'ok' ? 'rgba(5, 150, 105, 0.1)' : 
                                           dropState === 'no' ? 'rgba(220, 38, 38, 0.1)' : 'white',
                            border: dropState === 'ok' ? '2px dashed #059669' : 
                                   dropState === 'no' ? '2px dashed #dc2626' : '1px solid #e5e7eb',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                        >
                          <div className="cell-wrapper">
                            <div className="schedule-list">
                              {/* 🔥 스케줄 카드 Key 중복 해결 */}
                              {cellSchedules.map((schedule, scheduleIndex) => 
                                <div key={`schedule-${schedule.id}-${scheduleIndex}`}>
                                  {safeRenderScheduleCard(schedule)}
                                </div>
                              )}
                            </div>
                            
                            {canManage && showAddButton && (
                              <button 
                                className="add-schedule-btn"
                                style={{ borderColor: brandColor + '60', color: brandColor }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  safeOnCellClick(dateInfo.date, location);
                                }}
                              >
                                <span className="add-icon">+</span>
                                <span className="add-text">스케줄 등록</span>
                              </button>
                            )}

                            {isDragOver && dropState && (
                              <div className={`drag-feedback ${dropState === 'ok' ? 'drop-ok' : 'drop-no'}`}>
                                {dropState === 'ok' ? '✅ 드롭 가능' : '❌ 드롭 불가능'}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .schedule-grid-container {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .schedule-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
        }

        .schedule-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
        }

        .schedule-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .page-type {
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
        }

        .schedule-count {
          background: #f3f4f6;
          color: #6b7280;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
        }

        .schedule-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 20px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
          min-height: 60px;
        }

        .toolbar-left {
          flex: 1;
          display: flex;
          align-items: center;
        }

        .navigation-section {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .week-display {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          min-width: 120px;
          text-align: center;
        }

        .nav-button {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          color: #374151;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .nav-button:hover {
          background: #f3f4f6;
          border-color: ${brandColor};
        }

        .copy-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .copy-button:hover {
          opacity: 0.9;
        }

        .scrollable-table-container {
          flex: 1;
          overflow-x: auto;
          overflow-y: auto;
          background: white;
          overscroll-behavior: contain;
          height: calc(100vh - 200px);
        }

        .scrollable-table-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .scrollable-table-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .scrollable-table-container::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }

        .scrollable-table-container::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }

        .schedule-table {
          width: 100%;
          min-width: 1000px;
          border-collapse: collapse;
          table-layout: fixed;
          display: table;
        }

        .sticky-header {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #f8fafc;
          display: table-header-group;
        }

        .table-header-row {
          background: #f8fafc;
          border-bottom: 2px solid #e5e7eb;
          display: table-row;
        }

        .location-header {
          width: 160px;
          min-width: 160px;
          max-width: 160px;
          padding: 12px;
          border-right: 2px solid #e5e7eb;
          text-align: center;
          background: #f8fafc;
          white-space: nowrap;
          display: table-cell;
        }

        .header-title {
          font-size: 13px;
          font-weight: 700;
          color: #1f2937;
        }

        .date-header {
          width: 120px;
          min-width: 120px;
          max-width: 120px;
          padding: 12px 8px;
          border-right: 1px solid #e5e7eb;
          text-align: center;
          background: #f8fafc;
          white-space: nowrap;
          display: table-cell;
        }

        .date-header-content {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .date-day-format {
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
        }

        .date-day-format.weekend-text {
          color: #dc2626;
        }

        .date-day-format.today-text {
          color: #059669;
          font-weight: 700;
        }

        tbody {
          display: table-row-group;
        }

        .schedule-row {
          display: table-row;
        }

        .schedule-row:hover {
          background: #f9fafb;
        }

        .location-cell {
          width: 160px;
          min-width: 160px;
          max-width: 160px;
          padding: 10px 12px;
          border-right: 2px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          vertical-align: top;
          white-space: nowrap;
          display: table-cell;
        }

        .location-name {
          font-size: 12px;
          font-weight: 600;
          color: inherit;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .studio-shooting-types {
          font-size: 10px;
          color: #6b7280;
          margin-top: 4px;
          line-height: 1.2;
          font-weight: 400;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .location-cell:hover .studio-shooting-types {
          color: #374151;
        }

        .schedule-cell {
          width: 120px;
          min-width: 120px;
          max-width: 120px;
          padding: 0;
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
          background: white;
          display: table-cell;
          height: 100px;
          position: relative;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .schedule-cell[data-drop-state="ok"] {
          background-color: rgba(5, 150, 105, 0.1) !important;
          border: 2px dashed #059669 !important;
        }

        .schedule-cell[data-drop-state="no"] {
          background-color: rgba(220, 38, 38, 0.1) !important;
          border: 2px dashed #dc2626 !important;
        }

        .schedule-cell.drag-over {
          animation: dragPulse 1s ease-in-out infinite;
        }

        .cell-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 100px;
          padding: 6px;
          position: relative;
        }

        .schedule-cell.empty-cell .cell-wrapper {
          justify-content: center;
          align-items: center;
        }

        .schedule-cell.empty-data .cell-wrapper {
          justify-content: center;
          align-items: center;
        }

        .schedule-cell.has-schedules .cell-wrapper {
          justify-content: flex-start;
          align-items: stretch;
        }

        .schedule-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1 1 auto;
          overflow-y: auto;
          max-height: calc(100% - 36px);
        }

        .schedule-cell.empty-cell .schedule-list {
          display: none;
        }

        .default-schedule-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 6px;
          font-size: 11px;
          transition: all 0.2s ease;
          cursor: pointer;
          flex-shrink: 0;
        }

        .default-schedule-card:hover {
          border-color: ${brandColor};
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .card-time {
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 3px;
          font-size: 12px;
        }

        .card-content {
          color: #374151;
          margin-bottom: 2px;
          font-size: 10px;
          font-weight: 500;
        }

        .card-sub {
          color: #6b7280;
          font-size: 9px;
        }

        .add-schedule-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          min-height: 32px;
          max-height: 36px;
          background: rgba(248, 250, 252, 0.8);
          border: 1px dashed #d1d5db;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          overflow: hidden;
        }

        .schedule-cell.has-schedules .add-schedule-btn {
          margin-top: 6px;
          align-self: stretch;
        }

        .schedule-cell.empty-cell .add-schedule-btn {
          width: 90%;
          max-width: 90%;
          align-self: center;
          margin: 0;
        }

        .add-schedule-btn:hover {
          background: rgba(248, 250, 252, 1);
          border-style: solid;
          transform: translateY(-1px);
        }

        .add-icon {
          font-size: 14px;
          font-weight: 300;
          line-height: 1;
        }

        .add-text {
          font-size: 11px;
          font-weight: 500;
          line-height: 1;
        }

        .drag-feedback {
          position: absolute;
          top: 4px;
          right: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          pointer-events: none;
          z-index: 5;
          animation: fadeInBounce 0.3s ease-out;
        }

        .drag-feedback.drop-ok {
          background: #059669;
          color: white;
          box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
        }

        .drag-feedback.drop-no {
          background: #dc2626;
          color: white;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
        }

        .empty-message {
          color: #9ca3af;
          font-size: 11px;
          font-style: italic;
          text-align: center;
          margin: 0;
          padding: 0;
        }

        @keyframes dragPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }

        @keyframes fadeInBounce {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(-10px);
          }
          60% {
            opacity: 1;
            transform: scale(1.1) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .schedule-cell:hover {
          background-color: rgba(249, 250, 251, 0.8);
        }

        .schedule-cell[data-cell] {
          cursor: pointer;
        }

        .schedule-cell:focus {
          outline: 2px solid ${brandColor};
          outline-offset: -2px;
        }

        .add-schedule-btn:focus {
          outline: 2px solid ${brandColor};
          outline-offset: 2px;
        }

        @media (max-width: 768px) {
          .schedule-header {
            padding: 10px 16px;
          }

          .schedule-toolbar {
            padding: 8px 16px;
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
            flex-shrink: 0;
          }

          .toolbar-left {
            order: 2;
          }

          .navigation-section {
            order: 1;
            justify-content: center;
            gap: 8px;
          }

          .schedule-table {
            min-width: 800px;
          }

          .location-header, .location-cell {
            width: 140px;
            min-width: 140px;
            max-width: 140px;
          }

          .schedule-cell {
            width: 100px;
            min-width: 100px;
            max-width: 100px;
          }

          .add-text {
            display: none;
          }

          .add-schedule-btn {
            min-height: 28px;
            max-height: 32px;
          }

          .schedule-cell.empty-cell .add-schedule-btn {
            width: 85%;
            max-width: 85%;
          }

          .scrollable-table-container {
            flex: 1;
          }

          .studio-shooting-types {
            font-size: 9px;
          }
        }
      `}</style>
    </div>
  );
}

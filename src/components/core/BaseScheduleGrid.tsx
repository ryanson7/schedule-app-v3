'use client';
import React, { ReactNode, useState, useCallback, useMemo } from 'react';

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

  currentWeek?: Date | string | any;

  onWeekChange?: (direction: number) => void;
  onCellClick?: (date: string, location: any) => void;
  getScheduleForCell?: (date: string, location: any) => any[];
  renderScheduleCard?: (schedule: any, ctx?: { selected: boolean }) => ReactNode;

  showAddButton?: boolean;
  onCopyPreviousWeek?: () => void;

  userRole?: 'admin' | 'manager' | 'user';
  pageType?: 'academy' | 'studio' | 'internal' | 'integrated' | 'all';
  hideHeader?: boolean;

  getLocationColor?: (locationId: number | string) => { bg: string; border: string; text: string };
  customFilters?: ReactNode;

  // 드래그 (있어도 되고 없어도 됨)
  onCellDrop?: (date: string, location: any, draggedData: any) => void;
  draggedSchedule?: any;
  isStudioCompatible?: (studioId: number, shootingType: string) => boolean;

  // 일괄 승인
  onBulkApproval?: (type: 'selected' | 'all') => void;
  selectedSchedules?: number[];

  // 셀 비활성
  isCellDisabled?: (date: string, location: any) => { disabled: boolean; reason?: string };

  onClearSelection?: () => void;

  // 선택 배지
  showSelectionBadge?: boolean;
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
  onCellDrop,
  draggedSchedule,
  isStudioCompatible,
  onBulkApproval,
  selectedSchedules = [],
  isCellDisabled,
  onClearSelection,
  showSelectionBadge = true,
}: BaseScheduleGridProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const selectionUIEnabled = userRole === 'admin' && !!onBulkApproval;
  const hasSelection = selectionUIEnabled && (selectedSchedules?.length || 0) > 0;

  const safeTitle = title || '스케줄 관리';
  const safeLeftColumnTitle = leftColumnTitle || '위치';
  const safeLocations = locations || [];
  const safeSchedules = schedules || [];
  const safeCurrentWeek = currentWeek || new Date();
  const safePageType = pageType || 'integrated';

  const safeOnWeekChange = onWeekChange || (() => console.warn('onWeekChange not provided'));
  const safeOnCellClick = onCellClick || (() => console.warn('onCellClick not provided'));

  const safeGetScheduleForCell =
    getScheduleForCell ||
    ((date: string, location: any) => safeSchedules.filter((s) => s.shoot_date === date && s.sub_location_id === location.id));

  const defaultCardRenderer = (schedule: any, ctx?: { selected: boolean }) => {
    const selected = !!ctx?.selected;
    return (
      <div key={schedule.id} className={`default-schedule-card ${selected ? 'selected' : ''}`}>
        <div className="card-time">
          {schedule.start_time?.substring(0, 5) || '00:00'}~{schedule.end_time?.substring(0, 5) || '00:00'}
        </div>
        <div className="card-content">{schedule.professor_name || schedule.task_name || '제목 없음'}</div>
        <div className="card-sub">{schedule.course_name || schedule.department || '내용 없음'}</div>
      </div>
    );
  };

  const safeRenderScheduleCard = renderScheduleCard || defaultCardRenderer;
  const selectedSet = useMemo(() => new Set<number>(selectedSchedules || []), [selectedSchedules]);

  const canManage = userRole === 'admin' || userRole === 'manager';

  const weekDates = useMemo(() => {
    let startOfWeek = new Date(safeCurrentWeek as any);
    if (isNaN(startOfWeek.getTime())) startOfWeek = new Date();

    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const dates: Array<{ date: string; day: number; dayName: string; isWeekend: boolean; isToday: boolean }> = [];
    const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      if (isNaN(date.getTime())) continue;

      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = dateStr === todayStr;

      dates.push({ date: dateStr, day: date.getDate(), dayName: dayNames[i] || `Day${i}`, isWeekend, isToday });
    }
    return dates;
  }, [safeCurrentWeek]);

  const formatDateRange = useCallback(() => {
    if (weekDates.length < 7) return '날짜 로딩 중...';
    const start = weekDates[0];
    const end = weekDates[6];
    const startFormatted = `${start.date.slice(2, 4)}.${start.date.slice(5, 7)}.${start.date.slice(8, 10)}`;
    const endFormatted = `${end.date.slice(2, 4)}.${end.date.slice(5, 7)}.${end.date.slice(8, 10)}`;
    return `${startFormatted} ~ ${endFormatted}`;
  }, [weekDates]);

  const brandColor = useMemo(() => {
    switch (safePageType) {
      case 'academy':
        return '#2563eb';
      case 'studio':
        return '#059669';
      case 'internal':
        return '#7c3aed';
      case 'integrated':
      case 'all':
        return '#d97706';
      default:
        return '#6b7280';
    }
  }, [safePageType]);

  const checkDropAllowed = useCallback(
    (location: any, draggedData: any) => {
      if (!draggedData || !isStudioCompatible) return true;
      if (draggedData.sub_location_id === location.id) return true;
      if (draggedData.shooting_type) return isStudioCompatible(location.id, draggedData.shooting_type);
      return true;
    },
    [isStudioCompatible]
  );

  const handleCellDragEnter = useCallback(
    (e: React.DragEvent, date: string, location: any) => {
      e.preventDefault();
      const cellKey = `${location.id}-${date}`;
      setDragOverCell(cellKey);
      if (draggedSchedule) {
        const dropAllowed = checkDropAllowed(location, draggedSchedule);
        (e.currentTarget as HTMLElement).dataset.dropState = dropAllowed ? 'ok' : 'no';
      }
    },
    [draggedSchedule, checkDropAllowed]
  );

  const handleCellDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleCellDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverCell(null);
      (e.currentTarget as HTMLElement).dataset.dropState = '';
    }
  }, []);

  const handleCellDrop = useCallback(
    (e: React.DragEvent, date: string, location: any) => {
      e.preventDefault();
      e.stopPropagation();

      setDragOverCell(null);
      (e.currentTarget as HTMLElement).dataset.dropState = '';

      const disabledInfo = isCellDisabled?.(date, location);
      if (disabledInfo?.disabled) return;

      const dragDataJson = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (dragDataJson && onCellDrop) {
        try {
          const draggedData = JSON.parse(dragDataJson);
          onCellDrop(date, location, draggedData);
        } catch (error) {
          console.error('드래그 데이터 파싱 오류:', error);
        }
      }
    },
    [onCellDrop, isCellDisabled]
  );

  const handleCellClick = useCallback(
    (date: string, location: any, e: React.MouseEvent) => {
      if (e.defaultPrevented) return;

      const disabledInfo = isCellDisabled?.(date, location);
      if (disabledInfo?.disabled) {
        e.preventDefault();
        return;
      }
      safeOnCellClick(date, location);
    },
    [safeOnCellClick, isCellDisabled]
  );

  const LOCATION_COL_W = 160;
  const DAY_COL_W = 120;

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

            {selectionUIEnabled && (
              <span className="selection-count" title="선택된 스케줄">
                선택 {selectedSchedules?.length || 0}개
              </span>
            )}
          </div>
        </div>
      )}

      <div className="schedule-toolbar">
        <div className="toolbar-left">{customFilters}</div>

        <div className="navigation-section">
          {selectionUIEnabled && onBulkApproval && (
            <div style={{ display: 'flex', gap: 8, marginRight: 12, alignItems: 'center' }}>
              <button
                onClick={() => onBulkApproval('selected')}
                disabled={!hasSelection}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  backgroundColor: '#3b82f6',
                  opacity: hasSelection ? 1 : 0.45,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: hasSelection ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                }}
              >
                선택 승인
              </button>
              <button
                onClick={() => onBulkApproval('all')}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                전체 승인
              </button>

              {onClearSelection && (
                <button
                  onClick={onClearSelection}
                  disabled={!hasSelection}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: hasSelection ? 'pointer' : 'not-allowed',
                    opacity: hasSelection ? 1 : 0.5,
                    fontWeight: 800,
                  }}
                >
                  선택 해제
                </button>
              )}
            </div>
          )}

          {canManage && onCopyPreviousWeek && (
            <button
              onClick={() => onCopyPreviousWeek()}
              className="copy-button"
              style={{ backgroundColor: brandColor }}
              title="지난주 스케줄 선택 복사"
            >
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
          <colgroup>
            <col style={{ width: `${LOCATION_COL_W}px` }} />
            {weekDates.map((d) => (
              <col key={`col-${d.date}`} style={{ width: `${DAY_COL_W}px` }} />
            ))}
          </colgroup>

          <thead className="sticky-header">
            <tr className="table-header-row">
              <th className="location-header">
                <span className="header-title">{safeLeftColumnTitle}</span>
              </th>
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

                // ✅ shootingTypes 안전처리 (studio 페이지에서 특히 중요)
                const shootingTypes = Array.isArray(location.shootingTypes) ? location.shootingTypes.filter(Boolean) : [];
                const primaryType = location.primaryShootingType || (shootingTypes.length ? shootingTypes[0] : '');

                return (
                  <tr key={`row-${location.id}-${locationIndex}`} className="schedule-row">
                    <td
                      className="location-cell"
                      style={
                        locationColor
                          ? { backgroundColor: locationColor.bg, borderLeft: `4px solid ${locationColor.border}`, color: locationColor.text }
                          : {}
                      }
                    >
                      <div className="location-name">{location.name || '이름 없음'}</div>

                      {/* ✅ 스튜디오별 촬영형식 표시 (번호 밑) */}
                      {safePageType === 'studio' && shootingTypes.length > 0 && (
                        <div className="location-shooting-types" title={shootingTypes.join(', ')}>
                          {shootingTypes.slice(0, 3).map((t) => (
                            <span key={t} className={`shooting-type-chip ${t === primaryType ? 'primary' : ''}`}>
                              {t}
                            </span>
                          ))}
                          {shootingTypes.length > 3 && <span className="shooting-type-more">+{shootingTypes.length - 3}</span>}
                        </div>
                      )}
                    </td>

                    {weekDates.map((dateInfo, dayIndex) => {
                      const cellSchedules = safeGetScheduleForCell(dateInfo.date, location);
                      const hasSchedules = cellSchedules.length > 0;
                      const cellKey = `${location.id}-${dateInfo.date}`;
                      const isDragOver = dragOverCell === cellKey;

                      const disabledInfo = isCellDisabled?.(dateInfo.date, location);
                      const disabled = !!disabledInfo?.disabled;

                      return (
                        <td
                          key={`cell-${location.id}-${dateInfo.date}-${dayIndex}`}
                          data-cell={cellKey}
                          data-drop-state=""
                          className={`schedule-cell ${hasSchedules ? 'has-schedules' : 'empty-cell'} ${isDragOver ? 'drag-over' : ''} ${
                            disabled ? 'cell-disabled' : ''
                          }`}
                          onDragEnter={(e) => (!disabled ? handleCellDragEnter(e, dateInfo.date, location) : undefined)}
                          onDragOver={(e) => (!disabled ? handleCellDragOver(e) : undefined)}
                          onDragLeave={(e) => (!disabled ? handleCellDragLeave(e) : undefined)}
                          onDrop={(e) => (!disabled ? handleCellDrop(e, dateInfo.date, location) : undefined)}
                          onClick={(e) => handleCellClick(dateInfo.date, location, e)}
                          title={disabled ? disabledInfo?.reason || '등록/수정 불가' : ''}
                        >
                          <div className="cell-wrapper">
                            <div className="schedule-list">
                              {cellSchedules.map((schedule, scheduleIndex) => {
                                const id = Number(schedule?.id);
                                const selected = !!id && selectedSet.has(id);

                                return (
                                  <div key={`schedule-${schedule.id}-${scheduleIndex}`} className="schedule-wrapper">
                                    {safeRenderScheduleCard(schedule, { selected })}
                                    {selectionUIEnabled && showSelectionBadge && selected && <span className="selection-badge on">선택</span>}
                                  </div>
                                );
                              })}
                            </div>

                            {canManage && showAddButton && !disabled && (
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

                            {disabled && (
                              <div className="disabled-overlay">
                                <div className="disabled-text">{disabledInfo?.reason || '등록 제한'}</div>
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
        :global(html),
        :global(body) {
          font-weight: 400;
        }

        .schedule-grid-container {
          --fw-regular: 400;
          --fw-medium: 500;
          --fw-semibold: 600;
          --fw-bold: 700;

          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: var(--fw-regular);
          height: calc(100vh - 70px);
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
          font-weight: var(--fw-bold);
          color: #1f2937;
        }

        .schedule-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: var(--fw-regular);
        }

        .page-type {
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: var(--fw-semibold);
        }

        .schedule-count {
          background: #f3f4f6;
          color: #6b7280;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: var(--fw-medium);
        }

        .selection-count {
          background: #111827;
          color: #fff;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: var(--fw-semibold);
          opacity: 0.85;
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
          gap: 12px;
        }

        .toolbar-left {
          flex: 1;
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .navigation-section {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          white-space: nowrap;
          font-weight: var(--fw-regular);
        }

        .week-display {
          font-size: 14px;
          font-weight: var(--fw-semibold);
          color: #1f2937;
          min-width: 140px;
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
          font-weight: var(--fw-medium);
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
          font-weight: var(--fw-semibold);
          transition: all 0.2s ease;
        }

        .copy-button:hover {
          opacity: 0.9;
        }

        .scrollable-table-container {
          flex: 1;
          overflow: auto;
          background: white;
          overscroll-behavior: contain;
        }

        .schedule-table {
          width: max-content;
          min-width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-weight: var(--fw-regular);
        }

        .sticky-header {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #f8fafc;
        }

        .location-header {
          padding: 12px;
          border-right: 2px solid #e5e7eb;
          text-align: center;
          background: #f8fafc;
          white-space: nowrap;
          font-weight: var(--fw-semibold);
        }

        .date-header {
          padding: 12px 8px;
          border-right: 1px solid #e5e7eb;
          text-align: center;
          background: #f8fafc;
          white-space: nowrap;
        }

        .date-header:last-child {
          border-right: none;
        }

        .date-day-format {
          font-size: 13px;
          font-weight: var(--fw-semibold);
          color: #1f2937;
        }

        .date-day-format.weekend-text {
          color: #dc2626;
        }

        .date-day-format.today-text {
          color: #059669;
          font-weight: var(--fw-bold);
        }

        .location-cell {
          padding: 10px 12px;
          border-right: 2px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          vertical-align: top;
          white-space: nowrap;
        }

        .location-name {
          font-size: 13px;
          font-weight: var(--fw-semibold);
          color: inherit;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ✅ 촬영형식 표시 스타일 */
        .location-shooting-types {
          margin-top: 6px;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          white-space: normal; /* ✅ location-cell이 nowrap이어도 여기만 줄바꿈 허용 */
        }

        .shooting-type-chip {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: rgba(255, 255, 255, 0.65);
          color: #374151;
          line-height: 1.2;
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .shooting-type-chip.primary {
          border-color: ${brandColor};
          color: ${brandColor};
          background: rgba(5, 150, 105, 0.08);
          font-weight: var(--fw-semibold);
        }

        .shooting-type-more {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #6b7280;
          line-height: 1.2;
        }

        .schedule-cell {
          padding: 0;
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
          background: white;
          height: 100px;
          position: relative;
          cursor: pointer;
        }

        .schedule-cell:last-child {
          border-right: none;
        }

        .cell-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 100px;
          padding: 6px;
          position: relative;
        }

        .schedule-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1 1 auto;
          overflow: auto;
          max-height: calc(100% - 36px);
        }

        .schedule-wrapper {
          position: relative;
        }

        .selection-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          font-size: 10px;
          font-weight: var(--fw-semibold);
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.12);
          color: #2563eb;
          opacity: 0.9;
          pointer-events: none;
          z-index: 2;
        }

        .default-schedule-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 6px;
          font-size: 11px;
          transition: all 0.15s ease;
          cursor: pointer;
          flex-shrink: 0;
          font-weight: var(--fw-regular);
        }

        .default-schedule-card:hover {
          border-color: ${brandColor};
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
        }

        .default-schedule-card.selected {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
        }

        .card-time {
          font-weight: var(--fw-semibold);
          color: #1f2937;
          margin-bottom: 3px;
          font-size: 12px;
        }

        .card-content {
          color: #374151;
          margin-bottom: 2px;
          font-size: 10px;
          font-weight: var(--fw-regular);
        }

        .card-sub {
          color: #6b7280;
          font-size: 9px;
          font-weight: var(--fw-regular);
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
          border-radius: 6px;
          font-size: 11px;
          font-weight: var(--fw-medium);
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          overflow: hidden;
        }

        .add-schedule-btn:hover {
          background: rgba(248, 250, 252, 1);
          border-style: solid;
          transform: translateY(-1px);
        }

        .cell-disabled {
          cursor: not-allowed;
          opacity: 0.85;
        }

        .disabled-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(243, 244, 246, 0.72);
          pointer-events: none;
        }

        .disabled-text {
          font-size: 11px;
          font-weight: var(--fw-semibold);
          color: #6b7280;
          background: rgba(255, 255, 255, 0.9);
          padding: 6px 10px;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
        }

        @media (max-width: 768px) {
          .schedule-toolbar {
            padding: 8px 16px;
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }

          .navigation-section {
            justify-content: center;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}

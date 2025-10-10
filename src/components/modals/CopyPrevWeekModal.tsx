"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";

interface CopyItem {
  id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  professor_name: string;
  course_name: string;
  course_code: string;
  shooting_type: string;
  notes: string;
  sub_location_id: number;
  approval_status: string;
  team_id: number;
  // 🔥 별도로 조회할 위치 정보
  location_name?: string;
  main_location_name?: string;
}

interface CopyPrevWeekModalProps {
  open: boolean;
  onClose: () => void;
  currentWeek: Date;
  onCopyComplete: (count: number) => void;
  scheduleType: string;
  userRole: string;
  selectedAcademies?: number[];
}

export function CopyPrevWeekModal({
  open,
  onClose,
  currentWeek,
  onCopyComplete,
  scheduleType,
  userRole,
  selectedAcademies = []
}: CopyPrevWeekModalProps) {
  const [items, setItems] = useState<CopyItem[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Set<number>>(new Set());

  // 지난 주 날짜 계산
  const getPrevWeekDates = () => {
    const prevWeek = new Date(currentWeek);
    prevWeek.setDate(prevWeek.getDate() - 7);
    
    const startOfWeek = new Date(prevWeek);
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0]
    };
  };

  // 🔥 위치 정보를 별도로 조회하는 함수
  const fetchLocationInfo = async (scheduleData: any[]) => {
    try {
      // 고유한 sub_location_id 목록 추출
      const locationIds = [...new Set(scheduleData.map(item => item.sub_location_id))];
      
      if (locationIds.length === 0) return scheduleData;

      // sub_locations와 main_locations 조회
      const { data: locationData, error } = await supabase
        .from('sub_locations')
        .select(`
          id,
          name,
          main_location_id,
          main_locations!inner(id, name)
        `)
        .in('id', locationIds);

      if (error) {
        console.error('위치 정보 조회 오류:', error);
        return scheduleData;
      }

      // 스케줄 데이터에 위치 정보 매핑
      const enrichedData = scheduleData.map(schedule => {
        const locationInfo = locationData?.find(loc => loc.id === schedule.sub_location_id);
        return {
          ...schedule,
          location_name: locationInfo?.name || '알 수 없음',
          main_location_name: locationInfo?.main_locations?.name || '알 수 없음'
        };
      });

      return enrichedData;
    } catch (error) {
      console.error('위치 정보 매핑 중 오류:', error);
      return scheduleData;
    }
  };

  // 지난 주 스케줄 로드
  useEffect(() => {
    if (!open) return;
    
    const loadPrevWeekSchedules = async () => {
      setLoading(true);
      try {
        const { start, end } = getPrevWeekDates();
        
        // 🔥 스케줄 데이터만 먼저 조회 (sub_locations 제거)
        let query = supabase
          .from('schedules')
          .select('*')
          .eq('schedule_type', scheduleType)
          .eq('is_active', true)
          .gte('shoot_date', start)
          .lte('shoot_date', end);

        if (userRole === 'manager' && selectedAcademies.length > 0) {
          query = query.in('team_id', selectedAcademies);
        }

        const { data: scheduleData, error } = await query.order('shoot_date').order('start_time');
        
        if (error) {
          console.error('지난 주 스케줄 조회 오류:', error);
          setItems([]);
          return;
        }

        // 🔥 위치 정보를 별도로 조회하여 매핑
        const enrichedData = await fetchLocationInfo(scheduleData || []);
        
        setItems(enrichedData);
        // 기본적으로 모든 항목 선택
        setChecked(new Set(enrichedData?.map(item => item.id) || []));
        
      } catch (error) {
        console.error('지난 주 스케줄 로드 중 오류:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadPrevWeekSchedules();
  }, [open, currentWeek, scheduleType, userRole, selectedAcademies]);

  // 충돌 체크
  useEffect(() => {
    if (items.length === 0) return;
    
    const checkConflicts = async () => {
      try {
        const currentWeekDates = getPrevWeekDates();
        currentWeekDates.start = new Date(new Date(currentWeekDates.start).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        currentWeekDates.end = new Date(new Date(currentWeekDates.end).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const { data: existingSchedules } = await supabase
          .from('schedules')
          .select('shoot_date, start_time, sub_location_id')
          .eq('schedule_type', scheduleType)
          .eq('is_active', true)
          .gte('shoot_date', currentWeekDates.start)
          .lte('shoot_date', currentWeekDates.end);

        const conflictSet = new Set<number>();
        
        items.forEach(item => {
          const targetDate = new Date(new Date(item.shoot_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const hasConflict = existingSchedules?.some(existing => 
            existing.shoot_date === targetDate &&
            existing.start_time === item.start_time &&
            existing.sub_location_id === item.sub_location_id
          );
          
          if (hasConflict) {
            conflictSet.add(item.id);
          }
        });
        
        setConflicts(conflictSet);
      } catch (error) {
        console.error('충돌 체크 오류:', error);
      }
    };

    checkConflicts();
  }, [items, scheduleType]);

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (checked.size === items.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(items.map(item => item.id)));
    }
  };

  // 개별 선택/해제
  const handleItemCheck = (id: number) => {
    const newChecked = new Set(checked);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setChecked(newChecked);
  };

  // 복사 실행
  const handleCopy = async () => {
    if (checked.size === 0) {
      alert('복사할 스케줄을 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const selectedItems = items.filter(item => checked.has(item.id) && !conflicts.has(item.id));
      
      const copyData = selectedItems.map(item => {
        const targetDate = new Date(new Date(item.shoot_date).getTime() + 7 * 24 * 60 * 60 * 1000);
        
        // 🔥 DB 스키마에 맞는 필드만 복사
        return {
          shoot_date: targetDate.toISOString().split('T')[0],
          start_time: item.start_time,
          end_time: item.end_time,
          professor_name: item.professor_name,
          course_name: item.course_name,
          course_code: item.course_code,
          schedule_type: item.schedule_type,
          approval_status: 'pending', // 새로 복사된 스케줄은 임시저장 상태
          shooting_type: item.shooting_type,
          notes: item.notes,
          sub_location_id: item.sub_location_id,
          team_id: item.team_id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('schedules')
        .insert(copyData);

      if (error) {
        alert('복사 실패: ' + error.message);
      } else {
        const conflictCount = Array.from(checked).filter(id => conflicts.has(id)).length;
        onCopyComplete(copyData.length);
        
        if (conflictCount > 0) {
          alert(`${copyData.length}개 스케줄이 복사되었습니다. (${conflictCount}개 중복 제외)`);
        } else {
          alert(`${copyData.length}개 스케줄이 복사되었습니다.`);
        }
        onClose();
      }
    } catch (error) {
      console.error('복사 중 오류:', error);
      alert('복사 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22c55e';
      case 'approval_requested': return '#f59e0b';
      case 'pending': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // 상태별 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '승인완료';
      case 'approval_requested': return '승인요청';
      case 'pending': return '임시저장';
      default: return '기타';
    }
  };

  if (!open) return null;

  const selectedCount = checked.size;
  const conflictCount = Array.from(checked).filter(id => conflicts.has(id)).length;
  const validCount = selectedCount - conflictCount;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>지난 주 스케줄 선택 복사</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>지난 주 스케줄을 불러오는 중...</p>
            </div>
          ) : (
            <>
              <div className="summary-bar">
                <div className="summary-info">
                  <span>총 {items.length}개 스케줄</span>
                  <span>선택: {selectedCount}개</span>
                  {conflictCount > 0 && <span className="conflict">중복: {conflictCount}개</span>}
                </div>
                <button onClick={handleSelectAll} className="select-all-btn">
                  {checked.size === items.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              <div className="schedule-list">
                {items.length === 0 ? (
                  <div className="empty-state">
                    <p>복사할 지난 주 스케줄이 없습니다.</p>
                  </div>
                ) : (
                  items.map(item => {
                    const isChecked = checked.has(item.id);
                    const hasConflict = conflicts.has(item.id);
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`schedule-item ${hasConflict ? 'conflict' : ''}`}
                        onClick={() => handleItemCheck(item.id)}
                      >
                        <div className="item-checkbox">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleItemCheck(item.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        
                        <div className="item-content">
                          <div className="item-header">
                            <span className="item-time">
                              {item.start_time?.substring(0, 5)}~{item.end_time?.substring(0, 5)}
                            </span>
                            <span className="item-date">
                              {new Date(item.shoot_date).toLocaleDateString('ko-KR', { 
                                month: 'short', 
                                day: 'numeric',
                                weekday: 'short'
                              })}
                            </span>
                          </div>
                          
                          <div className="item-details">
                            <div className="item-title">
                              {item.professor_name} / {item.course_name}
                            </div>
                            <div className="item-location">
                              {item.main_location_name} - {item.location_name}
                            </div>
                          </div>
                          
                          <div className="item-footer">
                            <span className="item-type">{item.shooting_type}</span>
                            <span 
                              className="item-status"
                              style={{ 
                                backgroundColor: getStatusColor(item.approval_status),
                                color: 'white'
                              }}
                            >
                              {getStatusText(item.approval_status)}
                            </span>
                            {hasConflict && (
                              <span className="conflict-badge">중복</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-info">
            {validCount > 0 && (
              <span className="copy-info">
                {validCount}개 스케줄이 복사됩니다
              </span>
            )}
          </div>
          <div className="footer-actions">
            <button onClick={onClose} className="cancel-btn">
              취소
            </button>
            <button 
              onClick={handleCopy} 
              className="copy-btn"
              disabled={loading || validCount === 0}
            >
              {loading ? '복사 중...' : `${validCount}개 복사`}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-container {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }

        .close-button:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .modal-content {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #6b7280;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .summary-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .summary-info {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: #6b7280;
        }

        .summary-info .conflict {
          color: #dc2626;
          font-weight: 600;
        }

        .select-all-btn {
          padding: 6px 12px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .select-all-btn:hover {
          background: #2563eb;
        }

        .schedule-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #6b7280;
        }

        .schedule-item {
          display: flex;
          gap: 12px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .schedule-item:hover {
          border-color: #3b82f6;
          background: #f8fafc;
        }

        .schedule-item.conflict {
          border-color: #fca5a5;
          background: #fef2f2;
        }

        .item-checkbox {
          display: flex;
          align-items: flex-start;
          padding-top: 2px;
        }

        .item-checkbox input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .item-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .item-time {
          font-size: 14px;
          font-weight: 700;
          color: #1f2937;
        }

        .item-date {
          font-size: 12px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .item-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .item-title {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
        }

        .item-location {
          font-size: 12px;
          color: #6b7280;
        }

        .item-footer {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .item-type {
          font-size: 10px;
          background: #1f2937;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .item-status {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .conflict-badge {
          font-size: 10px;
          background: #dc2626;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .footer-info {
          font-size: 14px;
          color: #6b7280;
        }

        .copy-info {
          font-weight: 600;
          color: #3b82f6;
        }

        .footer-actions {
          display: flex;
          gap: 12px;
        }

        .cancel-btn {
          padding: 10px 20px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          color: #374151;
        }

        .cancel-btn:hover {
          background: #f9fafb;
        }

        .copy-btn {
          padding: 10px 20px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          color: white;
        }

        .copy-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .copy-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .modal-container {
            width: 95%;
            max-height: 90vh;
          }

          .summary-bar {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .item-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .footer-actions {
            flex-direction: column;
            width: 100%;
          }

          .cancel-btn, .copy-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

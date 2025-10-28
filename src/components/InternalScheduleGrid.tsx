"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import BaseScheduleGrid from "./core/BaseScheduleGrid";
import { useWeek } from "../contexts/WeekContext";

// 업무 구분
const internalLocationTypes = [
  { id: 1, name: 'Helper' },
  { id: 2, name: '행사' },
  { id: 3, name: '기타' },
  { id: 4, name: '장비/스튜디오대여' },
  { id: 5, name: '당직' },
  { id: 6, name: '근무' },
  { id: 7, name: '고정휴무' },
  { id: 8, name: '개인휴무' }
];

// 강조 색상 옵션
const shadowOptions = [
  { name: '없음', value: null },
  { name: '회색', value: '#6B7280' },
  { name: '파란색', value: '#2563EB' },
  { name: '초록색', value: '#059669' },
  { name: '주황색', value: '#EA580C' },
  { name: '빨간색', value: '#DC2626' },
  { name: '보라색', value: '#7C3AED' },
  { name: '분홍색', value: '#DB2777' },
  { name: '청록색', value: '#0891B2' }
];

// 개인휴무 종류
const leaveTypes = ['연차', '반차', '공가', '병가', '경조사', '기타'];

// 시간 포맷 함수 (09:00 → 9, 09:30 → 9:30)
const formatTime = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const minute = m === '00' ? '' : `:${m}`;
  return `${hour}${minute}`;
};

const getContrastColor = (hexColor: string | null) => {
  if (!hexColor || hexColor === 'transparent' || hexColor === 'null') {
    return 'var(--text-primary)';
  }
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return 'var(--text-primary)';
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#1F2937' : '#FFFFFF';
};

interface InternalScheduleGridProps {
  title: string;
}

export default function InternalScheduleGrid({ title }: InternalScheduleGridProps) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{date: string, type: string} | null>(null);
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [textInput, setTextInput] = useState('');
  
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  
  const [helpers, setHelpers] = useState<Array<{
    user_id: number | null;
    helper_type: 'early_arrival' | 'early_leave';
    time: string;
    reason: string;
  }>>([{
    user_id: null,
    helper_type: 'early_arrival',
    time: '07:00',
    reason: ''
  }]);
  
  const [leaves, setLeaves] = useState<Array<{
    user_id: number | null;
    leave_type: string;
  }>>([{
    user_id: null,
    leave_type: '연차'
  }]);
  
  const [workUserIds, setWorkUserIds] = useState<Array<number | null>>([null]);
  
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [selectedShadow, setSelectedShadow] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('#6B7280');
  const isProcessingRef = useRef(false);

  const { currentWeek, navigateWeek } = useWeek();

  useEffect(() => {
    fetchEmployees();
    fetchSchedules();
  }, [currentWeek]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'schedule_admin')
        .eq('is_active', true)
        .neq('id', 2)
        .order('name');
      
      if (!error && data) {
        setEmployees(data);
      }
    } catch (error) {
      console.error('직원 목록 조회 실패:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const weekDates = generateWeekDates();
      const startDate = weekDates[0].date;
      const endDate = weekDates[6].date;

      const locationNames = internalLocationTypes.map(loc => loc.name);

      const { data, error } = await supabase
        .from('internal_schedules')
        .select(`
          id, 
          schedule_date, 
          schedule_type, 
          content, 
          shadow_color, 
          created_at,
          user_id,
          helper_type,
          helper_time,
          helper_reason,
          leave_type,
          users:user_id (id, name)
        `)
        .in('schedule_type', locationNames)
        .eq('is_active', true)
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .order('schedule_date')
        .order('created_at');
      
      if (error) {
        setSchedules([]);
      } else {
        setSchedules(data || []);
      }
    } catch (error) {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

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
        id: dateStr,
        date: dateStr,
        day: date.getDate()
      });
    }
    return dates;
  };

  const getScheduleForCell = (date: string, location: any) => {
    const locationType = location.name;
    return schedules.filter(s => s.schedule_date === date && s.schedule_type === locationType);
  };

  const handleCellClick = (date: string, location: any) => {
    const locationType = location.name;
    setSelectedCell({ date, type: locationType });
    resetFormInputs();
    setShowForm(true);
  };

  const handleScheduleClick = (schedule: any) => {
    setSelectedCell({ date: schedule.schedule_date, type: schedule.schedule_type });
    setEditingSchedule(schedule);
    
    if (schedule.schedule_type === '당직') {
      setSelectedUserId(schedule.user_id);
    } else if (schedule.schedule_type === 'Helper') {
      setHelpers([{
        user_id: schedule.user_id,
        helper_type: schedule.helper_type || 'early_arrival',
        time: schedule.helper_time || '07:00',
        reason: schedule.helper_reason || ''
      }]);
    } else if (schedule.schedule_type === '개인휴무') {
      setLeaves([{
        user_id: schedule.user_id,
        leave_type: schedule.leave_type || '연차'
      }]);
    } else if (schedule.schedule_type === '근무' || schedule.schedule_type === '고정근무') {
      setWorkUserIds([schedule.user_id]);
    } else {
      setTextInput(schedule.content || '');
    }
    
    setSelectedShadow(schedule.shadow_color);
    setCustomColor(schedule.shadow_color || '#6B7280');
    setShowForm(true);
  };

  const resetFormInputs = () => {
    setTextInput('');
    setSelectedUserId(null);
    setHelpers([{ user_id: null, helper_type: 'early_arrival', time: '07:00', reason: '' }]);
    setLeaves([{ user_id: null, leave_type: '연차' }]);
    setWorkUserIds([null]);
    setEditingSchedule(null);
    setSelectedShadow(null);
    setCustomColor('#6B7280');
  };

  const renderScheduleCard = (schedule: any) => {
    const shadowColor = schedule.shadow_color;
    const backgroundColor = shadowColor || 'var(--bg-secondary)';
    const textColor = getContrastColor(shadowColor);

    let displayContent = schedule.content || '내용 없음';
    
    if (schedule.user_id && schedule.users) {
      const userName = schedule.users.name;
      
      if (schedule.schedule_type === 'Helper') {
        const timeStr = schedule.helper_time ? formatTime(schedule.helper_time) : '';
        const suffix = schedule.helper_type === 'early_arrival' ? '출' : '';
        displayContent = `${userName} (${timeStr}${suffix})`;
        if (schedule.helper_reason) {
          displayContent += `\n사유: ${schedule.helper_reason}`;
        }
      } else if (schedule.schedule_type === '개인휴무') {
        displayContent = `${userName} (${schedule.leave_type || ''})`;
      } else if (schedule.schedule_type === '당직' || schedule.schedule_type === '근무' || schedule.schedule_type === '고정근무') {
        displayContent = userName;
      }
    }

    return (
      <div 
        key={schedule.id} 
        onClick={(e) => {
            e.stopPropagation();
            handleScheduleClick(schedule);
        }}
        style={{ 
            padding: 12,
            background: backgroundColor,
            borderRadius: 6,
            fontSize: 12,
            position: 'relative',
            cursor: 'pointer',
            marginBottom: 6,
            transition: 'all 0.2s ease',
            border: shadowColor ? `1px solid ${shadowColor}` : '1px solid var(--border-color)',
            boxShadow: shadowColor ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
        }}
        >
        <div style={{
          fontSize: '10px',
          background: shadowColor ? 'rgba(255, 255, 255, 0.2)' : 'var(--accent-color)',
          color: shadowColor ? textColor : 'white',
          padding: '2px 6px',
          borderRadius: 4,
          marginBottom: 6,
          fontWeight: 'bold',
          display: 'inline-block',
          border: shadowColor ? `1px solid rgba(255, 255, 255, 0.3)` : 'none'
        }}>
          {schedule.schedule_type}
        </div>
        <div style={{ 
          color: textColor,
          lineHeight: 1.4,
          fontSize: 12,
          fontWeight: '600',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap'
        }}>
          {displayContent}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteSchedule(schedule.id);
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            background: 'rgba(220, 53, 69, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>
      </div>
    );
  };

  const handleSaveText = async () => {
    if (isProcessingRef.current) return;
    if (!selectedCell) return;

    try {
      isProcessingRef.current = true;
      const scheduleType = selectedCell.type;

      const records: any[] = [];

      if (scheduleType === '당직') {
        if (!selectedUserId) {
          alert('직원을 선택해주세요.');
          return;
        }
        const userName = employees.find(e => e.id === selectedUserId)?.name;
        records.push({
          schedule_date: selectedCell.date,
          schedule_type: scheduleType,
          user_id: selectedUserId,
          content: userName,
          shadow_color: selectedShadow,
          is_active: true
        });
      }
      else if (scheduleType === 'Helper') {
        for (const h of helpers) {
          if (!h.user_id) {
            alert('직원을 선택해주세요.');
            return;
          }
          const userName = employees.find(e => e.id === h.user_id)?.name;
          const timeDisplay = formatTime(h.time);
          const suffix = h.helper_type === 'early_arrival' ? '출' : '';
          records.push({
            schedule_date: selectedCell.date,
            schedule_type: scheduleType,
            user_id: h.user_id,
            helper_type: h.helper_type,
            helper_time: h.time,
            helper_reason: h.reason,
            content: `${userName} (${timeDisplay}${suffix})`,
            shadow_color: selectedShadow,
            is_active: true
          });
        }
      }
      else if (scheduleType === '개인휴무') {
        for (const l of leaves) {
          if (!l.user_id) {
            alert('직원을 선택해주세요.');
            return;
          }
          const userName = employees.find(e => e.id === l.user_id)?.name;
          records.push({
            schedule_date: selectedCell.date,
            schedule_type: scheduleType,
            user_id: l.user_id,
            leave_type: l.leave_type,
            content: `${userName} (${l.leave_type})`,
            shadow_color: selectedShadow,
            is_active: true
          });
        }
      }
      else if (scheduleType === '근무' || scheduleType === '고정근무') {
        for (const userId of workUserIds) {
          if (!userId) {
            alert('직원을 선택해주세요.');
            return;
          }
          const userName = employees.find(e => e.id === userId)?.name;
          records.push({
            schedule_date: selectedCell.date,
            schedule_type: scheduleType,
            user_id: userId,
            content: userName,
            shadow_color: selectedShadow,
            is_active: true
          });
        }
      }
      else {
        if (!textInput.trim()) {
          alert('내용을 입력해주세요.');
          return;
        }
        records.push({
          schedule_date: selectedCell.date,
          schedule_type: scheduleType,
          content: textInput.trim(),
          shadow_color: selectedShadow,
          is_active: true
        });
      }

      if (editingSchedule) {
        const { error } = await supabase
          .from('internal_schedules')
          .update({
            ...records[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', editingSchedule.id);
        if (error) throw error;
        alert('수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('internal_schedules')
          .insert(records);
        if (error) throw error;
        alert('저장되었습니다.');
      }

      setShowForm(false);
      resetFormInputs();
      await fetchSchedules();
    } catch (error: any) {
      alert('처리 실패: ' + error.message);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (isProcessingRef.current) return;
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      isProcessingRef.current = true;
      const { error } = await supabase
        .from('internal_schedules')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);
      if (error) throw error;
      alert('삭제되었습니다.');
      await fetchSchedules();
    } catch (error: any) {
      alert('삭제 실패: ' + error.message);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  const handleColorSelect = (color: string | null) => {
    setSelectedShadow(color);
    if (color) {
      setCustomColor(color);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)'
      }}>
        내부업무 스케줄 로딩 중...
      </div>
    );
  }

  // ✅ Helper 시간 옵션 생성 함수
  const getHelperTimeOptions = (helperType: 'early_arrival' | 'early_leave'): string[] => {
    const options: string[] = [];
    
    if (helperType === 'early_arrival') {
      for (let h = 7; h <= 9; h++) {
        for (let m = 0; m < 60; m += 30) {
          if (h === 9 && m > 0) break;
          const hh = String(h).padStart(2, '0');
          const mm = String(m).padStart(2, '0');
          options.push(`${hh}:${mm}`);
        }
      }
    } else {
      for (let h = 15; h <= 18; h++) {
        for (let m = 0; m < 60; m += 30) {
          if (h === 18 && m > 0) break;
          const hh = String(h).padStart(2, '0');
          const mm = String(m).padStart(2, '0');
          options.push(`${hh}:${mm}`);
        }
      }
    }
    
    return options;
  };

  const renderFormContent = () => {
    if (!selectedCell) return null;

    const scheduleType = selectedCell.type;

    if (scheduleType === '당직') {
      return (
        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 8, 
            fontSize: 14, 
            fontWeight: 600,
            color: 'var(--text-primary)'
          }}>
            당직 직원 선택
          </label>
          <select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            style={{ 
              width: '100%', 
              padding: 12, 
              border: '1px solid var(--border-color)', 
              borderRadius: 6,
              fontSize: 14,
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="">직원 선택</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
      );
    }

    if (scheduleType === 'Helper') {
      return (
        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 12, 
            fontSize: 14, 
            fontWeight: 600,
            color: 'var(--text-primary)'
          }}>
            Helper 등록
          </label>
          {helpers.map((helper, idx) => {
            const timeOptions = getHelperTimeOptions(helper.helper_type);
            
            return (
              <div key={idx} style={{ 
                marginBottom: 12, 
                padding: 12, 
                background: 'var(--bg-primary)', 
                borderRadius: 6,
                border: '1px solid var(--border-color)'
              }}>
                <select
                  value={helper.user_id || ''}
                  onChange={(e) => {
                    const newHelpers = [...helpers];
                    newHelpers[idx].user_id = Number(e.target.value);
                    setHelpers(newHelpers);
                  }}
                  style={{ 
                    width: '100%', 
                    padding: 8, 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 4,
                    fontSize: 14,
                    marginBottom: 8,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">직원 선택</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>

                <select
                  value={helper.helper_type}
                  onChange={(e) => {
                    const newHelpers = [...helpers];
                    const newType = e.target.value as 'early_arrival' | 'early_leave';
                    newHelpers[idx].helper_type = newType;
                    newHelpers[idx].time = newType === 'early_arrival' ? '07:00' : '15:00';
                    setHelpers(newHelpers);
                  }}
                  style={{ 
                    width: '100%', 
                    padding: 8, 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 4,
                    fontSize: 14,
                    marginBottom: 8,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="early_arrival">조기출근</option>
                  <option value="early_leave">조기퇴근</option>
                </select>

                <select
                  value={helper.time}
                  onChange={(e) => {
                    const newHelpers = [...helpers];
                    newHelpers[idx].time = e.target.value;
                    setHelpers(newHelpers);
                  }}
                  style={{ 
                    width: '100%', 
                    padding: 8, 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 4,
                    fontSize: 14,
                    marginBottom: 8,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {timeOptions.map(time => {
                    const display = helper.helper_type === 'early_arrival' 
                      ? `${formatTime(time)}출` 
                      : formatTime(time);
                    return (
                      <option key={time} value={time}>{display}</option>
                    );
                  })}
                </select>

                {helper.helper_type === 'early_leave' && (
                  <input
                    type="text"
                    placeholder="조기퇴근 사유"
                    value={helper.reason}
                    onChange={(e) => {
                      const newHelpers = [...helpers];
                      newHelpers[idx].reason = e.target.value;
                      setHelpers(newHelpers);
                    }}
                    style={{ 
                      width: '100%', 
                      padding: 8, 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 4,
                      fontSize: 14,
                      marginBottom: 8,
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                )}

                {helpers.length > 1 && (
                  <button
                    onClick={() => setHelpers(helpers.filter((_, i) => i !== idx))}
                    style={{ 
                      padding: '6px 12px', 
                      background: '#dc3545', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 4,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => setHelpers([...helpers, { user_id: null, helper_type: 'early_arrival', time: '07:00', reason: '' }])}
            style={{ 
              padding: '8px 16px', 
              background: 'var(--accent-color)', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            + Helper 추가
          </button>
        </div>
      );
    }

    if (scheduleType === '개인휴무') {
      return (
        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 12, 
            fontSize: 14, 
            fontWeight: 600,
            color: 'var(--text-primary)'
          }}>
            휴무자 등록
          </label>
          {leaves.map((leave, idx) => (
            <div key={idx} style={{ 
              marginBottom: 12, 
              padding: 12, 
              background: 'var(--bg-primary)', 
              borderRadius: 6,
              border: '1px solid var(--border-color)'
            }}>
              <select
                value={leave.user_id || ''}
                onChange={(e) => {
                  const newLeaves = [...leaves];
                  newLeaves[idx].user_id = Number(e.target.value);
                  setLeaves(newLeaves);
                }}
                style={{ 
                  width: '100%', 
                  padding: 8, 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 4,
                  fontSize: 14,
                  marginBottom: 8,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">직원 선택</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>

              <select
                value={leave.leave_type}
                onChange={(e) => {
                  const newLeaves = [...leaves];
                  newLeaves[idx].leave_type = e.target.value;
                  setLeaves(newLeaves);
                }}
                style={{ 
                  width: '100%', 
                  padding: 8, 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 4,
                  fontSize: 14,
                  marginBottom: 8,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)'
                }}
              >
                {leaveTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              {leaves.length > 1 && (
                <button
                  onClick={() => setLeaves(leaves.filter((_, i) => i !== idx))}
                  style={{ 
                    padding: '6px 12px', 
                    background: '#dc3545', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  삭제
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setLeaves([...leaves, { user_id: null, leave_type: '연차' }])}
            style={{ 
              padding: '8px 16px', 
              background: 'var(--accent-color)', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            + 휴무자 추가
          </button>
        </div>
      );
    }

    if (scheduleType === '근무' || scheduleType === '고정근무') {
      return (
        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 12, 
            fontSize: 14, 
            fontWeight: 600,
            color: 'var(--text-primary)'
          }}>
            근무자 선택
          </label>
          {workUserIds.map((userId, idx) => (
            <div key={idx} style={{ 
              marginBottom: 12, 
              padding: 12, 
              background: 'var(--bg-primary)', 
              borderRadius: 6,
              border: '1px solid var(--border-color)'
            }}>
              <select
                value={userId || ''}
                onChange={(e) => {
                  const newIds = [...workUserIds];
                  newIds[idx] = Number(e.target.value);
                  setWorkUserIds(newIds);
                }}
                style={{ 
                  width: '100%', 
                  padding: 8, 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 4,
                  fontSize: 14,
                  marginBottom: 8,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">직원 선택</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>

              {workUserIds.length > 1 && (
                <button
                  onClick={() => setWorkUserIds(workUserIds.filter((_, i) => i !== idx))}
                  style={{ 
                    padding: '6px 12px', 
                    background: '#dc3545', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  삭제
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setWorkUserIds([...workUserIds, null])}
            style={{ 
              padding: '8px 16px', 
              background: 'var(--accent-color)', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            + 근무자 추가
          </button>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 20 }}>
        <label style={{ 
          display: 'block', 
          marginBottom: 8, 
          fontSize: 14, 
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          내용
        </label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="업무 내용을 입력하세요"
          rows={4}
          style={{ 
            width: '100%', 
            padding: 12, 
            border: '1px solid var(--border-color)', 
            borderRadius: 6,
            resize: 'vertical',
            fontSize: 14,
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            boxSizing: 'border-box'
          }}
        />
      </div>
    );
  };

  return (
    <>
      <BaseScheduleGrid
        title={title}
        leftColumnTitle="업무 구분"
        locations={internalLocationTypes}
        schedules={schedules}
        currentWeek={currentWeek}
        onWeekChange={navigateWeek}
        onCellClick={handleCellClick}
        getScheduleForCell={getScheduleForCell}
        renderScheduleCard={renderScheduleCard}
        showAddButton={true}
        userRole="admin"
        pageType="internal"
      />

      {showForm && selectedCell && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ 
            background: 'var(--bg-secondary)', 
            borderRadius: 12, 
            padding: 30, 
            maxWidth: 500, 
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)' }}>
              {editingSchedule ? `${selectedCell.type} 수정` : `${selectedCell.type} 추가`}
            </h3>
            
            <div style={{ marginBottom: 16, color: 'var(--text-primary)' }}>
              <strong>날짜:</strong> {selectedCell.date}
            </div>
            
            {renderFormContent()}

            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: 'block', 
                marginBottom: 12, 
                fontSize: 14, 
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                강조 색상 (선택사항)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                {shadowOptions.map((option, index) => (
                  <label key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: option.value || 'var(--bg-primary)',
                    color: option.value ? getContrastColor(option.value) : 'var(--text-primary)',
                    border: selectedShadow === option.value ? '3px solid var(--accent-color)' : '2px solid var(--border-color)',
                    transition: 'all 0.2s ease',
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    <input
                      type="radio"
                      name="shadow"
                      checked={selectedShadow === option.value}
                      onChange={() => handleColorSelect(option.value)}
                      style={{ margin: 0 }}
                    />
                    {option.name}
                  </label>
                ))}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12,
                padding: '12px',
                background: 'var(--bg-primary)',
                borderRadius: 6,
                border: '1px solid var(--border-color)'
              }}>
                <label style={{ 
                  fontSize: 12, 
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  minWidth: '80px'
                }}>
                  직접 선택:
                </label>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => handleColorSelect(e.target.value)}
                  style={{ 
                    width: 40, 
                    height: 40, 
                    border: 'none', 
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: 'none'
                  }}
                  title="색상 직접 선택"
                />
                <div style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: selectedShadow || 'var(--bg-secondary)',
                  color: getContrastColor(selectedShadow),
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center',
                  border: '1px solid var(--border-color)'
                }}>
                  {selectedShadow ? '강조 미리보기' : '기본 배경'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {editingSchedule && (
                <button 
                  onClick={() => handleDeleteSchedule(editingSchedule.id)}
                  disabled={isProcessingRef.current}
                  style={{ 
                    padding: '10px 20px', 
                    background: isProcessingRef.current ? '#ccc' : '#dc3545', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 6, 
                    cursor: isProcessingRef.current ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  {isProcessingRef.current ? '처리중...' : '삭제'}
                </button>
              )}
              <button 
                onClick={() => {
                  setShowForm(false);
                  resetFormInputs();
                }}
                style={{ 
                  padding: '10px 20px', 
                  background: 'var(--text-secondary)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                취소
              </button>
              <button 
                onClick={handleSaveText}
                disabled={isProcessingRef.current}
                style={{ 
                  padding: '10px 20px', 
                  background: isProcessingRef.current ? '#ccc' : 'var(--accent-color)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: isProcessingRef.current ? 'not-allowed' : 'pointer',
                  fontWeight: 600
                }}
              >
                {isProcessingRef.current ? '처리중...' : (editingSchedule ? '수정' : '저장')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import BaseScheduleGrid from "./core/BaseScheduleGrid";
import { useWeek } from "../contexts/WeekContext";

// 객체 배열로 수정!
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
  const [textInput, setTextInput] = useState('');
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [selectedShadow, setSelectedShadow] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('#6B7280');
  const isProcessingRef = useRef(false);

  const { currentWeek, navigateWeek } = useWeek();

  useEffect(() => {
    fetchSchedules();
  }, [currentWeek]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const weekDates = generateWeekDates();
      const startDate = weekDates[0].date;
      const endDate = weekDates[6].date;

      // 객체 배열에서 name만 추출해서 쿼리에 사용
      const locationNames = internalLocationTypes.map(loc => loc.name);

      const { data, error } = await supabase
        .from('internal_schedules')
        .select('id, schedule_date, schedule_type, content, shadow_color, created_at')
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

  // location이 객체이므로 .name 사용
  const getScheduleForCell = (date: string, location: any) => {
    const locationType = location.name;
    return schedules.filter(s => s.schedule_date === date && s.schedule_type === locationType);
  };

  const handleCellClick = (date: string, location: any) => {
    const locationType = location.name;
    setSelectedCell({ date, type: locationType });
    setTextInput('');
    setEditingSchedule(null);
    setSelectedShadow(null);
    setCustomColor('#6B7280');
    setShowForm(true);
  };

  const handleScheduleClick = (schedule: any) => {
    setSelectedCell({ date: schedule.schedule_date, type: schedule.schedule_type });
    setTextInput(schedule.content || '');
    setEditingSchedule(schedule);
    setSelectedShadow(schedule.shadow_color);
    setCustomColor(schedule.shadow_color || '#6B7280');
    setShowForm(true);
  };

  const renderScheduleCard = (schedule: any) => {
    const shadowColor = schedule.shadow_color;
    const backgroundColor = shadowColor || 'var(--bg-secondary)';
    const textColor = getContrastColor(shadowColor);

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
          {schedule.content || '내용 없음'}
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
    if (!selectedCell || !textInput.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }
    try {
      isProcessingRef.current = true;
      if (editingSchedule) {
        const { error } = await supabase
          .from('internal_schedules')
          .update({
            content: textInput.trim(),
            shadow_color: selectedShadow,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingSchedule.id);
        if (error) {
          alert('수정 실패: ' + error.message);
          return;
        } else {
          alert('수정되었습니다.');
        }
      } else {
        const { error } = await supabase
          .from('internal_schedules')
          .insert({
            schedule_date: selectedCell.date,
            schedule_type: selectedCell.type,
            content: textInput.trim(),
            shadow_color: selectedShadow,
            is_active: true,
            created_at: new Date().toISOString()
          });
        if (error) {
          alert('저장 실패: ' + error.message);
          return;
        } else {
          alert('저장되었습니다.');
        }
      }
      setShowForm(false);
      resetForm();
      await fetchSchedules();
    } catch (error) {
      alert('처리 중 오류가 발생했습니다.');
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
      if (error) {
        alert('삭제 실패: ' + error.message);
      } else {
        alert('삭제되었습니다.');
        await fetchSchedules();
      }
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  const resetForm = () => {
    setSelectedCell(null);
    setTextInput('');
    setEditingSchedule(null);
    setSelectedShadow(null);
    setCustomColor('#6B7280');
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
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)' }}>
              {editingSchedule ? `${selectedCell.type} 수정` : `${selectedCell.type} 추가`}
            </h3>
            
            <div style={{ marginBottom: 16, color: 'var(--text-primary)' }}>
              <strong>날짜:</strong> {selectedCell.date}
            </div>
            
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
                  resetForm();
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

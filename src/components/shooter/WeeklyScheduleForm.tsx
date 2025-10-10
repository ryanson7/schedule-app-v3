"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface WeeklyScheduleEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes?: string;
}

interface MainLocation {
  id: number;
  name: string;
  location_type: string;
}

interface WeeklyScheduleFormProps {
  shooterId: number;
  onScheduleSubmit?: (success: boolean) => void;
}

export default function WeeklyScheduleForm({ shooterId, onScheduleSubmit }: WeeklyScheduleFormProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState<WeeklyScheduleEntry[]>([]);
  const [mainLocations, setMainLocations] = useState<MainLocation[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shooterInfo, setShooterInfo] = useState<any>(null);

  const dayNames = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
  const timeSlots = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
    '20:00', '21:00', '22:00'
  ];

  useEffect(() => {
    loadInitialData();
  }, [shooterId, currentWeek]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadShooterInfo(),
        loadMainLocations(),
        loadExistingSchedule()
      ]);
    } catch (error) {
      console.error('초기 데이터 로딩 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadShooterInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, shooter_type, work_schedule_type')
        .eq('id', shooterId)
        .single();

      if (!error && data) {
        setShooterInfo(data);
      }
    } catch (error) {
      console.error('촬영자 정보 조회 오류:', error);
    }
  };

  const loadMainLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('main_locations')
        .select('id, name, location_type')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setMainLocations(data);
      }
    } catch (error) {
      console.error('위치 정보 조회 오류:', error);
    }
  };

  const loadExistingSchedule = async () => {
    try {
      const weekStart = getWeekStart(currentWeek);
      const weekStartStr = weekStart.toISOString().split('T')[0];

      // 기존 주간 스케줄 조회
      const { data: existingSchedule, error: scheduleError } = await supabase
        .from('shooter_weekly_availability')
        .select('*')
        .eq('shooter_id', shooterId)
        .eq('week_start_date', weekStartStr)
        .order('day_of_week')
        .order('start_time');

      // 기존 장소 선호도 조회
      const { data: existingLocations, error: locationError } = await supabase
        .from('shooter_location_preferences')
        .select('main_location_id')
        .eq('shooter_id', shooterId)
        .eq('is_preferred', true);

      if (!scheduleError && existingSchedule) {
        setScheduleEntries(existingSchedule);
      } else {
        // 기본 스케줄 생성 (촬영자 유형에 따라)
        initializeDefaultSchedule();
      }

      if (!locationError && existingLocations) {
        setSelectedLocations(existingLocations.map(loc => loc.main_location_id));
      }

    } catch (error) {
      console.error('기존 스케줄 조회 오류:', error);
      initializeDefaultSchedule();
    }
  };

  const initializeDefaultSchedule = () => {
    const defaultEntries: WeeklyScheduleEntry[] = [];
    
    // 촬영자 유형에 따른 기본 스케줄
    for (let day = 0; day < 7; day++) {
      if (shooterInfo?.shooter_type === 'employee') {
        // 직원: 평일 9-18시
        if (day < 5) {
          defaultEntries.push({
            day_of_week: day,
            start_time: '09:00',
            end_time: '18:00',
            is_available: true,
            notes: '기본 근무시간'
          });
        }
      } else if (shooterInfo?.shooter_type === 'dispatch') {
        // 파견직: 평일 + 토요일 오전
        if (day < 5) {
          defaultEntries.push({
            day_of_week: day,
            start_time: '09:00',
            end_time: '18:00',
            is_available: true,
            notes: '파견 근무시간'
          });
        } else if (day === 5) {
          defaultEntries.push({
            day_of_week: day,
            start_time: '09:00',
            end_time: '13:00',
            is_available: true,
            notes: '토요일 오전'
          });
        }
      }
      // 위탁직은 기본 스케줄 없음 (직접 입력)
    }
    
    setScheduleEntries(defaultEntries);
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  };

  const getWeekDates = () => {
    const weekStart = getWeekStart(currentWeek);
    const dates = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push({
        date: date,
        dateStr: `${date.getMonth() + 1}/${date.getDate()}`,
        dayName: dayNames[i]
      });
    }
    return dates;
  };

  const addTimeSlot = (dayOfWeek: number) => {
    const newEntry: WeeklyScheduleEntry = {
      day_of_week: dayOfWeek,
      start_time: '09:00',
      end_time: '18:00',
      is_available: true,
      notes: ''
    };
    
    setScheduleEntries([...scheduleEntries, newEntry]);
  };

  const updateTimeSlot = (index: number, field: keyof WeeklyScheduleEntry, value: any) => {
    const updatedEntries = [...scheduleEntries];
    updatedEntries[index] = { ...updatedEntries[index], [field]: value };
    setScheduleEntries(updatedEntries);
  };

  const removeTimeSlot = (index: number) => {
    const updatedEntries = scheduleEntries.filter((_, i) => i !== index);
    setScheduleEntries(updatedEntries);
  };

  const toggleLocation = (locationId: number) => {
    if (selectedLocations.includes(locationId)) {
      setSelectedLocations(selectedLocations.filter(id => id !== locationId));
    } else {
      setSelectedLocations([...selectedLocations, locationId]);
    }
  };

  const saveWeeklySchedule = async () => {
    if (scheduleEntries.length === 0) {
      alert('최소 하나의 근무 시간을 등록해주세요.');
      return;
    }

    if (selectedLocations.length === 0) {
      alert('최소 하나의 근무 가능 장소를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const weekStart = getWeekStart(currentWeek);
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const response = await fetch('/api/shooter/register-weekly-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user_id': shooterId.toString(),
          'user_role': 'shooter'
        },
        body: JSON.stringify({
          shooter_id: shooterId,
          week_start_date: weekStartStr,
          schedule_entries: scheduleEntries,
          preferred_locations: selectedLocations
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('주간 스케줄이 성공적으로 등록되었습니다!');
        if (onScheduleSubmit) {
          onScheduleSubmit(true);
        }
      } else {
        throw new Error(result.message || '등록 실패');
      }

    } catch (error) {
      console.error('주간 스케줄 저장 오류:', error);
      alert('주간 스케줄 저장 중 오류가 발생했습니다.');
      if (onScheduleSubmit) {
        onScheduleSubmit(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const navigateWeek = (direction: number) => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction * 7));
    setCurrentWeek(newWeek);
  };

  const getShooterTypeText = (type: string): string => {
    const types = {
      'employee': '직원',
      'dispatch': '파견직',
      'freelance': '위탁직'
    };
    return types[type as keyof typeof types] || '미분류';
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '300px',
        fontSize: '16px',
        color: '#64748b'
      }}>
        주간 스케줄 정보를 불러오는 중...
      </div>
    );
  }

  const weekDates = getWeekDates();

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
    }}>
      {/* 헤더 */}
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '8px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <div>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: '20px',
              fontWeight: '600'
            }}>
              주간 근무 스케줄 등록
            </h2>
            {shooterInfo && (
              <p style={{
                margin: 0,
                fontSize: '14px',
                opacity: 0.9
              }}>
                {shooterInfo.name} ({getShooterTypeText(shooterInfo.shooter_type)})
              </p>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <button
              onClick={() => navigateWeek(-1)}
              style={{
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              이전 주
            </button>
            <span style={{
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              {weekDates[0]?.dateStr} ~ {weekDates[6]?.dateStr}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              style={{
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              다음 주
            </button>
          </div>
        </div>
      </div>

      {/* 근무 가능 장소 선택 */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1e293b'
        }}>
          근무 가능 장소 선택
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {mainLocations.map(location => (
            <label
              key={location.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                border: selectedLocations.includes(location.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedLocations.includes(location.id) ? '#f0f9ff' : 'white',
                transition: 'all 0.2s'
              }}
            >
              <input
                type="checkbox"
                checked={selectedLocations.includes(location.id)}
                onChange={() => toggleLocation(location.id)}
                style={{ transform: 'scale(1.2)' }}
              />
              <div>
                <div style={{
                  fontWeight: '600',
                  color: '#1e293b',
                  fontSize: '14px'
                }}>
                  {location.name}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>
                  {location.location_type}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 주간 스케줄 그리드 */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1e293b'
        }}>
          주간 근무 시간 등록
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '12px'
        }}>
          {weekDates.map((dateInfo, dayIndex) => {
            const dayEntries = scheduleEntries.filter(entry => entry.day_of_week === dayIndex);

            return (
              <div
                key={dayIndex}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                {/* 날짜 헤더 */}
                <div style={{
                  padding: '12px 8px',
                  background: '#f8fafc',
                  textAlign: 'center',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}>
                    {dateInfo.dayName}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#64748b'
                  }}>
                    {dateInfo.dateStr}
                  </div>
                </div>

                {/* 시간 슬롯들 */}
                <div style={{ padding: '8px' }}>
                  {dayEntries.map((entry, entryIndex) => {
                    const globalIndex = scheduleEntries.findIndex(
                      e => e.day_of_week === entry.day_of_week && 
                           e.start_time === entry.start_time && 
                           e.end_time === entry.end_time
                    );

                    return (
                      <div
                        key={entryIndex}
                        style={{
                          marginBottom: '8px',
                          padding: '8px',
                          background: entry.is_available ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${entry.is_available ? '#bbf7d0' : '#fecaca'}`,
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px'
                        }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px'
                          }}>
                            <input
                              type="checkbox"
                              checked={entry.is_available}
                              onChange={(e) => updateTimeSlot(globalIndex, 'is_available', e.target.checked)}
                            />
                            근무가능
                          </label>
                          <button
                            onClick={() => removeTimeSlot(globalIndex)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ×
                          </button>
                        </div>

                        <select
                          value={entry.start_time}
                          onChange={(e) => updateTimeSlot(globalIndex, 'start_time', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '11px',
                            marginBottom: '4px'
                          }}
                        >
                          {timeSlots.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>

                        <select
                          value={entry.end_time}
                          onChange={(e) => updateTimeSlot(globalIndex, 'end_time', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '11px',
                            marginBottom: '4px'
                          }}
                        >
                          {timeSlots.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>

                        <input
                          type="text"
                          placeholder="메모"
                          value={entry.notes || ''}
                          onChange={(e) => updateTimeSlot(globalIndex, 'notes', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '11px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    );
                  })}

                  <button
                    onClick={() => addTimeSlot(dayIndex)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#f3f4f6',
                      border: '1px dashed #d1d5db',
                      borderRadius: '6px',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    + 시간 추가
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 저장 버튼 */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <button
          onClick={() => initializeDefaultSchedule()}
          style={{
            padding: '12px 24px',
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          기본 스케줄로 초기화
        </button>

        <button
          onClick={saveWeeklySchedule}
          disabled={isSaving}
          style={{
            padding: '12px 24px',
            background: isSaving ? '#9ca3af' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isSaving ? 'not-allowed' : 'pointer'
          }}
        >
          {isSaving ? '저장 중...' : '주간 스케줄 저장'}
        </button>
      </div>
    </div>
  );
}

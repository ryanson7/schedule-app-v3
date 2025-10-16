// src/pages/admin/freelancer-schedules.tsx - 최종 수정 버전
"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useWeek } from "../../contexts/WeekContext";
import React from 'react';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_NAMES = {
  monday: '월',
  tuesday: '화', 
  wednesday: '수',
  thursday: '목',
  friday: '금',
  saturday: '토',
  sunday: '일'
};

interface FreelancerSchedule {
  id: number;
  shooter_id: string;
  week_start_date: string;
  schedule_data: any;
  unavailable_reason?: string;
  is_all_unavailable: boolean;
  status: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  message?: string;
  shooter_name?: string;
  shooter_phone?: string;
  shooter_emergency?: string;
}

const generateHourOptions = () => {
  return Array.from({ length: 24 }, (_, i) => ({
    value: `${String(i).padStart(2, '0')}:00`,
    label: `${i}시`
  }));
};

const formatTime = (timeString: string): string => {
  if (!timeString) return '';
  const [hours] = timeString.split(':');
  return `${parseInt(hours)}시`;
};

const parseScheduleData = (scheduleData: any) => {
  if (!scheduleData) return null;
  
  try {
    return typeof scheduleData === 'string' ? JSON.parse(scheduleData) : scheduleData;
  } catch (error) {
    console.error('스케줄 데이터 파싱 오류:', error);
    return null;
  }
};

export default function FreelancerSchedulesPage() {
  const [schedules, setSchedules] = useState<FreelancerSchedule[]>([]);
  const [allSchedules, setAllSchedules] = useState<FreelancerSchedule[]>([]);
  const [freelancers, setFreelancers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('');
  const [weekRange, setWeekRange] = useState<{start: string; end: string}>({start: '', end: ''});
  
  const [filters, setFilters] = useState({
    freelancer: 'all',
    onlyRegistered: false
  });

  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState('');

  const [editingCell, setEditingCell] = useState<{scheduleId: number, dayKey: string} | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  const { currentWeek, navigateWeek } = useWeek();

  const getMonday = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const calculateWeekStart = (dateInput?: string | Date): string => {
    try {
      const inputDate = dateInput ? new Date(dateInput) : new Date();
      const monday = getMonday(inputDate);
      return monday.toISOString().split('T')[0];
    } catch (error) {
      console.error('날짜 계산 오류:', error);
      return new Date().toISOString().split('T')[0];
    }
  };

  const calculateWeekEnd = (weekStart: string): string => {
    try {
      const startDate = new Date(weekStart);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return endDate.toISOString().split('T')[0];
    } catch (error) {
      console.error('주말 계산 오류:', error);
      return weekStart;
    }
  };

  const formatWeekRange = (start: string, end: string): string => {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}(월)`;
      const endStr = `${endDate.getMonth() + 1}/${endDate.getDate()}(일)`;
      
      return `${startStr} ~ ${endStr}`;
    } catch (error) {
      console.error('날짜 포맷 오류:', error);
      return `${start} ~ ${end}`;
    }
  };

  useEffect(() => {
    const weekStart = calculateWeekStart(currentWeek);
    const weekEnd = calculateWeekEnd(weekStart);
    
    setCurrentWeekStart(weekStart);
    setWeekRange({ start: weekStart, end: weekEnd });
  }, [currentWeek]);

  useEffect(() => {
    if (currentWeekStart && freelancers.length > 0) {
      fetchSchedules();
    }
  }, [currentWeekStart]);

  useEffect(() => {
    fetchFreelancers();
  }, []);

  useEffect(() => {
    if (freelancers.length > 0 && currentWeekStart) {
      fetchSchedules();
    }
  }, [freelancers]);

  useEffect(() => {
    applyFilters();
  }, [filters, allSchedules, freelancers]);

  const fetchFreelancers = async () => {
    try {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, name, phone, auth_id, role, status')
        .eq('role', 'shooter')
        .eq('status', 'active')
        .order('name');

      if (userError) throw userError;

      const { data: shooters, error: shooterError } = await supabase
        .from('shooters')
        .select('user_id, shooter_type, main_location_ids, emergency_phone');

      if (shooterError) {
        console.warn('Shooters 테이블 조회 오류:', shooterError);
      }

      const freelancerUsers = (users || []).map(user => {
        const shooterInfo = (shooters || []).find(s => s.user_id === user.auth_id);
        
        return {
          ...user,
          shooter_type: shooterInfo?.shooter_type || 'freelancer',
          main_location_ids: shooterInfo?.main_location_ids || null,
          emergency_phone: shooterInfo?.emergency_phone || null
        };
      }).filter(user => user.shooter_type === 'freelancer');

      setFreelancers(freelancerUsers);
      
    } catch (error) {
      console.error('프리랜서 조회 오류:', error);
      setFreelancers([]);
      setError('프리랜서 목록을 불러오는데 실패했습니다.');
    }
  };

  const fetchSchedules = async () => {
    if (!currentWeekStart || freelancers.length === 0) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('shooter_weekly_schedule')
        .select('*')
        .eq('week_start_date', currentWeekStart)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      
      const schedulesWithShooterInfo = (data || []).map(schedule => {
        const freelancer = freelancers.find(f => f.auth_id === schedule.shooter_id);
        
        return {
          ...schedule,
          shooter_name: freelancer?.name || '알 수 없음',
          shooter_phone: freelancer?.phone || '',
          shooter_emergency: freelancer?.emergency_phone || ''
        };
      });

      setAllSchedules(schedulesWithShooterInfo);
      
    } catch (error) {
      console.error('스케줄 조회 오류:', error);
      setAllSchedules([]);
      setError('스케줄을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allSchedules];

    if (filters.freelancer !== 'all') {
      const freelancer = freelancers.find(f => String(f.id) === String(filters.freelancer));
      if (freelancer) {
        filtered = filtered.filter(s => s.shooter_id === freelancer.auth_id);
      } else {
        filtered = [];
      }
    }

    setSchedules(filtered);
  };

  const openMemoModal = (memo: string) => {
    setSelectedMemo(memo);
    setMemoModalOpen(true);
  };

  const closeMemoModal = () => {
    setMemoModalOpen(false);
    setSelectedMemo('');
  };

  const startEditingTime = (scheduleId: number, dayKey: string, startTime: string, endTime: string) => {
    setEditingCell({ scheduleId, dayKey });
    setEditStartTime(startTime);
    setEditEndTime(endTime);
  };

  const cancelEditingTime = () => {
    setEditingCell(null);
    setEditStartTime('');
    setEditEndTime('');
  };

  const saveTimeEdit = async (scheduleId: number, dayKey: string) => {
    if (!editStartTime || !editEndTime) {
      alert('시작 시간과 종료 시간을 모두 선택하세요');
      return;
    }

    if (editStartTime >= editEndTime) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다');
      return;
    }

    try {
      const schedule = allSchedules.find(s => s.id === scheduleId);
      if (!schedule) return;

      const scheduleData = parseScheduleData(schedule.schedule_data);
      if (!scheduleData) return;

      scheduleData[dayKey] = {
        ...scheduleData[dayKey],
        startTime: editStartTime,
        endTime: editEndTime
      };

      const { error } = await supabase
        .from('shooter_weekly_schedule')
        .update({
          schedule_data: scheduleData,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);

      if (error) {
        console.error('시간 수정 실패:', error);
        alert('시간 수정에 실패했습니다');
        return;
      }

      alert('시간이 성공적으로 수정되었습니다');
      setEditingCell(null);
      fetchSchedules();
      
    } catch (error) {
      console.error('시간 수정 오류:', error);
      alert('시간 수정 중 오류가 발생했습니다');
    }
  };

  const hourOptions = generateHourOptions();

  const renderFreelancerGrid = () => {
    let displayFreelancers = filters.freelancer === 'all' 
      ? freelancers 
      : freelancers.filter(f => String(f.id) === String(filters.freelancer));

    if (filters.onlyRegistered) {
      const registeredShooterIds = schedules.map(s => s.shooter_id);
      displayFreelancers = displayFreelancers.filter(f => 
        registeredShooterIds.includes(f.auth_id)
      );
    }

    if (displayFreelancers.length === 0) {
      return (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px',
          color: '#64748b'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            {filters.onlyRegistered ? '등록된 스케줄이 없습니다' : '프리랜서가 없습니다'}
          </div>
          <div style={{ fontSize: '14px' }}>
            {filters.onlyRegistered 
              ? `${formatWeekRange(weekRange.start, weekRange.end)} 기간에 등록된 스케줄이 없습니다.`
              : '등록된 프리랜서가 없거나 로딩 중입니다.'
            }
          </div>
        </div>
      );
    }

    return (
      <>
        <style jsx>{`
          .grid-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          @media (max-width: 768px) {
            .grid-container {
              margin: 0 -16px;
            }
          }
        `}</style>
        
        <div className="grid-container">
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
            fontSize: '13px',
            marginBottom: '20px',
            minWidth: '900px'
          }}>
            {/* 헤더 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '220px repeat(7, 1fr)',
              background: '#1e293b',
              color: 'white'
            }}>
              <div style={{
                padding: '12px 16px',
                fontWeight: 'bold',
                fontSize: '14px',
                borderRight: '1px solid rgba(255,255,255,0.2)'
              }}>
                프리랜서 ({displayFreelancers.length}명)
              </div>
              {DAY_ORDER.map((dayKey, index) => (
                <div key={dayKey} style={{
                  padding: '12px 8px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  borderRight: index < DAY_ORDER.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none'
                }}>
                  {DAY_NAMES[dayKey as keyof typeof DAY_NAMES]}
                </div>
              ))}
            </div>

            {/* 프리랜서 행들 */}
            {displayFreelancers.map((freelancer, freelancerIndex) => {
              const schedule = schedules.find(s => {
                const isAuthIdMatch = s.shooter_id === freelancer.auth_id;
                const isWeekMatch = s.week_start_date === currentWeekStart;
                return isAuthIdMatch && isWeekMatch;
              });
              
              const hasSchedule = !!schedule;
              const isAllUnavailable = schedule?.is_all_unavailable || false;
              
              return (
                <div key={freelancer.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '220px repeat(7, 1fr)',
                  borderBottom: freelancerIndex < displayFreelancers.length - 1 ? '1px solid #e2e8f0' : 'none',
                  backgroundColor: freelancerIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                  minHeight: '70px'
                }}>
                  {/* 프리랜서 정보 셀 */}
                  <div style={{
                    padding: '8px 10px',
                    borderRight: '1px solid #e2e8f0',
                    background: hasSchedule ? '#ecfdf5' : '#fef2f2',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontWeight: 'bold',
                        fontSize: '15px',
                        color: '#1e293b'
                      }}>
                        {freelancer.name}
                      </span>
                      
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: hasSchedule ? '#ecfdf5' : '#fee2e2',
                        color: hasSchedule ? '#059669' : '#dc2626',
                        fontWeight: 'bold'
                      }}>
                        {hasSchedule ? '등록' : '미등록'}
                      </span>
                    </div>

                    <div style={{
                      fontSize: '11px',
                      color: '#64748b',
                      marginBottom: '4px'
                    }}>
                      {freelancer.phone}
                    </div>

                    {schedule?.message && schedule.message.trim() && (
                      <button
                        onClick={() => openMemoModal(schedule.message!)}
                        style={{
                          fontSize: '10px',
                          color: '#0369a1',
                          background: '#dbeafe',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          border: '1px solid #93c5fd',
                          marginTop: '2px',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.2',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        💬 {schedule.message}
                      </button>
                    )}
                  </div>

                  {/* 요일별 셀 */}
                  {DAY_ORDER.map((dayKey, dayIndex) => {
                    const parsedSchedule = parseScheduleData(schedule?.schedule_data);
                    const daySchedule = parsedSchedule?.[dayKey];
                    const isEditing = editingCell?.scheduleId === schedule?.id && editingCell?.dayKey === dayKey;
                    
                    const cellStyle = {
                      padding: '8px 6px',
                      borderRight: dayIndex < DAY_ORDER.length - 1 ? '1px solid #e2e8f0' : 'none',
                      minHeight: '70px',
                      display: 'flex',
                      flexDirection: 'column' as const,
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: '11px',
                      gap: '4px'
                    };

                    // 전체 불가능
                    if (isAllUnavailable) {
                      return (
                        <div key={dayKey} style={{
                          ...cellStyle,
                          background: '#fee2e2'
                        }}>
                          <div style={{
                            color: '#dc2626',
                            fontSize: '13px',
                            fontWeight: 'bold'
                          }}>
                            전체불가
                          </div>
                        </div>
                      );
                    }

                    // 스케줄 미등록
                    if (!hasSchedule || !daySchedule) {
                      return (
                        <div key={dayKey} style={{
                          ...cellStyle,
                          background: '#f9fafb'
                        }}>
                          <div style={{
                            color: '#9ca3af',
                            fontSize: '12px'
                          }}>
                            -
                          </div>
                        </div>
                      );
                    }

                    const isAvailable = daySchedule.available;
                    const startTime = daySchedule.startTime;
                    const endTime = daySchedule.endTime;

                    // 해당 요일 불가능
                    if (!isAvailable) {
                      return (
                        <div key={dayKey} style={{
                          ...cellStyle,
                          background: '#fee2e2'
                        }}>
                          <div style={{
                            color: '#dc2626',
                            fontSize: '13px',
                            fontWeight: 'bold'
                          }}>
                            불가
                          </div>
                        </div>
                      );
                    }

                    // 시간 수정 모드
                    if (isEditing) {
                      return (
                        <div key={dayKey} style={{
                          ...cellStyle,
                          background: '#fffbeb',
                          padding: '6px'
                        }}>
                          {/* 시간 선택 (가로 배치) */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '6px'
                          }}>
                            <select
                              value={editStartTime}
                              onChange={(e) => setEditStartTime(e.target.value)}
                              style={{
                                flex: '1',
                                padding: '5px',
                                fontSize: '11px',
                                border: '2px solid #d97706',
                                borderRadius: '4px',
                                background: 'white',
                                cursor: 'pointer'
                              }}
                            >
                              {hourOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            
                            <span style={{ 
                              fontSize: '12px', 
                              color: '#64748b',
                              fontWeight: 'bold'
                            }}>~</span>
                            
                            <select
                              value={editEndTime}
                              onChange={(e) => setEditEndTime(e.target.value)}
                              style={{
                                flex: '1',
                                padding: '5px',
                                fontSize: '11px',
                                border: '2px solid #d97706',
                                borderRadius: '4px',
                                background: 'white',
                                cursor: 'pointer'
                              }}
                            >
                              {hourOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* 버튼 (가로 배치) */}
                          <div style={{ 
                            display: 'flex', 
                            gap: '4px'
                          }}>
                            <button
                              onClick={() => saveTimeEdit(schedule!.id, dayKey)}
                              style={{
                                flex: '1',
                                padding: '5px',
                                fontSize: '10px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={cancelEditingTime}
                              style={{
                                flex: '1',
                                padding: '5px',
                                fontSize: '10px',
                                background: '#64748b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // 일반 표시
                    return (
                      <div key={dayKey} style={{
                        ...cellStyle,
                        background: '#ffffff'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#059669'
                        }}>
                          {formatTime(startTime)} ~ {formatTime(endTime)}
                        </div>
                        <button
                          onClick={() => startEditingTime(schedule!.id, dayKey, startTime, endTime)}
                          style={{
                            padding: '4px 12px',
                            fontSize: '10px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          수정
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };


  const getStatistics = () => {
    let displayFreelancers = filters.freelancer === 'all' 
      ? freelancers 
      : freelancers.filter(f => String(f.id) === String(filters.freelancer));
    
    if (filters.onlyRegistered) {
      const registeredShooterIds = schedules.map(s => s.shooter_id);
      displayFreelancers = displayFreelancers.filter(f => 
        registeredShooterIds.includes(f.auth_id)
      );
    }
    
    const currentWeekSchedules = schedules.filter(s => s.week_start_date === currentWeekStart);
    
    const total = displayFreelancers.length;
    const submitted = currentWeekSchedules.length;
    const notSubmitted = total - submitted;
    
    return { total, submitted, notSubmitted };
  };

  const statistics = getStatistics();

  if (loading && freelancers.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #3b82f6',
            borderTop: '3px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
          <div style={{ color: '#64748b', fontSize: '14px' }}>
            로딩 중...
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center', color: '#dc2626' }}>
          <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            오류 발생
          </div>
          <div style={{ marginBottom: 16, fontSize: '14px' }}>{error}</div>
          <button 
            onClick={() => {
              setError(null);
              fetchFreelancers();
            }}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      background: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '12px',
        borderBottom: '2px solid #3b82f6',
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1e293b',
            marginBottom: '4px'
          }}>
            프리랜서 주간 스케줄
          </h1>
          <p style={{
            margin: 0,
            color: '#64748b',
            fontSize: '14px'
          }}>
            {formatWeekRange(weekRange.start, weekRange.end)} 주간 스케줄 현황
          </p>
        </div>

        {/* 통계 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            padding: '8px 12px',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
              {statistics.total}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {filters.onlyRegistered ? '등록' : '대상'}
            </div>
          </div>
          
          <div style={{
            padding: '8px 12px',
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#059669' }}>
              {statistics.submitted}
            </div>
            <div style={{ fontSize: '11px', color: '#059669' }}>등록</div>
          </div>

          <div style={{
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc2626' }}>
              {statistics.notSubmitted}
            </div>
            <div style={{ fontSize: '11px', color: '#dc2626' }}>미등록</div>
          </div>
        </div>
      </div>

      {/* 필터 및 네비게이션 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '12px 16px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px'
      }}>
        {/* 필터 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
              프리랜서:
            </label>
            <select
              value={filters.freelancer}
              onChange={(e) => setFilters({...filters, freelancer: e.target.value})}
              style={{
                padding: '6px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: '#ffffff',
                color: '#1e293b',
                fontSize: '13px',
                outline: 'none',
                minWidth: '150px'
              }}
            >
              <option value="all">전체</option>
              {freelancers.map(freelancer => (
                <option key={freelancer.id} value={freelancer.id}>
                  {freelancer.name}
                </option>
              ))}
            </select>
          </div>

          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            fontSize: '13px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={filters.onlyRegistered}
              onChange={(e) => setFilters({...filters, onlyRegistered: e.target.checked})}
              style={{ accentColor: '#3b82f6' }}
            />
            등록된 스케줄만
          </label>

          <button
            onClick={() => {
              if (freelancers.length > 0) {
                fetchSchedules();
              } else {
                fetchFreelancers();
              }
            }}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 'bold'
            }}
          >
            {loading ? '로딩...' : '새로고침'}
          </button>
        </div>

        {/* 주차 네비게이션 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          background: '#f8fafc',
          padding: '6px 12px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => navigateWeek('prev')}
            style={{
              padding: '6px 10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#475569'
            }}
          >
            ← 이전
          </button>
          
          <div style={{
            padding: '6px 12px',
            textAlign: 'center',
            fontWeight: 'bold',
            color: '#3b82f6',
            fontSize: '13px',
            minWidth: '160px'
          }}>
            {formatWeekRange(weekRange.start, weekRange.end)}
          </div>
          
          <button
            onClick={() => navigateWeek('next')}
            style={{
              padding: '6px 10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#475569'
            }}
          >
            다음 →
          </button>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && freelancers.length > 0 && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '14px', color: '#64748b' }}>
            스케줄 조회 중...
          </div>
        </div>
      )}
      
      {/* 프리랜서 그리드 */}
      {!loading && renderFreelancerGrid()}

      {/* 메모 모달 */}
      {memoModalOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={closeMemoModal}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: '#1e293b'
            }}>
              전달사항
            </h2>
            <div style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              maxHeight: '400px',
              overflowY: 'auto',
              marginBottom: '16px'
            }}>
              <p style={{
                whiteSpace: 'pre-wrap',
                margin: 0,
                color: '#475569',
                lineHeight: '1.6'
              }}>
                {selectedMemo}
              </p>
            </div>
            <button
              onClick={closeMemoModal}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                alignSelf: 'flex-end'
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

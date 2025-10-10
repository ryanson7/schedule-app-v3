// src/pages/admin/freelancer-schedules.tsx - 신 버전 시간 범위 + 전달사항 표시
"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useWeek } from "../../contexts/WeekContext";
import React from 'react';

// 🔧 요일 순서 정의
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

// 🔧 상태 설정 (submitted만 사용)
const STATUS_CONFIG = {
  submitted: { label: '등록', color: '#059669', bg: '#ecfdf5' }
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

// 🔧 시간 처리 함수들 (신 버전만)
const formatTime = (timeString: string): string => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  return `${hours}:${minutes}`;
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

  const { currentWeek, navigateWeek } = useWeek();

  // 🔧 월요일 시작 주차 계산
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
      const result = monday.toISOString().split('T')[0];
      
      console.log('월요일 계산:', {
        입력: inputDate.toLocaleDateString() + ' (' + ['일', '월', '화', '수', '목', '금', '토'][inputDate.getDay()] + ')',
        계산된_월요일: result,
        월요일_확인: new Date(result).toLocaleDateString() + ' (' + ['일', '월', '화', '수', '목', '금', '토'][new Date(result).getDay()] + ')',
        월요일_맞나: new Date(result).getDay() === 1 ? '✅ 맞음' : '❌ 틀림'
      });
      
      return result;
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

  // 🔧 날짜 범위 포맷팅
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
  const checkAuth = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    console.log('🔍 현재 사용자 JWT 토큰 분석:', {
      이메일: user?.email,
      user_id: user?.id,
      app_metadata: user?.app_metadata,
      role_in_metadata: user?.app_metadata?.role,
      roles_in_metadata: user?.app_metadata?.roles,
      raw_app_metadata: JSON.stringify(user?.app_metadata, null, 2)
    });
  };
  
  checkAuth();
}, []);


  // currentWeek 변경 시 날짜 업데이트
  useEffect(() => {
    const weekStart = calculateWeekStart(currentWeek);
    const weekEnd = calculateWeekEnd(weekStart);
    
    setCurrentWeekStart(weekStart);
    setWeekRange({ start: weekStart, end: weekEnd });
  }, [currentWeek]);

  // 주차가 변경될 때마다 스케줄 재조회
  useEffect(() => {
    if (currentWeekStart && freelancers.length > 0) {
      fetchSchedules();
    }
  }, [currentWeekStart]);

  // 컴포넌트 마운트 시 프리랜서 먼저 로드
  useEffect(() => {
    fetchFreelancers();
  }, []);

  // 프리랜서 로드 완료 후 스케줄 조회
  useEffect(() => {
    if (freelancers.length > 0 && currentWeekStart) {
      fetchSchedules();
    }
  }, [freelancers]);

  // 필터 변경 시 로컬 필터링
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
      
      console.log('프리랜서 로드:', {
        총_프리랜서: freelancerUsers.length,
        샘플: freelancerUsers.slice(0, 2).map(f => f.name)
      });
      
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
      
      console.log('스케줄 조회:', {
        주차: currentWeekStart,
        월요일_확인: new Date(currentWeekStart).toLocaleDateString() + ' (' + ['일', '월', '화', '수', '목', '금', '토'][new Date(currentWeekStart).getDay()] + ')'
      });
      
      const { data, error } = await supabase
        .from('shooter_weekly_schedule')
        .select('*')
        .eq('week_start_date', currentWeekStart)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      console.log('스케줄 조회 결과:', {
        주차: currentWeekStart,
        개수: data?.length || 0
      });
      
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

  // 🔧 프리랜서 그리드 렌더링 (신 버전 시간 범위 + 전달사항)
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
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
        fontSize: '13px',
        marginBottom: '20px'
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px repeat(7, 1fr)', // 🔧 전달사항 공간 확보
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
              gridTemplateColumns: '220px repeat(7, 1fr)', // 🔧 너비 증가
              borderBottom: freelancerIndex < displayFreelancers.length - 1 ? '1px solid #e2e8f0' : 'none',
              backgroundColor: freelancerIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
              minHeight: '80px' // 🔧 높이 증가
            }}>
              {/* 🔧 프리랜서 정보 셀 (전달사항 포함) */}
              <div style={{
                padding: '8px 12px',
                borderRight: '1px solid #e2e8f0',
                background: hasSchedule ? '#ecfdf5' : '#fef2f2',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                {/* 이름과 상태 */}
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

                {/* 전화번호 */}
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  marginBottom: '4px'
                }}>
                  {freelancer.phone}
                </div>

                {/* 🔧 전달사항 표시 (한 줄로) */}
                {schedule?.message && schedule.message.trim() && (
                  <div style={{
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
                    lineHeight: '1.2'
                  }}>
                    💬 {schedule.message}
                  </div>
                )}
              </div>

              {/* 🔧 요일별 시간 범위 표시 (신 버전만) */}
              {DAY_ORDER.map((dayKey, dayIndex) => {
                const parsedSchedule = parseScheduleData(schedule?.schedule_data);
                const daySchedule = parsedSchedule?.[dayKey];
                
                const cellStyle = {
                  padding: '8px 4px',
                  borderRight: dayIndex < DAY_ORDER.length - 1 ? '1px solid #e2e8f0' : 'none',
                  minHeight: '80px',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '10px'
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
                        fontSize: '10px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        padding: '4px',
                        background: '#ffffff',
                        borderRadius: '4px',
                        border: '1px solid #dc2626'
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
                        fontSize: '10px',
                        textAlign: 'center',
                        padding: '4px',
                        background: '#ffffff',
                        borderRadius: '4px',
                        border: '1px dashed #d1d5db'
                      }}>
                        미등록
                      </div>
                    </div>
                  );
                }

                // 🔧 신 버전 처리 (available, startTime, endTime)
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
                        fontSize: '10px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        padding: '4px',
                        background: '#ffffff',
                        borderRadius: '4px',
                        border: '1px solid #dc2626'
                      }}>
                        불가
                      </div>
                    </div>
                  );
                }

                // 🔧 시간 범위 표시
                return (
                  <div key={dayKey} style={{
                    ...cellStyle,
                    background: '#ffffff'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      padding: '4px 6px',
                      background: '#dcfce7',
                      color: '#166534',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      border: '1px solid #10b981',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      {formatTime(startTime)}~{formatTime(endTime)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // 통계 계산
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
    </div>
  );
}

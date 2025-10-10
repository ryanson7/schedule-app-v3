// pages/daily.tsx - 스케줄 30분(1칸) 뒤로 이동
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface Schedule {
  id: number;
  start_time: string;
  end_time: string;
  professor_name: string;
  course_name?: string;
  schedule_type: 'academy' | 'studio';
  sub_location_id: number;
  assigned_shooter_id?: number;
  shooter_name?: string;
}

interface Location {
  id: number;
  name: string;
  main_name: string;
  sort_order: number;
}

interface User {
  id: number;
  name: string;
}

export default function Daily() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shooters, setShooters] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [showEarly, setShowEarly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'academy' | 'studio'>('all');
  const [showEmptyLocations, setShowEmptyLocations] = useState(true);

  // 30분 단위 시간 슬롯 배열
  const allTimeSlots = [];
  for (let hour = 7; hour <= 22; hour++) {
    allTimeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 22) {
      allTimeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }

  const timeSlots = showEarly ? allTimeSlots : allTimeSlots.slice(4);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadLocations = async () => {
    try {
      const [studioResult, academyResult] = await Promise.all([
        supabase
          .from('sub_locations')
          .select(`id, name, main_location_id, main_locations!inner(id, name, location_type)`)
          .eq('is_active', true)
          .eq('main_locations.location_type', 'studio')
          .order('id'),
        supabase
          .from('sub_locations')  
          .select(`id, name, main_location_id, main_locations!inner(id, name, location_type)`)
          .eq('is_active', true)
          .eq('main_locations.location_type', 'academy')
          .order('id')
      ]);

      if (studioResult.error) throw studioResult.error;
      if (academyResult.error) throw academyResult.error;

      const unifiedLocations = [
        ...(studioResult.data || [])
          .filter(loc => loc.main_locations)
          .sort((a, b) => a.id - b.id)
          .map((loc: any, index) => ({
            id: loc.id,
            name: `${loc.main_locations.name} - ${loc.name}`,
            main_name: loc.main_locations.name,
            sort_order: index
          })),
        ...(academyResult.data || [])
          .filter(loc => loc.main_locations)
          .sort((a: any, b: any) => {
            if (a.main_location_id !== b.main_location_id) {
              return a.main_location_id - b.main_location_id;
            }
            return a.id - b.id;
          })
          .map((loc: any, index) => ({
            id: loc.id,
            name: `${loc.main_locations.name} - ${loc.name}`,
            main_name: loc.main_locations.name,
            sort_order: 1000 + (loc.main_location_id * 100) + loc.id
          }))
      ];

      setLocations(unifiedLocations);
    } catch (error) {
      console.error('장소 로드 실패:', error);
      setLocations([]);
    }
  };

const loadShooters = async () => {
  try {
    console.log('🔥 촬영자 로딩 시작 - AllSchedulesGrid 방식 적용');
    
    // 🔥 AllSchedulesGrid와 동일한 방법 사용
    const { data: combinedData, error } = await supabase
      .from('users')
      .select(`
        id, name, phone, role, status, auth_id,
        shooters:shooters!shooters_user_id_fkey (
          shooter_type, main_location_ids, team_id, emergency_phone
        )
      `)
      .in('role', ['shooter', 'freelancer', 'dispatch', 'schedule_admin']) // 🔥 모든 촬영 관련 역할
      .eq('status', 'active');

    if (error) {
      console.error('JOIN 방식 실패:', error);
      // 🔥 fallback - 기본 방법
      const { data: basicData, error: basicError } = await supabase
        .from('users')
        .select('id, name, phone, role, status')
        .in('role', ['shooter', 'freelancer', 'dispatch', 'schedule_admin'])
        .eq('status', 'active');
      
      if (basicError) throw basicError;
      
      console.log('🔥 기본 방법 데이터:', basicData?.length, '명');
      console.log('🔥 ID=5 확인:', basicData?.find(s => s.id === 5));
      
      setShooters(basicData || []);
      return;
    }

    console.log('✅ JOIN 성공 - 촬영자 데이터:', combinedData?.length, '명');
    console.log('🔥 ID=5 확인:', combinedData?.find(s => s.id === 5));
    
    // 🔥 AllSchedulesGrid와 같은 변환 로직
    const processedShooters = (combinedData || []).map(user => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      auth_id: user.auth_id,
      shooter_info: user.shooters?.[0] || null
    }));
    
    setShooters(processedShooters);
  } catch (error) {
    console.error('촬영자 로드 실패:', error);
    setShooters([]);
  }
};



const loadSchedules = async () => {
  if (!date) return;
  setLoading(true);
  
  try {
    // 🔥 JOIN 없이 스케줄만 가져오기
    const { data, error } = await supabase
      .from('schedules')
      .select(`id, start_time, end_time, professor_name, course_name, schedule_type, sub_location_id, assigned_shooter_id`)
      .eq('shoot_date', date)
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .in('schedule_type', ['studio', 'academy'])
      .order('start_time');

    if (error) throw error;

    const schedulesWithShooter = (data || []).map(schedule => {
      const shooter = shooters.find(s => 
        Number(s.id) === Number(schedule.assigned_shooter_id)
      );
      
      console.log(`🔍 스케줄 ${schedule.id}:`, {
        assigned_shooter_id: schedule.assigned_shooter_id,
        shooter_found: !!shooter,
        shooter_name: shooter?.name || `ID:${schedule.assigned_shooter_id}(없음)`
      });
      
      return {
        ...schedule,
        shooter_name: schedule.assigned_shooter_id 
          ? (shooter?.name || `ID:${schedule.assigned_shooter_id}`) 
          : '미배정'
      };
    });

    setSchedules(schedulesWithShooter);
    
    const hasEarlySchedule = schedulesWithShooter.some(s => {
      const hour = parseInt(s.start_time.split(':')[0]);
      return hour >= 7 && hour < 9;
    });
    
    if (hasEarlySchedule && !showEarly) {
      setShowEarly(true);
    }
  } catch (error) {
    console.error('스케줄 로드 실패:', error);
  } finally {
    setLoading(false);
  }
};





  useEffect(() => {
    if (user) {
      loadLocations();
      loadShooters();
    }
  }, [user]);

  useEffect(() => {
    if (locations.length > 0 && shooters.length >= 0) {
      loadSchedules();
    }
  }, [date, locations, shooters]);

  const filteredSchedules = schedules.filter(schedule => {
    if (typeFilter === 'all') return true;
    return schedule.schedule_type === typeFilter;
  });

  const filteredLocations = locations.filter(location => {
    const hasSchedule = filteredSchedules.some(s => s.sub_location_id === location.id);
    return showEmptyLocations ? true : hasSchedule;
  });

  const getLocationSchedules = (locationId: number) => {
    return filteredSchedules
      .filter(s => s.sub_location_id === locationId)
      .map((schedule) => ({
        ...schedule,
        startTime: schedule.start_time.substring(0, 5),
        endTime: schedule.end_time.substring(0, 5)
      }));
  };

  // 🔥 30분 뒤로 이동된 스케줄 찾기
  const getScheduleStartingAt = (locationSchedules: any[], timeSlot: string) => {
    return locationSchedules.find(s => {
      // 원래 시작 시간에서 30분 뒤로 이동
      const originalStartIndex = allTimeSlots.indexOf(s.startTime);
      if (originalStartIndex === -1) return false;
      
      const adjustedStartIndex = originalStartIndex + 1; // 30분 뒤로
      if (adjustedStartIndex >= allTimeSlots.length) return false;
      
      const adjustedStartTime = allTimeSlots[adjustedStartIndex];
      return adjustedStartTime === timeSlot;
    });
  };

  // 🔥 30분 뒤로 이동된 스케줄 범위 체크
  const isTimeSlotInSchedule = (locationSchedules: any[], timeSlot: string) => {
    const slotIndex = timeSlots.indexOf(timeSlot);
    if (slotIndex === -1) return false;
    
    return locationSchedules.some(s => {
      // 원래 시작/끝 시간에서 30분 뒤로 이동
      const originalStartIndex = allTimeSlots.indexOf(s.startTime);
      const originalEndIndex = allTimeSlots.indexOf(s.endTime);
      
      if (originalStartIndex === -1 || originalEndIndex === -1) return false;
      
      const adjustedStartIndex = originalStartIndex + 1; // 30분 뒤로
      const adjustedEndIndex = originalEndIndex + 1;     // 30분 뒤로
      
      const adjustedStartTimeSlotIndex = timeSlots.indexOf(allTimeSlots[adjustedStartIndex]);
      const adjustedEndTimeSlotIndex = timeSlots.indexOf(allTimeSlots[adjustedEndIndex]);
      
      return adjustedStartTimeSlotIndex < slotIndex && slotIndex < adjustedEndTimeSlotIndex;
    });
  };

  const getColor = (schedule: Schedule) => {
    if (schedule.assigned_shooter_id) {
      return schedule.schedule_type === 'academy' ? '#2563eb' : '#059669';
    }
    return '#d97706';
  };

  const shouldHideRightBorder = (timeSlot: string) => {
    return timeSlot.includes(':00') && !timeSlot.startsWith('22');
  };

  if (!user) return <div>로그인 필요</div>;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: mobile ? '8px' : '16px',
      fontFamily: 'system-ui'
    }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{
          background: 'white',
          padding: mobile ? '16px' : '20px',
          borderRadius: '16px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          marginBottom: '16px',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <h1 style={{
              fontSize: mobile ? '22px' : '26px',
              fontWeight: '700',
              margin: 0,
              color: '#0f172a'
            }}>
              일일 스케줄표
            </h1>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => {
                  const prev = new Date(date);
                  prev.setDate(prev.getDate() - 1);
                  setDate(prev.toISOString().split('T')[0]);
                }}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                ◀
              </button>
              
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontWeight: '500',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              
              <button
                onClick={() => {
                  const next = new Date(date);
                  next.setDate(next.getDate() + 1);
                  setDate(next.toISOString().split('T')[0]);
                }}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                ▶
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: `전체 ${schedules.length}`, color: '#6b7280' },
                { key: 'academy', label: `학원 ${schedules.filter(s => s.schedule_type === 'academy').length}`, color: '#2563eb' },
                { key: 'studio', label: `스튜디오 ${schedules.filter(s => s.schedule_type === 'studio').length}`, color: '#059669' }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setTypeFilter(filter.key as any)}
                  style={{
                    background: typeFilter === filter.key ? filter.color : 'white',
                    color: typeFilter === filter.key ? 'white' : filter.color,
                    border: `1px solid ${filter.color}`,
                    borderRadius: '6px',
                    padding: mobile ? '6px 10px' : '7px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {filter.label}
                </button>
              ))}
              
              <button
                onClick={() => setShowEmptyLocations(!showEmptyLocations)}
                style={{
                  background: showEmptyLocations ? '#059669' : 'white',
                  color: showEmptyLocations ? 'white' : '#6b7280',
                  border: '1px solid #059669',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {showEmptyLocations ? '빈칸 숨기기' : '빈칸 보기'}
              </button>
            </div>

            <div style={{ 
              fontSize: '13px', 
              color: '#6b7280', 
              fontWeight: '500',
              background: '#f8fafc',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}>
              {new Date(date).toLocaleDateString('ko-KR', { 
                month: 'long', day: 'numeric', weekday: 'long'
              })}
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          overflow: 'auto',
          border: '1px solid #f1f5f9'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', fontSize: '16px', color: '#6b7280' }}>
              데이터 로딩 중...
            </div>
          ) : (
            <div style={{ padding: '16px' }}>
              <table style={{
                width: '100%',
                minWidth: `${150 + (timeSlots.length * 27)}px`,
                borderCollapse: 'separate',
                borderSpacing: '0px'
              }}>
                {/* 헤더 */}
                <thead>
                  <tr>
                    <th style={{
                      width: '150px',
                      minWidth: '150px',
                      padding: '12px 8px',
                      background: '#f8fafc',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      textAlign: 'center',
                      borderBottom: '2px solid #e2e8f0',
                      borderRight: '1px solid #e2e8f0'
                    }}>
                      장소
                    </th>
                    
                    {/* 07-09시 버튼 */}
                    {!showEarly && (
                      <th 
                        onClick={() => setShowEarly(true)}
                        style={{
                          width: '50px',
                          minWidth: '50px',
                          padding: '8px 4px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          border: 'none',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        07-09
                      </th>
                    )}
                    
                    {/* 시간 칸들 */}
                    {timeSlots.map((timeSlot, index) => {
                      const isHalfHour = timeSlot.includes(':30');
                      const hour = parseInt(timeSlot.split(':')[0]);
                      const isEarly = hour < 9;
                      const isLast = index === timeSlots.length - 1;
                      
                      return (
                        <th
                          key={timeSlot}
                          style={{
                            width: '27px',
                            minWidth: '27px',
                            padding: isHalfHour ? '4px 2px' : '8px 4px',
                            background: isEarly ? '#fef3c7' : '#f8fafc',
                            color: isEarly ? '#d97706' : '#374151',
                            fontSize: isHalfHour ? '0px' : '11px',
                            fontWeight: '600',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            position: 'relative',
                            borderBottom: '2px solid #e2e8f0',
                            borderRight: isLast ? 'none' : (isHalfHour ? 'none' : '1px solid #e2e8f0')
                          }}
                        >
                          {!isHalfHour && `${timeSlot.substring(0, 2)}시`}
                          
                          {isEarly && showEarly && timeSlot === '07:00' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowEarly(false);
                              }}
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                background: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10,
                                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                              }}
                            >
                              ×
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* 데이터 행들 */}
                <tbody>
                  {filteredLocations.map((location, i) => {
                    const locationSchedules = getLocationSchedules(location.id);
                    const isLast = i === filteredLocations.length - 1;
                    
                    return (
                      <tr key={location.id}>
                        <td style={{
                          padding: '12px 8px',
                          background: '#fafbfb',
                          borderRight: '1px solid #e2e8f0',
                          borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                          verticalAlign: 'middle'
                        }}>
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px', fontWeight: '500' }}>
                            {location.main_name}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                            {location.name.replace(`${location.main_name} - `, '')}
                          </div>
                        </td>
                        
                        {/* 07-09 버튼용 빈 칸 */}
                        {!showEarly && (
                          <td style={{
                            width: '50px',
                            background: '#fafbfb',
                            borderBottom: isLast ? 'none' : '1px solid #f1f5f9'
                          }} />
                        )}
                        
                        {/* 🔥 30분 뒤로 이동된 시간 칸들 */}
                        {timeSlots.map((timeSlot, index) => {
                          const schedule = getScheduleStartingAt(locationSchedules, timeSlot);
                          const isInSchedule = isTimeSlotInSchedule(locationSchedules, timeSlot);
                          const isHalfHour = timeSlot.includes(':30');
                          const isLastCol = index === timeSlots.length - 1;
                          
                          if (schedule) {
                            // 원래 시간으로 span 계산
                            const originalStartIndex = allTimeSlots.indexOf(schedule.startTime);
                            const originalEndIndex = allTimeSlots.indexOf(schedule.endTime);
                            let spanCount = originalEndIndex - originalStartIndex;
                            
                            return (
                              <td
                                key={`${location.id}-${timeSlot}-schedule`}
                                colSpan={spanCount}
                                style={{
                                  height: '56px',
                                  background: getColor(schedule),
                                  color: 'white',
                                  borderRadius: '8px',
                                  padding: '6px 8px',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                  margin: '2px'
                                }}
                                title={`${schedule.professor_name} - ${schedule.course_name || '수업'} (${schedule.startTime}~${schedule.endTime}) - ${schedule.shooter_name}`}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0px)';
                                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                                }}
                              >
                                <div style={{ fontSize: '9px', fontWeight: '700', marginBottom: '1px', opacity: 0.9 }}>
                                  {schedule.startTime}~{schedule.endTime}
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '1px' }}>
                                  {schedule.professor_name}
                                </div>
                                <div style={{ fontSize: '8px', opacity: 0.8, fontWeight: '500' }}>
                                  {schedule.shooter_name}
                                </div>
                              </td>
                            );
                          } else if (isInSchedule) {
                            return null;
                          } else {
                            return (
                              <td
                                key={`${location.id}-${timeSlot}-empty`}
                                style={{
                                  width: '27px',
                                  height: '56px',
                                  background: '#fafbfb',
                                  borderRight: isLastCol ? 'none' : (isHalfHour ? 'none' : '1px solid #f1f5f9'),
                                  borderBottom: isLast ? 'none' : '1px solid #f1f5f9'
                                }}
                              />
                            );
                          }
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredLocations.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '60px',
                  color: '#9ca3af',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {!showEmptyLocations ? 
                    '스케줄이 있는 장소가 없습니다. "빈칸 보기"를 활성화해보세요.' : 
                    (typeFilter === 'all' ? '스케줄이 없습니다' : `${typeFilter === 'academy' ? '학원' : '스튜디오'} 스케줄이 없습니다`)
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

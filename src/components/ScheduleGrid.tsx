"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { isHoliday } from '../utils/holidays';
import ShooterAssignmentModal from './admin/ShooterAssignmentModal';

interface Schedule {
  id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  professor_name: string;
  shooting_type: string;
  schedule_type: string;
  approval_status: string;
  tracking_status: string;
  sub_location_id: number;
  assigned_shooter_id?: number;
  shooter_name?: string;
  notes?: string;
  location_name?: string;
  main_location_name?: string;
  main_location_id?: number;
}

interface Location {
  id: number;
  name: string;
  main_location_id: number;
  shooting_types?: string[];
  primary_shooting_type?: string;
  main_locations?: {
    id: number;
    name: string;
    location_type: string;
  };
}

export default function ScheduleGrid() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduleType, setScheduleType] = useState<'all' | 'studio' | 'academy'>('all');
  const [selectedTeam, setSelectedTeam] = useState<'all' | number>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'morning' | 'afternoon' | 'night'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  
  // Shooter 배정 모달 상태
  const [assignmentModal, setAssignmentModal] = useState({
    isOpen: false,
    schedule: null as Schedule | null
  });

  useEffect(() => {
    // 사용자 권한 확인
    const role = localStorage.getItem('userRole') || '';
    setUserRole(role);
    
    loadData();
  }, [currentWeek, scheduleType, selectedTeam, selectedTimeRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadSchedules(), loadLocations()]);
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      let query = supabase
        .from('schedules')
        .select(`
          *,
          sub_locations(name, main_location_id, main_locations(name, location_type)),
          shooter:users!assigned_shooter_id(name)
        `)
        .eq('is_active', true);

      // 스케줄 타입 필터
      if (scheduleType !== 'all') {
        query = query.eq('schedule_type', scheduleType);
      }

      // 승인된 스케줄만 표시
      query = query.in('approval_status', ['approved', 'confirmed']);

      // 주간 날짜 범위
      const weekStart = getWeekStart(currentWeek);
      const weekEnd = getWeekEnd(currentWeek);
      query = query.gte('shoot_date', weekStart).lte('shoot_date', weekEnd);

      const { data, error } = await query.order('shoot_date').order('start_time');

      if (error) {
        console.error('스케줄 조회 오류:', error);
        return;
      }

      // 데이터 가공
      const processedSchedules = (data || []).map(schedule => ({
        ...schedule,
        location_name: schedule.sub_locations?.name,
        main_location_name: schedule.sub_locations?.main_locations?.name,
        main_location_id: schedule.sub_locations?.main_location_id,
        shooter_name: schedule.shooter?.name
      }));

      // 팀 필터링
      let filteredSchedules = processedSchedules;
      if (selectedTeam !== 'all') {
        filteredSchedules = processedSchedules.filter(s => s.main_location_id === selectedTeam);
      }

      // 시간대 필터링
      if (selectedTimeRange !== 'all') {
        filteredSchedules = filteredSchedules.filter(schedule => {
          const startTime = schedule.start_time.substring(0, 5);
          switch (selectedTimeRange) {
            case 'morning':
              return startTime >= '06:00' && startTime < '12:00';
            case 'afternoon':
              return startTime >= '12:00' && startTime < '18:00';
            case 'night':
              return startTime >= '18:00' && startTime <= '24:00';
            default:
              return true;
          }
        });
      }

      setSchedules(filteredSchedules);

    } catch (error) {
      console.error('스케줄 로딩 오류:', error);
    }
  };

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_locations')
        .select('*, main_locations(id, name, location_type)')
        .eq('is_active', true)
        .order('main_location_id')
        .order('id');

      if (!error && data) {
        setLocations(data);
      }
    } catch (error) {
      console.error('위치 로딩 오류:', error);
    }
  };

  const openShooterAssignment = (schedule: Schedule) => {
    if (userRole !== 'admin') {
      alert('관리자 권한이 필요합니다.');
      return;
    }

    setAssignmentModal({
      isOpen: true,
      schedule: schedule
    });
  };

  const handleAssignmentComplete = async (scheduleId: number, shooterId: number) => {
    // 스케줄 목록 새로고침
    await loadSchedules();
    
    setAssignmentModal({
      isOpen: false,
      schedule: null
    });

    alert('Shooter가 성공적으로 배정되었습니다!');
  };

  const getScheduleColor = (schedule: Schedule) => {
    // Shooter 배정 여부에 따른 색상
    if (!schedule.assigned_shooter_id) {
      return {
        bg: '#fef2f2',
        border: '#fecaca',
        text: '#dc2626'
      };
    }

    // 촬영형식별 색상
    const shootingTypeColors: { [key: string]: any } = {
      'PPT': { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
      '일반칠판': { bg: '#e9d5ff', border: '#8b5cf6', text: '#5b21b6' },
      '전자칠판': { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
      '크로마키': { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
      'PC와콤': { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
      'PC': { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e' }
    };

    return shootingTypeColors[schedule.shooting_type] || {
      bg: '#f8fafc',
      border: '#e2e8f0',
      text: '#64748b'
    };
  };

  const getTrackingStatusColor = (status: string) => {
    const colors = {
      'scheduled': '#64748b',
      'schedule_check': '#3b82f6',
      'departure': '#f59e0b',
      'arrival': '#10b981',
      'start': '#8b5cf6',
      'end': '#ef4444',
      'completion': '#059669'
    };
    return colors[status as keyof typeof colors] || '#64748b';
  };

  const getTrackingStatusText = (status: string) => {
    const statusTexts = {
      'scheduled': '대기중',
      'schedule_check': '확인완료',
      'departure': '이동중',
      'arrival': '도착완료',
      'start': '촬영중',
      'end': '촬영완료',
      'completion': '업무완료'
    };
    return statusTexts[status as keyof typeof statusTexts] || '미정';
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  const generateWeekDates = () => {
    const startOfWeek = getWeekStart(currentWeek);
    const dates = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dates.push({
        date: dateStr,
        day: date.getDate(),
        dayOfWeek: getDayOfWeek(date),
        isHoliday: isHoliday(dateStr, date)
      });
    }
    return dates;
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  };

  const getWeekEnd = (date: Date) => {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
  };

  const getDayOfWeek = (date: Date) => {
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    return days[date.getDay() === 0 ? 6 : date.getDay() - 1];
  };

  const navigateWeek = (direction: number) => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction * 7));
    setCurrentWeek(newWeek);
  };

  const getTeamOptions = () => {
    const teams = Array.from(new Set(
      locations.map(loc => loc.main_locations)
        .filter(Boolean)
        .map(main => ({ id: main!.id, name: main!.name, type: main!.location_type }))
    ));
    
    return teams.filter((team, index, self) => 
      index === self.findIndex(t => t.id === team.id)
    );
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        fontSize: '18px',
        color: '#64748b'
      }}>
        통합 스케줄을 불러오는 중...
      </div>
    );
  }

  const dates = generateWeekDates();
  const teamOptions = getTeamOptions();

  return (
    <div style={{
      fontFamily: 'inherit',
      background: '#f8fafc',
      minHeight: '100vh',
      padding: '20px'
    }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '28px',
              fontWeight: '600'
            }}>
              통합 스케줄 관리
            </h1>
            <p style={{
              margin: 0,
              fontSize: '16px',
              opacity: 0.9
            }}>
              학원과 스튜디오의 모든 승인된 스케줄을 통합 관리합니다
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <button
              onClick={() => navigateWeek(-1)}
              style={{
                padding: '8px 16px',
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
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              {dates[0]?.date} ~ {dates[6]?.date}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              style={{
                padding: '8px 16px',
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

        {/* 필터 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          <select
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '14px'
            }}
          >
            <option value="all">전체 스케줄</option>
            <option value="studio">스튜디오</option>
            <option value="academy">학원</option>
          </select>

          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '14px'
            }}
          >
            <option value="all">전체 팀</option>
            {teamOptions.map(team => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.type})
              </option>
            ))}
          </select>

          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '14px'
            }}
          >
            <option value="all">전체 시간</option>
            <option value="morning">오전 (06:00-12:00)</option>
            <option value="afternoon">오후 (12:00-18:00)</option>
            <option value="night">야간 (18:00-24:00)</option>
          </select>
        </div>
      </div>

      {/* 스케줄 그리드 */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        {/* 날짜 헤더 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          background: 'linear-gradient(135deg, #4338ca, #6366f1)',
          color: 'white'
        }}>
          {dates.map((dateInfo, index) => (
            <div
              key={dateInfo.date}
              style={{
                padding: '16px 12px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '14px',
                borderRight: index === dates.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.2)'
              }}
            >
              <div style={{
                color: dateInfo.isHoliday ? '#fca5a5' : 'white'
              }}>
                {dateInfo.day}일 ({dateInfo.dayOfWeek})
              </div>
            </div>
          ))}
        </div>

        {/* 스케줄 내용 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          minHeight: '500px'
        }}>
          {dates.map((dateInfo, dateIndex) => {
            const daySchedules = schedules.filter(s => s.shoot_date === dateInfo.date);

            return (
              <div
                key={dateInfo.date}
                style={{
                  padding: '12px 8px',
                  borderRight: dateIndex === dates.length - 1 ? 'none' : '1px solid #e2e8f0',
                  background: daySchedules.length > 0 ? '#fafbff' : 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {daySchedules.map((schedule) => {
                  const scheduleColor = getScheduleColor(schedule);

                  return (
                    <div
                      key={schedule.id}
                      onClick={() => openShooterAssignment(schedule)}
                      style={{
                        padding: '10px',
                        background: scheduleColor.bg,
                        border: `1px solid ${scheduleColor.border}`,
                        borderRadius: '6px',
                        cursor: userRole === 'admin' ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (userRole === 'admin') {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (userRole === 'admin') {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {/* Shooter 배정 상태 */}
                      {!schedule.assigned_shooter_id && (
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#ef4444',
                          animation: 'pulse 2s infinite'
                        }} />
                      )}

                      {/* 시간 */}
                      <div style={{
                        fontWeight: '700',
                        color: scheduleColor.text,
                        fontSize: '12px',
                        marginBottom: '4px'
                      }}>
                        {formatTime(schedule.start_time)}~{formatTime(schedule.end_time)}
                      </div>

                      {/* 강의명 */}
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '4px',
                        lineHeight: 1.3
                      }}>
                        {schedule.course_name}
                      </div>

                      {/* 교수명 */}
                      <div style={{
                        fontSize: '10px',
                        color: '#64748b',
                        marginBottom: '4px'
                      }}>
                        교수: {schedule.professor_name}
                      </div>

                      {/* 위치 */}
                      <div style={{
                        fontSize: '10px',
                        color: '#64748b',
                        marginBottom: '6px'
                      }}>
                        {schedule.main_location_name} - {schedule.location_name}
                      </div>

                      {/* Shooter 정보 */}
                      {schedule.assigned_shooter_id ? (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{
                            fontSize: '10px',
                            color: '#059669',
                            fontWeight: '600'
                          }}>
                            📷 {schedule.shooter_name}
                          </div>
                          
                          {schedule.tracking_status !== 'scheduled' && (
                            <div style={{
                              background: getTrackingStatusColor(schedule.tracking_status),
                              color: 'white',
                              padding: '1px 4px',
                              borderRadius: '8px',
                              fontSize: '8px',
                              fontWeight: '600'
                            }}>
                              {getTrackingStatusText(schedule.tracking_status)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '10px',
                          color: '#ef4444',
                          fontWeight: '600',
                          textAlign: 'center',
                          padding: '4px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          borderRadius: '4px'
                        }}>
                          {userRole === 'admin' ? '클릭하여 Shooter 배정' : 'Shooter 미배정'}
                        </div>
                      )}
                    </div>
                  );
                })}

                {daySchedules.length === 0 && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '12px'
                  }}>
                    스케줄 없음
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shooter 배정 모달 */}
      <ShooterAssignmentModal
        isOpen={assignmentModal.isOpen}
        onClose={() => setAssignmentModal({ isOpen: false, schedule: null })}
        schedule={assignmentModal.schedule}
        onAssignmentComplete={handleAssignmentComplete}
      />

      {/* CSS 애니메이션 */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

//src\components\shooter\ShooterDashboard.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface Schedule {
  id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  professor_name: string;
  tracking_status: string;
  sub_location_id: number;
  location_name?: string;
  main_location_name?: string;
  notes?: string;
}

interface ShooterInfo {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface ActionDeadline {
  action_type: string;
  deadline_time: string;
  is_completed: boolean;
}

export default function ShooterDashboard() {
  const [shooterInfo, setShooterInfo] = useState<ShooterInfo | null>(null);
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<Schedule[]>([]);
  const [actionDeadlines, setActionDeadlines] = useState<ActionDeadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    loadShooterData();
  }, []);

  const loadShooterData = async () => {
    try {
      // 현재 로그인한 shooter 정보 가져오기 (임시로 localStorage 사용)
      const shooterId = localStorage.getItem('shooterId') || '1';
      
      // Shooter 정보 조회
      const { data: shooter, error: shooterError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', shooterId)
        .eq('role', 'shooter')
        .single();

      if (shooterError) {
        console.error('Shooter 정보 조회 오류:', shooterError);
        return;
      }

      setShooterInfo(shooter);

      // 오늘 스케줄 조회
      const today = new Date().toISOString().split('T')[0];
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          id, shoot_date, start_time, end_time, course_name, 
          professor_name, tracking_status, sub_location_id, notes,
          sub_locations(name, main_locations(name))
        `)
        .eq('assigned_shooter_id', shooterId)
        .eq('is_active', true)
        .gte('shoot_date', today)
        .order('shoot_date')
        .order('start_time');

      if (!schedulesError && schedules) {
        const processedSchedules = schedules.map(schedule => ({
          ...schedule,
          location_name: schedule.sub_locations?.name,
          main_location_name: schedule.sub_locations?.main_locations?.name
        }));

        // 오늘과 향후 스케줄 분리
        const todayScheduleList = processedSchedules.filter(s => s.shoot_date === today);
        const upcomingScheduleList = processedSchedules.filter(s => s.shoot_date > today);

        setTodaySchedules(todayScheduleList);
        setUpcomingSchedules(upcomingScheduleList.slice(0, 5)); // 최대 5개만

        // 액션 데드라인 조회
        if (todayScheduleList.length > 0) {
          loadActionDeadlines(todayScheduleList[0].id);
        }
      }

    } catch (error) {
      console.error('데이터 로딩 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActionDeadlines = async (scheduleId: number) => {
    try {
      const { data: deadlines, error } = await supabase
        .from('shooter_action_deadlines')
        .select('action_type, deadline_time, is_completed')
        .eq('schedule_id', scheduleId)
        .order('deadline_time');

      if (!error && deadlines) {
        setActionDeadlines(deadlines);
      }
    } catch (error) {
      console.error('데드라인 조회 오류:', error);
    }
  };

  const getStatusColor = (status: string) => {
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

  const getStatusText = (status: string) => {
    const statusTexts = {
      'scheduled': '대기중',
      'schedule_check': '스케줄확인완료',
      'departure': '이동중',
      'arrival': '도착완료',
      'start': '촬영중',
      'end': '촬영완료',
      'completion': '업무완료'
    };
    return statusTexts[status as keyof typeof statusTexts] || '미정';
  };

  const getActionText = (actionType: string) => {
    const actionTexts = {
      'schedule_check': '스케줄 확인',
      'departure': '출발',
      'arrival': '도착',
      'start': '촬영 시작',
      'end': '촬영 종료',
      'completion': '업무 완료'
    };
    return actionTexts[actionType as keyof typeof actionTexts] || actionType;
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const isDeadlineNear = (deadlineTime: string) => {
    const deadline = new Date(deadlineTime);
    const now = new Date();
    const timeDiff = deadline.getTime() - now.getTime();
    return timeDiff > 0 && timeDiff <= 2 * 60 * 60 * 1000; // 2시간 이내
  };

  const isOverdue = (deadlineTime: string) => {
    const deadline = new Date(deadlineTime);
    const now = new Date();
    return now > deadline;
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#64748b'
      }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'inherit',
      background: '#f8fafc',
      minHeight: '100vh'
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
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '600' }}>
          Shooter 대시보드
        </h1>
        {shooterInfo && (
          <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
            안녕하세요, {shooterInfo.name}님! 오늘도 좋은 촬영 되세요.
          </p>
        )}
      </div>

      {/* 오늘 스케줄 */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '22px',
          fontWeight: '600',
          color: '#1e293b',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          오늘의 촬영 스케줄
          <span style={{
            background: '#3b82f6',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '14px'
          }}>
            {todaySchedules.length}건
          </span>
        </h2>

        {todaySchedules.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#64748b',
            border: '2px dashed #cbd5e1'
          }}>
            오늘 예정된 촬영이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {todaySchedules.map((schedule) => (
              <div
                key={schedule.id}
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => setSelectedSchedule(schedule)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <span style={{
                        background: getStatusColor(schedule.tracking_status),
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {getStatusText(schedule.tracking_status)}
                      </span>
                      <span style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </span>
                    </div>
                    
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '20px',
                      fontWeight: '600',
                      color: '#1e293b'
                    }}>
                      {schedule.course_name}
                    </h3>
                    
                    <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>
                      교수: {schedule.professor_name}
                    </div>
                    
                    <div style={{ color: '#64748b', fontSize: '14px' }}>
                      위치: {schedule.main_location_name} - {schedule.location_name}
                    </div>
                    
                    {schedule.notes && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        background: '#fef3c7',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#92400e'
                      }}>
                        {schedule.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 액션 데드라인 */}
      {actionDeadlines.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '16px'
          }}>
            액션 데드라인
          </h2>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {actionDeadlines.map((deadline, index) => (
              <div
                key={index}
                style={{
                  background: deadline.is_completed ? '#f0fdf4' : 
                           isOverdue(deadline.deadline_time) ? '#fef2f2' :
                           isDeadlineNear(deadline.deadline_time) ? '#fffbeb' : 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${
                    deadline.is_completed ? '#bbf7d0' :
                    isOverdue(deadline.deadline_time) ? '#fecaca' :
                    isDeadlineNear(deadline.deadline_time) ? '#fed7aa' : '#e2e8f0'
                  }`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{
                    fontWeight: '600',
                    color: deadline.is_completed ? '#166534' :
                           isOverdue(deadline.deadline_time) ? '#dc2626' :
                           isDeadlineNear(deadline.deadline_time) ? '#d97706' : '#1e293b'
                  }}>
                    {getActionText(deadline.action_type)}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#64748b',
                    marginTop: '4px'
                  }}>
                    데드라인: {new Date(deadline.deadline_time).toLocaleString('ko-KR')}
                  </div>
                </div>
                
                <div style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: deadline.is_completed ? '#166534' :
                             isOverdue(deadline.deadline_time) ? '#dc2626' :
                             isDeadlineNear(deadline.deadline_time) ? '#d97706' : '#64748b',
                  color: 'white'
                }}>
                  {deadline.is_completed ? '완료' :
                   isOverdue(deadline.deadline_time) ? '지연' :
                   isDeadlineNear(deadline.deadline_time) ? '임박' : '대기'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 향후 스케줄 */}
      {upcomingSchedules.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '16px'
          }}>
            향후 스케줄
          </h2>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {upcomingSchedules.map((schedule) => (
              <div
                key={schedule.id}
                style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '4px'
                  }}>
                    {schedule.course_name}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#64748b'
                  }}>
                    {formatDate(schedule.shoot_date)} • {formatTime(schedule.start_time)}-{formatTime(schedule.end_time)}
                  </div>
                </div>
                
                <div style={{
                  fontSize: '12px',
                  color: '#64748b',
                  textAlign: 'right'
                }}>
                  {schedule.main_location_name}<br/>
                  {schedule.location_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 빠른 액션 버튼 */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <button
          onClick={() => window.location.href = '/shooter/actions'}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
          }}
        >
          액션 수행
        </button>
      </div>
    </div>
  );
}

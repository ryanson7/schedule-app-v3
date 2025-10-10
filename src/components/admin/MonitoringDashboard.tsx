"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface ShooterStatus {
  schedule_id: number;
  shoot_date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  tracking_status: string;
  shooter_name: string;
  location_name: string;
  main_location_name: string;
  main_location_id: number;
  last_action_time: string;
  last_action: string;
  is_on_time: boolean;
  status_korean: string;
  next_deadline: string;
  next_action: string;
}

interface TeamLocation {
  id: number;
  name: string;
  location_type: string;
  is_active: boolean;
}

interface TimeRange {
  label: string;
  value: string;
  start: string;
  end: string;
}

interface DashboardStats {
  total_schedules: number;
  active_shooters: number;
  completed_today: number;
  overdue_actions: number;
  pending_notifications: number;
  by_team: { [key: string]: number };
  by_time: { [key: string]: number };
}

export default function MonitoringDashboard() {
  const [shooterStatuses, setShooterStatuses] = useState<ShooterStatus[]>([]);
  const [teamLocations, setTeamLocations] = useState<TeamLocation[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_schedules: 0,
    active_shooters: 0,
    completed_today: 0,
    overdue_actions: 0,
    pending_notifications: 0,
    by_team: {},
    by_time: {}
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 시간대 정의
  const timeRanges: TimeRange[] = [
    { label: '전체', value: 'all', start: '00:00', end: '23:59' },
    { label: '오전 (06:00-12:00)', value: 'morning', start: '06:00', end: '12:00' },
    { label: '오후 (12:00-18:00)', value: 'afternoon', start: '12:00', end: '18:00' },
    { label: '야간 (18:00-24:00)', value: 'night', start: '18:00', end: '24:00' }
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadDashboardData();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadDashboardData, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedDate, selectedTeam, selectedTimeRange, autoRefresh]);

  const loadInitialData = async () => {
    try {
      await loadTeamLocations();
      await loadDashboardData();
    } catch (error) {
      console.error('초기 데이터 로딩 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('main_locations')
        .select('id, name, location_type, is_active')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setTeamLocations(data);
      }
    } catch (error) {
      console.error('팀 위치 조회 오류:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        loadShooterStatuses(),
        loadStats()
      ]);
    } catch (error) {
      console.error('대시보드 데이터 로딩 오류:', error);
    }
  };

  const loadShooterStatuses = async () => {
    try {
      let query = supabase
        .from('shooter_status_view')
        .select('*')
        .eq('shoot_date', selectedDate);

      // 팀 필터링
      if (selectedTeam !== 'all') {
        query = query.eq('main_location_id', parseInt(selectedTeam));
      }

      const { data, error } = await query.order('start_time');

      if (!error && data) {
        // 시간대 필터링 (클라이언트 사이드)
        let filteredData = data;
        if (selectedTimeRange !== 'all') {
          const timeRange = timeRanges.find(tr => tr.value === selectedTimeRange);
          if (timeRange) {
            filteredData = data.filter(status => {
              const startTime = status.start_time.substring(0, 5);
              return startTime >= timeRange.start && startTime < timeRange.end;
            });
          }
        }
        
        setShooterStatuses(filteredData);
      }
    } catch (error) {
      console.error('Shooter 상태 조회 오류:', error);
    }
  };

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 기본 통계
      let totalQuery = supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .eq('shoot_date', selectedDate)
        .eq('is_active', true)
        .not('assigned_shooter_id', 'is', null);

      if (selectedTeam !== 'all') {
        totalQuery = totalQuery.eq('sub_locations.main_location_id', parseInt(selectedTeam));
      }

      const { count: totalSchedules } = await totalQuery;

      // 팀별 통계
      const { data: teamStats } = await supabase
        .from('schedules')
        .select(`
          sub_locations!inner(main_location_id, main_locations(name))
        `)
        .eq('shoot_date', selectedDate)
        .eq('is_active', true)
        .not('assigned_shooter_id', 'is', null);

      // 시간대별 통계
      const { data: timeStats } = await supabase
        .from('schedules')
        .select('start_time')
        .eq('shoot_date', selectedDate)
        .eq('is_active', true)
        .not('assigned_shooter_id', 'is', null);

      // 팀별 집계
      const byTeam: { [key: string]: number } = {};
      teamStats?.forEach(schedule => {
        const teamName = schedule.sub_locations?.main_locations?.name || '기타';
        byTeam[teamName] = (byTeam[teamName] || 0) + 1;
      });

      // 시간대별 집계
      const byTime: { [key: string]: number } = {
        '오전': 0,
        '오후': 0,
        '야간': 0
      };

      timeStats?.forEach(schedule => {
        const startTime = schedule.start_time.substring(0, 5);
        if (startTime >= '06:00' && startTime < '12:00') {
          byTime['오전']++;
        } else if (startTime >= '12:00' && startTime < '18:00') {
          byTime['오후']++;
        } else if (startTime >= '18:00' && startTime <= '24:00') {
          byTime['야간']++;
        }
      });

      // 기타 통계들
      const { count: activeShooters } = await supabase
        .from('schedules')
        .select('assigned_shooter_id', { count: 'exact', head: true })
        .eq('shoot_date', selectedDate)
        .eq('is_active', true)
        .not('assigned_shooter_id', 'is', null)
        .not('tracking_status', 'eq', 'completion');

      const { count: completedToday } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .eq('shoot_date', today)
        .eq('tracking_status', 'completion')
        .eq('is_active', true);

      const { count: overdueActions } = await supabase
        .from('shooter_action_deadlines')
        .select('*', { count: 'exact', head: true })
        .lt('deadline_time', new Date().toISOString())
        .eq('is_completed', false);

      const { count: pendingNotifications } = await supabase
        .from('push_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', 1)
        .eq('is_read', false);

      setStats({
        total_schedules: totalSchedules || 0,
        active_shooters: activeShooters || 0,
        completed_today: completedToday || 0,
        overdue_actions: overdueActions || 0,
        pending_notifications: pendingNotifications || 0,
        by_team: byTeam,
        by_time: byTime
      });

    } catch (error) {
      console.error('통계 조회 오류:', error);
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

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const getTimeRangeLabel = (startTime: string) => {
    const time = startTime.substring(0, 5);
    if (time >= '06:00' && time < '12:00') return '오전';
    if (time >= '12:00' && time < '18:00') return '오후';
    if (time >= '18:00' && time <= '24:00') return '야간';
    return '기타';
  };

  const filteredStatuses = shooterStatuses.filter(status => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'overdue') return status.next_deadline && new Date(status.next_deadline) < new Date();
    if (filterStatus === 'active') return !['completion', 'scheduled'].includes(status.tracking_status);
    return status.tracking_status === filterStatus;
  });

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
        모니터링 데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      background: '#f8fafc',
      minHeight: '100vh',
      fontFamily: 'inherit'
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '600' }}>
              실시간 모니터링 대시보드
            </h1>
            <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
              팀별, 시간대별 Shooter 활동 상태를 실시간 모니터링합니다
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ transform: 'scale(1.2)' }}
              />
              <span style={{ fontSize: '14px' }}>자동 새로고침</span>
            </label>
            
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* 필터링 컨트롤 */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '24px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          {/* 팀 필터 */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              팀 선택
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="all">전체 팀</option>
              {teamLocations.map(team => (
                <option key={team.id} value={team.id.toString()}>
                  {team.name} ({team.location_type})
                </option>
              ))}
            </select>
          </div>

          {/* 시간대 필터 */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              시간대 선택
            </label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              {timeRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* 상태 필터 */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              상태 필터
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="all">전체</option>
              <option value="active">활성</option>
              <option value="overdue">지연</option>
              <option value="completion">완료</option>
            </select>
          </div>

          {/* 현재 필터 요약 */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              필터 결과
            </label>
            <div style={{
              padding: '8px 12px',
              background: '#f3f4f6',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#1f2937'
            }}>
              {filteredStatuses.length}건 표시 중
            </div>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
            총 스케줄
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
            {stats.total_schedules}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
            활성 Shooter
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
            {stats.active_shooters}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
            지연된 액션
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
            {stats.overdue_actions}
          </div>
        </div>
      </div>

      {/* 팀별/시간대별 통계 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* 팀별 통계 */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            팀별 스케줄 현황
          </h3>
          {Object.entries(stats.by_team).map(([team, count]) => (
            <div key={team} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <span style={{ fontSize: '14px', color: '#374151' }}>{team}</span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{count}건</span>
            </div>
          ))}
        </div>

        {/* 시간대별 통계 */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            시간대별 스케줄 현황
          </h3>
          {Object.entries(stats.by_time).map(([timeRange, count]) => (
            <div key={timeRange} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <span style={{ fontSize: '14px', color: '#374151' }}>{timeRange}</span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{count}건</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shooter 상태 목록 */}
      <div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1e293b',
          marginBottom: '16px'
        }}>
          Shooter 실시간 상태 ({filteredStatuses.length}건)
        </h2>

        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredStatuses.map((status) => {
            const isOverdue = status.next_deadline && new Date(status.next_deadline) < new Date();
            const timeRangeLabel = getTimeRangeLabel(status.start_time);
            
            return (
              <div
                key={status.schedule_id}
                style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${isOverdue ? '#fecaca' : '#e2e8f0'}`,
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                  backgroundColor: isOverdue ? '#fef2f2' : 'white'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        background: getStatusColor(status.tracking_status),
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {status.status_korean}
                      </span>
                      
                      <span style={{
                        background: '#f3f4f6',
                        color: '#374151',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {timeRangeLabel}
                      </span>
                      
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {formatTime(status.start_time)} - {formatTime(status.end_time)}
                      </span>
                    </div>
                    
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '4px'
                    }}>
                      {status.course_name}
                    </div>
                    
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      marginBottom: '2px'
                    }}>
                      Shooter: {status.shooter_name} | 팀: {status.main_location_name}
                    </div>
                    
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b'
                    }}>
                      위치: {status.location_name}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredStatuses.length === 0 && (
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#64748b',
              border: '2px dashed #cbd5e1'
            }}>
              선택한 조건에 해당하는 스케줄이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

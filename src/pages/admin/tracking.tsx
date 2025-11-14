// src/pages/admin/tracking.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { safeUserRole } from '../../utils/permissions';

interface Schedule {
  id: number;
  professor_name: string;
  course_name: string;
  shoot_date: string;
  start_time: string;
  end_time: string;
  tracking_status: string | null;
  team_id: number;
  sub_location_id: number;
  assigned_shooter_id: number;
  created_at: string;
  is_confirmed: boolean;
  confirmed_at: string | null;
}

interface TeamMainLocation {
  team_id: number;
  main_location_id: number;
}

interface Team {
  id: number;
  name: string;
}

interface MainLocation {
  id: number;
  name: string;
}

interface SubLocation {
  id: number;
  name: string;
  main_location_id: number;
}

interface User {
  id: number;
  auth_id: string;
  name: string;
  phone: string | null;
}

interface Shooter {
  id: number;
  user_id: string;
  emergency_phone: string | null;
  name: string | null;
}

export default function AdminTrackingPage() {
  const { user } = useAuth();
  const [userInfo, setUserInfo] = useState<{name: string, role: string} | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMainLocations, setTeamMainLocations] = useState<TeamMainLocation[]>([]);
  const [mainLocations, setMainLocations] = useState<MainLocation[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  const [searchDate, setSearchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unconfirmed' | 'scheduled' | 'departed' | 'arrived' | 'in_progress' | 'completed'>('all');
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');

  // 반응형 상태
  const [isMobile, setIsMobile] = useState(false);

  // 화면 크기 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 사용자 정보 로드
  useEffect(() => {
    if (user) {
      const userName = localStorage.getItem('userName');
      const userRole = localStorage.getItem('userRole');
      
      if (userName && userRole) {
        setUserInfo({ name: userName, role: userRole });
      }
    }
  }, [user]);

  // ✅ 로그 정리한 기초 데이터 조회
  const fetchFilterData = async () => {
    try {
      const [teamsResult, teamMainLocationsResult, mainLocationsResult, subLocationsResult, usersResult, shootersResult] = await Promise.all([
        supabase.from('teams').select('id, name').order('name'),
        supabase.from('team_main_location').select('team_id, main_location_id'),
        supabase.from('main_locations').select('id, name').order('name'),
        supabase.from('sub_locations').select('id, name, main_location_id').order('name'),
        supabase.from('users').select('id, auth_id, name, phone').eq('role', 'shooter').order('name'),
        supabase.from('shooters').select('id, user_id, emergency_phone, name, is_active').eq('is_active', true).order('id')
      ]);

      if (teamsResult.data) {
        const filteredTeams = teamsResult.data.filter(team => team.id !== 1);
        setTeams(filteredTeams);
      }
      if (teamMainLocationsResult.data) setTeamMainLocations(teamMainLocationsResult.data);
      if (mainLocationsResult.data) setMainLocations(mainLocationsResult.data);
      if (subLocationsResult.data) setSubLocations(subLocationsResult.data);
      if (usersResult.data) setUsers(usersResult.data);
      
      if (shootersResult.error) {
        console.error('shooters 테이블 조회 오류:', shootersResult.error);
        setShooters([]);
      } else {
        setShooters(shootersResult.data || []);
      }
    } catch (error) {
      console.error('필터 데이터 조회 실패:', error);
    }
  };

  // 스케줄 데이터 조회
  const fetchSchedules = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('schedules')
        .select(`
          id,
          professor_name,
          course_name,
          shoot_date,
          start_time,
          end_time,
          tracking_status,
          team_id,
          sub_location_id,
          assigned_shooter_id,
          created_at,
          is_confirmed,
          confirmed_at
        `)
        .eq('shoot_date', searchDate)
        .order('start_time', { ascending: true });

      // 상태 필터링
      if (statusFilter !== 'all') {
        if (statusFilter === 'unconfirmed') {
          query = query.eq('is_confirmed', false);
        } else {
          query = query.eq('is_confirmed', true).eq('tracking_status', statusFilter);
        }
      }

      // 팀 필터링 - team_main_location 테이블 기반
      if (teamFilter !== 'all') {
        const teamMainLocationRows = teamMainLocations.filter(tml => tml.team_id === teamFilter);
        const mainLocationIds = teamMainLocationRows.map(tml => tml.main_location_id);
        
        if (mainLocationIds.length > 0) {
          const teamSubLocations = subLocations
            .filter(sub => mainLocationIds.includes(sub.main_location_id))
            .map(sub => sub.id);
          
          if (teamSubLocations.length > 0) {
            query = query.in('sub_location_id', teamSubLocations);
          }
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setSchedules(data || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('스케줄 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 자동 새로고침
  useEffect(() => {
    if (userInfo) {
      fetchFilterData();
      fetchSchedules();
    }
  }, [userInfo]);

  useEffect(() => {
    if (userInfo && subLocations.length > 0 && teamMainLocations.length > 0) {
      fetchSchedules();
    }
  }, [searchDate, statusFilter, teamFilter, subLocations, teamMainLocations]);

  // 30초마다 자동 새로고침
  useEffect(() => {
    const interval = setInterval(() => {
      if (userInfo) {
        fetchSchedules();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userInfo, searchDate, statusFilter, teamFilter]);

  // 시간 포맷 함수 (초단위 삭제)
  const formatTime = (timeString: string): string => {
    if (!timeString) return '';
    return timeString.split(':').slice(0, 2).join(':');
  };

  // 상태 판단 함수
  const getStatusColor = (schedule: Schedule) => {
    if (!schedule.is_confirmed) {
      return '#dc2626';
    }
    
    const colors = {
      scheduled: '#3b82f6',
      departed: '#f59e0b',
      arrived: '#8b5cf6',
      in_progress: '#10b981',
      completed: '#6b7280'
    };
    return colors[schedule.tracking_status] || '#3b82f6';
  };

  const getStatusLabel = (schedule: Schedule) => {
    if (!schedule.is_confirmed) {
      return '촬영자 미확인';
    }
    
    const labels = {
      scheduled: '확인완료',
      departed: '출발',
      arrived: '도착', 
      in_progress: '진행중',
      completed: '종료'
    };
    return labels[schedule.tracking_status] || '확인완료';
  };

  // 팀명 조회
  const getTeamName = (teamId: number) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : '미정';
  };

  // 장소명 조회
  const getLocationName = (subLocationId: number) => {
    const subLocation = subLocations.find(s => s.id === subLocationId);
    if (!subLocation) return '미정';
    
    const mainLocation = mainLocations.find(m => m.id === subLocation.main_location_id);
    const mainName = mainLocation ? mainLocation.name : '미정';
    
    return `${mainName} ${subLocation.name}`;
  };

  // ✅ 로그 정리한 촬영자 정보 조회
  const getShooterInfo = (shooterId: number) => {
    const user = users.find(u => u.id === shooterId);
    
    if (!user) {
      return { name: '미정', contacts: '' };
    }
    
    const shooter = shooters.find(s => s.user_id === user.auth_id);
    
    const contacts = [];
    if (user.phone) contacts.push(user.phone);
    if (shooter?.emergency_phone) {
      contacts.push(`비상: ${shooter.emergency_phone}`);
    }
    
    return {
      name: user.name || shooter?.name || '미정',
      contacts: contacts.join(' / ')
    };
  };

  // 통계
  const stats = {
    total: schedules.length,
    unconfirmed: schedules.filter(s => !s.is_confirmed).length,
    confirmed: schedules.filter(s => s.is_confirmed && s.tracking_status === 'scheduled').length,
    departed: schedules.filter(s => s.is_confirmed && s.tracking_status === 'departed').length,
    arrived: schedules.filter(s => s.is_confirmed && s.tracking_status === 'arrived').length, 
    in_progress: schedules.filter(s => s.is_confirmed && s.tracking_status === 'in_progress').length,
    completed: schedules.filter(s => s.is_confirmed && s.tracking_status === 'completed').length
  };

  // 로딩 상태
  if (!user || !userInfo) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#f8fafc' 
      }}>
        <div>사용자 정보를 불러오는 중...</div>
      </div>
    );
  }

  // 권한 체크
  const userRole = safeUserRole(userInfo.role);
  const allowedRoles = ['system_admin', 'schedule_admin', 'manager']; // 🔧 manager 권한 포함
  if (!allowedRoles.includes(userRole)) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        background: '#f8fafc',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>접근 권한이 없습니다.</div>
      </div>
    );
  }

  // 상태 필터 버튼 컴포넌트
  const StatusFilterButtons = () => {
    const buttons = [
      { key: 'all', label: '전체', count: stats.total, color: '#667eea' },
      { key: 'unconfirmed', label: '미확인', count: stats.unconfirmed, color: '#dc2626' },
      { key: 'scheduled', label: '확인완료', count: stats.confirmed, color: '#3b82f6' },
      { key: 'departed', label: '출발', count: stats.departed, color: '#f59e0b' },
      { key: 'in_progress', label: '진행중', count: stats.in_progress, color: '#10b981' },
      { key: 'completed', label: '완료', count: stats.completed, color: '#6b7280' }
    ];

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(6, 1fr)' : 'repeat(6, 1fr)',
        gap: isMobile ? '4px' : '16px'
      }}>
        {buttons.map(button => (
          <button
            key={button.key}
            onClick={() => setStatusFilter(button.key as any)}
            style={{
              padding: isMobile ? '12px 8px' : '20px',
              background: statusFilter === button.key 
                ? `linear-gradient(135deg, ${button.color} 0%, ${button.color}cc 100%)`
                : 'white',
              color: statusFilter === button.key ? 'white' : button.color,
              borderRadius: isMobile ? '8px' : '12px',
              textAlign: 'center',
              cursor: 'pointer',
              border: statusFilter === button.key ? 'none' : `2px solid ${button.color}20`,
              boxShadow: statusFilter === button.key 
                ? '0 4px 20px rgba(0,0,0,0.15)' 
                : '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
              fontSize: isMobile ? '10px' : '14px',
              fontWeight: '600'
            }}
          >
            <div style={{ 
              fontSize: isMobile ? '14px' : '28px', 
              fontWeight: 'bold', 
              marginBottom: '4px' 
            }}>
              {button.count}
            </div>
            <div style={{ opacity: 0.9 }}>{button.label}</div>
          </button>
        ))}
      </div>
    );
  };

  // 모바일 버전
  if (isMobile) {
    return (
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        background: '#f8fafc',
        minHeight: '100vh',
        padding: '16px'
      }}>
        {/* 모바일 헤더 */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '16px'
        }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            color: '#1e293b'
          }}>
            실시간 촬영 현황
          </h1>
          
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            marginBottom: '16px'
          }}>
            업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
          </div>

          {/* 모바일 날짜 & 팀 필터 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              style={{
                padding: '8px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                padding: '8px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="all">전체 팀</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          {/* 모바일 상태 필터 버튼 */}
          <StatusFilterButtons />
        </div>

        {/* ✅ 개선된 모바일 스케줄 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              로딩 중...
            </div>
          ) : schedules.length === 0 ? (
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '12px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              스케줄이 없습니다
            </div>
          ) : (
            schedules.map(schedule => {
              const shooterInfo = getShooterInfo(schedule.assigned_shooter_id);
              return (
                <div
                  key={schedule.id}
                  style={{
                    background: 'white',
                    padding: '16px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    borderLeft: `4px solid ${getStatusColor(schedule)}`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      margin: 0,
                      color: '#1e293b',
                      flex: 1
                    }}>
                      {formatTime(schedule.start_time)} ~ {formatTime(schedule.end_time)}
                    </h3>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: getStatusColor(schedule),
                      background: `${getStatusColor(schedule)}20`,
                      padding: '4px 8px',
                      borderRadius: '12px'
                    }}>
                      {getStatusLabel(schedule)}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.4' }}>
                    <div style={{ marginBottom: '4px', fontWeight: '500', color: '#1e293b' }}>
                      {schedule.course_name}
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      장소: {getLocationName(schedule.sub_location_id)}
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      강사: {schedule.professor_name || '미정'}
                    </div>
                    
                    {/* ✅ 개선된 촬영자 정보 */}
                    <div style={{ 
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <span style={{ color: '#1e293b', fontWeight: '500' }}>
                        촬영: {shooterInfo.name}
                      </span>
                      {shooterInfo.contacts && (
                        <span style={{ 
                          fontSize: '12px', 
                          color: '#059669',  // ✅ 초록색으로 변경
                          fontWeight: '500'
                        }}>
                          {shooterInfo.contacts}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // 데스크톱 버전
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      padding: '24px',
      maxWidth: '1600px',
      margin: '0 auto',
      background: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* 데스크톱 헤더 */}
      <div style={{
        background: 'white',
        padding: '32px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 'bold',
              margin: '0 0 8px 0',
              color: '#1e293b'
            }}>
              실시간 촬영 현황 모니터링
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#64748b',
              margin: 0
            }}>
              {userInfo.name} • 마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              자동 새로고침 (30초)
            </div>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: loading ? '#f59e0b' : '#10b981'
            }}></div>
          </div>
        </div>

        {/* 데스크톱 날짜 & 팀 필터 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 300px',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              촬영일
            </label>
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              팀
            </label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="all">전체 팀</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 데스크톱 상태 필터 버튼 */}
        <StatusFilterButtons />
      </div>

      {/* ✅ 개선된 데스크톱 스케줄 테이블 */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: 0,
            color: '#1e293b'
          }}>
            {new Date(searchDate).toLocaleDateString('ko-KR')} 촬영 현황
          </h2>
        </div>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            color: '#64748b'
          }}>
            데이터를 불러오는 중...
          </div>
        ) : schedules.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            color: '#64748b'
          }}>
            해당 조건의 스케줄이 없습니다
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb'
                  }}>시간</th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb'
                  }}>장소</th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb'
                  }}>강사</th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb'
                  }}>촬영자</th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb'
                  }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule, index) => {
                  const shooterInfo = getShooterInfo(schedule.assigned_shooter_id);
                  return (
                    <tr key={schedule.id} style={{
                      background: index % 2 === 0 ? 'white' : '#fafbfc',
                      borderLeft: `4px solid ${getStatusColor(schedule)}`
                    }}>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#1e293b',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <div style={{ fontWeight: '600' }}>
                          {formatTime(schedule.start_time)} ~ {formatTime(schedule.end_time)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          {schedule.course_name}
                        </div>
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#64748b',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        {getLocationName(schedule.sub_location_id)}
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#64748b',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        {schedule.professor_name || '미정'}
                      </td>
                      
                      {/* ✅ 개선된 촬영자 컬럼 */}
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#64748b',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{ fontWeight: '500', color: '#1e293b' }}>
                              {shooterInfo.name}
                            </span>
                            {shooterInfo.contacts && (
                              <span style={{ 
                                fontSize: '12px', 
                                color: '#0d9488',  // ✅ 청록색으로 변경
                                fontWeight: '500',
                                background: '#f0fdfa',  // ✅ 연한 배경 추가
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                {shooterInfo.contacts}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      <td style={{
                        padding: '16px',
                        textAlign: 'center',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'white',
                          background: getStatusColor(schedule),
                          minWidth: '60px'
                        }}>
                          {getStatusLabel(schedule)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

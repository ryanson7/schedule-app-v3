// src/pages/shooter/ShooterDashboard.tsx - 모바일 반응형 완성 버전
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/router';
import { ShootingTracker } from '../../utils/shootingTracker';

// 인터페이스들은 동일...
interface TodaySchedule {
  id: number;
  professor_name: string;
  course_name: string;
  start_time: string;
  end_time: string;
  sub_location_id: number;
  team_id: number;
  assigned_shooter_id: number;
  shoot_date: string;
  tracking_status?: string;
  is_confirmed?: boolean;
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

interface Notification {
  id: string;
  title: string;
  content: string;
  display_locations: string[];
  is_active: boolean;
  show_from: string | null;
  show_until: string | null;
  created_at: string;
}

const ShooterDashboard = () => {
  const { user } = useAuth();
  const router = useRouter();
  
  // 🔧 모바일 반응형 상태 추가
  const [isMobile, setIsMobile] = useState(false);
  
  // 기존 상태들...
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [todaySchedules, setTodaySchedules] = useState<TodaySchedule[]>([]);
  const [tomorrowSchedules, setTomorrowSchedules] = useState<TodaySchedule[]>([]);
  const [mainLocations, setMainLocations] = useState<MainLocation[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 🔧 모바일 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 기존 함수들은 동일...
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    const hasAccess = userRole === 'shooter' || userRole === 'system_admin' || userRole === 'schedule_admin';
    setHasPermission(hasAccess);
    setPermissionLoading(false);
    if (!hasAccess) {
      alert('Shooter 대시보드 접근 권한이 없습니다.');
      router.push('/login');
    }
  }, [router]);

  // 🔧 반응형 스타일 객체
  const styles = {
    container: {
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      background: '#f8fafc',
      minHeight: '100vh',
      padding: isMobile ? '10px' : '20px 20px 0 20px',
      width: '100%',
      maxWidth: 'none',
      display: 'flex',
      justifyContent: 'center'
    },
    wrapper: {
      width: '100%',
      maxWidth: isMobile ? '100%' : '800px',
      margin: '0 auto'
    },
    header: {
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      padding: isMobile ? '16px 20px' : '20px 28px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '10px',
      border: '1px solid #e2e8f0',
      textAlign: 'center' as const
    },
    headerTitle: {
      fontSize: isMobile ? '24px' : '30px',
      fontWeight: 'bold' as const,
      margin: '0 0 4px 0',
      color: '#1a202c'
    },
    userName: {
      fontSize: isMobile ? '20px' : '24px',
      fontWeight: '600' as const,
      color: '#1e293b',
      marginBottom: '16px'
    },
    scheduleCard: {
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '10px',
      border: '1px solid #bfdbfe'
    },
    scheduleHeader: {
      padding: isMobile ? '12px 16px' : '16px 24px',
      borderBottom: '1px solid #93c5fd'
    },
    scheduleTitle: {
      fontSize: isMobile ? '16px' : '18px',
      fontWeight: '600' as const,
      margin: 0,
      color: '#1e40af'
    },
    scheduleItem: {
      padding: isMobile ? '12px 16px' : '16px 24px',
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center' as const,
      flexDirection: isMobile ? 'column' : 'row' as const,
      gap: isMobile ? '12px' : '16px'
    },
    scheduleContent: {
      flex: '1'
    },
    scheduleTime: {
      fontSize: isMobile ? '14px' : '16px',
      fontWeight: '600' as const,
      color: '#1e293b',
      marginBottom: '6px'
    },
    scheduleDetails: {
      fontSize: isMobile ? '13px' : '15px',
      color: '#64748b',
      marginBottom: '4px'
    },
    scheduleLocation: {
      fontSize: isMobile ? '12px' : '14px',
      color: '#6b7280'
    },
    shootingButton: {
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: isMobile ? '8px 12px' : '10px 16px',
      borderRadius: '6px',
      fontSize: isMobile ? '12px' : '14px',
      fontWeight: '500' as const,
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
      width: isMobile ? '100%' : 'auto'
    },
    navButtons: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px'
    },
    navButton: {
      padding: isMobile ? '14px 20px' : '16px 24px',
      borderRadius: '8px',
      fontSize: isMobile ? '14px' : '15px',
      fontWeight: '600' as const,
      cursor: 'pointer',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      transition: 'all 0.2s ease',
      border: 'none',
      width: '100%'
    },
    notificationCard: {
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '16px',
      border: '1px solid #f59e0b'
    },
    notificationHeader: {
      padding: isMobile ? '12px 16px' : '16px 24px',
      borderBottom: '1px solid #f59e0b'
    },
    notificationItem: {
      padding: isMobile ? '12px 16px' : '16px 24px'
    },
    notificationTitle: {
      fontSize: isMobile ? '14px' : '16px',
      fontWeight: '600' as const,
      color: '#1e293b',
      marginBottom: '8px'
    },
    notificationContent: {
      fontSize: isMobile ? '12px' : '14px',
      color: '#64748b',
      lineHeight: '1.5',
      whiteSpace: 'pre-line' as const
    }
  };

  // 기존 로직들은 동일하게 유지...
  const getKSTDates = useCallback(() => {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const koreaTime = new Date(utcTime + (9 * 3600000));
    
    const today = new Date(koreaTime.getFullYear(), koreaTime.getMonth(), koreaTime.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.getFullYear() + '-' + 
                     String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(today.getDate()).padStart(2, '0');
                     
    const tomorrowStr = tomorrow.getFullYear() + '-' + 
                        String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(tomorrow.getDate()).padStart(2, '0');
    
    return { today: todayStr, tomorrow: tomorrowStr, currentKSTTime: koreaTime, todayObject: today, tomorrowObject: tomorrow };
  }, []);

  const dateInfo = useMemo(() => getKSTDates(), []);

  const formatTime = useCallback((timeString: string): string => {
    if (!timeString) return '';
    return timeString.split(':').slice(0, 2).join(':');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const koreaTime = new Date(utcTime + (9 * 3600000));
      setCurrentTime(koreaTime);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('freelancer_schedule_notifications')
        .select('*')
        .eq('is_active', true)
        .or('display_locations.cs.{"dashboard"},display_locations.cs.{"all"}')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('공지사항 조회 실패:', error);
        return;
      }
      
      const filtered = (data || []).filter(notification => {
        const showFrom = notification.show_from;
        const showUntil = notification.show_until;
        
        if (showFrom && new Date(showFrom) > new Date(now)) return false;
        if (showUntil && new Date(showUntil) < new Date(now)) return false;
        
        return true;
      });
      
      setNotifications(filtered);
    } catch (error) {
      console.error('공지사항 조회 실패:', error);
    }
  }, []);

  const fetchLocationData = useCallback(async () => {
    try {
      const [mainLocationsResult, subLocationsResult] = await Promise.all([
        supabase.from('main_locations').select('id, name').order('name'),
        supabase.from('sub_locations').select('id, name, main_location_id').order('name')
      ]);

      if (mainLocationsResult.data) setMainLocations(mainLocationsResult.data);
      if (subLocationsResult.data) setSubLocations(subLocationsResult.data);
    } catch (error) {
      console.error('위치 데이터 조회 실패:', error);
      setError('위치 데이터를 불러올 수 없습니다.');
    }
  }, []);

  const getLocationName = useCallback((subLocationId: number) => {
    const subLocation = subLocations.find(s => s.id === subLocationId);
    if (!subLocation) return '미정';
    
    const mainLocation = mainLocations.find(m => m.id === subLocation.main_location_id);
    const mainName = mainLocation ? mainLocation.name : '미정';
    
    return `${mainName} ${subLocation.name}`;
  }, [subLocations, mainLocations]);

  const fetchSchedules = useCallback(async () => {
    if (!user || subLocations.length === 0) return;

    try {
      setLoading(true);
      setError(null);
      
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('email', user.email)
        .single();

      if (userError || !userRow) {
        setError(`사용자 정보를 찾을 수 없습니다: ${user.email}`);
        return;
      }

      const numericUserId = userRow.id;

      const [todayResult, tomorrowResult] = await Promise.all([
        supabase
          .from('schedules')
          .select('id, professor_name, course_name, start_time, end_time, sub_location_id, team_id, assigned_shooter_id, shoot_date, tracking_status, is_confirmed')
          .eq('shoot_date', dateInfo.today)
          .eq('assigned_shooter_id', numericUserId)
          .order('start_time', { ascending: true }),
        supabase
          .from('schedules')
          .select('id, professor_name, course_name, start_time, end_time, sub_location_id, team_id, assigned_shooter_id, shoot_date, tracking_status, is_confirmed')
          .eq('shoot_date', dateInfo.tomorrow)
          .eq('assigned_shooter_id', numericUserId)
          .order('start_time', { ascending: true })
      ]);

      if (todayResult.error) {
        setError(`오늘 스케줄 조회 실패: ${todayResult.error.message}`);
      } else {
        setTodaySchedules(todayResult.data || []);
      }

      if (tomorrowResult.error) {
        setError(`내일 스케줄 조회 실패: ${tomorrowResult.error.message}`);
      } else {
        setTomorrowSchedules(tomorrowResult.data || []);
      }

    } catch (error) {
      setError(`스케줄 조회 중 오류가 발생했습니다: ${error}`);
      setTodaySchedules([]);
      setTomorrowSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [user, subLocations, dateInfo]);

  const handleShootingStart = useCallback((schedule: TodaySchedule) => {
    const scheduleData = {
      id: schedule.id?.toString(),
      title: schedule.professor_name || '교수명',
      courseName: ShootingTracker.formatCourseName(schedule),
      location: getLocationName(schedule.sub_location_id),
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      professor: schedule.professor_name
    };
    
    if (!scheduleData.id || scheduleData.id === 'undefined') {
      alert('스케줄 ID가 없습니다. 관리자에게 문의하세요.');
      return;
    }
    
    sessionStorage.setItem('currentSchedule', JSON.stringify(scheduleData));
    router.push(`/shooter/tracking?schedule=${schedule.id}`);
  }, [getLocationName, router]);

  useEffect(() => {
    if (!permissionLoading && hasPermission && user) {
      const storedUserName = localStorage.getItem('userName');
      if (storedUserName) {
        setUserName(storedUserName);
      }
      fetchLocationData();
      fetchNotifications();
    }
  }, [user, fetchLocationData, fetchNotifications, hasPermission, permissionLoading]);

  useEffect(() => {
    if (user && subLocations.length > 0) {
      fetchSchedules();
    }
  }, [user, subLocations.length, fetchSchedules]);

  if (permissionLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        gap: '16px',
        padding: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{
          fontSize: '18px',
          color: '#64748b',
          fontWeight: '500',
          textAlign: 'center'
        }}>
          권한 확인 중...
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        gap: '20px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: isMobile ? '20px' : '24px',
          color: '#ef4444',
          fontWeight: '600'
        }}>
          접근 권한이 없습니다
        </div>
        <div style={{
          fontSize: isMobile ? '14px' : '16px',
          color: '#64748b',
          lineHeight: 1.5
        }}>
          Shooter 대시보드에 접근할 권한이 없습니다.<br/>
          관리자에게 문의하세요.
        </div>
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '12px 24px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '20px'
      }}>
        <div>로그인이 필요합니다.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* 헤더 */}
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>
            안녕하세요 {loading && '(로딩중...)'}
          </h1>
          <div style={styles.userName}>
             {userName} PD님
          </div>
          
          <div style={{
            fontSize: isMobile ? '12px' : '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '2px'
          }}>
            {currentTime.toLocaleDateString('ko-KR', { 
              year: 'numeric',
              month: 'long', 
              day: 'numeric',
              weekday: 'long'
            })}
          </div>
          
          <div style={{
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: '700',
            color: '#3b82f6',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {currentTime.toLocaleTimeString('ko-KR', { 
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
        </div>

        {/* 공지사항 */}
        {notifications.length > 0 && (
          <div style={styles.notificationCard}>
            <div style={styles.notificationHeader}>
              <h2 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                margin: 0,
                color: '#92400e'
              }}>
                📢 공지사항
              </h2>
            </div>
            
            <div style={{ padding: '0', background: 'white' }}>
              {notifications.map((notification, index) => (
                <div
                  key={notification.id}
                  style={{
                    ...styles.notificationItem,
                    borderBottom: index < notifications.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  <div style={styles.notificationTitle}>
                    {notification.title}
                  </div>
                  <div style={styles.notificationContent}>
                    {notification.content}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    marginTop: '8px'
                  }}>
                    {new Date(notification.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div style={{
            margin: '0 0 16px 0',
            padding: isMobile ? '10px 12px' : '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: isMobile ? '12px' : '14px'
          }}>
            ❌ {error}
          </div>
        )}

        {/* 새로고침 버튼 */}
        <div style={{
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <button
            onClick={fetchSchedules}
            disabled={loading}
            style={{
              background: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              padding: isMobile ? '6px 12px' : '8px 16px',
              borderRadius: '8px',
              fontSize: isMobile ? '12px' : '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? '새로고침 중...' : '🔄 스케줄 새로고침'}
          </button>
        </div>

        {/* 오늘 스케줄 */}
        <div style={styles.scheduleCard}>
          <div style={styles.scheduleHeader}>
            <h2 style={styles.scheduleTitle}>
              📅 오늘 스케줄 ({currentTime.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
              })}) - {todaySchedules.length}건
            </h2>
          </div>

          <div style={{ padding: '0', background: 'white' }}>
            {loading ? (
              <div style={{
                padding: isMobile ? '30px 15px' : '40px 20px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <div style={{
                  width: isMobile ? '24px' : '32px',
                  height: isMobile ? '24px' : '32px',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px'
                }}></div>
                오늘 스케줄 로딩 중...
              </div>
            ) : todaySchedules.length === 0 ? (
              <div style={{
                padding: isMobile ? '30px 15px' : '40px 20px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: isMobile ? '14px' : '16px'
              }}>
                오늘 촬영 일정이 없습니다
              </div>
            ) : (
              todaySchedules.map((schedule, index) => {
                const isCompleted = schedule.tracking_status === 'completed';
                
                return (
                  <div
                    key={schedule.id}
                    style={{
                      ...styles.scheduleItem,
                      borderBottom: index < todaySchedules.length - 1 ? '1px solid #f1f5f9' : 'none',
                      opacity: isCompleted ? 0.6 : 1
                    }}
                  >
                    <div style={styles.scheduleContent}>
                      <div style={styles.scheduleTime}>
                        {formatTime(schedule.start_time)} ~ {formatTime(schedule.end_time)}
                      </div>
                      <div style={styles.scheduleDetails}>
                        {schedule.professor_name || '미정'} / {ShootingTracker.formatCourseName(schedule)}
                      </div>
                      <div style={styles.scheduleLocation}>
                        {getLocationName(schedule.sub_location_id)}
                      </div>
                      
                      {!schedule.is_confirmed && (
                        <div style={{
                          fontSize: isMobile ? '10px' : '12px',
                          color: '#ef4444',
                          marginTop: '4px',
                          fontWeight: '500'
                        }}>
                          ⚠️ 미확인 스케줄
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleShootingStart(schedule)}
                      disabled={isCompleted}
                      style={{
                        ...styles.shootingButton,
                        background: isCompleted ? '#e5e7eb' : '#3b82f6',
                        color: isCompleted ? '#9ca3af' : 'white',
                        cursor: isCompleted ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isCompleted ? '완료' : '촬영시작'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 내일 스케줄 */}
        <div style={{
          ...styles.scheduleCard,
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: '1px solid #bbf7d0'
        }}>
          <div style={{
            ...styles.scheduleHeader,
            borderBottom: '1px solid #86efac'
          }}>
            <h2 style={{
              ...styles.scheduleTitle,
              color: '#15803d'
            }}>
              📅 내일 스케줄 ({(() => {
                const tomorrowDisplay = new Date(currentTime);
                tomorrowDisplay.setDate(currentTime.getDate() + 1);
                return tomorrowDisplay.toLocaleDateString('ko-KR', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit' 
                });
              })()}) - {tomorrowSchedules.length}건
            </h2>
          </div>

          <div style={{ padding: '0', background: 'white' }}>
            {loading ? (
              <div style={{
                padding: isMobile ? '25px 12px' : '30px 15px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                내일 스케줄 로딩 중...
              </div>
            ) : tomorrowSchedules.length === 0 ? (
              <div style={{
                padding: isMobile ? '25px 12px' : '30px 15px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: isMobile ? '14px' : '16px'
              }}>
                내일 촬영 일정이 없습니다
              </div>
            ) : (
              tomorrowSchedules.map((schedule, index) => (
                <div
                  key={schedule.id}
                  style={{
                    ...styles.scheduleItem,
                    borderBottom: index < tomorrowSchedules.length - 1 ? '1px solid #f1f5f9' : 'none',
                    opacity: 0.8,
                    flexDirection: 'column',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={styles.scheduleTime}>
                    {formatTime(schedule.start_time)} ~ {formatTime(schedule.end_time)}
                  </div>
                  <div style={styles.scheduleDetails}>
                    {schedule.professor_name || '미정'} / {ShootingTracker.formatCourseName(schedule)}
                  </div>
                  <div style={styles.scheduleLocation}>
                    {getLocationName(schedule.sub_location_id)}
                  </div>
                  
                  {!schedule.is_confirmed && (
                    <div style={{
                      fontSize: isMobile ? '10px' : '12px',
                      color: '#f59e0b',
                      marginTop: '4px',
                      fontWeight: '500'
                    }}>
                      ⚠️ 미확인 스케줄
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 네비게이션 버튼들 */}
        <div style={styles.navButtons}>
          <button
            onClick={() => router.push('/shooter/schedule-check')}
            style={{
              ...styles.navButton,
              background: '#a4fd3eff',
              color: '#374151',
              border: '2px solid #e2e8f0'
            }}
          >
            이번주 스케줄 확인
          </button>
          
          <button
            onClick={() => router.push('/shooter/FreelancerWeeklySchedule')}
            style={{
              ...styles.navButton,
              background: '#3b82f6',
              color: 'white'
            }}
          >
            스케줄 등록
          </button>
          
          <button
            onClick={() => {
              localStorage.removeItem('userName');
              localStorage.removeItem('userRole');
              router.push('/login');
            }}
            style={{
              ...styles.navButton,
              background: '#6b7280',
              color: 'white'
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        @media (max-width: 768px) {
          button:hover:not(:disabled) {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ShooterDashboard;

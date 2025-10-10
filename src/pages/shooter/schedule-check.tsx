// src/pages/shooter/schedule-check.tsx - 완전한 버전
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/router';

interface Schedule {
  id: number;
  professor_name: string;
  course_name: string;
  start_time: string;
  end_time: string;
  sub_location_id: number;
  shoot_date: string;
  team_id: number;
  assigned_shooter_id: number;
  tracking_status: string | null;
  is_confirmed: boolean;
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

const ScheduleCheck = () => {
  const { user } = useAuth();
  const router = useRouter();
  
  // 🔧 간소화된 권한 체크
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [mainLocations, setMainLocations] = useState<MainLocation[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 🔧 간소화된 권한 체크
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    
    const hasAccess = userRole === 'shooter' || userRole === 'system_admin' || userRole === 'schedule_admin';
    
    setHasPermission(hasAccess);
    setPermissionLoading(false);

    if (!hasAccess) {
      alert('스케줄 체크 페이지 접근 권한이 없습니다.');
      router.push('/login');
    }
  }, [router]);

  // KST 시간
  const getKSTTime = useCallback(() => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  }, []);
  
  // 시/분 포맷
  const formatTime = useCallback((t: string) => t ? t.split(':').slice(0,2).join(':') : '', []);
  
  // 주차 계산
  const weekRange = useMemo(() => {
    const kstTime = getKSTTime();
    const currentDay = kstTime.getDay();
    const mondayOffset = currentDay === 0 ? -6 : -(currentDay - 1);
    const baseMonday = new Date(kstTime);
    baseMonday.setDate(kstTime.getDate() + mondayOffset);
    const monday = new Date(baseMonday);
    monday.setDate(baseMonday.getDate() + (currentWeekOffset * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const startDate = monday.toISOString().split('T')[0];
    const endDate = sunday.toISOString().split('T')[0];
    const weekText = `${monday.getMonth()+1}월 ${monday.getDate()}일 ~ ${sunday.getMonth()+1}월 ${sunday.getDate()}일`;
    let weekLabel = '';
    if(currentWeekOffset===0) weekLabel='이번주';
    else if(currentWeekOffset===-1) weekLabel='지난주';
    else if(currentWeekOffset===1) weekLabel='다음주';
    else if(currentWeekOffset< -1) weekLabel=`${Math.abs(currentWeekOffset)}주 전`;
    else weekLabel=`${currentWeekOffset}주 후`;
    return { start:startDate, end:endDate, weekText, weekLabel, monday, sunday };
  }, [currentWeekOffset, getKSTTime]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getKSTTime()), 1000);
    return () => clearInterval(timer);
  }, [getKSTTime]);
  
  // 🔧 주차 네비게이션 함수들 (누락된 함수들)
  const goToPreviousWeek = useCallback(() => setCurrentWeekOffset(prev => prev - 1), []);
  const goToNextWeek = useCallback(() => setCurrentWeekOffset(prev => prev + 1), []);
  const goToCurrentWeek = useCallback(() => setCurrentWeekOffset(0), []);

  // 🔔 공지사항 조회 함수
  const fetchNotifications = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('freelancer_schedule_notifications')
        .select('*')
        .eq('is_active', true)
        .or('display_locations.cs.{"weekly_view"},display_locations.cs.{"all"}')
        .order('created_at', { ascending: false })
        .limit(2);

      if (error) {
        console.error('공지사항 조회 실패:', error);
        return;
      }
      
      // 시간 필터링 (클라이언트에서)
      const filtered = (data || []).filter(notification => {
        const showFrom = notification.show_from;
        const showUntil = notification.show_until;
        
        if (showFrom && new Date(showFrom) > new Date(now)) return false;
        if (showUntil && new Date(showUntil) < new Date(now)) return false;
        
        return true;
      });
      
      console.log('🔔 공지사항 로드:', filtered);
      setNotifications(filtered);
    } catch (error) {
      console.error('공지사항 조회 실패:', error);
    }
  }, []);
  
  // 위치 로드
  const fetchLocationData = useCallback(async () => {
    try {
      const [mainLocationsResult, subLocationsResult] = await Promise.all([
        supabase.from('main_locations').select('id, name').order('name'),
        supabase.from('sub_locations').select('id, name, main_location_id').order('name')
      ]);
      if (mainLocationsResult.data) setMainLocations(mainLocationsResult.data);
      if (subLocationsResult.data) setSubLocations(subLocationsResult.data);
    } catch (error) {
      setError('위치 데이터를 불러올 수 없습니다.');
    }
  }, []);
  
  // 스케줄 로드
  const fetchWeeklySchedules = useCallback(async () => {
    if(!user||subLocations.length===0) return;
    try {
      setLoading(true); setError(null);
      // 사용자 ID 조회
      const { data:userRow, error:userError } = await supabase
        .from('users').select('id, name, role').eq('email', user.email).single();
      if(userError || !userRow) {
        setError(`사용자 정보를 찾을 수 없습니다: ${user.email}`);
        setSchedules([]); return;
      }
      const numericUserId = userRow.id;
      // 스케줄 조회
      const { data:scheduleData, error:scheduleError } = await supabase
        .from('schedules')
        .select(`id, professor_name, course_name, start_time, end_time, sub_location_id, shoot_date, team_id, assigned_shooter_id, tracking_status, is_confirmed`)
        .gte('shoot_date', weekRange.start)
        .lte('shoot_date', weekRange.end)
        .eq('assigned_shooter_id', numericUserId)
        .order('shoot_date', { ascending: true })
        .order('start_time', { ascending: true });
      if(scheduleError) {
        setError(`스케줄 조회 실패: ${scheduleError.message}`);
        setSchedules([]); return;
      }
      setSchedules(scheduleData || []);
    } catch (error) {
      setError(`스케줄 조회 중 오류가 발생했습니다: ${error}`);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [user, subLocations, weekRange]);
  
  // 🔧 권한 확인 후 데이터 로딩
  useEffect(() => {
    if (!permissionLoading && hasPermission && user) {
      const storedUserName = localStorage.getItem('userName');
      if(storedUserName) setUserName(storedUserName);
      fetchLocationData();
      fetchNotifications(); // 🔔 공지사항 로드 추가
    }
  }, [user, fetchLocationData, fetchNotifications, hasPermission, permissionLoading]);
  
  // 트리거
  useEffect(() => { fetchWeeklySchedules(); }, [fetchWeeklySchedules]);
  
  // 장소명
  const getLocationName = useCallback((subLocationId: number) => {
    const subLocation = subLocations.find(s => s.id === subLocationId);
    if(!subLocation) return '미정';
    const mainLocation = mainLocations.find(m => m.id === subLocation.main_location_id);
    const mainName = mainLocation ? mainLocation.name : '미정';
    return `${mainName} ${subLocation.name}`;
  }, [subLocations, mainLocations]);
  
  // 상태
  const getStatusInfo = useCallback((schedule: Schedule) => {
    if (!schedule.is_confirmed) return { color: '#ef4444', background: '#fef2f2', text: '미확인' };
    const statusMap: Record<string, any> = {
      'scheduled': { color: '#3b82f6', background: '#dbeafe', text: '대기중' },
      'departed': { color: '#f59e0b', background: '#fef3c7', text: '출발함' },
      'arrived': { color: '#8b5cf6', background: '#f3e8ff', text: '도착함' },
      'in_progress': { color: '#10b981', background: '#dcfce7', text: '촬영중' },
      'completed': { color: '#6b7280', background: '#f3f4f6', text: '완료' }
    };
    const status = schedule.tracking_status || 'scheduled';
    return statusMap[status] || statusMap.scheduled;
  }, []);
  
  // 스케줄 확인
  const handleConfirmSchedule = useCallback(async (scheduleId: number) => {
    setActionLoading(scheduleId);
    try {
      const kstTime = getKSTTime();
      const { error } = await supabase
        .from('schedules')
        .update({ is_confirmed:true, tracking_status:'scheduled', confirmed_at: kstTime.toISOString() })
        .eq('id', scheduleId);
      if (error) throw error;
      setSchedules(prev => prev.map(schedule => 
        schedule.id === scheduleId 
          ? { ...schedule, is_confirmed: true, tracking_status: 'scheduled' }
          : schedule
      ));
      alert('✅ 스케줄 확인 완료!');
    } catch (error) {
      alert('스케줄 확인에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  }, [getKSTTime]);
  
  // 일자별 그룹
  const schedulesByDate = useMemo(() => {
    return schedules.reduce((groups: Record<string, Schedule[]>, schedule) => {
      const dateKey = schedule.shoot_date;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(schedule);
      return groups;
    }, {});
  }, [schedules]);

  // 🔧 권한 확인 중 로딩
  if (permissionLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        gap: '16px'
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
          fontWeight: '500'
        }}>
          권한 확인 중...
        </div>
        <div style={{
          fontSize: '14px',
          color: '#9ca3af',
          textAlign: 'center'
        }}>
          스케줄 체크 페이지 접근 권한을 확인하고 있습니다.
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

  // 🔧 권한 없음
  if (!hasPermission) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          fontSize: '24px',
          color: '#ef4444',
          fontWeight: '600'
        }}>
          접근 권한이 없습니다
        </div>
        <div style={{
          fontSize: '16px',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          스케줄 체크 페이지에 접근할 권한이 없습니다.<br/>
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
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#f8fafc', padding:'20px' }}>
        <div style={{ textAlign:'center', color:'#6b7280' }}>로그인이 필요합니다.</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:'-apple-system, BlinkMacSystemFont,sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      
      {/* 🔧 일반 레이아웃 - 고정 제거 */}
      <div style={{ maxWidth:'800px', margin:'0 auto', padding:'16px' }}>
        
        {/* 🔧 페이지 헤더 - 일반 카드로 변경 */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '16px'
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize:'20px', fontWeight:'600', margin:'0 0 8px 0', color:'#1f2937' }}>
                📋 스케줄 확인 {loading && '(로딩중...)'}
              </h1>
              <div style={{ fontSize:'12px', color:'#6b7280', marginBottom:'8px' }}>
                현재 시간: {currentTime.toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false })}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap: 'wrap' }}>
                <button onClick={goToPreviousWeek}
                  style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', padding:'0 8px', color:'#6b7280' }}
                  aria-label="이전주">←</button>
                <div style={{ fontSize:'14px', color:'#374151', fontWeight:500, whiteSpace:'nowrap', minWidth:0 }}>{weekRange.weekText}</div>
                <button onClick={goToNextWeek}
                  style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', padding:'0 8px', color:'#6b7280' }}
                  aria-label="다음주">→</button>
                {currentWeekOffset !== 0 &&
                  <button onClick={goToCurrentWeek}
                    style={{marginLeft:'8px', padding:'2px 10px', background:'#3b82f6', color:'white', border:'none', borderRadius:'4px', fontSize:'12px', cursor:'pointer', height:'28px' }}>
                    이번주로
                  </button>
                }
              </div>
            </div>
            <div style={{ fontSize:'14px', color:'#6b7280' }}>{userName} PD</div>
          </div>
          
          {/* 🔧 에러 표시 */}
          {error && (
            <div style={{ padding:'12px 16px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', color:'#dc2626', fontSize:'14px' }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* 🔔 공지사항 섹션 */}
        {notifications.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px',
            border: '1px solid #f59e0b',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f59e0b',
              background: 'rgba(245, 158, 11, 0.1)'
            }}>
              <h2 style={{
                fontSize: '16px',
                fontWeight: '600',
                margin: 0,
                color: '#92400e'
              }}>
                📢 공지사항
              </h2>
            </div>
            
            <div style={{ background: 'white' }}>
              {notifications.map((notification, index) => (
                <div
                  key={notification.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: index < notifications.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '8px'
                  }}>
                    {notification.title}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#64748b',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line'
                  }}>
                    {notification.content}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    marginTop: '6px'
                  }}>
                    {new Date(notification.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 통계 카드 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'16px', marginBottom:'16px' }}>
          <div style={{ background:'white', padding:'20px', borderRadius:'12px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize:'28px', fontWeight:'700', color:'#1f2937', marginBottom:'8px' }}>{schedules.length}</div>
            <div style={{ fontSize:'14px', color:'#6b7280' }}>전체 스케줄</div>
          </div>
          <div style={{ background:'white', padding:'20px', borderRadius:'12px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize:'28px', fontWeight:'700', color:'#ef4444', marginBottom:'8px' }}>{schedules.filter(s=>!s.is_confirmed).length}</div>
            <div style={{ fontSize:'14px', color:'#6b7280' }}>미확인</div>
          </div>
        </div>
        
        {/* 새로고침 버튼 */}
        <div style={{ marginBottom:'16px', textAlign:'center' }}>
          <button onClick={fetchWeeklySchedules} disabled={loading}
            style={{ background:loading?'#9ca3af':'#10b981', color:'white', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'14px', cursor:loading?'not-allowed':'pointer', transition:'all 0.2s ease' }}>
            {loading?'새로고침 중...':'🔄 스케줄 새로고침'}
          </button>
        </div>
        
        {/* 스케줄 리스트 */}
        <div style={{ background:'white', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:'40px 20px', textAlign:'center', color:'#6b7280' }}>
              <div style={{ width:'32px', height:'32px', border:'3px solid #e5e7eb', borderTop:'3px solid #3b82f6', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}></div>
              스케줄을 불러오는 중...
            </div>
          ) : error ? (
            <div style={{ padding:'60px 20px', textAlign:'center', color:'#dc2626' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>⚠️</div>
              <div style={{ fontSize:'16px', marginBottom:'8px' }}>스케줄을 불러올 수 없습니다</div>
              <div style={{ fontSize:'14px', color:'#6b7280' }}>새로고침 버튼을 눌러보세요</div>
            </div>
          ) : schedules.length===0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center', color:'#6b7280' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>📅</div>
              <div style={{ fontSize:'16px', marginBottom:'4px' }}>{weekRange.weekLabel}에 촬영 일정이 없습니다</div>
              <div style={{ fontSize:'14px' }}>다른 주를 확인해보세요 😊</div>
            </div>
          ) : (
            <div>
              {Object.entries(schedulesByDate).map(([date, daySchedules], dateIndex) => (
                <div key={date}>
                  <div style={{ padding:'16px 20px 12px', background:'#f8fafc', borderBottom:'1px solid #e5e7eb', borderTop:dateIndex>0?'1px solid #e5e7eb':'none' }}>
                    <h3 style={{ fontSize:'16px', fontWeight:'600', margin:0, color:'#374151' }}>
                      {(() => {
                        const scheduleDate = new Date(date+'T12:00:00+09:00');
                        return scheduleDate.toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'long', timeZone:'Asia/Seoul' });
                      })()} ({daySchedules.length}건)
                    </h3>
                  </div>
                  {daySchedules.map((schedule, index) => {
                    const statusInfo = getStatusInfo(schedule);
                    const isActionLoading = actionLoading === schedule.id;
                    const isConfirmed = schedule.is_confirmed;
                    return (
                      <div key={schedule.id}
                        style={{ padding:'20px', borderBottom:index<daySchedules.length-1?'1px solid #f3f4f6':'none', borderLeft:`4px solid ${statusInfo.color}`, background:index%2===0?'white':'#fafbfc' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:'16px', fontWeight:'600', color:'#1f2937', marginBottom:'6px' }}>
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <span style={{ background:statusInfo.background, color:statusInfo.color, padding:'4px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'600' }}>{statusInfo.text}</span>
                              <span style={{ background:'#e0f2fe', color:'#0369a1', padding:'2px 6px', borderRadius:'6px', fontSize:'10px', fontWeight:'500' }}>#{schedule.id}</span>
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button
                              onClick={() => !isConfirmed && handleConfirmSchedule(schedule.id)}
                              disabled={isConfirmed||isActionLoading}
                              style={{
                                background:isConfirmed?'#6b7280':'#10b981',
                                color:'white', border:'none', padding:'8px 16px', borderRadius:'8px',
                                fontSize:'13px', fontWeight:'600',
                                cursor:isConfirmed?'not-allowed':(isActionLoading?'not-allowed':'pointer'),
                                opacity:isConfirmed?0.7:(isActionLoading?0.6:1),
                                transition:'all 0.2s ease'
                              }}
                            >
                              {isActionLoading ? '확인중...' : isConfirmed ? '✓ 확인완료' : '확인'}
                            </button>
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'8px', fontSize:'14px', color:'#4b5563' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                            <div><span style={{ fontWeight:'500', color:'#374151' }}>강사: </span>{schedule.professor_name||'미정'}</div>
                            <div><span style={{ fontWeight:'500', color:'#374151' }}>강의명: </span>{schedule.course_name||'미정'}</div>
                          </div>
                          <div><span style={{ fontWeight:'500', color:'#374151' }}>장소: </span>{getLocationName(schedule.sub_location_id)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 하단 네비게이션 */}
        <div style={{ marginTop:'20px', padding:'0 4px' }}>
          <button
            onClick={() => router.push('/shooter/ShooterDashboard')}
            style={{ width:'100%', background:'#3b82f6', color:'white', border:'none', padding:'14px', borderRadius:'8px', fontSize:'16px', fontWeight:'500', cursor:'pointer', transition:'all 0.2s ease' }}>
            대시보드로 이동
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        button:hover:not(:disabled) { transform: translateY(-1px); opacity:0.9;}
      `}</style>
    </div>
  );
};

export default ScheduleCheck;

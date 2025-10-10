// pages/admin/index.tsx - 아이콘 제거 + 모바일 최적화 완성 버전
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

interface Stats {
  academySchedules: number;
  studioSchedules: number;
  studioUsage: number;
  shootingPeople: number;
  academyPending: number;
  studioPending: number;
  internal: number;
  academyHours: string;
  studioHours: string;
  totalUsedHours: string;
  totalAvailableHours: number;
  academyPeople: number;
  studioPeople: number;
}

interface TodayTask {
  id: number;
  schedule_type: string;
  content: string;
  shadow_color: string;
}

interface PendingItem {
  id: string;
  type: 'academy' | 'studio';
  title: string;
  date: string;
  originalId: number;
}

export default function AdminDashboard(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [stats, setStats] = useState<Stats>({
    academySchedules: 0, studioSchedules: 0, studioUsage: 0, 
    shootingPeople: 0, academyPending: 0, studioPending: 0, internal: 0,
    academyHours: '0.0', studioHours: '0.0', totalUsedHours: '0.0',
    totalAvailableHours: 150, academyPeople: 0, studioPeople: 0
  });
  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([]);
  const [pendingList, setPendingList] = useState<PendingItem[]>([]);
  const router = useRouter();

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    checkAuth();
    loadDashboardData();
  }, []);

  const checkAuth = () => {
    const userRole = localStorage.getItem('userRole');
    if (!['system_admin', 'admin', 'schedule_admin'].includes(userRole || '')) {
      alert('관리자 권한이 필요합니다.');
      router.push('/');
      return;
    }
    setLoading(false);
  };

  // 안전한 시간 계산 헬퍼 함수
  const safeCalculateDuration = (startTime: string, endTime: string): number => {
    try {
      if (!startTime || !endTime) return 0;
      
      const [startHour, startMinute] = startTime.split(':').map(n => parseInt(n) || 0);
      const [endHour, endMinute] = endTime.split(':').map(n => parseInt(n) || 0);
      
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      const durationMinutes = endTotalMinutes - startTotalMinutes;
      
      const durationHours = durationMinutes / 60;
      return durationHours > 0 ? durationHours : 0;
    } catch (error) {
      console.error('시간 계산 오류:', { startTime, endTime, error });
      return 0;
    }
  };

  // 카운팅 함수
  const getScheduleCountWithShooters = async (today: string) => {
    try {
      // 학원 스케줄
      const { data: academyData } = await supabase
        .from('schedules')
        .select('id, assigned_shooter_id, shoot_date, professor_name, start_time, end_time, sub_location_id, schedule_type')
        .eq('shoot_date', today)
        .not('assigned_shooter_id', 'is', null)
        .eq('schedule_type', 'academy');
      
      // 학원 총 시간 계산
      let academyTotalHours = 0;
      academyData?.forEach(schedule => {
        const duration = safeCalculateDuration(schedule.start_time, schedule.end_time);
        if (duration > 0) {
          academyTotalHours += duration;
        }
      });
      
      // 스튜디오 스케줄
      const { data: studioData } = await supabase
        .from('schedules')
        .select('id, assigned_shooter_id, shoot_date, professor_name, course_name, schedule_type, start_time, end_time')
        .eq('shoot_date', today)
        .not('assigned_shooter_id', 'is', null)
        .eq('schedule_type', 'studio');
      
      // 스튜디오 총 시간 계산
      let studioTotalHours = 0;
      studioData?.forEach(schedule => {
        const duration = safeCalculateDuration(schedule.start_time, schedule.end_time);
        if (duration > 0) {
          studioTotalHours += duration;
        }
      });
      
      return {
        academyCount: academyData?.length || 0,
        studioCount: studioData?.length || 0,
        academyHours: academyTotalHours.toFixed(1),
        studioHours: studioTotalHours.toFixed(1),
        totalUsedHours: (academyTotalHours + studioTotalHours).toFixed(1),
        academyData,
        studioData
      };
      
    } catch (error) {
      console.error('카운팅 오류:', error);
      return {
        academyCount: 0,
        studioCount: 0,
        academyHours: '0.0',
        studioHours: '0.0',
        totalUsedHours: '0.0',
        academyData: [],
        studioData: []
      };
    }
  };

  const calculateStudioUsageRate = (totalUsedHours: string) => {
    try {
      const operatingHours = 10;
      const studioCount = 15;
      const totalAvailableHours = operatingHours * studioCount;
      
      const usedHours = parseFloat(totalUsedHours) || 0;
      const usageRate = Math.round((usedHours / totalAvailableHours) * 100);
      const finalRate = Math.min(usageRate, 100);
      
      return {
        rate: finalRate,
        totalAvailable: totalAvailableHours,
        totalUsed: usedHours
      };
    } catch (error) {
      return {
        rate: 0,
        totalAvailable: 150,
        totalUsed: 0
      };
    }
  };

  const getShootingPeopleCount = (academyData: any[], studioData: any[]) => {
    try {
      const academyPeople = academyData?.length || 0;
      const studioPeople = studioData?.length || 0;
      
      return {
        academyPeople,
        studioPeople,
        totalPeople: academyPeople + studioPeople
      };
    } catch (error) {
      return {
        academyPeople: 0,
        studioPeople: 0,
        totalPeople: 0
      };
    }
  };

  const getPendingApprovalList = async (): Promise<PendingItem[]> => {
    try {
      const academyPending = await supabase
        .from('schedules')
        .select('id, professor_name, shoot_date, sub_location_id')
        .eq('approval_status', 'pending')
        .eq('schedule_type', 'academy')
        .limit(5);

      const studioPending = await supabase
        .from('schedules')
        .select('id, professor_name, course_name, shoot_date')
        .eq('approval_status', 'pending')
        .eq('schedule_type', 'studio')
        .limit(5);

      const combined: PendingItem[] = [];
      
      if (academyPending.data) {
        academyPending.data.forEach(item => {
          combined.push({
            id: `academy_${item.id}`,
            type: 'academy',
            title: `${item.professor_name} - 스튜디오 ${item.sub_location_id}`,
            date: item.shoot_date,
            originalId: item.id
          });
        });
      }

      if (studioPending.data) {
        studioPending.data.forEach(item => {
          combined.push({
            id: `studio_${item.id}`,
            type: 'studio', 
            title: `${item.professor_name} - ${item.course_name}`,
            date: item.shoot_date,
            originalId: item.id
          });
        });
      }

      return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      return [];
    }
  };

  const loadDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // 내부업무
      const { data: internalData } = await supabase
        .from('internal_schedules')
        .select('*')
        .eq('schedule_date', today)
        .eq('is_active', true);

      // 스케줄 카운팅
      const scheduleCount = await getScheduleCountWithShooters(today);
      
      // 스튜디오 사용률 계산
      const usageData = calculateStudioUsageRate(scheduleCount.totalUsedHours);
      
      // 촬영 인원 계산
      const peopleData = getShootingPeopleCount(scheduleCount.academyData, scheduleCount.studioData);
      
      // 승인 대기
      const pendingData = await getPendingApprovalList();
      
      setTodayTasks(internalData || []);
      setStats({
        academySchedules: scheduleCount.academyCount,
        studioSchedules: scheduleCount.studioCount,
        shootingPeople: peopleData.totalPeople,
        academyHours: scheduleCount.academyHours,
        studioHours: scheduleCount.studioHours,
        totalUsedHours: scheduleCount.totalUsedHours,
        totalAvailableHours: usageData.totalAvailable,
        academyPeople: peopleData.academyPeople,
        studioPeople: peopleData.studioPeople,
        studioUsage: usageData.rate,
        academyPending: 0,
        studioPending: 0,
        internal: internalData?.length || 0
      });
      setPendingList(pendingData);

    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    }
  };

  const handleStatCardClick = (type: string) => {
    switch (type) {
      case 'academy':
        router.push('/academy-schedules');
        break;
      case 'studio':
        router.push('/studio-admin');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: isMobile ? '16px' : '20px'
    }}>
      <div className="admin-dashboard">
        {/* 헤더 */}
        <div className="header">
          <div className="header-content">
            <h1>관리자 대시보드</h1>
            <span className="date">
              {new Date().toLocaleDateString('ko-KR', { 
                month: isMobile ? 'short' : 'long', 
                day: 'numeric', 
                weekday: 'short'
              })}
            </span>
          </div>
        </div>

        {/* 📱 아이콘 제거한 깔끔한 통계 카드 */}
        <div className="stats-row">
          {/* 학원 촬영 카드 */}
          <div 
            className="stat-card academy clickable"
            onClick={() => handleStatCardClick('academy')}
          >
            <div className="stat-content">
              <div className="stat-number">{stats.academySchedules}</div>
              <div className="stat-label">{isMobile ? '학원' : '학원 촬영'}</div>
              {isMobile ? (
                <div className="stat-hours">{stats.academyHours}h</div>
              ) : (
                <div className="stat-details">
                  <div className="stat-time">{stats.academyHours}시간</div>
                  <div className="stat-link">학원 스케줄로 이동 →</div>
                </div>
              )}
            </div>
          </div>

          {/* 스튜디오 촬영 카드 */}
          <div 
            className="stat-card studio clickable"
            onClick={() => handleStatCardClick('studio')}
          >
            <div className="stat-content">
              <div className="stat-number">{stats.studioSchedules}</div>
              <div className="stat-label">{isMobile ? '스튜디오' : '스튜디오 촬영'}</div>
              {isMobile ? (
                <div className="stat-hours">{stats.studioHours}h</div>
              ) : (
                <div className="stat-details">
                  <div className="stat-time">{stats.studioHours}시간</div>
                  <div className="stat-link">스튜디오 스케줄로 이동 →</div>
                </div>
              )}
            </div>
          </div>

          {/* 스튜디오 사용률 */}
          <div className="stat-card usage">
            <div className="stat-content">
              <div className="stat-number">{stats.studioUsage}%</div>
              <div className="stat-label">{isMobile ? '스튜디오 사용률' : '스튜디오 사용률'}</div>
              {isMobile ? (
                <div className="stat-hours">{stats.totalUsedHours}/{stats.totalAvailableHours}h</div>
              ) : (
                <div className="stat-details">
                  <div className="usage-detail">
                    {stats.totalUsedHours}시간 / {stats.totalAvailableHours}시간
                  </div>
                  <div className="stat-description">15개 스튜디오 기준</div>
                </div>
              )}
            </div>
          </div>

          {/* 촬영 인원 */}
          <div className="stat-card people">
            <div className="stat-content">
              <div className="stat-number">{stats.shootingPeople}명</div>
              <div className="stat-label">{isMobile ? '촬영인원' : '촬영 인원'}</div>
              {isMobile ? (
                <div className="stat-hours">학원{stats.academyPeople} · 스튜디오{stats.studioPeople}</div>
              ) : (
                <div className="stat-details">
                  <div className="people-detail">
                    학원 {stats.academyPeople}명 · 스튜디오 {stats.studioPeople}명
                  </div>
                  <div className="stat-description">오늘 배치된 전체 인원</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="main-content">
          {/* 승인 대기 목록 */}
          <div className="panel">
            <h3>승인 대기 목록</h3>
            {pendingList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>승인 대기 건이 없습니다.</p>
              </div>
            ) : (
              <div className="approval-list">
                {pendingList.map(item => (
                  <div key={item.id} className={`approval-item ${item.type}`}>
                    <div className="approval-type">
                      {item.type === 'academy' ? (isMobile ? '학원' : '🎓 학원') : (isMobile ? '스튜디오' : '🏢 스튜디오')}
                    </div>
                    <div className="approval-content">
                      <div className="approval-title">{item.title}</div>
                      <div className="approval-date">{item.date}</div>
                    </div>
                    <button 
                      className="approve-btn"
                      onClick={() => {
                        if (item.type === 'academy') {
                          router.push('/academy-schedules');
                        } else {
                          router.push('/studio-admin');
                        }
                      }}
                    >
                      {isMobile ? '관리' : (item.type === 'academy' ? '학원 관리' : '스튜디오 관리')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 오늘의 내부업무 */}
          <div className="panel">
            <div className="panel-header">
              <h3>📅 내부업무 ({stats.internal}건)</h3>
              <button 
                className="link-btn"
                onClick={() => router.push('/internal-schedules')}
              >
                {isMobile ? '전체' : '전체보기'} →
              </button>
            </div>
            {todayTasks.length === 0 ? (
              <div className="empty-state small">
                <p>{isMobile ? '내부업무가 없습니다.' : '오늘 예정된 내부업무가 없습니다.'}</p>
              </div>
            ) : (
              <div className="task-list compact">
                {todayTasks.slice(0, 4).map(task => (
                  <div key={task.id} className="task-item">
                    <div 
                      className="task-dot"
                      style={{ backgroundColor: task.shadow_color || '#666' }}
                    />
                    <div className="task-info">
                      <span className="task-type">{task.schedule_type}</span>
                      <span className="task-content">{task.content || '내용 없음'}</span>
                    </div>
                  </div>
                ))}
                {todayTasks.length > 4 && (
                  <div className="more-tasks">+{todayTasks.length - 4}개 더</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 📱 아이콘 제거한 깔끔한 CSS */}
      <style jsx global>{`
        .admin-dashboard {
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: ${isMobile ? '20px' : '24px'};
          padding-bottom: ${isMobile ? '12px' : '16px'};
          border-bottom: 2px solid #e9ecef;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          ${isMobile ? 'flex-direction: column; gap: 8px; text-align: center;' : ''}
        }

        .header h1 {
          font-size: ${isMobile ? '22px' : '28px'};
          font-weight: 700;
          color: #2c3e50;
          margin: 0;
        }

        .date {
          color: #6c757d;
          font-size: ${isMobile ? '13px' : '14px'};
          font-weight: 500;
        }

        .stats-row {
          display: grid;
          grid-template-columns: ${isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(280px, 1fr))'};
          gap: ${isMobile ? '12px' : '20px'};
          margin-bottom: ${isMobile ? '24px' : '32px'};
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: ${isMobile ? '20px' : '24px'};
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid var(--color);
          transition: all 0.2s ease;
          cursor: pointer;
          text-align: center;
          ${isMobile ? 'min-height: 110px; display: flex; align-items: center; justify-content: center;' : ''}
        }

        .stat-card:hover {
          transform: ${isMobile ? 'scale(0.98)' : 'translateY(-4px)'};
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .stat-card:active {
          transform: scale(0.95);
        }

        .stat-card.academy { --color: #007bff; }
        .stat-card.studio { --color: #28a745; }
        .stat-card.usage { --color: #17a2b8; }
        .stat-card.people { --color: #ffc107; }

        .stat-content {
          width: 100%;
        }

        .stat-number {
          font-size: ${isMobile ? '32px' : '28px'};
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: ${isMobile ? '8px' : '6px'};
          line-height: 1;
        }

        .stat-label {
          color: #6c757d;
          font-size: ${isMobile ? '14px' : '15px'};
          font-weight: 600;
          line-height: 1;
          margin-bottom: ${isMobile ? '8px' : '8px'};
        }

        .stat-hours {
          font-size: ${isMobile ? '12px' : '12px'};
          color: var(--color);
          font-weight: 600;
          background: rgba(var(--color-rgb), 0.1);
          padding: 4px 8px;
          border-radius: 12px;
          display: inline-block;
        }

        .stat-details {
          ${isMobile ? 'display: none;' : 'margin-top: 8px;'}
        }

        .stat-time {
          font-size: 12px;
          color: var(--color);
          font-weight: 600;
          margin-bottom: 4px;
        }

        .usage-detail, .people-detail {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 500;
          margin-bottom: 2px;
        }

        .stat-link {
          font-size: 11px;
          color: var(--color);
          font-weight: 600;
          opacity: 0.8;
        }

        .stat-description {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 500;
        }

        .stat-card.academy { --color-rgb: 0, 123, 255; }
        .stat-card.studio { --color-rgb: 40, 167, 69; }
        .stat-card.usage { --color-rgb: 23, 162, 184; }
        .stat-card.people { --color-rgb: 255, 193, 7; }

        .main-content {
          display: grid;
          grid-template-columns: ${isMobile ? '1fr' : '2fr 1fr'};
          gap: ${isMobile ? '16px' : '24px'};
        }

        .panel {
          background: white;
          border-radius: ${isMobile ? '8px' : '12px'};
          padding: ${isMobile ? '16px' : '24px'};
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .panel h3 {
          margin: 0 0 ${isMobile ? '16px' : '20px'} 0;
          font-size: ${isMobile ? '16px' : '18px'};
          font-weight: 600;
          color: #2c3e50;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${isMobile ? '16px' : '20px'};
        }

        .link-btn {
          background: none;
          border: none;
          color: #007bff;
          cursor: pointer;
          font-size: ${isMobile ? '13px' : '14px'};
          font-weight: 500;
          transition: color 0.2s ease;
          padding: ${isMobile ? '4px 8px' : '0'};
        }

        .approval-list {
          display: flex;
          flex-direction: column;
          gap: ${isMobile ? '8px' : '12px'};
        }

        .approval-item {
          display: flex;
          align-items: center;
          gap: ${isMobile ? '8px' : '16px'};
          padding: ${isMobile ? '12px' : '16px'};
          background: #f8f9fa;
          border-radius: ${isMobile ? '6px' : '8px'};
          border-left: 4px solid var(--type-color);
          transition: all 0.2s ease;
        }

        .approval-item.academy { --type-color: #007bff; }
        .approval-item.studio { --type-color: #28a745; }

        .approval-type {
          font-size: ${isMobile ? '12px' : '13px'};
          font-weight: 600;
          color: var(--type-color);
          min-width: ${isMobile ? '50px' : '70px'};
          flex-shrink: 0;
        }

        .approval-content {
          flex: 1;
          min-width: 0;
        }

        .approval-title {
          font-weight: 500;
          color: #2c3e50;
          margin-bottom: 3px;
          font-size: ${isMobile ? '13px' : '14px'};
          line-height: 1.3;
        }

        .approval-date {
          font-size: ${isMobile ? '11px' : '12px'};
          color: #6c757d;
        }

        .approve-btn {
          background: var(--type-color);
          color: white;
          border: none;
          padding: ${isMobile ? '6px 12px' : '8px 16px'};
          border-radius: ${isMobile ? '4px' : '6px'};
          cursor: pointer;
          font-size: ${isMobile ? '11px' : '12px'};
          font-weight: 500;
          white-space: nowrap;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .task-list.compact {
          display: flex;
          flex-direction: column;
          gap: ${isMobile ? '8px' : '12px'};
        }

        .task-item {
          display: flex;
          align-items: center;
          gap: ${isMobile ? '8px' : '12px'};
          padding: ${isMobile ? '8px 0' : '12px 0'};
          border-bottom: 1px solid #f3f4f6;
        }

        .task-dot {
          width: ${isMobile ? '8px' : '10px'};
          height: ${isMobile ? '8px' : '10px'};
          border-radius: 50%;
          flex-shrink: 0;
        }

        .task-type {
          font-size: ${isMobile ? '10px' : '12px'};
          font-weight: 600;
          color: #495057;
          background: #e9ecef;
          padding: ${isMobile ? '1px 6px' : '2px 8px'};
          border-radius: ${isMobile ? '8px' : '12px'};
          margin-right: ${isMobile ? '6px' : '8px'};
        }

        .task-content {
          font-size: ${isMobile ? '12px' : '14px'};
          color: #6c757d;
          line-height: 1.4;
        }

        .empty-state {
          text-align: center;
          padding: ${isMobile ? '32px 16px' : '48px 20px'};
          color: #6c757d;
        }

        .empty-state.small {
          padding: ${isMobile ? '20px' : '24px'};
        }

        .empty-icon {
          font-size: ${isMobile ? '32px' : '48px'};
          margin-bottom: ${isMobile ? '12px' : '16px'};
        }

        /* 매우 작은 모바일 최적화 */
        @media (max-width: 480px) {
          .stats-row {
            gap: 10px;
          }
          
          .stat-card {
            padding: 16px;
            min-height: 100px;
          }
          
          .stat-number {
            font-size: 28px;
          }
          
          .stat-label {
            font-size: 13px;
          }
          
          .stat-hours {
            font-size: 11px;
          }
        }

        @media (max-width: 360px) {
          .stat-card {
            padding: 14px;
            min-height: 95px;
          }
          
          .stat-number {
            font-size: 26px;
          }
          
          .stat-label {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}

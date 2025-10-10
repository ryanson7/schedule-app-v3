// pages/admin/summary.tsx (요청사항 반영한 최종 버전)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

interface ShooterStat {
  id: number;
  name: string;
  employmentType: string;
  shooterType: string;
  totalAssignments: number;
  totalHours: number;
  hourlyRate: number;
  specialties: string[];
}

interface EmploymentTypeStat {
  type: string;
  typeName: string;
  count: number;
  totalHours: number;
  averageHours: number;
  activeCount: number;
}

interface AcademyStat {
  academyId: number;
  academyName: string;
  totalBookings: number;
  totalHours: number;
}

interface SummaryData {
  shooterStats: {
    byEmploymentType: EmploymentTypeStat[];
    topPerformers: ShooterStat[];
    totalShooters: number;
  };
  academyStats: {
    byAcademy: AcademyStat[];
    totalAcademies: number;
  };
  overallKPIs: {
    totalShooters: number; // 교수 제외된 촬영자만
    totalSchedules: number; // 임시저장 제외, 승인+취소만
    totalApprovedSchedules: number;
    totalCancelledSchedules: number;
    totalHours: number;
  };
}

const Summary: React.FC = () => {
  const [data, setData] = useState<SummaryData>({
    shooterStats: {
      byEmploymentType: [],
      topPerformers: [],
      totalShooters: 0
    },
    academyStats: {
      byAcademy: [],
      totalAcademies: 0
    },
    overallKPIs: {
      totalShooters: 0,
      totalSchedules: 0,
      totalApprovedSchedules: 0,
      totalCancelledSchedules: 0,
      totalHours: 0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filteredData, setFilteredData] = useState<SummaryData>(data);
  const router = useRouter();

  useEffect(() => {
    loadSummaryData();
  }, [selectedTimeRange, customStartDate, customEndDate]);

  useEffect(() => {
    filterData();
  }, [searchTerm, data]);

  // 검색 필터링
  const filterData = () => {
    if (!searchTerm.trim()) {
      setFilteredData(data);
      return;
    }

    const term = searchTerm.toLowerCase();
    
    const filteredShooters = data.shooterStats.topPerformers.filter(
      shooter => shooter.name.toLowerCase().includes(term) ||
      shooter.employmentType.toLowerCase().includes(term)
    );

    const filteredAcademies = data.academyStats.byAcademy.filter(
      academy => academy.academyName.toLowerCase().includes(term)
    );

    setFilteredData({
      ...data,
      shooterStats: {
        ...data.shooterStats,
        topPerformers: filteredShooters
      },
      academyStats: {
        ...data.academyStats,
        byAcademy: filteredAcademies
      }
    });
  };

  // 전체 요약 데이터 로딩
  const loadSummaryData = async () => {
    try {
      setLoading(true);
      
      const dateFilter = getDateFilter();
      
      const [
        employmentTypeStats,
        topPerformersData,
        academyStatsData,
        overallKPIsData
      ] = await Promise.all([
        getEmploymentTypeStats(dateFilter),
        getTopPerformers(dateFilter),
        getAcademyStats(dateFilter),
        getOverallKPIs(dateFilter)
      ]);

      const newData = {
        shooterStats: {
          byEmploymentType: employmentTypeStats,
          topPerformers: topPerformersData,
          totalShooters: employmentTypeStats.reduce((sum, stat) => sum + stat.count, 0)
        },
        academyStats: {
          byAcademy: academyStatsData,
          totalAcademies: academyStatsData.length
        },
        overallKPIs: overallKPIsData
      };

      setData(newData);

    } catch (error) {
      console.error('Summary 데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 직원 유형별 통계 (교수 제외)
  const getEmploymentTypeStats = async (dateFilter: { start: string; end: string }): Promise<EmploymentTypeStat[]> => {
    const { data: scheduleData, error } = await supabase
      .from('schedules')
      .select(`
        assigned_shooter_id,
        start_time,
        end_time,
        users!inner(
          id,
          name,
          employment_type,
          role,
          is_active
        )
      `)
      .gte('shoot_date', dateFilter.start)
      .lte('shoot_date', dateFilter.end)
      .in('approval_status', ['approved', 'cancelled']) // 임시저장 제외
      .not('assigned_shooter_id', 'is', null);

    if (error || !scheduleData) {
      console.error('직원 유형별 통계 오류:', error);
      return [];
    }

    // 교수 제외 필터링
    const filteredData = scheduleData.filter(schedule => {
      const user = schedule.users;
      return user.role !== 'professor' && user.employment_type; // role이 professor가 아니고 employment_type이 있는 경우만
    });

    // 직원 유형 한글명 매핑
    const typeNameMap: { [key: string]: string } = {
      'full_time': '정규직',
      'dispatched': '파견직',
      'freelancer': '프리랜서',
      'contract': '계약직',
      'employee': '직원'
    };

    const statsMap = new Map<string, EmploymentTypeStat>();

    filteredData.forEach(schedule => {
      const user = schedule.users;
      const type = user.employment_type || 'unknown';
      
      if (!statsMap.has(type)) {
        statsMap.set(type, {
          type,
          typeName: typeNameMap[type] || type,
          count: 0,
          totalHours: 0,
          averageHours: 0,
          activeCount: 0
        });
      }

      const stat = statsMap.get(type)!;
      stat.count++;
      if (user.is_active) stat.activeCount++;

      const hours = calculateHours(schedule.start_time, schedule.end_time);
      stat.totalHours += hours;
    });

    return Array.from(statsMap.values()).map(stat => ({
      ...stat,
      averageHours: stat.count > 0 ? Math.round(stat.totalHours / stat.count * 10) / 10 : 0
    }));
  };

  // 상위 성과자 조회 (교수 제외)
  const getTopPerformers = async (dateFilter: { start: string; end: string }): Promise<ShooterStat[]> => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        assigned_shooter_id,
        start_time,
        end_time,
        users!inner(
          id,
          name,
          employment_type,
          shooter_type,
          hourly_rate,
          specialties,
          role
        )
      `)
      .gte('shoot_date', dateFilter.start)
      .lte('shoot_date', dateFilter.end)
      .in('approval_status', ['approved', 'cancelled'])
      .not('assigned_shooter_id', 'is', null);

    if (error || !data) {
      console.error('상위 성과자 조회 오류:', error);
      return [];
    }

    // 교수 제외 필터링
    const filteredData = data.filter(schedule => 
      schedule.users.role !== 'professor' && schedule.users.employment_type
    );

    // 촬영자별 집계
    const shooterMap = new Map<number, ShooterStat>();

    filteredData.forEach(schedule => {
      const user = schedule.users;
      const shooterId = user.id;

      if (!shooterMap.has(shooterId)) {
        shooterMap.set(shooterId, {
          id: shooterId,
          name: user.name,
          employmentType: user.employment_type || 'Unknown',
          shooterType: user.shooter_type || 'Unknown',
          totalAssignments: 0,
          totalHours: 0,
          hourlyRate: user.hourly_rate || 0,
          specialties: user.specialties || []
        });
      }

      const shooter = shooterMap.get(shooterId)!;
      shooter.totalAssignments++;
      shooter.totalHours += calculateHours(schedule.start_time, schedule.end_time);
    });

    return Array.from(shooterMap.values())
      .sort((a, b) => b.totalAssignments - a.totalAssignments)
      .slice(0, 10);
  };

  // 학원별 통계 (건수와 시간만)
  const getAcademyStats = async (dateFilter: { start: string; end: string }): Promise<AcademyStat[]> => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        schedule_type,
        start_time,
        end_time
      `)
      .gte('shoot_date', dateFilter.start)
      .lte('shoot_date', dateFilter.end)
      .in('approval_status', ['approved', 'cancelled'])
      .not('assigned_shooter_id', 'is', null);

    if (error || !data) {
      console.error('학원별 통계 오류:', error);
      return [];
    }

    const academyMap = new Map<string, AcademyStat>();

    data.forEach(schedule => {
      const academyType = schedule.schedule_type || 'Unknown';
      
      if (!academyMap.has(academyType)) {
        academyMap.set(academyType, {
          academyId: academyMap.size + 1,
          academyName: academyType === 'academy' ? '학원' : academyType === 'studio' ? '스튜디오' : academyType,
          totalBookings: 0,
          totalHours: 0
        });
      }

      const academy = academyMap.get(academyType)!;
      academy.totalBookings++;
      academy.totalHours += calculateHours(schedule.start_time, schedule.end_time);
    });

    return Array.from(academyMap.values())
      .sort((a, b) => b.totalBookings - a.totalBookings);
  };

  // 전체 KPI 계산 (교수 제외 + 임시저장 제외)
  const getOverallKPIs = async (dateFilter: { start: string; end: string }) => {
    const [shootersResult, schedulesResult, approvedSchedulesResult, cancelledSchedulesResult] = await Promise.all([
      // 촬영자 수 (교수 제외, employment_type이 있는 활성 사용자)
      supabase
        .from('users')
        .select('id', { count: 'exact' })
        .not('employment_type', 'is', null)
        .neq('role', 'professor') // 교수 제외
        .eq('is_active', true),
      
      // 전체 스케줄 (임시저장 제외, 승인+취소만)
      supabase
        .from('schedules')
        .select('id', { count: 'exact' })
        .gte('shoot_date', dateFilter.start)
        .lte('shoot_date', dateFilter.end)
        .in('approval_status', ['approved', 'cancelled']), // 임시저장 제외
      
      // 승인된 스케줄
      supabase
        .from('schedules')
        .select('start_time, end_time')
        .gte('shoot_date', dateFilter.start)
        .lte('shoot_date', dateFilter.end)
        .eq('approval_status', 'approved')
        .not('assigned_shooter_id', 'is', null),
      
      // 취소된 스케줄
      supabase
        .from('schedules')
        .select('id', { count: 'exact' })
        .gte('shoot_date', dateFilter.start)
        .lte('shoot_date', dateFilter.end)
        .eq('approval_status', 'cancelled')
    ]);

    const totalShooters = shootersResult.count || 0;
    const totalSchedules = schedulesResult.count || 0;
    const approvedSchedules = approvedSchedulesResult.data || [];
    const totalCancelledSchedules = cancelledSchedulesResult.count || 0;
    
    const totalHours = approvedSchedules.reduce((sum, s) => 
      sum + calculateHours(s.start_time, s.end_time), 0
    );

    return {
      totalShooters,
      totalSchedules, // 임시저장 제외된 스케줄 수
      totalApprovedSchedules: approvedSchedules.length,
      totalCancelledSchedules,
      totalHours: Math.round(totalHours * 10) / 10
    };
  };

  // 헬퍼 함수들
  const calculateHours = (startTime: string | null, endTime: string | null): number => {
    if (!startTime || !endTime) return 0;
    
    try {
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    } catch {
      return 0;
    }
  };

  const getDateFilter = () => {
    const today = new Date();
    
    switch (selectedTimeRange) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        return { start: todayStr, end: todayStr };
      case 'week':
        const weekAgo = new Date(today.getTime() - 6*24*60*60*1000);
        return {
          start: weekAgo.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      case 'month':
        const monthAgo = new Date(today.getTime() - 29*24*60*60*1000);
        return {
          start: monthAgo.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
      case 'custom':
        return {
          start: customStartDate || today.toISOString().split('T')[0],
          end: customEndDate || today.toISOString().split('T')[0]
        };
    }
  };

  const handlePeriodChange = (period: 'today' | 'week' | 'month' | 'custom') => {
    setSelectedTimeRange(period);
    if (period !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const isCustomDateValid = (): boolean => {
    if (selectedTimeRange !== 'custom') return true;
    return customStartDate && customEndDate && customStartDate <= customEndDate;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>통합 요약 데이터 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="summary-dashboard">
      {/* 헤더 */}
      <div className="dashboard-header">
        <h1>통합 요약 대시보드</h1>
        <div className="header-controls">
          {/* 검색 기능 */}
          <div className="search-container">
            <input
              type="text"
              placeholder="이름, 유형, 학원명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          {/* 기간 선택 */}
          <div className="time-range-controls">
            <div className="time-range-selector">
              <button 
                className={selectedTimeRange === 'today' ? 'active' : ''}
                onClick={() => handlePeriodChange('today')}
              >
                오늘
              </button>
              <button 
                className={selectedTimeRange === 'week' ? 'active' : ''}
                onClick={() => handlePeriodChange('week')}
              >
                7일
              </button>
              <button 
                className={selectedTimeRange === 'month' ? 'active' : ''}
                onClick={() => handlePeriodChange('month')}
              >
                30일
              </button>
              <button 
                className={selectedTimeRange === 'custom' ? 'active' : ''}
                onClick={() => handlePeriodChange('custom')}
              >
                기간 설정
              </button>
            </div>
            
            {/* 사용자 정의 기간 선택 */}
            {selectedTimeRange === 'custom' && (
              <div className="custom-date-picker">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="date-input"
                />
                <span className="date-separator">~</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="date-input"
                />
                {!isCustomDateValid() && (
                  <div className="date-error">
                    올바른 기간을 선택해주세요
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 전체 KPI 카드 (수정된 버전) */}
      <div className="kpi-cards">
        <div className="kpi-card">
          <div className="kpi-value">{data.overallKPIs.totalShooters}</div>
          <div className="kpi-label">총 촬영자</div>
          <div className="kpi-description">교수 제외</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{data.overallKPIs.totalSchedules}</div>
          <div className="kpi-label">총 스케줄</div>
          <div className="kpi-description">승인+취소 건만</div>
        </div>
        <div className="kpi-card approved">
          <div className="kpi-value">{data.overallKPIs.totalApprovedSchedules}</div>
          <div className="kpi-label">승인된 스케줄</div>
        </div>
        <div className="kpi-card cancelled">
          <div className="kpi-value">{data.overallKPIs.totalCancelledSchedules}</div>
          <div className="kpi-label">취소된 스케줄</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{data.overallKPIs.totalHours}h</div>
          <div className="kpi-label">총 촬영시간</div>
        </div>
      </div>

      {/* 메인 콘텐츠 그리드 */}
      <div className="main-grid">
        {/* 촬영자 통계 섹션 */}
        <div className="section">
          <h2>촬영자 통계</h2>
          
          <div className="sub-section">
            <h3>직원 유형별 분포</h3>
            <div className="employment-type-stats">
              {data.shooterStats.byEmploymentType.map((stat, index) => (
                <div key={stat.type} className="employment-type-item">
                  <div className="type-header">
                    <span className="type-name">{stat.typeName}</span>
                    <span className="type-count">{stat.count}명</span>
                  </div>
                  <div className="type-metrics">
                    <div className="metric">
                      <span className="metric-label">활성:</span>
                      <span className="metric-value">{stat.activeCount}명</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">평균 시간:</span>
                      <span className="metric-value">{stat.averageHours}h</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${Math.max((stat.count / data.shooterStats.totalShooters) * 100, 5)}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sub-section">
            <h3>상위 성과자 TOP 10</h3>
            <div className="top-performers">
              {filteredData.shooterStats.topPerformers.map((performer, index) => (
                <div key={performer.id} className="performer-item">
                  <span className="rank">#{index + 1}</span>
                  <div className="performer-info">
                    <div className="performer-name">{performer.name}</div>
                    <div className="performer-details">
                      {performer.employmentType} · {performer.totalAssignments}건 · {performer.totalHours.toFixed(1)}h
                    </div>
                  </div>
                  <div className="performer-rate">
                    {performer.hourlyRate > 0 ? `${performer.hourlyRate.toLocaleString()}원/h` : '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 학원/스튜디오별 통계 섹션 (간소화) */}
        <div className="section">
          <h2>학원/스튜디오별 통계</h2>
          <div className="academy-stats">
            {filteredData.academyStats.byAcademy.map((academy, index) => (
              <div key={academy.academyId} className="academy-item">
                <div className="academy-header">
                  <span className="academy-name">{academy.academyName}</span>
                </div>
                <div className="academy-simple-metrics">
                  <div className="simple-metric">
                    <span className="metric-value large">{academy.totalBookings}</span>
                    <span className="metric-label">건수</span>
                  </div>
                  <div className="simple-metric">
                    <span className="metric-value large">{academy.totalHours.toFixed(1)}</span>
                    <span className="metric-label">시간</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSS 스타일 (넓은 페이지 레이아웃) */}
      <style jsx global>{`
        .summary-dashboard {
          max-width: 1600px; /* 기존 1400px에서 1600px로 확대 */
          margin: 0 auto;
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }

        .dashboard-header h1 {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
          margin: 0;
        }

        .header-controls {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: flex-end;
        }

        .search-container {
          position: relative;
        }

        .search-input {
          padding: 10px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          width: 300px;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .time-range-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .time-range-selector {
          display: flex;
          gap: 8px;
        }

        .time-range-selector button {
          padding: 10px 16px;
          border: 2px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .time-range-selector button:hover {
          border-color: #3b82f6;
        }

        .time-range-selector button.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .custom-date-picker {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .date-input {
          padding: 8px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          font-size: 14px;
        }

        .date-separator {
          font-weight: 500;
          color: #6b7280;
        }

        .date-error {
          color: #dc2626;
          font-size: 12px;
          margin-top: 4px;
        }

        .kpi-cards {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 24px;
          margin-bottom: 40px;
        }

        .kpi-card {
          background: white;
          border-radius: 12px;
          padding: 28px 24px;
          text-align: center;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #3b82f6;
        }

        .kpi-card.approved {
          border-left-color: #10b981;
        }

        .kpi-card.approved .kpi-value {
          color: #10b981;
        }

        .kpi-card.cancelled {
          border-left-color: #ef4444;
        }

        .kpi-card.cancelled .kpi-value {
          color: #ef4444;
        }

        .kpi-value {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .kpi-label {
          font-size: 16px;
          color: #374151;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .kpi-description {
          font-size: 12px;
          color: #6b7280;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 40px;
        }

        .section {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .section h2 {
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 28px 0;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .sub-section {
          margin-bottom: 36px;
        }

        .sub-section:last-child {
          margin-bottom: 0;
        }

        .sub-section h3 {
          font-size: 18px;
          font-weight: 600;
          color: #374151;
          margin: 0 0 20px 0;
        }

        .employment-type-stats {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .employment-type-item {
          padding: 20px;
          background: #f9fafb;
          border-radius: 10px;
          border-left: 4px solid #3b82f6;
        }

        .type-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .type-name {
          font-weight: 600;
          color: #1f2937;
          font-size: 16px;
        }

        .type-count {
          font-weight: 600;
          color: #3b82f6;
          font-size: 16px;
        }

        .type-metrics {
          display: flex;
          gap: 20px;
          margin-bottom: 16px;
        }

        .metric {
          display: flex;
          gap: 6px;
        }

        .metric-label {
          font-size: 14px;
          color: #6b7280;
        }

        .metric-value {
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
        }

        .metric-value.large {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
        }

        .progress-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s ease;
        }

        .top-performers {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 500px;
          overflow-y: auto;
        }

        .performer-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .rank {
          font-weight: 700;
          color: #f59e0b;
          min-width: 32px;
          font-size: 16px;
        }

        .performer-info {
          flex: 1;
        }

        .performer-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
          font-size: 16px;
        }

        .performer-details {
          font-size: 13px;
          color: #6b7280;
        }

        .performer-rate {
          font-size: 13px;
          font-weight: 500;
          color: #059669;
        }

        .academy-stats {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-height: 600px;
          overflow-y: auto;
        }

        .academy-item {
          padding: 24px;
          background: #f9fafb;
          border-radius: 10px;
          border-left: 4px solid #10b981;
        }

        .academy-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .academy-name {
          font-weight: 600;
          color: #1f2937;
          font-size: 18px;
        }

        .academy-simple-metrics {
          display: flex;
          justify-content: space-around;
          gap: 24px;
        }

        .simple-metric {
          text-align: center;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: #6b7280;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 1200px) {
          .summary-dashboard {
            max-width: 100%;
            padding: 20px;
          }
          .main-grid {
            grid-template-columns: 1fr;
          }
          .header-controls {
            flex-direction: row;
            flex-wrap: wrap;
          }
          .search-input {
            width: 250px;
          }
          .kpi-cards {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 20px;
          }
          .header-controls {
            width: 100%;
          }
          .kpi-cards {
            grid-template-columns: repeat(2, 1fr);
          }
          .search-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Summary;

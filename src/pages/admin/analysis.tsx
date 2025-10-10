// pages/admin/analysis.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

// 🎯 TypeScript 인터페이스 정의
interface DateFilter {
  start: string;
  end: string;
}

interface IndividualStat {
  name: string;
  totalSessions: number;
  totalPlannedHours: number;
  totalActualHours: number;
  academySessions: number;
  studioSessions: number;
  completedSessions: number;
  modifiedSessions: number;
  averageSessionLength: number;
  completionRate: number;
  modificationRate: number;
  mostFavoriteLocation: string;
  preferredTimeSlot: string;
  favoriteLocations: { [key: string]: number };
  timePatterns: { [key: string]: number };
}

interface LocationStat {
  locationId: number;
  locationName: string;
  totalBookings: number;
  totalHours: number;
  academyBookings: number;
  studioBookings: number;
  uniqueUsers: number;
  completedSessions: number;
  utilizationRate: number;
  completionRate: number;
  averageSessionLength: number;
  peakHour: string;
  popularityScore: number;
  peakHours: { [key: number]: number };
}

interface TimeDistribution {
  hour: string;
  count: number;
  percentage: number;
}

interface EfficiencyMetrics {
  averagePlannedDuration: number;
  averageActualDuration: number;
  delayRate: number;
  earlyFinishRate: number;
}

interface ComparisonData {
  academyCount: number;
  studioCount: number;
  academyHours: number;
  studioHours: number;
  academyPercentage: number;
  studioPercentage: number;
}

interface DashboardData {
  individualStats: IndividualStat[];
  locationStats: LocationStat[];
  timeDistribution: TimeDistribution[];
  durationAnalysis: { [key: string]: number };
  efficiencyMetrics: EfficiencyMetrics;
  academyVsStudio: ComparisonData;
}

type PeriodType = 'today' | 'week' | 'month' | 'custom';

const Analysis: React.FC = () => {
  const [data, setData] = useState<DashboardData>({
    individualStats: [],
    locationStats: [],
    timeDistribution: [],
    durationAnalysis: {},
    efficiencyMetrics: {
      averagePlannedDuration: 0,
      averageActualDuration: 0,
      delayRate: 0,
      earlyFinishRate: 0
    },
    academyVsStudio: {
      academyCount: 0,
      studioCount: 0,
      academyHours: 0,
      studioHours: 0,
      academyPercentage: 0,
      studioPercentage: 0
    }
  });
  
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  
  const router = useRouter();

  useEffect(() => {
    loadAnalysisData();
  }, [selectedPeriod, customStartDate, customEndDate]);

  // 🎯 분석 데이터 로딩 (기간별 필터링 포함)
  const loadAnalysisData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const dateFilter = getDateFilter();
      console.log('🔍 분석 기간:', dateFilter);
      
      // 🎯 WHO: 개인별 분석
      const individualData = await analyzeIndividuals(dateFilter);
      
      // 🎯 WHERE: 위치별 분석
      const locationData = await analyzeLocations(dateFilter);
      
      // 🎯 WHERE: 학원 vs 스튜디오 비교
      const comparisonData = await compareAcademyVsStudio(dateFilter);
      
      // 🎯 HOW MUCH: 시간 분석
      const timeData = await analyzeTime(dateFilter);
      
      // 전체 레코드 수 계산
      const total = await getTotalRecords(dateFilter);
      
      setData({
        individualStats: individualData,
        locationStats: locationData,
        academyVsStudio: comparisonData,
        ...timeData
      });
      
      setTotalRecords(total);

      console.log('✅ WHO-WHERE-HOW MUCH 분석 완료:', {
        기간: dateFilter,
        총레코드: total,
        개인통계: individualData.length,
        위치통계: locationData.length,
        학원vs스튜디오: comparisonData
      });

    } catch (error) {
      console.error('분석 데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 전체 레코드 수 조회
  const getTotalRecords = async (dateFilter: DateFilter): Promise<number> => {
    const { count, error } = await supabase
      .from('schedules')
      .select('*', { count: 'exact', head: true })
      .gte('shoot_date', dateFilter.start)
      .lte('shoot_date', dateFilter.end)
      .eq('is_active', true);

    return count || 0;
  };

  // 🎯 WHO: 개인(교수)별 상세 분석
  const analyzeIndividuals = async (dateFilter: DateFilter): Promise<IndividualStat[]> => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        professor_name,
        schedule_type,
        start_time,
        end_time,
        actual_start_time,
        actual_end_time,
        sub_location_id,
        tracking_status,
        is_modification,
        shoot_date
      `)
      .gte('shoot_date', dateFilter.start)
      .lte('shoot_date', dateFilter.end)
      .not('professor_name', 'is', null)
      .eq('is_active', true)
      .order('shoot_date', { ascending: false });

    if (error || !data) {
      console.error('개인별 분석 오류:', error);
      return [];
    }

    // 교수별 그룹화 및 통계 계산
    const professorMap: { [key: string]: IndividualStat } = {};
    
    data.forEach(schedule => {
      const prof = schedule.professor_name;
      if (!professorMap[prof]) {
        professorMap[prof] = {
          name: prof,
          totalSessions: 0,
          totalPlannedHours: 0,
          totalActualHours: 0,
          academySessions: 0,
          studioSessions: 0,
          completedSessions: 0,
          modifiedSessions: 0,
          averageSessionLength: 0,
          completionRate: 0,
          modificationRate: 0,
          mostFavoriteLocation: '',
          preferredTimeSlot: '',
          favoriteLocations: {},
          timePatterns: {}
        };
      }
      
      const profData = professorMap[prof];
      profData.totalSessions++;
      
      // 시간 계산
      const plannedHours = calculateHours(schedule.start_time, schedule.end_time);
      const actualHours = schedule.actual_start_time && schedule.actual_end_time 
        ? calculateHours(schedule.actual_start_time, schedule.actual_end_time) 
        : plannedHours;
      
      profData.totalPlannedHours += plannedHours;
      profData.totalActualHours += actualHours;
      
      // 타입별 카운트
      if (schedule.schedule_type === 'academy') profData.academySessions++;
      if (schedule.schedule_type === 'studio') profData.studioSessions++;
      
      // 상태별 카운트
      if (schedule.tracking_status === 'completed') profData.completedSessions++;
      if (schedule.is_modification) profData.modifiedSessions++;
      
      // 선호 위치 분석
      const location = schedule.sub_location_id?.toString() || 'Unknown';
      profData.favoriteLocations[location] = (profData.favoriteLocations[location] || 0) + 1;
      
      // 시간 패턴 분석 (시간대별)
      const hour = parseInt(schedule.start_time?.split(':')[0] || '0');
      const timeSlot = getTimeSlot(hour);
      profData.timePatterns[timeSlot] = (profData.timePatterns[timeSlot] || 0) + 1;
    });

    // 추가 계산 및 정렬
    const individualStats = Object.values(professorMap).map(prof => {
      prof.averageSessionLength = prof.totalSessions > 0 
        ? Math.round((prof.totalPlannedHours / prof.totalSessions) * 10) / 10 
        : 0;
        
      prof.completionRate = prof.totalSessions > 0 
        ? Math.round((prof.completedSessions / prof.totalSessions) * 100) 
        : 0;
        
      prof.modificationRate = prof.totalSessions > 0 
        ? Math.round((prof.modifiedSessions / prof.totalSessions) * 100) 
        : 0;
        
      // 가장 선호하는 위치
      prof.mostFavoriteLocation = Object.keys(prof.favoriteLocations).reduce((a, b) => 
        prof.favoriteLocations[a] > prof.favoriteLocations[b] ? a : b, 'None');
        
      // 선호 시간대  
      prof.preferredTimeSlot = Object.keys(prof.timePatterns).reduce((a, b) => 
        prof.timePatterns[a] > prof.timePatterns[b] ? a : b, 'None');

      return prof;
    });

    return individualStats.sort((a, b) => b.totalSessions - a.totalSessions);
  };

  // 🎯 WHERE: 위치별 상세 분석
  const analyzeLocations = async (dateFilter: DateFilter): Promise<LocationStat[]> => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        sub_location_id,
        schedule_type,
        start_time,
        end_time,
        professor_name,
        tracking_status,
        shoot_date
      `)
      .gte('shoot_date', dateFilter.start)
      .lte('shoot_date', dateFilter.end)
      .not('sub_location_id', 'is', null)
      .eq('is_active', true);

    if (error || !data) {
      console.error('위치별 분석 오류:', error);
      return [];
    }

    const locationMap: { [key: number]: LocationStat } = {};
    const uniqueUsersMap: { [key: number]: Set<string> } = {};
    
    data.forEach(schedule => {
      const locationId = schedule.sub_location_id;
      
      // 위치 데이터 초기화
      if (!locationMap[locationId]) {
        locationMap[locationId] = {
          locationId,
          locationName: `스튜디오 ${locationId}`,
          totalBookings: 0,
          totalHours: 0,
          academyBookings: 0,
          studioBookings: 0,
          uniqueUsers: 0,
          completedSessions: 0,
          utilizationRate: 0,
          completionRate: 0,
          averageSessionLength: 0,
          peakHour: '0',
          popularityScore: 0,
          peakHours: {}
        };
        uniqueUsersMap[locationId] = new Set();
      }
      
      const loc = locationMap[locationId];
      loc.totalBookings++;
      
      const hours = calculateHours(schedule.start_time, schedule.end_time);
      loc.totalHours += hours;
      
      if (schedule.schedule_type === 'academy') loc.academyBookings++;
      if (schedule.schedule_type === 'studio') loc.studioBookings++;
      
      if (schedule.tracking_status === 'completed') loc.completedSessions++;
      if (schedule.professor_name) uniqueUsersMap[locationId].add(schedule.professor_name);
      
      // 피크 시간 분석
      const hour = parseInt(schedule.start_time?.split(':')[0] || '0');
      loc.peakHours[hour] = (loc.peakHours[hour] || 0) + 1;
    });

    // 계산 기간 일수 구하기
    const daysDiff = Math.ceil((new Date(dateFilter.end).getTime() - new Date(dateFilter.start).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return Object.values(locationMap).map(loc => ({
      ...loc,
      uniqueUsers: uniqueUsersMap[loc.locationId]?.size || 0,
      utilizationRate: Math.round((loc.totalHours / (10 * daysDiff)) * 100), // 일일 10시간 기준
      completionRate: loc.totalBookings > 0 ? Math.round((loc.completedSessions / loc.totalBookings) * 100) : 0,
      averageSessionLength: loc.totalBookings > 0 ? Math.round((loc.totalHours / loc.totalBookings) * 10) / 10 : 0,
      peakHour: Object.keys(loc.peakHours).reduce((a, b) => 
        loc.peakHours[parseInt(a)] > loc.peakHours[parseInt(b)] ? a : b, '0'),
      popularityScore: loc.totalBookings * 10 + (uniqueUsersMap[loc.locationId]?.size || 0) * 5 + Math.round(loc.totalHours)
    })).sort((a, b) => b.popularityScore - a.popularityScore);
  };

  // 🎯 WHERE: 학원 vs 스튜디오 비교
  const compareAcademyVsStudio = async (dateFilter: DateFilter): Promise<ComparisonData> => {
    const { data, error } = await supabase
      .from('schedules')
      .select('schedule_type, start_time, end_time')
      .gte('shoot_date', dateFilter.start)
      .lte('shoot_date', dateFilter.end)
      .eq('is_active', true);

    if (error || !data) {
      console.error('학원 vs 스튜디오 비교 오류:', error);
      return {
        academyCount: 0,
        studioCount: 0,
        academyHours: 0,
        studioHours: 0,
        academyPercentage: 0,
        studioPercentage: 0
      };
    }

    let academyCount = 0;
    let studioCount = 0;
    let academyHours = 0;
    let studioHours = 0;

    data.forEach(schedule => {
      const hours = calculateHours(schedule.start_time, schedule.end_time);
      
      if (schedule.schedule_type === 'academy') {
        academyCount++;
        academyHours += hours;
      } else if (schedule.schedule_type === 'studio') {
        studioCount++;
        studioHours += hours;
      }
    });

    const total = academyCount + studioCount;

    return {
      academyCount,
      studioCount,
      academyHours: Math.round(academyHours * 10) / 10,
      studioHours: Math.round(studioHours * 10) / 10,
      academyPercentage: total > 0 ? Math.round((academyCount / total) * 100) : 0,
      studioPercentage: total > 0 ? Math.round((studioCount / total) * 100) : 0
    };
  };

  // 🎯 HOW MUCH: 시간 분석
  const analyzeTime = async (dateFilter: DateFilter): Promise<{
    timeDistribution: TimeDistribution[];
    durationAnalysis: { [key: string]: number };
    efficiencyMetrics: EfficiencyMetrics;
  }> => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        start_time,
        end_time,
        actual_start_time,
        actual_end_time,
        schedule_type,
        professor_name
      `)
      .gte('shoot_date', dateFilter.start)
      .lte('shoot_date', dateFilter.end)
      .eq('is_active', true);

    if (error || !data) {
      console.error('시간 분석 오류:', error);
      return {
        timeDistribution: [],
        durationAnalysis: {},
        efficiencyMetrics: {
          averagePlannedDuration: 0,
          averageActualDuration: 0,
          delayRate: 0,
          earlyFinishRate: 0
        }
      };
    }

    // 시간대별 분포 계산
    const hourlyDistribution = Array(24).fill(0);
    const durationBuckets: { [key: string]: number } = {
      '0-1시간': 0,
      '1-2시간': 0,
      '2-4시간': 0,
      '4-6시간': 0,
      '6시간이상': 0
    };
    
    let totalPlannedMinutes = 0;
    let totalActualMinutes = 0;
    let delayCount = 0;
    let earlyCount = 0;
    let validActualTimeCount = 0;

    data.forEach(schedule => {
      // 시간대별 분포
      const startHour = parseInt(schedule.start_time?.split(':')[0] || '0');
      hourlyDistribution[startHour]++;
      
      // 촬영 길이별 분포
      const plannedHours = calculateHours(schedule.start_time, schedule.end_time);
      if (plannedHours < 1) durationBuckets['0-1시간']++;
      else if (plannedHours < 2) durationBuckets['1-2시간']++;
      else if (plannedHours < 4) durationBuckets['2-4시간']++;
      else if (plannedHours < 6) durationBuckets['4-6시간']++;
      else durationBuckets['6시간이상']++;
      
      totalPlannedMinutes += plannedHours * 60;
      
      // 실제 vs 계획 시간 비교
      if (schedule.actual_start_time && schedule.actual_end_time) {
        const actualHours = calculateHours(schedule.actual_start_time, schedule.actual_end_time);
        totalActualMinutes += actualHours * 60;
        validActualTimeCount++;
        
        if (actualHours > plannedHours) delayCount++;
        else if (actualHours < plannedHours) earlyCount++;
      }
    });

    return {
      timeDistribution: hourlyDistribution.map((count, hour) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count,
        percentage: data.length > 0 ? Math.round((count / data.length) * 100) : 0
      })),
      durationAnalysis: durationBuckets,
      efficiencyMetrics: {
        averagePlannedDuration: data.length > 0 ? Math.round(totalPlannedMinutes / data.length / 60 * 10) / 10 : 0,
        averageActualDuration: validActualTimeCount > 0 ? Math.round(totalActualMinutes / validActualTimeCount / 60 * 10) / 10 : 0,
        delayRate: data.length > 0 ? Math.round((delayCount / data.length) * 100) : 0,
        earlyFinishRate: data.length > 0 ? Math.round((earlyCount / data.length) * 100) : 0
      }
    };
  };

  // 🎯 헬퍼 함수들
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

  const getTimeSlot = (hour: number): string => {
    if (hour < 9) return '이른아침';
    if (hour < 12) return '오전';
    if (hour < 14) return '점심시간';
    if (hour < 18) return '오후';
    return '저녁';
  };

  // 🎯 기간 필터 계산 (사용자 정의 기간 포함)
  const getDateFilter = (): DateFilter => {
    const today = new Date();
    
    switch (selectedPeriod) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        return { start: todayStr, end: todayStr };
        
      case 'week':
        const weekAgo = new Date(today.getTime() - 6*24*60*60*1000); // 7일간
        return {
          start: weekAgo.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
        
      case 'month':
        const monthAgo = new Date(today.getTime() - 29*24*60*60*1000); // 30일간
        return {
          start: monthAgo.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0]
        };
        
      case 'custom':
        return {
          start: customStartDate || today.toISOString().split('T')[0],
          end: customEndDate || today.toISOString().split('T')[0]
        };
        
      default:
        const defaultStr = today.toISOString().split('T')[0];
        return { start: defaultStr, end: defaultStr };
    }
  };

  // 🎯 기간 선택 핸들러
  const handlePeriodChange = (period: PeriodType) => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  // 🎯 사용자 정의 날짜 유효성 검사
  const isCustomDateValid = (): boolean => {
    if (selectedPeriod !== 'custom') return true;
    return customStartDate && customEndDate && customStartDate <= customEndDate;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <div className="loading-text">
          <p>WHO-WHERE-HOW MUCH 분석 중...</p>
          <p className="loading-detail">데이터를 수집하고 분석하고 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-dashboard">
      {/* 🎯 헤더 & 기간 선택 */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>🎯 WHO-WHERE-HOW MUCH 분석</h1>
          <div className="data-summary">
            총 <strong>{totalRecords.toLocaleString()}건</strong> 데이터 분석 완료
          </div>
        </div>
        
        <div className="period-controls">
          <div className="period-selector">
            <button 
              className={selectedPeriod === 'today' ? 'active' : ''}
              onClick={() => handlePeriodChange('today')}
            >
              오늘
            </button>
            <button 
              className={selectedPeriod === 'week' ? 'active' : ''}
              onClick={() => handlePeriodChange('week')}
            >
              최근 7일
            </button>
            <button 
              className={selectedPeriod === 'month' ? 'active' : ''}
              onClick={() => handlePeriodChange('month')}
            >
              최근 30일
            </button>
            <button 
              className={selectedPeriod === 'custom' ? 'active' : ''}
              onClick={() => handlePeriodChange('custom')}
            >
              사용자 정의
            </button>
          </div>
          
          {/* 사용자 정의 기간 선택 */}
          {selectedPeriod === 'custom' && (
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

      {/* 🎯 요약 카드 섹션 */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-icon">👥</div>
          <div className="summary-content">
            <div className="summary-number">{data.individualStats.length}</div>
            <div className="summary-label">활성 이용자</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">🏢</div>
          <div className="summary-content">
            <div className="summary-number">{data.locationStats.length}</div>
            <div className="summary-label">사용된 스튜디오</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <div className="summary-number">{data.academyVsStudio.academyCount + data.academyVsStudio.studioCount}</div>
            <div className="summary-label">총 예약 건수</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">⏰</div>
          <div className="summary-content">
            <div className="summary-number">{(data.academyVsStudio.academyHours + data.academyVsStudio.studioHours).toFixed(1)}</div>
            <div className="summary-label">총 촬영 시간</div>
          </div>
        </div>
      </div>

      {/* 🎯 WHO 섹션 */}
      <div className="analysis-section">
        <h2>👥 WHO - 누가 사용하나?</h2>
        
        <div className="who-grid">
          {/* 개인별 TOP 15 */}
          <div className="analysis-card">
            <div className="card-header">
              <h3>개인별 이용 순위</h3>
              <div className="card-subtitle">교수별 활동 통계 (Top 15)</div>
            </div>
            <div className="ranking-list">
              {data.individualStats.slice(0, 15).map((prof, index) => (
                <div key={prof.name} className="ranking-item">
                  <span className={`rank rank-${index < 3 ? 'top' : 'normal'}`}>
                    #{index + 1}
                  </span>
                  <div className="person-info">
                    <div className="name">{prof.name}</div>
                    <div className="stats">
                      <span className="stat-item">
                        📊 {prof.totalSessions}건
                      </span>
                      <span className="stat-item">
                        ⏰ {prof.totalPlannedHours.toFixed(1)}시간
                      </span>
                    </div>
                    <div className="preferences">
                      <span className="pref-item">
                        🕐 {prof.preferredTimeSlot}
                      </span>
                      <span className="pref-item">
                        📍 스튜디오 {prof.mostFavoriteLocation}
                      </span>
                    </div>
                  </div>
                  <div className="metrics">
                    <div className="completion-rate">
                      완료율 {prof.completionRate}%
                    </div>
                    <div className="avg-length">
                      평균 {prof.averageSessionLength}h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 이용 패턴 분석 */}
          <div className="analysis-card">
            <div className="card-header">
              <h3>이용자 패턴 분석</h3>
              <div className="card-subtitle">사용자 행동 인사이트</div>
            </div>
            <div className="pattern-stats">
              <div className="pattern-item">
                <span className="label">총 이용자 수:</span>
                <span className="value">{data.individualStats.length}명</span>
              </div>
              <div className="pattern-item">
                <span className="label">평균 세션 길이:</span>
                <span className="value">
                  {data.individualStats.length > 0 
                    ? (data.individualStats.reduce((sum, p) => sum + p.averageSessionLength, 0) / data.individualStats.length).toFixed(1)
                    : 0}시간
                </span>
              </div>
              <div className="pattern-item">
                <span className="label">파워 유저 (10회 이상):</span>
                <span className="value highlight">
                  {data.individualStats.filter(p => p.totalSessions >= 10).length}명
                </span>
              </div>
              <div className="pattern-item">
                <span className="label">신규 이용자 (1-2회):</span>
                <span className="value">
                  {data.individualStats.filter(p => p.totalSessions <= 2).length}명
                </span>
              </div>
              <div className="pattern-item">
                <span className="label">평균 완료율:</span>
                <span className="value success">
                  {data.individualStats.length > 0 
                    ? Math.round(data.individualStats.reduce((sum, p) => sum + p.completionRate, 0) / data.individualStats.length)
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 WHERE 섹션 */}
      <div className="analysis-section">
        <h2>🏢 WHERE - 어디서 촬영하나?</h2>
        
        <div className="where-grid">
          {/* 스튜디오별 인기도 */}
          <div className="analysis-card">
            <div className="card-header">
              <h3>스튜디오별 인기도 순위</h3>
              <div className="card-subtitle">사용률 기준 Top 15</div>
            </div>
            <div className="location-list">
              {data.locationStats.slice(0, 15).map((loc, index) => (
                <div key={loc.locationId} className="location-item">
                  <span className={`rank rank-${index < 3 ? 'top' : 'normal'}`}>
                    #{index + 1}
                  </span>
                  <div className="location-info">
                    <div className="name">{loc.locationName}</div>
                    <div className="stats">
                      <span className="stat-item">
                        📊 {loc.totalBookings}건
                      </span>
                      <span className="stat-item">
                        ⏰ {loc.totalHours.toFixed(1)}시간
                      </span>
                      <span className="stat-item">
                        👥 {loc.uniqueUsers}명
                      </span>
                    </div>
                    <div className="usage-bar">
                      <div 
                        className="usage-fill"
                        style={{ width: `${Math.min(loc.utilizationRate, 100)}%` }}
                      />
                    </div>
                    <div className="usage-stats">
                      <span className="usage-text">사용률 {loc.utilizationRate}%</span>
                      <span className="peak-time">피크 {loc.peakHour}시</span>
                    </div>
                  </div>
                  <div className="location-metrics">
                    <div className="completion-rate">
                      완료율 {loc.completionRate}%
                    </div>
                    <div className="avg-session">
                      평균 {loc.averageSessionLength}h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 공간 이용 패턴 */}
          <div className="analysis-card">
            <div className="card-header">
              <h3>공간 이용 패턴</h3>
              <div className="card-subtitle">학원 vs 스튜디오 비교</div>
            </div>
            <div className="space-pattern">
              <div className="comparison-chart">
                <div className="comparison-item academy">
                  <div className="comparison-header">
                    <span className="type-icon">🎓</span>
                    <span className="type-name">학원 촬영</span>
                  </div>
                  <div className="comparison-metrics">
                    <div className="metric">
                      <span className="metric-value">{data.academyVsStudio.academyCount}</span>
                      <span className="metric-label">건수</span>
                    </div>
                    <div className="metric">
                      <span className="metric-value">{data.academyVsStudio.academyHours.toFixed(1)}</span>
                      <span className="metric-label">시간</span>
                    </div>
                  </div>
                  <div className="comparison-bar">
                    <div 
                      className="comparison-fill academy"
                      style={{ width: `${data.academyVsStudio.academyPercentage}%` }}
                    />
                  </div>
                  <div className="comparison-percentage">{data.academyVsStudio.academyPercentage}%</div>
                </div>

                <div className="comparison-item studio">
                  <div className="comparison-header">
                    <span className="type-icon">🏢</span>
                    <span className="type-name">스튜디오 촬영</span>
                  </div>
                  <div className="comparison-metrics">
                    <div className="metric">
                      <span className="metric-value">{data.academyVsStudio.studioCount}</span>
                      <span className="metric-label">건수</span>
                    </div>
                    <div className="metric">
                      <span className="metric-value">{data.academyVsStudio.studioHours.toFixed(1)}</span>
                      <span className="metric-label">시간</span>
                    </div>
                  </div>
                  <div className="comparison-bar">
                    <div 
                      className="comparison-fill studio"
                      style={{ width: `${data.academyVsStudio.studioPercentage}%` }}
                    />
                  </div>
                  <div className="comparison-percentage">{data.academyVsStudio.studioPercentage}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 HOW MUCH 섹션 */}
      <div className="analysis-section">
        <h2>⏰ HOW MUCH - 얼마나 사용하나?</h2>
        
        <div className="howmuch-grid">
          {/* 시간대별 분포 차트 */}
          <div className="analysis-card">
            <div className="card-header">
              <h3>시간대별 이용 분포</h3>
              <div className="card-subtitle">24시간 패턴 분석</div>
            </div>
            <div className="time-chart">
              {data.timeDistribution?.map((slot, index) => (
                <div key={index} className="time-slot">
                  <div className="time-bar">
                    <div 
                      className="time-fill"
                      style={{ height: `${Math.max(slot.percentage * 2, 2)}%` }}
                      title={`${slot.hour}: ${slot.count}건 (${slot.percentage}%)`}
                    />
                  </div>
                  <div className="time-label">{slot.hour.split(':')[0]}</div>
                  <div className="time-count">{slot.count}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span>시간대별 예약 분포 (높이 = 예약 비율)</span>
            </div>
          </div>

          {/* 촬영 시간 길이 분포 */}
          <div className="analysis-card">
            <div className="card-header">
              <h3>촬영 길이별 분포</h3>
              <div className="card-subtitle">세션 길이 패턴</div>
            </div>
            <div className="duration-analysis">
              {Object.entries(data.durationAnalysis || {}).map(([duration, count]) => (
                <div key={duration} className="duration-item">
                  <div className="duration-header">
                    <span className="duration-label">{duration}</span>
                    <span className="duration-count">{count}건</span>
                  </div>
                  <div className="duration-bar">
                    <div 
                      className="duration-fill"
                      style={{ 
                        width: `${count > 0 ? Math.max((count / Math.max(...Object.values(data.durationAnalysis || {}))) * 100, 5) : 0}%` 
                      }}
                    />
                  </div>
                  <div className="duration-percentage">
                    {totalRecords > 0 ? Math.round((count / totalRecords) * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 효율성 지표 */}
          <div className="analysis-card">
            <div className="card-header">
              <h3>효율성 지표</h3>
              <div className="card-subtitle">시간 관리 성과</div>
            </div>
            <div className="efficiency-metrics">
              <div className="metric-item">
                <div className="metric-icon">📅</div>
                <div className="metric-content">
                  <div className="metric-value">{data.efficiencyMetrics?.averagePlannedDuration || 0}시간</div>
                  <div className="metric-label">평균 계획 시간</div>
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-icon">⏱️</div>
                <div className="metric-content">
                  <div className="metric-value">{data.efficiencyMetrics?.averageActualDuration || 0}시간</div>
                  <div className="metric-label">평균 실제 시간</div>
                </div>
              </div>
              <div className="metric-item warning">
                <div className="metric-icon">⚠️</div>
                <div className="metric-content">
                  <div className="metric-value danger">{data.efficiencyMetrics?.delayRate || 0}%</div>
                  <div className="metric-label">지연율</div>
                </div>
              </div>
              <div className="metric-item success">
                <div className="metric-icon">✅</div>
                <div className="metric-content">
                  <div className="metric-value success">{data.efficiencyMetrics?.earlyFinishRate || 0}%</div>
                  <div className="metric-label">조기 종료율</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 전체 CSS 스타일 */}
      <style jsx global>{`
        .analysis-dashboard {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          background: #f8fafc;
          min-height: 100vh;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 3px solid #e5e7eb;
        }

        .header-left h1 {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 8px 0;
        }

        .data-summary {
          font-size: 14px;
          color: #6b7280;
        }

        .data-summary strong {
          color: #3b82f6;
          font-weight: 700;
        }

        .period-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .period-selector {
          display: flex;
          gap: 8px;
        }

        .period-selector button {
          padding: 10px 16px;
          border: 2px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
        }

        .period-selector button:hover {
          border-color: #3b82f6;
        }

        .period-selector button.active {
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

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .summary-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #3b82f6;
        }

        .summary-icon {
          font-size: 32px;
        }

        .summary-number {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          line-height: 1;
        }

        .summary-label {
          font-size: 14px;
          color: #6b7280;
          margin-top: 4px;
        }

        .analysis-section {
          margin-bottom: 48px;
        }

        .analysis-section h2 {
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 24px;
          padding-left: 12px;
          border-left: 4px solid #3b82f6;
        }

        .who-grid, .where-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        .howmuch-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
        }

        .analysis-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .card-header {
          margin-bottom: 20px;
        }

        .card-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #374151;
          margin: 0 0 4px 0;
        }

        .card-subtitle {
          font-size: 14px;
          color: #6b7280;
        }

        .ranking-list, .location-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 600px;
          overflow-y: auto;
        }

        .ranking-item, .location-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border-left: 3px solid #e5e7eb;
          transition: all 0.2s;
        }

        .ranking-item:hover, .location-item:hover {
          background: #f3f4f6;
          transform: translateX(2px);
        }

        .rank {
          font-weight: 700;
          color: #6b7280;
          min-width: 32px;
          text-align: center;
        }

        .rank.rank-top {
          color: #f59e0b;
        }

        .person-info, .location-info {
          flex: 1;
        }

        .name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 6px;
          font-size: 15px;
        }

        .stats {
          display: flex;
          gap: 12px;
          margin-bottom: 4px;
        }

        .stat-item {
          font-size: 12px;
          color: #6b7280;
          background: #e5e7eb;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .preferences {
          display: flex;
          gap: 8px;
        }

        .pref-item {
          font-size: 11px;
          color: #9ca3af;
        }

        .metrics, .location-metrics {
          text-align: right;
        }

        .completion-rate {
          font-size: 13px;
          font-weight: 600;
          color: #059669;
          margin-bottom: 2px;
        }

        .avg-length, .avg-session {
          font-size: 12px;
          color: #6b7280;
        }

        .usage-bar {
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
          margin: 6px 0;
        }

        .usage-fill {
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s ease;
        }

        .usage-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .usage-text {
          font-size: 12px;
          color: #374151;
          font-weight: 500;
        }

        .peak-time {
          font-size: 11px;
          color: #6b7280;
        }

        .pattern-stats {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pattern-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .label {
          font-size: 14px;
          color: #374151;
        }

        .value {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .value.highlight {
          color: #3b82f6;
        }

        .value.success {
          color: #059669;
        }

        .comparison-chart {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .comparison-item {
          padding: 16px;
          border-radius: 8px;
          background: #f9fafb;
        }

        .comparison-item.academy {
          border-left: 4px solid #10b981;
        }

        .comparison-item.studio {
          border-left: 4px solid #f59e0b;
        }

        .comparison-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .type-icon {
          font-size: 20px;
        }

        .type-name {
          font-weight: 600;
          color: #374151;
        }

        .comparison-metrics {
          display: flex;
          gap: 20px;
          margin-bottom: 12px;
        }

        .metric {
          text-align: center;
        }

        .metric-value {
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
          display: block;
        }

        .metric-label {
          font-size: 12px;
          color: #6b7280;
        }

        .comparison-bar {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .comparison-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .comparison-fill.academy {
          background: #10b981;
        }

        .comparison-fill.studio {
          background: #f59e0b;
        }

        .comparison-percentage {
          text-align: right;
          font-weight: 600;
          color: #374151;
        }

        .time-chart {
          display: flex;
          align-items: end;
          gap: 2px;
          height: 200px;
          padding: 10px 0;
        }

        .time-slot {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }

        .time-bar {
          flex: 1;
          width: 100%;
          background: #f3f4f6;
          border-radius: 2px;
          display: flex;
          align-items: end;
          margin-bottom: 4px;
          position: relative;
        }

        .time-fill {
          width: 100%;
          background: linear-gradient(to top, #3b82f6, #60a5fa);
          border-radius: 2px;
          min-height: 2px;
          transition: height 0.3s ease;
        }

        .time-label {
          font-size: 10px;
          color: #6b7280;
          margin-bottom: 2px;
        }

        .time-count {
          font-size: 9px;
          color: #9ca3af;
        }

        .chart-legend {
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          margin-top: 12px;
        }

        .duration-analysis {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .duration-item {
          background: #f9fafb;
          padding: 12px;
          border-radius: 6px;
        }

        .duration-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .duration-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .duration-count {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
        }

        .duration-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .duration-fill {
          height: 100%;
          background: #8b5cf6;
          transition: width 0.3s ease;
        }

        .duration-percentage {
          text-align: right;
          font-size: 12px;
          color: #6b7280;
        }

        .efficiency-metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .metric-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border-left: 3px solid #e5e7eb;
        }

        .metric-item.warning {
          border-left-color: #f59e0b;
        }

        .metric-item.success {
          border-left-color: #10b981;
        }

        .metric-icon {
          font-size: 20px;
        }

        .metric-content {
          flex: 1;
        }

        .metric-item .metric-value {
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
          line-height: 1;
          margin-bottom: 4px;
        }

        .metric-value.danger {
          color: #dc2626;
        }

        .metric-value.success {
          color: #059669;
        }

        .metric-item .metric-label {
          font-size: 12px;
          color: #6b7280;
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

        .loading-text {
          text-align: center;
        }

        .loading-text p {
          margin: 8px 0;
        }

        .loading-detail {
          font-size: 14px;
          color: #9ca3af;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 1200px) {
          .howmuch-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 1024px) {
          .who-grid, .where-grid {
            grid-template-columns: 1fr;
          }
          .howmuch-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 16px;
          }
          .period-controls {
            width: 100%;
          }
          .period-selector {
            flex-wrap: wrap;
          }
          .summary-cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .analysis-dashboard {
            padding: 16px;
          }
          .summary-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Analysis;

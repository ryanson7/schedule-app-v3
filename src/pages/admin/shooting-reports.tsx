// src/pages/admin/shooting-reports.tsx - 연동 필터링 수정 + 구분별 촬영 비율
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { safeUserRole } from '../../utils/permissions';

interface ShootingReport {
  id: number;
  shoot_date: string;
  professor_name: string;
  course_name: string;
  start_time: string;
  end_time: string;
  actual_start_time?: string;
  actual_end_time?: string;
  assigned_shooter_id: number;
  sub_location_id: number;
  notes?: string;
  is_confirmed: boolean;
  tracking_status: string;
  completion_photo_url?: string;
}

interface User {
  id: number;
  auth_id: string;
  name: string;
}

interface ShooterProfile {
  user_id: number;
  shooter_type: 'freelancer' | 'dispatch' | 'regular' | null;
}

interface Professor {
  user_id: string | number;
  professor_category_id?: number;
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

interface ProfessorCategory {
  id: number;
  category_name: string;
}

export default function ShootingReportsPage() {
  const { user } = useAuth();
  const [userInfo, setUserInfo] = useState<{ name: string; role: string } | null>(null);
  const [allSchedules, setAllSchedules] = useState<ShootingReport[]>([]); // 🔧 전체 스케줄 저장
  const [schedules, setSchedules] = useState<ShootingReport[]>([]);
  const [shooters, setShooters] = useState<User[]>([]);
  const [mainLocations, setMainLocations] = useState<MainLocation[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [professorCategories, setProfessorCategories] = useState<ProfessorCategory[]>([]);
  const [professorUsers, setProfessorUsers] = useState<User[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(false);

  // shooter 타입 맵
  const [shooterTypeMap, setShooterTypeMap] = useState<Record<number, ShooterProfile['shooter_type']>>({});

  // 필터 상태
  const [selectedShooter, setSelectedShooter] = useState<number | 'all'>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'regular' | 'dispatch' | 'freelancer'>('all');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hourlyRate, setHourlyRate] = useState<number>(50000);

  // 수정 모달 상태
  const [editingSchedule, setEditingSchedule] = useState<ShootingReport | null>(null);
  const [editForm, setEditForm] = useState({
    actual_start_time: '',
    actual_end_time: '',
    notes: ''
  });

  // 화면 크기 감지
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
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

  // 🔧 깔끔한 기초 데이터 조회
  const fetchBaseData = async () => {
    try {
      const [
        shootersResult,
        scheduleAdminsResult,
        mainLocationsResult,
        subLocationsResult,
        professorCategoriesResult,
        professorUsersResult,
        professorsResult,
        shooterProfilesResult
      ] = await Promise.all([
        supabase.from('users').select('id, auth_id, name').eq('role', 'shooter').order('name'),
        supabase.from('users').select('id, auth_id, name').eq('role', 'schedule_admin').eq('status', 'active').order('name'),
        supabase.from('main_locations').select('id, name').order('name'),
        supabase.from('sub_locations').select('id, name, main_location_id').order('name'),
        supabase.from('professor_categories').select('id, category_name').order('category_name'),
        supabase.from('users').select('id, auth_id, name').eq('role', 'professor').order('name'),
        supabase.from('professors').select('user_id, professor_category_id').order('user_id'),
        supabase.from('shooters').select('user_id, shooter_type')
      ]);

      // 전체 촬영 인원 합치기
      const allShooters: User[] = [
        ...(shootersResult.data as User[] || []),
        ...(scheduleAdminsResult.data as User[] || [])
      ];
      setShooters(allShooters);
      
      if (mainLocationsResult.data) setMainLocations(mainLocationsResult.data as MainLocation[]);
      if (subLocationsResult.data) setSubLocations(subLocationsResult.data as SubLocation[]);
      if (professorCategoriesResult.data) setProfessorCategories(professorCategoriesResult.data as ProfessorCategory[]);
      if (professorUsersResult.data) setProfessorUsers(professorUsersResult.data as User[]);
      if (professorsResult.data) setProfessors(professorsResult.data as Professor[]);

      // 타입 매핑
      const map: Record<number, ShooterProfile['shooter_type']> = {};
      
      // 1. 정직원 매핑
      if (scheduleAdminsResult.data) {
        (scheduleAdminsResult.data as User[]).forEach(user => {
          map[user.id] = 'regular';
        });
      }
      
      // 2. 파견직/프리랜서 매핑
      if (shootersResult.data && shooterProfilesResult.data) {
        const usersData = shootersResult.data as User[];
        const profilesData = shooterProfilesResult.data as any[];
        
        usersData.forEach(user => {
          // 여러 방법으로 매칭 시도
          let profile = profilesData.find(p => p.user_id === user.id) ||
                      profilesData.find(p => p.user_id === user.auth_id) ||
                      profilesData.find(p => p.user_id.toString() === user.id.toString()) ||
                      profilesData.find(p => p.user_id === user.auth_id.toString());
          
          map[user.id] = profile?.shooter_type || 'freelancer';
        });
      }

      // 요약 정보만 출력
      const summary = {
        regular: Object.values(map).filter(t => t === 'regular').length,
        dispatch: Object.values(map).filter(t => t === 'dispatch').length,
        freelancer: Object.values(map).filter(t => t === 'freelancer').length
      };
      
      console.log(`📊 촬영 인원: 정직원 ${summary.regular}명, 파견직 ${summary.dispatch}명, 프리랜서 ${summary.freelancer}명`);
      
      setShooterTypeMap(map);
      
    } catch (error) {
      console.error('❌ 기초 데이터 조회 실패:', error);
    }
  };





  // 🔧 구분별 shooters 필터링 - 수정됨
  // 🔧 깔끔한 필터링 함수
  const getFilteredShooters = () => {
    if (selectedType === 'all') return shooters;
    
    const filtered = shooters.filter(shooter => shooterTypeMap[shooter.id] === selectedType);
    
    // 필요시에만 로그 출력
    if (filtered.length === 0 && selectedType !== 'all') {
      console.log(`⚠️ ${selectedType} 타입의 촬영자가 없습니다.`);
    }
    
    return filtered;
  };



  // 🔧 스케줄 조회 - 전체 조회 후 클라이언트 필터링
  const fetchSchedules = async () => {
    if (!shooters.length) return;
    setLoading(true);
    try {
      // 전체 스케줄 조회 (날짜 범위만 적용)
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          shoot_date,
          professor_name,
          course_name,
          start_time,
          end_time,
          actual_start_time,
          actual_end_time,
          assigned_shooter_id,
          sub_location_id,
          notes,
          is_confirmed,
          tracking_status,
          completion_photo_url
        `)
        .gte('shoot_date', startDate)
        .lte('shoot_date', endDate)
        .eq('is_confirmed', true)
        .order('shoot_date', { ascending: false })
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      const allData = (data || []) as ShootingReport[];
      setAllSchedules(allData); // 전체 스케줄 저장
      
      // 클라이언트 필터링 적용
      applyClientFilters(allData);
      
    } catch (error) {
      console.error('스케줄 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔧 클라이언트 필터링 함수
  const applyClientFilters = (data: ShootingReport[]) => {
    let filtered = [...data];

    // 개별 촬영자 필터
    if (selectedShooter !== 'all') {
      filtered = filtered.filter(s => s.assigned_shooter_id === selectedShooter);
    }

    // 구분 필터
    if (selectedType !== 'all') {
      const filteredShooterIds = getFilteredShooters().map(s => s.id);
      filtered = filtered.filter(s => filteredShooterIds.includes(s.assigned_shooter_id));
    }

    setSchedules(filtered);
  };

  // 🔧 필터 변경시 클라이언트 필터링 다시 적용
  useEffect(() => {
    if (userInfo) {
      fetchBaseData();
    }
  }, [userInfo]);

  // 🔧 shooterTypeMap이 로드된 후에 스케줄 조회
  useEffect(() => {
    if (shooters.length > 0 && Object.keys(shooterTypeMap).length > 0) {
      fetchSchedules();
    }
  }, [startDate, endDate, shooters, shooterTypeMap]);

  // 🔧 클라이언트 필터링도 shooterTypeMap 준비 후
  useEffect(() => {
    if (allSchedules.length > 0 && Object.keys(shooterTypeMap).length > 0) {
      applyClientFilters(allSchedules);
    }
  }, [selectedShooter, selectedType, allSchedules, shooterTypeMap]);


  // UTC+9 시간 처리
  const formatTime = (timeString: string): string => {
    if (!timeString) return '';
    try {
      let date: Date;
      if (timeString.includes('T') || timeString.includes(' ')) {
        date = new Date(timeString);
      } else {
        const today = new Date().toISOString().split('T')[0];
        date = new Date(`${today}T${timeString}`);
      }
      const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      return kstDate.toTimeString().split(':').slice(0, 2).join(':');
    } catch {
      return timeString.split(':').slice(0, 2).join(':');
    }
  };

  // 작업시간 계산
  const calculateWorkingTime = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    try {
      let start: Date, end: Date;
      if (startTime.includes('T') || startTime.includes(' ')) {
        start = new Date(startTime);
        end = new Date(endTime);
      } else {
        const today = new Date().toISOString().split('T')[0];
        start = new Date(`${today}T${startTime}`);
        end = new Date(`${today}T${endTime}`);
      }
      const kstStart = new Date(start.getTime() + 9 * 60 * 60 * 1000);
      const kstEnd = new Date(end.getTime() + 9 * 60 * 60 * 1000);
      const totalMinutes = (kstEnd.getTime() - kstStart.getTime()) / (1000 * 60);
      return totalMinutes / 60;
    } catch {
      return 0;
    }
  };

  const formatWorkingTime = (hours: number): string => {
    if (hours === 0) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}시간 ${m}분`;
  };

  const calculateEfficiency = (scheduledHours: number, actualHours: number): string => {
    if (scheduledHours === 0 || actualHours === 0) return '-';
    const efficiency = (actualHours / scheduledHours) * 100;
    return `${efficiency.toFixed(1)}%`;
  };

  const getShooterName = (shooterId: number): string => {
    const shooter = shooters.find((u) => u.id === shooterId);
    return shooter ? shooter.name : '미정';
  };

  // 🔧 깔끔한 타입 표시 함수
  const getShooterType = (shooterId: number): string => {
    const type = shooterTypeMap[shooterId];
    switch (type) {
      case 'regular': return '정직원';
      case 'dispatch': return '파견직';  
      case 'freelancer': return '프리랜서';
      default: return '프리랜서'; // 기본값
    }
  };

  const getLocationName = (subLocationId: number): string => {
    const subLocation = subLocations.find((s) => s.id === subLocationId);
    if (!subLocation) return '미정';
    const mainLocation = mainLocations.find((m) => m.id === subLocation.main_location_id);
    return mainLocation ? mainLocation.name : '미정';
  };

  const getCategoryName = (professorName?: string): string => {
    if (!professorName || !professorUsers.length || !professors.length || !professorCategories.length) {
      return '기타';
    }
    try {
      const professorUser = professorUsers.find((u) => u.name === professorName);
      if (!professorUser) return '기타';
      let professor = professors.find((p) => p.user_id === professorUser.id.toString());
      if (!professor) {
        professor = professors.find((p) => parseInt(p.user_id as string) === professorUser.id);
      }
      if (!professor || !professor.professor_category_id) return '기타';
      const category = professorCategories.find((c) => c.id === professor.professor_category_id);
      return category ? category.category_name : '기타';
    } catch {
      return '기타';
    }
  };

  // 금액 계산: 파견직은 0원
  const isDispatch = (shooterId: number): boolean => {
    return shooterTypeMap[shooterId] === 'dispatch';
  };

  const computeAmount = (hours: number, shooterId: number): number => {
    if (isDispatch(shooterId)) return 0;
    return Math.floor(hours * hourlyRate);
  };

  // 모달 함수들
  const openEditModal = (schedule: ShootingReport) => {
    setEditingSchedule(schedule);
    setEditForm({
      actual_start_time: schedule.actual_start_time ? formatTimeForInput(schedule.actual_start_time) : '',
      actual_end_time: schedule.actual_end_time ? formatTimeForInput(schedule.actual_end_time) : '',
      notes: schedule.notes || ''
    });
  };

  const formatTimeForInput = (timeString: string): string => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      return kstDate.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const closeEditModal = () => {
    setEditingSchedule(null);
    setEditForm({ actual_start_time: '', actual_end_time: '', notes: '' });
  };

  const saveScheduleChanges = async () => {
    if (!editingSchedule) return;
    setLoading(true);
    try {
      const updateData: any = {
        notes: editForm.notes,
        updated_at: new Date().toISOString()
      };
      if (editForm.actual_start_time) {
        const startDate = new Date(editForm.actual_start_time);
        updateData.actual_start_time = startDate.toISOString();
      }
      if (editForm.actual_end_time) {
        const endDate = new Date(editForm.actual_end_time);
        updateData.actual_end_time = endDate.toISOString();
      }
      const { error } = await supabase.from('schedules').update(updateData).eq('id', editingSchedule.id);
      if (error) throw error;
      alert('수정이 완료되었습니다.');
      await fetchSchedules();
      closeEditModal();
    } catch (error) {
      console.error('스케줄 수정 실패:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // CSV 출력
  const exportToCSV = () => {
    const headers = ['날짜', '촬영장소', '콘텐츠', '교수명', '촬영자', '구분', '스케줄시간', '실제시간', '총작업시간', '효율성', '금액', '특이사항'];
    const csvData = schedules.map((schedule) => {
      const scheduledHours = calculateWorkingTime(schedule.start_time, schedule.end_time);
      const actualHours =
        schedule.actual_start_time && schedule.actual_end_time
          ? calculateWorkingTime(schedule.actual_start_time, schedule.actual_end_time)
          : scheduledHours;
      const workingHours = actualHours;
      const amount = computeAmount(workingHours, schedule.assigned_shooter_id);
      const efficiency = calculateEfficiency(scheduledHours, actualHours);

      return [
        new Date(schedule.shoot_date).toLocaleDateString('ko-KR'),
        getLocationName(schedule.sub_location_id),
        getCategoryName(schedule.professor_name),
        schedule.professor_name || '미정',
        getShooterName(schedule.assigned_shooter_id),
        getShooterType(schedule.assigned_shooter_id),
        `${formatTime(schedule.start_time)} ~ ${formatTime(schedule.end_time)}`,
        schedule.actual_start_time && schedule.actual_end_time
          ? `${formatTime(schedule.actual_start_time)} ~ ${formatTime(schedule.actual_end_time)}`
          : '실제시간 미입력',
        formatWorkingTime(workingHours),
        efficiency,
        `${amount.toLocaleString()}원`,
        schedule.notes || ''
      ];
    });

    const csvContent = [headers, ...csvData].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    const typeLabel = selectedType === 'all' ? '전체' : 
                     selectedType === 'regular' ? '정직원' :
                     selectedType === 'dispatch' ? '파견직' : '프리랜서';
    const shooterName = selectedShooter === 'all' ? typeLabel : getShooterName(selectedShooter as number);
    const fileName = `촬영기록표_${shooterName}_${startDate}_${endDate}.csv`;

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🔧 통계 계산 - 구분별 촬영 비율
  const stats = (() => {
    const base = {
      totalSchedules: schedules.length,
      totalHours: 0,
      totalAmount: 0,
      avgEfficiency: 0,
      regularRatio: 0,    // 정직원 비율
      dispatchRatio: 0,   // 파견직 비율  
      freelancerRatio: 0  // 프리랜서 비율
    };

    if (allSchedules.length === 0) return base;

    let totalHours = 0;
    let totalAmount = 0;
    let effSum = 0;
    let effCount = 0;

    // 구분별 카운트 (전체 스케줄 기준)
    let regularCount = 0;
    let dispatchCount = 0;
    let freelancerCount = 0;

    schedules.forEach((s) => {
      const scheduledHours = calculateWorkingTime(s.start_time, s.end_time);
      const actualHours =
        s.actual_start_time && s.actual_end_time
          ? calculateWorkingTime(s.actual_start_time, s.actual_end_time)
          : scheduledHours;

      totalHours += actualHours;

      const amount = computeAmount(actualHours, s.assigned_shooter_id);
      totalAmount += amount;

      if (scheduledHours > 0 && actualHours > 0) {
        effSum += (actualHours / scheduledHours) * 100;
        effCount += 1;
      }
    });

    // 전체 스케줄에서 구분별 비율 계산
    allSchedules.forEach((s) => {
      const type = shooterTypeMap[s.assigned_shooter_id];
      switch (type) {
        case 'regular':
          regularCount++;
          break;
        case 'dispatch':
          dispatchCount++;
          break;
        case 'freelancer':
          freelancerCount++;
          break;
      }
    });

    const totalCount = allSchedules.length;
    const regularRatio = totalCount > 0 ? (regularCount / totalCount) * 100 : 0;
    const dispatchRatio = totalCount > 0 ? (dispatchCount / totalCount) * 100 : 0;
    const freelancerRatio = totalCount > 0 ? (freelancerCount / totalCount) * 100 : 0;

    return {
      totalSchedules: schedules.length,
      totalHours,
      totalAmount,
      avgEfficiency: effCount > 0 ? effSum / effCount : 0,
      regularRatio,
      dispatchRatio,
      freelancerRatio
    };
  })();

  // 권한 체크
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

  const userRole = safeUserRole(userInfo.role);
  const allowedRoles = ['system_admin', 'schedule_admin'];
  if (!allowedRoles.includes(userRole)) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        textAlign: 'center',
        padding: '40px'
      }}>
        <div>접근 권한이 없습니다.</div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8fafc',
      padding: isMobile ? '16px' : '24px'
    }}>
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        maxWidth: '1800px',
        width: '100%'
      }}>
        {/* 헤더 */}
        <div style={{
          background: 'white',
          padding: isMobile ? '20px' : '32px',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '16px' : '0',
            marginBottom: '24px'
          }}>
            <div>
              <h1 style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: 'bold',
                margin: '0 0 8px 0',
                color: '#1e293b'
              }}>
                촬영 기록표
              </h1>
            </div>
            
            <button
              onClick={exportToCSV}
              disabled={schedules.length === 0}
              style={{
                background: schedules.length > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#9ca3af',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: schedules.length > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              📊 CSV 출력
            </button>
          </div>

          {/* 필터 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)',
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
                구분 선택
              </label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value as any);
                  setSelectedShooter('all'); // 구분 변경시 개별 촬영자 선택 초기화
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="all">전체</option>
                <option value="regular">정직원</option>
                <option value="dispatch">파견직</option>
                <option value="freelancer">프리랜서</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                촬영자 선택
              </label>
              <select
                value={selectedShooter}
                onChange={(e) => setSelectedShooter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="all">전체 촬영자</option>
                {getFilteredShooters().map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({getShooterType(user.id)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
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
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
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
                시급 (원)
              </label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* 🔧 통계 요약 - 구분별 촬영 비율 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)',
            gap: '16px'
          }}>
            {[
              { label: '총 촬영 건수', value: `${stats.totalSchedules}건`, color: '#3b82f6' },
              { label: '총 작업 시간', value: formatWorkingTime(stats.totalHours), color: '#10b981' },
              { label: '총 금액', value: `${stats.totalAmount.toLocaleString()}원`, color: '#f59e0b' },
              { label: '평균 효율성', value: `${stats.avgEfficiency.toFixed(1)}%`, color: '#8b5cf6' },
              { label: '정직원 비율', value: `${stats.regularRatio.toFixed(1)}%`, color: '#10b981' },
              { label: '파견직 비율', value: `${stats.dispatchRatio.toFixed(1)}%`, color: '#f59e0b' },
              { label: '프리랜서 비율', value: `${stats.freelancerRatio.toFixed(1)}%`, color: '#3b82f6' }
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: `${stat.color}10`,
                  border: `2px solid ${stat.color}30`,
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  fontSize: isMobile ? '16px' : '20px',
                  fontWeight: 'bold',
                  color: stat.color,
                  marginBottom: '4px'
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#64748b' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 기록표 테이블 */}
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
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: '#1e293b' }}>
              촬영 기록 목록 ({schedules.length}건)
            </h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              데이터를 불러오는 중...
            </div>
          ) : schedules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              해당 조건의 촬영 기록이 없습니다
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    {[
                      '날짜',
                      '촬영장소', 
                      '콘텐츠',
                      '교수명',
                      '촬영자',
                      '스케줄 시간',
                      '실제 시간', 
                      '작업시간',
                      '효율성',
                      '금액',
                      '완료사진',
                      '특이사항',
                      '수정'
                    ].map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: '16px',
                          textAlign: 'center',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '1px solid #e5e7eb',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule, index) => {
                    const scheduledHours = calculateWorkingTime(schedule.start_time, schedule.end_time);
                    const actualHours =
                      schedule.actual_start_time && schedule.actual_end_time
                        ? calculateWorkingTime(schedule.actual_start_time, schedule.actual_end_time)
                        : scheduledHours;
                    const workingHours = actualHours;
                    const amount = computeAmount(workingHours, schedule.assigned_shooter_id);
                    const efficiency = calculateEfficiency(scheduledHours, actualHours);
                    const hasActualTime = schedule.actual_start_time && schedule.actual_end_time;
                    const categoryName = getCategoryName(schedule.professor_name);
                    const shooterType = getShooterType(schedule.assigned_shooter_id);

                    return (
                      <tr key={schedule.id} style={{ background: index % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          whiteSpace: 'nowrap',
                          textAlign: 'center'
                        }}>
                          {new Date(schedule.shoot_date).toLocaleDateString('ko-KR')}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          textAlign: 'center'
                        }}>
                          {getLocationName(schedule.sub_location_id)}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          fontWeight: '600',
                          color: categoryName === '기타' ? '#f59e0b' : '#059669',
                          textAlign: 'center'
                        }}>
                          {categoryName}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          textAlign: 'center'
                        }}>
                          {schedule.professor_name || '미정'}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          textAlign: 'center'
                        }}>
                          <div>{getShooterName(schedule.assigned_shooter_id)}</div>
                          <div style={{
                            fontSize: '12px',
                            color: shooterType === '파견직' ? '#f59e0b' : 
                                   shooterType === '정직원' ? '#10b981' : '#3b82f6',
                            fontWeight: '600',
                            marginTop: '2px'
                          }}>
                            ({shooterType})
                          </div>
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          whiteSpace: 'nowrap',
                          textAlign: 'center'
                        }}>
                          {formatTime(schedule.start_time)} ~ {formatTime(schedule.end_time)}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          whiteSpace: 'nowrap',
                          textAlign: 'center',
                          color: hasActualTime ? '#10b981' : '#f59e0b'
                        }}>
                          {hasActualTime
                            ? `${formatTime(schedule.actual_start_time!)} ~ ${formatTime(schedule.actual_end_time!)}`
                            : '미입력'}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          whiteSpace: 'nowrap',
                          fontWeight: '600',
                          color: '#10b981',
                          textAlign: 'center'
                        }}>
                          {formatWorkingTime(workingHours)}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          whiteSpace: 'nowrap',
                          fontWeight: '600',
                          color: efficiency === '-' ? '#64748b' : 
                                 (parseFloat(efficiency) <= 100 ? '#10b981' : '#f59e0b'),
                          textAlign: 'center'
                        }}>
                          {efficiency}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          whiteSpace: 'nowrap',
                          fontWeight: '600',
                          color: shooterType === '파견직' ? '#64748b' : '#f59e0b',
                          textAlign: 'center'
                        }}>
                          {shooterType === '파견직' ? '0원' : `${amount.toLocaleString()}원`}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9', 
                          textAlign: 'center'
                        }}>
                          {schedule.completion_photo_url ? (
                            <span style={{ color: '#10b981', fontWeight: '600' }}>✓</span>
                          ) : (
                            <span style={{ color: '#ef4444' }}>✗</span>
                          )}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center'
                        }}>
                          {schedule.notes || '-'}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          borderBottom: '1px solid #f1f5f9',
                          textAlign: 'center'
                        }}>
                          <button
                            onClick={() => openEditModal(schedule)}
                            style={{
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            수정
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 수정 모달 (동일) */}
        {editingSchedule && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              width: isMobile ? '90%' : '500px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#1e293b',
                marginBottom: '24px'
              }}>
                촬영 기록 수정
              </h2>

              <div style={{ marginBottom: '20px' }}>
                <strong>교수명:</strong> {editingSchedule.professor_name} <br />
                <strong>날짜:</strong> {new Date(editingSchedule.shoot_date).toLocaleDateString('ko-KR')} <br />
                <strong>장소:</strong> {getLocationName(editingSchedule.sub_location_id)} <br />
                <strong>촬영자:</strong> {getShooterName(editingSchedule.assigned_shooter_id)} ({getShooterType(editingSchedule.assigned_shooter_id)})
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  실제 시작 시간
                </label>
                <input
                  type="datetime-local"
                  value={editForm.actual_start_time}
                  onChange={(e) => setEditForm({ ...editForm, actual_start_time: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  실제 종료 시간
                </label>
                <input
                  type="datetime-local"
                  value={editForm.actual_end_time}
                  onChange={(e) => setEditForm({ ...editForm, actual_end_time: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  특이사항
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="특이사항을 입력하세요"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeEditModal}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={saveScheduleChanges}
                  disabled={loading}
                  style={{
                    background: loading ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

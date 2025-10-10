import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';

// 타입 정의
interface Shooter {
  id: number;
  name: string;
  phone: string;
  emergency_phone?: string;
  role: string;
  shooter_type: 'dispatch' | 'freelancer';
  status: string;
  is_active: boolean;
  created_at: string;
  team_id?: number;
  main_location_ids?: number[];
  team_name: string;
  academy_names: string[];
}

interface Team {
  id: number;
  name: string;
  description?: string;
}

interface Academy {
  id: number;
  name: string;
  location_type: string;
  is_active: boolean;
}

interface CSVRow {
  이름: string;
  전화번호: string;
  비상연락처?: string;
  타입: 'dispatch' | 'freelancer';
  팀ID?: string;
  학원ID?: string;
}

// ✅ CSV 행 파싱 - 따옴표 내부 쉼표 처리
const splitCSVRow = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '')); // 양끝 따옴표 제거
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim().replace(/^"|"$/g, '')); // 마지막 필드
  return result;
};

// ✅ CSV 학원ID → PostgreSQL 배열 형태로 변환
const parseAcademyIds = (academyIdRaw: string): number[] => {
  if (!academyIdRaw) return [];
  
  console.log('🔍 파싱 시작:', academyIdRaw);
  
  // 문자열 정리
  let cleaned = academyIdRaw.trim();
  
  // 이미 배열 형태인 경우 파싱
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleaned);
      const result = Array.isArray(parsed) ? parsed.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id)) : [];
      console.log('📋 JSON 배열 파싱 결과:', result);
      return result;
    } catch (error) {
      console.warn('⚠️ JSON 배열 파싱 실패:', cleaned);
    }
  }

  // PostgreSQL 배열 형태 {1,2,3} 파싱
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    const inner = cleaned.slice(1, -1);
    const result = inner.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v) && v > 0);
    console.log('🗃️ PostgreSQL 배열 파싱 결과:', result);
    return result;
  }
  
  // 다양한 구분자 지원: 쉼표, 세미콜론, 공백, 파이프
  const separators = /[,;|\s]+/;
  
  const result = cleaned
    .split(separators)
    .map(v => v.trim().replace(/['"()\[\]{}]/g, ''))
    .filter(Boolean)
    .map(v => {
      const num = parseInt(v);
      return isNaN(num) ? null : num;
    })
    .filter(v => v !== null && v > 0) as number[];
  
  console.log('📊 최종 파싱 결과:', result);
  return result;
};

// ✅ 학원ID 배열을 PostgreSQL 배열 문자열로 변환
const formatAcademyIdsForDB = (academyIds: number[]): string => {
  if (!academyIds || academyIds.length === 0) return '';
  return `{${academyIds.join(',')}}`;  // PostgreSQL 배열 형태: {1,2,3}
};

const ShootersManagement: React.FC = () => {
  // State 관리
  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // 필터 및 검색
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'dispatch' | 'freelancer'>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterAcademy, setFilterAcademy] = useState<string>('all');
  
  // 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVUploadModal, setShowCSVUploadModal] = useState(false);
  
  // ✅ 수정 모달 상태 추가
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShooter, setEditingShooter] = useState<Shooter | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    emergency_phone: '',
    shooter_type: 'freelancer' as 'dispatch' | 'freelancer',
    team_id: '',
    academy_ids: [] as number[],
    is_active: true,
    status: 'active'
  });
  
  // 폼 데이터
  const [newShooter, setNewShooter] = useState({
    name: '',
    phone: '',
    emergency_phone: '',
    shooter_type: 'freelancer' as 'dispatch' | 'freelancer',
    team_id: '',
    academy_ids: [] as number[]
  });
  
  // CSV 업로드
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ 간단한 에러 표시 함수
  const showError = (title: string, error: any) => {
    const errorText = `${title}\n\n에러: ${error.message}\n\n전체 정보: ${JSON.stringify(error, null, 2)}`;
    
    console.error('🚨 ' + title, error);
    
    const userAction = confirm(`${title}\n\n${error.message}\n\n자세한 정보를 복사하시겠습니까?`);
    
    if (userAction) {
      const textarea = document.createElement('textarea');
      textarea.value = errorText;
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      
      try {
        document.execCommand('copy');
        alert('에러 정보가 클립보드에 복사되었습니다.');
      } catch (err) {
        prompt('아래 텍스트를 복사하세요:', errorText);
      }
      
      document.body.removeChild(textarea);
    }
  };

  // ✅ 수정 모달 열기 함수
  const handleEditShooter = (shooter: Shooter) => {
    setEditingShooter(shooter);
    setEditForm({
      name: shooter.name,
      phone: shooter.phone,
      emergency_phone: shooter.emergency_phone || '',
      shooter_type: shooter.shooter_type,
      team_id: shooter.team_id?.toString() || '',
      academy_ids: shooter.main_location_ids || [],
      is_active: shooter.is_active,
      // ✅ 안전한 기본값 - active/inactive만 허용
      status: ['active', 'inactive'].includes(shooter.status) 
        ? shooter.status 
        : 'active'  // 기본값
    });
    setShowEditModal(true);
  };


  const handleUpdateShooter = async () => {
    if (!editingShooter) return;

    try {
      setUploading(true);

      // ✅ status 값 검증 - active/inactive만 허용
      const validStatuses = ['active', 'inactive'];
      if (!validStatuses.includes(editForm.status)) {
        alert('올바르지 않은 상태 값입니다. active 또는 inactive를 선택해주세요.');
        return;
      }

      console.log('🔍 업데이트할 데이터:', {
        status: editForm.status,
        is_active: editForm.is_active
      });

      // users 테이블 수정
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          status: editForm.status, // 'active' 또는 'inactive'만
          is_active: editForm.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('auth_id', editingShooter.id);

      if (userError) {
        console.error('❌ users 테이블 업데이트 에러:', userError);
        throw userError;
      }

      // shooters 테이블 수정
      const shooterUpdateData = {
        shooter_type: editForm.shooter_type,
        emergency_phone: editForm.emergency_phone.trim() || null,
        team_id: editForm.shooter_type === 'dispatch' && editForm.team_id ? parseInt(editForm.team_id) : null,
        main_location_ids: editForm.shooter_type === 'freelancer' ? editForm.academy_ids : null,
        main_location_id: editForm.shooter_type === 'freelancer' && editForm.academy_ids.length > 0 
          ? editForm.academy_ids[0] : null,
        is_active: editForm.is_active,
        updated_at: new Date().toISOString()
      };

      const { error: shooterError } = await supabase
        .from('shooters')
        .update(shooterUpdateData)
        .eq('user_id', editingShooter.id);

      if (shooterError) {
        console.error('❌ shooters 테이블 업데이트 에러:', shooterError);
        throw shooterError;
      }

      setShowEditModal(false);
      setEditingShooter(null);
      await loadShooters();
      
      alert('촬영자 정보가 성공적으로 수정되었습니다.');

    } catch (error: any) {
      showError('촬영자 수정 실패', error);
    } finally {
      setUploading(false);
    }
  };


  // 초기화
  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      setLoading(true);
      console.log('초기 데이터 로딩 시작...');
      
      await Promise.all([
        loadShooters(),
        loadTeams(),
        loadAcademies()
      ]);
      
      console.log('모든 데이터 로딩 완료');
    } catch (error) {
      console.error('초기 데이터 로딩 실패:', error);
      showError('데이터 로딩 실패', error);
    } finally {
      setLoading(false);
    }
  };

  const loadShooters = async () => {
    try {
      console.log('촬영자 데이터 로딩 시작...');

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('auth_id, name, phone, role, status, is_active, created_at')
        .eq('role', 'shooter')
        // ✅ 필터 제거하여 모든 촬영자 조회
        //.eq('is_active', true)  // 이 줄 주석처리 또는 삭제
        .order('name');

      if (usersError) throw usersError;
      if (!usersData?.length) {
        setShooters([]);
        return;
      }

      const userIds = usersData.map(u => u.auth_id);
      const { data: shootersData, error: shootersError } = await supabase
        .from('shooters')
        .select('user_id, shooter_type, team_id, main_location_ids, emergency_phone, is_active, created_at')
        .in('user_id', userIds);
        // ✅ 필터 제거하여 모든 촬영자 조회
        //.eq('is_active', true);  // 이 줄 주석처리 또는 삭제

      if (shootersError) throw shootersError;

      const combinedData = usersData
        .map(user => {
          const shooterInfo = shootersData?.find(s => s.user_id === user.auth_id);
          if (!shooterInfo) return null;

          return {
            id: user.auth_id,
            name: user.name || '알 수 없음',
            phone: user.phone || '',
            emergency_phone: shooterInfo.emergency_phone || '',
            role: user.role || 'shooter',
            shooter_type: shooterInfo.shooter_type,
            status: user.status || 'active',
            // ✅ 핵심 수정: 중복 제거하고 한 줄로 정리
            is_active: Boolean(user.is_active),
            // ❌ 아래 중복 줄들 모두 삭제
            // is_active: user.is_active && shooterInfo.is_active,
            // is_active: user.is_active || true,
            created_at: user.created_at || shooterInfo.created_at,
            team_id: shooterInfo.team_id,
            main_location_ids: shooterInfo.main_location_ids || [],
            team_name: '로딩중...',
            academy_names: ['로딩중...']
          };
        })
        .filter(Boolean) as Shooter[];


      await enrichWithTeamAndAcademyInfo(combinedData);
      setShooters(combinedData);

    } catch (error) {
      console.error('촬영자 데이터 로딩 실패:', error);
      setShooters([]);
    }
  };

  const enrichWithTeamAndAcademyInfo = async (shootersData: Shooter[]) => {
    try {
      const teamIds = [...new Set(shootersData.filter(s => s.team_id).map(s => s.team_id))];
      let teamsMap = new Map<number, string>();
      
      if (teamIds.length > 0) {
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds);
        
        if (teamsData) {
          teamsData.forEach(team => teamsMap.set(team.id, team.name));
        }
      }

      const allAcademyIds = [...new Set(
        shootersData
          .filter(s => s.main_location_ids && s.main_location_ids.length > 0)
          .flatMap(s => s.main_location_ids || [])
      )];
      
      let academiesMap = new Map<number, string>();
      
      if (allAcademyIds.length > 0) {
        const { data: academiesData } = await supabase
          .from('main_locations')
          .select('id, name')
          .in('id', allAcademyIds)
          .eq('is_active', true);
        
        if (academiesData) {
          academiesData.forEach(academy => 
            academiesMap.set(academy.id, academy.name)
          );
        }
      }

      shootersData.forEach(shooter => {
        if (shooter.shooter_type === 'dispatch') {
          shooter.team_name = shooter.team_id ? (teamsMap.get(shooter.team_id) || '미설정') : '미설정';
          shooter.academy_names = ['해당없음'];
        } else {
          shooter.team_name = '해당없음';
          if (shooter.main_location_ids && shooter.main_location_ids.length > 0) {
            shooter.academy_names = shooter.main_location_ids
              .map(id => academiesMap.get(id) || '알수없음')
              .filter(name => name !== '알수없음');
          } else {
            shooter.academy_names = ['미설정'];
          }
        }
      });

      shootersData.sort((a, b) => {
        if (a.shooter_type === 'dispatch' && b.shooter_type === 'freelancer') return -1;
        if (a.shooter_type === 'freelancer' && b.shooter_type === 'dispatch') return 1;
        
        if (a.shooter_type === 'dispatch' && b.shooter_type === 'dispatch') {
          const teamA = a.team_name || '';
          const teamB = b.team_name || '';
          return teamA.localeCompare(teamB);
        }
        
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      console.error('팀/학원 정보 로딩 실패:', error);
    }
  };

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, description')
        .neq('name', '영상개발실')
        .order('name');

      if (error) throw error;
      setTeams(data || []);
      console.log('팀 데이터 로딩:', data?.length || 0, '개');
    } catch (error) {
      console.error('팀 목록 조회 실패:', error);
      setTeams([]);
    }
  };

  const loadAcademies = async () => {
    try {
      const { data, error } = await supabase
        .from('main_locations')
        .select('id, name, location_type, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAcademies(data || []);
      console.log('학원 데이터 로딩:', data?.length || 0, '개');
    } catch (error) {
      console.error('학원 목록 조회 실패:', error);
      setAcademies([]);
    }
  };

  // ✅ 활성상태 토글 함수 추가
  const toggleActiveStatus = async (shooterId: number, currentStatus: boolean) => {
    try {
      setUploading(true);
      
      // users 테이블의 is_active 상태 변경
      const { error } = await supabase
        .from('users')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('auth_id', shooterId);

      if (error) throw error;

      // 데이터 새로고침
      await loadShooters();
      
      console.log(`✅ ${shooterId} 활성상태 변경: ${currentStatus} → ${!currentStatus}`);
    } catch (error) {
      console.error('활성상태 변경 실패:', error);
      showError('활성상태 변경 실패', error);
    } finally {
      setUploading(false);
    }
  };



  // 필터링된 촬영자 목록
  const filteredShooters = shooters.filter(shooter => {
    const matchesSearch = !searchTerm || 
      shooter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shooter.phone.includes(searchTerm) ||
      (shooter.emergency_phone && shooter.emergency_phone.includes(searchTerm));
    
    const matchesType = filterType === 'all' || shooter.shooter_type === filterType;
    
    const matchesTeam = filterTeam === 'all' || 
      (shooter.team_id && shooter.team_id.toString() === filterTeam);
    
    const matchesAcademy = filterAcademy === 'all' || 
      (shooter.main_location_ids && shooter.main_location_ids.some(id => id.toString() === filterAcademy));
    
    return matchesSearch && matchesType && matchesTeam && matchesAcademy;
  });

  // ✅ 촬영자 추가
  const handleAddShooter = async () => {
    try {
      if (!newShooter.name?.trim() || !newShooter.phone?.trim()) {
        alert('이름과 전화번호는 필수 입력 항목입니다.');
        return;
      }

      if (newShooter.shooter_type === 'dispatch' && !newShooter.team_id?.trim()) {
        alert('파견직 촬영자는 팀을 선택해야 합니다.');
        return;
      }

      if (newShooter.shooter_type === 'freelancer' && newShooter.academy_ids.length === 0) {
        alert('프리랜서 촬영자는 최소 하나의 학원을 선택해야 합니다.');
        return;
      }

      setUploading(true);

      const requestData = {
        name: newShooter.name.trim(),
        phone: newShooter.phone.trim(),
        emergency_phone: newShooter.emergency_phone?.trim() || null,
        shooter_type: newShooter.shooter_type,
        team_id: newShooter.shooter_type === 'dispatch' && newShooter.team_id?.trim() 
          ? parseInt(newShooter.team_id.trim()) 
          : null,
        main_location_id: newShooter.shooter_type === 'freelancer' && newShooter.academy_ids.length > 0 
          ? newShooter.academy_ids[0] 
          : null
      };

      const response = await fetch('/api/admin/create-shooter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        const apiError = new Error(result.details || result.error || '촬영자 추가 실패');
        throw apiError;
      }

      setNewShooter({
        name: '',
        phone: '',
        emergency_phone: '',
        shooter_type: 'freelancer',
        team_id: '',
        academy_ids: []
      });
      setShowAddModal(false);
      await loadShooters();
      
      alert(`촬영자 "${requestData.name}"이(가) 성공적으로 추가되었습니다.\n임시 비밀번호: ${result.tempPassword}`);

    } catch (error: any) {
      showError('촬영자 추가 실패', error);
    } finally {
      setUploading(false);
    }
  };

  // ✅ 촬영자 삭제
  const handleDeleteShooter = async (shooter: Shooter) => {
    try {
      const confirmed = window.confirm(`"${shooter.name}" 촬영자를 삭제하시겠습니까?\n삭제된 촬영자는 복구할 수 없습니다.`);
      if (!confirmed) return;

      setUploading(true);

      const response = await fetch('/api/admin/delete-shooter', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: shooter.id })
      });

      const result = await response.json();

      if (!response.ok) {
        const deleteError = new Error(result.error || '촬영자 삭제 실패');
        throw deleteError;
      }

      await loadShooters();
      alert(result.message);

    } catch (error: any) {
      showError('촬영자 삭제 실패', error);
    } finally {
      setUploading(false);
    }
  };

  // ✅ 샘플 CSV 다운로드 - 복수 학원ID 파싱 예시와 설명 강화
  const downloadSampleCSV = () => {
    try {
      const csvRows = [
        '이름,전화번호,비상연락처,타입,팀ID,학원ID',
        '김파견,010-1234-5678,010-9999-1111,dispatch,1,',
        '이프리,010-5678-1234,010-8888-2222,freelancer,,1',
        '박촬영,010-9876-5432,010-7777-3333,dispatch,2,',
        '최자유,010-3333-4444,,freelancer,,2',
        '김다중,010-5555-6666,,freelancer,,"1,2,3"',
        '이멀티,010-7777-8888,,freelancer,,"[1,2,3]"',
        '박다학원,010-9999-0000,,freelancer,,"{1,2,5}"',
        '정복수,010-1111-2222,,freelancer,,"5 6 7"',
        '한세미콜론,010-3333-4444,,freelancer,,"1;2;8"',
        '복잡한예시,010-4444-5555,,freelancer,,"1,2,3,4,5,6,7,8,9"'
      ];
      
      const csvContent = csvRows.join('\n');
      const BOM = '\uFEFF';
      const fullContent = BOM + csvContent;
      
      const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', '촬영자_업로드_샘플_복수학원ID지원.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert('📋 샘플 CSV 다운로드 완료!\n\n💡 복수 학원ID 지원 형태:\n• "1,2,3" (쉼표)\n• [1,2,3] (JSON 배열)\n• {1,2,3} (PostgreSQL)\n• "5 6 7" (공백)\n• "1;2;8" (세미콜론)\n• "1,2,3,4,5,6,7,8,9" (많은 ID)\n\n업로드 전 미리보기에서 파싱 결과를 확인하세요!');
      
    } catch (error) {
      console.error('샘플 CSV 다운로드 실패:', error);
    }
  };

  // ✅ 전체 데이터 내보내기
  const exportToCSV = () => {
    try {
      const headers = ['이름', '전화번호', '비상연락처', '타입', '소속', '활성상태', '상태', '등록일'];
      const csvRows = [headers.join(',')];

      filteredShooters.forEach(shooter => {
        const row = [
          shooter.name,
          shooter.phone,
          shooter.emergency_phone || '',
          shooter.shooter_type === 'dispatch' ? '파견직' : '프리랜서',
          shooter.shooter_type === 'dispatch' ? shooter.team_name : shooter.academy_names.join(', '),
          shooter.is_active ? '활성' : '비활성',
          shooter.status === 'active' ? '활성' : '비활성',
          new Date(shooter.created_at).toLocaleDateString('ko-KR')
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const BOM = '\uFEFF';
      const fullContent = BOM + csvContent;
      
      const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `촬영자_목록_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('데이터 내보내기 실패:', error);
    }
  };

  // ✅ CSV 파일 선택
  const handleCSVFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      parseCSVFile(file);
    }
  };

  // ✅ CSV 파일 파싱 - 따옴표 문제 해결
  const parseCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setCsvErrors(['CSV 파일에 데이터가 없습니다.']);
          return;
        }

        const headers = splitCSVRow(lines[0]); // ✅ 개선된 파싱 사용
        const errors: string[] = [];
        const preview: CSVRow[] = [];

        const requiredHeaders = ['이름', '전화번호', '타입'];
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
          errors.push(`필수 헤더가 누락되었습니다: ${missingHeaders.join(', ')}`);
        }

        for (let i = 1; i < lines.length; i++) {
          const values = splitCSVRow(lines[i]); // ✅ 개선된 파싱 사용
          const row: any = {};
          
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          const lineNum = i + 1;
          
          // ✅ 원본 데이터 보존
          row['원본_학원ID'] = row['학원ID'] || '';

          if (!row['이름']) {
            errors.push(`${lineNum}번째 줄: 이름이 필요합니다.`);
          }
          if (!row['전화번호']) {
            errors.push(`${lineNum}번째 줄: 전화번호가 필요합니다.`);
          }
          if (!['dispatch', 'freelancer'].includes(row['타입'])) {
            errors.push(`${lineNum}번째 줄: 타입은 'dispatch' 또는 'freelancer'여야 합니다.`);
          }
          if (row['타입'] === 'dispatch' && !row['팀ID']) {
            errors.push(`${lineNum}번째 줄: 파견직은 팀ID가 필요합니다.`);
          }
          if (row['타입'] === 'freelancer' && !row['학원ID']) {
            errors.push(`${lineNum}번째 줄: 프리랜서는 학원ID가 필요합니다.`);
          }

          // ✅ 학원ID 복수 처리 및 미리보기 표시
          if (row['학원ID']) {
            const academyIds = parseAcademyIds(row['학원ID']);
            if (academyIds.length === 0) {
              errors.push(`${lineNum}번째 줄: 학원ID 형식이 올바르지 않습니다. (예: "1,2,3", "[1,2,3]", "{1,2,3}")`);
              row['파싱결과'] = '❌ 파싱 실패';
              row['학원ID'] = row['원본_학원ID']; // 원본 유지
            } else {
              // ✅ PostgreSQL 배열 형태로 저장
              row['parsed_academy_ids'] = academyIds;
              row['db_academy_ids'] = formatAcademyIdsForDB(academyIds);
              
              // ✅ 미리보기에서 파싱 결과 표시
              if (academyIds.length > 1) {
                row['학원ID'] = `${academyIds.join(', ')} (${academyIds.length}개 학원)`;
                row['파싱결과'] = `✅ ${academyIds.length}개 학원 파싱됨`;
              } else {
                row['학원ID'] = academyIds[0].toString();
                row['파싱결과'] = '✅ 단일 학원';
              }
            }
          } else {
            row['파싱결과'] = '-';
          }

          preview.push(row);
        }

        setCsvPreview(preview);
        setCsvErrors(errors);
        setShowCSVUploadModal(true);

        console.log('📊 CSV 파싱 완료:', {
          totalRows: preview.length,
          errors: errors.length,
          multiAcademyRows: preview.filter(row => row.parsed_academy_ids?.length > 1).length
        });

      } catch (error) {
        console.error('CSV 파싱 오류:', error);
        setCsvErrors(['CSV 파일을 읽는 중 오류가 발생했습니다.']);
        setShowCSVUploadModal(true);
      }
    };
    
    reader.readAsText(file, 'utf-8');
  };

  // ✅ CSV 업로드 - PostgreSQL 배열 형태로 전송
  const handleCSVUpload = async () => {
    if (csvErrors.length > 0) {
      alert('오류를 수정한 후 다시 업로드해주세요.');
      return;
    }

    try {
      setUploading(true);
      
      // ✅ PostgreSQL 배열 형태로 데이터 전송
      const processedCsvData = csvPreview.map(row => ({
        이름: row['이름'],
        전화번호: row['전화번호'],
        비상연락처: row['비상연락처'] || '',
        타입: row['타입'],
        팀ID: row['팀ID'] || '',
        학원ID: row['db_academy_ids'] || '',  // ✅ PostgreSQL 형태: {1,2,3}
        // 추가 정보
        academy_ids_array: row['parsed_academy_ids'] || [],  // 숫자 배열
        main_location_ids: row['parsed_academy_ids'] || []   // DB 저장용
      }));

      console.log('📤 CSV 업로드 데이터 (PostgreSQL 배열 형태):', processedCsvData);

      const response = await fetch('/api/admin/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: processedCsvData })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'CSV 업로드 실패');
      }

      await loadShooters();
      setShowCSVUploadModal(false);
      setCsvFile(null);
      setCsvPreview([]);
      setCsvErrors([]);

      let resultMessage = `CSV 업로드 완료!\n성공: ${result.successCount}명\n실패: ${result.errorCount}명`;
      if (result.errorMessages && result.errorMessages.length > 0) {
        resultMessage += '\n\n실패 상세:\n' + result.errorMessages.join('\n');
      }

      alert(resultMessage);

    } catch (error: any) {
      showError('CSV 업로드 실패', error);
    } finally {
      setUploading(false);
    }
  };

  // ✅ 필터 초기화
  const resetFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterTeam('all');
    setFilterAcademy('all');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #f3f4f6',
          borderTop: '4px solid #4f46e5',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ fontSize: '18px', color: '#6b7280' }}>촬영자 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '16px', 
      maxWidth: '1440px',
      minWidth: '320px',
      margin: '0 auto', 
      minHeight: '100vh', 
      background: '#f9fafb',
      width: '100%'
    }}>
      {/* CSS */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @media (max-width: 767px) {
            .container { 
              padding: 8px !important; 
              max-width: 100% !important; 
              min-width: 320px !important; 
            }
            .stats-grid { 
              grid-template-columns: repeat(2, 1fr) !important; 
              gap: 8px !important; 
            }
            .filter-grid { 
              grid-template-columns: 1fr !important; 
              gap: 10px !important; 
            }
            .stat-card { 
              padding: 12px !important; 
              min-height: 80px !important; 
            }
            .stat-number { 
              font-size: 20px !important; 
            }
            .stat-text { 
              font-size: 12px !important; 
            }
            .responsive-table { 
              font-size: 14px !important; 
            }
            .responsive-table th, 
            .responsive-table td { 
              padding: 10px !important; 
            }
            .header-buttons { 
              flex-direction: column !important; 
              width: 100% !important; 
            }
            .header-buttons button,
            .header-buttons label { 
              width: 100% !important; 
            }
          }
        `}
      </style>

      <div className="container">
        {/* 헤더 섹션 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
            padding: '20px' 
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div>
                <h1 style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  margin: '0 0 6px 0', 
                  color: '#111827'
                }}>
                  촬영자 관리
                </h1>
                <p style={{ 
                  margin: 0, 
                  color: '#6b7280', 
                  fontSize: '16px' 
                }}>
                  파견직 및 프리랜서 촬영자를 효율적으로 관리합니다
                </p>
              </div>
              
              <div className="header-buttons" style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '8px' 
              }}>
                <button
                  onClick={exportToCSV}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    color: '#374151',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  내보내기
                </button>
                
                <button
                  onClick={downloadSampleCSV}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    color: '#374151',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  샘플
                </button>
                
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  color: 'white',
                  background: '#059669',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  gap: '4px',
                  border: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#047857'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#059669'}
                >
                  CSV 업로드
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleCSVFileChange}
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                </label>
                
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '10px 14px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    color: 'white',
                    background: '#4f46e5',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#4338ca'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#4f46e5'}
                >
                  촬영자 추가
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="stats-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '12px', 
          marginBottom: '20px' 
        }}>
          <div className="stat-card" style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            borderRadius: '10px', 
            padding: '16px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '100px'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="stat-number" style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                {shooters.length}
              </div>
              <div className="stat-text" style={{ opacity: 0.9, fontSize: '14px' }}>전체 촬영자</div>
            </div>
          </div>

          <div className="stat-card" style={{ 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
            borderRadius: '10px', 
            padding: '16px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '100px'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="stat-number" style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                {shooters.filter(s => s.shooter_type === 'dispatch').length}
              </div>
              <div className="stat-text" style={{ opacity: 0.9, fontSize: '14px' }}>파견직</div>
            </div>
          </div>

          <div className="stat-card" style={{ 
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 
            borderRadius: '10px', 
            padding: '16px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '100px'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="stat-number" style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                {shooters.filter(s => s.shooter_type === 'freelancer').length}
              </div>
              <div className="stat-text" style={{ opacity: 0.9, fontSize: '14px' }}>프리랜서</div>
            </div>
          </div>

          <div className="stat-card" style={{ 
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', 
            borderRadius: '10px', 
            padding: '16px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '100px'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="stat-number" style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
                {teams.length + academies.length}
              </div>
              <div className="stat-text" style={{ opacity: 0.9, fontSize: '14px' }}>활성 팀/학원</div>
            </div>
          </div>
        </div>

        {/* 필터 */}
        <div style={{ 
          background: 'white', 
          borderRadius: '10px', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
          padding: '16px', 
          marginBottom: '16px' 
        }}>
          <div className="filter-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(5, 1fr)', 
            gap: '12px' 
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#374151',
                fontSize: '15px'
              }}>
                검색
              </label>
              <input
                type="text"
                placeholder="이름, 전화번호..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '15px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#374151',
                fontSize: '15px'
              }}>
                타입
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '15px',
                  background: 'white',
                  outline: 'none'
                }}
              >
                <option value="all">전체 타입</option>
                <option value="dispatch">파견직</option>
                <option value="freelancer">프리랜서</option>
              </select>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#374151',
                fontSize: '15px'
              }}>
                팀
              </label>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '15px',
                  background: 'white',
                  outline: 'none'
                }}
              >
                <option value="all">전체 팀</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id.toString()}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#374151',
                fontSize: '15px'
              }}>
                학원
              </label>
              <select
                value={filterAcademy}
                onChange={(e) => setFilterAcademy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '15px',
                  background: 'white',
                  outline: 'none'
                }}
              >
                <option value="all">전체 학원</option>
                {academies.map(academy => (
                  <option key={academy.id} value={academy.id.toString()}>
                    {academy.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                onClick={resetFilters}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  fontSize: '15px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  color: '#374151',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                초기화
              </button>
            </div>
          </div>

          <div style={{ 
            marginTop: '12px', 
            fontSize: '15px', 
            color: '#6b7280',
            textAlign: 'center'
          }}>
            전체 <strong>{shooters.length}</strong>명 중 <strong>{filteredShooters.length}</strong>명 표시
          </div>
        </div>

        {/* 테이블 */}
        <div style={{ 
          background: 'white', 
          borderRadius: '10px', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '19px', 
              fontWeight: '600', 
              color: '#111827',
              textAlign: 'center'
            }}>
              촬영자 목록
            </h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '16px',
              minWidth: '800px'
            }} className="responsive-table">
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    이름
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    전화번호
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    비상연락처
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    구분
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    소속
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    활성상태
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    등록일
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#6b7280', 
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredShooters.map((shooter, index) => (
                  <tr 
                    key={shooter.id} 
                    style={{ 
                      borderBottom: '1px solid #f3f4f6'
                    }}
                  >
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center',
                      fontWeight: '600', 
                      color: '#111827',
                      fontSize: '16px'
                    }}>
                      {shooter.name}
                    </td>
                    
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center',
                      color: '#111827', 
                      fontWeight: '500',
                      fontSize: '16px'
                    }}>
                      {shooter.phone}
                    </td>
                    
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center',
                      fontSize: '15px', 
                      color: shooter.emergency_phone ? '#dc2626' : '#9ca3af' 
                    }}>
                      {shooter.emergency_phone || '-'}
                    </td>
                    
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center' 
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '6px 14px',
                        fontSize: '13px',
                        fontWeight: '600',
                        borderRadius: '12px',
                        background: shooter.shooter_type === 'dispatch' ? '#dcfce7' : '#e0e7ff',
                        color: shooter.shooter_type === 'dispatch' ? '#166534' : '#1e40af'
                      }}>
                        {shooter.shooter_type === 'dispatch' ? '파견직' : '프리랜서'}
                      </span>
                    </td>
                    
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center',
                      color: '#111827', 
                      fontWeight: '500',
                      fontSize: '16px'
                    }}>
                      {shooter.shooter_type === 'dispatch' ? shooter.team_name : shooter.academy_names.join(', ')}
                    </td>
                                        
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center' 
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '20px',
                        // ✅ is_active와 status 둘 다 고려
                        background: (shooter.is_active && shooter.status === 'active') ? '#dcfce7' : '#fee2e2',
                        color: (shooter.is_active && shooter.status === 'active') ? '#166534' : '#dc2626'
                      }}>
                        {(shooter.is_active && shooter.status === 'active') ? '활성' : '비활성'}
                      </span>
                    </td>



                    
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center',
                      fontSize: '14px', 
                      color: '#6b7280'
                    }}>
                      {new Date(shooter.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center' 
                    }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEditShooter(shooter)}
                          style={{
                            padding: '6px 12px',
                            background: '#3b82f6',
                            border: '1px solid #2563eb',
                            cursor: 'pointer',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteShooter(shooter)}
                          style={{
                            padding: '6px 12px',
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
                            color: '#dc2626',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                          title="삭제"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredShooters.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: '#111827',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                촬영자가 없습니다
              </h3>
              <p style={{ 
                margin: '0 0 16px 0',
                fontSize: '16px'
              }}>
                새 촬영자를 추가해보세요.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  color: 'white',
                  background: '#4f46e5',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                첫 번째 촬영자 추가
              </button>
            </div>
          )}
        </div>

        {/* ✅ 수정 모달 (작은 크기) */}
        {showEditModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '20px' 
              }}>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '18px', 
                  fontWeight: '600',
                  color: '#111827'
                }}>
                  촬영자 정보 수정
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 이름 */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px', 
                    fontWeight: '500',
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    이름 *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="촬영자 이름"
                  />
                </div>

                {/* 전화번호 */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px', 
                    fontWeight: '500',
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    전화번호 *
                  </label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="010-0000-0000"
                  />
                </div>

                {/* 비상연락처 */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px', 
                    fontWeight: '500',
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    비상연락처
                  </label>
                  <input
                    type="text"
                    value={editForm.emergency_phone}
                    onChange={(e) => setEditForm({ ...editForm, emergency_phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="010-0000-0000"
                  />
                </div>

                {/* 타입 */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '4px', 
                    fontWeight: '500',
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    타입 *
                  </label>
                  <select
                    value={editForm.shooter_type}
                    onChange={(e) => setEditForm({ 
                      ...editForm, 
                      shooter_type: e.target.value as 'dispatch' | 'freelancer',
                      team_id: '',
                      academy_ids: []
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: 'white',
                      outline: 'none'
                    }}
                  >
                    <option value="freelancer">프리랜서</option>
                    <option value="dispatch">파견직</option>
                  </select>
                </div>

                {/* 팀 선택 (파견직인 경우만, 영상개발실 제외) */}
                {editForm.shooter_type === 'dispatch' && (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '4px', 
                      fontWeight: '500',
                      color: '#374151',
                      fontSize: '14px'
                    }}>
                      팀 *
                    </label>
                    <select
                      value={editForm.team_id}
                      onChange={(e) => setEditForm({ ...editForm, team_id: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: 'white',
                        outline: 'none'
                      }}
                    >
                      <option value="">팀을 선택하세요</option>
                      {teams.filter(team => team.name !== '영상개발실').map(team => (
                        <option key={team.id} value={team.id.toString()}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 학원 선택 (프리랜서인 경우만) - 복수 선택 지원 */}
                {editForm.shooter_type === 'freelancer' && (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '4px', 
                      fontWeight: '500',
                      color: '#374151',
                      fontSize: '14px'
                    }}>
                      학원 * (복수 선택 가능)
                    </label>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px' }}>
                      {academies.map(academy => (
                        <label key={academy.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 0',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}>
                          <input
                            type="checkbox"
                            checked={editForm.academy_ids.includes(academy.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditForm({
                                  ...editForm,
                                  academy_ids: [...editForm.academy_ids, academy.id]
                                });
                              } else {
                                setEditForm({
                                  ...editForm,
                                  academy_ids: editForm.academy_ids.filter(id => id !== academy.id)
                                });
                              }
                            }}
                            style={{ width: '14px', height: '14px' }}
                          />
                          {academy.name} ({academy.location_type})
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ 활성 상태 토글 */}
                <div>
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer'
                      }}
                    />
                    활성 상태
                  </label>
                </div>

              {/* ✅ 상태 선택 - 이미 올바르게 설정됨 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '4px', 
                  fontWeight: '500',
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  상태
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: 'white',
                    outline: 'none'
                  }}
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
              </div>


              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '8px', 
                marginTop: '20px' 
              }}>
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={uploading}
                  style={{
                    padding: '8px 16px',
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6b7280',
                    opacity: uploading ? 0.5 : 1
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleUpdateShooter}
                  disabled={uploading}
                  style={{
                    padding: '8px 16px',
                    background: uploading ? '#9ca3af' : '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {uploading && (
                    <div style={{ 
                      width: '14px', 
                      height: '14px', 
                      border: '2px solid transparent',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  )}
                  {uploading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 촬영자 추가 모달 */}
        {showAddModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              padding: '32px',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '24px' 
              }}>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '22px', 
                  fontWeight: '700',
                  color: '#111827'
                }}>
                  새 촬영자 추가
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '4px',
                    borderRadius: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '15px'
                  }}>
                    이름 *
                  </label>
                  <input
                    type="text"
                    value={newShooter.name}
                    onChange={(e) => setNewShooter({ ...newShooter, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '15px',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    placeholder="촬영자 이름을 입력하세요"
                    onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '15px'
                  }}>
                    전화번호 *
                  </label>
                  <input
                    type="text"
                    value={newShooter.phone}
                    onChange={(e) => setNewShooter({ ...newShooter, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '15px',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    placeholder="010-0000-0000"
                    onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '15px'
                  }}>
                    비상연락처
                  </label>
                  <input
                    type="text"
                    value={newShooter.emergency_phone}
                    onChange={(e) => setNewShooter({ ...newShooter, emergency_phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '15px',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    placeholder="010-0000-0000"
                    onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '15px'
                  }}>
                    타입 *
                  </label>
                  <select
                    value={newShooter.shooter_type}
                    onChange={(e) => setNewShooter({ 
                      ...newShooter, 
                      shooter_type: e.target.value as 'dispatch' | 'freelancer',
                      team_id: '',
                      academy_ids: []
                    })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '15px',
                      background: 'white',
                      outline: 'none'
                    }}
                  >
                    <option value="freelancer">프리랜서</option>
                    <option value="dispatch">파견직</option>
                  </select>
                </div>

                {newShooter.shooter_type === 'dispatch' && (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '6px', 
                      fontWeight: '600',
                      color: '#374151',
                      fontSize: '15px'
                    }}>
                      팀 *
                    </label>
                    <select
                      value={newShooter.team_id}
                      onChange={(e) => setNewShooter({ ...newShooter, team_id: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '15px',
                        background: 'white',
                        outline: 'none'
                      }}
                    >
                      <option value="">팀을 선택하세요</option>
                      {teams.filter(team => team.name !== '영상개발실').map(team => (
                        <option key={team.id} value={team.id.toString()}>
                          {team.name}
                          {team.description && ` (${team.description})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newShooter.shooter_type === 'freelancer' && (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '6px', 
                      fontWeight: '600',
                      color: '#374151',
                      fontSize: '15px'
                    }}>
                      학원 *
                    </label>
                    <select
                      value={newShooter.academy_ids[0] || ''}
                      onChange={(e) => setNewShooter({ 
                        ...newShooter, 
                        academy_ids: e.target.value ? [parseInt(e.target.value)] : [] 
                      })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '15px',
                        background: 'white',
                        outline: 'none'
                      }}
                    >
                      <option value="">학원을 선택하세요</option>
                      {academies.map(academy => (
                        <option key={academy.id} value={academy.id.toString()}>
                          {academy.name} ({academy.location_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px', 
                marginTop: '32px' 
              }}>
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={uploading}
                  style={{
                    padding: '12px 20px',
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#6b7280',
                    transition: 'all 0.2s',
                    opacity: uploading ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => !uploading && (e.currentTarget.style.borderColor = '#d1d5db')}
                  onMouseLeave={(e) => !uploading && (e.currentTarget.style.borderColor = '#e5e7eb')}
                >
                  취소
                </button>
                <button
                  onClick={handleAddShooter}
                  disabled={uploading}
                  style={{
                    padding: '12px 20px',
                    background: uploading ? '#9ca3af' : '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => !uploading && (e.currentTarget.style.background = '#4338ca')}
                  onMouseLeave={(e) => !uploading && (e.currentTarget.style.background = '#4f46e5')}
                >
                  {uploading && (
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid transparent',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  )}
                  {uploading ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSV 업로드 모달 */}
        {showCSVUploadModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              padding: '32px',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '1000px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '24px' 
              }}>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '22px', 
                  fontWeight: '700',
                  color: '#111827'
                }}>
                  CSV 파일 업로드 미리보기
                </h3>
                <button
                  onClick={() => {
                    setShowCSVUploadModal(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                    setCsvErrors([]);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  ✕
                </button>
              </div>

              {csvErrors.length > 0 && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ 
                    margin: '0 0 8px 0', 
                    color: '#dc2626',
                    fontSize: '17px',
                    fontWeight: '600'
                  }}>
                    오류 발견:
                  </h4>
                  <div style={{ 
                    maxHeight: '150px', 
                    overflowY: 'auto',
                    background: 'white',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #fee2e2'
                  }}>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#dc2626' }}>
                      {csvErrors.map((error, index) => (
                        <li key={index} style={{ marginBottom: '4px', fontSize: '14px' }}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* ✅ 미리보기 테이블 - 복수 학원ID 파싱 결과 표시 */}
              <div style={{
                background: '#f9fafb',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <h4 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '17px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  업로드할 데이터 ({csvPreview.length}명):
                </h4>
                
                <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                    minWidth: '900px'
                  }}>
                    <thead>
                      <tr style={{ background: '#e5e7eb' }}>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>이름</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>전화번호</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>비상연락처</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>타입</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>팀ID</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db', background: '#fef3c7' }}>
                          원본 학원ID
                        </th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db', background: '#d1fae5' }}>
                          파싱된 학원ID
                        </th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db', background: '#e0f2fe' }}>
                          파싱 결과
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, index) => (
                        <tr key={index}>
                          <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                            {row['이름']}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                            {row['전화번호']}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                            {row['비상연락처'] || '-'}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              background: row['타입'] === 'dispatch' ? '#dcfce7' : '#e0e7ff',
                              color: row['타입'] === 'dispatch' ? '#166534' : '#1e40af'
                            }}>
                              {row['타입'] === 'dispatch' ? '파견직' : '프리랜서'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                            {row['팀ID'] || '-'}
                          </td>
                          <td style={{ 
                            padding: '10px', 
                            textAlign: 'center', 
                            border: '1px solid #d1d5db',
                            background: '#fef3c7',
                            fontSize: '12px',
                            fontFamily: 'monospace'
                          }}>
                            {row['원본_학원ID'] || '-'}
                          </td>
                          <td style={{ 
                            padding: '10px', 
                            textAlign: 'center', 
                            border: '1px solid #d1d5db',
                            background: '#d1fae5',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {row['학원ID'] || '-'}
                          </td>
                          <td style={{ 
                            padding: '10px', 
                            textAlign: 'center', 
                            border: '1px solid #d1d5db',
                            background: '#e0f2fe',
                            fontSize: '11px'
                          }}>
                            {row['파싱결과'] || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {csvPreview.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      📊 파싱 통계
                    </h5>
                    <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                      <span>
                        <strong>전체:</strong> {csvPreview.length}명
                      </span>
                      <span>
                        <strong>복수 학원:</strong> {csvPreview.filter(row => row.parsed_academy_ids?.length > 1).length}명
                      </span>
                      <span>
                        <strong>단일 학원:</strong> {csvPreview.filter(row => row.parsed_academy_ids?.length === 1).length}명
                      </span>
                      <span style={{ color: '#dc2626' }}>
                        <strong>파싱 실패:</strong> {csvPreview.filter(row => row['파싱결과']?.includes('❌')).length}명
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px' 
              }}>
                <button
                  onClick={() => {
                    setShowCSVUploadModal(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                    setCsvErrors([]);
                  }}
                  disabled={uploading}
                  style={{
                    padding: '12px 20px',
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#6b7280',
                    transition: 'all 0.2s',
                    opacity: uploading ? 0.5 : 1
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleCSVUpload}
                  disabled={uploading || csvErrors.length > 0}
                  style={{
                    padding: '12px 20px',
                    background: (uploading || csvErrors.length > 0) ? '#9ca3af' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: (uploading || csvErrors.length > 0) ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => !uploading && csvErrors.length === 0 && (e.currentTarget.style.background = '#047857')}
                  onMouseLeave={(e) => !uploading && csvErrors.length === 0 && (e.currentTarget.style.background = '#059669')}
                >
                  {uploading && (
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid transparent',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  )}
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShootersManagement;

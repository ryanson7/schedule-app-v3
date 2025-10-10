"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

// 실제 테이블 구조에 맞게 수정된 타입 정의
interface Professor {
  id: number;
  name: string;
  email?: string;
  phone: string;
  phone_display: string;
  phone_raw: string;
  role: string;
  status: string;
  professor_category_id?: number;
  secondary_category_id?: number;
  temp_password?: string;
  is_temp_password: boolean;
  is_active: boolean;
  auth_id?: string;
  created_at: string;
  updated_at: string;
  professor_categories?: {
    id: number;
    category_name: string;
  };
  secondary_categories?: {
    id: number;
    category_name: string;
  };
}

interface Category {
  id: number;
  category_code: string;
  category_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  phone: string;
  primary_category: string;
  secondary_category: string;
  status: 'active' | 'inactive';
}

interface CreateProfessorData {
  name: string;
  phone: string;
  professor_category_id?: number;
  secondary_category_id?: number;
  status: 'active' | 'inactive';
}

interface CreateProfessorResult {
  action: 'created' | 'updated_secondary' | 'skipped';
  message: string;
  tempPassword: string | null;
  tempEmail?: string | null;
}

interface UploadResults {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// 유틸리티 함수들
const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/[^0-9]/g, '');
};

const formatPhoneNumber = (phone: string): string => {
  const numbers = phone.replace(/[^0-9]/g, '');
  
  if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  
  return numbers;
};

const validatePhoneNumber = (phone: string): boolean => {
  const numbers = normalizePhoneNumber(phone);
  return numbers.length === 11 && numbers.startsWith('010');
};

const generateTempEmail = (phone: string): string => {
  const cleanPhone = normalizePhoneNumber(phone);
  return `${cleanPhone}@professor.temp`;
};

const ProfessorList: React.FC = (): JSX.Element => {
  // State 정의
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [filteredProfessors, setFilteredProfessors] = useState<Professor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState<boolean>(false);
  const [tempPassword, setTempPassword] = useState<string>('');
  const [tempEmail, setTempEmail] = useState<string>('');
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // ✅ 검색 및 필터 상태 추가
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    primary_category: '',
    secondary_category: '',
    status: 'active'
  });

  // Effect Hooks
  useEffect(() => {
    fetchData();
  }, []);

  // ✅ 필터링 로직
  useEffect(() => {
    let filtered = professors;

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(prof => 
        prof.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prof.phone.includes(searchTerm.replace(/[^0-9]/g, ''))
      );
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(prof => prof.status === statusFilter);
    }

    // 카테고리 필터
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(prof => 
        prof.professor_category_id?.toString() === categoryFilter ||
        prof.secondary_category_id?.toString() === categoryFilter
      );
    }

    setFilteredProfessors(filtered);
  }, [professors, searchTerm, statusFilter, categoryFilter]);

  const handleCSVUpload = async (file: File): Promise<void> => {
    try {
      setUploading(true);
      setUploadProgress(0);
      
      console.log('📁 CSV 파일 처리 시작:', file.name);
      
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV 파일이 비어있거나 헤더만 있습니다.');
      }
      
      const dataLines = lines.slice(1); // 헤더 제외
      console.log(`📊 총 ${dataLines.length}개 행 처리 예정`);
      
      const results: string[] = [];
      let successCount = 0;
      let errorCount = 0;
      let skipCount = 0;
      
      // 순차 처리로 안정성 확보
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        
        if (!line.trim()) {
          skipCount++;
          continue;
        }
        
        // CSV 파싱 개선
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        if (values.length < 2) {
          results.push(`⚠️ 건너뜀 (행 ${i + 2}): 데이터가 부족합니다`);
          skipCount++;
          continue;
        }
        
        const professorData: CreateProfessorData = {
          name: values[0] || '',
          phone: values[1] || '',
          professor_category_id: values[2] && !isNaN(parseInt(values[2])) ? parseInt(values[2]) : undefined,
          secondary_category_id: values[3] && !isNaN(parseInt(values[3])) ? parseInt(values[3]) : undefined,
          status: (values[4] || 'active') as 'active' | 'inactive'
        };
        
        // 필수 데이터 검증 강화
        if (!professorData.name || professorData.name.length < 2) {
          results.push(`⚠️ 건너뜀 (행 ${i + 2}): 이름이 없거나 너무 짧습니다`);
          skipCount++;
          continue;
        }
        
        if (!professorData.phone || professorData.phone.length < 10) {
          results.push(`⚠️ 건너뜀 (행 ${i + 2}): 휴대폰번호가 올바르지 않습니다`);
          skipCount++;
          continue;
        }
        
        // 개별 처리 및 결과 기록
        try {
          const result = await createOrUpdateProfessor(professorData);
          
          if (result.action === 'created') {
            successCount++;
            results.push(`✅ (행 ${i + 2}) ${result.message}`);
          } else if (result.action === 'skipped') {
            skipCount++;
            results.push(`⏭️ (행 ${i + 2}) ${result.message}`);
          } else {
            errorCount++;
            results.push(`❌ (행 ${i + 2}) ${result.message}`);
          }
        } catch (individualError) {
          errorCount++;
          results.push(`❌ (행 ${i + 2}) ${professorData.name}: ${individualError instanceof Error ? individualError.message : '처리 실패'}`);
        }
        
        // 진행률 업데이트
        const progress = Math.round(((i + 1) / dataLines.length) * 100);
        setUploadProgress(progress);
        
        // 서버 부하 방지를 위한 지연
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      setUploadProgress(100);
      
      // 상세한 결과 요약
      const summary = `
📊 CSV 업로드 완료!

📈 최종 결과:
• ✅ 성공: ${successCount}명
• ⏭️ 건너뜀: ${skipCount}명  
• ❌ 실패: ${errorCount}명
• 📋 총 처리: ${dataLines.length}명

${successCount > 0 ? '🎉 Supabase Authentication에도 계정이 생성되었습니다!' : ''}

📝 상세 내역 (최근 10개):
${results.slice(-10).join('\n')}

${results.length > 10 ? `\n... 외 ${results.length - 10}개 결과` : ''}
      `;
      
      console.log('📊 전체 업로드 결과:');
      results.forEach(result => console.log(result));
      
      alert(summary);
      
    } catch (error) {
      console.error('❌ CSV 업로드 전체 오류:', error);
      alert(`업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      
      setTimeout(() => {
        fetchData();
      }, 1000);
    }
  };

  // API 호출로 변경된 데이터 조회 함수
  const fetchData = async (): Promise<void> => {
    try {
      setLoading(true);
      console.log('📊 교수 데이터 조회 시작...');
      
      // 교수 데이터는 API로 조회
      const professorsResponse = await fetch('/api/professors/get-professors');
      const professorsResult = await professorsResponse.json();
      
      if (professorsResult.success && professorsResult.data) {
        setProfessors(professorsResult.data);
        console.log('✅ 교수 데이터 조회 성공:', professorsResult.data.length, '명');
      } else {
        console.error('❌ 교수 조회 실패:', professorsResult.error);
        setProfessors([]);
      }

      // 카테고리는 기존 방식 유지
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('professor_categories')
        .select('*')
        .eq('is_active', true)
        .order('category_name');

      if (categoriesError) {
        console.error('❌ 카테고리 조회 오류:', categoriesError);
        setCategories([]);
      } else {
        console.log('✅ 카테고리 데이터 조회 성공:', categoriesData?.length, '개');
        if (categoriesData) {
          setCategories(categoriesData);
        }
      }
      
    } catch (error) {
      console.error('❌ fetchData 전체 오류:', error);
      alert(`데이터 조회 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setProfessors([]);
      setCategories([]);
    } finally {
      setLoading(false);
      console.log('📊 교수 데이터 조회 완료');
    }
  };

  // 중복 확인은 기존 방식 유지
  const checkDuplicate = async (phone: string, excludeId?: number) => {
    const { data } = await supabase
      .from('professors')
      .select('id, name, phone')
      .eq('phone', normalizePhoneNumber(phone))
      .eq('is_active', true)
      .neq('id', excludeId || 0);
      
    return data && data.length > 0;
  };

  // 임시 패스워드 생성
  const generateTempPassword = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // API 호출로 변경된 교수 생성 함수
  const createOrUpdateProfessor = async (professorData: CreateProfessorData): Promise<CreateProfessorResult> => {
    try {
      console.log(`🔍 교수 등록 시도: ${professorData.name} (${professorData.phone})`);

      const response = await fetch('/api/professors/create-professor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(professorData)
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ 등록 완료: ${professorData.name}`);
        return { 
          action: 'created', 
          message: `${professorData.name} 교수가 등록되었습니다.`,
          tempPassword: result.tempPassword
        };
      } else {
        if (result.error && result.error.includes('이미 등록')) {
          return { 
            action: 'skipped', 
            message: result.error,
            tempPassword: null
          };
        }
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ 교수 등록 전체 오류:', error);
      return {
        action: 'error' as any,
        message: `${professorData.name} 등록 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        tempPassword: null
      };
    }
  };

  // ✅ 전문 분야 렌더링 함수 개선 (텍스트로 표시)
  const renderCategories = (professor: Professor): string => {
    const categories: string[] = [];
    
    if (professor.professor_categories?.category_name) {
      categories.push(professor.professor_categories.category_name);
    }
    
    if (professor.secondary_categories?.category_name) {
      categories.push(professor.secondary_categories.category_name);
    }
    
    return categories.length > 0 ? categories.join(', ') : '미지정';
  };

  const downloadSampleCSV = (): void => {
    const csvRows = [
      'name,phone,professor_category_id,secondary_category_id,status,,,카테고리 ID 참고,',
      '홍길동,01012345678,1,,active,,,ID,카테고리명',
      '김교수,01023456789,2,1,active,,,1,공인중개사',
      '이강사,01034567890,3,,active,,,2,부동산아카데미',
      '박선생,01045678901,4,2,active,,,3,주택관리사',
      '최전문가,01056789012,5,,active,,,4,9급 공무원',
    ];

    categories.forEach((cat, index) => {
      if (index < 20) {
        csvRows.push(`,,,,,,,${cat.id},${cat.category_name}`);
      }
    });

    csvRows.push(...[
      '',
      ',,,,,,,,※ 주의사항:',
      ',,,,,,,,- name과 phone은 필수',
      ',,,,,,,,- 카테고리는 ID 숫자로 입력',
      ',,,,,,,,- 우측 참고표에서 ID 확인',
      ',,,,,,,,- 휴대폰번호는 숫자만 입력',
      ',,,,,,,,- users + professors 테이블에 자동 분산 저장'
    ]);

    const csvContent = csvRows.join('\n');
    const BOM = '\uFEFF';
    const fullContent = BOM + csvContent;
    
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', '교수_업로드_샘플.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 파일 선택 핸들러
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (): Promise<void> => {
    if (!selectedFile) {
      alert('파일을 선택해주세요.');
      return;
    }

    setUploadLoading(true);

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('올바른 CSV 파일이 아닙니다.');
        setUploadLoading(false);
        return;
      }

      const professors: CreateProfessorData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith(',,,')) {
          const values = line.split(',').slice(0, 5).map(v => v.replace(/"/g, '').trim());
          
          if (values[0] && values[1]) {
            const professor: CreateProfessorData = {
              name: values[0],
              phone: values[1], 
              professor_category_id: values[2] ? parseInt(values[2]) : undefined,
              secondary_category_id: values[3] ? parseInt(values[3]) : undefined,
              status: (values[4] as 'active' | 'inactive') || 'active'
            };
            
            professors.push(professor);
          }
        }
      }

      if (professors.length === 0) {
        alert('유효한 교수 데이터가 없습니다.');
        setUploadLoading(false);
        return;
      }

      const results: UploadResults = { created: 0, updated: 0, skipped: 0, errors: [] };
      
      for (const prof of professors) {
        try {
          const result = await createOrUpdateProfessor(prof);
          
          if (result.action === 'created') {
            results.created++;
          } else if (result.action === 'updated_secondary') {
            results.updated++;
          } else if (result.action === 'skipped') {
            results.skipped++;
          }
        } catch (error) {
          results.errors.push(`${prof.name} (${prof.phone}): ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }
      
      let message = `처리 완료!\n`;
      message += `✅ 신규 등록: ${results.created}명\n`;
      message += `🔄 복수분야 추가: ${results.updated}명\n`;
      message += `⏭️ 건너뜀: ${results.skipped}명\n`;
      
      if (results.errors.length > 0) {
        message += `❌ 실패: ${results.errors.length}명\n\n실패 내역:\n${results.errors.join('\n')}`;
      }
      
      alert(message);
      setShowImportModal(false);
      setSelectedFile(null);
      fetchData();
      
    } catch (error) {
      alert(`파일 업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setUploadLoading(false);
    }
  };

  // 파일 선택 취소
  const cancelFileSelection = (): void => {
    setSelectedFile(null);
    const fileInput = document.getElementById('csvFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('이름과 휴대폰번호는 필수입니다.');
      return;
    }

    const normalizedPhone = normalizePhoneNumber(formData.phone);
    
    if (normalizedPhone.length !== 11 || !normalizedPhone.startsWith('010')) {
      alert('올바른 휴대폰번호를 입력해주세요. (010으로 시작하는 11자리)');
      return;
    }

    try {
      if (!editingProfessor) {
        const isDuplicate = await checkDuplicate(normalizedPhone);
        if (isDuplicate) {
          alert('이미 등록된 휴대폰번호입니다.');
          return;
        }
      }

      if (editingProfessor) {
        // 수정 시 두 테이블 모두 업데이트
        const userData = {
          name: formData.name.trim(),
          phone: normalizedPhone,
          status: formData.status,
          updated_at: new Date().toISOString()
        };

        const professorData = {
          professor_category_id: formData.primary_category ? parseInt(formData.primary_category) : null,
          secondary_category_id: formData.secondary_category ? parseInt(formData.secondary_category) : null
        };

        // users 테이블 업데이트
        const { error: userError } = await supabase
          .from('users')
          .update(userData)
          .eq('id', editingProfessor.id);
          
        if (userError) throw userError;

        // professors 테이블 업데이트
        const { error: profError } = await supabase
          .from('professors')
          .update(professorData)
          .eq('user_id', editingProfessor.id);
          
        if (profError) throw profError;
        
        alert('수정 완료');
      } else {
        // 추가 - API 호출 사용
        const professorData: CreateProfessorData = {
          name: formData.name.trim(),
          phone: normalizedPhone,
          professor_category_id: formData.primary_category ? parseInt(formData.primary_category) : undefined,
          secondary_category_id: formData.secondary_category ? parseInt(formData.secondary_category) : undefined,
          status: formData.status
        };

        const result = await createOrUpdateProfessor(professorData);
        
        if (result.action === 'created') {
          // 고정 패스워드로 변경
          setTempPassword('pro1234!');
          setTempEmail(`${normalizedPhone}@professor.temp`);
          setShowTempPasswordModal(true);
        } else {
          alert(result.message);
        }
      }
      
      closeModal();
      fetchData();
    } catch (error) {
      console.error('저장 실패:', error);
      alert(`저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const handleDelete = async (id: number, name: string): Promise<void> => {
    if (!confirm(`${name} 교수를 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({is_active: false})
        .eq('id', id);
        
      if (error) throw error;
      alert('삭제 완료');
      fetchData();
    } catch (error) {
      alert(`삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

// 패스워드 재설정 - 실제 API 호출로 변경
const resetPassword = async (id: number, name: string): Promise<void> => {
  if (!confirm(`${name} 교수의 패스워드를 재설정하시겠습니까?\n임시 패스워드: pro1234!`)) return;

  try {
    console.log(`🔐 ${name} 교수 패스워드 재설정 시작...`);

    // 실제 API 호출
    const response = await fetch('/api/admin/reset-professor-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        professorId: id
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      // 성공 시 상세 정보 표시
      alert(`✅ ${name} 교수의 패스워드가 재설정되었습니다!\n\n로그인 정보:\n• ID: ${result.professor.phone}\n• 임시 패스워드: ${result.tempPassword}\n\n교수님께 전달해주세요.`);
      
      // 목록 새로고침
      fetchData();
    } else {
      console.error('패스워드 재설정 실패:', result);
      alert(`❌ 패스워드 재설정 실패: ${result.error || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('패스워드 재설정 오류:', error);
    alert(`❌ 패스워드 재설정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
};

  // 수정 모달 열기
  const openEditModal = (professor: Professor): void => {
    setEditingProfessor(professor);
    setFormData({
      name: professor.name || '',
      phone: formatPhoneNumber(professor.phone || ''),
      primary_category: professor.professor_category_id?.toString() || '',
      secondary_category: professor.secondary_category_id?.toString() || '',
      status: (professor.status as 'active' | 'inactive') || 'active'
    });
    setShowModal(true);
  };

  // 모달 닫기
  const closeModal = (): void => {
    setShowModal(false);
    setEditingProfessor(null);
    setFormData({name: '', phone: '', primary_category: '', secondary_category: '', status: 'active'});
  };

  // 클립보드 복사
  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      alert('복사되었습니다!');
    } catch (error) {
      console.error('복사 실패:', error);
      alert('복사에 실패했습니다.');
    }
  };

  // 휴대폰번호 실시간 포맷팅 핸들러
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({...formData, phone: formatted});
  };

  // ✅ 필터 초기화 함수
  const resetFilters = (): void => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  if (loading) return <div className="loading">교수 목록 로딩 중...</div>;

  return (
    <div className="container">
      {/* 헤더 */}
      <div className="header">
        <h1>👨‍🏫 교수 관리 ({filteredProfessors.length}/{professors.length}명)</h1>
        <div className="header-actions">
          <button className="btn-import" onClick={() => setShowImportModal(true)}>
            📤 CSV 업로드
          </button>
          <button className="btn-add" onClick={() => setShowModal(true)}>
            + 교수 추가
          </button>
        </div>
      </div>

      {/* ✅ 검색 및 필터 섹션 추가 */}
      <div className="search-filter-section">
        <div className="search-filters">
          <div className="filter-group">
            <label>🔍 검색</label>
            <input
              type="text"
              placeholder="이름 또는 휴대폰번호 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <label>📊 상태</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>📚 전문분야</label>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">전체 분야</option>
              {categories.map(category => (
                <option key={category.id} value={category.id.toString()}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <button className="btn-reset" onClick={resetFilters}>
              🔄 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 안내 정보 */}
      <div className="info-notice">
        <p>📱 <strong>휴대폰번호 로그인:</strong> 교수님들은 휴대폰번호와 임시 패스워드로 로그인합니다.</p>
        <p>🔄 <strong>스마트 처리:</strong> 동일 휴대폰+이름이면 복수 분야로 자동 추가됩니다.</p>
        <p>🔒 <strong>보안 강화:</strong> 이메일 정보는 보안을 위해 표시하지 않습니다.</p>
      </div>

      {/* ✅ 테이블 - 이메일 컬럼 제거 및 레이아웃 조정 */}
      <div className="table-wrapper">
        <table className="table" style={{tableLayout: 'fixed'}}>
          <thead>
            <tr>
              <th style={{width: '120px', textAlign: 'center'}}>이름</th>
              <th style={{width: '140px', textAlign: 'center'}}>휴대폰번호</th>
              <th style={{width: '250px', textAlign: 'center'}}>전문 분야</th>
              <th style={{width: '80px', textAlign: 'center'}}>상태</th>
              <th style={{width: '120px', textAlign: 'center'}}>등록일</th>
              <th style={{width: '250px', textAlign: 'center'}}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfessors.map(prof => (
              <tr key={prof.id}>
                <td style={{ textAlign: 'center' }}>
                  <strong>{prof.name}</strong>
                  {prof.is_temp_password && (
                    <span className="temp-password-badge">임시 패스워드</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {prof.phone ? formatPhoneNumber(prof.phone) : '-'}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {/* ✅ 전문 분야도 중앙 정렬 */}
                  <div className="categories-text">
                    {renderCategories(prof)}
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`status ${prof.status}`}>
                    {prof.status === 'active' ? '활성' : '비활성'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {new Date(prof.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div className="action-buttons">
                    <button className="btn-edit" onClick={() => openEditModal(prof)}>수정</button>
                    <button className="btn-reset" onClick={() => resetPassword(prof.id, prof.name)}>패스워드 재설정</button>
                    <button className="btn-delete" onClick={() => handleDelete(prof.id, prof.name)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ✅ 필터링 결과 없음 메시지 */}
        {filteredProfessors.length === 0 && professors.length > 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>검색 결과가 없습니다</h3>
            <p>다른 검색어나 필터를 시도해보세요.</p>
            <button className="btn-reset-search" onClick={resetFilters}>
              필터 초기화
            </button>
          </div>
        )}

        {professors.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👨‍🏫</div>
            <h3>등록된 교수가 없습니다</h3>
            <p>새 교수를 추가하거나 CSV 파일로 업로드해보세요.</p>
          </div>
        )}
      </div>

      {/* 나머지 모달들은 기존과 동일... */}
      {/* 교수 추가/수정 모달 */}
      {showModal && (
        <div className="modal" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProfessor ? '교수 정보 수정' : '새 교수 추가'}</h2>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>이름 *</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required 
                  placeholder="교수 이름을 입력하세요"
                />
              </div>

              <div className="form-group">
                <label>휴대폰번호 * {!editingProfessor && <small>(로그인 ID로 사용됩니다)</small>}</label>
                <input 
                  type="tel"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  required 
                  placeholder="010-1234-5678"
                />
              </div>
              
              <div className="form-group">
                <label>주 전문 분야</label>
                <select 
                  value={formData.primary_category}
                  onChange={e => setFormData({...formData, primary_category: e.target.value})}
                >
                  <option value="">-- 주 분야 선택 --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>복수 전문 분야</label>
                <select 
                  value={formData.secondary_category}
                  onChange={e => setFormData({...formData, secondary_category: e.target.value})}
                >
                  <option value="">-- 복수 분야 선택 (선택사항) --</option>
                  {categories
                    .filter(cat => cat.id !== parseInt(formData.primary_category))
                    .map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>상태</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as 'active' | 'inactive'})}
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
              
              {!editingProfessor && (
                <div className="form-notice">
                  <p>📱 휴대폰번호가 로그인 ID로 사용됩니다.</p>
                  <p>🔑 임시 패스워드가 자동 생성됩니다.</p>
                  <p>🔒 보안을 위해 이메일은 자동 생성됩니다.</p>
                </div>
              )}
              
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>취소</button>
                <button type="submit" className="btn-submit">
                  {editingProfessor ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 임시 패스워드 표시 모달 */}
      {showTempPasswordModal && (
        <div className="modal">
          <div className="modal-box temp-password-modal">
            <div className="modal-header">
              <h2>🔑 교수 등록 완료</h2>
            </div>
            
            <div className="temp-password-content">
              <div className="success-message">
                <p>✅ {formData.name} 교수가 성공적으로 등록되었습니다!</p>
                <p>아래 로그인 정보를 교수님께 전달해주세요:</p>
              </div>
              
              <div className="login-info">
                <div className="info-item">
                  <label>로그인 ID (휴대폰번호):</label>
                  <div className="info-box">
                    <span>{normalizePhoneNumber(formData.phone)}</span>
                    <button 
                      type="button" 
                      className="copy-btn"
                      onClick={() => copyToClipboard(normalizePhoneNumber(formData.phone))}
                    >
                      📋 복사
                    </button>
                  </div>
                </div>
                
                <div className="info-item">
                  <label>임시 패스워드:</label>
                  <div className="info-box">
                    <span className="password">{tempPassword}</span>
                    <button 
                      type="button" 
                      className="copy-btn"
                      onClick={() => copyToClipboard(tempPassword)}
                    >
                      📋 복사
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="instructions">
                <h4>📋 교수님께 안내사항:</h4>
                <ul>
                  <li>로그인 ID: <strong>{normalizePhoneNumber(formData.phone)}</strong> (휴대폰번호)</li>
                  <li>기본 패스워드: <strong>pro1234!</strong></li>
                  <li>첫 로그인 후 반드시 패스워드를 변경해주세요</li>
                </ul>
              </div>
                              
              <div className="form-actions">
                <button 
                  className="btn-submit"
                  onClick={() => setShowTempPasswordModal(false)}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV 업로드 모달 */}
      {showImportModal && (
        <div className="modal" onClick={() => setShowImportModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📤 교수 데이터 CSV 업로드</h2>
              <button className="close-btn" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            
            <div className="import-content">
              <div className="import-notice">
                <p>⚠️ <strong>초기 설정용</strong> - 대량의 교수 데이터를 한 번에 등록할 때 사용하세요.</p>
                <p>📱 각 교수마다 자동으로 임시 패스워드가 생성됩니다.</p>
                <p>🔒 각 교수마다 자동으로 임시 이메일이 생성됩니다.</p>
                <p>🔄 동일 휴대폰+이름이면 복수 분야로 자동 추가됩니다.</p>
              </div>

              <div className="step">
                <h3>1단계: 샘플 파일 다운로드</h3>
                <p>모든 분야 목록과 입력 양식이 포함된 샘플 파일을 다운로드하세요.</p>
                <button className="btn-sample" onClick={downloadSampleCSV}>
                  📁 샘플 파일 다운로드
                </button>
              </div>

              <div className="step">
                <h3>2단계: 데이터 입력</h3>
                <ul>
                  <li><strong>A~E열에만</strong> 교수 데이터를 입력하세요</li>
                  <li><strong>H열 이후</strong>는 참고용이므로 수정하지 마세요</li>
                  <li>분야명은 참고 목록에서 정확히 복사해서 입력하세요</li>
                  <li><strong>휴대폰번호는 숫자만</strong> 입력하세요 (01012345678)</li>
                </ul>
              </div>

              <div className="step">
                <h3>3단계: 파일 업로드</h3>
                
                <input 
                  id="csvFileInput"
                  type="file" 
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #007bff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    marginBottom: '16px'
                  }}
                />
                
                {selectedFile && (
                  <div style={{
                    background: '#e8f4f8',
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    border: '1px solid #bee5eb'
                  }}>
                    <div style={{ 
                      color: '#0c5460', 
                      fontWeight: '600',
                      marginBottom: '4px' 
                    }}>
                      📄 선택된 파일:
                    </div>
                    <div style={{ color: '#0c5460' }}>
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)}KB)
                    </div>
                  </div>
                )}
                
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'center'
                }}>
                  {selectedFile && (
                    <>
                      <button
                        onClick={handleFileUpload}
                        disabled={uploadLoading}
                        style={{
                          flex: 1,
                          background: uploadLoading ? '#6c757d' : '#28a745',
                          color: 'white',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: '6px',
                          cursor: uploadLoading ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        {uploadLoading && (
                          <div style={{
                            width: '16px',
                            height: '16px',
                            border: '2px solid transparent',
                            borderTop: '2px solid white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }} />
                        )}
                        {uploadLoading ? '업로드 중...' : '📤 업로드 시작'}
                      </button>
                      
                      <button
                        onClick={cancelFileSelection}
                        disabled={uploadLoading}
                        style={{
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          padding: '12px 16px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ 스타일에 검색/필터 관련 스타일 추가 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .loading {
          text-align: center;
          padding: 60px;
          font-size: 18px;
          color: #666;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          color: #2c3e50;
        }
        
        .header-actions {
          display: flex;
          gap: 12px;
        }
        
        .btn-add, .btn-import {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-add {
          background: #007bff;
          color: white;
        }
        
        .btn-import {
          background: #28a745;
          color: white;
        }
        
        .btn-add:hover, .btn-import:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        /* ✅ 검색/필터 섹션 스타일 */
        .search-filter-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .search-filters {
          display: flex;
          gap: 16px;
          align-items: end;
          flex-wrap: wrap;
        }
        
        .filter-group {
          display: flex;
          flex-direction: column;
          min-width: 200px;
        }
        
        .filter-group label {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .search-input, .filter-select {
          padding: 10px 14px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .search-input:focus, .filter-select:focus {
          outline: none;
          border-color: #007bff;
        }
        
        .btn-reset {
          padding: 10px 16px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-reset:hover {
          background: #5a6268;
          transform: translateY(-1px);
        }
        
        .info-notice {
          background: #e8f4f8;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .info-notice p {
          margin: 0 0 8px 0;
          color: #0c5460;
          font-size: 14px;
        }
        
        .table-wrapper {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .table th, .table td {
          padding: 16px;
          text-align: center;
          border-bottom: 1px solid #f1f3f4;
        }
        
        .table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #495057;
          font-size: 14px;
        }
        
        .table tr:hover {
          background: #f8f9fa;
        }
        
        .temp-password-badge {
          background: #ff6b35;
          color: white;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 8px;
          margin-left: 8px;
        }
        
        /* ✅ 전문분야 텍스트 스타일 */
        .categories-text {
          color: #495057;
          font-size: 14px;
          line-height: 1.4;
          text-align: center;
        }
        
        .status.active {
          background: #28a745;
          color: white;
          padding: 6px 12px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status.inactive {
          background: #6c757d;
          color: white;
          padding: 6px 12px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .action-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .btn-edit, .btn-reset, .btn-delete {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-edit {
          background: #007bff;
          color: white;
        }
        
        .action-buttons .btn-reset {
          background: #ffc107;
          color: #212529;
          padding: 6px 12px;
        }
        
        .btn-delete {
          background: #dc3545;
          color: white;
        }
        
        .btn-edit:hover, .action-buttons .btn-reset:hover, .btn-delete:hover {
          transform: translateY(-1px);
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }
        
        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        
        .btn-reset-search {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-top: 16px;
        }
        
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-box {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .temp-password-modal {
          max-width: 600px;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 0;
          margin-bottom: 20px;
        }
        
        .modal-header h2 {
          margin: 0;
          color: #2c3e50;
          font-size: 20px;
          font-weight: 700;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .close-btn:hover {
          background: #f1f3f4;
          color: #333;
        }
        
        form {
          padding: 0 24px 24px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2c3e50;
          font-size: 14px;
        }
        
        .form-group label small {
          font-weight: normal;
          color: #666;
          font-size: 12px;
        }
        
        .form-group input, .form-group select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        
        .form-group input:focus, .form-group select:focus {
          outline: none;
          border-color: #007bff;
        }
        
        .form-notice {
          background: #e8f4f8;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        }
        
        .form-notice p {
          margin: 0 0 8px 0;
          color: #0c5460;
          font-size: 14px;
        }
        
        .temp-password-content {
          padding: 0 24px 24px;
        }
        
        .success-message {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .success-message p {
          margin: 0 0 8px 0;
          color: #155724;
        }
        
        .login-info {
          margin-bottom: 20px;
        }
        
        .info-item {
          margin-bottom: 15px;
        }
        
        .info-item label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2c3e50;
        }
        
        .info-box {
          display: flex;
          align-items: center;
          background: #f8f9fa;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          padding: 12px;
        }
        
        .info-box span {
          flex: 1;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 16px;
          color: #007bff;
        }
        
        .password {
          font-weight: bold;
          letter-spacing: 1px;
        }
        
        .copy-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          margin-left: 12px;
        }
        
        .instructions {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .instructions h4 {
          margin: 0 0 12px 0;
          color: #495057;
          font-size: 16px;
        }
        
        .instructions ul {
          margin: 0;
          padding-left: 20px;
        }
        
        .instructions li {
          margin-bottom: 8px;
          color: #6c757d;
        }
        
        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        
        .btn-cancel, .btn-submit {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .btn-cancel {
          background: #6c757d;
          color: white;
        }
        
        .btn-submit {
          background: #007bff;
          color: white;
        }
        
        .btn-cancel:hover, .btn-submit:hover {
          transform: translateY(-1px);
        }
        
        .import-content {
          padding: 0 24px 24px;
        }
        
        .import-notice {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .import-notice p {
          margin: 0 0 8px 0;
          color: #856404;
        }
        
        .step {
          margin-bottom: 25px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #007bff;
        }
        
        .step h3 {
          margin: 0 0 12px 0;
          color: #2c3e50;
          font-size: 16px;
        }
        
        .step p {
          margin: 0 0 15px 0;
          color: #666;
          line-height: 1.5;
        }
        
        .step ul {
          margin: 0;
          padding-left: 20px;
          color: #666;
        }
        
        .step li {
          margin-bottom: 8px;
        }
        
        .btn-sample {
          background: #28a745;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-sample:hover {
          background: #218838;
          transform: translateY(-1px);
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 16px;
          }
          
          .header {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }
          
          .search-filters {
            flex-direction: column;
            align-items: stretch;
          }
          
          .filter-group {
            min-width: auto;
          }
          
          .table-wrapper {
            overflow-x: auto;
          }
          
          .modal-box {
            width: 95%;
            margin: 20px;
          }
          
          .action-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default ProfessorList;

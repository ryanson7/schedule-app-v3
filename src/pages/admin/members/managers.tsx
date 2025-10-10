import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabaseClient';
import { getRolePermissions } from '../../../utils/permissions';


interface Manager {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: 'manager';
  manager_type: 'academy_manager' | 'online_manager';
  status: 'active' | 'inactive';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  main_location_id?: number;
  position_id?: number;
  location_name?: string;
  location_type?: string;
  position_name?: string;
}

interface MainLocation {
  id: number;
  name: string;
  location_type: string;
  is_active: boolean;
}

interface Position {
  id: number;
  position_name: string;
}

interface ManagerFormData {
  email: string;
  name: string;
  phone: string;
  manager_type: 'academy_manager' | 'online_manager';
  main_location_id: string;
  position_id: string;
}

export default function ManagersManagementPage() {
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [mainLocations, setMainLocations] = useState<MainLocation[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'academy_manager' | 'online_manager'>('all');
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{name: string, email: string, password: string} | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [formData, setFormData] = useState<ManagerFormData>({
    email: '',
    name: '',
    phone: '',
    manager_type: 'online_manager',
    main_location_id: '',
    position_id: ''
  });

  useEffect(() => {
  const checkAccess = async () => {
    try {
      const userRole = localStorage.getItem('userRole');
      if (!userRole) {
        alert('로그인이 필요합니다.');
        router.replace('/login');
        return;
      }
      const userPermissions = await getRolePermissions(userRole);
      if (!userPermissions.includes('admin.members.managers')) {
        alert('매니저 관리 권한이 없습니다.');
        router.replace('/admin/members/overview');
        return;
      }
      setHasAccess(true);
    } catch (error) {
      alert('권한 확인 중 오류가 발생했습니다.');
      router.replace('/admin/members/overview');
    } finally {
      setAuthLoading(false);
    }
  };
  checkAccess();
}, [router]);


  useEffect(() => {
    if (hasAccess) {
      initializeData();
    }
  }, [router, hasAccess]);

  const initializeData = async () => {
    setLoading(true);
    await Promise.all([
      loadManagers(),
      loadMainLocations(), 
      loadPositions()
    ]);
    setLoading(false);
  };

  // ✅ 정식 JOIN 쿼리로 수정된 loadManagers 함수
  const loadManagers = async () => {
    try {
      console.log('📋 매니저 데이터 로딩 시작...');

      const { data: managersData, error } = await supabase
        .from('users')
        .select(`
          id, 
          name, 
          email, 
          phone, 
          role,
          status, 
          is_active,
          created_at,
          managers!managers_user_id_fkey!inner (
            manager_type,
            main_location_id,
            position_id,
            main_locations:main_location_id (
              id, 
              name,
              location_type
            ),
            positions:position_id (
              id, 
              position_name
            )
          )
        `)
        .eq('role', 'manager')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ 상세 매니저 데이터 조회 오류:', error);
        console.error('에러 코드:', error.code);
        console.error('에러 메시지:', error.message);
        console.error('에러 세부사항:', error.details);
        
        // fallback 로직 - 기본 사용자 정보만 조회
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('users')
          .select('id, name, email, phone, role, status, is_active, created_at')
          .eq('role', 'manager')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!fallbackError && fallbackData) {
          const simpleData = fallbackData.map(user => ({
            ...user,
            manager_type: 'online_manager' as const,
            location_name: '미설정',
            location_type: '',
            position_name: '미설정'
          }));
          setManagers(simpleData);
        } else {
          setManagers([]);
        }
        return;
      }

      console.log('✅ JOIN 쿼리 성공! 받은 데이터:', managersData);

      const enrichedData = (managersData || []).map(user => {
      
      const managerInfo = user.managers;
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          manager_type: managerInfo?.manager_type || 'online_manager',
          status: user.status,
          is_active: user.is_active,
          created_at: user.created_at,
          main_location_id: managerInfo?.main_location_id,
          position_id: managerInfo?.position_id,
          location_name: managerInfo?.main_locations?.name || '미설정',
          location_type: managerInfo?.main_locations?.location_type || '',
          position_name: managerInfo?.positions?.position_name || '미설정'
        };
      });

      enrichedData.sort((a, b) => {
        if (a.manager_type !== b.manager_type) {
          return a.manager_type === 'academy_manager' ? -1 : 1;
        }
        
        if (a.manager_type === 'academy_manager') {
          const locIdA = a.main_location_id || 999999;
          const locIdB = b.main_location_id || 999999;
          if (locIdA !== locIdB) return locIdA - locIdB;
        }
        
        const posIdA = a.position_id || 999999;
        const posIdB = b.position_id || 999999;
        if (posIdA !== posIdB) return posIdA - posIdB;
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      console.log('✅ 매니저 데이터 조합 완료:', enrichedData.length, '명');
      setManagers(enrichedData);

    } catch (error) {
      console.error('❌ 매니저 데이터 로딩 실패:', error);
      setManagers([]);
    }
  };

  const loadMainLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('main_locations')
        .select('id, name, location_type, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMainLocations(data || []);
      console.log('✅ 지점 데이터 로딩:', data?.length || 0);
    } catch (error) {
      console.error('지점 목록 조회 실패:', error);
      setMainLocations([]);
    }
  };

  const loadPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('id, position_name')
        .order('id');

      if (error) throw error;
      setPositions(data || []);
      console.log('✅ 직책 데이터 로딩:', data?.length || 0);
    } catch (error) {
      console.error('직책 목록 조회 실패:', error);
      setPositions([]);
    }
  };

  const createManager = async (managerData: ManagerFormData) => {
    try {
      console.log('📡 매니저 생성 API 요청:', managerData);
      
      const response = await fetch('/api/admin/create-manager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(managerData),
      });

      const result = await response.json();
      console.log('📡 API 응답:', result);

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return { success: true, tempPassword: 'eduwill1234!' };
    } catch (error) {
      console.error('❌ 매니저 생성 실패:', error);
      throw new Error(`매니저 생성 실패: ${error instanceof Error ? error.message : '네트워크 오류'}`);
    }
  };

  const updateManager = async (managerId: number, managerData: ManagerFormData) => {
    try {
      console.log('📡 매니저 수정 API 요청:', { managerId, managerData });
      
      const response = await fetch('/api/admin/update-manager', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: managerId, ...managerData }),
      });

      const result = await response.json();
      console.log('📡 API 응답:', result);

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ 매니저 수정 실패:', error);
      throw new Error(`매니저 수정 실패: ${error instanceof Error ? error.message : '네트워크 오류'}`);
    }
  };

  // CSV 샘플 파일 다운로드
  const downloadSampleCSV = (): void => {
    const csvRows = [
      '이메일,이름,전화번호,매니저타입,지점ID,직책ID',
      'manager1@eduwill.com,김학원,010-1234-5678,academy_manager,1,2',
      'manager2@eduwill.com,이온라인,010-5678-1234,online_manager,,3',
      'manager3@eduwill.com,박매니저,010-9876-5432,academy_manager,2,1',
      'manager4@eduwill.com,최관리자,010-3333-4444,online_manager,,4'
    ];
    
    const csvContent = csvRows.join('\n');
    const BOM = '\uFEFF';
    const fullContent = BOM + csvContent;
    
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', '매니저_업로드_샘플.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV 파일 업로드 처리
  const handleFileUpload = async (): Promise<void> => {
    if (!selectedFile) {
      alert('파일을 선택해주세요.');
      return;
    }

    setUploadLoading(true);
    
    try {
      let text = await selectedFile.text();
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.substr(1);
      }
      
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        alert('올바른 CSV 파일이 아닙니다.');
        return;
      }

      const results = { created: 0, errors: [] as string[] };
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        console.log(`🔍 처리 중인 라인 ${i}:`, line);
        
        if (line && !line.startsWith(',')) {
          const values = line.split(',').map(v => v.replace(/"/g, '').trim());
          console.log(`🔍 파싱된 값들:`, values);
          
          if (values.length >= 2 && values[0] && values[1]) {
            const managerData: ManagerFormData = {
              email: values[0].trim(),
              name: values[1].trim(),
              phone: values[2]?.trim() || '',
              manager_type: values[3]?.trim() === 'academy_manager' ? 'academy_manager' : 'online_manager',
              main_location_id: values[4]?.trim() || '',
              position_id: values[5]?.trim() || ''
            };
            
            console.log(`🔍 전송할 매니저 데이터:`, managerData);
            
            if (managerData.email.includes('@') && managerData.email.includes('.')) {
              try {
                const result = await createManager(managerData);
                console.log(`✅ 매니저 생성 성공:`, result);
                results.created++;
              } catch (error) {
                console.error(`❌ 매니저 생성 실패:`, error);
                results.errors.push(`${managerData.name}: ${error instanceof Error ? error.message : '생성 실패'}`);
              }
            } else {
              results.errors.push(`${values[1]}: 잘못된 이메일 형식`);
            }
          } else {
            results.errors.push(`라인 ${i}: 필수 데이터 누락`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      let message = `처리 완료!\n✅ 신규 등록: ${results.created}명\n`;
      if (results.errors.length > 0) {
        message += `❌ 실패: ${results.errors.length}명\n\n실패 내역:\n${results.errors.slice(0, 5).join('\n')}`;
      }
      message += `\n📋 모든 매니저 통일 비밀번호: eduwill1234!`;
      
      alert(message);
      setShowImportModal(false);
      setSelectedFile(null);
      loadManagers();
      
    } catch (error) {
      console.error('❌ 파일 업로드 실패:', error);
      alert(`파일 업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleCreateManager = () => {
    setSelectedManager(null);
    setFormData({
      email: '',
      name: '',
      phone: '',
      manager_type: 'online_manager',
      main_location_id: '',
      position_id: ''
    });
    setShowModal(true);
  };

  const handleEditManager = (manager: Manager) => {
    setSelectedManager(manager);
    setFormData({
      email: manager.email,
      name: manager.name,
      phone: manager.phone || '',
      manager_type: manager.manager_type,
      main_location_id: manager.main_location_id?.toString() || '',
      position_id: manager.position_id?.toString() || ''
    });
    setShowModal(true);
  };

  const handleDeleteManager = async (manager: Manager) => {
    if (!confirm(`${manager.name} 매니저를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/delete-manager', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: manager.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '삭제 실패');
      }

      console.log('✅ 매니저 삭제 완료');
      alert('매니저가 삭제되었습니다.');
      loadManagers();

    } catch (error) {
      console.error('❌ 매니저 삭제 실패:', error);
      alert('매니저 삭제에 실패했습니다.');
    }
  };

  const handleToggleStatus = async (manager: Manager) => {
    try {
      const newStatus = manager.status === 'active' ? 'inactive' : 'active';
      const isActive = newStatus === 'active';

      const { error } = await supabase
        .from('users')
        .update({ 
          status: newStatus,
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', manager.id);

      if (error) {
        console.error('❌ 매니저 상태 변경 오류:', error);
        alert('상태 변경에 실패했습니다.');
        return;
      }

      console.log('✅ 매니저 상태 변경 완료');
      loadManagers();

    } catch (error) {
      console.error('❌ 매니저 상태 변경 실패:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('이름과 이메일은 필수입니다.');
      return;
    }

    if (formData.manager_type === 'academy_manager' && !formData.main_location_id) {
      alert('학원 매니저는 소속 지점을 선택해야 합니다.');
      return;
    }

    setSaving(true);

    try {
      if (selectedManager) {
        await updateManager(selectedManager.id, formData);
        alert('매니저 정보가 수정되었습니다.');
        setShowModal(false);
        loadManagers();
      } else {
        const result = await createManager(formData);
        
        if (result.success && result.tempPassword) {
          setTempPasswordInfo({
            name: formData.name,
            email: formData.email,
            password: result.tempPassword
          });
          setShowTempPasswordModal(true);
        }
        
        setShowModal(false);
        loadManagers();
      }
    } catch (error) {
      console.error('저장 실패:', error);
      alert(`저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedManager(null);
    setFormData({
      email: '',
      name: '',
      phone: '',
      manager_type: 'online_manager',
      main_location_id: '',
      position_id: ''
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('복사되었습니다!');
    } catch (error) {
      console.log('클립보드 복사 실패');
    }
  };

  // 필터링된 매니저 목록
  const filteredManagers = managers.filter(manager => {
    const matchesSearch = manager.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         manager.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         manager.phone?.includes(searchTerm) ||
                         manager.location_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || manager.manager_type === filterType;
    
    return matchesSearch && matchesType;
  });

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  };

  const getManagerTypeDisplayName = (type: string) => {
    const typeNames: { [key: string]: string } = {
      'academy_manager': '학원 매니저',
      'online_manager': '온라인 매니저'
    };
    return typeNames[type] || type;
  };

  const getManagerTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'academy_manager': '#10b981',
      'online_manager': '#3b82f6'
    };
    return colors[type] || '#6b7280';
  };

  if (authLoading) {
  return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>권한을 확인하는 중...</div>;
}
if (!hasAccess) {
  return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>접근 권한이 없습니다</div>;
}

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>매니저 데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 8px 0'
            }}>
              👥 매니저 관리 ({filteredManagers.length}명)
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              📤 CSV 업로드
            </button>
            <button
              onClick={handleCreateManager}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1d4ed8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              + 매니저 추가
            </button>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <input
              type="text"
              placeholder="매니저 검색 (이름, 이메일, 전화번호, 지점명)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '10px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                width: '300px',
                outline: 'none'
              }}
            />
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              style={{
                padding: '10px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            >
              <option value="all">전체</option>
              <option value="academy_manager">학원 매니저</option>
              <option value="online_manager">온라인 매니저</option>
            </select>
          </div>
        </div>

        {/* 안내 정보 */}
        <div style={{
          backgroundColor: '#e8f4f8',
          border: '1px solid #bee5eb',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#0c5460', fontSize: '14px' }}>
            🏫 <strong>학원 매니저:</strong> 소속 지점에 따라 접근 가능한 학원이 달라집니다 ({mainLocations.length}개 지점)
          </p>
          <p style={{ margin: '0 0 8px 0', color: '#0c5460', fontSize: '14px' }}>
            💻 <strong>온라인 매니저:</strong> 모든 온라인 교육 컨텐츠에 접근 가능합니다
          </p>
          <p style={{ margin: 0, color: '#0c5460', fontSize: '14px' }}>
            🔑 <strong>통일 패스워드:</strong> 모든 매니저는 eduwill1234! 사용 후 변경 필수
          </p>
        </div>

        {/* 매니저 목록 테이블 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {/* 테이블 헤더 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1.5fr 1fr 1fr 2fr',
            gap: '16px',
            padding: '20px 24px',
            backgroundColor: '#f8fafc',
            fontWeight: '600',
            fontSize: '14px',
            color: '#374151',
            borderBottom: '2px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div>매니저 정보</div>
            <div>타입</div>
            <div>소속/지점</div>
            <div>직책</div>
            <div>상태</div>
            <div>관리 액션</div>
          </div>

          {/* 매니저 목록 */}
          {filteredManagers.map((manager) => (
            <div
              key={manager.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.2fr 1.5fr 1fr 1fr 2fr',
                gap: '16px',
                padding: '20px 24px',
                borderBottom: '1px solid #f3f4f6',
                alignItems: 'center'
              }}
            >
              {/* 매니저 정보 */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '4px',
                  fontSize: '14px'
                }}>
                  {manager.name}
                </div>
                <div style={{
                  color: '#6b7280',
                  fontSize: '12px',
                  marginBottom: '2px'
                }}>
                  {manager.email}
                </div>
                {manager.phone && (
                  <div style={{
                    color: '#9ca3af',
                    fontSize: '11px'
                  }}>
                    {formatPhone(manager.phone)}
                  </div>
                )}
              </div>

              {/* 매니저 타입 */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  backgroundColor: getManagerTypeColor(manager.manager_type) + '20',
                  color: getManagerTypeColor(manager.manager_type),
                  display: 'inline-block'
                }}>
                  {getManagerTypeDisplayName(manager.manager_type)}
                </span>
              </div>

              {/* 소속/지점 정보 */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: manager.manager_type === 'academy_manager' ? '#fef3c7' : '#f3f4f6',
                  color: manager.manager_type === 'academy_manager' ? '#92400e' : '#374151'
                }}>
                  {manager.manager_type === 'academy_manager' 
                    ? (manager.location_name || '❗ 미설정')
                    : '온라인'
                  }
                </span>
                {manager.location_type && (
                  <div style={{
                    fontSize: '10px',
                    color: '#9ca3af',
                    marginTop: '2px'
                  }}>
                    ({manager.location_type})
                  </div>
                )}
                {manager.manager_type === 'academy_manager' && !manager.main_location_id && (
                  <div style={{
                    fontSize: '10px',
                    color: '#ef4444',
                    marginTop: '2px',
                    fontWeight: '500'
                  }}>
                    ⚠️ 소속 필요
                  </div>
                )}
              </div>

              {/* 직책 정보 */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: '#e0f2fe',
                  color: '#0277bd'
                }}>
                  {manager.position_name || '미설정'}
                </span>
              </div>

              {/* 상태 */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => handleToggleStatus(manager)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '500',
                    backgroundColor: manager.status === 'active' ? '#10b98120' : '#ef444420',
                    color: manager.status === 'active' ? '#10b981' : '#ef4444',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {manager.status === 'active' ? '활성' : '비활성'}
                </button>
              </div>

              {/* 관리 액션 */}
              <div style={{ 
                display: 'flex', 
                gap: '4px', 
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => handleEditManager(manager)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    backgroundColor: '#1d4ed8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  수정
                </button>

                <button
                  onClick={() => handleDeleteManager(manager)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}

          {filteredManagers.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: '#9ca3af'
            }}>
              {searchTerm || filterType !== 'all' 
                ? '조건에 맞는 매니저가 없습니다.'
                : '등록된 매니저가 없습니다.'
              }
            </div>
          )}
        </div>
      </div>

      {/* CSV 업로드 모달 */}
      {showImportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowImportModal(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 24px 0',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '20px', fontWeight: '700' }}>
                📤 매니저 CSV 업로드
              </h2>
              <button onClick={() => setShowImportModal(false)} style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#999'
              }}>×</button>
            </div>
            
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                borderLeft: '4px solid #007bff'
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#2c3e50', fontSize: '16px' }}>
                  1단계: 샘플 파일 다운로드
                </h3>
                <button onClick={downloadSampleCSV} style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}>
                  📁 샘플 파일 다운로드
                </button>
              </div>

              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                borderLeft: '4px solid #007bff'  
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#2c3e50', fontSize: '16px' }}>
                  2단계: 파일 업로드
                </h3>
                
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px dashed #007bff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                />
                
                {selectedFile && (
                  <div style={{
                    background: '#e8f4f8',
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    border: '1px solid #bee5eb'
                  }}>
                    <div style={{ color: '#0c5460', fontSize: '14px' }}>
                      📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)}KB)
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '8px' }}>
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
                          padding: '10px 16px',
                          borderRadius: '6px',
                          cursor: uploadLoading ? 'not-allowed' : 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        {uploadLoading ? '업로드 중...' : '📤 업로드 시작'}
                      </button>
                      
                      <button
                        onClick={() => setSelectedFile(null)}
                        disabled={uploadLoading}
                        style={{
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          padding: '10px 16px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ 
                color: '#666', 
                fontSize: '12px', 
                textAlign: 'center',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px'
              }}>
                형식: 이메일,이름,전화번호,매니저타입,지점ID,직책ID<br/>
                ✅ 학원 매니저는 지점ID 필수입력<br/>
                통일 패스워드: eduwill1234!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 매니저 추가/수정 모달 */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={closeModal}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 24px 0',
              marginBottom: '20px'
            }}>
              <h2 style={{
                margin: 0,
                color: '#2c3e50',
                fontSize: '20px',
                fontWeight: '700'
              }}>
                {selectedManager ? '매니저 정보 수정' : '새 매니저 추가'}
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999'
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  이메일 * {selectedManager && <small>(수정 불가)</small>}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  disabled={!!selectedManager}
                  placeholder="manager@eduwill.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: selectedManager ? '#f8f9fa' : 'white',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="매니저 이름"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  전화번호
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="010-1234-5678"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  매니저 타입 *
                </label>
                <select
                  value={formData.manager_type}
                  onChange={(e) => {
                    setFormData({
                      ...formData, 
                      manager_type: e.target.value as any,
                      main_location_id: e.target.value === 'online_manager' ? '' : formData.main_location_id
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="online_manager">온라인 매니저</option>
                  <option value="academy_manager">학원 매니저</option>
                </select>
              </div>

              {/* 학원 매니저일 때만 소속 지점 표시 */}
              {formData.manager_type === 'academy_manager' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    소속 지점 * <span style={{ color: '#dc3545' }}>(필수)</span>
                  </label>
                  <select
                    value={formData.main_location_id}
                    onChange={(e) => setFormData({...formData, main_location_id: e.target.value})}
                    required={formData.manager_type === 'academy_manager'}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: `2px solid ${formData.manager_type === 'academy_manager' && !formData.main_location_id ? '#dc3545' : '#e9ecef'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">⚠️ 지점을 선택해주세요</option>
                    {mainLocations.map(location => (
                      <option key={location.id} value={location.id.toString()}>
                        📍 {location.name} ({location.location_type})
                      </option>
                    ))}
                  </select>
                  {formData.manager_type === 'academy_manager' && !formData.main_location_id && (
                    <div style={{
                      fontSize: '12px',
                      color: '#dc3545',
                      marginTop: '4px'
                    }}>
                      ⚠️ 학원 매니저는 소속 지점을 반드시 선택해야 합니다.
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  직책 (선택사항)
                </label>
                <select
                  value={formData.position_id}
                  onChange={(e) => setFormData({...formData, position_id: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">직책 선택 (선택사항)</option>
                  {positions.map(position => (
                    <option key={position.id} value={position.id.toString()}>
                      {position.position_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '30px',
                paddingTop: '20px',
                borderTop: '1px solid #e9ecef'
              }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: saving ? '#9ca3af' : '#1d4ed8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  {saving ? '저장 중...' : (selectedManager ? '수정' : '추가')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 임시 패스워드 표시 모달 */}
      {showTempPasswordModal && tempPasswordInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              padding: '24px 24px 0',
              marginBottom: '20px'
            }}>
              <h2 style={{
                margin: 0,
                color: '#2c3e50',
                fontSize: '20px',
                fontWeight: '700'
              }}>
                🔑 매니저 등록 완료
              </h2>
            </div>
            
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{
                backgroundColor: '#d4edda',
                border: '1px solid #c3e6cb',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <p style={{ margin: '0 0 8px 0', color: '#155724' }}>
                  ✅ {tempPasswordInfo.name} 매니저가 성공적으로 등록되었습니다!
                </p>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#2c3e50'
                  }}>
                    로그인 이메일:
                  </label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    <span style={{
                      flex: 1,
                      fontSize: '16px',
                      color: '#007bff'
                    }}>
                      {tempPasswordInfo.email}
                    </span>
                    <button
                      onClick={() => copyToClipboard(tempPasswordInfo.email)}
                      style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginLeft: '12px'
                      }}
                    >
                      📋 복사
                    </button>
                  </div>
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#2c3e50'
                  }}>
                    통일 패스워드:
                  </label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    <span style={{
                      flex: 1,
                      fontSize: '16px',
                      color: '#007bff',
                      fontWeight: 'bold',
                      letterSpacing: '1px'
                    }}>
                      {tempPasswordInfo.password}
                    </span>
                    <button
                      onClick={() => copyToClipboard(tempPasswordInfo.password)}
                      style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginLeft: '12px'
                      }}
                    >
                      📋 복사
                    </button>
                  </div>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '30px'
              }}>
                <button
                  onClick={() => {
                    setShowTempPasswordModal(false);
                    setTempPasswordInfo(null);
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

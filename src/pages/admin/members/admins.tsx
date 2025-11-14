// src/pages/admin/members/admins.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabaseClient';

interface Admin {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  organization_id?: number;
  position_id?: number;
  organization_name?: string;
  position_name?: string;
  has_admin_record?: boolean;
}

interface Organization {
  id: number;
  org_name: string;
  is_active: boolean;
}

interface Position {
  id: number;
  position_name: string;
}

interface AdminFormData {
  email: string;
  name: string;
  phone: string;
  role: string;
  organization_id: string;
  position_id: string;
}

export default function AdminsManagementPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [formData, setFormData] = useState<AdminFormData>({
    email: '',
    name: '',
    phone: '',
    role: 'schedule_admin',
    organization_id: '',
    position_id: ''
  });

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    
    if (role !== 'system_admin') {
      alert('시스템 관리자만 접근할 수 있습니다.');
      router.replace('/admin/members/overview');
      return;
    }

    initializeData();
  }, [router]);

  const initializeData = async () => {
    setLoading(true);
    await Promise.all([
      loadAdmins(),
      loadOrganizations(), 
      loadPositions()
    ]);
    setLoading(false);
  };

  // ✅ 수정된 관리자 목록 조회 - 변수명 오류 해결
  const loadAdmins = async () => {
    try {
      console.log('🔍 관리자 목록 조회 시작');

      // users와 admins 테이블 JOIN 쿼리 (트리거로 연동된 데이터)
      const { data: adminsData, error } = await supabase
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
          admins (
            organization_id,
            position_id,
            organizations (
              id, 
              org_name
            ),
            positions (
              id, 
              position_name
            )
          )
        `)
       .in('role', ['system_admin', 'schedule_admin', 'manager', 'academy_manager', 'online_manager'])
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('🚨 JOIN 쿼리 실패:', error);
        throw error;
      }

      // ✅ 수정: data → adminsData 사용
      console.log('✅ 조회된 관리자 데이터:', adminsData);

      // 데이터 가공 및 정렬
      const enrichedData = (adminsData || []).map(user => {
        const adminInfo = user.admins?.[0];
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
          organization_id: adminInfo?.organization_id,
          position_id: adminInfo?.position_id,
          organization_name: adminInfo?.organizations?.org_name || '미설정',
          position_name: adminInfo?.positions?.position_name || '미설정',
          has_admin_record: !!adminInfo
        };
      });

      // 🔄 조직 → 직책 → 생성일시 순 정렬
      enrichedData.sort((a, b) => {
        // 1순위: 소속 ID (organization_id)
        const orgIdA = a.organization_id || 999999; // 미설정은 맨 뒤로
        const orgIdB = b.organization_id || 999999;
        if (orgIdA !== orgIdB) return orgIdA - orgIdB;
        
        // 2순위: 직책 ID (position_id)  
        const posIdA = a.position_id || 999999; // 미설정은 맨 뒤로
        const posIdB = b.position_id || 999999;
        if (posIdA !== posIdB) return posIdA - posIdB;
        
        // 3순위: 생성일시 (최신순)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      console.log('✅ 정렬된 관리자 데이터:', enrichedData.length, '명');
      setAdmins(enrichedData);

    } catch (error) {
      console.error('❌ 관리자 목록 조회 실패:', error);
      
      // 백업: 단순 조회
      try {
        console.log('🔄 백업 조회 실행');
        const { data: backupData, error: backupError } = await supabase
          .from('users')
          .select('id, name, email, phone, role, status, is_active, created_at')
          .in('role', ['system_admin', 'schedule_admin', 'manager', 'academy_manager', 'online_manager'])
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (backupError) throw backupError;
        
        const simpleData = (backupData || []).map(user => ({
          ...user,
          organization_name: '미설정',
          position_name: '미설정',
          has_admin_record: false
        }));
        
        console.log('✅ 백업 조회 성공:', simpleData.length, '명');
        setAdmins(simpleData);
      } catch (backupErr) {
        console.error('❌ 백업 조회도 실패:', backupErr);
        setAdmins([]);
      }
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, org_name, is_active')
        .eq('is_active', true)
        .order('org_name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('조직 목록 조회 실패:', error);
      setOrganizations([]);
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
    } catch (error) {
      console.error('직책 목록 조회 실패:', error);
      setPositions([]);
    }
  };

  const createAdmin = async (adminData: AdminFormData) => {
    try {
      console.log('📡 API 요청 전송:', adminData);
      
      const response = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminData),
      });

      console.log('📡 API 응답 상태:', response.status, response.statusText);

      const result = await response.json();
      console.log('📡 API 응답 데이터:', result);

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true, tempPassword: 'qwer1234!' };

    } catch (error) {
      console.error('❌ createAdmin 에러:', error);
      throw new Error(`관리자 생성 실패: ${error instanceof Error ? error.message : '네트워크 오류'}`);
    }
  };

  const downloadSampleCSV = (): void => {
    const csvRows = [
      '이메일,이름,전화번호,역할,소속ID,직책ID',
      'admin1@eduwill.com,홍길동,010-1234-5678,schedule_admin,1,2',
      'admin2@eduwill.com,김관리자,010-5678-1234,system_admin,1,3',
      'manager1@eduwill.com,이매니저,010-3456-7890,academy_manager,2,1',
      'online1@eduwill.com,최온라인,010-7890-1234,online_manager,1,4'
    ];

    const csvContent = csvRows.join('\n');
    const BOM = '\uFEFF';
    const fullContent = BOM + csvContent;
    
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', '관리자_업로드_샘플.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            const adminData: AdminFormData = {
              email: values[0].trim(),
              name: values[1].trim(),
              phone: values[2]?.trim() || '',
              role: values[3]?.trim() || 'schedule_admin',
              organization_id: values[4]?.trim() || '',
              position_id: values[5]?.trim() || ''
            };
            
            if (!['system_admin', 'schedule_admin', 'manager', 'academy_manager', 'online_manager'].includes(adminData.role)) {
              adminData.role = 'schedule_admin';
            }
            
            console.log(`🔍 전송할 관리자 데이터:`, adminData);
            
            if (adminData.email.includes('@') && adminData.email.includes('.')) {
              try {
                const result = await createAdmin(adminData);
                console.log(`✅ 관리자 생성 성공:`, result);
                results.created++;
              } catch (error) {
                console.error(`❌ 관리자 생성 실패:`, error);
                results.errors.push(`${adminData.name}: ${error instanceof Error ? error.message : '생성 실패'}`);
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
      message += `\n📋 모든 관리자 임시 비밀번호: qwer1234!`;
      
      alert(message);
      setShowImportModal(false);
      setSelectedFile(null);
      loadAdmins();
      
    } catch (error) {
      console.error('❌ 파일 업로드 실패:', error);
      alert(`파일 업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleEditAdmin = async () => {
    if (!editingAdmin) return;

    try {
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: formData.name,
          phone: formData.phone || null,
          role: formData.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingAdmin.id);

      if (userError) throw userError;

      alert('관리자 정보가 수정되었습니다.');
      setShowModal(false);
      setEditingAdmin(null);
      loadAdmins();
    } catch (error) {
      console.error('수정 실패:', error);
      alert('수정에 실패했습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('이름과 이메일은 필수입니다.');
      return;
    }

    setSaving(true);

    try {
      if (editingAdmin) {
        await handleEditAdmin();
      } else {
        const result = await createAdmin(formData);
        
        if (result.success && result.tempPassword) {
          setTempPassword(result.tempPassword);
          setShowTempPasswordModal(true);
        }
      }
      
      closeModal();
      loadAdmins();
    } catch (error) {
      console.error('저장 실패:', error);
      alert(`저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${name} 관리자를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/admin/delete-admin', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '삭제 실패');
      }

      alert('관리자가 삭제되었습니다.');
      loadAdmins();
    } catch (error) {
      alert('삭제에 실패했습니다.');
    }
  };

  const openEditModal = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      name: admin.name,
      phone: admin.phone || '',
      role: admin.role,
      organization_id: admin.organization_id?.toString() || '',
      position_id: admin.position_id?.toString() || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAdmin(null);
    setFormData({
      email: '',
      name: '',
      phone: '',
      role: 'schedule_admin',
      organization_id: '',
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

  const getRoleDisplayName = (role: string) => {
    const roleNames: { [key: string]: string } = {
      'system_admin': '시스템 관리자',
      'schedule_admin': '스케줄 관리자',
      'academy_manager': '학원 매니저',
      'online_manager': '온라인 매니저'
    };
    return roleNames[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      'system_admin': '#e11d48',
      'schedule_admin': '#f59e0b',
      'academy_manager': '#10b981',
      'online_manager': '#3b82f6'
    };
    return colors[role] || '#6b7280';
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>관리자 데이터를 불러오는 중...</div>
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
              👨‍💼 관리자 관리 ({admins.length}명)
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
              onClick={() => setShowModal(true)}
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
              + 관리자 추가
            </button>
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
            🔐 <strong>서버 API 연동:</strong> 모든 관리자 생성/삭제는 서버에서 처리
          </p>
          <p style={{ margin: '0 0 8px 0', color: '#0c5460', fontSize: '14px' }}>
            🎯 <strong>JOIN 쿼리:</strong> 조직/직책 정보를 포함하여 관리자 목록 표시
          </p>
          <p style={{ margin: 0, color: '#0c5460', fontSize: '14px' }}>
            🔑 <strong>임시 패스워드:</strong> 모든 관리자는 qwer1234! 사용 후 변경
          </p>
        </div>

        {/* 관리자 목록 테이블 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {/* ✅ 수정된 테이블 헤더 - 6열 구조 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr 2fr',
            gap: '16px',
            padding: '20px 24px',
            backgroundColor: '#f8fafc',
            fontWeight: '600',
            fontSize: '14px',
            color: '#374151',
            borderBottom: '2px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div>관리자 정보</div>
            <div>역할</div>
            <div>소속</div>
            <div>직책</div>
            <div>상태</div>
            <div>관리 액션</div>
          </div>

          {/* ✅ 수정된 관리자 목록 - 6열 구조 + 조직/직책 정보 표시 */}
          {admins.map((admin) => (
            <div
              key={admin.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr 2fr',
                gap: '16px',
                padding: '20px 24px',
                borderBottom: '1px solid #f3f4f6',
                alignItems: 'center'
              }}
            >
              {/* 관리자 정보 */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '4px',
                  fontSize: '14px'
                }}>
                  {admin.name}
                </div>
                <div style={{
                  color: '#6b7280',
                  fontSize: '12px',
                  marginBottom: '2px'
                }}>
                  {admin.email}
                </div>
                {admin.phone && (
                  <div style={{
                    color: '#9ca3af',
                    fontSize: '11px'
                  }}>
                    {admin.phone}
                  </div>
                )}
              </div>

              {/* 역할 */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  backgroundColor: getRoleColor(admin.role) + '20',
                  color: getRoleColor(admin.role),
                  display: 'inline-block'
                }}>
                  {getRoleDisplayName(admin.role)}
                </span>
              </div>

              {/* ✅ 추가된 소속 정보 */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: '#f3f4f6',
                  color: '#374151'
                }}>
                  {admin.organization_name || '미설정'}
                </span>
              </div>

              {/* ✅ 추가된 직책 정보 */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: '#e0f2fe',
                  color: '#0277bd'
                }}>
                  {admin.position_name || '미설정'}
                </span>
              </div>

              {/* 상태 */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  backgroundColor: admin.is_active ? '#10b98120' : '#ef444420',
                  color: admin.is_active ? '#10b981' : '#ef4444',
                  display: 'inline-block'
                }}>
                  {admin.is_active ? '활성' : '비활성'}
                </span>
              </div>

              {/* 관리 액션 */}
              <div style={{ 
                display: 'flex', 
                gap: '4px', 
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => openEditModal(admin)}
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
                  onClick={() => handleDelete(admin.id, admin.name)}
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

          {admins.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: '#9ca3af'
            }}>
              등록된 관리자가 없습니다.
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
                📤 관리자 CSV 업로드
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
                형식: 이메일,이름,전화번호,역할,소속ID,직책ID<br/>
                임시 패스워드: qwer1234!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 추가/수정 모달 */}
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
                {editingAdmin ? '관리자 정보 수정' : '새 관리자 추가'}
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
                  이메일 * {editingAdmin && <small>(수정 불가)</small>}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  disabled={!!editingAdmin}
                  placeholder="admin@eduwill.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: editingAdmin ? '#f8f9fa' : 'white',
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
                  placeholder="관리자 이름"
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
                  역할 *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="schedule_admin">스케줄 관리자</option>
                  <option value="academy_manager">학원 매니저</option>
                  <option value="online_manager">온라인 매니저</option>
                  <option value="system_admin">시스템 관리자</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  소속
                </label>
                <select
                  value={formData.organization_id}
                  onChange={(e) => setFormData({...formData, organization_id: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">소속 선택</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id.toString()}>
                      {org.org_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  직책
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
                  <option value="">직책 선택</option>
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
                  {saving ? '저장 중...' : (editingAdmin ? '수정' : '추가')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 임시 패스워드 표시 모달 */}
      {showTempPasswordModal && (
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
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
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
                🔑 관리자 등록 완료
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
                  ✅ {formData.name} 관리자가 성공적으로 등록되었습니다!
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
                      {formData.email}
                    </span>
                    <button
                      onClick={() => copyToClipboard(formData.email)}
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
                    임시 패스워드:
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
                      {tempPassword}
                    </span>
                    <button
                      onClick={() => copyToClipboard(tempPassword)}
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
                  onClick={() => setShowTempPasswordModal(false)}
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

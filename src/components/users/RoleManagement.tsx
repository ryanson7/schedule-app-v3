"use client";
import { useState, useEffect } from 'react';
import { useRoles } from '../../hooks/useUsers';
import { PrimaryButton, SecondaryButton, GhostButton } from '../ui/buttons';
import { Input, TextArea } from '../ui/form';
import ModalBase from '../modals/ModalBase';
import { 
  Role, 
  UserRoleType, 
  RolePermissions,
  PermissionLevel,
  ROLE_LABELS,
  ROLE_COLORS,
  DEFAULT_PERMISSIONS 
} from '../../types/users';
import { supabase } from '../../utils/supabaseClient';

interface RoleManagementProps {
  currentUserRole: UserRoleType;
}

interface RoleFormData {
  name: string;
  description: string;
  permissions: RolePermissions;
  is_system_role: boolean;
}

const RoleManagement = ({ currentUserRole }: RoleManagementProps) => {
  const { roles, loading, fetchRoles } = useRoles();
  
  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  
  // 폼 상태
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    permissions: {
      academy_schedules: 'none',
      studio_schedules: 'none',
      user_management: 'none',
      system_settings: 'none',
      shooting_tasks: 'none'
    },
    is_system_role: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 권한 확인 - 시스템 관리자만 역할 관리 가능
  const canManageRoles = currentUserRole === 'system_admin';

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // 역할 생성
  const handleCreateRole = async () => {
    if (!canManageRoles) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('roles')
        .insert({
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
          is_system_role: formData.is_system_role
        });

      if (error) throw error;

      alert('역할이 생성되었습니다.');
      setShowCreateModal(false);
      resetForm();
      fetchRoles();
    } catch (error) {
      console.error('역할 생성 오류:', error);
      alert('역할 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 역할 수정
  const handleUpdateRole = async () => {
    if (!canManageRoles || !selectedRole) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('roles')
        .update({
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions
        })
        .eq('id', selectedRole.id);

      if (error) throw error;

      alert('역할이 수정되었습니다.');
      setShowEditModal(false);
      resetForm();
      fetchRoles();
    } catch (error) {
      console.error('역할 수정 오류:', error);
      alert('역할 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 역할 삭제
  const handleDeleteRole = async (roleId: number, roleName: string) => {
    if (!canManageRoles) return;
    
    if (!confirm(`'${roleName}' 역할을 삭제하시겠습니까?\n이 역할을 가진 사용자들은 역할이 제거됩니다.`)) {
      return;
    }

    try {
      // 먼저 해당 역할을 가진 사용자들의 역할 제거
      await supabase
        .from('user_roles')
        .delete()
        .eq('role_id', roleId);

      // 역할 삭제
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      alert('역할이 삭제되었습니다.');
      fetchRoles();
    } catch (error) {
      console.error('역할 삭제 오류:', error);
      alert('역할 삭제에 실패했습니다.');
    }
  };

  // 역할 편집 모달 열기
  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || DEFAULT_PERMISSIONS.staff,
      is_system_role: role.is_system_role
    });
    setShowEditModal(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: {
        academy_schedules: 'none',
        studio_schedules: 'none',
        user_management: 'none',
        system_settings: 'none',
        shooting_tasks: 'none'
      },
      is_system_role: false
    });
    setSelectedRole(null);
  };

  // 권한 변경 핸들러
  const handlePermissionChange = (resource: keyof RolePermissions, level: PermissionLevel) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [resource]: level
      }
    }));
  };

  // 권한 레벨 옵션
  const permissionOptions: { value: PermissionLevel; label: string }[] = [
    { value: 'none', label: '권한 없음' },
    { value: 'read', label: '조회만' },
    { value: 'write', label: '등록/수정' },
    { value: 'manage', label: '관리' },
    { value: 'admin', label: '전체 권한' },
    { value: 'assigned_only', label: '담당 영역만' }
  ];

  // 리소스 레이블
  const resourceLabels: Record<keyof RolePermissions, string> = {
    academy_schedules: '학원 스케줄',
    studio_schedules: '스튜디오 스케줄',
    user_management: '사용자 관리',
    system_settings: '시스템 설정',
    shooting_tasks: '촬영 업무'
  };

  if (!canManageRoles) {
    return (
      <div className="access-denied">
        <h2>접근 권한이 없습니다</h2>
        <p>역할 관리는 시스템 관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="role-management">
      {/* 헤더 */}
      <div className="management-header">
        <div className="header-left">
          <h1>역할 관리</h1>
          <p className="subtitle">시스템 역할 및 권한 관리</p>
        </div>
        <div className="header-right">
          <PrimaryButton onClick={() => setShowCreateModal(true)}>
            새 역할 생성
          </PrimaryButton>
        </div>
      </div>

      {/* 기본 역할 안내 */}
      <div className="system-roles-info">
        <h3>기본 시스템 역할</h3>
        <div className="default-roles">
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <div key={key} className="role-card system-role">
              <div className="role-header">
                <span 
                  className="role-name"
                  style={{ color: ROLE_COLORS[key as UserRoleType] }}
                >
                  {label}
                </span>
                <span className="system-badge">시스템</span>
              </div>
              <div className="role-permissions">
                {Object.entries(DEFAULT_PERMISSIONS[key as UserRoleType]).map(([resource, permission]) => (
                  <span key={resource} className={`permission-tag ${permission}`}>
                    {resourceLabels[resource as keyof RolePermissions]}: {
                      permission === 'none' ? '없음' :
                      permission === 'read' ? '조회' :
                      permission === 'write' ? '등록/수정' :
                      permission === 'manage' ? '관리' :
                      permission === 'admin' ? '전체' :
                      permission === 'assigned_only' ? '담당만' : permission
                    }
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 커스텀 역할 목록 */}
      <div className="custom-roles-section">
        <h3>커스텀 역할</h3>
        {loading ? (
          <div className="loading">역할 목록을 불러오는 중...</div>
        ) : (
          <div className="roles-grid">
            {roles.filter(role => !role.is_system_role).map(role => (
              <div key={role.id} className="role-card">
                <div className="role-header">
                  <span className="role-name">{role.name}</span>
                  <div className="role-actions">
                    <SecondaryButton 
                      size="sm"
                      onClick={() => handleEditRole(role)}
                    >
                      편집
                    </SecondaryButton>
                    <GhostButton 
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteRole(role.id, role.name)}
                    >
                      삭제
                    </GhostButton>
                  </div>
                </div>
                {role.description && (
                  <p className="role-description">{role.description}</p>
                )}
                <div className="role-permissions">
                  {role.permissions && Object.entries(role.permissions).map(([resource, permission]) => (
                    <span key={resource} className={`permission-tag ${permission}`}>
                      {resourceLabels[resource as keyof RolePermissions]}: {
                        permission === 'none' ? '없음' :
                        permission === 'read' ? '조회' :
                        permission === 'write' ? '등록/수정' :
                        permission === 'manage' ? '관리' :
                        permission === 'admin' ? '전체' :
                        permission === 'assigned_only' ? '담당만' : permission
                      }
                    </span>
                  ))}
                </div>
              </div>
            ))}
            
            {roles.filter(role => !role.is_system_role).length === 0 && (
              <div className="empty-state">
                <p>생성된 커스텀 역할이 없습니다.</p>
                <SecondaryButton onClick={() => setShowCreateModal(true)}>
                  첫 번째 역할 만들기
                </SecondaryButton>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 역할 생성 모달 */}
      <ModalBase
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="새 역할 생성"
        size="lg"
        footer={
          <div className="modal-footer">
            <SecondaryButton onClick={() => setShowCreateModal(false)}>
              취소
            </SecondaryButton>
            <PrimaryButton 
              onClick={handleCreateRole}
              loading={isSubmitting}
              disabled={!formData.name.trim()}
            >
              생성
            </PrimaryButton>
          </div>
        }
      >
        <RoleForm
          formData={formData}
          setFormData={setFormData}
          onPermissionChange={handlePermissionChange}
          permissionOptions={permissionOptions}
          resourceLabels={resourceLabels}
        />
      </ModalBase>

      {/* 역할 수정 모달 */}
      <ModalBase
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="역할 수정"
        size="lg"
        footer={
          <div className="modal-footer">
            <SecondaryButton onClick={() => setShowEditModal(false)}>
              취소
            </SecondaryButton>
            <PrimaryButton 
              onClick={handleUpdateRole}
              loading={isSubmitting}
              disabled={!formData.name.trim()}
            >
              수정
            </PrimaryButton>
          </div>
        }
      >
        <RoleForm
          formData={formData}
          setFormData={setFormData}
          onPermissionChange={handlePermissionChange}
          permissionOptions={permissionOptions}
          resourceLabels={resourceLabels}
          isEdit={true}
        />
      </ModalBase>

      {/* 스타일 */}
      <style jsx>{`
        .role-management {
          padding: 24px;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .management-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }

        .header-left h1 {
          margin: 0 0 4px 0;
          color: #1f2937;
          font-size: 24px;
          font-weight: 600;
        }

        .subtitle {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .system-roles-info,
        .custom-roles-section {
          margin-bottom: 32px;
        }

        .system-roles-info h3,
        .custom-roles-section h3 {
          margin: 0 0 16px 0;
          color: #1f2937;
          font-size: 18px;
          font-weight: 600;
        }

        .default-roles,
        .roles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .role-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          background: #ffffff;
        }

        .role-card.system-role {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .role-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .role-name {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .system-badge {
          background: #6b7280;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .role-actions {
          display: flex;
          gap: 4px;
        }

        .role-description {
          margin: 0 0 12px 0;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.4;
        }

        .role-permissions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .permission-tag {
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .permission-tag.none {
          background: #f3f4f6;
          color: #6b7280;
        }

        .permission-tag.read {
          background: #dbeafe;
          color: #1e40af;
        }

        .permission-tag.write {
          background: #d1fae5;
          color: #065f46;
        }

        .permission-tag.manage {
          background: #fef3c7;
          color: #92400e;
        }

        .permission-tag.admin {
          background: #ede9fe;
          color: #6b21a8;
        }

        .permission-tag.assigned_only {
          background: #e0e7ff;
          color: #3730a3;
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 48px;
          color: #6b7280;
        }

        .empty-state p {
          margin: 0 0 16px 0;
        }

        .loading {
          text-align: center;
          padding: 48px;
          color: #6b7280;
        }

        .access-denied {
          text-align: center;
          padding: 48px;
        }

        .access-denied h2 {
          color: #dc2626;
          margin-bottom: 8px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .management-header {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }

          .default-roles,
          .roles-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

// 역할 폼 컴포넌트
interface RoleFormProps {
  formData: RoleFormData;
  setFormData: (data: RoleFormData) => void;
  onPermissionChange: (resource: keyof RolePermissions, level: PermissionLevel) => void;
  permissionOptions: { value: PermissionLevel; label: string }[];
  resourceLabels: Record<keyof RolePermissions, string>;
  isEdit?: boolean;
}

const RoleForm = ({ 
  formData, 
  setFormData, 
  onPermissionChange, 
  permissionOptions, 
  resourceLabels,
  isEdit = false 
}: RoleFormProps) => {
  return (
    <div className="role-form">
      {/* 기본 정보 */}
      <div className="form-section">
        <h4>기본 정보</h4>
        <div className="form-group">
          <label>역할 이름 *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="역할 이름을 입력하세요"
            disabled={isEdit && formData.is_system_role}
          />
        </div>
        <div className="form-group">
          <label>설명</label>
          <TextArea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="역할에 대한 설명을 입력하세요"
            rows={3}
          />
        </div>
      </div>

      {/* 권한 설정 */}
      <div className="form-section">
        <h4>권한 설정</h4>
        <div className="permissions-grid">
          {Object.entries(resourceLabels).map(([resource, label]) => (
            <div key={resource} className="permission-row">
              <span className="resource-label">{label}</span>
              <select
                value={formData.permissions[resource as keyof RolePermissions]}
                onChange={(e) => onPermissionChange(
                  resource as keyof RolePermissions, 
                  e.target.value as PermissionLevel
                )}
                className="permission-select"
              >
                {permissionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .role-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-section h4 {
          margin: 0;
          color: #1f2937;
          font-size: 16px;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .permissions-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .permission-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .resource-label {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }

        .permission-select {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 13px;
          background: white;
        }

        .permission-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
      `}</style>
    </div>
  );
};

// 🔥 Default export로 내보내기
export default RoleManagement;

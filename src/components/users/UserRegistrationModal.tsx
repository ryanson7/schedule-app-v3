"use client";
import { useState, useEffect } from 'react';
import { useUsers } from '../../hooks/useUsers';
import ModalBase from '../modals/ModalBase';
import { PrimaryButton, SecondaryButton } from '../ui/buttons';
import { Input, Select, TextArea } from '../ui/form';
import { 
  CreateUserFormData, 
  UserRoleType, 
  ShooterType,
  ROLE_LABELS,
  DEFAULT_PERMISSIONS 
} from '../../types/users';
import { hasPermission } from '../../utils/simplePermissions';

interface UserRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUserRole: UserRoleType;
  editUser?: any;
}

interface SelectOption {
  value: string | number;
  label: string;
}

const UserRegistrationModal = ({ 
  open, 
  onClose, 
  onSuccess, 
  currentUserRole,
  editUser 
}: UserRegistrationModalProps) => {
  const { createUser, updateUser, loading } = useUsers();

  // 폼 데이터 상태
  const [formData, setFormData] = useState<CreateUserFormData>({
    email: '',
    name: '',
    username: '',
    phone: '',
    role: 'staff',
    team_id: undefined,
    academy_id: undefined,
    shooter_type: undefined,
    hourly_rate: undefined,
    specialties: [],
    password: ''
  });

  // 폼 검증 상태
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 추가 상태
  const [availableAcademies, setAvailableAcademies] = useState<SelectOption[]>([]);
  const [availableTeams, setAvailableTeams] = useState<SelectOption[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState('');

  // 수정 모드 확인
  const isEditMode = !!editUser;

  // 현재 사용자가 할당할 수 있는 역할들
  const getAvailableRoles = (): UserRoleType[] => {
    switch (currentUserRole) {
      case 'system_admin':
        return ['system_admin', 'schedule_admin', 'academy_manager', 'online_manager', 'shooter', 'professor', 'staff'];
      case 'schedule_admin':
        return ['academy_manager', 'online_manager', 'shooter', 'professor', 'staff'];
      case 'academy_manager':
        return ['shooter', 'professor', 'staff'];
      case 'online_manager':
        return ['shooter', 'professor', 'staff'];
      default:
        return ['staff'];
    }
  };

  // 역할 옵션 변환
  const getRoleOptions = (): SelectOption[] => {
    const availableRoles = getAvailableRoles();
    return availableRoles.map(role => ({
      value: role,
      label: ROLE_LABELS[role]
    }));
  };

  // 촬영 유형 옵션
  const getShooterTypeOptions = (): SelectOption[] => {
    return [
      { value: 'photo', label: '사진 촬영' },
      { value: 'video', label: '영상 촬영' },
      { value: 'live', label: '라이브 촬영' },
      { value: 'broadcast', label: '방송 촬영' },
      { value: 'multi', label: '멀티미디어' }
    ];
  };

  // 초기 데이터 설정
  useEffect(() => {
    if (isEditMode && editUser) {
      setFormData({
        email: editUser.email || '',
        name: editUser.name || '',
        username: editUser.username || '',
        phone: editUser.phone || '',
        role: editUser.role || 'staff',
        team_id: editUser.team_id,
        academy_id: editUser.academy_id,
        shooter_type: editUser.shooter_type,
        hourly_rate: editUser.hourly_rate,
        specialties: editUser.specialties || [],
        password: ''
      });
    } else {
      setFormData({
        email: '',
        name: '',
        username: '',
        phone: '',
        role: 'staff',
        team_id: undefined,
        academy_id: undefined,
        shooter_type: undefined,
        hourly_rate: undefined,
        specialties: [],
        password: ''
      });
    }
    setErrors({});
  }, [isEditMode, editUser, open]);

  // 학원 및 팀 목록 로드
  useEffect(() => {
    if (open) {
      loadAcademiesAndTeams();
    }
  }, [open]);

  const loadAcademiesAndTeams = async () => {
    try {
      setAvailableAcademies([
        { value: 1, label: '강남 학원' },
        { value: 2, label: '홍대 학원' },
        { value: 3, label: '신촌 학원' }
      ]);

      setAvailableTeams([
        { value: 1, label: '촬영팀' },
        { value: 2, label: '편집팀' },
        { value: 3, label: '관리팀' }
      ]);
    } catch (error) {
      console.error('학원/팀 목록 로드 오류:', error);
    }
  };

  // 폼 입력 핸들러
  const handleInputChange = (field: keyof CreateUserFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // 전문 분야 추가
  const handleAddSpecialty = () => {
    if (specialtyInput.trim() && !formData.specialties?.includes(specialtyInput.trim())) {
      setFormData(prev => ({
        ...prev,
        specialties: [...(prev.specialties || []), specialtyInput.trim()]
      }));
      setSpecialtyInput('');
    }
  };

  // 전문 분야 제거
  const handleRemoveSpecialty = (specialty: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties?.filter(s => s !== specialty) || []
    }));
  };

  // 폼 검증
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }

    if (!formData.email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식을 입력해주세요.';
    }

    if (!isEditMode && !formData.password.trim()) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (!isEditMode && formData.password.length < 6) {
      newErrors.password = '비밀번호는 최소 6자 이상이어야 합니다.';
    }

    if (formData.role === 'academy_manager' && !formData.academy_id) {
      newErrors.academy_id = '학원 매니저는 담당 학원을 선택해야 합니다.';
    }

    if (formData.role === 'shooter' && !formData.shooter_type) {
      newErrors.shooter_type = '촬영자는 촬영 유형을 선택해야 합니다.';
    }

    if (formData.phone && !/^[0-9-+\s()]+$/.test(formData.phone)) {
      newErrors.phone = '올바른 전화번호 형식을 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      let success = false;

      if (isEditMode) {
        success = await updateUser({
          id: editUser.id,
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
          team_id: formData.team_id,
          academy_id: formData.academy_id,
          shooter_type: formData.shooter_type,
          hourly_rate: formData.hourly_rate,
          specialties: formData.specialties
        });
      } else {
        success = await createUser(formData);
      }

      if (success) {
        onSuccess();
      }
    } catch (error) {
      console.error('사용자 저장 오류:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 역할 변경 시 관련 필드 초기화
  const handleRoleChange = (role: UserRoleType) => {
    handleInputChange('role', role);
    
    if (role !== 'academy_manager') {
      handleInputChange('academy_id', undefined);
    }
    if (role !== 'shooter') {
      handleInputChange('shooter_type', undefined);
    }
  };

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title={isEditMode ? '사용자 정보 수정' : '새 사용자 등록'}
      size="lg"
      footer={
        <div className="modal-footer">
          <SecondaryButton onClick={onClose} disabled={isSubmitting}>
            취소
          </SecondaryButton>
          <PrimaryButton 
            onClick={handleSubmit}
            loading={isSubmitting || loading}
            disabled={isSubmitting || loading}
          >
            {isEditMode ? '수정' : '등록'}
          </PrimaryButton>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="user-form">
        {/* 기본 정보 */}
        <div className="form-section">
          <h3 className="section-title">기본 정보</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">이름 *</label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="이름을 입력하세요"
                error={errors.name}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">이메일 *</label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="이메일을 입력하세요"
                error={errors.email}
                disabled={isEditMode}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="username">사용자명</label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="사용자명을 입력하세요"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">전화번호</label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="전화번호를 입력하세요"
                error={errors.phone}
              />
            </div>
          </div>

          {!isEditMode && (
            <div className="form-group">
              <label htmlFor="password">비밀번호 *</label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="비밀번호를 입력하세요"
                error={errors.password}
                required
              />
            </div>
          )}
        </div>

        {/* 역할 및 권한 */}
        <div className="form-section">
          <h3 className="section-title">역할 및 권한</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="role">역할 *</label>
              <Select
                id="role"
                value={formData.role}
                onChange={(e) => handleRoleChange(e.target.value as UserRoleType)}
                options={getRoleOptions()}
                placeholder="역할을 선택하세요"
                error={errors.role}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="team_id">소속 팀</label>
              <Select
                id="team_id"
                value={formData.team_id || ''}
                onChange={(e) => handleInputChange('team_id', e.target.value ? Number(e.target.value) : undefined)}
                options={availableTeams}
                placeholder="팀을 선택하세요"
              />
            </div>
          </div>

          {/* 학원 매니저용 학원 선택 */}
          {formData.role === 'academy_manager' && (
            <div className="form-group">
              <label htmlFor="academy_id">담당 학원 *</label>
              <Select
                id="academy_id"
                value={formData.academy_id || ''}
                onChange={(e) => handleInputChange('academy_id', e.target.value ? Number(e.target.value) : undefined)}
                options={availableAcademies}
                placeholder="학원을 선택하세요"
                error={errors.academy_id}
                required
              />
            </div>
          )}
        </div>

        {/* 촬영자 전용 정보 */}
        {formData.role === 'shooter' && (
          <div className="form-section">
            <h3 className="section-title">촬영자 정보</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="shooter_type">촬영 유형 *</label>
                <Select
                  id="shooter_type"
                  value={formData.shooter_type || ''}
                  onChange={(e) => handleInputChange('shooter_type', e.target.value as ShooterType)}
                  options={getShooterTypeOptions()}
                  placeholder="촬영 유형을 선택하세요"
                  error={errors.shooter_type}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="hourly_rate">시급 (원)</label>
                <Input
                  id="hourly_rate"
                  type="number"
                  value={formData.hourly_rate || ''}
                  onChange={(e) => handleInputChange('hourly_rate', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="시급을 입력하세요"
                  min="0"
                />
              </div>
            </div>

            {/* 전문 분야 */}
            <div className="form-group">
              <label>전문 분야</label>
              <div className="specialty-input">
                <Input
                  value={specialtyInput}
                  onChange={(e) => setSpecialtyInput(e.target.value)}
                  placeholder="전문 분야를 입력하고 추가 버튼을 클릭하세요"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialty())}
                />
                <SecondaryButton 
                  type="button"
                  onClick={handleAddSpecialty}
                  disabled={!specialtyInput.trim()}
                >
                  추가
                </SecondaryButton>
              </div>
              
              {formData.specialties && formData.specialties.length > 0 && (
                <div className="specialty-tags">
                  {formData.specialties.map((specialty, index) => (
                    <span key={index} className="specialty-tag">
                      {specialty}
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecialty(specialty)}
                        className="remove-tag"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 권한 미리보기 */}
        <div className="form-section">
          <h3 className="section-title">권한 미리보기</h3>
          <div className="permissions-preview">
            {Object.entries(DEFAULT_PERMISSIONS[formData.role]).map(([resource, permission]) => (
              <div key={resource} className="permission-item">
                <span className="resource-name">
                  {resource === 'academy_schedules' ? '학원 스케줄' :
                   resource === 'studio_schedules' ? '스튜디오 스케줄' :
                   resource === 'user_management' ? '사용자 관리' :
                   resource === 'system_settings' ? '시스템 설정' :
                   resource === 'shooting_tasks' ? '촬영 업무' : resource}
                </span>
                <span className={`permission-level ${permission}`}>
                  {permission === 'none' ? '권한 없음' :
                   permission === 'read' ? '조회만' :
                   permission === 'write' ? '등록/수정' :
                   permission === 'manage' ? '관리' :
                   permission === 'admin' ? '전체 권한' :
                   permission === 'assigned_only' ? '담당 영역만' : permission}
                </span>
              </div>
            ))}
          </div>
        </div>
      </form>

      <style jsx>{`
        .user-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-section {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
        }

        .section-title {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
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

        .specialty-input {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .specialty-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        .specialty-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #3b82f6;
          color: white;
          padding: 4px 8px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }

        .remove-tag {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          padding: 0;
          margin-left: 4px;
        }

        .remove-tag:hover {
          opacity: 0.8;
        }

        .permissions-preview {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .permission-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .resource-name {
          font-size: 14px;
          color: #374151;
        }

        .permission-level {
          font-size: 12px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .permission-level.none {
          background: #fee2e2;
          color: #991b1b;
        }

        .permission-level.read {
          background: #dbeafe;
          color: #1e40af;
        }

        .permission-level.write {
          background: #d1fae5;
          color: #065f46;
        }

        .permission-level.manage {
          background: #fef3c7;
          color: #92400e;
        }

        .permission-level.admin {
          background: #ede9fe;
          color: #6b21a8;
        }

        .permission-level.assigned_only {
          background: #e0e7ff;
          color: #3730a3;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .specialty-input {
            flex-direction: column;
          }
        }
      `}</style>
    </ModalBase>
  );
};

export default UserRegistrationModal;

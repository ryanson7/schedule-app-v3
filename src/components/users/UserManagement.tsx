"use client";
import { useState, useEffect } from 'react';
import { PrimaryButton, SecondaryButton, GhostButton } from '../ui/buttons';
import { Input, Select } from '../ui/form';
import UserRegistrationModal from './UserRegistrationModal';
import UserDetailModal from './UserDetailModal';
import { 
  UserRoleType, 
  ROLE_LABELS, 
  ROLE_COLORS 
} from '../../types/users';
import { hasPermission } from '../../utils/simplePermissions';

interface UserManagementProps {
  currentUserRole: UserRoleType;
  currentUserAcademies?: number[];
}

interface MockUser {
  id: number;
  name: string;
  email: string;
  role: UserRoleType;
  team_id?: number;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ 
  currentUserRole, 
  currentUserAcademies 
}) => {
  // 임시 목업 데이터
  const [users, setUsers] = useState<MockUser[]>([
    {
      id: 1,
      name: '김철수',
      email: 'kim@example.com',
      role: 'academy_manager',
      team_id: 1,
      is_active: true,
      created_at: '2024-01-01',
      last_login_at: '2024-01-15'
    },
    {
      id: 2,
      name: '이영희',
      email: 'lee@example.com',
      role: 'shooter',
      team_id: 2,
      is_active: true,
      created_at: '2024-01-02',
      last_login_at: '2024-01-14'
    },
    {
      id: 3,
      name: '박민수',
      email: 'park@example.com',
      role: 'professor',
      team_id: 1,
      is_active: true,
      created_at: '2024-01-03',
      last_login_at: '2024-01-13'
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRoleType | ''>('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  // 권한 확인
  const canCreateUser = hasPermission(currentUserRole, 'user_management', 'write');
  const canManageUser = hasPermission(currentUserRole, 'user_management', 'manage');

  // 사용자 선택 관리
  const handleUserSelect = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(filteredUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  // 사용자 클릭 핸들러
  const handleUserClick = (user: MockUser) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  // 사용자 삭제 핸들러
  const handleDeleteUser = async (userId: number) => {
    if (!confirm('정말로 이 사용자를 삭제하시겠습니까?')) return;
    
    try {
      setUsers(users.filter(user => user.id !== userId));
      alert('사용자가 삭제되었습니다.');
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 대량 작업 핸들러
  const handleBulkAction = async (action: string) => {
    if (selectedUsers.length === 0) {
      alert('선택된 사용자가 없습니다.');
      return;
    }

    if (!confirm(`선택된 ${selectedUsers.length}명의 사용자에게 ${action}을(를) 적용하시겠습니까?`)) {
      return;
    }

    try {
      // 임시 구현
      console.log(`대량 작업: ${action}`, selectedUsers);
      alert(`${action} 작업이 완료되었습니다.`);
      setSelectedUsers([]);
    } catch (error) {
      console.error('대량 작업 오류:', error);
      alert('작업에 실패했습니다.');
    }
  };

  // 검색 및 필터링
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !selectedRole || user.role === selectedRole;
    
    return matchesSearch && matchesRole;
  });

  // 역할별 스타일
  const getRoleStyle = (role: UserRoleType) => ({
    backgroundColor: ROLE_COLORS[role] || '#6b7280',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600'
  });

  // 역할 옵션 생성
  const getRoleOptions = () => {
    return Object.entries(ROLE_LABELS).map(([key, label]) => ({
      value: key,
      label: label
    }));
  };

  return (
    <div className="user-management">
      {/* 헤더 */}
      <div className="management-header">
        <div className="header-left">
          <h1>사용자 관리</h1>
          <p className="subtitle">총 {filteredUsers.length}명의 사용자</p>
        </div>
        <div className="header-right">
          {canCreateUser && (
            <PrimaryButton onClick={() => setShowRegistrationModal(true)}>
              새 사용자 등록
            </PrimaryButton>
          )}
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="search-group">
            <Input
              placeholder="이름, 이메일로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <SecondaryButton onClick={() => console.log('검색')}>
              검색
            </SecondaryButton>
          </div>

          <div className="filter-group">
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRoleType)}
              options={getRoleOptions()}
              placeholder="역할 선택"
            />
            <GhostButton onClick={() => { setSearchTerm(''); setSelectedRole(''); }}>
              초기화
            </GhostButton>
          </div>
        </div>

        {/* 대량 작업 */}
        {selectedUsers.length > 0 && canManageUser && (
          <div className="bulk-actions">
            <span className="selected-count">{selectedUsers.length}명 선택됨</span>
            <div className="bulk-buttons">
              <SecondaryButton onClick={() => handleBulkAction('활성화')}>
                활성화
              </SecondaryButton>
              <SecondaryButton onClick={() => handleBulkAction('비활성화')}>
                비활성화
              </SecondaryButton>
              <GhostButton 
                variant="danger" 
                onClick={() => handleBulkAction('삭제')}
              >
                삭제
              </GhostButton>
            </div>
          </div>
        )}
      </div>

      {/* 사용자 목록 테이블 */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              {canManageUser && (
                <th className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
              )}
              <th>이름</th>
              <th>이메일</th>
              <th>역할</th>
              <th>팀</th>
              <th>상태</th>
              <th>마지막 로그인</th>
              <th>가입일</th>
              <th className="actions-column">작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="user-row">
                {canManageUser && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => handleUserSelect(user.id, e.target.checked)}
                    />
                  </td>
                )}
                <td>
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  <span style={getRoleStyle(user.role)}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td>{user.team_id || '-'}</td>
                <td>
                  <span className={`status ${user.is_active ? 'active' : 'inactive'}`}>
                    {user.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td>
                  {user.last_login_at 
                    ? new Date(user.last_login_at).toLocaleDateString('ko-KR')
                    : '없음'
                  }
                </td>
                <td>
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td>
                  <div className="action-buttons">
                    <SecondaryButton
                      size="sm"
                      onClick={() => handleUserClick(user)}
                    >
                      상세
                    </SecondaryButton>
                    {canManageUser && (
                      <GhostButton
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        삭제
                      </GhostButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="empty-state">
            <p>조건에 맞는 사용자가 없습니다.</p>
          </div>
        )}
      </div>

      {/* 모달들 */}
      {showRegistrationModal && (
        <UserRegistrationModal
          open={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          onSuccess={() => {
            setShowRegistrationModal(false);
            // 실제 구현에서는 사용자 목록 새로고침
            console.log('사용자 등록 성공');
          }}
          currentUserRole={currentUserRole}
        />
      )}

      {showDetailModal && selectedUser && (
        <UserDetailModal
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          user={selectedUser}
          onUpdate={() => {
            setShowDetailModal(false);
            // 실제 구현에서는 사용자 목록 새로고침
            console.log('사용자 정보 업데이트');
          }}
          currentUserRole={currentUserRole}
        />
      )}

      {/* 스타일 */}
      <style jsx>{`
        .user-management {
          padding: 24px;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .management-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
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

        .filter-section {
          margin-bottom: 24px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .filter-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .search-group {
          display: flex;
          gap: 8px;
          flex: 1;
          max-width: 400px;
        }

        .filter-group {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .bulk-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
        }

        .selected-count {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }

        .bulk-buttons {
          display: flex;
          gap: 8px;
        }

        .users-table-container {
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table th,
        .users-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        .users-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }

        .checkbox-column {
          width: 40px;
        }

        .actions-column {
          width: 120px;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-name {
          font-weight: 500;
          color: #1f2937;
        }

        .status {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .status.active {
          background: #d1fae5;
          color: #065f46;
        }

        .status.inactive {
          background: #fee2e2;
          color: #991b1b;
        }

        .action-buttons {
          display: flex;
          gap: 4px;
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .filter-row {
            flex-direction: column;
            align-items: stretch;
          }

          .search-group {
            max-width: none;
          }

          .users-table {
            font-size: 14px;
          }

          .users-table th,
          .users-table td {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default UserManagement;

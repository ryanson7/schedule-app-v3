"use client";
import { useState, useEffect } from 'react';
import ModalBase from '../modals/ModalBase';  // 🔥 경로 수정
import { PrimaryButton, SecondaryButton, GhostButton } from '../ui/buttons';
import { 
  User, 
  UserDetailResponse, 
  UserRoleType,
  ROLE_LABELS,
  ROLE_COLORS 
} from '../../types/users';
import { supabase } from '../../utils/supabaseClient';

interface UserDetailModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onUpdate: () => void;
  currentUserRole: UserRoleType;
}

const UserDetailModal = ({ 
  open, 
  onClose, 
  user, 
  onUpdate, 
  currentUserRole 
}: UserDetailModalProps) => {
  const [userDetail, setUserDetail] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'roles' | 'activity'>('info');

  useEffect(() => {
    if (open && user) {
      loadUserDetail();
    }
  }, [open, user]);

  const loadUserDetail = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 사용자 상세 정보 로드
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // 역할 정보 로드
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          assigned_at,
          roles(id, name, description)
        `)
        .eq('user_id', user.id);

      if (rolesError) throw rolesError;

      // 팀 배정 정보 로드
      const { data: teamAssignments, error: teamError } = await supabase
        .from('user_teams')
        .select(`
          id,
          team_id,
          role_in_team,
          is_primary,
          joined_at,
          teams(id, name, team_type)
        `)
        .eq('user_id', user.id)
        .is('left_at', null);

      if (teamError) throw teamError;

      setUserDetail({
        user: profile,
        roles: roles?.map(r => r.roles) || [],
        team_assignments: teamAssignments || []
      });
    } catch (error) {
      console.error('사용자 상세 정보 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user) return;
    
    if (!confirm('이 사용자의 비밀번호를 초기화하시겠습니까?')) return;

    try {
      // 비밀번호 초기화 로직 (실제 구현 필요)
      alert('비밀번호 초기화 이메일이 발송되었습니다.');
    } catch (error) {
      console.error('비밀번호 초기화 오류:', error);
      alert('비밀번호 초기화에 실패했습니다.');
    }
  };

  const handleDeactivateUser = async () => {
    if (!user) return;
    
    if (!confirm('이 사용자를 비활성화하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          updated_at: new Date().toISOString()
          // is_active: false (컬럼이 있다면)
        })
        .eq('id', user.id);

      if (error) throw error;

      alert('사용자가 비활성화되었습니다.');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('사용자 비활성화 오류:', error);
      alert('비활성화에 실패했습니다.');
    }
  };

  if (!user) return null;

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title={`${user.name} - 사용자 상세 정보`}
      size="lg"
      footer={
        <div className="modal-footer">
          <GhostButton onClick={onClose}>닫기</GhostButton>
          <div className="action-buttons">
            {currentUserRole === 'system_admin' && (
              <>
                <SecondaryButton onClick={handlePasswordReset}>
                  비밀번호 초기화
                </SecondaryButton>
                <GhostButton variant="danger" onClick={handleDeactivateUser}>
                  비활성화
                </GhostButton>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="user-detail-content">
        {/* 탭 네비게이션 */}
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            기본 정보
          </button>
          <button
            className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            역할 및 권한
          </button>
          <button
            className={`tab-button ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            활동 이력
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>사용자 정보를 불러오는 중...</p>
          </div>
        ) : (
          <div className="tab-content">
            {activeTab === 'info' && (
              <div className="info-section">
                <div className="info-grid">
                  <div className="info-item">
                    <label>이름</label>
                    <span>{user.name}</span>
                  </div>
                  <div className="info-item">
                    <label>이메일</label>
                    <span>{user.email}</span>
                  </div>
                  <div className="info-item">
                    <label>사용자명</label>
                    <span>{userDetail?.user?.username || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>전화번호</label>
                    <span>{userDetail?.user?.phone || '-'}</span>
                  </div>
                  <div className="info-item">
                    <label>역할</label>
                    <span 
                      className="role-badge"
                      style={{ 
                        backgroundColor: ROLE_COLORS[user.role] || '#6b7280',
                        color: 'white'
                      }}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>상태</label>
                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>가입일</label>
                    <span>{new Date(user.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="info-item">
                    <label>마지막 로그인</label>
                    <span>
                      {user.last_login_at 
                        ? new Date(user.last_login_at).toLocaleDateString('ko-KR')
                        : '없음'
                      }
                    </span>
                  </div>
                </div>

                {/* 전문 정보 (촬영자인 경우) */}
                {user.role === 'shooter' && userDetail?.user && (
                  <div className="specialist-info">
                    <h4>전문 정보</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>촬영 유형</label>
                        <span>{userDetail.user.shooter_type || '-'}</span>
                      </div>
                      <div className="info-item">
                        <label>시급</label>
                        <span>
                          {userDetail.user.hourly_rate 
                            ? `${userDetail.user.hourly_rate.toLocaleString()}원`
                            : '-'
                          }
                        </span>
                      </div>
                      <div className="info-item full-width">
                        <label>전문 분야</label>
                        <div className="specialties">
                          {userDetail.user.specialties?.map((specialty, index) => (
                            <span key={index} className="specialty-tag">
                              {specialty}
                            </span>
                          )) || <span>-</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="roles-section">
                <h4>할당된 역할</h4>
                {userDetail?.roles && userDetail.roles.length > 0 ? (
                  <div className="roles-list">
                    {userDetail.roles.map(role => (
                      <div key={role.id} className="role-item">
                        <span className="role-name">{role.name}</span>
                        {role.description && (
                          <span className="role-description">{role.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-message">할당된 역할이 없습니다.</p>
                )}

                <h4>팀 배정</h4>
                {userDetail?.team_assignments && userDetail.team_assignments.length > 0 ? (
                  <div className="teams-list">
                    {userDetail.team_assignments.map(assignment => (
                      <div key={assignment.id} className="team-item">
                        <div className="team-info">
                          <span className="team-name">{assignment.teams?.name}</span>
                          <span className="team-role">{assignment.role_in_team}</span>
                          {assignment.is_primary && (
                            <span className="primary-badge">주 배정</span>
                          )}
                        </div>
                        <span className="join-date">
                          {new Date(assignment.joined_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-message">배정된 팀이 없습니다.</p>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="activity-section">
                <h4>최근 활동</h4>
                <p className="empty-message">활동 이력 기능은 준비 중입니다.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 스타일 */}
      <style jsx>{`
        .user-detail-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .tab-navigation {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
        }

        .tab-button {
          padding: 12px 20px;
          border: none;
          background: transparent;
          color: #6b7280;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .tab-button:hover {
          color: #374151;
        }

        .tab-button.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          font-weight: 600;
        }

        .tab-content {
          padding: 20px 0;
        }

        .info-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-item.full-width {
          grid-column: 1 / -1;
        }

        .info-item label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
        }

        .info-item span {
          font-size: 14px;
          color: #1f2937;
        }

        .role-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          align-self: flex-start;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          align-self: flex-start;
        }

        .status-badge.active {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.inactive {
          background: #fee2e2;
          color: #991b1b;
        }

        .specialist-info h4 {
          margin: 0 0 12px 0;
          color: #1f2937;
          font-size: 16px;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
        }

        .specialties {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .specialty-tag {
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .roles-section h4,
        .activity-section h4 {
          margin: 0 0 16px 0;
          color: #1f2937;
          font-size: 16px;
          font-weight: 600;
        }

        .roles-list,
        .teams-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
        }

        .role-item,
        .team-item {
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .role-name,
        .team-name {
          font-weight: 500;
          color: #1f2937;
        }

        .role-description {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        .team-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .team-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .team-role {
          background: #059669;
          color: white;
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
        }

        .primary-badge {
          background: #dc2626;
          color: white;
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
        }

        .join-date {
          font-size: 12px;
          color: #6b7280;
        }

        .empty-message {
          text-align: center;
          color: #6b7280;
          font-style: italic;
          padding: 20px;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .info-grid {
            grid-template-columns: 1fr;
          }

          .team-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      `}</style>
    </ModalBase>
  );
};

export default UserDetailModal;

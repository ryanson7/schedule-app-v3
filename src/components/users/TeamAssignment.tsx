"use client";
import { useState, useEffect } from 'react';
import { PrimaryButton, SecondaryButton, GhostButton } from '../ui/buttons';
import { Input, Select } from '../ui/form';
import ModalBase from '../modals/ModalBase';
import { 
  UserRoleType,
  ROLE_LABELS,
  ROLE_COLORS 
} from '../../types/users';
import { hasPermission } from '../../utils/simplePermissions';

interface TeamAssignmentProps {
  currentUserRole: UserRoleType;
  currentUserAcademies?: number[];
}

interface MockTeam {
  id: number;
  name: string;
  description?: string;
  team_type: 'department' | 'academy' | 'studio';
  member_count: number;
  leader_count: number;
}

interface MockAssignment {
  id: number;
  user_id: number;
  team_id: number;
  role_in_team: 'leader' | 'member' | 'observer';
  is_primary: boolean;
  joined_at: string;
  user_name: string;
  user_email: string;
  user_role: UserRoleType;
  team_name: string;
  team_type: string;
}

const TeamAssignment: React.FC<TeamAssignmentProps> = ({ 
  currentUserRole, 
  currentUserAcademies 
}) => {
  // 임시 목업 데이터
  const [teams, setTeams] = useState<MockTeam[]>([
    {
      id: 1,
      name: '촬영팀',
      description: '영상 촬영 전담팀',
      team_type: 'department',
      member_count: 5,
      leader_count: 1
    },
    {
      id: 2,
      name: '강남 학원팀',
      description: '강남 지역 학원 관리',
      team_type: 'academy',
      member_count: 3,
      leader_count: 1
    }
  ]);

  const [assignments, setAssignments] = useState<MockAssignment[]>([
    {
      id: 1,
      user_id: 1,
      team_id: 1,
      role_in_team: 'leader',
      is_primary: true,
      joined_at: '2024-01-01',
      user_name: '김철수',
      user_email: 'kim@example.com',
      user_role: 'academy_manager',
      team_name: '촬영팀',
      team_type: 'department'
    },
    {
      id: 2,
      user_id: 2,
      team_id: 2,
      role_in_team: 'member',
      is_primary: true,
      joined_at: '2024-01-02',
      user_name: '이영희',
      user_email: 'lee@example.com',
      user_role: 'shooter',
      team_name: '강남 학원팀',
      team_type: 'academy'
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<number | ''>('');

  // 폼 상태
  const [assignmentForm, setAssignmentForm] = useState({
    user_id: 0,
    team_id: 0,
    role_in_team: 'member' as 'leader' | 'member' | 'observer',
    is_primary: false
  });

  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
    team_type: 'department' as 'department' | 'academy' | 'studio'
  });

  // 권한 확인
  const canManageTeams = hasPermission(currentUserRole, 'user_management', 'manage');
  const canAssignUsers = hasPermission(currentUserRole, 'user_management', 'write');

  // 팀 생성
  const handleCreateTeam = async () => {
    if (!canManageTeams) return;

    try {
      const newTeam: MockTeam = {
        id: Date.now(),
        name: teamForm.name,
        description: teamForm.description,
        team_type: teamForm.team_type,
        member_count: 0,
        leader_count: 0
      };

      setTeams([...teams, newTeam]);
      alert('팀이 생성되었습니다.');
      setShowCreateTeamModal(false);
      setTeamForm({
        name: '',
        description: '',
        team_type: 'department'
      });
    } catch (error) {
      console.error('팀 생성 오류:', error);
      alert('팀 생성에 실패했습니다.');
    }
  };

  // 사용자 배정
  const handleAssignUser = async () => {
    if (!canAssignUsers) return;

    try {
      const newAssignment: MockAssignment = {
        id: Date.now(),
        user_id: assignmentForm.user_id,
        team_id: assignmentForm.team_id,
        role_in_team: assignmentForm.role_in_team,
        is_primary: assignmentForm.is_primary,
        joined_at: new Date().toISOString(),
        user_name: '새 사용자',
        user_email: 'new@example.com',
        user_role: 'staff',
        team_name: teams.find(t => t.id === assignmentForm.team_id)?.name || '',
        team_type: teams.find(t => t.id === assignmentForm.team_id)?.team_type || 'department'
      };

      setAssignments([...assignments, newAssignment]);
      alert('사용자가 팀에 배정되었습니다.');
      setShowAssignModal(false);
      resetAssignmentForm();
    } catch (error) {
      console.error('사용자 배정 오류:', error);
      alert('사용자 배정에 실패했습니다.');
    }
  };

  // 배정 해제
  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!canAssignUsers) return;
    if (!confirm('이 팀 배정을 해제하시겠습니까?')) return;

    try {
      setAssignments(assignments.filter(a => a.id !== assignmentId));
      alert('팀 배정이 해제되었습니다.');
    } catch (error) {
      console.error('배정 해제 오류:', error);
      alert('배정 해제에 실패했습니다.');
    }
  };

  // 폼 초기화
  const resetAssignmentForm = () => {
    setAssignmentForm({
      user_id: 0,
      team_id: 0,
      role_in_team: 'member',
      is_primary: false
    });
  };

  // 필터된 데이터
  const filteredAssignments = assignments.filter(assignment => {
    if (selectedTeam && assignment.team_id !== selectedTeam) return false;
    if (searchTerm && !assignment.user_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // 팀 타입별 스타일
  const getTeamTypeStyle = (teamType: string) => {
    const styles = {
      department: { bg: '#3b82f6', color: 'white' },
      academy: { bg: '#059669', color: 'white' },
      studio: { bg: '#7c3aed', color: 'white' }
    };
    return styles[teamType as keyof typeof styles] || { bg: '#6b7280', color: 'white' };
  };

  // 역할별 스타일
  const getRoleStyle = (role: string) => {
    const styles = {
      leader: { bg: '#dc2626', color: 'white' },
      member: { bg: '#059669', color: 'white' },
      observer: { bg: '#6b7280', color: 'white' }
    };
    return styles[role as keyof typeof styles] || { bg: '#6b7280', color: 'white' };
  };

  // 팀 옵션 생성
  const getTeamOptions = () => {
    return teams.map(team => ({
      value: team.id,
      label: `${team.name} (${team.team_type === 'department' ? '부서' : 
                              team.team_type === 'academy' ? '학원' : 
                              team.team_type === 'studio' ? '스튜디오' : team.team_type})`
    }));
  };

  if (!canAssignUsers) {
    return (
      <div className="access-denied">
        <h2>접근 권한이 없습니다</h2>
        <p>팀 배정 관리는 관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="team-assignment">
      {/* 헤더 */}
      <div className="management-header">
        <div className="header-left">
          <h1>팀 배정 관리</h1>
          <p className="subtitle">사용자의 팀 배정 및 역할 관리</p>
        </div>
        <div className="header-right">
          {canManageTeams && (
            <SecondaryButton onClick={() => setShowCreateTeamModal(true)}>
              새 팀 생성
            </SecondaryButton>
          )}
          <PrimaryButton onClick={() => setShowAssignModal(true)}>
            사용자 배정
          </PrimaryButton>
        </div>
      </div>

      {/* 필터 섹션 */}
      <div className="filter-section">
        <div className="filter-row">
          <Input
            placeholder="사용자 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : '')}
            options={getTeamOptions()}
            placeholder="팀 선택"
          />
          <SecondaryButton onClick={() => console.log('새로고침')}>
            새로고침
          </SecondaryButton>
        </div>
      </div>

      {/* 팀 목록 */}
      <div className="teams-overview">
        <h3>팀 현황</h3>
        <div className="teams-grid">
          {teams.map(team => {
            const teamStyle = getTeamTypeStyle(team.team_type);
            
            return (
              <div key={team.id} className="team-card">
                <div className="team-header">
                  <span className="team-name">{team.name}</span>
                  <span 
                    className="team-type"
                    style={{ backgroundColor: teamStyle.bg, color: teamStyle.color }}
                  >
                    {team.team_type === 'department' ? '부서' :
                     team.team_type === 'academy' ? '학원' :
                     team.team_type === 'studio' ? '스튜디오' : team.team_type}
                  </span>
                </div>
                {team.description && (
                  <p className="team-description">{team.description}</p>
                )}
                <div className="team-stats">
                  <span>총 {team.member_count}명</span>
                  <span>리더 {team.leader_count}명</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 배정 목록 */}
      <div className="assignments-section">
        <h3>팀 배정 현황</h3>
        <div className="assignments-table-container">
          <table className="assignments-table">
            <thead>
              <tr>
                <th>사용자</th>
                <th>팀</th>
                <th>팀 내 역할</th>
                <th>주 배정</th>
                <th>배정일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map(assignment => (
                <tr key={assignment.id}>
                  <td>
                    <div className="user-info">
                      <div className="user-name">{assignment.user_name}</div>
                      <div className="user-email">{assignment.user_email}</div>
                      <span 
                        className="user-role"
                        style={{ 
                          backgroundColor: ROLE_COLORS[assignment.user_role] || '#6b7280',
                          color: 'white'
                        }}
                      >
                        {ROLE_LABELS[assignment.user_role] || assignment.user_role}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="team-info">
                      <span className="team-name">{assignment.team_name}</span>
                      <span 
                        className="team-type-small"
                        style={getTeamTypeStyle(assignment.team_type)}
                      >
                        {assignment.team_type === 'department' ? '부서' :
                         assignment.team_type === 'academy' ? '학원' :
                         assignment.team_type === 'studio' ? '스튜디오' : ''}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span 
                      className="role-badge"
                      style={getRoleStyle(assignment.role_in_team)}
                    >
                      {assignment.role_in_team === 'leader' ? '리더' :
                       assignment.role_in_team === 'member' ? '멤버' :
                       assignment.role_in_team === 'observer' ? '옵저버' : assignment.role_in_team}
                    </span>
                  </td>
                  <td>
                    {assignment.is_primary ? (
                      <span className="primary-badge">주 배정</span>
                    ) : (
                      <span className="secondary-badge">부 배정</span>
                    )}
                  </td>
                  <td>
                    {new Date(assignment.joined_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td>
                    <GhostButton
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemoveAssignment(assignment.id)}
                    >
                      해제
                    </GhostButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAssignments.length === 0 && (
            <div className="empty-state">
              <p>배정된 사용자가 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 사용자 배정 모달 */}
      <ModalBase
        open={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          resetAssignmentForm();
        }}
        title="팀 배정"
        size="md"
        footer={
          <div className="modal-footer">
            <SecondaryButton onClick={() => setShowAssignModal(false)}>
              취소
            </SecondaryButton>
            <PrimaryButton 
              onClick={handleAssignUser}
              disabled={!assignmentForm.user_id || !assignmentForm.team_id}
            >
              배정
            </PrimaryButton>
          </div>
        }
      >
        <div className="assignment-form">
          <div className="form-group">
            <label>사용자 선택 *</label>
            <Select
              value={assignmentForm.user_id}
              onChange={(e) => setAssignmentForm({
                ...assignmentForm,
                user_id: Number(e.target.value)
              })}
              options={[
                { value: 1, label: '김철수 (kim@example.com)' },
                { value: 2, label: '이영희 (lee@example.com)' },
                { value: 3, label: '박민수 (park@example.com)' }
              ]}
              placeholder="사용자를 선택하세요"
            />
          </div>

          <div className="form-group">
            <label>팀 선택 *</label>
            <Select
              value={assignmentForm.team_id}
              onChange={(e) => setAssignmentForm({
                ...assignmentForm,
                team_id: Number(e.target.value)
              })}
              options={getTeamOptions()}
              placeholder="팀을 선택하세요"
            />
          </div>

          <div className="form-group">
            <label>팀 내 역할</label>
            <Select
              value={assignmentForm.role_in_team}
              onChange={(e) => setAssignmentForm({
                ...assignmentForm,
                role_in_team: e.target.value as 'leader' | 'member' | 'observer'
              })}
              options={[
                { value: 'member', label: '멤버' },
                { value: 'leader', label: '리더' },
                { value: 'observer', label: '옵저버' }
              ]}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={assignmentForm.is_primary}
                onChange={(e) => setAssignmentForm({
                  ...assignmentForm,
                  is_primary: e.target.checked
                })}
              />
              주 배정으로 설정 (사용자의 기본 팀이 됩니다)
            </label>
          </div>
        </div>
      </ModalBase>

      {/* 팀 생성 모달 */}
      <ModalBase
        open={showCreateTeamModal}
        onClose={() => {
          setShowCreateTeamModal(false);
          setTeamForm({
            name: '',
            description: '',
            team_type: 'department'
          });
        }}
        title="새 팀 생성"
        size="md"
        footer={
          <div className="modal-footer">
            <SecondaryButton onClick={() => setShowCreateTeamModal(false)}>
              취소
            </SecondaryButton>
            <PrimaryButton 
              onClick={handleCreateTeam}
              disabled={!teamForm.name.trim()}
            >
              생성
            </PrimaryButton>
          </div>
        }
      >
        <div className="team-form">
          <div className="form-group">
            <label>팀 이름 *</label>
            <Input
              value={teamForm.name}
              onChange={(e) => setTeamForm({
                ...teamForm,
                name: e.target.value
              })}
              placeholder="팀 이름을 입력하세요"
            />
          </div>

          <div className="form-group">
            <label>팀 유형</label>
            <Select
              value={teamForm.team_type}
              onChange={(e) => setTeamForm({
                ...teamForm,
                team_type: e.target.value as 'department' | 'academy' | 'studio'
              })}
              options={[
                { value: 'department', label: '부서' },
                { value: 'academy', label: '학원' },
                { value: 'studio', label: '스튜디오' }
              ]}
            />
          </div>

          <div className="form-group">
            <label>설명</label>
            <Input
              value={teamForm.description}
              onChange={(e) => setTeamForm({
                ...teamForm,
                description: e.target.value
              })}
              placeholder="팀에 대한 설명을 입력하세요"
            />
          </div>
        </div>
      </ModalBase>

      {/* 스타일 */}
      <style jsx>{`
        .team-assignment {
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

        .header-right {
          display: flex;
          gap: 8px;
        }

        .filter-section {
          margin-bottom: 24px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .filter-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .teams-overview {
          margin-bottom: 32px;
        }

        .teams-overview h3 {
          margin: 0 0 16px 0;
          color: #1f2937;
          font-size: 18px;
          font-weight: 600;
        }

        .teams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .team-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          background: #ffffff;
        }

        .team-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .team-name {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .team-type {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .team-description {
          margin: 0 0 12px 0;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.4;
        }

        .team-stats {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #6b7280;
        }

        .assignments-section h3 {
          margin: 0 0 16px 0;
          color: #1f2937;
          font-size: 18px;
          font-weight: 600;
        }

        .assignments-table-container {
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .assignments-table {
          width: 100%;
          border-collapse: collapse;
        }

        .assignments-table th,
        .assignments-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        .assignments-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
          font-size: 14px;
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

        .user-email {
          font-size: 12px;
          color: #6b7280;
        }

        .user-role {
          padding: 1px 6px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          align-self: flex-start;
          margin-top: 2px;
        }

        .team-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .team-type-small {
          padding: 1px 6px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          align-self: flex-start;
        }

        .role-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .primary-badge {
          background: #059669;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .secondary-badge {
          background: #6b7280;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .empty-state {
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

        .assignment-form,
        .team-form {
          display: flex;
          flex-direction: column;
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

        .checkbox-label {
          flex-direction: row !important;
          align-items: center;
          gap: 8px !important;
          font-size: 14px;
          color: #374151;
          cursor: pointer;
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

          .filter-row {
            flex-direction: column;
            align-items: stretch;
          }

          .teams-grid {
            grid-template-columns: 1fr;
          }

          .assignments-table {
            font-size: 14px;
          }

          .assignments-table th,
          .assignments-table td {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default TeamAssignment;

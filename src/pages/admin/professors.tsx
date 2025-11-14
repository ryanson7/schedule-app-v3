// src\pages\admin\professors.tsx
import ProfessorList from '../../components/ProfessorList';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function ProfessorsPage(): JSX.Element {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc'
    }}>
      {/* 🎯 실제 관리자 역할명으로 수정 */}
      <ProtectedRoute allowedRoles={['system_admin', 'schedule_admin', 'manager']}>
        <div style={{
          padding: '20px',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <ProfessorList />
        </div>
      </ProtectedRoute>
    </div>
  );
}

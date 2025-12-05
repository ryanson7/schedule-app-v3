// pages/login.tsx - 촬영자/교수/매니저 로그인 문제 해결 버전
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { phoneToEmail, detectLoginType } from '../utils/phoneToEmail';
import { DbUserRole, ManagerType } from '../types/users';
import { getRedirectPath } from '../utils/roleRedirection';

// 시스템 상태 체크 (점검 모드 등)
const useSystemStatus = () => {
  const [systemStatus, setSystemStatus] = useState<{
    loginEnabled: boolean;
    maintenanceMode: boolean;
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      // 🔧 system_settings 테이블이 없으므로 기본값 사용
      console.log('⚠️ system_settings 체크 생략, 기본값 사용');
      setSystemStatus({
        loginEnabled: true,
        maintenanceMode: false,
      });
    } catch (error) {
      setSystemStatus({
        loginEnabled: true,
        maintenanceMode: false,
      });
    }
    setLoading(false);
  };

  return { systemStatus, loading };
};

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { systemStatus, loading: systemLoading } = useSystemStatus();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);

  // 이미 로그인된 사용자 리다이렉트 (실제 리다이렉트는 AuthContext에서 처리하므로 여기서는 아무 것도 안 함)
  useEffect(() => {
    if (!authLoading && !systemLoading && user) {
      // noop
    }
  }, [user, authLoading, systemLoading]);

  // 로그인 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAttempts >= 3) return;

    setLoading(true);
    setError('');

    try {
      console.log('🔑 로그인 시도 시작:', { identifier });

      const isPhone = detectLoginType(identifier) === 'phone';
      let email = identifier.trim();
      let userData: any = null;

      if (isPhone) {
        // 🔧 전화번호일 경우 두 도메인 모두 시도
        const shooterEmail = phoneToEmail(identifier, 'shooter');
        const professorEmail = phoneToEmail(identifier, 'professor');

        console.log('📧 이메일 후보들:', { shooterEmail, professorEmail });

        // 1. 촬영자 이메일로 시도
        try {
          const { data: shooterUser, error: shooterError } = await supabase
            .from('users')
            .select('*')
            .eq('email', shooterEmail)
            .eq('status', 'active')
            .single();

          if (!shooterError && shooterUser) {
            console.log('✅ 촬영자 계정 발견:', shooterUser);
            email = shooterEmail;
            userData = shooterUser;
          }
        } catch (error) {
          console.log('❌ 촬영자 계정 없음');
        }

        // 2. 촬영자 계정이 없으면 교수 이메일로 시도
        if (!userData) {
          try {
            const { data: professorUser, error: professorError } = await supabase
              .from('users')
              .select('*')
              .eq('email', professorEmail)
              .eq('status', 'active')
              .single();

            if (!professorError && professorUser) {
              console.log('✅ 교수 계정 발견:', professorUser);
              email = professorEmail;
              userData = professorUser;
            }
          } catch (error) {
            console.log('❌ 교수 계정 없음');
          }
        }

        if (!userData) {
          console.error('❌ 해당 전화번호로 등록된 계정 없음');
          setError('등록되지 않은 전화번호입니다. 관리자에게 문의하세요.');
          setLoginAttempts(prev => prev + 1);
          return;
        }
      } else {
        // 🔧 이메일 직접 입력일 경우
        const { data: existingUser, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .eq('status', 'active')
          .single();

        if (userError || !existingUser) {
          console.error('❌ 사용자 조회 실패:', userError);
          setError('등록되지 않은 사용자이거나 비활성화된 계정입니다.');
          setLoginAttempts(prev => prev + 1);
          return;
        }

        userData = existingUser;
      }

      console.log('✅ 사용자 정보 확인:', userData);

      // 🔧 Supabase Auth 로그인
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('❌ Supabase 인증 실패:', authError);
        setLoginAttempts(prev => prev + 1);

        if (authError.message.includes('Invalid login credentials')) {
          if (userData.role === 'shooter') {
            setError('비밀번호가 올바르지 않습니다. 초기 비밀번호는 "eduwill1234!"입니다.');
          } else if (userData.role === 'professor') {
            setError('비밀번호가 올바르지 않습니다. 관리자에게 문의하세요.');
          } else {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
          }
        } else if (authError.message.includes('Email not confirmed')) {
          setError('이메일 인증이 필요합니다. 관리자에게 문의하세요.');
        } else {
          setError(`로그인 실패: ${authError.message}`);
        }
        return;
      }

      if (!authData.user) {
        console.error('❌ Auth 사용자 데이터 없음');
        setError('인증 정보를 가져올 수 없습니다.');
        return;
      }

      console.log('✅ Supabase 인증 성공:', authData.user.email);

      // 🔧 사용자 정보를 localStorage에 직접 저장
      localStorage.setItem('userEmail', authData.user.email!);
      localStorage.setItem('userName', userData.name || userData.email.split('@')[0]);
      //localStorage.setItem('userRole', userData.role);
      localStorage.setItem('isAuthenticated', 'true');

      // 🔧 추가 정보도 저장
      if (userData.phone) {
        localStorage.setItem('userPhone', userData.phone);
      }

      console.log('✅ 사용자 정보 저장 완료:', {
        email: authData.user.email,
        name: userData.name,
        role: userData.role,
      });

      // 🔧 역할/매니저타입 기반 리다이렉트 (AuthContext / roleRedirection과 동일 규칙)
      const dbRole = userData.role as DbUserRole;
      const managerType = (localStorage.getItem('managerType') || undefined) as ManagerType | undefined;

      const redirectPath = getRedirectPath(dbRole, managerType);
      console.log('🔄 리다이렉트:', redirectPath, { dbRole, managerType });

      // 🔧 강제 리다이렉트
      window.location.href = redirectPath;
    } catch (error: any) {
      console.error('❌ 로그인 처리 중 오류:', error);
      setLoginAttempts(prev => prev + 1);
      setError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 시스템 상태 확인 중
  if (systemLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '16px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ color: 'white', fontSize: '16px', fontWeight: '500' }}>시스템 상태 확인 중...</p>
      </div>
    );
  }

  // 시스템 점검 중
  if (systemStatus && (!systemStatus.loginEnabled || systemStatus.maintenanceMode)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '20px',
          background: '#f8fafc',
        }}
      >
        <div style={{ fontSize: '24px', color: '#ef4444', fontWeight: '600' }}>
          {systemStatus.maintenanceMode ? '시스템 점검 중' : '로그인 일시 중단'}
        </div>
        <div style={{ fontSize: '16px', color: '#64748b', textAlign: 'center' }}>
          {systemStatus.message ||
            (systemStatus.maintenanceMode
              ? '현재 시스템 점검 중입니다. 잠시 후 다시 이용해주세요.'
              : '로그인 서비스가 일시 중단되었습니다.')}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          새로고침
        </button>
      </div>
    );
  }

  // 인증 확인 중
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '16px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ color: 'white', fontSize: '16px', fontWeight: '500' }}>인증 상태 확인 중...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
          width: '100%',
          maxWidth: '440px',
        }}
      >
        {/* 로고 섹션 */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              width: '140px',
              height: '50px',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="https://img.eduwill.net/Img2/Common/BI/type2/live/logo.svg"
              alt="에듀윌 로고"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={e => {
                e.currentTarget.style.display = 'none';
                const textLogo = document.createElement('div');
                textLogo.textContent = 'EDUWILL';
                textLogo.style.fontSize = '32px';
                textLogo.style.fontWeight = 'bold';
                textLogo.style.color = '#3b82f6';
                e.currentTarget.parentNode?.appendChild(textLogo);
              }}
            />
          </div>

          <h1
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 8px 0',
            }}
          >
            촬영스케줄 통합 관리 시스템
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>이메일 또는 전화번호로 로그인하세요</p>
        </div>

        {/* 오류 메시지 */}
        {error && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#dc2626',
              fontSize: '14px',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          {/* 이메일/전화번호 */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                color: '#374151',
                fontSize: '14px',
              }}
            >
              이메일 또는 전화번호
            </label>
            <input
              type="text"
              value={identifier}
              onChange={e => {
                setIdentifier(e.target.value);
                if (error) setError('');
              }}
              placeholder="이메일 또는 전화번호를 입력하세요"
              required
              disabled={loginAttempts >= 3}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: `2px solid ${error ? '#ef4444' : '#e5e7eb'}`,
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 비밀번호 */}
          <div style={{ marginBottom: '32px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                color: '#374151',
                fontSize: '14px',
              }}
            >
              비밀번호
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="비밀번호를 입력하세요"
                required
                disabled={loginAttempts >= 3}
                style={{
                  width: '100%',
                  padding: '14px 50px 14px 16px',
                  border: `2px solid ${error ? '#ef4444' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loginAttempts >= 3}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={loading || !identifier || !password || loginAttempts >= 3}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor:
                loading || !identifier || !password || loginAttempts >= 3 ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor:
                loading || !identifier || !password || loginAttempts >= 3 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '로그인 중...' : loginAttempts >= 3 ? '잠시 후 다시 시도하세요' : '로그인'}
          </button>
        </form>

        {/* 로그인 시도 초과 안내 */}
        {loginAttempts >= 3 && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              textAlign: 'center',
              color: '#92400e',
              fontSize: '14px',
            }}
          >
            로그인 시도 횟수를 초과했습니다.
            <br />
            1분 후 다시 시도할 수 있습니다.
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

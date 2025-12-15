// pages/auth/first-login.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { getRedirectPath } from '../../utils/roleRedirection';

export default function FirstLoginPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState({ name: '', email: '', role: '' });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1); // 1: 안내, 2: 비밀번호 변경

  useEffect(() => {
    const userName = localStorage.getItem('userName');
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');

    if (!userEmail) {
      router.replace('/login');
      return;
    }

    setUserInfo({
      name: userName || '',
      email: userEmail,
      role: userRole || ''
    });

    // 임시 비밀번호 사용자인지 확인
    checkIsTempUser(userEmail);
  }, [router]);

  const checkIsTempUser = async (email: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('is_temp_password, temp_password')
        .eq('email', email)
        .single();

      if (!data?.is_temp_password) {
        // 임시 비밀번호 사용자가 아니면 메인으로
        router.replace('/admin');
      }
    } catch (error) {
      console.error('사용자 정보 확인 실패:', error);
      router.replace('/login');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwords.current.trim()) {
      alert('현재 비밀번호를 입력해주세요.');
      return;
    }

    if (passwords.new !== passwords.confirm) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwords.new.length < 8) {
      alert('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (passwords.current === passwords.new) {
      alert('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    setSaving(true);

    try {
    // 1. 현재 비밀번호로 재인증
    try {
      const result = await supabase.auth.signInWithPassword({
        email: userInfo.email,
        password: passwords.current,
      });

      if (result.error) {
        throw new Error('현재 비밀번호가 올바르지 않습니다.');
      }
    } catch (err: any) {
      console.error('❌ 재인증 실패/예외:', err);
      alert(err?.message || '현재 비밀번호가 올바르지 않습니다.');
      setSaving(false);
      return; // 여기서 handlePasswordChange 종료
    }


      // 2. 새 비밀번호로 변경
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (updateError) {
        if (updateError.message.includes('New password should be different')) {
          throw new Error('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
        }
        throw updateError;
      }

      // 3. users 테이블에서 임시 비밀번호 플래그 제거
      const { error: dbError } = await supabase
        .from('users')
        .update({
          is_temp_password: false,
          temp_password: null,
          updated_at: new Date().toISOString()
        })
        .eq('email', userInfo.email);

      if (dbError) {
        console.error('DB 업데이트 실패:', dbError);
      }

      // 4. 연기 상태도 제거
      localStorage.removeItem('tempPasswordDeferred');
      localStorage.removeItem('passwordDeferredDate');

      alert('비밀번호가 성공적으로 변경되었습니다!\n새로운 비밀번호로 다시 로그인해주세요.');

      // 5. 로그아웃 후 로그인 페이지로
      await supabase.auth.signOut();
      localStorage.clear();
      router.replace('/login');

    } catch (error: any) {
      console.error('비밀번호 변경 실패:', error);
      alert(error.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 🎯 나중에 하기 처리
  const handleSkipForNow = async () => {
    try {
      const confirmed = confirm(
        '나중에 비밀번호를 변경하시겠습니까?\n\n' +
        '• 보안을 위해 가능한 한 빨리 변경하는 것을 강력히 권장합니다.\n' +
        '• 중요한 기능 일부가 제한될 수 있습니다.\n' +
        '• 정기적으로 변경을 안내해드립니다.\n\n' +
        '계속하시겠습니까?'
      );
      
      if (confirmed) {
        // 연기 상태 설정
        localStorage.setItem('tempPasswordDeferred', 'true');
        localStorage.setItem('passwordDeferredDate', Date.now().toString());
        
        // 메인으로 이동 (제한적 접근 허용)
        const userRole = localStorage.getItem('userRole');
        const redirectPath = getRedirectPath(userRole || 'staff');
        router.push(redirectPath);
      }
    } catch (error) {
      console.error('연기 처리 실패:', error);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'system_admin': return '시스템 관리자';
      case 'schedule_admin': return '스케줄 관리자';
      case 'professor': return '교수';
      default: return '사용자';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '40px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '500px'
      }}>
        {step === 1 && (
          <>
            {/* 첫 로그인 안내 */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                backgroundColor: '#fef3c7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '32px'
              }}>
                🔐
              </div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1f2937',
                margin: '0 0 12px 0'
              }}>
                안전한 비밀번호 설정
              </h1>
              <p style={{
                color: '#6b7280',
                margin: 0,
                fontSize: '16px',
                lineHeight: '1.5'
              }}>
                보안을 위해 임시 비밀번호를<br />
                새로운 비밀번호로 변경해주세요
              </p>
            </div>

            {/* 사용자 정보 */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                margin: '0 0 12px 0'
              }}>
                계정 정보
              </h3>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>이름: </span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                  {userInfo.name}
                </span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>이메일: </span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                  {userInfo.email}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>역할: </span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                  {getRoleDisplayName(userInfo.role)}
                </span>
              </div>
            </div>

            {/* 보안 안내 */}
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <h4 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#92400e',
                margin: '0 0 8px 0'
              }}>
                ⚠️ 보안 권장사항
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                color: '#92400e',
                fontSize: '13px'
              }}>
                <li>8자 이상의 복잡한 비밀번호를 사용하세요</li>
                <li>영문, 숫자, 특수문자를 조합하세요</li>
                <li>다른 사이트와 동일한 비밀번호를 피하세요</li>
              </ul>
            </div>

            {/* 🎯 선택 옵션 */}
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  backgroundColor: '#1d4ed8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginBottom: '12px'
                }}
              >
                지금 비밀번호 변경하기 (권장)
              </button>
              
              <button
                onClick={handleSkipForNow}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                나중에 변경하기
              </button>
            </div>
            
            <div style={{
              fontSize: '12px',
              color: '#ef4444',
              backgroundColor: '#fef2f2',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #fecaca',
              textAlign: 'center'
            }}>
              ⚠️ 보안을 위해 가능한 한 빨리 변경하시기 바랍니다.
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* 비밀번호 변경 폼 */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginBottom: '16px'
                }}
              >
                ← 뒤로 가기
              </button>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1f2937',
                margin: '0 0 8px 0'
              }}>
                새 비밀번호 설정
              </h1>
              <p style={{
                color: '#6b7280',
                margin: 0,
                fontSize: '14px'
              }}>
                현재 임시 비밀번호와 새로운 비밀번호를 입력하세요
              </p>
            </div>

            <form onSubmit={handlePasswordChange}>
              {/* 현재 비밀번호 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  현재 임시 비밀번호 *
                </label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                  placeholder="현재 사용 중인 임시 비밀번호"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 새 비밀번호 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  새 비밀번호 *
                </label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                  placeholder="새로운 비밀번호 (8자 이상)"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: `2px solid ${
                      passwords.new && passwords.current === passwords.new 
                        ? '#ef4444' 
                        : '#e5e7eb'
                    }`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                {passwords.new && passwords.current === passwords.new && (
                  <p style={{
                    color: '#ef4444',
                    fontSize: '12px',
                    marginTop: '4px',
                    marginBottom: 0
                  }}>
                    ⚠️ 새 비밀번호는 현재 비밀번호와 달라야 합니다
                  </p>
                )}
                {passwords.new && passwords.new.length < 8 && (
                  <p style={{
                    color: '#f59e0b',
                    fontSize: '12px',
                    marginTop: '4px',
                    marginBottom: 0
                  }}>
                    ⚠️ 비밀번호는 8자 이상이어야 합니다
                  </p>
                )}
              </div>

              {/* 비밀번호 확인 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  비밀번호 확인 *
                </label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                  placeholder="새 비밀번호 다시 입력"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: `2px solid ${
                      passwords.confirm && passwords.new !== passwords.confirm 
                        ? '#ef4444' 
                        : '#e5e7eb'
                    }`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                {passwords.confirm && passwords.new !== passwords.confirm && (
                  <p style={{
                    color: '#ef4444',
                    fontSize: '12px',
                    marginTop: '4px',
                    marginBottom: 0
                  }}>
                    ⚠️ 비밀번호가 일치하지 않습니다
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  saving || 
                  !passwords.current || 
                  !passwords.new || 
                  !passwords.confirm ||
                  passwords.current === passwords.new ||
                  passwords.new !== passwords.confirm ||
                  passwords.new.length < 8
                }
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  backgroundColor: (
                    saving || 
                    !passwords.current || 
                    !passwords.new || 
                    !passwords.confirm ||
                    passwords.current === passwords.new ||
                    passwords.new !== passwords.confirm ||
                    passwords.new.length < 8
                  ) ? '#9ca3af' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (
                    saving || 
                    !passwords.current || 
                    !passwords.new || 
                    !passwords.confirm ||
                    passwords.current === passwords.new ||
                    passwords.new !== passwords.confirm ||
                    passwords.new.length < 8
                  ) ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? '변경 중...' : '비밀번호 변경 완료'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

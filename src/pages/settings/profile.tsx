// pages/settings/profile.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  role: string;
}

export default function ProfileSettings() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({ name: '', email: '', phone: '', role: '' });
  const [passwords, setPasswords] = useState({
    current: '', // 🎯 현재 비밀번호 추가
    new: '',
    confirm: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userEmail = localStorage.getItem('userEmail');
      const userName = localStorage.getItem('userName');
      const userRole = localStorage.getItem('userRole');

      if (!userEmail) {
        router.replace('/login');
        return;
      }

      // users 테이블에서 추가 정보 조회
      const { data: userData } = await supabase
        .from('users')
        .select('phone')
        .eq('email', userEmail)
        .maybeSingle();

      setProfile({
        name: userName || '',
        email: userEmail,
        phone: userData?.phone || '',
        role: userRole || ''
      });
    } catch (error) {
      console.error('프로필 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 수정된 비밀번호 변경 함수
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

    setSaving(true);

    try {
      // 🎯 방법 1: 현재 비밀번호로 재인증 후 변경
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwords.current
      });

      if (signInError) {
        throw new Error('현재 비밀번호가 올바르지 않습니다.');
      }

      // 🎯 새 비밀번호로 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (updateError) throw updateError;

      alert('비밀번호가 성공적으로 변경되었습니다.');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      console.error('비밀번호 변경 실패:', error);
      alert(`비밀번호 변경 실패: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 🎯 대안 방법: 이메일 링크 방식
  const handlePasswordResetByEmail = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;

      alert('비밀번호 재설정 링크를 이메일로 발송했습니다. 이메일을 확인해주세요.');
    } catch (error: any) {
      console.error('비밀번호 재설정 이메일 발송 실패:', error);
      alert(`이메일 발송 실패: ${error.message}`);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // users 테이블 업데이트
      const { error } = await supabase
        .from('users')
        .update({
          name: profile.name,
          phone: profile.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('email', profile.email);

      if (error) throw error;

      // localStorage 업데이트
      localStorage.setItem('userName', profile.name);
      
      // 네비게이션 업데이트를 위한 이벤트 발생
      window.dispatchEvent(new Event('userInfoUpdated'));

      alert('프로필이 성공적으로 업데이트되었습니다.');
    } catch (error: any) {
      console.error('프로필 업데이트 실패:', error);
      alert(`프로필 업데이트 실패: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <div>프로필 정보를 불러오는 중...</div>
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
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* 헤더 */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 8px 0'
          }}>
            ⚙️ 계정 설정
          </h1>
          <p style={{
            color: '#6b7280',
            margin: 0,
            fontSize: '16px'
          }}>
            프로필 정보 및 비밀번호를 관리합니다
          </p>
        </div>

        <div style={{
          display: 'grid',
          gap: '24px',
          gridTemplateColumns: '1fr',
          maxWidth: '600px'
        }}>
          {/* 프로필 정보 */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '20px'
            }}>
              👤 프로필 정보
            </h2>

            <form onSubmit={handleProfileUpdate}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  이름
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  이메일 (변경 불가)
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#f9fafb',
                    color: '#6b7280',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  전화번호
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  placeholder="010-1234-5678"
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

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: saving ? '#9ca3af' : '#1d4ed8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? '저장 중...' : '프로필 업데이트'}
              </button>
            </form>
          </div>

          {/* 🎯 수정된 비밀번호 변경 섹션 */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '20px'
            }}>
              🔐 비밀번호 변경
            </h2>

            {/* 🎯 방법 1: 현재 비밀번호로 변경 */}
            <form onSubmit={handlePasswordChange} style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  현재 비밀번호 *
                </label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                  placeholder="현재 비밀번호를 입력하세요"
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  새 비밀번호 *
                </label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                  placeholder="8자 이상 입력하세요"
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  비밀번호 확인 *
                </label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                  placeholder="비밀번호를 다시 입력하세요"
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

              <button
                type="submit"
                disabled={saving || !passwords.current || !passwords.new || !passwords.confirm}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: (saving || !passwords.current || !passwords.new || !passwords.confirm) ? '#9ca3af' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (saving || !passwords.current || !passwords.new || !passwords.confirm) ? 'not-allowed' : 'pointer',
                  marginBottom: '16px'
                }}
              >
                {saving ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>

            {/* 🎯 방법 2: 이메일 링크 방식 (대안) */}
            <div style={{
              borderTop: '1px solid #e5e7eb',
              paddingTop: '20px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '12px'
              }}>
                또는 이메일로 비밀번호 재설정
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '16px'
              }}>
                현재 비밀번호를 잊으셨다면 이메일로 재설정 링크를 받으세요.
              </p>
              <button
                onClick={handlePasswordResetByEmail}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                📧 이메일로 재설정 링크 받기
              </button>
            </div>
          </div>
        </div>

        {/* 뒤로 가기 */}
        <div style={{ marginTop: '32px' }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← 뒤로 가기
          </button>
        </div>
      </div>
    </div>
  );
}

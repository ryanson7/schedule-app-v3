"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { loginProfessor, isLoggedIn } from '../utils/auth';

export default function ProfessorLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { redirect } = router.query;

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace('/studio-schedules');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await loginProfessor(phone, password);
    
    if (result.success) {
      const destination = redirect && typeof redirect === 'string' 
        ? redirect 
        : '/studio-schedules';
      router.replace(destination);
    } else {
      setError(result.error || '로그인에 실패했습니다.');
    }
    
    setLoading(false);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img 
            src="https://img.eduwill.net/Img2/Common/BI/type2/live/logo.svg"
            alt="에듀윌 로고"
            style={{ height: '40px', marginBottom: '16px' }}
          />
          <h1 style={{
            color: '#2c3e50',
            fontSize: '24px',
            fontWeight: '600',
            margin: '0 0 8px 0'
          }}>
            교수님 로그인
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '14px',
            margin: 0
          }}>
            스튜디오 촬영 예약 시스템
          </p>
        </div>
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              휴대폰번호
            </label>
            <input 
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="010-1234-5678"
              maxLength={13}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                opacity: loading ? 0.6 : 1
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
              패스워드
            </label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="임시 패스워드를 입력하세요"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                opacity: loading ? 0.6 : 1
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#f8d7da',
              color: '#721c24',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px',
              border: '1px solid #f5c6cb',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !phone || !password}
            style={{
              width: '100%',
              background: (loading || !phone || !password) ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: (loading || !phone || !password) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: '#e8f4f8',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h4 style={{ 
            margin: '0 0 8px 0', 
            color: '#0c5460', 
            fontSize: '14px'
          }}>
            💡 로그인 안내
          </h4>
          <p style={{ margin: '0 0 4px 0', color: '#0c5460', fontSize: '13px' }}>
            관리자가 제공한 휴대폰번호와 임시 패스워드로 로그인
          </p>
          <p style={{ margin: '0', color: '#0c5460', fontSize: '13px' }}>
            로그인 정보 분실시 관리자에게 문의해주세요
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#fff3cd',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#856404'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
              🧪 개발용 테스트 계정
            </div>
            <div>휴대폰: 010-1234-5678</div>
            <div>패스워드: test1234</div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

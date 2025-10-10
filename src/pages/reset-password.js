// pages/reset-password.js
"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRouter } from 'next/router';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // URL 파라미터에서 토큰 확인
    const { access_token, refresh_token } = router.query;
    
    if (access_token && refresh_token) {
      // 임시 세션 설정
      supabase.auth.setSession({
        access_token: access_token as string,
        refresh_token: refresh_token as string
      });
    }
  }, [router.query]);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('패스워드가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('패스워드는 최소 6자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      // 패스워드 업데이트
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      // users 테이블의 임시 패스워드 플래그 해제
      await supabase
        .from('users')
        .update({ is_temp_password: false })
        .eq('auth_id', (await supabase.auth.getUser()).data.user?.id);

      alert('패스워드가 성공적으로 변경되었습니다. 다시 로그인해주세요.');
      
      // 로그아웃 후 로그인 페이지로 이동
      await supabase.auth.signOut();
      router.push('/login');

    } catch (error) {
      setError('패스워드 변경에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-page">
      <div className="reset-form">
        <h1>🔐 패스워드 재설정</h1>
        <p>새로운 패스워드를 입력해주세요.</p>

        <form onSubmit={handlePasswordReset}>
          <div className="form-group">
            <label>새 패스워드</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="새 패스워드를 입력하세요 (최소 6자)"
              required
            />
          </div>

          <div className="form-group">
            <label>패스워드 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="패스워드를 다시 입력하세요"
              required
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? '변경 중...' : '패스워드 변경'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .reset-password-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8f9fa;
        }
        .reset-form {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 400px;
        }
        .reset-form h1 {
          margin: 0 0 8px 0;
          text-align: center;
          color: #2c3e50;
        }
        .reset-form p {
          margin: 0 0 30px 0;
          text-align: center;
          color: #666;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2c3e50;
        }
        .form-group input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .form-group input:focus {
          outline: none;
          border-color: #007bff;
        }
        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        .submit-btn {
          width: 100%;
          background: #007bff;
          color: white;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        .submit-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

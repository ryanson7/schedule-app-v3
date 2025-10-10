// src/utils/phoneToEmail.ts (새로 생성)
export const phoneToEmail = (phone: string, role: 'professor' | 'shooter' = 'professor') => {
  // 전화번호에서 숫자만 추출
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  // 📌 교수/촬영자만 가상 이메일로 변환
  const domainMap = {
    professor: 'professor.temp',
    shooter: 'shooter.eduwill.com'
  };
  
  return `${cleanPhone}@${domainMap[role]}`;
};

// 이메일에서 전화번호 추출 (표시용)
export const emailToPhone = (email: string) => {
  const phoneNumber = email.split('@')[0];
  if (phoneNumber.length === 11 && phoneNumber.startsWith('010')) {
    return `${phoneNumber.slice(0,3)}-${phoneNumber.slice(3,7)}-${phoneNumber.slice(7)}`;
  }
  return phoneNumber;
};

// 입력값이 이메일인지 전화번호인지 감지
export const detectLoginType = (value: string): 'email' | 'phone' => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  
  if (emailPattern.test(value)) {
    return 'email';
  } else if (phonePattern.test(value)) {
    return 'phone';
  } else {
    return 'email'; // 기본값
  }
};

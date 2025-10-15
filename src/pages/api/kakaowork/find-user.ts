export const config = { runtime: 'edge' };

import { NextApiRequest, NextApiResponse } from 'next';

const KAKAOWORK_API_URL = process.env.KAKAOWORK_API_URL || 'https://api.kakaowork.com';
const BOT_APP_KEY = process.env.KAKAOWORK_BOT_APP_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: '이메일이 필요합니다.' });
  }

  if (!BOT_APP_KEY) {
    return res.status(500).json({ message: '카카오워크 API 키가 설정되지 않았습니다.' });
  }

  try {
    console.log('🔍 카카오워크 사용자 조회 시도:', email);

    // 🔧 올바른 카카오워크 API - GET 방식, 쿼리 파라미터
    const apiUrl = `${KAKAOWORK_API_URL}/v1/users.find_by_email?email=${encodeURIComponent(email.toString())}`;
    console.log('📡 API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',  // GET 방식
      headers: {
        'Authorization': `Bearer ${BOT_APP_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    console.log('📡 카카오워크 API 응답:', {
      status: response.status,
      statusText: response.statusText,
      headers: {
        contentType: response.headers.get('content-type'),
        authorization: response.headers.get('authorization') ? 'present' : 'missing'
      },
      body: responseText
    });

    if (!response.ok) {
      console.error('❌ 카카오워크 API 오류:', response.status, responseText);
      return res.status(response.status).json({ 
        message: `카카오워크 API 오류: ${response.status}`,
        detail: responseText 
      });
    }

    // JSON 파싱
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      return res.status(500).json({ 
        message: 'JSON 파싱 오류',
        response: responseText 
      });
    }

    console.log('✅ 파싱된 데이터:', data);

    // 카카오워크 API 응답 구조 확인
    if (data.success === false || data.error) {
      console.error('❌ 카카오워크 API 응답 오류:', data);
      return res.status(400).json({
        message: data.error?.message || '사용자를 찾을 수 없습니다.',
        error: data.error
      });
    }

    // 사용자 정보 반환
    const user = data.user || data;
    if (!user || !user.id) {
      return res.status(404).json({
        message: '사용자 정보를 찾을 수 없습니다.',
        data: data
      });
    }

    console.log('✅ 사용자 조회 성공:', {
      id: user.id,
      name: user.display_name || user.name,
      email: user.email
    });

    res.status(200).json(user);

  } catch (error: any) {
    console.error('❌ 카카오워크 사용자 조회 오류:', error);
    res.status(500).json({ message: error.message });
  }
}

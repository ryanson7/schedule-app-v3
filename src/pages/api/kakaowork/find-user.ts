export const config = {
  runtime: 'edge',
};

const KAKAOWORK_API_URL = 'https://api.kakaowork.com';

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');

    if (!email) {
      console.error('❌ 이메일 파라미터 누락');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '이메일이 필요합니다.' 
        }),
        { status: 400, headers }
      );
    }

    const BOT_APP_KEY = process.env.KAKAOWORK_BOT_APP_KEY;
    if (!BOT_APP_KEY) {
      console.error('❌ KAKAOWORK_BOT_APP_KEY 환경 변수 없음');
      return new Response(
        JSON.stringify({ 
          success: false,
          message: '카카오워크 API 키가 설정되지 않았습니다.',
          hint: 'Cloudflare Pages 환경 변수를 확인하세요'
        }),
        { status: 500, headers }
      );
    }

    console.log('🔍 카카오워크 사용자 조회 시도:', email);

    const apiUrl = `${KAKAOWORK_API_URL}/v1/users.find_by_email?email=${encodeURIComponent(email)}`;
    console.log('📡 API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BOT_APP_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    
    console.log('📡 카카오워크 API 응답:', {
      status: response.status,
      bodyPreview: responseText.substring(0, 200)
    });

    if (!response.ok) {
      console.error('❌ 카카오워크 API 오류:', response.status);
      return new Response(
        JSON.stringify({ 
          success: false,
          message: `카카오워크 API 오류: ${response.status}`,
          detail: responseText 
        }),
        { status: response.status, headers }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError: any) {
      console.error('❌ JSON 파싱 실패');
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'JSON 파싱 오류',
          response: responseText 
        }),
        { status: 500, headers }
      );
    }

    console.log('✅ 파싱 성공');

    if (data.success === false || data.error) {
      console.error('❌ 카카오워크 API 응답 오류');
      return new Response(
        JSON.stringify({
          success: false,
          message: data.error?.message || '사용자를 찾을 수 없습니다.',
          error: data.error
        }),
        { status: 400, headers }
      );
    }

    const user = data.user || data;
    
    if (!user || !user.id) {
      console.error('❌ 사용자 ID 없음');
      return new Response(
        JSON.stringify({
          success: false,
          message: '사용자 정보를 찾을 수 없습니다.',
          data: data
        }),
        { status: 404, headers }
      );
    }

    console.log('✅ 사용자 조회 성공:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        user: user
      }),
      { status: 200, headers }
    );

  } catch (error: any) {
    console.error('❌ 에러:', error.message);
    return new Response(
      JSON.stringify({ 
        success: false,
        message: error.message
      }),
      { status: 500, headers }
    );
  }
}

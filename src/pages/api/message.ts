// pages/api/message.ts

export const config = {
  runtime: 'edge',
};

const API_URL = 'https://closeapi.eduwill.net/bot/3453943/channel/c534b478-b7d2-f558-cf25-8b8d715ca38f/message';

export default async function handler(req: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'API is running',
        message: 'Use POST method to send messages'
      }), 
      { status: 200, headers }
    );
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers }
    );
  }

  try {
    const body = await req.json();
    console.log('📨 받은 요청 body:', body);

    // 🔥 타임아웃 추가 (10초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('❌ closeapi 응답 실패:', response.status, errorText);
        
        // 403/401 → 화이트리스트 문제
        if (response.status === 403 || response.status === 401) {
          return new Response(
            JSON.stringify({ 
              error: 'Access denied by closeapi',
              message: 'Cloudflare Pages 도메인을 closeapi 화이트리스트에 추가해야 합니다.',
              details: errorText 
            }), 
            { status: response.status, headers }
          );
        }

        return new Response(
          JSON.stringify({ error: 'Failed to send message', details: errorText }), 
          { status: response.status, headers }
        );
      }

      const data = await response.json();
      console.log('✅ 메시지 발송 성공:', data);

      return new Response(JSON.stringify(data), { status: 200, headers });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // 타임아웃 에러
      if (fetchError.name === 'AbortError') {
        console.error('⏱️ closeapi 타임아웃 (10초 초과)');
        return new Response(
          JSON.stringify({ 
            error: 'Request timeout',
            message: 'closeapi 서버 응답 시간 초과 (화이트리스트 문제일 수 있음)'
          }), 
          { status: 504, headers }
        );
      }
      
      throw fetchError;
    }

  } catch (error: any) {
    console.error('❌ 에러:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers }
    );
  }
}

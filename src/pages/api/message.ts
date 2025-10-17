// pages/api/message.ts

import type { NextApiRequest, NextApiResponse } from 'next';

// 🔥 Edge Runtime으로 설정
export const config = {
  runtime: 'edge',
};

const API_URL = 'https://closeapi.eduwill.net/bot/3453943/channel/c534b478-b7d2-f558-cf25-8b8d715ca38f/message';

export default async function handler(req: Request) {
  // Edge Runtime에서는 Request/Response 객체 사용
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    console.log('📨 받은 요청 body:', body);

    // body 전체를 그대로 closeapi로 전달
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('❌ closeapi 응답 실패:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send message',
          details: errorText 
        }), 
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    console.log('✅ 메시지 발송 성공:', data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ 에러:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

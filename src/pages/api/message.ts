//src/pages/api/message.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

interface MessageRequest {
  type: string;
  message: string;
}

export default async function handler(req: NextRequest) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json() as MessageRequest;
    const { message } = body;
    
    const naverWorksUrl = 'https://closeapi.eduwill.net/bot/10608844/channel/81063172-71bb-7066-51ef-dd7cca1b7000/message';
    
    // ✅ 타임아웃 60초
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    try {
      const response = await fetch(naverWorksUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ text: message }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 네이버웍스 응답 오류:', response.status);
        
        return NextResponse.json(
          {
            success: false,
            warning: '메시지 발송 실패',
            error: `HTTP ${response.status}`
          },
          { status: 200, headers: corsHeaders }
        );
      }

      const data = await response.json();
      console.log('✅ 메시지 발송 성공');

      return NextResponse.json(
        {
          success: true,
          message: '메시지 발송 완료',
          data: data
        },
        { headers: corsHeaders }
      );

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('❌ fetch 오류:', fetchError.message);

      return NextResponse.json(
        {
          success: false,
          warning: '메시지 발송 실패',
          error: fetchError.message
        },
        { status: 200, headers: corsHeaders }
      );
    }

  } catch (error: any) {
    console.error('❌ 처리 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        warning: '메시지 발송 실패',
        error: error.message
      },
      { status: 200, headers: corsHeaders }
    );
  }
}

//src/pages/api/message.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

interface MessageRequest {
  type: string;
  message: string;
  scheduleData?: any;
  targetUsers?: string[];
  channelId?: string;
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
    const { message, type } = body;
    
    console.log(`📨 메시지 발송 요청 (type: ${type})`);
    console.log(`메시지 내용:`, message.substring(0, 50));
    
    const naverWorksUrl = 'https://closeapi.eduwill.net/bot/10608844/channel/81063172-71bb-7066-51ef-dd7cca1b7000/message';
    
    // ✅ JSON 직렬화 + UTF-8 보장
    const payload = JSON.stringify({ text: message });
    
    // ✅ 타임아웃 60초
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ 타임아웃 60초 도달');
      controller.abort();
    }, 60000);

    try {
      const response = await fetch(naverWorksUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
        },
        body: payload,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ 네이버웍스 응답 오류 (${response.status}):`, errorText.substring(0, 200));
        
        return NextResponse.json(
          {
            success: false,
            warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
            error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
          },
          { status: 200, headers: corsHeaders }
        );
      }

      const data = await response.json();
      console.log(`✅ 네이버웍스 메시지 발송 성공 (type: ${type})`);

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
      
      // ✅ 에러 종류 구분
      if (fetchError.name === 'AbortError') {
        console.error('❌ 타임아웃:', fetchError.message);
        return NextResponse.json(
          {
            success: false,
            warning: '메시지 발송 타임아웃 - 스케줄 등록은 완료됨',
            error: 'Timeout after 60 seconds'
          },
          { status: 200, headers: corsHeaders }
        );
      }
      
      console.error('❌ 네이버웍스 fetch 오류:', fetchError.message);

      return NextResponse.json(
        {
          success: false,
          warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
          error: fetchError.message
        },
        { status: 200, headers: corsHeaders }
      );
    }

  } catch (error: any) {
    console.error('❌ 메시지 처리 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
        error: error.message
      },
      { status: 200, headers: corsHeaders }
    );
  }
}

// ✅ Edge Runtime용 import
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

interface MessageRequest {
  type: string;
  message: string;
}

export default async function handler(req: NextRequest) {
  // ✅ CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405, headers: corsHeaders }
    );
  }

  const debugLog: any = {
    timestamp: new Date().toISOString(),
    environment: 'Cloudflare Pages',
    runtime: 'edge',
  };

  try {
    // ✅ Edge Runtime에서 body 읽기
    const body = await req.json() as MessageRequest;
    const { type, message } = body;
    
    debugLog.messageType = type;
    debugLog.messageLength = message?.length || 0;

    console.log('🔍 [Edge Runtime 시작]', JSON.stringify(debugLog, null, 2));

    const naverWorksUrl = 'https://closeapi.eduwill.net/bot/10608844/channel/81063172-71bb-7066-51ef-dd7cca1b7000/message';
    
    console.log('📡 요청 URL:', naverWorksUrl);

    // AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏱️ 타임아웃 발생! (50초 초과)');
      controller.abort();
    }, 50000);

    const fetchStart = Date.now();
    
    try {
      console.log('🚀 Fetch 시작:', new Date().toISOString());

      const response = await fetch(naverWorksUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ text: message }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const fetchEnd = Date.now();

      debugLog.fetchDuration = fetchEnd - fetchStart;
      debugLog.responseStatus = response.status;
      debugLog.responseOk = response.ok;

      console.log('⏱️ Fetch 완료 시간:', debugLog.fetchDuration, 'ms');
      console.log('📊 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        debugLog.errorResponse = errorText.substring(0, 200);
        
        console.error('❌ API 오류 응답:', errorText);

        return NextResponse.json(
          {
            success: false,
            warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
            debug: debugLog,
            error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
          },
          { status: 200, headers: corsHeaders }
        );
      }

      const data = await response.json();
      debugLog.success = true;

      console.log('✅ 메시지 발송 성공!');
      console.log('📈 전체 디버그 정보:', JSON.stringify(debugLog, null, 2));

      return NextResponse.json(
        {
          success: true,
          message: '메시지 발송 완료',
          debug: debugLog,
          data: data
        },
        { headers: corsHeaders }
      );

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const fetchEnd = Date.now();

      debugLog.fetchDuration = fetchEnd - fetchStart;
      debugLog.fetchError = {
        name: fetchError.name,
        message: fetchError.message,
      };

      console.error('❌ Fetch 오류 발생!');
      console.error('오류 타입:', fetchError.name);
      console.error('오류 메시지:', fetchError.message);
      console.error('소요 시간:', debugLog.fetchDuration, 'ms');

      if (fetchError.name === 'AbortError') {
        debugLog.errorType = 'TIMEOUT';
        console.error('🚨 타임아웃 확인됨! 50초 초과');
      } else {
        debugLog.errorType = 'NETWORK_ERROR';
      }

      console.error('📊 전체 디버그 정보:', JSON.stringify(debugLog, null, 2));

      return NextResponse.json(
        {
          success: false,
          warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
          debug: debugLog,
          error: fetchError.message,
          errorType: debugLog.errorType
        },
        { status: 200, headers: corsHeaders }
      );
    }

  } catch (error: any) {
    debugLog.generalError = {
      name: error.name,
      message: error.message,
    };

    console.error('❌ 전체 오류:', error);
    console.error('📊 디버그 정보:', JSON.stringify(debugLog, null, 2));

    return NextResponse.json(
      {
        success: false,
        warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
        debug: debugLog,
        error: error.message
      },
      { status: 200, headers: corsHeaders }
    );
  }
}

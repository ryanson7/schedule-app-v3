// pages/api/message/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';

interface MessageRequest {
  type: string;
  message: string;
}

export const config = {
  maxDuration: 60, // ✅ 최대 60초로 늘림
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const debugLog: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'Vercel' : 'Local',
    nodeVersion: process.version,
    region: process.env.VERCEL_REGION || 'unknown',
  };

  try {
    const { type, message }: MessageRequest = req.body;
    
    debugLog.messageType = type;
    debugLog.messageLength = message?.length || 0;

    console.log('🔍 [디버깅 시작]', JSON.stringify(debugLog, null, 2));

    // ✅ 1단계: DNS 해석 시간 측정
    const dnsStart = Date.now();
    const naverWorksUrl = 'https://closeapi.eduwill.net/bot/10608844/channel/81063172-71bb-7066-51ef-dd7cca1b7000/message';
    
    console.log('📡 요청 URL:', naverWorksUrl);

    // ✅ 2단계: 타임아웃 설정 (50초)
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

        // ✅ 오류여도 성공으로 처리
        return res.status(200).json({
          success: false,
          warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
          debug: debugLog,
          error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
        });
      }

      const data = await response.json();
      debugLog.success = true;

      console.log('✅ 메시지 발송 성공!');
      console.log('📈 전체 디버그 정보:', JSON.stringify(debugLog, null, 2));

      return res.status(200).json({
        success: true,
        message: '메시지 발송 완료',
        debug: debugLog,
        data: data
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const fetchEnd = Date.now();

      debugLog.fetchDuration = fetchEnd - fetchStart;
      debugLog.fetchError = {
        name: fetchError.name,
        message: fetchError.message,
        code: fetchError.code,
        cause: fetchError.cause?.message || null,
      };

      console.error('❌ Fetch 오류 발생!');
      console.error('오류 타입:', fetchError.name);
      console.error('오류 메시지:', fetchError.message);
      console.error('오류 코드:', fetchError.code);
      console.error('소요 시간:', debugLog.fetchDuration, 'ms');

      // ✅ 타임아웃 확인
      if (fetchError.name === 'AbortError') {
        debugLog.errorType = 'TIMEOUT';
        console.error('🚨 타임아웃 확인됨! 50초 초과');
      } else if (fetchError.message.includes('ENOTFOUND')) {
        debugLog.errorType = 'DNS_FAILURE';
        console.error('🚨 DNS 해석 실패!');
      } else if (fetchError.message.includes('ECONNREFUSED')) {
        debugLog.errorType = 'CONNECTION_REFUSED';
        console.error('🚨 연결 거부됨!');
      } else if (fetchError.message.includes('ETIMEDOUT')) {
        debugLog.errorType = 'NETWORK_TIMEOUT';
        console.error('🚨 네트워크 타임아웃!');
      } else {
        debugLog.errorType = 'UNKNOWN';
      }

      console.error('📊 전체 디버그 정보:', JSON.stringify(debugLog, null, 2));

      return res.status(200).json({
        success: false,
        warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
        debug: debugLog,
        error: fetchError.message,
        errorType: debugLog.errorType
      });
    }

  } catch (error: any) {
    debugLog.generalError = {
      name: error.name,
      message: error.message,
    };

    console.error('❌ 전체 오류:', error);
    console.error('📊 디버그 정보:', JSON.stringify(debugLog, null, 2));

    return res.status(200).json({
      success: false,
      warning: '메시지 발송 실패 - 스케줄 등록은 완료됨',
      debug: debugLog,
      error: error.message
    });
  }
}

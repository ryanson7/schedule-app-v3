export const config = {
  runtime: 'edge',
};

import type { NextApiRequest, NextApiResponse } from 'next';

interface MessageRequest {
  type: string;
  message: string;
}

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
    environment: 'Cloudflare Pages',
    runtime: 'edge',
  };

  try {
    const { type, message }: MessageRequest = req.body;
    
    debugLog.messageType = type;
    debugLog.messageLength = message?.length || 0;

    console.log('🔍 [Edge Runtime 시작]', JSON.stringify(debugLog, null, 2));

    const naverWorksUrl = 'https://closeapi.eduwill.net/bot/10608844/channel/81063172-71bb-7066-51ef-dd7cca1b7000/message';
    
    console.log('📡 요청 URL:', naverWorksUrl);

    // Edge Runtime에서는 AbortController 사용 가능
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

import type { NextApiRequest, NextApiResponse } from 'next';

interface MessageRequest {
  type: 'approval_request' | 'approval_complete' | 'schedule_notice';
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS 설정
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

  try {
    const { type, message }: MessageRequest = req.body;

    console.log(`메시지 발송 [${new Date().toLocaleTimeString()}]:`, type);
    console.log(`내용:`, message);

    // 네이버웍스 봇 메시지 - 텍스트 전용
    const messageBody = {
      text: message
    };

    const response = await fetch(
      'https://closeapi.eduwill.net/bot/10608844/channel/81063172-71bb-7066-51ef-dd7cca1b7000/message',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageBody)
      }
    );

    if (!response.ok) {
      throw new Error(`네이버웍스 API 오류: ${response.status}`);
    }

    const data = await response.json();
    console.log('네이버웍스 응답:', data);

    res.status(200).json({
      success: true,
      message: '메시지 발송 완료',
      data: data
    });

  } catch (error) {
    console.error('메시지 발송 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

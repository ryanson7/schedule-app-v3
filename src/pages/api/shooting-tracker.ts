// pages/api/shooting-tracker.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { scheduleId, action, timestamp, scheduleIndex } = req.body;
    
    const serverTimestamp = new Date().toISOString();
    
    // 실제 데이터베이스에 저장
    // await saveShootingProgress({
    //   scheduleId,
    //   action,
    //   timestamp: serverTimestamp,
    //   scheduleIndex
    // });
    
    console.log('촬영 진행상황 기록:', {
      scheduleId,
      action,
      timestamp: new Date(serverTimestamp).toLocaleString('ko-KR'),
      scheduleIndex
    });
    
    res.status(200).json({
      success: true,
      message: '진행상황이 기록되었습니다',
      data: {
        scheduleId,
        action,
        timestamp: serverTimestamp,
        scheduleIndex
      }
    });
    
  } catch (error) {
    console.error('진행상황 기록 실패:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

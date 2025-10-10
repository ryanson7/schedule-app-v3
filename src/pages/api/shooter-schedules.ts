// pages/api/shooter-schedules.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 실제로는 데이터베이스에서 오늘의 촬영 스케줄을 조회
    // 여기서는 빈 배열 반환 (실제 데이터 연동 시 수정)
    const schedules = await getTodayShootingSchedules();
    
    res.status(200).json({
      success: true,
      schedules: schedules,
      count: schedules.length
    });
    
  } catch (error) {
    console.error('스케줄 조회 실패:', error);
    res.status(500).json({ 
      success: false,
      error: '스케줄을 불러올 수 없습니다',
      schedules: []
    });
  }
}

async function getTodayShootingSchedules() {
  // 실제 데이터베이스 쿼리로 교체
  // const today = new Date().toISOString().split('T')[0];
  // return await db.schedules.findMany({ where: { date: today, shooterId: userId } });
  
  // 현재는 빈 배열 반환
  return [];
}

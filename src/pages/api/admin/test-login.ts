import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  console.log('🧪 로그인 테스트:', email, password);

  try {
    // 1. 전체 Auth 사용자 목록에서 이메일로 검색
    console.log('🔍 사용자 검색 중...');
    
    let foundUser = null;
    let page = 1;
    
    while (!foundUser && page <= 5) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: page,
        perPage: 1000
      });

      if (!listError && users) {
        foundUser = users.find(user => user.email === email);
        console.log(`페이지 ${page}: ${users.length}명 검색 중...`);
        if (foundUser) {
          console.log('✅ 사용자 발견:', foundUser.email, foundUser.id);
          break;
        }
      }
      
      if (!users || users.length < 1000) break;
      page++;
    }

    if (!foundUser) {
      console.log('❌ 사용자를 찾을 수 없음');
      return res.status(404).json({ error: '사용자를 찾을 수 없음' });
    }

    // 2. 클라이언트용 Supabase로 실제 로그인 시도
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    console.log('🔐 클라이언트로 로그인 시도...');
    
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      console.error('❌ 로그인 실패:', signInError);
      return res.status(400).json({ 
        error: '로그인 실패', 
        details: signInError.message 
      });
    }

    console.log('✅ 로그인 성공:', signInData.user.email);

    return res.status(200).json({
      success: true,
      user: signInData.user,
      message: '로그인 테스트 성공'
    });

  } catch (error) {
    console.error('🔥 테스트 오류:', error);
    return res.status(500).json({ 
      error: '테스트 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    });
  }
}

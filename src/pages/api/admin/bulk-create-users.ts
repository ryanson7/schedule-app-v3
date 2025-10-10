// pages/api/admin/bulk-create-users.ts (완전 교체)
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔍 API Route 호출됨:', req.method, req.url);
  console.log('🔍 Headers:', req.headers);

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      method: req.method,
      allowed: ['POST'],
      url: req.url
    });
  }

  try {
    console.log('🔍 Request body:', req.body);
    const { admins } = req.body;
    
    if (!admins || !Array.isArray(admins)) {
      return res.status(400).json({ error: '유효한 관리자 배열이 필요합니다' });
    }

    console.log('🔍 받은 관리자 수:', admins.length);
    
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < admins.length; i++) {
      const admin = admins[i];
      try {
        const email = admin.email?.toString().trim();
        const name = admin.name?.toString().trim();
        
        console.log(`🔍 처리 중 [${i+1}/${admins.length}]:`, { email, name });

        if (!email || !name) {
          results.errors.push(`${i+1}번째: 이메일과 이름 필수`);
          continue;
        }

        // 중복 검사
        const { data: existingUser } = await supabaseAdmin
          .from('users_formatted')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (existingUser) {
          console.log(`⏭️ 건너뜀: ${email} (이미 존재)`);
          results.skipped++;
          continue;
        }

        // Auth 생성
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: 'qwer1234!',
          email_confirm: true,
          user_metadata: {
            name: name,
            role: 'schedule_admin',
            is_temp_password: true
          }
        });

        if (authError) {
          console.error(`🚨 Auth 오류 [${name}]:`, authError);
          results.errors.push(`${name}: Auth 생성 실패 - ${authError.message}`);
          continue;
        }

        // DB 저장 (최소한의 데이터만)
        const { error: dbError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authData.user.id,
            name: name,
            email: email,
            temp_password: 'qwer1234!',
            is_temp_password: true,
            role: 'schedule_admin',
            status: 'active',
            is_active: true,
            created_at: new Date().toISOString()
          });

        if (dbError) {
          console.error(`🚨 DB 오류 [${name}]:`, dbError);
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          results.errors.push(`${name}: DB 저장 실패 - ${dbError.message}`);
          continue;
        }

        console.log(`✅ 성공 [${i+1}/${admins.length}]: ${name}`);
        results.created++;

      } catch (error) {
        console.error(`🚨 처리 오류 [${i+1}]:`, error);
        results.errors.push(`${admin.name || admin.email || `${i+1}번째`}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    console.log('🎉 최종 결과:', results);

    res.status(200).json({
      success: true,
      results,
      message: `생성: ${results.created}명, 건너뜀: ${results.skipped}명, 오류: ${results.errors.length}명`
    });

  } catch (error) {
    console.error('🚨 전체 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '서버 오류'
    });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔐 패스워드 재설정 API 호출됨:', req.method, req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { professorId } = req.body;

  if (!professorId) {
    return res.status(400).json({ error: '교수 ID가 필요합니다.' });
  }

  try {
    // 1. 교수 정보 조회
    console.log('🔍 교수 정보 조회 중...', professorId);
    
    const { data: professor, error: profError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', professorId)
      .single();

    if (profError || !professor) {
      console.error('❌ 교수 조회 실패:', profError);
      return res.status(404).json({ error: '교수를 찾을 수 없습니다.' });
    }

    console.log('✅ 교수 정보 조회 성공:', professor.name, professor.phone);

    // 2. 임시 패스워드 설정
    const tempPassword = 'pro1234!';
    
    // 3. 전화번호에서 하이픈 제거 후 이메일 생성
    const phoneWithoutHyphen = professor.phone.replace(/-/g, '');
    const userEmail = `${phoneWithoutHyphen}@professor.temp`;

    console.log('🔐 패스워드 재설정 시도:', userEmail, tempPassword);

    let authUserId = null;
    let operationSuccess = false;

    // 4. 방법 1: 전체 사용자 목록으로 검색 (페이지네이션 고려)
    try {
      let page = 1;
      let foundUser = null;
      
      while (!foundUser && page <= 10) { // 최대 10페이지까지 검색
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page: page,
          perPage: 1000
        });

        console.log(`🔍 페이지 ${page} 검색 중... (${users?.length || 0}명)`);

        if (!listError && users) {
          foundUser = users.find(user => user.email === userEmail);
          if (foundUser) {
            console.log('✅ 사용자 발견:', foundUser.email, 'ID:', foundUser.id);
            authUserId = foundUser.id;
            break;
          }
        }
        
        if (!users || users.length < 1000) break; // 더 이상 검색할 페이지 없음
        page++;
      }
    } catch (searchError) {
      console.log('🔍 목록 검색 실패:', searchError);
    }

    // 5. 사용자 처리
    if (authUserId) {
      // 기존 사용자 패스워드 업데이트
      console.log('🔄 기존 Auth 사용자 패스워드 업데이트:', authUserId);
      
      try {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authUserId,
          { password: tempPassword }
        );

        if (updateError) {
          console.error('❌ 패스워드 업데이트 실패:', updateError);
          throw updateError;
        }

        console.log('✅ 패스워드 업데이트 성공');
        operationSuccess = true;
      } catch (updateErr) {
        console.log('🔄 업데이트 실패, 삭제 후 재생성 시도...');
        
        // 기존 사용자 삭제 시도
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          console.log('🗑️ 기존 사용자 삭제 완료');
          authUserId = null; // 새로 생성하도록 설정
        } catch (deleteErr) {
          console.log('❌ 사용자 삭제 실패:', deleteErr);
        }
      }
    }

    // 6. 새 사용자 생성 (사용자가 없거나 삭제된 경우)
    if (!operationSuccess) {
      console.log('🔄 새 Auth 사용자 생성 중:', userEmail);
      
      try {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          password: tempPassword,
          email_confirm: true
        });

        if (createError) {
          console.error('❌ 사용자 생성 실패:', createError);
          throw createError;
        }

        console.log('✅ Auth 사용자 생성 성공:', newUser.user.email);
        operationSuccess = true;
      } catch (createErr) {
        console.error('🔥 모든 방법 실패:', createErr);
        return res.status(500).json({ 
          error: '패스워드 재설정 실패: ' + createErr.message 
        });
      }
    }

    // 7. users 테이블 업데이트 (성공한 경우에만)
    if (operationSuccess) {
      await supabaseAdmin
        .from('users')
        .update({
          is_temp_password: true,
          temp_password: tempPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', professorId);

      console.log('✅ 패스워드 재설정 완료');

      return res.status(200).json({
        success: true,
        tempPassword: tempPassword,
        professor: {
          phone: phoneWithoutHyphen,
          name: professor.name,
          email: userEmail
        }
      });
    } else {
      throw new Error('모든 방법이 실패했습니다');
    }

  } catch (error) {
    console.error('🔥 패스워드 재설정 오류:', error);
    return res.status(500).json({ 
      error: '서버 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    });
  }
}


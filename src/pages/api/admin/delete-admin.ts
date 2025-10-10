// src/pages/api/admin/delete-admin.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.body; // 이제 integer ID

    if (!id) {
      return res.status(400).json({ error: '관리자 ID가 필요합니다' });
    }

    console.log('🔍 관리자 삭제 요청:', { id, type: typeof id });

    // 1. 먼저 사용자 정보 조회 (auth_user_id 또는 email 필요)
    const { data: userData, error: selectError } = await supabaseAdmin
      .from('users')
      .select('id, email, auth_user_id') // auth_user_id가 있는 경우
      .eq('id', id)
      .single();

    if (selectError || !userData) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    // 2. users 테이블에서 비활성화
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
      
    if (userError) {
      console.error('🚨 users 테이블 비활성화 오류:', userError);
      throw new Error(`사용자 비활성화 실패: ${userError.message}`);
    }

    // 3. Authentication에서 삭제 (auth_user_id 또는 email 사용)
    try {
      if (userData.auth_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id);
      } else {
        // email로 찾아서 삭제
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const authUser = authUsers.users.find(u => u.email === userData.email);
        if (authUser) {
          await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        }
      }
    } catch (authError) {
      console.error('🚨 Authentication 삭제 오류:', authError);
      // Auth 삭제 실패해도 DB는 비활성화되었으므로 계속 진행
    }

    res.status(200).json({
      success: true,
      message: '관리자가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('🚨 관리자 삭제 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}

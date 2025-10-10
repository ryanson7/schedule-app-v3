// src/pages/api/professors/verify-login.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../utils/supabaseClient';

interface VerifyLoginRequest {
  phone: string;
  password: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    console.log('🎓 API 호출됨:', req.url);
    console.log('📥 요청 데이터:', req.body);

    const { phone, password }: VerifyLoginRequest = req.body;

    console.log('🎓 교수 로그인 검증 API 시작:', phone);

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        error: '전화번호와 패스워드가 필요합니다.'
      });
    }

    // 전화번호 정규화
    const normalizedPhone = phone.replace(/[^0-9]/g, '');

    console.log('📱 정규화된 전화번호:', normalizedPhone);

    // 교수 정보 조회
    const { data: professor, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('role', 'professor')
      .eq('is_active', true)
      .single();

    console.log('🔍 Supabase 조회 결과:', { professor, error });

    if (error) {
      console.error('❌ 교수 조회 오류:', error);
      return res.status(404).json({ 
        success: false, 
        error: '등록된 교수를 찾을 수 없습니다.',
        debug: process.env.NODE_ENV === 'development' ? { error, normalizedPhone } : undefined
      });
    }

    if (!professor) {
      console.log('❌ 교수 데이터 없음');
      return res.status(404).json({ 
        success: false, 
        error: '등록된 교수를 찾을 수 없습니다.' 
      });
    }

    console.log('✅ 교수 조회 성공:', {
      id: professor.id,
      name: professor.name,
      phone: professor.phone,
      is_temp_password: professor.is_temp_password,
      temp_password: professor.temp_password
    });

    // 패스워드 검증
    let isValidPassword = false;
    let isTemp = false;

    // 1) 임시 패스워드 확인
    if (professor.is_temp_password && professor.temp_password) {
      if (professor.temp_password === password) {
        isValidPassword = true;
        isTemp = true;
        console.log('✅ 임시 패스워드 일치');
      } else {
        console.log('❌ 임시 패스워드 불일치:', {
          stored: professor.temp_password,
          provided: password
        });
      }
    } 
    // 2) 일반 패스워드 확인
    else if (!professor.is_temp_password && professor.password) {
      if (professor.password === password) {
        isValidPassword = true;
        isTemp = false;
        console.log('✅ 일반 패스워드 일치');
      } else {
        console.log('❌ 일반 패스워드 불일치');
      }
    }

    // 3) 고정 임시 패스워드 확인 (pro1234!)
    if (!isValidPassword && password === 'pro1234!') {
      isValidPassword = true;
      isTemp = true;
      console.log('✅ 고정 임시 패스워드 일치');
      
      // 데이터베이스에 임시 패스워드 정보 업데이트
      await supabase
        .from('users')
        .update({
          temp_password: 'pro1234!',
          is_temp_password: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', professor.id);
    }

    if (!isValidPassword) {
      console.log('❌ 모든 패스워드 검증 실패');
      return res.status(401).json({ 
        success: false, 
        error: '패스워드가 일치하지 않습니다.',
        debug: process.env.NODE_ENV === 'development' ? {
          hasTemp: !!professor.temp_password,
          hasRegular: !!professor.password,
          isTempMode: professor.is_temp_password,
          providedPassword: password
        } : undefined
      });
    }

    console.log('🎉 교수 로그인 검증 성공:', {
      id: professor.id,
      name: professor.name,
      isTemp
    });

    return res.status(200).json({
      success: true,
      user: {
        id: professor.id,
        name: professor.name,
        email: professor.email,
        phone: professor.phone,
        role: professor.role
      },
      isTemp,
      message: isTemp ? '임시 패스워드로 로그인되었습니다.' : '로그인 성공'
    });

  } catch (error) {
    console.error('❌ 교수 로그인 검증 API 오류:', error);
    return res.status(500).json({ 
      success: false, 
      error: '로그인 처리 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

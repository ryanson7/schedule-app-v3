export const config = { runtime: 'edge' };

import bcrypt from 'bcrypt'
import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RegisterRequest {
  username: string
  password: string
  name: string
  email?: string
  role?: string
}

interface RegisterResponse {
  message: string
  user?: {
    id: number
    username: string
    name: string
    role: string
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterResponse>
) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않는 메소드입니다' })
  }

  const { username, password, name, email, role = 'staff' }: RegisterRequest = req.body

  // 필수 필드 검증
  if (!username || !password || !name) {
    return res.status(400).json({ 
      message: '아이디, 비밀번호, 이름은 필수 입력 항목입니다' 
    })
  }

  // 아이디 길이 검증
  if (username.length < 4 || username.length > 20) {
    return res.status(400).json({ 
      message: '아이디는 4자 이상 20자 이하로 입력해주세요' 
    })
  }

  // 비밀번호 길이 검증
  if (password.length < 6) {
    return res.status(400).json({ 
      message: '비밀번호는 6자 이상 입력해주세요' 
    })
  }

  // 아이디 형식 검증 (영문, 숫자만 허용)
  const usernameRegex = /^[a-zA-Z0-9]+$/
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ 
      message: '아이디는 영문과 숫자만 사용할 수 있습니다' 
    })
  }

  try {
    // 아이디 중복 확인
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116은 "no rows returned" 에러 (중복 없음을 의미)
      console.error('아이디 중복 확인 오류:', checkError)
      return res.status(500).json({ 
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요' 
      })
    }

    if (existingUser) {
      return res.status(400).json({ 
        message: '이미 사용 중인 아이디입니다' 
      })
    }

    // 이메일 중복 확인 (이메일이 제공된 경우)
    if (email) {
      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (existingEmail) {
        return res.status(400).json({ 
          message: '이미 사용 중인 이메일입니다' 
        })
      }
    }

    // 비밀번호 해시화
    const saltRounds = 12
    const password_hash = await bcrypt.hash(password, saltRounds)

    // 사용자 생성
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        username,
        email: email || `${username}@example.com`, // 이메일이 없으면 기본값
        name,
        role,
        password_hash,
        is_active: true,
        created_at: new Date().toISOString()
      }])
      .select('id, username, name, role')
      .single()

    if (insertError) {
      console.error('사용자 생성 오류:', insertError)
      
      // 중복 키 오류 처리
      if (insertError.code === '23505') {
        return res.status(400).json({ 
          message: '이미 존재하는 아이디 또는 이메일입니다' 
        })
      }
      
      return res.status(500).json({ 
        message: '회원가입 중 오류가 발생했습니다' 
      })
    }

    console.log('✅ 회원가입 성공:', {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role
    })

    // 성공 응답
    res.status(201).json({ 
      message: '회원가입이 완료되었습니다',
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role
      }
    })

  } catch (error) {
    console.error('회원가입 처리 중 예외 발생:', error)
    
    // bcrypt 오류
    if (error instanceof Error && error.message.includes('bcrypt')) {
      return res.status(500).json({ 
        message: '비밀번호 처리 중 오류가 발생했습니다' 
      })
    }
    
    // 기타 오류
    res.status(500).json({ 
      message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요' 
    })
  }
}

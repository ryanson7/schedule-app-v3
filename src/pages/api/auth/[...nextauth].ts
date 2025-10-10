import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { 
          label: '아이디', 
          type: 'text', 
          placeholder: '아이디를 입력하세요' 
        },
        password: { 
          label: '비밀번호', 
          type: 'password',
          placeholder: '비밀번호를 입력하세요'
        }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          // users 테이블에서 username으로 조회
          const { data: user, error } = await supabase
            .from('users')
            .select('id, username, email, name, role, password_hash')
            .eq('username', credentials.username)  // username으로 조회
            .eq('is_active', true)
            .single()

          if (error || !user) {
            console.log('사용자를 찾을 수 없습니다')
            return null
          }

          // 비밀번호 검증
          const isValidPassword = await bcrypt.compare(
            credentials.password,
            user.password_hash
          )

          if (!isValidPassword) {
            console.log('비밀번호가 일치하지 않습니다')
            return null
          }

          // 인증 성공
          return {
            id: user.id.toString(),
            username: user.username,
            email: user.email,
            name: user.name,
            role: user.role
          }
        } catch (error) {
          console.error('인증 오류:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.userId = user.id
        token.username = user.username
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
        session.user.username = token.username as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  }
})

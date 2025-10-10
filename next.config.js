/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🔥 Vercel 배포를 위한 최소 설정
  typescript: {
    ignoreBuildErrors: true, // 타입 오류 무시
  },
  eslint: {
    ignoreDuringBuilds: true, // ESLint 오류 무시
  },
  experimental: {
    scrollRestoration: true
  }
  // swcMinify는 Next.js 15에서 기본 활성화되므로 제거
}

module.exports = nextConfig

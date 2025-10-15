/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // ESLint 완전 비활성화 (빌드 속도 향상)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript 타입 체크 비활성화 (빌드 속도 향상)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 웹팩 캐시 비활성화
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

module.exports = nextConfig;

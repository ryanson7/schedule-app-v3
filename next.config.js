/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // ✅ 클라우드플레어 Pages 호환 (이미지 최적화 비활성화)
  images: {
    unoptimized: true,
  },
  
  // ✅ ESLint 비활성화 (빌드 속도 향상)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // ✅ TypeScript 타입 체크 비활성화 (빌드 속도 향상)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ✅ Webpack 설정 (캐시 비활성화 + fallback 설정)
  webpack: (config, { isServer }) => {
    // 캐시 비활성화
    config.cache = false;
    
    // 클라이언트 사이드 fallback 설정
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;

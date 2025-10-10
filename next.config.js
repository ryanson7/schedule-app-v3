/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Fast Refresh 안정성을 위해 false 유지
  swcMinify: true,
  
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  
  generateBuildId: async () => {
    if (process.env.NODE_ENV === 'development') {
      return 'development-build-stable'; // 더 안정적인 ID
    }
    return `build-${Date.now()}`;
  },
  
  // Fast Refresh 최적화 설정
  onDemandEntries: {
    maxInactiveAge: 120 * 1000, // 2분으로 증가
    pagesBufferLength: 8, // 버퍼 더 증가
  },
  
  webpack: (config, { dev }) => {
    if (dev) {
      // HMR 안정성 개선
      config.watchOptions = {
        poll: 2000, // 폴링 주기 늘림 (1000 → 2000)
        aggregateTimeout: 500, // 집계 시간 늘림 (300 → 500)
        ignored: [
          '**/node_modules',
          '**/.next',
          '**/out',
          '**/.git',
          '**/.vscode', // VSCode 캐시 제외
        ],
      };
      
      // HMR 플러그인 최적화
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
        runtimeChunk: false, // Runtime chunk 비활성화
      };

      // HMR 에러 무시 설정
      config.infrastructureLogging = {
        level: 'warn',
      };
    }
    return config;
  },
  
  // 실험적 기능 최소화 (안정성 우선)
  experimental: {
    scrollRestoration: true,
    // optimizeCss 제거 (HMR 충돌 가능성)
  },

  // 압축 비활성화 (개발 환경)
  compress: false,

  // HMR 최적화를 위한 헤더 설정
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/_next/static/(.*)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-cache, no-store, must-revalidate',
            },
          ],
        },
      ];
    }
    return [];
  },
}

module.exports = nextConfig

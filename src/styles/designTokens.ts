// 📁 styles/designTokens.ts
export const DESIGN_TOKENS = {
  // 색상 시스템
  colors: {
    studio: {
      primary: '#059669',
      secondary: '#F0FDF4',
      border: '#10B981',
      text: '#064E3B'
    },
    academy: {
      primary: '#2563EB',
      secondary: '#EFF6FF', 
      border: '#3B82F6',
      text: '#1E3A8A'
    },
    internal: {
      primary: '#7C3AED',
      secondary: '#F5F3FF',
      border: '#8B5CF6', 
      text: '#5B21B6'
    },
    common: {
      success: '#059669',
      warning: '#F59E0B',
      error: '#DC2626',
      neutral: '#6B7280'
    }
  },
  
  // 타이포그래피
  typography: {
    timeSlot: {
      fontSize: 14,
      fontWeight: 700,
      lineHeight: 1.2
    },
    title: {
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1.2
    },
    subtitle: {
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 1.2
    },
    status: {
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1
    }
  },
  
  // 간격 및 크기
  spacing: {
    cardPadding: 8,
    cardMargin: 4,
    borderRadius: 6,
    borderWidth: 2
  },
  
  // 애니메이션
  animation: {
    transition: 'all 0.2s ease',
    hoverTransform: 'translateY(-1px)',
    dragOpacity: 0.7
  }
} as const;

// 타입 안정성을 위한 타입 정의
export type ColorScheme = keyof typeof DESIGN_TOKENS.colors;
export type TypographyVariant = keyof typeof DESIGN_TOKENS.typography;

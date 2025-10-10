// 📁 utils/cardStyleHelpers.ts
import { DESIGN_TOKENS, ColorScheme } from '../styles/designTokens';

export const getCardBaseStyle = (colorScheme: ColorScheme) => {
  const colors = DESIGN_TOKENS.colors[colorScheme];
  
  return {
    padding: DESIGN_TOKENS.spacing.cardPadding,
    marginBottom: DESIGN_TOKENS.spacing.cardMargin,
    borderRadius: DESIGN_TOKENS.spacing.borderRadius,
    border: `${DESIGN_TOKENS.spacing.borderWidth}px solid ${colors.border}`,
    backgroundColor: colors.secondary,
    color: colors.text,
    transition: DESIGN_TOKENS.animation.transition,
    cursor: 'pointer',
    position: 'relative' as const,
    overflow: 'hidden' as const
  };
};

export const getHoverStyle = () => ({
  transform: DESIGN_TOKENS.animation.hoverTransform,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
});

export const getDragStyle = () => ({
  opacity: DESIGN_TOKENS.animation.dragOpacity,
  transform: 'rotate(2deg)',
  zIndex: 1000
});

// 안전한 스타일 병합 함수
export const mergeStyles = (...styles: Array<React.CSSProperties | undefined>) => {
  return styles.reduce((acc, style) => {
    if (style) {
      return { ...acc, ...style };
    }
    return acc;
  }, {});
};

// 스케줄 관리 시스템 스타일 상수
export const SCHEDULE_STYLES = {
  // 학원별 색상 테마
  academyColors: {
    1: { bg: '#fff8e1', border: '#ffcc80', text: '#e65100', cardBg: '#fffde7' },
    2: { bg: '#f1f8e9', border: '#a5d6a7', text: '#2e7d32', cardBg: '#f9fbe7' },
    3: { bg: '#e8f4fd', border: '#90caf9', text: '#1565c0', cardBg: '#e3f2fd' },
    4: { bg: '#f3e5f5', border: '#ce93d8', text: '#7b1fa2', cardBg: '#fce4ec' },
    5: { bg: '#ffebee', border: '#ef9a9a', text: '#c62828', cardBg: '#ffebee' },
    6: { bg: '#e0f2f1', border: '#80cbc4', text: '#00695c', cardBg: '#e8f5e8' },
  },

  // 상태별 색상
  statusColors: {
    approved: { bg: '#e8f5e8', color: '#155724', text: '승인완료' },
    approval_requested: { bg: '#fff3cd', color: '#856404', text: '승인요청' },
    pending: { bg: '#f8d7da', color: '#721c24', text: '임시저장' },
    modification_requested: { bg: '#e3f2fd', color: '#1565c0', text: '수정요청' },
    cancellation_requested: { bg: '#fff3e0', color: '#e65100', text: '취소요청' },
    cancelled: { bg: '#f5f5f5', color: '#666', text: '취소됨' },
  },

  // 카드 스타일
  card: {
    borderRadius: 8,
    padding: 12,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease',
    hoverTransform: 'translateY(-2px)',
    hoverShadow: '0 4px 8px rgba(0,0,0,0.15)'
  },

  // 버튼 스타일
  button: {
    primary: {
      background: 'linear-gradient(135deg, #28a745, #20c997)',
      color: 'white',
      border: '2px solid #28a745',
      boxShadow: '0 4px 8px rgba(40, 167, 69, 0.3)'
    },
    secondary: {
      background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
      color: '#666',
      border: '1px solid #ddd',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }
  }
};

// 반응형 그리드 설정
export const GRID_CONFIG = {
  desktop: {
    locationColumn: '220px',
    minCellHeight: '120px',
    padding: '12px'
  },
  tablet: {
    locationColumn: '180px',
    minCellHeight: '100px',
    padding: '10px'
  },
  mobile: {
    locationColumn: '150px',
    minCellHeight: '80px',
    padding: '8px'
  }
};

// 애니메이션 설정
export const ANIMATIONS = {
  cardHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    transition: 'all 0.2s ease'
  },
  buttonHover: {
    transform: 'translateY(-1px)',
    transition: 'all 0.3s ease'
  },
  modalFadeIn: {
    animation: 'fadeIn 0.3s ease-out'
  }
};

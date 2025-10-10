// 학원별 색상 구분 테이블
export const academyColors: Record<number, {
  bg: string;
  border: string;
  text: string;
  card: string;
}> = {
  1: { bg: '#fff8e1', border: '#f57c00', text: '#e65100', card: '#fffde7' },
  2: { bg: '#f1f8e9', border: '#689f38', text: '#2e7d32', card: '#f9fbe7' },
  3: { bg: '#e8f4fd', border: '#1976d2', text: '#1565c0', card: '#e3f2fd' },
  4: { bg: '#f3e5f5', border: '#7b1fa2', text: '#6a1b9a', card: '#fce4ec' },
  5: { bg: '#ffebee', border: '#d32f2f', text: '#c62828', card: '#ffebee' },
  6: { bg: '#e0f2f1', border: '#00796b', text: '#00695c', card: '#e8f5e8' },
  7: { bg: '#fff3e0', border: '#f57c00', text: '#ef6c00', card: '#fff8e1' },
  8: { bg: '#fce4ec', border: '#c2185b', text: '#ad1457', card: '#f8bbd9' }
};

export const getAcademyColor = (mainLocationId: number) => {
  return academyColors[mainLocationId] || academyColors[1];
};

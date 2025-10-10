// src/utils/watermark.js
export const addWatermarkToImage = (imageFile, watermarkData) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // 캔버스 크기 설정
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 원본 이미지 그리기
      ctx.drawImage(img, 0, 0);
      
      // 워터마크 스타일 설정
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, img.height - 80, img.width, 80);
      
      // 텍스트 스타일
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      
      // 워터마크 텍스트 추가
      const dateText = `📅 ${watermarkData.date} ${watermarkData.time}`;
      const nameText = `👤 ${watermarkData.name}`;
      
      ctx.fillText(dateText, 20, img.height - 45);
      ctx.fillText(nameText, 20, img.height - 15);
      
      // Base64로 변환
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    };
    
    img.src = URL.createObjectURL(imageFile);
  });
};

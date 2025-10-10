const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <h2>멤버스 시스템</h2>
        <p>로딩 중...</p>
      </div>

      <style jsx>{`
        .loading-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: var(--bg-primary, #ffffff);
          color: var(--text-primary, #1e293b);
        }

        .loading-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--border-color, #e2e8f0);
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loading-content h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
        }

        .loading-content p {
          margin: 0;
          font-size: 14px;
          color: var(--text-secondary, #64748b);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;

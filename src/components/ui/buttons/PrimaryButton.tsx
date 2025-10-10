"use client";
import { ReactNode } from "react";

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

export default function PrimaryButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  size = 'md',
  type = 'button',
  fullWidth = false
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`primary-btn btn-${size} ${fullWidth ? 'full-width' : ''}`}
    >
      {loading ? (
        <span className="loading-content">
          <span className="spinner"></span>
          처리 중...
        </span>
      ) : (
        children
      )}

      <style jsx>{`
        .primary-btn {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: inherit;
        }

        .primary-btn:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .primary-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .primary-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btn-sm {
          padding: 8px 16px;
          font-size: 14px;
          min-height: 36px;
        }

        .btn-md {
          padding: 10px 20px;
          font-size: 16px;
          min-height: 44px;
        }

        .btn-lg {
          padding: 12px 24px;
          font-size: 18px;
          min-height: 52px;
        }

        .full-width {
          width: 100%;
        }

        .loading-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}

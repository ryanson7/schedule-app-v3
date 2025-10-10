"use client";
import { ReactNode } from "react";

interface SecondaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

export default function SecondaryButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  size = 'md',
  type = 'button',
  fullWidth = false
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`secondary-btn btn-${size} ${fullWidth ? 'full-width' : ''}`}
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
        .secondary-btn {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: inherit;
        }

        .secondary-btn:hover:not(:disabled) {
          background: #e5e7eb;
          border-color: #9ca3af;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .secondary-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .secondary-btn:disabled {
          background: #f9fafb;
          color: #9ca3af;
          border-color: #e5e7eb;
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
          border: 2px solid rgba(55, 65, 81, 0.3);
          border-top: 2px solid #374151;
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

"use client";
import { ReactNode } from "react";

interface GhostButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  variant?: 'default' | 'danger';
}

export default function GhostButton({
  children,
  onClick,
  disabled = false,
  size = 'md',
  type = 'button',
  fullWidth = false,
  variant = 'default'
}: GhostButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ghost-btn btn-${size} variant-${variant} ${fullWidth ? 'full-width' : ''}`}
    >
      {children}

      <style jsx>{`
        .ghost-btn {
          background: transparent;
          border: none;
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

        .variant-default {
          color: #6b7280;
        }

        .variant-default:hover:not(:disabled) {
          background: #f3f4f6;
          color: #374151;
        }

        .variant-danger {
          color: #dc2626;
        }

        .variant-danger:hover:not(:disabled) {
          background: #fef2f2;
          color: #b91c1c;
        }

        .ghost-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .ghost-btn:disabled {
          color: #d1d5db;
          cursor: not-allowed;
          transform: none;
        }

        .btn-sm {
          padding: 8px 12px;
          font-size: 14px;
          min-height: 36px;
        }

        .btn-md {
          padding: 10px 16px;
          font-size: 16px;
          min-height: 44px;
        }

        .btn-lg {
          padding: 12px 20px;
          font-size: 18px;
          min-height: 52px;
        }

        .full-width {
          width: 100%;
        }
      `}</style>
    </button>
  );
}

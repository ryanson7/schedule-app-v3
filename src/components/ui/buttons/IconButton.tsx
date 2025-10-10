"use client";
import { ReactNode } from "react";

interface IconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  variant?: 'default' | 'primary' | 'danger';
  ariaLabel?: string;
}

export default function IconButton({
  children,
  onClick,
  disabled = false,
  size = 'md',
  type = 'button',
  variant = 'default',
  ariaLabel
}: IconButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`icon-btn btn-${size} variant-${variant}`}
    >
      {children}

      <style jsx>{`
        .icon-btn {
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
        }

        .variant-default {
          background: #f3f4f6;
          color: #6b7280;
        }

        .variant-default:hover:not(:disabled) {
          background: #e5e7eb;
          color: #374151;
          transform: scale(1.05);
        }

        .variant-primary {
          background: #3b82f6;
          color: white;
        }

        .variant-primary:hover:not(:disabled) {
          background: #2563eb;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .variant-danger {
          background: #dc2626;
          color: white;
        }

        .variant-danger:hover:not(:disabled) {
          background: #b91c1c;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
        }

        .icon-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .icon-btn:disabled {
          background: #f9fafb;
          color: #d1d5db;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btn-sm {
          width: 32px;
          height: 32px;
          font-size: 14px;
        }

        .btn-md {
          width: 40px;
          height: 40px;
          font-size: 16px;
        }

        .btn-lg {
          width: 48px;
          height: 48px;
          font-size: 18px;
        }
      `}</style>
    </button>
  );
}

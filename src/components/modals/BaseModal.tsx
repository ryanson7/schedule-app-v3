"use client";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "small" | "medium" | "large";
  maxWidth?: string;
  children: React.ReactNode;
}

export const BaseModal = ({
  open,
  onClose,
  title,
  size = "medium",
  maxWidth,
  children
}: BaseModalProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    
    prevFocus.current = document.activeElement as HTMLElement;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    
    setTimeout(() => ref.current?.focus(), 100);

    const escListener = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", escListener);
    
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      prevFocus.current?.focus();
      document.removeEventListener("keydown", escListener);
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = maxWidth ?? (size === "small" ? "400px" : size === "large" ? "800px" : "600px");

  return createPortal(
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)"
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "92%",
          maxWidth: width,
          maxHeight: "85vh",
          overflow: "auto",
          border: "1px solid #e2e8f0",
          padding: 24,
          boxShadow: "0 10px 25px rgba(0,0,0,.15)",
          boxSizing: "border-box"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px solid #e2e8f0"
        }}>
          <h2 id="modal-title" style={{ 
            margin: 0, 
            fontSize: 20, 
            fontWeight: 700,
            color: "#1e293b"
          }}>
            {title}
          </h2>
          <button
            aria-label="모달 닫기"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 24,
              cursor: "pointer",
              color: "#64748b",
              padding: 4,
              borderRadius: 4
            }}
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
};

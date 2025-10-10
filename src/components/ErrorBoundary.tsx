// 📁 components/ErrorBoundary.tsx
"use client";
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ScheduleCardErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('스케줄 카드 렌더링 오류:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 8,
          backgroundColor: '#FEE2E2',
          border: '2px solid #DC2626',
          borderRadius: 6,
          color: '#991B1B',
          fontSize: 12,
          textAlign: 'center'
        }}>
          카드 로딩 오류
        </div>
      );
    }

    return this.props.children;
  }
}

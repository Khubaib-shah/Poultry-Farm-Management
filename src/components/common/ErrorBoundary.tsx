import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Something unexpected happened.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('App ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F2F4F4] dark:bg-[#0F1113] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-[24px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#14161A] dark:text-[#F2F4F5]">
                Something went wrong
              </h2>
              <p className="text-xs text-[#636B76] dark:text-[#8A929C] mt-1">
                {this.state.errorMessage}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D4F56B] text-[#14161A] text-xs font-bold hover:bg-[#C9EE55] transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

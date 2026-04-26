import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || "Something went wrong. Please try again later.";
      let isFirebaseError = false;
      let detailedError = "";

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Database Error: ${parsed.operationType} failed`;
            detailedError = parsed.error;
            isFirebaseError = true;
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-red-100 text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-app-text-main">Oops! Something went wrong</h2>
              <div className="space-y-1">
                <p className="text-sm text-app-text-muted leading-relaxed">
                  {errorMessage}
                </p>
                {detailedError && (
                  <p className="text-xs text-red-400 font-mono bg-red-50 p-2 rounded-lg break-all">
                    {detailedError}
                  </p>
                )}
              </div>
              {isFirebaseError && (
                <p className="text-[10px] text-red-400 mt-2 italic">
                  This might be due to missing permissions or a configuration issue.
                </p>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-app-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

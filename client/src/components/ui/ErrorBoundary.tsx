import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Evidra UI Crash Caught by ErrorBoundary]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 mb-4 shadow-xl shadow-rose-950/40">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mb-2">
            {this.props.fallbackTitle || 'Unable to display this view'}
          </h2>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {this.props.fallbackMessage ||
              this.state.error?.message ||
              'A rendering error occurred while displaying this page. Please try refreshing or return to the overview.'}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Refresh Page
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Home className="w-4 h-4" />}
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/student/dashboard';
              }}
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


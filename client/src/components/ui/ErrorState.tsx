import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface ErrorStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  icon,
  title = 'Something went wrong',
  message = 'An unexpected error occurred while fetching data. Please try again.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-rose-900/30 bg-rose-950/10',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-900/20 border border-rose-700/40 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-900/10">
        {icon || <AlertCircle className="w-6 h-6 text-rose-400" />}
      </div>
      <h3 className="text-base font-semibold text-rose-200 tracking-tight">{title}</h3>
      <p className="text-sm text-rose-300/70 max-w-sm mt-1.5 leading-relaxed">{message}</p>
      {onRetry && (
        <div className="mt-6">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={onRetry}
            className="border-rose-800/50 hover:bg-rose-900/30 text-rose-200"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};

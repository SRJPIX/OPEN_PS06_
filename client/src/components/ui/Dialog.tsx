import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Dialog Modal Surface */}
      <div
        ref={dialogRef}
        className={cn(
          'relative w-full rounded-2xl bg-[#0b1329] border border-slate-800 p-6 text-slate-100 shadow-2xl shadow-black/50',
          'transition-all duration-200 animate-in fade-in zoom-in-95',
          maxWidthMap[maxWidth]
        )}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        {(title || description) && (
          <div className="mb-5 pr-6">
            {title && (
              <h3 className="text-lg font-semibold text-white tracking-tight leading-snug">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1 text-sm text-slate-400 leading-relaxed">{description}</p>
            )}
          </div>
        )}

        {/* Body */}
        <div className="text-sm text-slate-200">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};


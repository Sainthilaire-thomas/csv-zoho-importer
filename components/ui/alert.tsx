// components/ui/alert.tsx
import { type HTMLAttributes, forwardRef } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const variantStyles: Record<AlertVariant, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
};

const iconMap: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className = '',
      variant = 'info',
      title,
      dismissible = false,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    const Icon = iconMap[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={`
          relative flex gap-3 p-4 rounded-lg border
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {title && (
            <h5 className="font-medium mb-1">{title}</h5>
          )}
          <div className="text-sm opacity-90">{children}</div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

// Alert inline (plus compact, pour les champs de formulaire)
interface AlertInlineProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

export const AlertInline = forwardRef<HTMLDivElement, AlertInlineProps>(
  ({ className = '', variant = 'error', children, ...props }, ref) => {
    const Icon = iconMap[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={`
          flex items-center gap-1.5 text-sm
          ${variant === 'error' ? 'text-red-600 dark:text-red-400' : ''}
          ${variant === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : ''}
          ${variant === 'success' ? 'text-green-600 dark:text-green-400' : ''}
          ${variant === 'info' ? 'text-blue-600 dark:text-blue-400' : ''}
          ${className}
        `}
        {...props}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{children}</span>
      </div>
    );
  }
);

AlertInline.displayName = 'AlertInline';

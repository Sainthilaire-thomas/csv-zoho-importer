// components/ui/progress.tsx
'use client';

import { type HTMLAttributes, forwardRef } from 'react';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  animated?: boolean;
}

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const variantStyles = {
  default: 'bg-blue-600 dark:bg-blue-500',
  success: 'bg-green-600 dark:bg-green-500',
  warning: 'bg-yellow-500 dark:bg-yellow-400',
  danger: 'bg-red-600 dark:bg-red-500',
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className = '',
      value,
      max = 100,
      size = 'md',
      variant = 'default',
      showLabel = false,
      animated = false,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div ref={ref} className={className} {...props}>
        {showLabel && (
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progression
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
        <div
          className={`
            w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden
            ${sizeStyles[size]}
          `}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={`
              ${sizeStyles[size]}
              ${variantStyles[variant]}
              rounded-full
              transition-all duration-300 ease-out
              ${animated ? 'animate-pulse' : ''}
            `}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

// Progress avec étapes (pour le wizard)
interface Step {
  id: string;
  label: string;
}

interface StepProgressProps extends HTMLAttributes<HTMLDivElement> {
  steps: Step[];
  currentStep: number;
  variant?: 'dots' | 'line';
}

export const StepProgress = forwardRef<HTMLDivElement, StepProgressProps>(
  (
    {
      className = '',
      steps,
      currentStep,
      variant = 'dots',
      ...props
    },
    ref
  ) => {
    if (variant === 'line') {
      return (
        <div ref={ref} className={className} {...props}>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      transition-colors duration-200
                      ${
                        index < currentStep
                          ? 'bg-blue-600 text-white dark:bg-blue-500'
                          : index === currentStep
                          ? 'bg-blue-600 text-white dark:bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900'
                          : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }
                    `}
                  >
                    {index < currentStep ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`
                      mt-2 text-xs font-medium
                      ${
                        index <= currentStep
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-500 dark:text-gray-400'
                      }
                    `}
                  >
                    {step.label}
                  </span>
                </div>
                {/* Connecting line */}
                {index < steps.length - 1 && (
                  <div
                    className={`
                      flex-1 h-0.5 mx-4 -mt-6
                      ${
                        index < currentStep
                          ? 'bg-blue-600 dark:bg-blue-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }
                    `}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Variant: dots (default)
    return (
      <div ref={ref} className={`flex items-center justify-center gap-2 ${className}`} {...props}>
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`
              w-2.5 h-2.5 rounded-full transition-all duration-200
              ${
                index < currentStep
                  ? 'bg-blue-600 dark:bg-blue-500'
                  : index === currentStep
                  ? 'bg-blue-600 dark:bg-blue-500 w-6'
                  : 'bg-gray-300 dark:bg-gray-600'
              }
            `}
            title={step.label}
          />
        ))}
      </div>
    );
  }
);

StepProgress.displayName = 'StepProgress';

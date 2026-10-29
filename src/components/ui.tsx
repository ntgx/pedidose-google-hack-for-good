import React from 'react';

// Shared presentational primitives so every view uses the same visual language.

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'trial';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  info: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-300',
  danger: 'bg-rose-50 text-rose-800 border-rose-300',
  trial: 'bg-purple-50 text-purple-800 border-purple-300',
};

export const Badge: React.FC<{
  tone?: Tone;
  mono?: boolean;
  title?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', mono, title, className = '', children }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${
      mono ? 'font-mono' : ''
    } ${BADGE_TONES[tone]} ${className}`}
  >
    {children}
  </span>
);

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children,
}) => (
  <div className={`bg-white rounded-xl border border-slate-200 p-4 sm:p-5 ${className}`}>
    {children}
  </div>
);

export const SectionTitle: React.FC<{
  step?: number;
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ step, title, hint, action }) => (
  <div className="flex items-start justify-between gap-3 mb-3">
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {step !== undefined && (
          <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center">
            {step}
          </span>
        )}
        {title}
      </h3>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
    {action}
  </div>
);

const ALERT_TONES: Record<Tone, { box: string; icon: string }> = {
  neutral: { box: 'bg-slate-50 border-slate-300 text-slate-900', icon: 'text-slate-500' },
  info: { box: 'bg-sky-50 border-sky-300 text-sky-950', icon: 'text-sky-600' },
  success: { box: 'bg-emerald-50 border-emerald-300 text-emerald-950', icon: 'text-emerald-600' },
  warning: { box: 'bg-amber-50 border-amber-300 text-amber-950', icon: 'text-amber-600' },
  danger: { box: 'bg-rose-50 border-rose-400 text-rose-950', icon: 'text-rose-600' },
  trial: { box: 'bg-purple-50 border-purple-300 text-purple-950', icon: 'text-purple-600' },
};

export const Alert: React.FC<{
  tone: Tone;
  icon: React.FC<{ className?: string }>;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  details?: React.ReactNode;
  onDismiss?: () => void;
}> = ({ tone, icon: Icon, title, children, action, details, onDismiss }) => (
  <div className={`p-3 rounded-lg border-l-4 border ${ALERT_TONES[tone].box}`}>
    <div className="flex items-start gap-2.5">
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${ALERT_TONES[tone].icon}`} />
      <div className="flex-1 text-xs leading-relaxed">
        <div className="text-sm font-semibold">{title}</div>
        {children && <div className="mt-0.5 text-sm opacity-90">{children}</div>}
        {details && (
          <details className="mt-1.5">
            <summary className="cursor-pointer select-none opacity-70 hover:opacity-100">
              Full guidance
            </summary>
            <div className="mt-1 opacity-80">{details}</div>
          </details>
        )}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  </div>
);

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
  }
> = ({ variant = 'secondary', size = 'sm', className = '', children, ...rest }) => {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    danger: 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-300',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ id: T; label: string; icon?: React.FC<{ className?: string }>; badge?: React.ReactNode }>;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
      {items.map(({ id, label, icon: Icon, badge }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            value === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
          {badge}
        </button>
      ))}
    </div>
  );
}

export const CountPill: React.FC<{ tone?: 'amber' | 'rose' | 'slate'; children: React.ReactNode }> = ({
  tone = 'slate',
  children,
}) => {
  const tones = {
    amber: 'bg-amber-100 text-amber-900',
    rose: 'bg-rose-100 text-rose-800',
    slate: 'bg-slate-200 text-slate-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
};

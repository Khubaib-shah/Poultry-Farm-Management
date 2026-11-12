import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    variant: 'positive' | 'negative' | 'neutral' | 'warning';
  };
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  highlight = false,
}) => {
  const badgeClasses = {
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    negative: 'bg-rose-50 text-rose-700 border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <div
      className={`bg-white border rounded-md p-4 transition-all ${
        highlight
          ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-xl font-bold text-slate-900 tracking-tight">
          {value}
        </div>
        {badge && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
              badgeClasses[badge.variant]
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-[11px] text-slate-500 leading-normal">
          {subtitle}
        </p>
      )}
    </div>
  );
};

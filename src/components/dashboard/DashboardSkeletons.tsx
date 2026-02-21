import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const TopStatsBarSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="glass-card rounded-xl p-4 border border-border animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-2.5 w-16 bg-muted" />
          <Skeleton className="h-7 w-7 rounded-lg bg-muted" />
        </div>
        <Skeleton className="h-7 w-14 bg-muted mb-1" />
        <Skeleton className="h-2 w-20 bg-muted" />
      </div>
    ))}
  </div>
);

export const BarChartSkeleton = () => (
  <div className="glass-card rounded-xl p-5 border border-border animate-fade-in">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-4 w-48 bg-muted" />
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-14 rounded bg-muted" />
        ))}
      </div>
    </div>
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2" style={{ animationDelay: `${i * 60}ms` }}>
          <Skeleton className="h-3 w-28 bg-muted" />
          <Skeleton className="h-5 flex-1 rounded bg-muted" style={{ maxWidth: `${90 - i * 8}%` }} />
        </div>
      ))}
    </div>
  </div>
);

export const DonutChartSkeleton = () => (
  <div className="glass-card rounded-xl p-5 border border-border animate-fade-in">
    <Skeleton className="h-4 w-36 bg-muted mb-4" />
    <div className="flex items-center justify-center h-[220px]">
      <div className="relative">
        <Skeleton className="h-[180px] w-[180px] rounded-full bg-muted" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-[100px] w-[100px] rounded-full bg-background" />
        </div>
      </div>
    </div>
    <div className="flex justify-center gap-4 mt-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-16 bg-muted" />
      ))}
    </div>
  </div>
);

export const TrendChartSkeleton = () => (
  <div className="glass-card rounded-xl p-5 border border-border animate-fade-in">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-4 w-52 bg-muted" />
      <Skeleton className="h-4 w-20 bg-muted" />
    </div>
    <div className="h-[220px] flex items-end gap-1 px-4">
      {Array.from({ length: 20 }).map((_, i) => (
        <Skeleton key={i} className="flex-1 bg-muted rounded-t" style={{ height: `${30 + Math.sin(i * 0.5) * 40 + 30}%` }} />
      ))}
    </div>
  </div>
);

export const OrgCardSkeleton = () => (
  <div className="glass-card rounded-xl p-4 border border-border animate-fade-in">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-36 bg-muted mb-1" />
        <Skeleton className="h-2.5 w-28 bg-muted" />
      </div>
      <Skeleton className="h-7 w-10 rounded bg-muted" />
    </div>
    <Skeleton className="h-4 w-16 rounded bg-muted mb-3" />
    <div className="flex gap-3">
      <Skeleton className="w-20 h-12 rounded bg-muted" />
      <div className="flex-1 grid grid-cols-2 gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full bg-muted" />
        ))}
      </div>
    </div>
    <Skeleton className="h-1.5 w-full rounded-full bg-muted mt-3" />
    <div className="flex gap-3 mt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-10 bg-muted" />
      ))}
    </div>
  </div>
);

export const OrgGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} style={{ animationDelay: `${i * 100}ms` }}>
        <OrgCardSkeleton />
      </div>
    ))}
  </div>
);

export const HeatMapSkeleton = () => (
  <div className="glass-card rounded-xl border border-border overflow-hidden animate-fade-in">
    <div className="p-4 border-b border-border">
      <Skeleton className="h-4 w-28 bg-muted" />
    </div>
    <div className="p-3 space-y-2">
      <div className="flex gap-2">
        <Skeleton className="h-4 w-32 bg-muted" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-10 bg-muted" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="h-7 w-32 bg-muted" />
          {Array.from({ length: 8 }).map((_, j) => (
            <Skeleton key={j} className="h-7 w-10 rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

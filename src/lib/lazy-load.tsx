'use client'

/**
 * Lazy loading utilities for code splitting
 * Helps reduce initial bundle size by loading components on demand
 */

import { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Lazy load component with skeleton fallback
 */
export function createLazyLoad<P extends object>(
  componentPath: string,
  fallback?: React.ComponentType<P>
) {
  const LazyComponent = lazy(() => import(componentPath));

  const WrappedComponent = (props: P) => (
    <Suspense fallback={fallback ? <fallback {...props} /> : <Skeleton className="w-full h-24" />}>
      <LazyComponent {...props} />
    </Suspense>
  );

  return WrappedComponent;
}

/**
 * Predefined lazy-loaded components for heavy UI elements
 */
export const LazyReportsDashboard = createLazyLoad('@/components/reports-dashboard');
export const LazyPosInterface = createLazyLoad('@/components/pos-interface');
export const LazyAdvancedAnalytics = createLazyLoad('@/components/advanced-analytics');
export const LazyCustomerManagement = createLazyLoad('@/components/customer-management');
export const LazyMenuManagement = createLazyLoad('@/components/menu-management');
export const LazyInventoryManagement = createLazyLoad('@/components/inventory-management');
export const LazyShiftManagement = createLazyLoad('@/components/shift-management');
export const LazyUserManagement = createLazyLoad('@/components/user-management');
export const LazyBranchManagement = createLazyLoad('@/components/branch-management');
export const LazyRecipeManagement = createLazyLoad('@/components/recipe-management');
export const LazyDeliveryManagement = createLazyLoad('@/components/delivery-management');
export const LazyCourierManagement = createLazyLoad('@/components/courier-management');
export const LazyCostManagement = createLazyLoad('@/components/cost-management');
export const LazyIngredientManagement = createLazyLoad('@/components/ingredient-management');

/**
 * Custom skeleton loaders for different component types
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-4 p-4 border rounded">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="grid grid-cols-4 gap-4 p-4 border rounded">
          {[...Array(4)].map((_, j) => (
            <Skeleton key={j} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <Skeleton className="h-6 w-3/4 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );
}

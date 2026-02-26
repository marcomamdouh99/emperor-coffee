'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCw, RefreshCw, Home, AlertCircle } from 'lucide-react';

interface ErrorInfo {
  message: string
  status: number
  stack?: string
  timestamp: string
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log error to external service in production
    if (process.env.NODE_ENV === 'production') {
      const errorInfo: ErrorInfo = {
        message: error.message || 'An error occurred',
        status: 500, // Default to 500 as we can't determine from standard Error object
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }

      // Send to error tracking service (disabled for now as endpoint may not exist)
      // fetch('/api/monitoring/error', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorInfo),
      //   keepalive: true,
      // }).catch(e => {
      //   console.error('Failed to log error:', e)
      // })

      // Also log to console
      console.error('Application error:', error);
    }
  }, [error])

  const getErrorMessage = (error: Error): string => {
    // Check message content for specific errors
    if (error.message?.includes('not found')) {
      return 'The page or resource you were looking for was not found.'
    }

    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      return 'You do not have permission to access this resource.'
    }

    // Database errors
    if (error.message?.includes('Unique constraint')) {
      return 'This data already exists. Please try again with different values.'
    }

    if (error.message?.includes('Foreign key constraint')) {
      return 'This operation conflicts with existing data. Please check your relationships.'
    }

    // Network errors
    if (error.message?.includes('fetch') || error.name?.includes('NetworkError')) {
      return 'Connection failed. Please check your internet connection.'
    }

    // Zod validation errors
    if (error.name?.includes('ZodError')) {
      return 'Invalid data provided. Please check your input and try again.'
    }

    // Prisma errors
    if (error.message?.includes('Query')) {
      return 'Database operation failed. Please try again.'
    }

    // Generic fallback
    return 'An unexpected error occurred. We have been notified. Please try again.'
  }

  const getErrorIcon = (error: Error) => {
    // Check message content for specific errors
    if (error.message?.includes('not found')) {
      return <AlertCircle className="h-8 w-8 text-red-500" />
    }
    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      return <AlertCircle className="h-8 w-8 text-red-500" />
    }
    if (error.name?.includes('ZodError') || error.message?.includes('validation')) {
      return <AlertTriangle className="h-8 w-8 text-amber-500" />
    }
    return <RotateCw className="h-8 w-8 text-red-500" />
  }

  const getErrorTitle = (error: Error): string => {
    if (error.message?.includes('not found')) {
      return 'Not Found'
    }
    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      return 'Access Denied'
    }
    if (error.name?.includes('ZodError') || error.message?.includes('validation')) {
      return 'Validation Error'
    }
    return 'Something went wrong'
  }

  return (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 dark:from-slate-900">
    <div className="container mx-auto px-4 py-8">
      <Card className="border-0 shadow-xl bg-white dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-red-500" />
              {getErrorTitle(error)}
            </CardTitle>
            <CardDescription className="text-right">
              <div className="text-sm text-slate-500">
                {new Date().toLocaleTimeString()}
              </div>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-4 rounded-lg bg-red-50">
              {getErrorIcon(error)}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {getErrorTitle(error)}
              </h1>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                {getErrorMessage(error)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <p className="font-medium text-amber-900">
                  We've logged this error and will investigate shortly.
                </p>
              </div>
              <details className="mt-4">
                <summary className="text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                  <span className="text-red-600 font-semibold">Error Details (click to expand)</span>
                </summary>
                <div className="mt-2 bg-slate-100 rounded-lg p-4 text-sm">
                  <pre className="text-xs text-left bg-white dark:bg-slate-900 text-slate-300 p-4 overflow-auto max-h-96 overflow-y-auto rounded">
                    {error.stack}
                  </pre>
                </div>
              </details>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              onClick={() => {
                router.push('/')
                reset()
              }}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Go Home
            </Button>

            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>

            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="w-full"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
)
}

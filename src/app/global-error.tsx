'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log critical errors
    console.error('Global application error:', error);
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-100 to-red-200">
          <div className="max-w-md w-full mx-4">
            <div className="bg-white rounded-lg shadow-2xl p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-4">
                  <svg
                    className="w-10 h-10 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Critical System Error
                </h1>
                <p className="text-slate-600">
                  A critical error has occurred. Our technical team has been notified.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    router.push('/')
                    reset()
                  }}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Return to Home
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  Reload Page
                </button>
              </div>

              {error.digest && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-xs text-slate-500 text-center">
                    Error ID: {error.digest}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

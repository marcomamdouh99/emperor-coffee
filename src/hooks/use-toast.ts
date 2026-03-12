/**
 * Simple toast wrapper around sonner for easy use
 */

'use client'

import { toast as sonner } from 'sonner'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default'

export function showToast(
  title: string,
  message?: string,
  type: ToastType = 'default'
) {
  sonner(type, {
    title,
    description: message || title,
    action: {
      label: 'Dismiss',
      onClick: () => {},
      className: 'cursor-pointer'
    },
  })
}

export function showSuccessToast(title: string, message: string) {
  showToast(title, message, 'success')
}

export function showErrorToast(title: string, message: string) {
  showToast(title, message, 'error')
}

export function showWarningToast(title: string, message: string) {
  showToast(title, message, 'warning')
}

export function showInfoToast(title: string, message: string) {
  showToast(title, message, 'info')
}

export function showLoadingToast(message: string) {
  const toast = sonner.loading({
    description: message,
    duration: 3000, // 3 seconds
  })
  return toast
}

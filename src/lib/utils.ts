import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined, currency: string = 'EGP'): string {
  if (amount == null || amount === undefined || isNaN(amount)) {
    return `${currency} 0.00`;
  }
  return `${currency} ${amount.toFixed(2)}`;
}

export function getCurrencySymbol(currency: string = 'EGP'): string {
  return currency;
}

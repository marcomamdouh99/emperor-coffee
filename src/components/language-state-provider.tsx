'use client';

import { useEffect } from 'react';

export function LanguageStateProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // This component is now a wrapper but the html tag stays in layout.tsx
    // We'll let the I18nProvider handle the language state and html updates
  }, []);

  return <>{children}</>;
}

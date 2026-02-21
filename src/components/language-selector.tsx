'use client';

import { Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/i18n-context';

export default function LanguageSelector() {
  const { language, setLanguage } = useI18n();

  const languages = [
    { code: 'en', name: 'English', dir: 'ltr' },
    { code: 'ar', name: 'العربية', dir: 'rtl' },
  ];

  const currentLang = languages.find(l => l.code === language);

  return (
    <Select value={language} onValueChange={setLanguage}>
      <SelectTrigger className="w-40 border-[#C7A35A]/30 focus:border-[#C7A35A]">
        <Globe className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <div className="flex items-center gap-2">
              <span>{lang.name}</span>
              {lang.code === 'ar' && (
                <span className="text-xs text-[#C7A35A]">← RTL</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

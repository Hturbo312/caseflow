import { useMemo } from 'react';
import { useAuthStore } from '@store';
import { zh, en } from './translations';
import { v2zh, v2en } from './translations.v2';

const dictionaries = {
  zh: { ...zh, ...v2zh },
  en: { ...en, ...v2en },
};

export function useI18n() {
  const locale = useAuthStore((s) => s.locale);
  const setLocale = useAuthStore((s) => s.setLocale);

  const t = useMemo(() => {
    const dict = dictionaries[locale] || dictionaries.zh;
    return (key, params) => {
      let str = dict[key] || key;
      if (params) {
        Object.keys(params).forEach((k) => {
          str = str.replace(`{${k}}`, params[k]);
        });
      }
      return str;
    };
  }, [locale]);

  return { t, locale, setLocale, dictionaries };
}

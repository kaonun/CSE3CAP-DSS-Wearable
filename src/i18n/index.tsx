import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';

import { ar } from './locales/ar';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { tr } from './locales/tr';
import { vi } from './locales/vi';
import { zh } from './locales/zh';
import { LANGUAGES, RTL_LANGUAGES, type Language, type LanguageMeta, type Messages } from './types';

export { LANGUAGES, type Language, type LanguageMeta, type Messages };

const STORAGE_KEY = 'dss.language';

const catalogue: Record<Language, Messages> = {
  en, es, fr, de, it, pt, nl, tr, pl, ru, ar, hi, zh, ja, ko, vi, id,
};

const supported = new Set<string>(LANGUAGES.map(item => item.code));

function isLanguage(value: string | null | undefined): value is Language {
  return !!value && supported.has(value);
}

/** Picks the best supported language for the device, falling back to English. */
function detectDeviceLanguage(): Language {
  for (const locale of getLocales()) {
    // `languageCode` is the bare tag ("pt" from "pt-BR"), which is what we key on.
    if (isLanguage(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Messages;
  /** True while the stored preference is still being read. */
  loading: boolean;
  isRTL: boolean;
  languages: readonly LanguageMeta[];
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (!active) return;
        setLanguageState(isLanguage(stored) ? stored : detectDeviceLanguage());
      })
      .catch(() => {
        if (active) setLanguageState(detectDeviceLanguage());
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const isRTL = RTL_LANGUAGES.includes(language);

  useEffect(() => {
    // Mirroring the whole layout tree requires a native reload, which would be
    // hostile mid-session. We instead flag RTL so text-level styling can adapt,
    // and let the next cold start pick up the native direction.
    if (I18nManager.isRTL !== isRTL) I18nManager.allowRTL(isRTL);
  }, [isRTL]);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      t: catalogue[language],
      loading,
      isRTL,
      languages: LANGUAGES,
    }),
    [language, setLanguage, loading, isRTL],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

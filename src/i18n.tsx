import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'zh' | 'ja' | 'ko' | 'hi';

type Messages = {
  settings: string;
  settingsSubtitle: string;
  language: string;
  languageDescription: string;
  english: string;
  spanish: string;
  account: string;
  signInPrompt: string;
  connection: string;
  ready: string;
  searching: string;
  connecting: string;
  active: string;
  connectionError: string;
  signal: string;
  nearbyDevices: string;
  connected: string;
  notConnected: string;
  scanForWearables: string;
  disconnect: string;
  languageNames: Record<Language, string>;
};

const messages = {
  en: {
    settings: 'Settings',
    settingsSubtitle: 'Personalise your DSS Wearable experience.',
    language: 'Language',
    languageDescription: 'Choose the language used throughout the app.',
    english: 'English',
    spanish: 'Spanish',
    account: 'Account',
    signInPrompt: 'Authentication will be available here.',
    connection: 'Connection',
    ready: 'Ready',
    searching: 'Searching nearby',
    connecting: 'Connecting',
    active: 'Active',
    connectionError: 'Connection error',
    signal: 'Signal',
    nearbyDevices: 'Nearby devices',
    connected: 'Connected',
    notConnected: 'Not connected',
    scanForWearables: 'Scan for wearables',
    disconnect: 'Disconnect',
    languageNames: { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', hi: 'Hindi' },
  },
  es: {
    settings: 'Configuracion',
    settingsSubtitle: 'Personaliza tu experiencia DSS Wearable.',
    language: 'Idioma',
    languageDescription: 'Elige el idioma que se usa en la aplicacion.',
    english: 'Ingles',
    spanish: 'Espanol',
    account: 'Cuenta',
    signInPrompt: 'La autenticacion estara disponible aqui.',
    connection: 'Conexion',
    ready: 'Listo',
    searching: 'Buscando cerca',
    connecting: 'Conectando',
    active: 'Activo',
    connectionError: 'Error de conexion',
    signal: 'Senal',
    nearbyDevices: 'Dispositivos cercanos',
    connected: 'Conectado',
    notConnected: 'Sin conexion',
    scanForWearables: 'Buscar wearables',
    disconnect: 'Desconectar',
    languageNames: { en: 'Ingles', es: 'Espanol', fr: 'Frances', de: 'Aleman', it: 'Italiano', pt: 'Portugues', zh: 'Chino', ja: 'Japones', ko: 'Coreano', hi: 'Hindi' },
  },
} as unknown as Record<Language, Messages>;

for (const language of ['fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'hi'] as const) {
  messages[language] = {...messages.en, languageNames: messages.en.languageNames};
}

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Messages;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem('dss-language').then(value => {
      if (value && value in messages) setLanguageState(value as Language);
    });
  }, []);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    void AsyncStorage.setItem('dss-language', nextLanguage);
  };

  return <I18nContext.Provider value={{ language, setLanguage, t: messages[language] }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

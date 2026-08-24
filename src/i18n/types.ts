/** Every user-facing string in the app. `en` is the canonical source. */
export type Messages = {
  // Generic
  done: string;
  cancel: string;
  search: string;
  or: string;
  // Authentication
  signIn: string;
  signInSubtitle: string;
  createAccount: string;
  createAccountSubtitle: string;
  email: string;
  password: string;
  forgotPassword: string;
  resetPassword: string;
  resetSubtitle: string;
  sendResetLink: string;
  resetEmailSent: string;
  continueWithGoogle: string;
  needAccount: string;
  haveAccount: string;
  signOut: string;
  pleaseWait: string;
  backToSignIn: string;
  notConfigured: string;
  // Authentication errors
  errInvalidCredentials: string;
  errEmailInUse: string;
  errWeakPassword: string;
  errInvalidEmail: string;
  errTooManyRequests: string;
  errNetwork: string;
  errGeneric: string;
  errEmptyFields: string;
  // Home / wearable
  wearable: string;
  homeSubtitle: string;
  connection: string;
  signal: string;
  ready: string;
  searching: string;
  connecting: string;
  active: string;
  connectionError: string;
  bluetooth: string;
  nearbyDevices: string;
  connected: string;
  notConnected: string;
  scanForWearables: string;
  disconnect: string;
  connect: string;
  noLiveReading: string;
  bpm: string;
  nfc: string;
  quickConnect: string;
  notScanned: string;
  waitingForTag: string;
  tagReady: string;
  readFailed: string;
  readNfcTag: string;
  cancelNfcSearch: string;
  connectTagDevice: string;
  nfcHelp: string;
  recentActivity: string;
  connectedDevices: string;
  bluetoothWearable: string;
  // Settings
  settings: string;
  settingsSubtitle: string;
  language: string;
  languageDescription: string;
  account: string;
  signInPrompt: string;
  about: string;
  version: string;
};

export type Language =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'nl'
  | 'tr'
  | 'pl'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'vi'
  | 'id';

export type LanguageMeta = {
  code: Language;
  /** Shown in the picker — always in the language's own script. */
  nativeName: string;
  /** Shown as the secondary line, in English, to aid recovery if a user
   *  picks a script they cannot read. */
  englishName: string;
  rtl?: boolean;
};

/** Ordered by native name so the picker reads naturally. */
export const LANGUAGES: readonly LanguageMeta[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', rtl: true },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish' },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'zh', nativeName: '简体中文', englishName: 'Chinese (Simplified)' },
] as const;

export const RTL_LANGUAGES: readonly Language[] = LANGUAGES.filter(item => item.rtl).map(
  item => item.code,
);

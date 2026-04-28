export type ThemePreference = 'system' | 'light' | 'dark';

// Minimal config shape for future TS usage (standalone JSON settings).
export interface AppConfig {
  theme?: ThemePreference;
  startMinimized?: boolean;
}


import { defineStore } from 'pinia'
import { ref, watch, Ref } from 'vue'

const SETTINGS_KEY = 'c2s_app_settings'

 interface AppSettings {
  authMethods: {
    oauth2: boolean
    bearer: boolean
  }
  oauth2Defaults: {
    clientName: string
    scopes: string
  }
  /** When true, each OAuth2 step runs automatically once its prerequisites are satisfied. */
  oauth2AutoRun: boolean
  /** Theme preference: 'light', 'dark', or 'system' */
  theme: 'light' | 'dark' | 'system'
}

const DEFAULT_SETTINGS: AppSettings = {
  authMethods: {
    oauth2: true,
    bearer: false,
  },
  oauth2Defaults: {
    clientName: 'ActivityPub C2S Client',
    scopes: 'read write follow',
  },
  oauth2AutoRun: true,
  theme: 'system',
}

export const useSettingsStore = defineStore('settings', () => {
  const settings: Ref<AppSettings> = ref(loadSettings())
  const isDark: Ref<boolean> = ref(false)

  function loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>
        // Deep-merge with defaults so future fields always have fallback values
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          authMethods: {
            ...DEFAULT_SETTINGS.authMethods,
            ...(parsed.authMethods ?? {}),
          },
          oauth2Defaults: {
            ...DEFAULT_SETTINGS.oauth2Defaults,
            ...(parsed.oauth2Defaults ?? {}),
          },
          oauth2AutoRun: parsed.oauth2AutoRun ?? DEFAULT_SETTINGS.oauth2AutoRun,
          theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
        }
      }
    } catch (e) {
      console.error('Failed to load app settings from localStorage:', e)
    }
    return { 
      ...DEFAULT_SETTINGS, 
      authMethods: { ...DEFAULT_SETTINGS.authMethods },
      oauth2Defaults: { ...DEFAULT_SETTINGS.oauth2Defaults },
    }
  }

  function determineIsDark(): boolean {
    if (settings.value.theme === 'dark') {
      return true
    } else if (settings.value.theme === 'light') {
      return false
    } else {
      // 'system' - use system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  }

  function applyTheme(): void {
    isDark.value = determineIsDark()
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function persistSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
    } catch (e) {
      console.error('Failed to persist app settings to localStorage:', e)
    }
  }

  function setAuthMethod(method: 'oauth2' | 'bearer', enabled: boolean): void {
    // At least one method must remain enabled
    const other = method === 'oauth2' ? 'bearer' : 'oauth2'
    if (!enabled && !settings.value.authMethods[other]) {
      return
    }
    settings.value.authMethods[method] = enabled
  }

  function setOAuth2Defaults(clientName: string, scopes: string): void {
    settings.value.oauth2Defaults.clientName = clientName
    settings.value.oauth2Defaults.scopes = scopes
  }

  function setOAuth2AutoRun(enabled: boolean): void {
    settings.value.oauth2AutoRun = enabled
  }

  function toggleTheme(): void {
    // Cycle through: light -> dark -> light (no system mode in toggle)
    settings.value.theme = settings.value.theme === 'dark' ? 'light' : 'dark'
    applyTheme()
  }

  // Persist whenever settings change
  watch(settings, persistSettings, { deep: true })

  // Watch for theme changes to apply them
  watch(() => settings.value.theme, applyTheme)

  // Initialize theme on store creation
  applyTheme()

  return {
    settings,
    isDark,
    setAuthMethod,
    setOAuth2Defaults,
    setOAuth2AutoRun,
    toggleTheme,
  }
})

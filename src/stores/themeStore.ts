import { defineStore } from 'pinia'
import { ref, watch, Ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // Initialize from localStorage or system preference
  const isDark: Ref<boolean> = ref(false)

  // STUB: Load theme preference from localStorage
  function loadTheme(): void {
    const stored = localStorage.getItem('theme')
    if (stored) {
      isDark.value = stored === 'dark'
    } else {
      // Use system preference
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyTheme()
  }

  // Apply theme to document
  function applyTheme(): void {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Toggle theme
  function toggleTheme(): void {
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  // Watch for changes
  watch(isDark, applyTheme)

  // Initialize on store creation
  loadTheme()

  return {
    isDark,
    toggleTheme
  }
})

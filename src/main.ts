import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import './assets/json-syntax.css'
import "primeicons/primeicons.css";
import { plugin, defaultConfig } from "@formkit/vue";

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(plugin, defaultConfig({
  config: {
    classes: {
      outer: 'mt-2 text-xs font-mono text-gray-900 dark:text-gray-100',
      label: 'block text-neutral-700 text-sm font-bold mb-1 dark:text-neutral-300',
      inner: 'bg-gray-50 dark:bg-gray-900 p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200',
      input: 'w-full font-mono text-gray-900 dark:text-gray-100 focus-within:outline-none',
      help: 'mt-1 text-xs text-slate-500 dark:text-slate-400',
      messages: 'mt-1 list-none p-0',
      message: 'text-sm text-red-600'
    }
  }
}))

app.mount('#app')

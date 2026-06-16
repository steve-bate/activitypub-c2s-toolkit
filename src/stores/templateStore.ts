import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ResourceTemplate } from "@/lib/templates/types"

const STORAGE_KEY = 'resourceTemplates'

function loadFromStorage(): ResourceTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('Failed to load resource templates from localStorage', err)
    return []
  }
}

function saveToStorage(items: ResourceTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export const useResourceTemplatesStore = defineStore('resourceTemplates', () => {
  const items = ref<ResourceTemplate[]>(loadFromStorage())

  const count = computed(() => items.value.length)

  function persist() {
    saveToStorage(items.value)
  }

  function reload() {
    items.value = loadFromStorage()
  }

  function setAll(newItems: ResourceTemplate[]) {
    items.value = [...newItems]
    persist()
  }

  function add(item: ResourceTemplate) {
    items.value.push(item)
    persist()
  }

  function update(id: string, patch: Partial<ResourceTemplate>) {
    const index = items.value.findIndex(item => item.id === id)
    if (index === -1) return

    items.value[index] = {
      ...items.value[index],
      ...patch
    }
    persist()
  }

  function upsert(item: ResourceTemplate) {
    const index = items.value.findIndex(existing => existing.id === item.id)

    if (index === -1) {
      items.value.push(item)
    } else {
      items.value[index] = {
        ...items.value[index],
        ...item
      }
    }

    persist()
  }

  function remove(id: string) {
    items.value = items.value.filter(item => item.id !== id)
    persist()
  }

  function getById(id: string) {
    return items.value.find(item => item.id === id) ?? null
  }

  function clear() {
    items.value = []
    persist()
  }

  return {
    items,
    count,
    reload,
    setAll,
    add,
    update,
    upsert,
    remove,
    getById,
    clear,
    persist
  }
})
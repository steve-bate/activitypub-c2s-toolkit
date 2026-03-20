import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import { postActivityToOutbox, createLikeActivity, createAnnounceActivity } from '@/services/activitypubService'

interface UseObjectActionsOptions {
  data: Record<string, unknown>
  fallbackObjectUri?: MaybeRefOrGetter<string>
  showPreview?: boolean
}

const AS2_CORE_OBJECTS = new Set([
  'Object',
  'Link',
  'Activity',
  'IntransitiveActivity',
  'Relationship',
  'Accept',
  'Add',
  'Arrive',
  'Block',
  'Create',
  'Delete',
  'Dislike',
  'Flag',
  'Follow',
  'Ignore',
  'Invite',
  'Join',
  'Leave',
  'Like',
  'Listen',
  'Move',
  'Offer',
  'Question',
  'Reject',
  'Read',
  'Remove',
  'TentativeReject',
  'TentativeAccept',
  'Travel',
  'Undo',
  'Update',
  'View',
  'Application',
  'Article',
  'Audio',
  'Document',
  'Event',
  'Group',
  'Image',
  'Note',
  'Page',
  'Person',
  'Place',
  'Profile',
  'Service',
  'Tombstone',
  'Video',
  'Mention'
])

const COLLECTION_TYPES = new Set([
  'Collection',
  'OrderedCollection',
  'CollectionPage',
  'OrderedCollectionPage'
])

export function useObjectActions(options: UseObjectActionsOptions) {
  const router = useRouter()
  const serverStore = useServerStore()

  const isSubmittingLike = ref(false)
  const isSubmittingAnnounce = ref(false)
  const actionError = ref<string | null>(null)
  const actionSuccess = ref<string | null>(null)

  const objectTypes = computed(() => {
    const typeValue = options.data.type
    if (typeof typeValue === 'string') {
      return [typeValue]
    }
    if (Array.isArray(typeValue)) {
      return typeValue.filter((item): item is string => typeof item === 'string')
    }
    return []
  })

  const hasAttributedTo = computed(() => {
    const attr = options.data.attributedTo
    if (!attr) return false
    if (typeof attr === 'string') return attr.trim().length > 0
    if (Array.isArray(attr)) return attr.length > 0
    if (typeof attr === 'object' && attr !== null) return true
    return false
  })

  const isStandardAs2NonCollectionObject = computed(() => {
    if (objectTypes.value.length === 0) return false

    return objectTypes.value.some(type => {
      if (COLLECTION_TYPES.has(type)) return false
      return AS2_CORE_OBJECTS.has(type)
    })
  })

  const showObjectActions = computed(() => {
    return isStandardAs2NonCollectionObject.value && hasAttributedTo.value
  })

  const activeActorId = computed(() => {
    return serverStore.activeServer?.actor?.profile?.id || ''
  })

  const outboxUrl = computed(() => {
    return serverStore.activeServer?.actor?.profile?.outbox || ''
  })

  const accessToken = computed(() => {
    return (
      serverStore.activeServer?.auth?.bearerToken
    )
  })

  const objectUri = computed(() => {
    const objectId = options.data.id
    if (typeof objectId === 'string' && objectId) {
      return objectId
    }

    if (options.fallbackObjectUri) {
      const fallback = toValue(options.fallbackObjectUri)
      if (typeof fallback === 'string' && fallback) {
        return fallback
      }
    }

    return ''
  })

  const canSubmitObjectAction = computed(() => {
    return !!(activeActorId.value && outboxUrl.value && accessToken.value && objectUri.value)
  })

  async function submitObjectAction(type: 'Like' | 'Announce') {
    actionError.value = null
    actionSuccess.value = null

    if (!canSubmitObjectAction.value) {
      actionError.value = 'Missing actor, outbox, access token, or object URI for this action.'
      return
    }

    if (type === 'Like') {
      isSubmittingLike.value = true
    } else {
      isSubmittingAnnounce.value = true
    }

    try {
      const activity = type === 'Like'
        ? createLikeActivity(activeActorId.value, objectUri.value)
        : createAnnounceActivity(activeActorId.value, objectUri.value)

      const exchange = await postActivityToOutbox({
        outboxUrl: outboxUrl.value,
        activity,
        accessToken: accessToken.value
      })

      const success = exchange.success
      const message = success
        ? `${type} sent successfully: HTTP ${exchange.response?.status_code ?? 0} ${exchange.response?.status_text ?? ''}`
        : (exchange.error || `${type} failed`)

      // Navigate to status page with exchange data (serialized as JSON)
      await router.push({
        name: 'object-action-status',
        state: {
          actionType: type,
          success,
          message,
          exchangeJson: JSON.stringify(exchange),
          objectUri: objectUri.value,
          showPreview: options.showPreview ?? false
        }
      })
    } catch (error) {
      actionError.value = `${type} failed: ${error instanceof Error ? error.message : String(error)}`
    } finally {
      if (type === 'Like') {
        isSubmittingLike.value = false
      } else {
        isSubmittingAnnounce.value = false
      }
    }
  }

  return {
    showObjectActions,
    canSubmitObjectAction,
    isSubmittingLike,
    isSubmittingAnnounce,
    actionError,
    actionSuccess,
    submitObjectAction
  }
}

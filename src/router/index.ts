import { createRouter, createWebHistory } from 'vue-router'
import JsonBrowserPage from '@/views/JsonBrowserPage.vue'
import ServersPage from '@/views/ServersPage.vue'
import ServerMetadataPage from '@/views/ServerMetadataPage.vue'
import ServerOAuth2Page from '@/views/ServerOAuth2Page.vue'
import AddServerPage from '@/views/AddServerPage.vue'
import OAuthCallbackPage from '@/views/OAuthCallbackPage.vue'
import CreateResourcePage from '@/views/CreateResourcePage.vue'
import FollowPage from '@/views/FollowPage.vue'
import SettingsPage from '@/views/SettingsPage.vue'
import ObjectActionStatusPage from '@/views/ObjectActionStatusPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/servers'
    },
    {
      path: '/json',
      name: 'json',
      component: JsonBrowserPage
    },
    {
      path: '/servers',
      name: 'servers',
      component: ServersPage
    },
    {
      path: '/servers/new',
      name: 'add-server',
      component: AddServerPage
    },
    {
      path: '/servers/:id',
      name: 'server-detail',
      component: ServerMetadataPage
    },
    {
      path: '/servers/:id/auth',
      name: 'server-auth',
      component: ServerOAuth2Page
    },
    {
      path: '/callback',
      name: 'oauth-callback',
      component: OAuthCallbackPage
    }
    ,
    {
      path: '/post',
      name: 'post-resource',
      component: CreateResourcePage
    },
    {
      path: '/follow',
      name: 'follow',
      component: FollowPage
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage
    },
    {
      path: '/object-action-status',
      name: 'object-action-status',
      component: ObjectActionStatusPage
    }
  ]
})

export default router

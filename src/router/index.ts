import { createRouter, createWebHistory } from 'vue-router'
import JsonBrowserPage from '@/views/JsonBrowserPage.vue'
import ServersPage from '@/views/ServersPage.vue'
import ServerMetadataPage from '@/views/ServerMetadataPage.vue'
import ServerOAuth2Page from '@/views/ServerOAuth2Page.vue'
import AddServerPage from '@/views/AddServerPage.vue'
import OAuthCallbackPage from '@/views/OAuthCallbackPage.vue'
import CreateResourcePage from '@/views/CreateResourcePage.vue'
import FollowPage from '@/views/FollowPage.vue'
import UploadMediaPage from '@/views/UploadMediaPage.vue'
import SettingsPage from '@/views/SettingsPage.vue'
import ObjectActionStatusPage from '@/views/ObjectActionStatusPage.vue'
import ServerTestPage from '../views/ServerTestPage.vue'
import ServerReportPage from '@/views/ServerReportPage.vue'

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
      path: '/servers/:id/report',
      name: 'server-report',
      component: ServerReportPage
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
      path: '/upload-media',
      name: 'upload-media',
      component: UploadMediaPage
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
    },
    {
      path: '/tests',
      name: 'testing',
      component: ServerTestPage
    }
  ]
})

export default router

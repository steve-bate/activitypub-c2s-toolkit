import { createRouter, createWebHistory } from 'vue-router'
import JsonBrowserPage from '@/views/JsonBrowserPage.vue'
import ServersPage from '@/views/ServersPage.vue'
import ServerDetailPage from '@/views/ServerDetailPage.vue'
import AddServerPage from '@/views/AddServerPage.vue'
import OAuthCallbackPage from '@/views/OAuthCallbackPage.vue'
import PostResourcePage from '@/views/PostResourcePage.vue'
import FollowPage from '@/views/FollowPage.vue'

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
      component: ServerDetailPage
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
      component: PostResourcePage
    },
    {
      path: '/follow',
      name: 'follow',
      component: FollowPage
    }
  ]
})

export default router

import { createRouter, createWebHistory } from "vue-router";

const ServersPage = () => import('@/views/ServersPage.vue')
const ServerMetadataPage = () => import('@/views/ServerMetadataPage.vue')
const ServerOAuth2Page = () => import('@/views/ServerOAuth2Page.vue')
const AddServerPage = () => import('@/views/AddServerPage.vue')
const OAuthCallbackPage = () => import('@/views/OAuthCallbackPage.vue')
const FollowPage = () => import('@/views/FollowPage.vue')
const UploadMediaPage = () => import('@/views/UploadMediaPage.vue')
const SettingsPage = () => import('@/views/SettingsPage.vue')
const ObjectActionStatusPage = () => import('@/views/ObjectActionStatusPage.vue')
const ServerTestPage = () => import('../views/ServerTestPage.vue')
const ServerReportPage = () => import('@/views/ServerReportPage.vue')
const TemplatesPage = () => import('@/views/TemplatesPage.vue')
const TemplateEditorPage = () => import('@/views/TemplateEditorPage.vue')
const JsonBrowserPage = () => import('@/views/JsonBrowserPage.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: "/servers",
    },
    {
      path: "/json",
      name: "json",
      component: JsonBrowserPage,
    },
    {
      path: "/servers",
      name: "servers",
      component: ServersPage,
    },
    {
      path: "/servers/new",
      name: "add-server",
      component: AddServerPage,
    },
    {
      path: "/servers/:id",
      name: "server-detail",
      component: ServerMetadataPage,
    },
    {
      path: "/servers/:id/auth",
      name: "server-auth",
      component: ServerOAuth2Page,
    },
    {
      path: "/servers/:id/report",
      name: "server-report",
      component: ServerReportPage,
    },
    {
      path: "/callback",
      name: "oauth-callback",
      component: OAuthCallbackPage,
    },
    {
      path: "/post",
      name: "post-resource",
      component: TemplatesPage,
    },
    {
      path: "/resource-templates/new",
      name: "resourceTemplateNew",
      component: TemplateEditorPage,
      props: true,
    },
    {
      path: "/resource-templates/:id/edit",
      name: "resourceTemplateEdit",
      component: TemplateEditorPage,
      props: true,
    },
    {
      path: "/follow",
      name: "follow",
      component: FollowPage,
    },
    {
      path: "/upload-media",
      name: "upload-media",
      component: UploadMediaPage,
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsPage,
    },
    {
      path: "/object-action-status",
      name: "object-action-status",
      component: ObjectActionStatusPage,
    },
    {
      path: "/tests",
      name: "testing",
      component: ServerTestPage,
    },
  ],
});

export default router;

import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import MenuLayout from "../layouts/MenuLayout.vue";
import ChatView from "../views/webview/ChatView.vue";
import WelcomeView from "../views/Welcome.vue";
import CaptureView from "../views/CaptureView.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: MenuLayout,
    redirect: "/welcome",
    children: [
      {
        path: "welcome",
        name: "Welcome",
        component: WelcomeView,
      },
      {
        path: "capture",
        name: "Capture",
        component: CaptureView,
      },
      // {
      //   path: 'knowledge',
      //   name: 'Knowledge',
      //   component: KnowledgeView
      // },
      {
        path: "chat",
        name: "Chat",
        component: ChatView,
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 全局前置钩子：当路由离开 chat 页面时，主动隐藏 WebView
router.beforeEach((to, from) => {
  // 如果从 chat 页面离开
  if (from.path === "/chat" && to.path !== "/chat") {
    // 主动调用 WebView 的隐藏方法
    if (typeof window !== "undefined" && window.electronAPI?.webview) {
      // 先调用 hide 立即隐藏，再调用 destroy 彻底销毁
      window.electronAPI.webview.hide().catch(() => { });
      window.electronAPI.webview.destroy().catch(() => { });
    }
    // 强制隐藏 DOM 中的 webview 元素
    const webviews = document.getElementsByTagName("webview");
    for (let i = 0; i < webviews.length; i++) {
      (webviews[i] as HTMLElement).style.display = "none";
      (webviews[i] as HTMLElement).style.pointerEvents = "none";
    }
  }
});

export default router;

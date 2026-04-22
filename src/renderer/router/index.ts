import { createRouter, createWebHashHistory, RouteRecordRaw  } from 'vue-router'
import MenuLayout from '../layouts/MenuLayout.vue'
import ChatView from '../views/ChatView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    // component: MenuLayout,
    redirect: '/chat',
    children: [
      {
        path: 'chat',
        name: 'Chat',
        component: ChatView
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
import { createRouter, createWebHashHistory, RouteRecordRaw  } from 'vue-router'
import MenuLayout from '../layouts/MenuLayout.vue'
import ChatView from '../views/ChatView.vue'
import HomeView from '../views/HomeView.vue'
import SettingsView from '../views/SettingsView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MenuLayout,
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: HomeView
      },
      // {
      //   path: 'knowledge',
      //   name: 'Knowledge',
      //   component: KnowledgeView
      // },
      // {
      //   path: 'creation',
      //   name: 'Creation',
      //   component: CreationView
      // },
      {
        path: 'settings',
        name: 'Settings',
        component: SettingsView
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
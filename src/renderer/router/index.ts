import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import MenuLayout from "../layouts/MenuLayout.vue";
import WelcomeView from "../views/Welcome.vue";
import JournalView from "../views/JournalView.vue";
import ProjectView from "../views/ProjectView.vue";

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
        path: "journal",
        name: "Journal",
        component: JournalView,
      },
      {
        path: "wiki",
        name: "Wiki",
        component: () => import("../views/WikiView.vue"),
      },
      {
        path: "projects",
        name: "Projects",
        component: ProjectView,
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;

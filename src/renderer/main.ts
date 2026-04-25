import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import naive from './plugins/naive-ui'
import { i18n, initI18n } from './plugins/i18n'

// 导入全局样式
import './styles/global.scss'

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(pinia)
app.use(naive)
app.use(i18n)

// 在 Pinia 初始化后再初始化 i18n，确保可以访问 store
initI18n().catch(console.error)

app.mount('#app')

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import naive from './plugins/naive-ui'
import { i18n } from './plugins/i18n'

// 导入全局样式
import './styles/global.scss'

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(pinia)
app.use(naive)
app.use(i18n)
app.mount('#app')

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { naive } from './plugins/naive-ui'
import { i18n, initI18n } from './plugins/i18n'


// 导入全局样式
import './styles/global.scss'

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(pinia)
app.use(naive)


app.use(i18n)

// 确保 i18n 初始化完成后再挂载，否则 TiptapEditor 等组件会获取到错误的 placeholder
initI18n().finally(() => {
  app.mount('#app')
})

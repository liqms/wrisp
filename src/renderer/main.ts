import { createApp } from 'vue'
import './styles/global.css'
import App from './App.vue'
import router from './router'
import pinia from './store'
import naive from './plugins/naive-ui'

const app = createApp(App)
app.use(router)
app.use(pinia)
app.use(naive)
app.mount('#app')

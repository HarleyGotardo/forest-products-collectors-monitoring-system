// src/main.js
import './index.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import globalMixin from './router/globalMixin'

const app = createApp(App)

app.mixin(globalMixin)
app.use(router)
app.mount('#app')

app.config.devtools = true
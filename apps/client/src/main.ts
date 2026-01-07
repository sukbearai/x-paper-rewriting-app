import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import './style.css'
import './assets/iconfont/iconfont.css'
import 'virtual:svg-icons-register'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import router from './router'
import svgIcon from './components/SvgIcon.vue'
import App from './App.vue'
import { setupInterceptors } from '@/api/axios'
import { useAuthStore } from '@/store/auth'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  app.use(ElementPlus, { locale: zhCn })
  app.use(pinia)

  const authStore = useAuthStore(pinia)
  setupInterceptors(authStore)
  await authStore.restoreSession()

  app.use(router)
  app.component('svg-icon', svgIcon)

  for (const [key, component] of Object.entries(ElementPlusIconsVue))
    app.component(key, component)

  await router.isReady()
  app.mount('#app')
}

bootstrap().catch((error) => {
  console.error('[bootstrap] failed to start app', error)
})

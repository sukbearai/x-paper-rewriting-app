import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import './style.css'
import './assets/iconfont/iconfont.css'
import 'virtual:svg-icons-register'
import router from './router'
import App from './App.vue'
import svgIcon from './components/SvgIcon.vue'

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.component('svg-icon', svgIcon)

// 注册所有图标组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')

import { createApp } from 'vue'
import './style.css'
import router from './router'
import ElementPlus from "element-plus"
import "element-plus/dist/index.css"
import "./assets/iconfont/iconfont.css"
// main.ts
import 'virtual:svg-icons-register'

import * as ElementPlusIconsVue from "@element-plus/icons-vue"
import App from './App.vue'
import svgIcon from "./components/SvgIcon.vue"; // 全局svg图标组件

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.component("svg-icon", svgIcon);

// 注册所有图标组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')

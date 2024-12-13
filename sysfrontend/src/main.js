import { createApp } from 'vue';
import { router } from './router';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import axios from 'axios';
import store from './store';
import mitt from 'mitt';
import './assets/css/main.css'

axios.defaults.headers.post["Content-Type"] = "application/json";
axios.defaults.headers.get["Content-Type"] = "application/json";
axios.defaults.withCredentials = true;

// Vue.prototype.$EventBus = new Vue();
// Vue.prototype.$axios = axios;
// Vue.config.productionTip = false

const emitter = mitt();
const app = createApp(App);
app.config.globalProperties.$axios = axios;
app.config.globalProperties.emitter = emitter;
app.config.productionTip = false;

app.use(vuetify);
app.use(router);
app.use(store);

app.mount("#app");
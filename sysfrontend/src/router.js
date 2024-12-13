import { createWebHistory, createRouter } from 'vue-router';
import store from './store';

const routes = [
  {
    path: '/',
    name: 'login',
    component: () => import('./layouts/UserLogin'),
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('./layouts/MainHome'),
  },
  {
    path: '/assistant',
    name: 'assistant',
    component: () => import('./views/ChatMain'),
    redirect: '/assistant/chatting',
    children: [
      {
        path: '/assistant/chatting',
        name: 'chatting',
        component: () => import('./views/ChattingView')
      },
      {
        path: '/assistant/gensql',
        name: 'gensql',
        component: () => import('./views/GenSQLView')
      },
      {
        path: '/assistant/chatbot/:botname/:filename',
        name: 'chatbot',
        component: () => import('./views/ChatbotView')
      },
    ]
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 네비게이션 가드 설정
router.beforeEach((to, from, next) => {
  const isLogin = store.state.isLogin;

  if (to.name !== 'login' && !isLogin) {
    next({ name: 'login' });
  } else if (to.name === 'login' && isLogin) {
    next({ name: 'home' });
  } else {
    next();
  }
});

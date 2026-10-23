import { createRouter, createWebHistory } from 'vue-router'
import DexView from './views/DexView.vue'
import PaperSheet from './components/PaperSheet.vue'
import ReaderView from './views/ReaderView.vue'
import GuideView from './views/GuideView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: DexView,
      children: [
        { path: 'p/:id', name: 'paper', component: PaperSheet, props: true },
        { path: 'new', name: 'new', component: PaperSheet, props: true },
      ],
    },
    { path: '/p/:id/read', name: 'reader', component: ReaderView, props: true },
    { path: '/guide', name: 'guide', component: GuideView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

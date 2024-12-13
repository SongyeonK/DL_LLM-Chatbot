<template>
  <v-app>
    <MainHeader/>
    <Navigation />
    <v-main>
      <router-view />
    </v-main>
    <MainFooter/>
  </v-app>
</template>

<script>
import MainHeader from '../layouts/MainHeader.vue'
import Navigation from './AssistantNavigation.vue'
import MainFooter from '../layouts/MainFooter.vue'

export default {
  components: {
    MainHeader,
    Navigation,
    MainFooter
  },
}
</script>

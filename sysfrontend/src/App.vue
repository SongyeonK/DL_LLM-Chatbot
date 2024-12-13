<template>
  <v-container fluid class="grey darken-4">
    <router-view />
  </v-container>
</template>

<script>
export default {
  name: 'App',

  components: {
  },

  data: () => ({
    //
  }),
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>

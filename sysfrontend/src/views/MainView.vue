<template>
  <v-app>
    <v-main>
      <v-container fluid>
        <v-row justify="center">
          <v-col class="pt-0 pb-2" cols="3" v-for="(image, index) in images.slice(0, 2)" :key="index">
            <v-card class="mx-auto" max-width="400">
              <v-img class="align-end text-white" height="400" :src="image.src" cover>
              </v-img>
              <v-card-subtitle class="pt-4">{{ image.subtitle }}</v-card-subtitle>
              <v-card-text>
                <div>{{ image.description }}</div>
              </v-card-text>
              <v-card-actions>
                <v-btn color=var(--text-highlight-color) @click="navigateTo(image.path)">Explore</v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
export default {
  name: "MainView",
  data() {
    return {
      images: [
        { src: require("../assets/assistant.jpg"), title: "Assistant", subtitle: "Your Personal AI", description: "당신을 도와줄 여러 AI 기능을 살펴보세요", path: "chatting" },
        { src: require("../assets/assistant.jpg"), title: "Assistant", subtitle: "Enhance Productivity", description: "생산성을 높이는 도구에 액세스하세요", path: "chatting" }
      ]
    };
  },
  methods: {
    navigateTo(path) {
      this.$router.push({ name: path });
    }
  }
};
</script>

<style>

html, body {
  background-color: var(--background-color);
  margin: 0;
  padding: 0;
  height: 100%;
}

#app {
  background-color: var(--background-color);
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

.v-app {
  background-color: var(--background-color);
}

.v-main {
  background-color: var(--background-color);
  min-height: calc(100vh - 64px); /* Adjust based on header/footer height */
}

.v-card {
  background-color: var(--background-color);
  color: var(--text-color);
}

</style>

<template>
  <v-app>
    <MainHeader/>
    <MainView/>
    <MainFooter/>
  </v-app>
</template>

<script>
import MainHeader from './MainHeader.vue';
import MainView from '../views/MainView.vue';
import MainFooter from './MainFooter.vue';
import { fetchModelsFromDatabase } from '../apiService'; 
import { mapActions } from 'vuex';

export default {
  name: 'App',

  components: {
    MainHeader,
    MainView,
    MainFooter,
  },
  created() {
  },
  mounted() {
    this.initializeApp();
  },
  methods: {
    ...mapActions(['initializeApiClient']),
    // 디폴트 LLM 모델을 DB로 부터 읽고 공통정보에 세팅
    async initializeApp() {
      try {
        const models = await fetchModelsFromDatabase();
        const defaultModel = models.find(model => model.DEFAULT_MODEL_YN === 'Y');
        const defaultModelId = defaultModel ? defaultModel.MODEL_ID : models[0].model_id;

        await this.initializeApiClient(defaultModelId);
      } catch (error) {
        console.error('Failed to initialize API client:', error);
      }
    },
  },
};
</script>

<template>
  <v-app-bar height="50px" style="border-bottom: 1px solid rgba(224, 224, 224, 0.5);">
    <div class="d-flex align-center">
      <v-img src="/logo.png" alt="Logo" height="40px" class="cursor-pointer" contain min-width="100" style="padding-right: 20px"
        @click="$router.push({ name: 'home' })"
      ></v-img>
    </div>

    <v-app-bar-title class="cursor-pointer" @click="$router.push({ name: 'home' })">Song Yeon's AI Chatbot</v-app-bar-title>

    <v-spacer></v-spacer>

    <v-btn-toggle
      v-model="selectedButtonItem"
      :value="selectedButtonItem"
      rounded="0"
      variant="text"
      group
    >
      <v-btn class="text-h8" @click="navigateTo('chatting')" value="chat"> Assistant </v-btn>
    </v-btn-toggle>

    <v-menu offset-y max-width="250px">
      <template v-slot:activator="{ props  }">
        <v-btn dark text v-bind="props">
          {{ userInfo ? userInfo.name : 'Guest' }}
          <v-icon>mdi-menu-down</v-icon>
        </v-btn>
      </template>

      <v-card class="mx-auto" width="256">
        <v-list style="background-color: #78909C;">
          <v-list-item
            prepend-avatar="/logo.png"
            :subtitle="userInfo ? userInfo.email : ''"
            :title="userInfo ? userInfo.name : ''"
            class="white--text"
          >
          </v-list-item>
        </v-list>

        <v-divider></v-divider>

        <v-list dense style="background-color: #78909C;">
          <v-list-item
            v-for="(item, i) in userInfoItems"
            :key="i"
            class="ml-3 white--text"
            @click="handleItemClick(item)"
          >
            <template v-slot:prepend>
              <v-icon>{{ item.icon }}</v-icon>
            </template>
            <v-list-item-title>{{ item.text }}</v-list-item-title>
            <!-- <v-switch
              v-if="item.text === 'Theme'"
              v-model="isDarkMode"
              @change="toggleTheme"
            ></v-switch> -->
          </v-list-item>
        </v-list>

      </v-card>
    </v-menu>

    <v-dialog v-model="showThemeDialog" max-width="300px">
      <v-card>
        <v-card-title class="headline">테마 선택</v-card-title>
        <v-card-text>
          <v-switch
            v-model="isDarkMode"
            color=var(--text-highlight-color)
            label="다크모드"
            inset
          ></v-switch>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="showThemeDialog = false">취소</v-btn>
          <v-btn color="blue darken-1" text @click="applyThemeAndClose">확인</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showAboutDialog" max-width="500px">
      <v-card
        class="mx-auto"
        prepend-icon="mdi-emoticon-wink"
        subtitle="The #1 Secret Library"
        width="400"
      >
        <template v-slot:title>
          <span class="font-weight-black">Welcome to My Page</span>
        </template>
        <v-card-text class="bg-surface-light pt-4">
          ◉ This application is a demo site that shows an AI chatbot assistant use case using Oracle's Vector Search. <br> ◉ Designed and developed by SongYeon. <br> 
          ◉ It uses the following libraries: Vue.js Vuetify Axios Vue-router & Oracle AI Vector Search
        </v-card-text>
        <v-card-actions>
          <v-btn color="blue darken-1" text @click="showAboutDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app-bar>
</template>

<script>
import { mapState, mapActions } from "vuex";

export default {
  components: {
  },
  data: () => ({
    selectedButtonItem: null,
    menu: false,
    menuActivator: null,
    userInfoItems: [
      { text: '로그아웃', icon: 'mdi-logout' },
      { text: '설정', icon: 'mdi-cog' },
      { text: 'Profile', icon: 'mdi-information' },
    ],
    isDarkMode: false,  // 다크 모드 상태 관리
    showThemeDialog: false,
    showAboutDialog: false,
  }),
  mounted() {
    this.menuActivator = this.$refs.menuActivator;
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      this.isDarkMode = JSON.parse(savedMode);
      this.applyTheme();
    }
  },
  computed: {
    ...mapState(["userInfo", "userEmail"]),
  },
  methods: {
    ...mapActions(["blogLogout"]),
    navigateTo(page) {
      if (this.userInfo && this.userInfo.name === 'songyeon' && page !== 'chatting') {
        // songyeon 사용자는 chatting 페이지로만 이동 가능
        alert(`${this.userInfo.name}님은 ${page} 페이지로 이동할 수 없습니다.`);
        return;
      }

      this.$router.push({ name: page });
    },
    handleItemClick(item) {
      if (item.text === '로그아웃') {
        this.blogLogout();
      } else if (item.text === '설정') {
        this.showThemeDialog = true; 
      } else if (item.text === 'Profile') {
        this.aboutMe();
      }
    },
    aboutMe() {
      this.showAboutDialog = true;
    },
    applyThemeAndClose() {
      this.applyTheme();
      localStorage.setItem('darkMode', JSON.stringify(this.isDarkMode));  // 선택된 모드를 저장
      this.showThemeDialog = false;  // 다이얼로그 닫기
    },
    applyTheme() {
      if (this.isDarkMode) {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
      } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
      }
    },
  },
};
</script>

<style>

.v-app-bar {
  background-color: var(--background-color) !important;
  color: var(--text-color) !important;
}

.v-btn-toggle {
  color: var(--text-color) !important;
}

.cursor-pointer {
  cursor: pointer;
}

</style>

<template>
  <v-app id="inspire">
    <v-app-bar height="50px" style="border-bottom: 1px solid rgba(224, 224, 224, 0.5);">
      <div class="d-flex align-center">
        <v-img src="/logo.png" alt="Logo" height="48px" class="cursor-pointer" contain min-width="100" style="padding-right: 20px"
           @click="$router.push({ name: 'home' })"
        ></v-img>
      </div>

      <v-app-bar-title class="cursor-pointer" @click="$router.push({ name: 'home' })">IT from Bit</v-app-bar-title>

      <v-spacer></v-spacer>

      <v-toolbar-items class="hidden-sm-and-down">
        <v-btn text v-if="isLogin"> WelCome! </v-btn>
        <v-btn text v-else router :to="{name: 'login'}" append-icon="mdi-login"> 로그인 </v-btn>
      </v-toolbar-items>
    </v-app-bar>

    <v-main>
      <v-container fill-height style="max-width: 400px">
        <v-row align-center row wrap>
          <v-col xs12>
            <v-alert class="mb-3" v-if='isLoginError' type="error" color="red-lighten-1">
              Confirm your username and password !!
            </v-alert>
            <v-alert
              class="mb-3" v-if='isLogin' type="success" color="teal-lighten-1">
              Login Sucess !!
            </v-alert>
            <v-alert
              class="mb-3" v-if='isLogout' type="success" color="blue-grey-lighten-1">
              You have been logged out
            </v-alert>
            <v-card class="pb-5" color=var(--card-background-color)>
              <div class="pt-10 pb-5 pl-10 pr-10">
                <div>
                  <h2><p style="color: var(--text-color);" align="center">다시 오신 것을 환영합니다</p></h2>
                </div>
              </div>
              <div class="pl-15 pr-15">
                <v-text-field
                  v-model="username"
                  name="username"
                  label="username"
                  type="text"
                  placeholder="username"
                  required
                  prepend-inner-icon="mdi-account"
                  outlined
                  dense
                ></v-text-field>
                <v-text-field
                  v-model="password"
                  name="password"
                  label=""
                  type="password"
                  placeholder="password"
                  prepend-inner-icon="mdi-lock"
                  outlined
                  dense
                  @input="onPasswordInput"
                >
                </v-text-field>
              </div>
              <div class="pt-5 pl-15 pr-15">
                <v-btn
                  type="submit"
                  block
                  rounded="xl"
                  size="x-large"
                  class="mb-3"
                  @click="handleLogin"
                >
                  로그인
                </v-btn>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
    
    <v-footer height="auto" class="font-weight-medium d-flex justify-center align-center" app style="border-top: 1px solid rgba(224, 224, 224, 0.5);">
      <v-card flat class="d-flex justify-end" style="width: 100%;">
        <v-card-text class="py-2 text-center" style="font-size: 14px;">
          {{ new Date().getFullYear() }} —
          <strong style="font-weight: 600;">copyright ItFromBit ALL RIGHTS RESERVED</strong>
        </v-card-text>
      </v-card>
    </v-footer>
  </v-app>
</template>

<script>
import { mapState, mapActions } from "vuex"

export default {
  name: 'UserLogin',
  data: () => ({
    username: '',
    password: '',
    isDarkMode: false,  // 다크 모드 상태 관리
  }),
  created() {
    const lastLoginUser = localStorage.getItem("lastLoginUser"); // 수정된 부분
    this.username = lastLoginUser ? lastLoginUser : process.env.VUE_APP_DEFAULT_USERNAME; // 수정된 부분
    this.password = '';
  },
  mounted() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      this.isDarkMode = JSON.parse(savedMode);
      this.applyTheme();
    }
  },
  watch: {
    username(newVal) {
      if (newVal === 'smartcarly' || newVal === 'songyeon') {
        this.password = process.env.VUE_APP_DEFAULT_PASSWORD;
      }
    },
    isLogin(newVal) {
      if (!newVal) {
        this.username = localStorage.getItem("lastLoginUser") || ''; // 로그인 상태가 변경될 때 username을 초기화
        this.password = '';
      }
    }
  },
  computed: {
    ...mapState(["isLogin", "isLoginError", "isLogout", "userInfo", "userEmail"])
  },
  methods: {
    ...mapActions(["blogLogin"]),
    onPasswordInput(event) {
      this.password = event.target.value;
    },
    async handleLogin() {
      await this.blogLogin({ username: this.username, password: this.password });
      if (this.isLogin) {
        this.username = '';
        this.password = '';
      }
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

html, body {
  background-color: var(--background-color); /* grey-darken-4 */
  margin: 0;
  padding: 0;
  height: 100%;
}

#app {
  background-color: var(--background-color); /* grey-darken-4 */
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

.v-app {
  background-color: var(--background-color); /* grey-darken-4 */
}

.v-app-bar {
  background-color: var(--background-color) !important;
  color: var(--text-color) !important;
}

.v-main {
  background-color: var(--background-color); /* grey-darken-4 */
  min-height: calc(100vh - 64px); /* Adjust based on header/footer height */
  display: flex;
  justify-content: center;
  align-items: center;
}

.v-card {
  background-color: var(--background-color);
  color: var(--text-color);
}

.v-text-field {
  font-size: 1.0em;
  color: var(--text-highlight-color);
}

.v-footer {
  background-color: var(--background-color);
  color: var(--text-color);
}

</style>
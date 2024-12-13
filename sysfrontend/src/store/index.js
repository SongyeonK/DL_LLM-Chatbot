import { createStore } from "vuex";
import { router } from "../router";
import { createApiClient, createChatCompletion } from "../apiService";

const store = createStore({
  state: {
    userInfo: null, 
    userEmail: null, // 사용자 이메일 저장
    lastLoginUser: '', // 마지막 로그인 유저 정보를 저장하는 상태 
    allUsers: [],
    isLogin: false,
    isLoginError: false,
    isLogout: false,
    botItems: [],
    activeChats: [], 
    // LLM api 관리
    selectedModelName: null,
    apiClient: null,
    documentReviewClient: null, // 문서검수 agent의 API 클라이언트
    approvalClient: null, // 검수승인 agent의 API 클라이언트
  },
  mutations: {
    // 로그인이 성공했을때,
    loginSuccess(state, payload) {
      state.isLogin = true;
      state.isLoginError = false;
      state.isLogout = false;
      state.userInfo = payload.userInfo;
      state.userEmail = payload.userInfo ? payload.userInfo.email : null;  // 사용자 이메일 업데이트
      state.lastLoginUser = payload.userInfo.name; // 마지막 로그인 유저 정보 업데이트
    },
    // 로그인이 실패했을때,
    loginError(state) {
      state.isLogin = false;
      state.isLoginError = true;
      state.isLogout = false;
    },
    // 로그아웃
    logout(state) {
      state.isLogin = false;
      state.isLoginError = false;
      state.isLogout = true;
      state.userInfo = null;
      state.userEmail = null; // 로그아웃 시 이메일 초기화
    },
    setAllUsers(state, data) {
      state.allUsers = data;
    },
    navigateToMutation(state, path) {
      router.push(path);
    },
    // 챗봇 관리
    setBotItems(state, botItems) {
      state.botItems = botItems;
    },
    addBotItem(state, item) {
      state.botItems.push(item);
    },
    // 챗 히스토리 관리
    setActiveChats(state, activeChats) {
      state.activeChats = activeChats;
    },
    addActiveChat(state, chat) {
      state.activeChats.push(chat);
    },
    // LLM api 관리
    setSelectedModelName(state, modelName) {
      state.selectedModelName = modelName;
    },
    setApiClient(state, apiClient) {
      state.apiClient = apiClient;
    },
    setDocumentReviewClient(state, client) {
      state.documentReviewClient = client;
    },
    setApprovalClient(state, client) {
      state.approvalClient = client;
    },
  },
  actions: {
    async fetchAllUsers({ commit }) {
      const response = await fetch("users.json");
      const data = await response.json();
      // const userNames = data.map(user => user.name);
      commit("setAllUsers", data);
    },
    async blogLogin({ state, commit, dispatch }, loginObj) {
      // 모든 유저가 불러와졌는지 먼저 확인
      if (state.allUsers.length === 0) {
        await dispatch('fetchAllUsers'); // 유저 정보가 없으면 fetchAllUsers 호출 후 대기
      }
      let selectedUser = null;

      state.allUsers.forEach(user => {
        if (user.username === loginObj.username) selectedUser = user;
      })
      if (selectedUser === null || selectedUser.password !== loginObj.password) {
        commit("loginError");
      }
      else {
        commit("loginSuccess", { userInfo: selectedUser });
        localStorage.setItem("accessUser", selectedUser.name);
        localStorage.setItem("lastLoginUser", selectedUser.name); // 마지막 로그인 유저 정보 저장
        store.dispatch("getUserInfo");
        router.push({ name: "home"});
      }
    },
    blogLogout({ commit }) {
      localStorage.removeItem("accessUser");
      commit("logout");
      router.push({ name: "login"});
    },
    // 저장된 접속유저정보를 불러온다.
    getUserInfo({ state, commit }) {
      // local Storage에 저장된 접속유저정보를 불러온다.
      let userInfo = localStorage.getItem("accessUser");
      if (userInfo !== null) {
        const selectedUser = state.allUsers.find(user => user.name === userInfo);
        if (selectedUser) {
          commit("loginSuccess", { userInfo: selectedUser });
        }
      }
    },
    navigateTo({ commit }, path) {
      commit('navigateToMutation', path);
    },
    setBotItems({ commit }, botItems) {
      commit('setBotItems', botItems);
    },
    addBotItem({ commit }, item) {
      commit('addBotItem', item);
    },
    setActiveChats({ commit }, activeChats) {
      commit('setActiveChats', activeChats);
    },
    addActiveChat({ commit }, chat) {
      commit('addActiveChat', chat);
    },
    // LLM api 관리  -- 중요
    async initializeApiClient({ commit }, modelId) {
      const { client, modelName } = await createApiClient(modelId);
      commit('setSelectedModelName', modelName);
      commit('setApiClient', client);
    },
    async createChat({ state }, { messages, options }) {
      if (!state.apiClient) {
        throw new Error('API 클라이언트가 초기화되지 않았습니다.');
      }
      const response = await createChatCompletion(state.apiClient, state.selectedModelName, messages, options);
      return response;
    },
    // 문서검수 agent와 검수승인 agent에 대한 API 클라이언트 초기화
    async initializeApiClients({ commit }, modelId) {
      try {
        // 문서검수 agent의 API 클라이언트 초기화 (gpt-4o-mini 사용)
        const { client: documentReviewClient } = await createApiClient(modelId);
        commit('setDocumentReviewClient', documentReviewClient);

        const { client: approvalClient } = await createApiClient(modelId);
        // 검수승인 agent의 API 클라이언트 초기화 (gpt-3.5-turbo 사용)
        // const { client: approvalClient } = await createApiClient('gpt-3.5-turbo');
        commit('setApprovalClient', approvalClient);

        // console.log('API 클라이언트가 성공적으로 초기화되었습니다.');
      } catch (error) {
        console.error('API 클라이언트 초기화 중 오류 발생:', error);
      }
    },
    // 문서검수 agent의 메시지 처리
    async createDocumentReview({ state }, { messages, options }) {
      if (!state.documentReviewClient) {
        throw new Error('문서검수 agent의 API 클라이언트가 초기화되지 않았습니다.');
      }
      const response = await createChatCompletion(state.documentReviewClient, 'gpt-4o-mini', messages, options);
      return response;
    },
    // 검수승인 agent의 메시지 처리
    async createApprovalReview({ state }, { messages, options }) {
      if (!state.approvalClient) {
        throw new Error('검수승인 agent의 API 클라이언트가 초기화되지 않았습니다.');
      }
      const response = await createChatCompletion(state.approvalClient, 'gpt-3.5-turbo', messages, options);
      return response;
    },
  },
  getters: {
    getActiveChats: (state) => state.activeChats,
    getBotItems: (state) => state.botItems
  },
  modules: {},
});

store.dispatch("fetchAllUsers");
// store.dispatch("initializeApiClient");

export default store;

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'school_chatbot_token';
const USER_KEY = 'school_chatbot_user';

let _token = null;
let _user = null;

export const setAuth = (token, user) => {
  _token = token || null;
  _user = user ? { ...user } : null;
};

export const getToken = () => _token;
export const getUser = () => _user;

export const saveAuth = async (token, user) => {
  setAuth(token, user);
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
  if (user) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  }
};

export const restoreAuth = async () => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const userJson = await SecureStore.getItemAsync(USER_KEY);
  let user = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      user = null;
    }
  }
  if (!token || !user) {
    setAuth(null, null);
    return null;
  }
  setAuth(token, user);
  return { token, user };
};

export const clearAuth = async () => {
  _token = null;
  _user = null;
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
};

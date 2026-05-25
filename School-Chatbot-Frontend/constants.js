const DEFAULT_BASE_URL = 'http://172.30.1.89:8000';
const DEFAULT_GOOGLE_WEB_CLIENT_ID = '985939853275-46vknlh7ahkag296e278h135qcuesm34.apps.googleusercontent.com';
const DEFAULT_GOOGLE_REDIRECT_URI = 'https://auth.expo.io/@hsw7777/school-chatbot-frontend';

export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL;
export const API_BASE = BASE_URL;
export const API_URL = `${BASE_URL}/chat`;

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID;

export const GOOGLE_REDIRECT_URI =
  process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || DEFAULT_GOOGLE_REDIRECT_URI;

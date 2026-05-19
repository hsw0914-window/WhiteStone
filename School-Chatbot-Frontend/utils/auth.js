let _token = null;
let _user = null;

export const setAuth = (token, user) => { _token = token; _user = { ...user }; };
export const getToken = () => _token;
export const getUser = () => _user;
export const clearAuth = () => { _token = null; _user = null; };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const appName = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'IITIL Portal';

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is required');
}

export const env = {
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
  appName
};

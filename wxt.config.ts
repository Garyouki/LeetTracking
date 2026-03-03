import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
    },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
    name: 'LeetTracking',
    permissions: ['storage', 'alarms', 'identity'],
    host_permissions: ['*://*.leetcode.com/*'],
    oauth2: {
      client_id: 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
      scopes: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
      ],
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    server: {
      port: 3000,
      strictPort: true,
      host: '127.0.0.1',
    },
  }),
});

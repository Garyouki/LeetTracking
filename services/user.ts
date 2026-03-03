declare const chrome: any;

export async function getUserId(interactive: boolean = false): Promise<string> {
  console.log(`Getting user ID (Interactive mode: ${interactive})...`);

  try {
    const isContentScript = typeof window !== 'undefined' &&
      window.location &&
      window.location.href &&
      !window.location.href.startsWith('chrome-extension://');

    if (isContentScript) {
      console.log('Running in content script, Google login required');
      throw new Error('Google login required. Please open extension popup to sign in.');
    }

    // Attempt 1: Chrome profile email (silent mode)
    if (!interactive) {
      console.log('Trying chrome.identity.getProfileUserInfo()...');
      console.log('chrome.identity available:', !!chrome.identity);
      console.log('chrome.identity.getProfileUserInfo available:', !!chrome.identity?.getProfileUserInfo);

      if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getProfileUserInfo) {
        const userInfo = await chrome.identity.getProfileUserInfo();
        console.log('Profile user info:', userInfo);

        if (userInfo.email) {
          const userId = `chrome:${userInfo.email}`;
          console.log('Success! Using Chrome profile email:', userId);
          return userId;
        }
      }
    }

    // Attempt 2: Google OAuth token
    console.log('Trying Google OAuth token...');
    try {
      if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getAuthToken) {
        console.log('chrome.identity.getAuthToken available:', !!chrome.identity.getAuthToken);

        const tokenResult = await chrome.identity.getAuthToken({
          interactive,
        });

        console.log('Token result:', tokenResult);

        const token = tokenResult.token || tokenResult;

        if (token && typeof token === 'string') {
          console.log('Got Google token, fetching user info...');
          console.log('Token type:', typeof token);
          console.log('Token length:', token.length);

          const response = await fetch(
            `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`
          );
          const data = await response.json();
          console.log('Google user info:', data);

          if (data.email) {
            const userId = `google:${data.email}`;
            console.log('Success! Using Google account email:', userId);
            return userId;
          }
        } else {
          console.log('No token received from getAuthToken');
          console.log('Token result type:', typeof tokenResult);
          console.log('Token result:', tokenResult);
        }
      } else {
        console.log('chrome.identity.getAuthToken not available');
      }
    } catch (oauthError) {
      console.log('Google OAuth failed (expected if not logged in):', oauthError);
    }

    if (interactive) {
      throw new Error('Failed to sign in with Google. Please try again.');
    } else {
      throw new Error('Google login required. Please sign in with Google to use this extension.');
    }
  } catch (e) {
    console.error('Failed to get user identity:', e);
    throw e;
  }
}

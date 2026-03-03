import { createLeetSrsButton, extractProblemData, RatingMenu, setupLeetcodeAutoReset, Tooltip } from '@/utils/content';
import { sendMessage, MessageType } from '@/shared/messages';
import type { Grade } from 'ts-fsrs';
import { i18n } from '@/shared/i18n';
import { getUserId } from '@/services/user';

// Helper functions - must be defined before defineContentScript
function getLeetCodeUsername(): string {
  try {
    // Try to get username from various LeetCode page elements
    const usernameSelectors = [
      '[data-e2e-locator="username"]',
      '.text-label-1',
      '.flex.items-center .text-sm',
      'a[href*="/problems/"]',
      '.navbar-profile-link'
    ];

    for (const selector of usernameSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        if (text && text.length > 0 && text.length < 50) {
          return text;
        }
      }
    }

    // Try to get from URL
    const urlMatch = window.location.pathname.match(/\/u\/([^\/]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    return 'unknown';
  } catch (error) {
    console.error('Failed to get LeetCode username:', error);
    return 'unknown';
  }
}

function showLoginRequiredMessage() {
  try {
    // Create a login required message element
    const loginDiv = document.createElement('div');
    loginDiv.id = 'leetsrs-login-required';
    loginDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(239, 68, 68, 0.9);
      color: white;
      padding: 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 10000;
      max-width: 300px;
      line-height: 1.4;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    loginDiv.innerHTML = `
      <div><strong>⚠️ Google Login Required</strong></div>
      <div style="margin-top: 4px;">Please open the extension popup and sign in with Google to use LeetSRS.</div>
      <div style="margin-top: 8px;">
        <button onclick="this.parentElement.remove()" style="
          background: white;
          color: #dc2626;
          border: none;
          padding: 4px 8px;
          border-radius: 2px;
          font-size: 10px;
          cursor: pointer;
          font-weight: bold;
        ">Hide</button>
      </div>
    `;

    // Remove existing login message if present
    const existing = document.getElementById('leetsrs-login-required');
    if (existing) {
      existing.remove();
    }

    // Add to page
    document.body.appendChild(loginDiv);

    // Auto-hide after 15 seconds
    setTimeout(() => {
      if (loginDiv.parentElement) {
        loginDiv.remove();
      }
    }, 15000);
  } catch (error) {
    console.error('Failed to show login required message:', error);
  }
}

function showDebugInfo(userId: string, leetcodeUsername: string) {
  try {
    // Create a debug info element
    const debugDiv = document.createElement('div');
    debugDiv.id = 'leetsrs-debug-info';
    debugDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      z-index: 10000;
      max-width: 300px;
      line-height: 1.3;
    `;
    debugDiv.innerHTML = `
      <div><strong>LeetSRS Debug</strong></div>
      <div>User ID: ${userId}</div>
      <div>LeetCode: ${leetcodeUsername}</div>
      <div style="margin-top: 4px;">
        <button onclick="this.parentElement.remove()" style="
          background: #ff4444;
          color: white;
          border: none;
          padding: 2px 6px;
          border-radius: 2px;
          font-size: 10px;
          cursor: pointer;
        ">Hide</button>
      </div>
    `;

    // Remove existing debug info if present
    const existing = document.getElementById('leetsrs-debug-info');
    if (existing) {
      existing.remove();
    }

    // Add to page
    document.body.appendChild(debugDiv);

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (debugDiv.parentElement) {
        debugDiv.remove();
      }
    }, 10000);
  } catch (error) {
    console.error('Failed to show debug info:', error);
  }
}

export default defineContentScript({
  matches: ['*://*.leetcode.com/*'],
  runAt: 'document_idle',
  async main() {
    // Wake up service worker so it's ready when user interacts
    try {
      await sendMessage({ type: MessageType.PING });
    } catch (error) {
      console.error('Failed to ping service worker:', (error as Error).message);
    }

    // Get and display user ID for debugging
    try {
      const userId = await getUserId();
      console.log('🔍 [LeetCode Content] Current User ID:', userId);

      // Also show LeetCode user info if available
      const leetcodeUsername = getLeetCodeUsername();
      console.log('👤 [LeetCode Content] LeetCode Username:', leetcodeUsername);

      // Create a debug info element
      showDebugInfo(userId, leetcodeUsername);
    } catch (error) {
      console.error('Google login required:', (error as Error).message);
      // Show login required message instead of debug info
      showLoginRequiredMessage();
    }

    setupLeetSrsButton();
    setupLeetcodeAutoReset();
  },
});

async function withProblemData<T>(
  action: (problemData: NonNullable<Awaited<ReturnType<typeof extractProblemData>>>) => Promise<T>
): Promise<T | undefined> {
  const problemData = await extractProblemData();
  if (!problemData) {
    console.error('Could not extract problem data');
    return undefined;
  }

  try {
    return await action(problemData);
  } catch (error) {
    console.error('Error processing action:', error);
    return undefined;
  }
}

function setupLeetSrsButton() {
  const BUTTON_ID = 'leetsrs-button-wrapper';
  const tooltip = new Tooltip();

  function insertButton(buttonsContainer: Element) {
    // Don't insert if already present
    if (buttonsContainer.querySelector(`#${BUTTON_ID}`)) {
      return;
    }

    let ratingMenu: RatingMenu | null = null;

    const buttonWrapper = createLeetSrsButton(() => {
      if (ratingMenu) {
        ratingMenu.toggle();
      }
    });
    buttonWrapper.id = BUTTON_ID;

    // Setup rating menu
    ratingMenu = new RatingMenu(
      buttonWrapper,
      async (rating, label) => {
        await withProblemData(async (problemData) => {
          const result = await sendMessage({
            type: MessageType.RATE_CARD,
            slug: problemData.titleSlug,
            name: problemData.title,
            rating: rating as Grade,
            leetcodeId: problemData.questionFrontendId,
            difficulty: problemData.difficulty,
            tags: problemData.topicTags || [],
          });
          console.log(`${label} - Card rated:`, result);

          // Sync to Notion if enabled
          console.log('Attempting to sync to Notion...', {
            problem: {
              id: Number(problemData.questionFrontendId),
              slug: problemData.titleSlug,
              title: problemData.title,
              difficulty: problemData.difficulty,
              tags: problemData.topicTags || [],
            },
            rating: rating === 1 ? 'Again' :
              rating === 2 ? 'Hard' :
                rating === 3 ? 'Good' : 'Easy',
          });

          try {
            const syncMessage = {
              type: MessageType.SYNC_TO_NOTION,
              problem: {
                id: Number(problemData.questionFrontendId),
                slug: problemData.titleSlug,
                title: problemData.title,
                difficulty: problemData.difficulty,
                tags: problemData.topicTags || [],
              },
              rating: rating === 1 ? 'Again' as const :
                rating === 2 ? 'Hard' as const :
                  rating === 3 ? 'Good' as const : 'Easy' as const,
            };
            console.log('Sending sync message:', syncMessage);

            const result = await sendMessage(syncMessage);
            console.log('Notion sync message sent successfully, result:', result);
          } catch (e) {
            console.error('Notion sync failed:', e);
            console.error('Error details:', (e as Error).message, (e as Error).stack);
            // Don't block the UI, just log the error
          }

          return result;
        });
      },
      async () => {
        await withProblemData(async (problemData) => {
          const result = await sendMessage({
            type: MessageType.ADD_CARD,
            slug: problemData.titleSlug,
            name: problemData.title,
            leetcodeId: problemData.questionFrontendId,
            difficulty: problemData.difficulty,
          });
          console.log('Add without rating - Card added:', result);
          return result;
        });
      }
    );

    // Setup tooltip
    const clickableDiv = buttonWrapper.querySelector('[data-state="closed"]') as HTMLElement;
    if (clickableDiv) {
      clickableDiv.addEventListener('mouseenter', () => {
        tooltip.show(clickableDiv, i18n.app.name);
      });

      clickableDiv.addEventListener('mouseleave', () => {
        tooltip.hide();
      });
    }

    // Insert before the last button group (the notes button)
    const lastButtonGroup = buttonsContainer.lastElementChild;

    try {
      buttonsContainer.insertBefore(buttonWrapper, lastButtonGroup);
    } catch (error) {
      console.error('Error adding LeetSRS button:', error);
    }
  }

  const tryInsertButton = () => {
    const buttonsContainer = document.querySelector('#ide-top-btns');
    if (buttonsContainer) {
      insertButton(buttonsContainer);
    }
  };
  tryInsertButton();

  // Use MutationObserver to handle SPA navigation and React re-renders.
  const observer = new MutationObserver(tryInsertButton);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

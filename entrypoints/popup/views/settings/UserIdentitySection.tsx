import { storage } from '#imports';
import { useState, useEffect } from 'react';
import { getUserId } from '@/services/user';

export function UserIdentitySection() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      // Get and display current user ID for debugging
      try {
        const userId = await getUserId();
        setCurrentUserId(userId);
        setIsLoggedIn(true);
        console.log('Current user ID:', userId);
      } catch (error) {
        console.error('Failed to get user ID:', error);
        setCurrentUserId('Not logged in');
        setIsLoggedIn(false);
      }
    })();
  }, []);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      console.log('Attempting Google sign in...');
      const userId = await getUserId(true); 
      setCurrentUserId(userId);
      setIsLoggedIn(true);
      console.log('Successfully got user ID with interactive mode:', userId);
      alert('Successfully signed in! User ID: ' + userId);
    } catch (error) {
      console.error('Failed to sign in with Google:', error);
      alert('Failed to sign in with Google: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        User Identity
      </h3>
      
      {/* Login Status */}
      <div className={`p-3 rounded-lg ${isLoggedIn ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
        <div className="text-sm font-medium mb-2">
          {isLoggedIn ? '✅ Google Account Connected' : '❌ Google Login Required'}
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {isLoggedIn 
            ? 'Your Google account is connected and ready to use.'
            : 'You must sign in with Google to use this extension.'
          }
        </div>
      </div>

      {/* User ID Display */}
      {isLoggedIn && (
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current User ID:
          </div>
          <div className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all bg-white dark:bg-gray-900 p-2 rounded border">
            {currentUserId}
          </div>
        </div>
      )}

      {/* Google Sign-in Button */}
      {!isLoggedIn && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Sign in with Google to use LeetSRS. Your Google email will be used as your user ID.
          </div>
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      )}
    </div>
  );
}

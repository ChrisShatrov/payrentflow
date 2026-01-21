import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const LAST_ACTIVITY_KEY = 'last_activity_timestamp';

/**
 * Hook to automatically log out users after 10 minutes of inactivity
 * Works even when the tab is inactive (using Page Visibility API)
 * Persists last activity time to handle cases where user returns after days
 */
export function useInactivityLogout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Get last activity from localStorage, or use current time if not found
  const getInitialLastActivity = () => {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  };
  const lastActivityRef = useRef<number>(getInitialLastActivity());
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async () => {
    if (user) {
      console.log('Auto-logging out due to inactivity');
      // Clear stored activity time
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      await signOut();
      navigate('/auth', { replace: true });
    }
  }, [user, signOut, navigate]);

  const resetTimer = useCallback(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only set timer if user is logged in
    if (user) {
      const now = Date.now();
      lastActivityRef.current = now;
      // Persist to localStorage
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      
      // Set new timeout for inactivity
      timeoutRef.current = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, handleLogout]);

  // Handle user activity events
  useEffect(() => {
    if (!user) {
      // Clear timer and stored activity if user is not logged in
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return;
    }

    // Check if user has been inactive for too long (e.g., returning after days)
    const timeSinceLastActivity = Date.now() - lastActivityRef.current;
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      // Already exceeded timeout, log out immediately
      handleLogout();
      return;
    }

    // Events that indicate user activity
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown',
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is now hidden - check how long it's been since last activity
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        
        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
          // Already exceeded timeout, log out immediately
          handleLogout();
        } else {
          // Set a timeout for when the tab becomes visible again
          // This ensures logout happens even if tab is inactive
          const remainingTime = INACTIVITY_TIMEOUT - timeSinceLastActivity;
          
          if (visibilityTimeoutRef.current) {
            clearTimeout(visibilityTimeoutRef.current);
          }
          
          visibilityTimeoutRef.current = setTimeout(() => {
            // Check if tab is still hidden when timeout fires
            if (document.hidden) {
              handleLogout();
            } else {
              // Tab became visible, reset the timer
              resetTimer();
            }
          }, remainingTime);
        }
      } else {
        // Tab is now visible - clear visibility timeout and reset main timer
        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
          visibilityTimeoutRef.current = null;
        }
        resetTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [user, resetTimer, handleLogout]);

  // Also check on window focus (in case user switches tabs/apps)
  useEffect(() => {
    if (!user) return;

    const handleFocus = () => {
      // When window regains focus, check if enough time has passed
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        handleLogout();
      } else {
        resetTimer();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, resetTimer, handleLogout]);
}

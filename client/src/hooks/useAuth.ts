import { usePrivy } from '@privy-io/react-auth';
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { setAuthToken, apiRequest } from '@/lib/queryClient';

export function useAuth() {
  const { toast } = useToast();
  const {
    ready,
    authenticated,
    user,
    login,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  const [stableAuthenticated, setStableAuthenticated] = useState(authenticated);
  const [tokenReady, setTokenReady] = useState(false);

  // Stabilize authentication state and set auth token for API requests
  useEffect(() => {
    let cancelled = false;
    if (!ready) return;

    // Only update stable state after Privy is ready
    setStableAuthenticated(authenticated);

    // Logged out path: clear token and continue immediately
    if (!authenticated || !getAccessToken) {
      setAuthToken(null);
      setTokenReady(true);
      return;
    }

    // Logged in path: do not expose user-dependent queries until token is cached
    setTokenReady(false);
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          setAuthToken(token);
          console.debug('Privy auth token cached for API requests');

          // Check for stored referral code and report it to the backend
          const storedReferralCode = localStorage.getItem("referralCode");
          if (storedReferralCode) {
            try {
              await apiRequest('POST', '/api/referrals/apply', { referralCode: storedReferralCode });
              localStorage.removeItem("referralCode");
            } catch (err) {
              console.error('Failed to apply referral code:', err);
            }
          }
        } else {
          setAuthToken(null);
        }
      } catch (err) {
        console.error('Failed to get Privy access token:', err);
        setAuthToken(null);
      } finally {
        if (!cancelled) setTokenReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, ready, getAccessToken]);

  const logout = async () => {
    try {
      await privyLogout();
      // Force redirect to home page after logout
      window.location.replace('/');
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message || "Failed to logout",
        variant: "destructive",
      });
    }
  };

  return {
    user: stableAuthenticated && tokenReady ? user : null,
    isLoading: !ready || (stableAuthenticated && !tokenReady),
    isAuthenticated: stableAuthenticated,
    login,
    logout,
    isLoggingOut: false,
  };
}

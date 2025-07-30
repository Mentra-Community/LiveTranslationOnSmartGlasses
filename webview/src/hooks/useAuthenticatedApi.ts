import { useMentraAuth } from '@mentra/react';
import { useCallback } from 'react';

/**
 * Hook to get authenticated API configuration
 */
export function useAuthenticatedApi() {
  const { frontendToken, isAuthenticated, isLoading } = useMentraAuth();

  const getHeaders = useCallback(() => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (frontendToken) {
      headers['Authorization'] = `Bearer ${frontendToken}`;
    }

    return headers;
  }, [frontendToken]);

  const getAuthQuery = useCallback(() => {
    // For SSE connections that don't support headers
    return frontendToken ? `?token=${encodeURIComponent(frontendToken)}` : '';
  }, [frontendToken]);

  return {
    getHeaders,
    getAuthQuery,
    isAuthenticated,
    isLoading,
    token: frontendToken,
  };
}
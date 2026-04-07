import { useMentraAuth } from '@mentra/react';
import { useCallback } from 'react';
import { terminal } from 'virtual:terminal';

/**
 * Hook to get authenticated API configuration
 */
export function useAuthenticatedApi() {
  const { frontendToken, isAuthenticated, isLoading } = useMentraAuth();
  
  terminal.log('useAuthenticatedApi - Auth state:', {
    isAuthenticated,
    isLoading,
    hasToken: !!frontendToken,
    tokenPreview: frontendToken ? frontendToken.substring(0, 20) + '...' : 'none'
  });

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
    const query = frontendToken ? `?token=${encodeURIComponent(frontendToken)}` : '';
    terminal.log('getAuthQuery - Generated query:', query ? 'Has token query' : 'No token');
    return query;
  }, [frontendToken]);

  return {
    getHeaders,
    getAuthQuery,
    isAuthenticated,
    isLoading,
    token: frontendToken,
  };
}
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8069';

// Configure axios to always send credentials (cookies)
axios.defaults.withCredentials = true;

// Storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const WS_TOKEN_KEY = 'ws_token';
const USER_EMAIL_KEY = 'user_email';

interface AuthState {
  isAuthenticated: boolean;
  user: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Set up authentication headers for axios if token exists
 */
function setupAuthHeaders() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return true;
  }
  return false;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: localStorage.getItem(USER_EMAIL_KEY),
    isLoading: true,
    error: null
  });

  // Set up auth headers on mount
  useEffect(() => {
    // If we have a token stored, set up auth headers and mark as authenticated
    if (setupAuthHeaders() && localStorage.getItem(USER_EMAIL_KEY)) {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        user: localStorage.getItem(USER_EMAIL_KEY),
        isLoading: false
      }));
    }
  }, []);

  // Verify if the user is already authenticated
  const checkAuth = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Set up auth headers in case they weren't set
    setupAuthHeaders();
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/verify`);
      
      if (response.data.authenticated) {
        // Update local storage with user info
        localStorage.setItem(USER_EMAIL_KEY, response.data.user);
        
        setAuthState({
          isAuthenticated: true,
          user: response.data.user,
          isLoading: false,
          error: null
        });
      } else {
        // Clear tokens if verification fails
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(WS_TOKEN_KEY);
        localStorage.removeItem(USER_EMAIL_KEY);
        delete axios.defaults.headers.common['Authorization'];
        
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      console.log('Auth check error:', error);
      
      // Clear tokens on error
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(WS_TOKEN_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
      delete axios.defaults.headers.common['Authorization'];
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: 'Authentication failed'
      });
    }
  }, []);

  // Request verification code
  const requestCode = useCallback(async (email: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log(`Requesting code for ${email} from ${API_BASE_URL}/api/auth/request-code`);
      const response = await axios.post(`${API_BASE_URL}/api/auth/request-code`, { email });
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: null
      }));
      
      return response.data;
    } catch (error) {
      console.log('Request code error:', error);
      let errorMessage = 'Failed to request verification code';
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: errorMessage
      }));
      
      throw new Error(errorMessage);
    }
  }, []);

  // Verify code and sign in
  const verifyCode = useCallback(async (email: string, code: string) => {
    console.log(`🔑 Verifying code for ${email}...`);
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log(`📤 Sending verification request to ${API_BASE_URL}/api/auth/verify-code`);
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-code`, { email, code });
      
      console.log('✅ Verification successful:', response.data);
      
      if (response.data.token) {
        console.log(`💾 Storing authentication token (length: ${response.data.token.length})`);
        
        // Store token in localStorage for cross-domain use
        localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
        localStorage.setItem(WS_TOKEN_KEY, response.data.token);
        localStorage.setItem(USER_EMAIL_KEY, email);
        
        // Set axios default authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      } else {
        console.warn('⚠️ No token received in response');
      }
      
      setAuthState({
        isAuthenticated: true,
        user: email,
        isLoading: false,
        error: null
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ Verify code error:', error);
      let errorMessage = 'Failed to verify code';
      
      if (axios.isAxiosError(error)) {
        console.error('  Response:', error.response?.data);
        console.error('  Status:', error.response?.status);
        
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        }
      }
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: errorMessage
      }));
      
      throw new Error(errorMessage);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
      
      // Remove tokens and auth headers
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(WS_TOKEN_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
      delete axios.defaults.headers.common['Authorization'];
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.log('Logout error:', error);
      
      // Still remove tokens even if server logout fails
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(WS_TOKEN_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
      delete axios.defaults.headers.common['Authorization'];
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      });
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    // Only check with the server if we don't have a token already
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
      checkAuth();
    }
  }, [checkAuth]);

  return {
    ...authState,
    requestCode,
    verifyCode,
    logout,
    refreshAuth: checkAuth
  };
}
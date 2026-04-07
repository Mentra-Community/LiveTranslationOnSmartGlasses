import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

type MessageHandler = (data: any) => void;

interface UseWebSocketOptions {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
}

export function useWebSocket(
  url: string,
  token?: string,
  options: UseWebSocketOptions = {}
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageHandlersRef = useRef<Record<string, MessageHandler[]>>({});
  const lastPongRef = useRef<number>(Date.now());
  
  const {
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    reconnectAttempts = 5,
    heartbeatInterval = 15000 // 15 seconds
  } = options;

  // Send heartbeat ping
  const sendHeartbeat = useCallback(() => {
    if (webSocketRef.current && isConnected) {
      // Check if we've received a pong since the last ping
      const now = Date.now();
      if (now - lastPongRef.current > heartbeatInterval * 2) {
        console.warn('No response to heartbeat, reconnecting...');
        // No pong received in a reasonable time, reconnect
        if (webSocketRef.current) {
          webSocketRef.current.close();
        }
        return;
      }
      
      try {
        webSocketRef.current.send(JSON.stringify({
          type: 'ping',
          timestamp: now
        }));
      } catch (error) {
        console.error('Error sending heartbeat:', error);
        if (webSocketRef.current) {
          webSocketRef.current.close();
        }
      }
    }
  }, [isConnected, heartbeatInterval]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Don't try to reconnect if we're already connecting or there's no URL or token
    if (!url || (token === undefined)) {
      console.log('WebSocket connection skipped - no url or token');
      return;
    }
    
    // Clear any existing heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // Close existing connection properly if any
    if (webSocketRef.current) {
      try {
        if (webSocketRef.current.readyState === WebSocket.OPEN) {
          webSocketRef.current.close(1000, "Normal closure, reconnecting");
        } else {
          // Force terminate if not open
          webSocketRef.current = null;
        }
      } catch (e) {
        console.error('Error closing existing WebSocket:', e);
        webSocketRef.current = null;
      }
    }

    try {
      // Append token as query parameter if provided
      const wsUrl = token ? `${url}?token=${token}` : url;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      webSocketRef.current = ws;

      // Setup connection timeout
      const connectionTimeoutId = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('WebSocket connection timeout');
          
          // Use a valid close code in the allowed range
          try {
            if (ws.readyState === WebSocket.CONNECTING) {
              ws.close(3000, "Connection timeout");
            }
          } catch (e) {
            console.error('Error closing timed out WebSocket:', e);
          }
        }
      }, 10000); // 10 second connection timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeoutId);
        console.log('WebSocket connection opened');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        
        // Start heartbeat interval - wait a moment to ensure server is ready
        setTimeout(() => {
          lastPongRef.current = Date.now(); // Reset last pong time
          if (!heartbeatIntervalRef.current) {
            heartbeatIntervalRef.current = window.setInterval(sendHeartbeat, heartbeatInterval);
          }
        }, 1000);
        
        onOpen?.();
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeoutId);
        console.log(`WebSocket connection closed, code: ${event.code}, reason: ${event.reason}`);
        setIsConnected(false);
        
        // Clear heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        
        onClose?.();
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          attemptReconnect();
        }
      };

      ws.onerror = (event) => {
        clearTimeout(connectionTimeoutId);
        console.error('WebSocket error:', event);
        setError(new Error('WebSocket connection error'));
        onError?.(event);
        
        // Close the connection on error - use standard close code 1000
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1000, "Closing after error");
          }
        } catch (e) {
          console.error('Error closing WebSocket after error:', e);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { type } = data;
          
          // Update last pong time for heartbeat check
          if (type === 'pong') {
            lastPongRef.current = Date.now();
            return;
          }
          
          // Automatically respond to ping with pong
          if (type === 'ping') {
            try {
              ws.send(JSON.stringify({
                type: 'pong',
                timestamp: Date.now()
              }));
            } catch (e) {
              console.error('Error sending pong:', e);
            }
            return;
          }
          
          // Call registered handlers for this message type
          if (type && messageHandlersRef.current[type]) {
            messageHandlersRef.current[type].forEach(handler => handler(data));
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
    } catch (err) {
      console.error('Error connecting to WebSocket:', err);
      setError(err instanceof Error ? err : new Error('Failed to connect to WebSocket'));
      attemptReconnect();
    }
  }, [url, token, heartbeatInterval, onOpen, onClose, onError, sendHeartbeat]);

  // Attempt to reconnect
  const attemptReconnect = useCallback(() => {
    if (
      reconnectAttemptsRef.current < reconnectAttempts &&
      !reconnectTimeoutRef.current
    ) {
      console.log(`Attempting to reconnect in ${reconnectInterval}ms (attempt ${reconnectAttemptsRef.current + 1}/${reconnectAttempts})`);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = null;
        connect();
      }, reconnectInterval);
    } else if (reconnectAttemptsRef.current >= reconnectAttempts) {
      console.log(`Max reconnect attempts (${reconnectAttempts}) reached. Giving up.`);
    }
  }, [connect, reconnectAttempts, reconnectInterval]);

  // Send a message
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!webSocketRef.current) {
      console.warn('Cannot send message: No WebSocket connection');
      return false;
    }
    
    if (webSocketRef.current.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot send message: WebSocket not in OPEN state (state: ${webSocketRef.current.readyState})`);
      return false;
    }
    
    try {
      webSocketRef.current.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, []);

  // Register a message handler
  const addMessageHandler = useCallback((type: string, handler: MessageHandler) => {
    if (!messageHandlersRef.current[type]) {
      messageHandlersRef.current[type] = [];
    }
    messageHandlersRef.current[type].push(handler);
    
    // Return function to remove this handler
    return () => {
      if (messageHandlersRef.current[type]) {
        messageHandlersRef.current[type] = messageHandlersRef.current[type].filter(h => h !== handler);
      }
    };
  }, []);

  // Initialize connection
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [connect, url, token]);

  return {
    isConnected,
    error,
    sendMessage,
    addMessageHandler,
    reconnect: connect
  };
}
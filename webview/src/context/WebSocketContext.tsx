import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (message: any) => boolean;
  addMessageHandler: (type: string, handler: (data: any) => void) => () => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  url: string;
  token?: string;
}

export function WebSocketProvider({ children, url, token }: WebSocketProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const {
    isConnected,
    sendMessage,
    addMessageHandler,
    reconnect
  } = useWebSocket(
    url,
    token,
    {
      heartbeatInterval: 20000, // 20 seconds
      reconnectInterval: 3000,  // 3 seconds
      reconnectAttempts: 10,
      onOpen: () => {
        console.log('🌐 WebSocket connection established (context provider)');
        setIsReady(true);
      },
      onClose: () => {
        console.log('🌐 WebSocket connection closed (context provider)');
        setIsReady(false);
      },
      onError: () => {
        console.error('🌐 WebSocket error occurred (context provider)');
        setIsReady(false);
      }
    }
  );

  // Create a function that wraps sendMessage to prevent sending before connected
  const safeSendMessage = (message: any) => {
    if (!isConnected) {
      console.warn('Cannot send message: WebSocket not connected');
      return false;
    }
    return sendMessage(message);
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        sendMessage: safeSendMessage,
        addMessageHandler,
        reconnect
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
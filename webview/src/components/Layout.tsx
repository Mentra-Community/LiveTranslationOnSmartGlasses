import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { useAuth } from '../hooks/useAuth';

const Layout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const navigation = [
    { name: 'Live', href: '/' },
    { name: 'Recordings', href: '/recordings' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Navigation */}
      <header className="w-full py-4 px-6 border-b border-secondary">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold">
              Audio Recorder
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden sm:flex sm:space-x-4">
              {navigation.map((item) => {
                const isCurrentPage = 
                  (item.href === '/' && location.pathname === '/') || 
                  (item.href !== '/' && location.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isCurrentPage
                        ? 'bg-secondary/20 text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/10 hover:text-foreground'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          
          {/* User info and Logout */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
            
            {/* Mobile menu button */}
            <div className="sm:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-0"
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="sm:hidden mt-2">
            <div className="flex flex-col gap-1 pb-3 pt-2">
              {navigation.map((item) => {
                const isCurrentPage = 
                  (item.href === '/' && location.pathname === '/') || 
                  (item.href !== '/' && location.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isCurrentPage
                        ? 'bg-secondary/20 text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/10 hover:text-foreground'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1 flex flex-col p-6">
        <div className="w-full max-w-4xl mx-auto">
          <Outlet />
        </div>
      </main>
      
      {/* Footer */}
      <footer className="w-full py-4 px-6 border-t border-secondary">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Audio Recorder for AugmentOS
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
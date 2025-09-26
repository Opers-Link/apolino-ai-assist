import React from 'react';
import { Search, Bell, User } from 'lucide-react';
import { Button } from './button';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Input } from './input';

interface HeaderProps {
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  onSearchChange?: (value: string) => void;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
}

export function Header({ 
  user, 
  onSearchChange, 
  onNotificationClick, 
  onProfileClick 
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="container">
        <a href="/" className="brand">
          <img 
            src="/src/assets/logo-apolar.svg" 
            alt="Apolar Logo" 
            height="32"
          />
        </a>
        
        <nav className="header-actions">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar..."
              className="pl-10 w-64"
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onNotificationClick}
            aria-label="Notificações"
          >
            <Bell className="h-5 w-5" />
          </Button>

          {/* User Profile */}
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-2"
            onClick={onProfileClick}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatarUrl} alt={user?.name} />
              <AvatarFallback>
                {user?.name ? user.name[0].toUpperCase() : <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline-block text-sm font-medium">
              {user?.name || user?.email || 'Usuário'}
            </span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
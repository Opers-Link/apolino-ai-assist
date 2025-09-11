import { useState, useEffect } from 'react';
import ChatBubble from './ChatBubble';
import ChatWindow from './ChatWindow';

const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasUnreadMessage, setHasUnreadMessage] = useState(false);

  // Fechar com ESC
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  // Simular mensagem não lida (pode ser removido em produção)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        setHasUnreadMessage(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleToggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasUnreadMessage(false);
    }
  };

  const handleCloseChat = () => {
    setIsOpen(false);
    setIsFullscreen(false);
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
      <ChatBubble 
        onClick={handleToggleChat}
        isOpen={isOpen}
        hasUnreadMessage={hasUnreadMessage}
      />
      <ChatWindow
        isOpen={isOpen}
        onClose={handleCloseChat}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </>
  );
};

export default FloatingChat;
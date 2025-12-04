import { useState, useEffect } from 'react';
import AIAssistantPanel from './AIAssistantPanel';
import AIAssistantTrigger from './AIAssistantTrigger';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        setHasNotification(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasNotification(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <AIAssistantTrigger 
        onClick={handleOpen}
        hasNotification={hasNotification}
      />
      <AIAssistantPanel 
        isOpen={isOpen}
        onClose={handleClose}
      />
    </>
  );
};

export default AIAssistant;

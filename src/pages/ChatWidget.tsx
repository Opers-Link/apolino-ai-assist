import { useState, useEffect } from 'react';
import AIAssistantPanel from '@/components/chat/AIAssistantPanel';

const ChatWidget = () => {
  const [externalUserId, setExternalUserId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Tentar capturar o ID do usuário via query string (aceita múltiplos aliases)
    const params = new URLSearchParams(window.location.search);
    const ALIASES = ['idusuario', 'idUsuario', 'id_usuario', 'userId', 'user_id', 'externalUserId'];
    for (const alias of ALIASES) {
      const value = params.get(alias)?.trim();
      if (value) {
        setExternalUserId(value);
        break;
      }
    }

    // 2. Escutar postMessage do sistema pai (iframe)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SET_USER_ID' && event.data?.userId) {
        setExternalUserId(event.data.userId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="h-screen w-screen bg-transparent">
      <AIAssistantPanel
        isOpen={true}
        onClose={() => {}}
        isEmbedded
        externalUserId={externalUserId}
      />
    </div>
  );
};

export default ChatWidget;

import AIAssistantPanel from '@/components/chat/AIAssistantPanel';

const ChatWidget = () => {
  return (
    <div className="h-screen w-screen bg-transparent">
      <AIAssistantPanel isOpen={true} onClose={() => {}} isEmbedded />
    </div>
  );
};

export default ChatWidget;

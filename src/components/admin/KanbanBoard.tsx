import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  session_id: string;
  started_at: string;
  ended_at?: string;
  total_messages: number;
  status: string;
  category?: string;
  sentiment?: string;
  tags?: string[];
}

interface KanbanBoardProps {
  conversations: Conversation[];
  onConversationClick: (conversation: Conversation) => void;
}

interface KanbanColumn {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  conversations: Conversation[];
  color: string;
}

export function KanbanBoard({ conversations, onConversationClick }: KanbanBoardProps) {
  const columns = useMemo<KanbanColumn[]>(() => {
    // Organizar conversas por status
    const allConversations = conversations;
    const needsHelp = conversations.filter(c => c.status === 'needs_help');
    const inProgress = conversations.filter(c => c.status === 'in_progress');
    const closed = conversations.filter(c => c.status === 'closed' || c.ended_at);

    return [
      {
        id: 'all',
        title: 'Todos os atendimentos',
        icon: MessageSquare,
        conversations: allConversations,
        color: 'bg-slate-100',
      },
      {
        id: 'needs_help',
        title: 'Precisa de ajuda',
        icon: AlertCircle,
        conversations: needsHelp,
        color: 'bg-yellow-100',
      },
      {
        id: 'in_progress',
        title: 'Em atendimento',
        icon: Clock,
        conversations: inProgress,
        color: 'bg-blue-100',
      },
      {
        id: 'closed',
        title: 'Atendimento encerrado',
        icon: CheckCircle2,
        conversations: closed,
        color: 'bg-green-100',
      },
    ];
  }, [conversations]);

  const formatDateTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true,
        locale: ptBR 
      });
    } catch {
      return 'Data inválida';
    }
  };

  const isInactive = (conversation: Conversation) => {
    return conversation.status === 'closed' || !!conversation.ended_at;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
      {columns.map((column) => (
        <Card key={column.id} className="flex flex-col">
          <CardHeader className={`${column.color} border-b`}>
            <CardTitle className="flex items-center gap-2 text-base">
              <column.icon className="h-5 w-5" />
              {column.title}
              <Badge variant="secondary" className="ml-auto">
                {column.conversations.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-[calc(100vh-240px)]">
              <div className="p-4 space-y-3">
                {column.conversations.map((conversation) => {
                  const inactive = isInactive(conversation);
                  return (
                    <Card
                      key={conversation.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        inactive ? 'border-red-500 border-2 bg-red-50/50' : ''
                      }`}
                      onClick={() => onConversationClick(conversation)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className={`h-4 w-4 ${inactive ? 'text-red-500' : 'text-apolar-blue'}`} />
                            <span className="font-medium text-sm">
                              #{conversation.session_id.slice(0, 8)}
                            </span>
                          </div>
                          {inactive && (
                            <Badge variant="destructive" className="text-xs">
                              Inativa
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDateTime(conversation.started_at)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            <span>{conversation.total_messages} mensagens</span>
                          </div>
                        </div>

                        {conversation.category && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {conversation.category}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                
                {column.conversations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhuma conversa nesta categoria
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

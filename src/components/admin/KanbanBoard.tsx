import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Clock, AlertCircle, CheckCircle2, GripVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  human_requested_at?: string;
  assigned_to?: string;
  assigned_at?: string;
  first_response_time?: number;
  ai_enabled?: boolean;
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

interface DraggableConversationCardProps {
  conversation: Conversation;
  isInactive: boolean;
  formatDateTime: (date: string) => string;
  onClick: () => void;
  isDragDisabled: boolean;
}

function DraggableConversationCard({
  conversation,
  isInactive,
  formatDateTime,
  onClick,
  isDragDisabled
}: DraggableConversationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: conversation.id,
    disabled: isDragDisabled
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={`cursor-move transition-all hover:shadow-md ${
          isInactive ? 'border-red-500 border-2 bg-red-50/50' : ''
        } ${isDragging ? 'ring-2 ring-primary' : ''}`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <MessageSquare className={`h-4 w-4 ${isInactive ? 'text-red-500' : 'text-primary'}`} />
              <span className="font-medium text-sm">
                #{conversation.session_id.slice(0, 8)}
              </span>
            </div>
            {isInactive && (
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
    </div>
  );
}

interface DroppableColumnProps {
  column: KanbanColumn;
  conversations: Conversation[];
  isInactive: (conv: Conversation) => boolean;
  formatDateTime: (date: string) => string;
  onConversationClick: (conv: Conversation) => void;
  isDropDisabled: boolean;
  isOver: boolean;
}

function DroppableColumn({
  column,
  conversations,
  isInactive,
  formatDateTime,
  onConversationClick,
  isDropDisabled,
  isOver
}: DroppableColumnProps) {
  return (
    <Card className={`flex flex-col transition-all duration-300 bg-white/70 backdrop-blur-xl border ${
      isOver && !isDropDisabled ? 'ring-2 ring-apolar-gold shadow-2xl shadow-apolar-gold/20 scale-[1.02]' : ''
    } ${isDropDisabled ? 'opacity-60' : ''} ${
      column.id === 'needs_help' ? 'border-yellow-200' : ''
    } ${
      column.id === 'in_progress' ? 'border-apolar-blue/20' : ''
    } ${
      column.id === 'closed' ? 'border-green-200' : ''
    } ${
      column.id === 'all' ? 'border-apolar-gold/20' : ''
    }`}>
      <CardHeader className={`border-b backdrop-blur-sm transition-all ${
        column.id === 'needs_help' ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-200' : ''
      } ${
        column.id === 'in_progress' ? 'bg-gradient-to-r from-apolar-blue/10 to-apolar-blue/5 border-apolar-blue/20' : ''
      } ${
        column.id === 'closed' ? 'bg-gradient-to-r from-green-100 to-green-50 border-green-200' : ''
      } ${
        column.id === 'all' ? 'bg-gradient-to-r from-apolar-gold/10 to-apolar-gold/5 border-apolar-gold/20' : ''
      }`}>
        <CardTitle className="flex items-center gap-3 text-base">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-md ${
            column.id === 'needs_help' ? 'bg-gradient-to-br from-yellow-400 to-yellow-500' : ''
          } ${
            column.id === 'in_progress' ? 'bg-gradient-to-br from-apolar-blue to-apolar-blue-dark' : ''
          } ${
            column.id === 'closed' ? 'bg-gradient-to-br from-green-500 to-green-600' : ''
          } ${
            column.id === 'all' ? 'bg-gradient-to-br from-apolar-gold to-apolar-gold-alt' : ''
          }`}>
            <column.icon className="h-5 w-5 text-white" />
          </div>
          <span className={`font-bold ${
            column.id === 'needs_help' ? 'text-yellow-700' : ''
          } ${
            column.id === 'in_progress' ? 'text-apolar-blue' : ''
          } ${
            column.id === 'closed' ? 'text-green-700' : ''
          } ${
            column.id === 'all' ? 'text-apolar-gold-alt' : ''
          }`}>
            {column.title}
          </span>
          <Badge 
            variant="secondary" 
            className={`ml-auto font-bold ${
              column.id === 'needs_help' ? 'bg-yellow-200 text-yellow-800' : ''
            } ${
              column.id === 'in_progress' ? 'bg-apolar-blue/20 text-apolar-blue' : ''
            } ${
              column.id === 'closed' ? 'bg-green-200 text-green-800' : ''
            } ${
              column.id === 'all' ? 'bg-apolar-gold/30 text-apolar-gold-alt' : ''
            }`}
          >
            {conversations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <ScrollArea className="h-[calc(100vh-240px)]">
          <div className="p-4 space-y-3 min-h-[200px]">
            <SortableContext
              items={conversations.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {conversations.map((conversation) => (
                <DraggableConversationCard
                  key={conversation.id}
                  conversation={conversation}
                  isInactive={isInactive(conversation)}
                  formatDateTime={formatDateTime}
                  onClick={() => onConversationClick(conversation)}
                  isDragDisabled={isDropDisabled || isInactive(conversation)}
                />
              ))}
            </SortableContext>
            
            {conversations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {isDropDisabled 
                  ? 'Não é possível mover atendimentos para esta coluna'
                  : 'Nenhuma conversa nesta categoria'
                }
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function KanbanBoard({ conversations, onConversationClick }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const columns = useMemo<KanbanColumn[]>(() => {
    const allConversations = conversations;
    const needsHelp = conversations.filter(c => 
      (c.status === 'needs_help' || c.tags?.includes('humano_solicitado')) &&
      c.status !== 'closed'
    );
    const inProgress = conversations.filter(c => c.status === 'in_progress');
    const closed = conversations.filter(c => c.status === 'closed');

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

  // Mostra badge "Inativa" apenas para conversas que expiraram por timeout sem solicitar humano
  const isInactive = (conversation: Conversation) => {
    return conversation.status === 'inactive';
  };

  const findColumnByConversationId = (id: string) => {
    return columns.find(col => 
      col.conversations.some(conv => conv.id === id)
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string;
    
    // Check if over a column or a card
    const overColumn = columns.find(col => col.id === overId);
    if (overColumn) {
      setOverId(overId);
    } else {
      // If over a card, find which column it belongs to
      const columnWithCard = columns.find(col => 
        col.conversations.some(conv => conv.id === overId)
      );
      if (columnWithCard) {
        setOverId(columnWithCard.id);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const conversationId = active.id as string;
    let targetColumnId = over.id as string;

    // If dropped on a card, find the column
    const targetColumn = columns.find(col => col.id === targetColumnId);
    if (!targetColumn) {
      const columnWithCard = columns.find(col => 
        col.conversations.some(conv => conv.id === targetColumnId)
      );
      if (columnWithCard) {
        targetColumnId = columnWithCard.id;
      } else {
        return;
      }
    }

    // Block drops on "all" and "closed" columns
    if (targetColumnId === 'all' || targetColumnId === 'closed') {
      toast({
        title: "Movimento não permitido",
        description: `Não é possível mover atendimentos para esta coluna`,
        variant: "destructive",
      });
      return;
    }

    const sourceColumn = findColumnByConversationId(conversationId);
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (!conversation || !sourceColumn) return;

    // Block moving closed or inactive conversations
    if (conversation.status === 'closed' || conversation.status === 'inactive') {
      toast({
        title: "Movimento não permitido",
        description: conversation.status === 'inactive' 
          ? "Conversas inativas não podem ser movidas"
          : "Atendimentos encerrados não podem ser movidos",
        variant: "destructive",
      });
      return;
    }

    // Same column - do nothing
    if (sourceColumn.id === targetColumnId) return;

    try {
      await handleStatusTransition(
        conversation,
        sourceColumn.id,
        targetColumnId
      );

      toast({
        title: "Atendimento movido",
        description: `Status atualizado com sucesso`,
      });
    } catch (error) {
      console.error('Erro ao mover atendimento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover o atendimento",
        variant: "destructive",
      });
    }
  };

  const handleStatusTransition = async (
    conversation: Conversation,
    fromColumn: string,
    toColumn: string
  ) => {
    const updates: any = {
      status: toColumn,
      updated_at: new Date().toISOString(),
    };

    // needs_help → in_progress (Agent assumes)
    if (fromColumn === 'needs_help' && toColumn === 'in_progress') {
      updates.assigned_to = user?.id;
      updates.assigned_at = new Date().toISOString();
      updates.ai_enabled = false;
      
      if (!conversation.first_response_time && conversation.human_requested_at) {
        const requestedAt = new Date(conversation.human_requested_at);
        const now = new Date();
        updates.first_response_time = Math.floor(
          (now.getTime() - requestedAt.getTime()) / 1000
        );
      }
    }

    // in_progress → needs_help (Return to queue)
    if (fromColumn === 'in_progress' && toColumn === 'needs_help') {
      updates.assigned_to = null;
      updates.assigned_at = null;
    }

    // * → closed (Close conversation)
    if (toColumn === 'closed') {
      updates.ended_at = new Date().toISOString();
      updates.resolved_at = new Date().toISOString();
      updates.status = 'closed';
    }

    const { error } = await supabase
      .from('chat_conversations')
      .update(updates)
      .eq('id', conversation.id);

    if (error) throw error;
  };

  const activeConversation = activeId 
    ? conversations.find(c => c.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
        {columns.map((column) => (
          <DroppableColumn
            key={column.id}
            column={column}
            conversations={column.conversations}
            isInactive={isInactive}
            formatDateTime={formatDateTime}
            onConversationClick={onConversationClick}
            isDropDisabled={column.id === 'all' || column.id === 'closed'}
            isOver={overId === column.id}
          />
        ))}
      </div>

      <DragOverlay>
        {activeConversation && (
          <Card className="cursor-move shadow-2xl rotate-3 opacity-90">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">
                  #{activeConversation.session_id.slice(0, 8)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}

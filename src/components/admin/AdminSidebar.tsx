import { LayoutDashboard, MessageSquare, UserCircle, Settings, Users, FileUp, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import aiaLogo from "@/assets/aia-logo.png";

const mainMenuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    value: "dashboard",
  },
  {
    title: "Conversas",
    icon: MessageSquare,
    value: "conversations",
  },
  {
    title: "Atendimentos",
    icon: UserCircle,
    value: "atendimentos",
  },
  {
    title: "Insights Manual",
    icon: FileUp,
    value: "manual-insights",
  },
];

const settingsMenuItems = [
  {
    title: "Configurações",
    icon: Settings,
    value: "settings",
  },
  {
    title: "FAQ",
    icon: HelpCircle,
    value: "faq",
  },
  {
    title: "Usuários",
    icon: Users,
    value: "users",
  },
];

const getUserInitials = (email?: string) => {
  if (!email) return "AD";
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
};

const getUserName = (email?: string) => {
  if (!email) return "Admin";
  return email.split('@')[0]
    .split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const { user } = useAuth();

  return (
    <Sidebar className="border-r border-apolar-blue/10">
      <SidebarHeader className="p-6 border-b border-apolar-blue/10 bg-gradient-to-br from-apolar-blue to-apolar-blue-dark">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 flex items-center justify-center">
            <img 
              src={aiaLogo} 
              alt="AIA Logo" 
              className="h-12 w-12 object-contain drop-shadow-[0_0_8px_rgba(255,204,0,0.6)]"
              style={{ filter: 'brightness(0) saturate(100%) invert(78%) sepia(98%) saturate(1000%) hue-rotate(360deg) brightness(105%) contrast(105%)' }}
            />
          </div>
          <div className="text-white flex-1">
            <h2 className="font-bold text-base leading-tight bg-gradient-to-r from-apolar-gold via-apolar-gold-alt to-apolar-gold-light bg-clip-text text-transparent">
              AIA
            </h2>
            <p className="text-xs text-white/90 font-medium mt-0.5">Inteligência Artificial</p>
            <p className="text-[10px] text-white/60">Apolar Imóveis</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-8">
        {/* Menu Principal */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider font-semibold mb-3 px-4 text-apolar-blue/70">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => {
                const isActive = activeTab === item.value;
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.value)}
                      className={cn(
                        "w-full justify-start gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                        isActive 
                          ? "bg-gradient-to-r from-apolar-blue to-apolar-blue-dark text-white shadow-lg shadow-apolar-blue/30 font-semibold" 
                          : "hover:bg-apolar-blue/5 hover:translate-x-1 text-apolar-blue"
                      )}
                    >
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                        isActive 
                          ? "bg-white/20 backdrop-blur-sm" 
                          : "bg-apolar-gold/10 group-hover:bg-apolar-gold/20"
                      )}>
                        <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-apolar-blue")} />
                      </div>
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configurações */}
        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="text-xs uppercase tracking-wider font-semibold mb-3 px-4 text-apolar-blue/70">
            Configurações
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsMenuItems.map((item) => {
                const isActive = activeTab === item.value;
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.value)}
                      className={cn(
                        "w-full justify-start gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                        isActive 
                          ? "bg-gradient-to-r from-apolar-blue to-apolar-blue-dark text-white shadow-lg shadow-apolar-blue/30 font-semibold" 
                          : "hover:bg-apolar-blue/5 hover:translate-x-1 text-apolar-blue"
                      )}
                    >
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                        isActive 
                          ? "bg-white/20 backdrop-blur-sm" 
                          : "bg-apolar-gold/10 group-hover:bg-apolar-gold/20"
                      )}>
                        <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-apolar-blue")} />
                      </div>
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-apolar-blue/10 bg-gradient-to-br from-apolar-gold/5 to-transparent">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 backdrop-blur-sm border border-apolar-blue/10 hover:bg-white/70 transition-all cursor-pointer">
          <Avatar className="h-10 w-10 border-2 border-apolar-gold shadow-md">
            <AvatarFallback className="bg-gradient-to-br from-apolar-blue to-apolar-blue-dark text-white font-bold">
              {getUserInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-apolar-blue">
              {getUserName(user?.email)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

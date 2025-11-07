import { LayoutDashboard, MessageSquare, UserCircle, Settings, Users } from "lucide-react";
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
import apolarLogo from "@/assets/apolar-logo-oficial.png";

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
];

const settingsMenuItems = [
  {
    title: "Configurações",
    icon: Settings,
    value: "settings",
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
    <Sidebar className="border-r border-white/10 bg-apolar-blue-dark/60 backdrop-blur-md">
      <SidebarHeader className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img 
            src={apolarLogo} 
            alt="Apolar Logo" 
            className="h-10 w-auto object-contain"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-8">
        {/* Menu Principal */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-white/50 font-semibold mb-3 px-4">
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
                        "w-full justify-start gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                        "text-white/70 hover:bg-white/10 hover:text-white",
                        isActive && "bg-white/15 text-white font-medium"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
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
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-white/50 font-semibold mb-3 px-4">
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
                        "w-full justify-start gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                        "text-white/70 hover:bg-white/10 hover:text-white",
                        isActive && "bg-white/15 text-white font-medium"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-white/10 bg-apolar-blue/5">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarFallback className="bg-apolar-blue text-white font-semibold">
              {getUserInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {getUserName(user?.email)}
            </p>
            <p className="text-xs text-white/60 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

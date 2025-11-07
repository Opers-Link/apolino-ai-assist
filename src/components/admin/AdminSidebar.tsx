import { LayoutDashboard, MessageSquare, UserCircle, Settings, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const menuItems = [
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

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  return (
    <Sidebar className="border-r border-apolar-blue/10 bg-gradient-to-b from-apolar-blue/5 via-apolar-blue/3 to-transparent backdrop-blur-sm">
      <SidebarHeader className="p-6 border-b border-apolar-blue/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-apolar-blue to-apolar-blue-dark flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-apolar-blue">Admin</h2>
            <p className="text-xs text-apolar-blue-med">Painel de controle</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = activeTab === item.value;
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.value)}
                      className={cn(
                        "w-full justify-start gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                        "hover:bg-apolar-blue/10 hover:text-apolar-blue",
                        isActive && "bg-gradient-to-r from-apolar-blue/20 to-apolar-blue/10 text-apolar-blue font-medium shadow-sm border border-apolar-blue/20"
                      )}
                    >
                      <item.icon className={cn(
                        "h-5 w-5",
                        isActive ? "text-apolar-blue" : "text-apolar-blue-med"
                      )} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

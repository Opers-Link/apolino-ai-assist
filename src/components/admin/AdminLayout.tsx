import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { Menu } from "lucide-react";

interface AdminLayoutProps {
  children: (activeTab: string) => React.ReactNode;
}

const getTabTitle = (tab: string) => {
  switch (tab) {
    case 'dashboard':
      return 'Dashboard';
    case 'conversations':
      return 'Conversas';
    case 'atendimentos':
      return 'Atendimentos';
    case 'settings':
      return 'Configurações';
    case 'users':
      return 'Usuários';
    default:
      return 'Dashboard';
  }
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <header className="sticky top-0 z-50 w-full border-b bg-background">
            <div className="flex h-16 items-center px-6 gap-4">
              <SidebarTrigger className="lg:hidden">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {getTabTitle(activeTab)}
                </h1>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            {children(activeTab)}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

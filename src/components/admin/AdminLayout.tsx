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
    case 'manual-insights':
      return 'Insights Manual';
    case 'settings':
      return 'Configurações';
    case 'faq':
      return 'Gerenciar FAQ';
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
      <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-50 via-apolar-gold/5 to-apolar-blue/10 relative overflow-hidden">
        {/* Decorative background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-apolar-gold/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-apolar-blue/5 rounded-full blur-3xl -z-10" />
        
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <header className="sticky top-0 z-50 w-full border-b border-apolar-blue/10 bg-white/70 backdrop-blur-xl shadow-sm">
            <div className="flex h-16 items-center px-6 gap-4">
              <SidebarTrigger className="lg:hidden">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <div>
                <h1 className="text-xl font-semibold bg-gradient-to-br from-apolar-blue to-apolar-blue-dark bg-clip-text text-transparent">
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

import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";

interface AdminLayoutProps {
  children: (activeTab: string) => React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { signOut, user } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <header className="sticky top-0 z-50 w-full border-b border-apolar-blue/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-apolar-blue-med hover:text-apolar-blue">
                  <Menu className="h-5 w-5" />
                </SidebarTrigger>
                <div>
                  <h1 className="text-xl font-semibold text-apolar-blue">Dashboard Administrativo</h1>
                  <p className="text-sm text-apolar-blue-med">Análise completa das conversas do chatbot</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-apolar-blue">{user?.email?.split('@')[0]}</p>
                  <p className="text-xs text-apolar-blue-med">{user?.email}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="border-apolar-blue/20 text-apolar-blue hover:bg-apolar-blue/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
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

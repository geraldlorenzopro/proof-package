import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { FileText, List, Plus, ArrowLeft, Settings, Globe } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Formularios", url: "/dashboard/smart-forms", icon: List, end: true },
  { title: "Nuevo I-765", url: "/dashboard/smart-forms/new", icon: Plus, end: true },
];

function SmartFormsSidebar() {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarContent className="pt-4">
        {/* Back to dashboard */}
        <div className="px-3 mb-4">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={() => navigate("/dashboard")}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-xs">Dashboard</span>}
          </Button>
        </div>

        {/* Branding */}
        {!collapsed && (
          <div className="px-4 mb-6">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              <span className="font-bold text-sm">Smart Forms</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-7">Formularios USCIS</p>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mb-4">
            <FileText className="w-5 h-5 text-accent" />
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="hover:bg-muted/50"
                      activeClassName="bg-accent/15 text-accent font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function SmartFormsLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SmartFormsSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-11 flex items-center border-b border-border/40 bg-card/50 px-3 shrink-0">
            <SidebarTrigger className="text-muted-foreground" />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { usePermissions, UserRole } from "@/hooks/usePermissions";

interface RequireRoleProps {
  roles: UserRole[];
  children: ReactNode;
  /** If true, redirect to /hub instead of rendering an unauthorized page */
  redirectTo?: string;
}

/**
 * Role-based route guard. Use inside <ProtectedRoute> to gate routes
 * that should only be reachable by specific account roles.
 */
export function RequireRole({ roles, children, redirectTo }: RequireRoleProps) {
  const { role, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!roles.includes(role)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <ShieldAlert className="h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-semibold text-foreground">No autorizado</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Solo los administradores de la firma pueden acceder a esta sección.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

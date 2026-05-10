/**
 * <FeatureFlag> — wrapper para release gradual de features.
 *
 * Uso típico:
 *
 *   <FeatureFlag slug="pipeline-dashboard">
 *     <PipelineDashboard />
 *   </FeatureFlag>
 *
 * Si la firma NO tiene el flag activo, no renderiza children.
 * Si lo tiene, sí renderiza.
 *
 * Optional: prop `fallback` para mostrar algo cuando NO está activo
 * (ej: upgrade prompt, "coming soon" message).
 *
 *   <FeatureFlag slug="pipeline-dashboard"
 *                fallback={<UpgradePrompt feature="Pipeline Dashboard" />}>
 *     <PipelineDashboard />
 *   </FeatureFlag>
 *
 * Spec completa en .ai/master/features.md
 */

import { ReactNode } from "react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

interface FeatureFlagProps {
  slug: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureFlag({ slug, children, fallback = null }: FeatureFlagProps) {
  const enabled = useFeatureFlag(slug);
  return enabled ? <>{children}</> : <>{fallback}</>;
}

/**
 * Inverso: muestra children solo si el feature NO está activo.
 * Útil para mostrar upgrade prompts.
 */
export function FeatureFlagOff({ slug, children }: { slug: string; children: ReactNode }) {
  const enabled = useFeatureFlag(slug);
  return enabled ? null : <>{children}</>;
}

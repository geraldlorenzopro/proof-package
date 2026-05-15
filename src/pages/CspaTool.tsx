import CSPACalculator from '@/components/CSPACalculator';
import { useTrackPageView } from "@/hooks/useTrackPageView";

export default function CspaTool() {
  useTrackPageView("tools.cspa");
  return <CSPACalculator />;
}

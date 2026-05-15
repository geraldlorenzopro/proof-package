import AffidavitCalculator from '@/components/AffidavitCalculator';
import { useTrackPageView } from "@/hooks/useTrackPageView";

export default function AffidavitTool() {
  useTrackPageView("tools.affidavit");
  return <AffidavitCalculator />;
}

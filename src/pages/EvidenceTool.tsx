import Index from './Index';
import { useTrackPageView } from "@/hooks/useTrackPageView";

export default function EvidenceTool() {
  useTrackPageView("tools.evidence");
  return <Index />;
}

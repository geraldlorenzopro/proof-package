import { ReactNode } from "react";
import { HUB_SECTIONS, HubSectionKey } from "@/lib/hubSections";
import HubComingSoonPage from "./HubComingSoonPage";

interface Props {
  sectionKey: HubSectionKey;
  children: ReactNode;
}

export default function HubSectionGate({ sectionKey, children }: Props) {
  if (HUB_SECTIONS[sectionKey].enabled) {
    return <>{children}</>;
  }
  return <HubComingSoonPage sectionKey={sectionKey} />;
}

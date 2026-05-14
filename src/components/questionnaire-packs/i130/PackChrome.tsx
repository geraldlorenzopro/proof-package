// Thin wrapper around the shared PackChrome — pre-binds packType="i130".
// Kept for backward compat with the 7 i130 Doc files. New packs should
// import shared/PackChrome directly.

import SharedPackChrome from "../shared/PackChrome";
import type { ComponentProps } from "react";

type SharedProps = ComponentProps<typeof SharedPackChrome>;
type WrapperProps = Omit<SharedProps, "packType" | "packLabel">;

export default function PackChrome(props: WrapperProps) {
  return <SharedPackChrome packType="i130" packLabel="I-130 Pack" {...props} />;
}

export { Citation, SectionTitle } from "../shared/PackChrome";

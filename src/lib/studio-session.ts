import { cookies } from "next/headers";
import {
  STUDIO_COOKIE,
  studioPasscodeConfigured,
  studioToken,
} from "@/lib/studio";

/**
 * Server-side session check for the Studio pages/actions. This lives in its
 * own module (rather than studio.ts) because `next/headers` is only
 * resolvable inside the Next app: studio.ts is also imported by the eve
 * authored-module bundle (agent/channels/eve.ts), whose loader cannot
 * resolve Next's extensionless entrypoints.
 */
export async function isStudioOwner(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(STUDIO_COOKIE)?.value;
  return studioPasscodeConfigured() && token === studioToken();
}

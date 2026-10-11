import { eveChannel } from "eve/channels/eve";
import { localDev, none, vercelOidc } from "eve/channels/auth";
import { studioOwnerAuth } from "@/lib/studio";

// Public portfolio demo: anonymous visitors may talk to the agent.
// The agent has defaultTools disabled and only exposes safe, authored tools,
// so public access is acceptable. Vercel OIDC + localDev stay first so
// `eve dev`/the TUI and Vercel-internal calls authenticate properly.
// studioOwnerAuth maps the Studio session cookie (+ the v2.1 boot-toggle
// cookie) to the owner principal — that authorizes save_blog_draft and
// unlocks the dynamic studio__* tools via the `studio-tools` attribute.
export default eveChannel({
  auth: [vercelOidc(), localDev(), studioOwnerAuth(), none()],
});

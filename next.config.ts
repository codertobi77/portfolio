import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  experimental: {
    // Global 404 for unmatched URLs — required because the root layout
    // is a top-level dynamic segment ([locale]).
    globalNotFound: true,
  },
};

export default withEve(nextConfig);

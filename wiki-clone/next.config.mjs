import path from "node:path";

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;

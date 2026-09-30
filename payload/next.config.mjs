import { withPayload } from "@payloadcms/next/withPayload";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
	output: "standalone",
	// This package lives inside a pnpm workspace, and its node_modules
	// symlinks point up into the workspace root's pnpm store. Without an
	// explicit root, Next's file tracing can pick the package directory
	// itself as the root, which produces a standalone build whose
	// node_modules symlinks point outside of the standalone output and
	// break once it's copied into the Docker runner image.
	outputFileTracingRoot: fileURLToPath(new URL("../", import.meta.url)),
	webpack: (webpackConfig) => {
		webpackConfig.resolve.extensionAlias = {
			".cjs": [".cts", ".cjs"],
			".js": [".ts", ".tsx", ".js", ".jsx"],
			".mjs": [".mts", ".mjs"],
		};

		return webpackConfig;
	},
};

export default withPayload(nextConfig, { devBundleServerPackages: false });

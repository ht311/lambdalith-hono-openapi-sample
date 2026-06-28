import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const yamlPlugin = {
  name: "yaml",
  setup(builder) {
    builder.onLoad({ filter: /\.yaml$/ }, (args) => {
      const text = readFileSync(args.path, "utf-8");
      return {
        contents: `export default ${JSON.stringify(parse(text))}`,
        loader: "js",
      };
    });
  },
};

const pathAliasPlugin = {
  name: "path-alias",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => ({
      path: path.resolve("src", args.path.slice(2)),
    }));
  },
};

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.mjs",
  plugins: [yamlPlugin, pathAliasPlugin],
});

writeFileSync("dist/package.json", JSON.stringify({ type: "module" }, null, 2));
console.log("Build complete: dist/index.mjs");

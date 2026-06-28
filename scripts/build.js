import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.mjs",
  plugins: [yamlPlugin],
});

writeFileSync("dist/package.json", JSON.stringify({ type: "module" }, null, 2));
console.log("Build complete: dist/index.mjs");

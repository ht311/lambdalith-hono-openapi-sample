import { readFileSync } from "node:fs";
import { parse } from "yaml";

export async function load(url, context, nextLoad) {
  if (url.endsWith(".yaml") && !url.includes("node_modules")) {
    const filepath = new URL(url).pathname;
    const text = readFileSync(filepath, "utf-8");
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${JSON.stringify(parse(text))};`,
    };
  }
  return nextLoad(url, context);
}

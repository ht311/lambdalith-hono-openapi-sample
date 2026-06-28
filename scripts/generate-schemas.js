import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";

const spec = parse(readFileSync("generated/openapi.yaml", "utf-8"));
const schemas = spec.components?.schemas ?? {};

function zodType(prop) {
  if (prop.$ref) {
    return `${prop.$ref.split("/").pop()}Schema`;
  }
  if (prop.type === "array") {
    return `z.array(${zodType(prop.items)})`;
  }
  if (prop.type === "string") {
    let z = "z.string()";
    if (prop.format === "email") z += ".email()";
    if (prop.format === "uuid") z += ".uuid()";
    if (prop.format === "date-time") z += ".datetime()";
    if (prop.minLength) z += `.min(${prop.minLength})`;
    return z;
  }
  if (prop.type === "integer" || prop.type === "number") return "z.number()";
  if (prop.type === "boolean") return "z.boolean()";
  return "z.unknown()";
}

function zodObject(schema) {
  const required = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {})
    .map(([key, prop]) => {
      const t = zodType(prop);
      return `  ${key}: ${required.has(key) ? t : `${t}.optional()`}`;
    })
    .join(",\n");
  return `z.object({\n${props}\n})`;
}

const lines = [
  "// Auto-generated from generated/openapi.yaml — do not edit",
  'import { z } from "zod";',
  "",
];

for (const [name, schema] of Object.entries(schemas)) {
  lines.push(`export const ${name}Schema = ${zodObject(schema)};`);
  lines.push(`export type ${name} = z.infer<typeof ${name}Schema>;`);
  lines.push("");
}

mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/schemas.ts", lines.join("\n"));
console.log("Generated src/generated/schemas.ts");

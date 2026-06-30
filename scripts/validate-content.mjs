import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function readJsonFiles(dir) {
  const absolute = path.join(root, dir);
  const names = await readdir(absolute);
  const files = names.filter((name) => name.endsWith(".json"));
  const records = [];
  for (const file of files) {
    const filePath = path.join(absolute, file);
    const raw = await readFile(filePath, "utf8");
    records.push({ file: path.join(dir, file), data: JSON.parse(raw) });
  }
  return records;
}

function requireField(record, field) {
  if (!record.data[field]) {
    throw new Error(`${record.file} is missing required field: ${field}`);
  }
}

const properties = await readJsonFiles("data/properties");
for (const property of properties) {
  for (const field of ["id", "slug", "name", "status", "location", "units"]) {
    requireField(property, field);
  }
  if (!Array.isArray(property.data.units) || property.data.units.length === 0) {
    throw new Error(`${property.file} must define at least one unit`);
  }
  if (!property.data.approval || typeof property.data.approval.publicFactsApproved !== "boolean") {
    throw new Error(`${property.file} must include approval.publicFactsApproved`);
  }
}

const knowledge = await readJsonFiles("data/knowledge");
for (const entry of knowledge) {
  for (const field of ["id", "propertyId", "status", "articles"]) {
    requireField(entry, field);
  }
  if (!Array.isArray(entry.data.articles)) {
    throw new Error(`${entry.file} articles must be an array`);
  }
}

console.log(`Validated ${properties.length} property file(s) and ${knowledge.length} knowledge file(s).`);


import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const casesPath = path.join(root, "evals", "agent-workflow-cases.json");
const skillPath = path.join(root, ".codex", "skills", "property-os", "SKILL.md");
const cases = JSON.parse(await readFile(casesPath, "utf8"));
const skill = await readFile(skillPath, "utf8");

const requiredRules = [
  "AI drafts; owner approves.",
  "Do not invent property facts",
  "DRAFT - OWNER REVIEW REQUIRED",
  "Risks Or Unknowns"
];

const missingRules = requiredRules.filter((rule) => !skill.includes(rule));
if (missingRules.length > 0) {
  throw new Error(`Property OS skill is missing rule(s): ${missingRules.join(", ")}`);
}

const blockedDomains = [
  "publish",
  "availability",
  "accepted",
  "vendor",
  "access",
  "lockbox",
  "alarm",
  "password",
  "payment",
  "legal"
];

for (const testCase of cases.cases) {
  if (testCase.mustInclude.length < 2 || testCase.mustNotInclude.length < 2) {
    throw new Error(`${testCase.id} must include at least two positive and two blocked expectations`);
  }
  const blockedText = testCase.mustNotInclude.join(" ").toLowerCase();
  if (!blockedDomains.some((domain) => blockedText.includes(domain))) {
    throw new Error(`${testCase.id} must block at least one consequential automation domain`);
  }
}

console.log(`Agent workflow dry run passed for ${cases.cases.length} case(s).`);

#!/usr/bin/env node
import { Command } from "commander";
import { registerAuth } from "./commands/auth.js";
import { registerTenant } from "./commands/tenant.js";
import { registerVersusConfig } from "./commands/versus/config.js";
import { registerVersusMatch } from "./commands/versus/match.js";
import { setJsonMode } from "./output.js";

const program = new Command();

program
  .name("1up")
  .description("1upmonster CLI — manage your game infrastructure from the terminal")
  .version("0.1.0")
  .option("--json", "Output as JSON (machine-readable, AI-agent friendly)")
  .option("--quiet", "Suppress non-essential output")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts<{ json?: boolean }>();
    if (opts.json) setJsonMode(true);
  });

registerAuth(program);
registerTenant(program);

// Versus service
const versus = program.command("versus").description("Versus — matchmaking service");
registerVersusConfig(versus);
registerVersusMatch(versus);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

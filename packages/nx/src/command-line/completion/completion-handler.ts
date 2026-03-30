import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from './completion-providers';

/**
 * Known Nx commands that act as infix target aliases.
 * When a user types `nx build <TAB>`, we complete with project names.
 */
const INFIX_TARGET_COMMANDS = new Set([
  'build',
  'serve',
  'test',
  'lint',
  'e2e',
  'dev',
  'start',
  'preview',
  'typecheck',
]);

/**
 * Custom yargs completion handler. In practice we short-circuit in
 * `bin/nx.ts` → `fast-complete.ts`, so this is rarely hit. Kept registered
 * (via `.completion(...)` in nx-commands.ts) as a fallback for any code path
 * that parses with yargs directly.
 */
export function completionHandler(
  current: string,
  argv: any,
  done: (completions: ReadonlyArray<string>) => void
): void {
  const args: string[] = argv._ ?? [];

  try {
    const completions = getCompletions(current, args);
    if (completions !== null) {
      done(completions);
      return;
    }
  } catch {
    // Fall through to default on any error
  }

  done([]);
}

export function getCompletions(
  current: string,
  args: string[]
): string[] | null {
  if (args.length === 0) {
    return null; // Let yargs handle top-level command completion
  }

  const command = args[0];

  // nx show project <TAB>
  if (command === 'show' && args.length >= 2 && args[1] === 'project') {
    return getProjectNameCompletions(current);
  }

  // nx show target <TAB>
  if (command === 'show' && args.length >= 2 && args[1] === 'target') {
    if (current.includes(':')) {
      const projectName = current.split(':')[0];
      const targetPrefix = current.split(':').slice(1).join(':');
      const targets = getTargetNameCompletions(targetPrefix, projectName);
      return targets.map((t) => `${projectName}:${t}`);
    }
    // Trailing `:` lets the user TAB again to complete targets without
    // having to backspace a shell-inserted space and type `:` themselves.
    // The bash/zsh scripts detect the trailing colon and suppress the space.
    return getProjectNameCompletions(current).map((p) => `${p}:`);
  }

  // nx run <project> or nx run <project>:<target>
  if (command === 'run') {
    if (current.includes(':')) {
      const projectName = current.split(':')[0];
      const targetPrefix = current.split(':').slice(1).join(':');
      const targets = getTargetNameCompletions(targetPrefix, projectName);
      return targets.map((t) => `${projectName}:${t}`);
    }
    return getProjectNameCompletions(current).map((p) => `${p}:`);
  }

  // nx run-many -t <TAB> / nx affected -t <TAB>
  if (command === 'run-many' || command === 'affected') {
    if (isCompletingTargetOption()) {
      return getTargetNameCompletions(current);
    }
    if (isCompletingProjectOption()) {
      return getProjectNameCompletions(current);
    }
    return null;
  }

  // Infix commands: nx build <TAB>, nx serve <TAB>, etc.
  if (INFIX_TARGET_COMMANDS.has(command)) {
    return getProjectNameCompletions(current);
  }

  return null; // Let yargs handle everything else
}

/**
 * Heuristic: if the last explicit arg before current is -t, --target, or --targets,
 * we're completing a target name.
 */
function isCompletingTargetOption(): boolean {
  const rawArgs = process.argv;
  const lastArg = rawArgs[rawArgs.length - 2];
  return lastArg === '-t' || lastArg === '--target' || lastArg === '--targets';
}

function isCompletingProjectOption(): boolean {
  const rawArgs = process.argv;
  const lastArg = rawArgs[rawArgs.length - 2];
  return lastArg === '-p' || lastArg === '--projects';
}

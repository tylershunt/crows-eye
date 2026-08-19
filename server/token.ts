import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Raised when no GitHub credential can be found; `message` is shown verbatim in the UI. */
export class MissingTokenError extends Error {}

let cached: string | null = null;

/**
 * Returns a GitHub API token, preferring `GITHUB_TOKEN`/`GH_TOKEN` and otherwise
 * borrowing the credential already stored by the `gh` CLI.
 *
 * Throws `MissingTokenError` when neither source yields a token.
 */
export async function resolveGitHubToken(): Promise<string> {
  if (cached) return cached;

  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("gh", ["auth", "token"]));
  } catch {
    throw new MissingTokenError(
      "Could not read a GitHub token. Run `gh auth login`, or set GITHUB_TOKEN in your environment.",
    );
  }

  const token = stdout.trim();
  if (!token) {
    throw new MissingTokenError(
      "`gh auth token` returned nothing. Run `gh auth login` to authenticate.",
    );
  }

  cached = token;
  return cached;
}

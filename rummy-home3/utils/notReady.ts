/**
 * Shown when a screen needs a database function that is not on the server yet.
 * Never name a SQL file or tell a player to open an editor.
 */
export const NOT_READY_MESSAGE =
  "This isn't available yet. You can keep scoring with the players you already have.";

const DEVELOPER_INSTRUCTION = /supabase\/migrations|\.sql\b|sql editor|paste the supabase|anon key/i;

export function isNotReadyMessage(message: string | null | undefined): boolean {
  return message === NOT_READY_MESSAGE;
}

/** Rewrite developer instructions before they reach a screen. */
export function withoutDeveloperInstructions(message: string): string {
  if (!message) return NOT_READY_MESSAGE;
  if (isNotReadyMessage(message) || DEVELOPER_INSTRUCTION.test(message)) return NOT_READY_MESSAGE;
  return message;
}

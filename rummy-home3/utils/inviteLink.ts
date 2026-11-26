import { GET_PAGE_URL } from './siteUrls';
export const INVITE_URL = GET_PAGE_URL;

/** Invite to EZ Score (D106): a plain "get the app" message. It carries no link token and links nobody. */
export function inviteMessage(): string {
  return `I keep our rummy scores in EZ Score. Get it here: ${INVITE_URL} then send me your Player ID (it is on your Profile).`;
}

export function playerIdShareMessage(playerCode: string): string {
  return `Add me on EZ Score: Rummy. My player ID is ${playerCode}.`;
}

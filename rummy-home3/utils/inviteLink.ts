import { GET_PAGE_URL } from './siteUrls';
export const INVITE_URL = GET_PAGE_URL;

export function inviteMessage(): string {
  return `Play EZ Score: Rummy with me: ${INVITE_URL}`;
}

export function playerIdShareMessage(playerCode: string): string {
  return `Add me on EZ Score: Rummy. My player ID is ${playerCode}.`;
}

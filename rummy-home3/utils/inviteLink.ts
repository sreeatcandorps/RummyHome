export const INVITE_URL = 'https://sreeatcandorps.github.io/Games/get';

export function inviteMessage(): string {
  return `Play Rummy Home with me: ${INVITE_URL}`;
}

export function playerIdShareMessage(playerCode: string): string {
  return `Add me on Rummy Home. My player ID is ${playerCode}.`;
}

import { Share } from 'react-native';
import { INVITE_URL, inviteMessage, playerIdShareMessage } from '@/utils/inviteLink';

export { INVITE_URL, inviteMessage, playerIdShareMessage };

export async function shareInvite(): Promise<void> {
  await Share.share({ message: inviteMessage(), url: INVITE_URL, title: 'Rummy Home' });
}

export async function sharePlayerId(playerCode: string): Promise<void> {
  await Share.share({ message: playerIdShareMessage(playerCode), title: 'Player ID' });
}

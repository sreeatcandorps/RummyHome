import { Share } from 'react-native';
import { INVITE_URL, inviteMessage } from '@/utils/inviteLink';

export { INVITE_URL, inviteMessage };

export async function shareInvite(): Promise<void> {
  await Share.share({ message: inviteMessage(), url: INVITE_URL, title: 'EZ Score: Rummy' });
}

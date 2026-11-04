import { Redirect } from 'expo-router';

/** History is the Recent list on Home. */
export default function HistoryRedirect() {
  return <Redirect href="/(tabs)" />;
}

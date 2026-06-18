import { router } from 'expo-router';

export async function safeNavigate(
  path: string, 
  options?: { 
    setLoading?: (loading: boolean) => void;
    setError?: (error: string | null) => void;
  }
) {
  const { setLoading, setError } = options || {};
  
  try {
    if (setLoading) setLoading(true);
    if (setError) setError(null);
    
    await router.push(path);
  } catch (error) {
    console.error('Navigation error:', error);
    if (setError) setError('Navigation failed. Please try again.');
  } finally {
    if (setLoading) setLoading(false);
  }
} 
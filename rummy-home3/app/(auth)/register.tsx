import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../utils/storage';
import { authService } from '../../services/auth';
import { isSupabaseConfigured, supabase } from '../../services/supabase';
import { formatAuthError } from '../../utils/authErrors';
// import * as Location from 'expo-location';

interface SimpleCountry {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
}

export default function RegisterScreen() {
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [passcode, setPasscode] = React.useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Country state
  const [selectedCountry, setSelectedCountry] = useState<SimpleCountry | null>(null);
  const [locationLoading, setLocationLoading] = useState(false); // Changed to false

  // Default to US if location detection fails
  const defaultCountry: SimpleCountry = {
    code: 'US',
    name: 'United States',
    callingCode: '1',
    flag: '🇺🇸',
  };

  useEffect(() => {
    // Temporarily disable location detection
    setSelectedCountry(defaultCountry);
    // detectUserLocation();
  }, []);

  // const detectUserLocation = async () => {
  //   try {
  //     setLocationLoading(true);
      
  //     // Request location permissions
  //     const { status } = await Location.requestForegroundPermissionsAsync();
      
  //     if (status === 'granted') {
  //       // Get current location
  //       const location = await Location.getCurrentPositionAsync({
  //         accuracy: Location.Accuracy.Low, // Low accuracy is fine for country detection
  //       });

  //       // Reverse geocode to get country
  //       const reverseGeocode = await Location.reverseGeocodeAsync({
  //         latitude: location.coords.latitude,
  //         longitude: location.coords.longitude,
  //       });

  //       if (reverseGeocode.length > 0) {
  //         const countryCode = reverseGeocode[0].isoCountryCode;
  //         if (countryCode) {
  //           // Find country by ISO code
  //           const country = getCountryByCode(countryCode);
  //           if (country) {
  //             setSelectedCountry(country);
  //             setLocationLoading(false);
  //             return;
  //           }
  //         }
  //       }
  //     }
  //   } catch (error) {
  //     console.log('Location detection failed:', error);
  //   }
    
  //   // Fallback to default country
  //   setSelectedCountry(defaultCountry);
  //   setLocationLoading(false);
  // };

  const getCountryByCode = (isoCode: string): SimpleCountry | null => {
    // Common countries mapping
    const countries: { [key: string]: SimpleCountry } = {
      'US': { code: 'US', name: 'United States', callingCode: '1', flag: '🇺🇸' },
      'CA': { code: 'CA', name: 'Canada', callingCode: '1', flag: '🇨🇦' },
      'GB': { code: 'GB', name: 'United Kingdom', callingCode: '44', flag: '🇬🇧' },
      'IN': { code: 'IN', name: 'India', callingCode: '91', flag: '🇮🇳' },
      'AU': { code: 'AU', name: 'Australia', callingCode: '61', flag: '🇦🇺' },
      'DE': { code: 'DE', name: 'Germany', callingCode: '49', flag: '🇩🇪' },
      'FR': { code: 'FR', name: 'France', callingCode: '33', flag: '🇫🇷' },
      'JP': { code: 'JP', name: 'Japan', callingCode: '81', flag: '🇯🇵' },
      'BR': { code: 'BR', name: 'Brazil', callingCode: '55', flag: '🇧🇷' },
      'MX': { code: 'MX', name: 'Mexico', callingCode: '52', flag: '🇲🇽' },
    };
    
    return countries[isoCode] || null;
  };

  const clearFields = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPasscode('');
    setError('');
  };

  const validateForm = () => {
    if (!firstName || !lastName) {
      setError('First and last name are required');
      return false;
    }
    
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!passcode) {
      setError('Passcode is required');
      return false;
    }
    if (passcode.length !== 6) {
      setError('Passcode must be exactly 6 digits');
      return false;
    }
    if (!/^\d{6}$/.test(passcode)) {
      setError('Passcode must contain only numbers');
      return false;
    }
    
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');

    try {
      // Format phone number with country code if provided
      let formattedPhone = phone.trim();
      if (formattedPhone && selectedCountry) {
        // Remove any existing country code and add the selected one
        formattedPhone = formattedPhone.replace(/^\+?\d{1,4}/, ''); // Remove existing country code
        formattedPhone = `+${selectedCountry.callingCode}${formattedPhone}`;
      }

      const displayName = `${firstName} ${lastName}`;
      const authData = isSupabaseConfigured
        ? await authService.signUp(email, passcode, displayName)
        : { user: { id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }, session: null };

      if (!authData.user) throw new Error('Failed to create user');

      if (isSupabaseConfigured && authData.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: formattedPhone || null,
            display_name: displayName,
            email: email.trim(),
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.warn('Profile update after signup failed:', profileError.message);
        }
      }

      if (!isSupabaseConfigured) {
        const newPlayer = {
          id: authData.user.id,
          email: email.trim(),
          phone: formattedPhone || undefined,
          name: displayName,
          gamesPlayed: 0,
          gamesWon: 0,
          role: 'player' as const
        };

        const players = await storage.getPlayers();
        await storage.savePlayers([...players, newPlayer]);
      }

      if (isSupabaseConfigured && !authData.session) {
        Alert.alert(
          'Confirm Your Email',
          'Your account was created, but you must confirm your email before you can sign in. Check your inbox, then return here and sign in with your email and 6-digit passcode.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
        return;
      }

      if (isSupabaseConfigured && authData.session) {
        Alert.alert(
          'Account Created Successfully',
          'You are signed in and ready to play.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
        return;
      }

      Alert.alert(
        'Account Created Successfully',
        'Your account has been created. You can now login using your email and 6-digit passcode.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );

    } catch (err) {
      console.error('Registration error:', err);
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Create Account
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          label="First Name"
          value={firstName}
          onChangeText={setFirstName}
          mode="outlined"
          style={styles.input}
          disabled={loading}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          label="Last Name"
          value={lastName}
          onChangeText={setLastName}
          mode="outlined"
          style={styles.input}
          disabled={loading}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          disabled={loading}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          label="6-Digit Passcode"
          value={passcode}
          onChangeText={(text) => {
            const numericText = text.replace(/[^0-9]/g, '');
            if (numericText.length <= 6) {
              setPasscode(numericText);
            }
          }}
          mode="outlined"
          style={styles.input}
          keyboardType="numeric"
          maxLength={6}
          secureTextEntry
          placeholder="Enter 6-digit passcode"
          disabled={loading}
        />
        <HelperText type="info" visible={true}>
          Create a 6-digit numeric passcode for easy login
        </HelperText>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          label="Phone Number (Optional)"
          value={phone}
          onChangeText={setPhone}
          mode="outlined"
          style={styles.input}
          keyboardType="phone-pad"
          disabled={loading}
        />
        
        {selectedCountry && (
          <View style={styles.countryContainer}>
            <Text variant="bodyMedium">
              {selectedCountry.flag} {selectedCountry.name} (+{selectedCountry.callingCode})
            </Text>
          </View>
        )}
      </View>

      {error ? (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={handleRegister}
        style={styles.button}
        loading={loading}
        disabled={loading}
      >
        Create Account
      </Button>

      <Button 
        mode="outlined"
        onPress={clearFields}
        style={styles.button}
        disabled={loading}
      >
        Clear
      </Button>

      <View style={styles.divider}>
        <Text variant="bodyMedium" style={styles.dividerText}>
          Already have an account?
        </Text>
      </View>

      <Button
        mode="text"
        onPress={() => router.push('/(auth)/login')}
        style={styles.textButton}
        disabled={loading}
      >
        Sign In Instead
      </Button>

      <Button
        mode="text"
        onPress={() => router.back()}
        style={styles.textButton}
        disabled={loading}
      >
        ← Back to Login
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 0,
  },
  countryContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  countryLabel: {
    opacity: 0.7,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerText: {
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  textButton: {
    marginTop: 16,
  },
}); 
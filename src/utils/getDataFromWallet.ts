import { MasterCertificate } from "@bsv/sdk";

export interface WalletProfileData {
  displayName: string;
  locationLng: number;
  locationLat: number;
  email?: string;
  phoneNumber?: string;
}


/**
 * Decrypts profile data from a certificate that has already been fetched.
 */
export async function getDataFromWallet(userWallet: any, certificate: any): Promise<WalletProfileData | null> {
  if (!userWallet || !certificate) {
    console.log('No wallet or certificate available');
    return null;
  }

  try {
    console.log('🔍 Decrypting profile data from certificate...');

    // Decrypt certificate fields to get user data
    const decryptedFields = await MasterCertificate.decryptFields(
      userWallet,
      certificate.keyring,
      certificate.fields,
      certificate.certifier
    );

    console.log('✅ Profile data retrieved from certificate');

    // Return only the fields BRIX needs
    const emailRaw = decryptedFields.email;
    const phoneRaw = decryptedFields.phoneNumber;

    const email = typeof emailRaw === 'string' && emailRaw.trim().length > 0 ? emailRaw.trim() : undefined;
    const phoneNumber = typeof phoneRaw === 'string' && phoneRaw.trim().length > 0 ? phoneRaw.trim() : undefined;

    const profileData: WalletProfileData = {
      displayName: decryptedFields.displayName || 'User',
      locationLng: Number(decryptedFields.lng) || 0,
      locationLat: Number(decryptedFields.lat) || 0,
      email,
      phoneNumber,
    };

    return profileData;

  } catch (error) {
    console.error('❌ Error getting data from wallet:', error);
    return null;
  }
}

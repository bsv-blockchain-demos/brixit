import { MasterCertificate, Utils } from "@bsv/sdk";

export interface WalletProfileData {
  displayName: string;
  locationLng: number;
  locationLat: number;
  email?: string;
  phoneNumber?: string;
}

const COMMONSOURCE_SERVER_KEY = import.meta.env.VITE_COMMONSOURCE_SERVER_KEY;
const CERT_TYPE = import.meta.env.VITE_CERT_TYPE || 'CommonSource identity';

/**
 * Fetches essential profile data from wallet for BRIX app
 * Only extracts: displayName, locationLat, locationLng
 */
export async function getDataFromWallet(userWallet: any): Promise<WalletProfileData | null> {
  if (!userWallet) {
    console.log('No wallet available');
    return null;
  }

  try {
    console.log('🔍 Fetching profile data from wallet certificate...');

    // Get certificate
    const certificates = await userWallet.listCertificates({
      certifiers: [COMMONSOURCE_SERVER_KEY],
      types: [Utils.toBase64(Utils.toArray(CERT_TYPE))],
      limit: 1,
    });

    if (certificates.certificates.length === 0) {
      console.log('No certificate found');
      return null;
    }

    const certificate = certificates.certificates[0];

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

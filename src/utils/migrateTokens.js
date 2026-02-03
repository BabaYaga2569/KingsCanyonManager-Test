import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { generateSecureToken } from './tokenUtils';

/**
 * Adds tokens to existing documents that don't have them
 */
export async function migrateDocumentsWithTokens() {
  const collections = [
    { name: 'bids', tokenField: 'signingToken' },
    { name: 'contracts', tokenField: 'signingToken' },
    { name: 'invoices', tokenField: 'paymentToken' },
  ];

  const results = {
    bids: { total: 0, updated: 0 },
    contracts: { total: 0, updated: 0 },
    invoices: { total: 0, updated: 0 },
  };

  for (const { name, tokenField } of collections) {
    console.log(`\n🔍 Checking ${name}...`);
    
    const snapshot = await getDocs(collection(db, name));
    results[name].total = snapshot.size;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      // If document doesn't have a token, add one
      if (!data[tokenField]) {
        const token = generateSecureToken();
        await updateDoc(doc(db, name, docSnap.id), {
          [tokenField]: token
        });
        results[name].updated++;
        console.log(`  ✅ Added token to ${name}/${docSnap.id}`);
      }
    }
  }

  return results;
}
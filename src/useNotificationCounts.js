import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Custom hook to track notification counts for different sections
 * Compares item creation dates with "last viewed" timestamps
 * ✅ FIXED: Now gracefully handles missing or inaccessible collections
 * ✅ FIXED: Excludes maintenance_agreement type from contracts badge count
 */
export function useNotificationCounts() {
  const [counts, setCounts] = useState({
    bids: 0,
    contracts: 0,
    invoices: 0,
    jobs: 0,
    customers: 0,
    schedules: 0,
    payments: 0,
    expenses: 0,
    notes: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const lastViewed = {
          bids:      localStorage.getItem('lastViewed_bids'),
          contracts: localStorage.getItem('lastViewed_contracts'),
          invoices:  localStorage.getItem('lastViewed_invoices'),
          jobs:      localStorage.getItem('lastViewed_jobs'),
          customers: localStorage.getItem('lastViewed_customers'),
          schedules: localStorage.getItem('lastViewed_schedule'),
          payments:  localStorage.getItem('lastViewed_payments'),
          expenses:  localStorage.getItem('lastViewed_expenses'),
          notes:     localStorage.getItem('lastViewed_notes'),
        };

        const newCounts = {};

        for (const [section, timestamp] of Object.entries(lastViewed)) {
          try {
            const collectionName = section === 'schedules' ? 'schedules' : section;
            const snapshot = await getDocs(collection(db, collectionName));

            // Filter out maintenance agreements from contracts badge —
            // they are auto-created by the maintenance flow and don't
            // need Darren's attention the same way a new client contract does.
            const docs = section === 'contracts'
              ? snapshot.docs.filter(d => d.data().type !== 'maintenance_agreement')
              : snapshot.docs;

            if (!timestamp) {
              newCounts[section] = docs.length;
            } else {
              const lastViewedDate = new Date(timestamp);
              newCounts[section] = docs.filter(doc => {
                const data = doc.data();
                if (data.createdAt) {
                  const createdDate = data.createdAt.toDate
                    ? data.createdAt.toDate()
                    : new Date(data.createdAt);
                  return createdDate > lastViewedDate;
                }
                return false;
              }).length;
            }
          } catch (collectionError) {
            newCounts[section] = 0;
            if (!collectionError.message?.includes('Missing or insufficient permissions')) {
              console.warn(`Could not fetch count for ${section}:`, collectionError.message);
            }
          }
        }

        setCounts(newCounts);
      } catch (error) {
        console.error('Error fetching notification counts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();

    const interval = setInterval(fetchCounts, 60000);
    const handleRefresh = () => fetchCounts();
    window.addEventListener('refreshBadges', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshBadges', handleRefresh);
    };
  }, []);

  return { counts, loading };
}

/**
 * Mark a section as viewed (call this when user navigates to a page)
 */
export function markAsViewed(section) {
  const now = new Date().toISOString();
  localStorage.setItem(`lastViewed_${section}`, now);
  console.log(`✅ Marked ${section} as viewed at ${now}`);
}
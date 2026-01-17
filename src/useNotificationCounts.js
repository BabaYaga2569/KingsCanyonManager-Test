import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import moment from 'moment';

/**
 * Custom hook to track notification counts for different sections
 * Compares item creation dates with "last viewed" timestamps
 * ✅ FIXED: Now gracefully handles missing or inaccessible collections
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
        // Get last viewed timestamps from localStorage
        const lastViewed = {
          bids: localStorage.getItem('lastViewed_bids'),
          contracts: localStorage.getItem('lastViewed_contracts'),
          invoices: localStorage.getItem('lastViewed_invoices'),
          jobs: localStorage.getItem('lastViewed_jobs'),
          customers: localStorage.getItem('lastViewed_customers'),
          schedules: localStorage.getItem('lastViewed_schedule'),
          payments: localStorage.getItem('lastViewed_payments'),
          expenses: localStorage.getItem('lastViewed_expenses'),
          notes: localStorage.getItem('lastViewed_notes'),
        };

        const newCounts = {};

        // Fetch counts for each collection
        for (const [section, timestamp] of Object.entries(lastViewed)) {
          try {
            if (!timestamp) {
              // Never viewed - count all items
              const collectionName = section === 'schedules' ? 'schedules' : section;
              const snapshot = await getDocs(collection(db, collectionName));
              newCounts[section] = snapshot.size;
            } else {
              // Count items created after last viewed
              const collectionName = section === 'schedules' ? 'schedules' : section;
              const lastViewedDate = new Date(timestamp);
              
              const snapshot = await getDocs(collection(db, collectionName));
              const count = snapshot.docs.filter(doc => {
                const data = doc.data();
                // Check if item was created after last viewed
                if (data.createdAt) {
                  // Handle both Firestore Timestamp and ISO string
                  const createdDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                  return createdDate > lastViewedDate;
                }
                return false;
              }).length;
              
              newCounts[section] = count;
            }
          } catch (collectionError) {
            // ✅ FIXED: Gracefully handle missing or inaccessible collections
            // This prevents console errors when collections don't exist yet
            newCounts[section] = 0;
            // Only log if it's NOT a missing permissions error
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

    // Refresh counts every 60 seconds
    const interval = setInterval(fetchCounts, 60000);
    
    // Listen for manual refresh events
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
/**
 * Universal Sort Utility for KCL Manager
 * 
 * Provides consistent sorting across all dashboards:
 * - Invoices, Jobs, Contracts, Bids, Customers, Payments, etc.
 * 
 * Usage:
 * import { universalSort, SORT_OPTIONS } from './utils/sortUtils';
 * const sorted = universalSort(items, sortOrder, SORT_OPTIONS.invoices);
 */

/**
 * Parse date from various formats (Firebase Timestamp, string, Date object)
 */
const parseDate = (dateValue) => {
  if (!dateValue) return null;
  
  // Firebase Timestamp
  if (dateValue.toDate) {
    return dateValue.toDate();
  }
  
  // Already a Date object
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // String date
  try {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

/**
 * Get date value from object based on config
 */
const getDateFromObject = (obj, dateField) => {
  if (Array.isArray(dateField)) {
    // Try multiple fields in order (e.g., invoiceDate, date, createdAt)
    for (const field of dateField) {
      if (obj[field]) {
        return parseDate(obj[field]);
      }
    }
    return null;
  }
  return parseDate(obj[dateField]);
};

/**
 * Universal sort function
 * 
 * @param {Array} items - Array of items to sort
 * @param {String} sortOrder - Sort order key (e.g., 'newest', 'name-asc')
 * @param {Object} config - Field mappings for this data type
 * @returns {Array} Sorted array
 */
export const universalSort = (items, sortOrder, config = {}) => {
  const {
    nameField = 'name',
    dateField = 'createdAt',
    amountField = 'amount',
    statusField = 'status',
  } = config;

  return [...items].sort((a, b) => {
    switch (sortOrder) {
      // ==================== DATE SORTING ====================
      case 'newest': {
        const dateA = getDateFromObject(a, dateField);
        const dateB = getDateFromObject(b, dateField);
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
      }
      
      case 'oldest': {
        const dateA = getDateFromObject(a, dateField);
        const dateB = getDateFromObject(b, dateField);
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
      }

      // ==================== NAME SORTING ====================
      case 'name-asc': {
        const nameA = Array.isArray(nameField) 
          ? nameField.map(f => a[f]).find(v => v) || ''
          : a[nameField] || '';
        const nameB = Array.isArray(nameField)
          ? nameField.map(f => b[f]).find(v => v) || ''
          : b[nameField] || '';
        return nameA.localeCompare(nameB);
      }
      
      case 'name-desc': {
        const nameA = Array.isArray(nameField)
          ? nameField.map(f => a[f]).find(v => v) || ''
          : a[nameField] || '';
        const nameB = Array.isArray(nameField)
          ? nameField.map(f => b[f]).find(v => v) || ''
          : b[nameField] || '';
        return nameB.localeCompare(nameA);
      }

      // ==================== AMOUNT SORTING ====================
      case 'amount-high': {
        return parseFloat(b[amountField] || 0) - parseFloat(a[amountField] || 0);
      }
      
      case 'amount-low': {
        return parseFloat(a[amountField] || 0) - parseFloat(b[amountField] || 0);
      }

      // ==================== STATUS SORTING ====================
      case 'status-unpaid': {
        const aUnpaid = (a[statusField] || '').toLowerCase() !== 'paid' ? -1 : 1;
        const bUnpaid = (b[statusField] || '').toLowerCase() !== 'paid' ? -1 : 1;
        return aUnpaid - bUnpaid;
      }
      
      case 'status-paid': {
        const aPaid = (a[statusField] || '').toLowerCase() === 'paid' ? -1 : 1;
        const bPaid = (b[statusField] || '').toLowerCase() === 'paid' ? -1 : 1;
        return aPaid - bPaid;
      }

      case 'status-pending': {
        const aPending = (a[statusField] || '').toLowerCase() === 'pending' ? -1 : 1;
        const bPending = (b[statusField] || '').toLowerCase() === 'pending' ? -1 : 1;
        return aPending - bPending;
      }

      case 'status-active': {
        const aActive = (a[statusField] || '').toLowerCase() === 'active' ? -1 : 1;
        const bActive = (b[statusField] || '').toLowerCase() === 'active' ? -1 : 1;
        return aActive - bActive;
      }

      case 'status-completed': {
        const aCompleted = (a[statusField] || '').toLowerCase() === 'completed' ? -1 : 1;
        const bCompleted = (b[statusField] || '').toLowerCase() === 'completed' ? -1 : 1;
        return aCompleted - bCompleted;
      }

      case 'priority-high': {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[(a.priority || 'medium').toLowerCase()] || 1;
        const bPriority = priorityOrder[(b.priority || 'medium').toLowerCase()] || 1;
        return aPriority - bPriority;
      }

      default:
        return 0;
    }
  });
};

/**
 * Pre-configured sort options for different data types
 */
export const SORT_OPTIONS = {
  invoices: {
    nameField: 'clientName',
    dateField: ['invoiceDate', 'date', 'createdAt'],
    amountField: 'total',
    statusField: 'status',
  },
  
  jobs: {
    nameField: 'clientName',
    dateField: ['createdAt', 'startDate'],
    amountField: 'amount',
    statusField: 'status',
  },
  
  contracts: {
    nameField: 'clientName',
    dateField: ['contractDate', 'createdAt'],
    amountField: 'total',
    statusField: 'status',
  },
  
  bids: {
    nameField: 'clientName',
    dateField: ['bidDate', 'createdAt'],
    amountField: 'amount',
    statusField: 'status',
  },
  
  customers: {
    nameField: 'name',
    dateField: 'createdAt',
    amountField: 'lifetimeValue',
    statusField: 'status',
  },
  
  payments: {
    nameField: 'clientName',
    dateField: 'paymentDate',
    amountField: 'amount',
    statusField: 'status',
  },
};

/**
 * Helper to format date for display
 */
export const formatDate = (dateValue) => {
  const date = parseDate(dateValue);
  if (!date || isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString();
};
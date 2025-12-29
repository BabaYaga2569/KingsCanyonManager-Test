import * as XLSX from 'xlsx';
import moment from 'moment';

/**
 * Export job expenses to Excel with two tabs:
 * 1. Summary - High level expense data
 * 2. Itemized - Line-by-line receipt details
 */
export const exportJobExpensesToExcel = (job, expenses, invoice = null) => {
  console.log("📊 Generating Excel export...");
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // ============================================
  // TAB 1: SUMMARY
  // ============================================
  
  const summaryData = [
    ['JOB EXPENSE REPORT'],
    ['Kings Canyon Landscaping LLC'],
    [''],
    ['Job:', job.clientName || 'N/A'],
    ['Job ID:', job.id || 'N/A'],
    ['Address:', job.address || 'N/A'],
    ['Report Date:', moment().format('MMM DD, YYYY')],
    [''],
    [''],
    // Headers
    ['Date', 'Vendor', 'Category', 'Description', 'Amount', 'Tax Deductible', 'Payment Method', 'Receipt', 'Job'],
  ];
  
  // Add expense rows
  expenses.forEach(expense => {
    summaryData.push([
      moment(expense.date).format('MM/DD/YYYY'),
      expense.vendor || '',
      expense.category || '',
      expense.description || '',
      parseFloat(expense.amount || 0),
      expense.taxDeductible ? 'Yes' : 'No',
      expense.paymentMethod || '',
      expense.receiptUrl ? 'Available' : 'Missing',
      expense.jobName || job.clientName || '',
    ]);
  });
  
  // Add totals
  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const taxDeductible = expenses
    .filter(e => e.taxDeductible)
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  
  summaryData.push(['']);
  summaryData.push(['', '', '', 'TOTAL EXPENSES:', totalExpenses, '', '', '']);
  summaryData.push(['', '', '', 'Tax Deductible:', taxDeductible, '', '', '']);
  
  if (invoice) {
    const revenue = parseFloat(invoice.total || invoice.amount || 0);
    const profit = revenue - totalExpenses;
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
    
    summaryData.push(['']);
    summaryData.push(['PROFITABILITY']);
    summaryData.push(['Revenue:', revenue]);
    summaryData.push(['Expenses:', totalExpenses]);
    summaryData.push(['Profit:', profit]);
    summaryData.push(['Margin:', `${margin}%`]);
  }
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Column widths
  wsSummary['!cols'] = [
    { wch: 12 }, // Date
    { wch: 20 }, // Vendor
    { wch: 12 }, // Category
    { wch: 30 }, // Description
    { wch: 12 }, // Amount
    { wch: 15 }, // Tax Deductible
    { wch: 15 }, // Payment Method
    { wch: 10 }, // Receipt
    { wch: 25 }, // Job
  ];
  
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  
  // ============================================
  // TAB 2: ITEMIZED
  // ============================================
  
  const itemizedData = [
    ['ITEMIZED RECEIPT DETAILS'],
    ['Kings Canyon Landscaping LLC'],
    [''],
    ['Job:', job.clientName || 'N/A'],
    [''],
    [''],
    // Headers
    ['Date', 'Vendor', 'Receipt Total', 'Item Description', 'Quantity', 'Unit Price', 'Line Total', 'Receipt Link'],
  ];
  
  // Add line items from expenses that have them
  expenses.forEach(expense => {
    if (expense.lineItems && expense.lineItems.length > 0) {
      expense.lineItems.forEach((item, idx) => {
        itemizedData.push([
          idx === 0 ? moment(expense.date).format('MM/DD/YYYY') : '',
          idx === 0 ? expense.vendor || '' : '',
          idx === 0 ? parseFloat(expense.amount || 0) : '',
          item.item || '',
          item.quantity || '1',
          parseFloat(item.price || 0),
          parseFloat(item.quantity || 1) * parseFloat(item.price || 0),
          idx === 0 && expense.receiptUrl ? expense.receiptUrl : '',
        ]);
      });
      // Add blank row between receipts
      itemizedData.push(['']);
    } else {
      // Expense without line items
      itemizedData.push([
        moment(expense.date).format('MM/DD/YYYY'),
        expense.vendor || '',
        parseFloat(expense.amount || 0),
        expense.description || 'No itemized details',
        '1',
        parseFloat(expense.amount || 0),
        parseFloat(expense.amount || 0),
        expense.receiptUrl || '',
      ]);
      itemizedData.push(['']);
    }
  });
  
  const wsItemized = XLSX.utils.aoa_to_sheet(itemizedData);
  
  // Column widths
  wsItemized['!cols'] = [
    { wch: 12 }, // Date
    { wch: 20 }, // Vendor
    { wch: 12 }, // Receipt Total
    { wch: 40 }, // Item Description
    { wch: 10 }, // Quantity
    { wch: 12 }, // Unit Price
    { wch: 12 }, // Line Total
    { wch: 50 }, // Receipt Link
  ];
  
  XLSX.utils.book_append_sheet(wb, wsItemized, 'Itemized');
  
  // ============================================
  // GENERATE FILE
  // ============================================
  
  const fileName = `${job.clientName || 'Job'}_Expenses_${moment().format('YYYY-MM-DD')}.xlsx`;
  XLSX.writeFile(wb, fileName);
  
  console.log("✅ Excel file generated:", fileName);
  
  return fileName;
};

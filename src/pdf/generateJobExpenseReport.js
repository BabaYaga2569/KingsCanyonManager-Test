import jsPDF from 'jspdf';
import 'jspdf-autotable';
import moment from 'moment';

/**
 * Generate professional PDF expense report for completed jobs
 * Includes: Cover page, expense summary, itemized list, receipt images
 */
export const generateJobExpenseReport = async (job, expenses, invoice = null) => {
  console.log("📄 Generating PDF Expense Report...");
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;
  
  // ============================================
  // COVER PAGE
  // ============================================
  
  // Company name
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.text('Kings Canyon Landscaping LLC', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;
  doc.setFontSize(18);
  doc.text('JOB EXPENSE REPORT', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 20;
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  
  // Job details
  const jobDetails = [
    ['Job:', job.clientName || 'N/A'],
    ['Address:', job.address || 'N/A'],
    ['Job ID:', job.id || 'N/A'],
    ['Report Date:', moment().format('MMMM DD, YYYY')],
    ['Status:', job.status || 'N/A'],
  ];
  
  jobDetails.forEach(([label, value]) => {
    doc.setFont(undefined, 'bold');
    doc.text(label, 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(value, 60, yPos);
    yPos += 8;
  });
  
  // Financial summary
  yPos += 10;
  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const revenue = invoice ? parseFloat(invoice.total || invoice.amount || 0) : 0;
  const profit = revenue - totalExpenses;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
  
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('FINANCIAL SUMMARY', 20, yPos);
  yPos += 10;
  
  doc.setFontSize(12);
  const financialData = [
    ['Total Expenses:', `$${totalExpenses.toFixed(2)}`],
    ['Number of Expenses:', expenses.length.toString()],
    ['Tax Deductible:', `$${expenses.filter(e => e.taxDeductible).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0).toFixed(2)}`],
  ];
  
  if (invoice) {
    financialData.push(['Revenue:', `$${revenue.toFixed(2)}`]);
    financialData.push(['Profit:', `$${profit.toFixed(2)}`]);
    financialData.push(['Profit Margin:', `${margin}%`]);
  }
  
  financialData.forEach(([label, value]) => {
    doc.setFont(undefined, 'normal');
    doc.text(label, 20, yPos);
    doc.setFont(undefined, 'bold');
    doc.text(value, 80, yPos);
    yPos += 8;
  });
  
  // ============================================
  // PAGE 2: EXPENSE BREAKDOWN BY CATEGORY
  // ============================================
  
  doc.addPage();
  yPos = 20;
  
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('EXPENSE BREAKDOWN BY CATEGORY', 20, yPos);
  yPos += 15;
  
  // Calculate category totals
  const categoryTotals = {};
  expenses.forEach(expense => {
    const cat = expense.category || 'other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(expense.amount || 0);
  });
  
  const categoryData = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => [
      category.charAt(0).toUpperCase() + category.slice(1),
      `$${total.toFixed(2)}`
    ]);
  
  doc.autoTable({
    startY: yPos,
    head: [['Category', 'Total']],
    body: categoryData,
    foot: [['TOTAL', `$${totalExpenses.toFixed(2)}`]],
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [52, 73, 94], fontStyle: 'bold' },
  });
  
  // ============================================
  // PAGE 3+: DETAILED EXPENSE LIST
  // ============================================
  
  doc.addPage();
  yPos = 20;
  
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('DETAILED EXPENSE LIST', 20, yPos);
  yPos += 15;
  
  const expenseTableData = expenses
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(expense => [
      moment(expense.date).format('MM/DD/YY'),
      expense.vendor || '',
      expense.category || '',
      expense.description || '',
      `$${parseFloat(expense.amount || 0).toFixed(2)}`,
      expense.receiptUrl ? 'Yes' : 'No',
    ]);
  
  doc.autoTable({
    startY: yPos,
    head: [['Date', 'Vendor', 'Category', 'Description', 'Amount', 'Receipt']],
    body: expenseTableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      3: { cellWidth: 60 }, // Description
      4: { halign: 'right' }, // Amount
    },
    didDrawPage: (data) => {
      // Footer on each page
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(
        `Page ${doc.internal.getNumberOfPages()} - Generated ${moment().format('MM/DD/YYYY')}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    },
  });
  
  // ============================================
  // ITEMIZED RECEIPTS PAGE
  // ============================================
  
  const itemizedExpenses = expenses.filter(e => e.lineItems && e.lineItems.length > 0);
  
  if (itemizedExpenses.length > 0) {
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('ITEMIZED RECEIPT DETAILS', 20, yPos);
    yPos += 10;
    
    itemizedExpenses.forEach(expense => {
      // Check if we need a new page
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`${expense.vendor} - ${moment(expense.date).format('MM/DD/YYYY')}`, 20, yPos);
      yPos += 8;
      
      const itemData = expense.lineItems.map(item => [
        item.item || '',
        item.quantity || '1',
        `$${parseFloat(item.price || 0).toFixed(2)}`,
        `$${(parseFloat(item.quantity || 1) * parseFloat(item.price || 0)).toFixed(2)}`,
      ]);
      
      doc.autoTable({
        startY: yPos,
        head: [['Item', 'Qty', 'Unit Price', 'Total']],
        body: itemData,
        foot: [['', '', 'Receipt Total:', `$${parseFloat(expense.amount || 0).toFixed(2)}`]],
        theme: 'plain',
        headStyles: { fillColor: [189, 195, 199] },
        footStyles: { fontStyle: 'bold' },
        margin: { left: 25 },
      });
      
      yPos = doc.lastAutoTable.finalY + 15;
    });
  }
  
  // ============================================
  // SAVE PDF
  // ============================================
  
  const fileName = `${job.clientName || 'Job'}_Expense_Report_${moment().format('YYYY-MM-DD')}.pdf`;
  doc.save(fileName);
  
  console.log("✅ PDF generated:", fileName);
  
  return fileName;
};

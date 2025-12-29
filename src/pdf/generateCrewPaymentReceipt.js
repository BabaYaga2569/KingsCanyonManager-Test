import jsPDF from "jspdf";
import moment from "moment";

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  cityState: "Bullhead City, AZ",
  phone: "(928) 296-0217",
  email: "kingscanyon775@gmail.com",
};

export default async function generateCrewPaymentReceipt({ payment, crew }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Frame
  doc.setDrawColor(60);
  doc.setLineWidth(1);
  doc.rect(28, 28, W - 56, H - 56);

  // Logo placeholder area
  doc.setFillColor(240, 240, 240);
  doc.rect(40, 42, 80, 80, "F");
  
  // Company header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(COMPANY.name, 130, 60);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(COMPANY.cityState, 130, 78);
  doc.text(COMPANY.phone + " • " + COMPANY.email, 130, 94);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CREW PAYMENT RECEIPT", W - 40, 60, { align: "right" });
  
  // Receipt details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const receiptNum = payment.id ? payment.id.slice(-8).toUpperCase() : "DRAFT";
  doc.text("Receipt No.: " + receiptNum, W - 40, 78, { align: "right" });
  doc.text("Date: " + moment(payment.paymentDate).format("MMM DD, YYYY"), W - 40, 92, { align: "right" });

  // Divider
  doc.setDrawColor(150);
  doc.line(40, 132, W - 40, 132);

  let y = 160;

  // Paid To
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Paid To:", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(payment.crewName, 40, y + 20);
  
  if (crew?.role) {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(crew.role, 40, y + 38);
    doc.setTextColor(0, 0, 0);
    y += 58;
  } else {
    y += 40;
  }

  // Payment amount box
  doc.setFillColor(46, 125, 50);
  doc.roundedRect(40, y, W - 80, 60, 8, 8, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("Payment Received:", W / 2, y + 22, { align: "center" });
  
  doc.setFontSize(28);
  doc.text("$" + parseFloat(payment.amount).toFixed(2), W / 2, y + 48, { align: "center" });
  doc.setTextColor(0, 0, 0);
  
  y += 80;

  // Payment details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Payment Details", 40, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const details = [
    ["Job:", payment.jobName || "General Work"],
    ["Hours Worked:", payment.hoursWorked ? payment.hoursWorked + " hours" : "N/A"],
    ["Hourly Rate:", payment.hourlyRate ? "$" + parseFloat(payment.hourlyRate).toFixed(2) + "/hr" : "N/A"],
    ["Payment Method:", formatPaymentMethod(payment.paymentMethod)],
  ];

  if (payment.reference) {
    details.push(["Reference:", payment.reference]);
  }

  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 60, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 180, y);
    y += 18;
  });

  if (payment.notes) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 60, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    const notesLines = doc.splitTextToSize(payment.notes, W - 120);
    doc.text(notesLines, 60, y);
    y += notesLines.length * 14 + 10;
  }

  // Tax information
  y += 20;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 20;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("This payment is recorded as a business expense for tax purposes.", W / 2, y, { align: "center" });
  y += 16;
  doc.text("Please retain this receipt for your records.", W / 2, y, { align: "center" });

  // Footer
  doc.setTextColor(100);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Thank you for your hard work!", W / 2, H - 50, { align: "center" });
  doc.text("Kings Canyon Landscaping LLC", W / 2, H - 36, { align: "center" });
  
  doc.setFontSize(8);
  doc.text("This is an official payment receipt. Generated on " + moment().format("MMM DD, YYYY [at] h:mm A"), W / 2, H - 22, { align: "center" });

  return doc;
}

function formatPaymentMethod(method) {
  const methods = {
    cash: "💵 Cash",
    check: "📝 Check",
    zelle: "💸 Zelle",
    venmo: "💰 Venmo",
    paypal: "🅿️ PayPal",
    direct_deposit: "🏦 Direct Deposit",
  };
  return methods[method] || method;
}
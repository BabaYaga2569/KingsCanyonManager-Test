// src/utils/exportUtils.js
// Export utility for KCL Manager - Excel & Word document generation
// Requires: npm install xlsx file-saver docx jszip --save

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
} from "docx";
import moment from "moment";

// ============================================================
// EXCEL EXPORTS
// ============================================================

/**
 * Export Customers to Excel
 */
export function exportCustomersToExcel(customers) {
  const data = customers.map((c) => ({
    Name: c.name || "",
    Phone: c.phone || "",
    Email: c.email || "",
    Address: c.address || "",
    "Lifetime Value": c.lifetimeValue || 0,
    "Total Jobs": c.contractCount || 0,
    "Total Bids": c.bidCount || 0,
    Notes: c.notes || "",
    "Created Date": c.createdAt
      ? moment(c.createdAt).format("MM/DD/YYYY")
      : "",
  }));

  downloadExcel(data, "KCL_Customers", "Customers");
}

/**
 * Export Invoices to Excel
 */
export function exportInvoicesToExcel(invoices) {
  const data = invoices.map((inv) => ({
    Client: inv.clientName || inv.customerName || "",
    Description: inv.description || "",
    Subtotal: parseFloat(inv.subtotal || inv.amount || 0),
    Tax: parseFloat(inv.tax || 0),
    Total: parseFloat(inv.total || inv.amount || 0),
    Status: inv.status || "Pending",
    "Invoice Date": inv.invoiceDate
      ? moment(inv.invoiceDate).format("MM/DD/YYYY")
      : inv.createdAt
      ? moment(inv.createdAt).format("MM/DD/YYYY")
      : "",
    "Payment Date": inv.paymentDate
      ? moment(inv.paymentDate).format("MM/DD/YYYY")
      : "",
    "Payment Method": inv.paymentMethod || "",
    Type: inv.type || "general",
  }));

  downloadExcel(data, "KCL_Invoices", "Invoices");
}

/**
 * Export Jobs to Excel
 */
export function exportJobsToExcel(jobs) {
  const data = jobs.map((job) => ({
    Client: job.clientName || "",
    Description: job.jobDescription || job.description || "",
    Status: job.status || "scheduled",
    Priority: job.priority || "normal",
    "Job Type": job.jobType || "General Service",
    "Scheduled Date": job.scheduledDate
      ? moment(job.scheduledDate).format("MM/DD/YYYY")
      : "",
    "Completed Date": job.completedDate
      ? moment(job.completedDate).format("MM/DD/YYYY")
      : "",
    Amount: parseFloat(job.amount || job.totalAmount || 0),
    Address: job.customerAddress || job.address || "",
    Notes: job.notes || "",
  }));

  downloadExcel(data, "KCL_Jobs", "Jobs");
}

/**
 * Export Contracts to Excel
 */
export function exportContractsToExcel(contracts) {
  const data = contracts.map((c) => ({
    Client: c.customerName || c.clientName || "",
    Description: c.description || c.jobDescription || "",
    Amount: parseFloat(c.amount || c.totalAmount || 0),
    Status: c.status || "",
    "Created Date": c.createdAt
      ? moment(c.createdAt).format("MM/DD/YYYY")
      : "",
    "Signed Date": c.signedAt
      ? moment(c.signedAt).format("MM/DD/YYYY")
      : "",
    Address: c.customerAddress || c.address || "",
    Phone: c.customerPhone || c.phone || "",
    Email: c.customerEmail || c.email || "",
  }));

  downloadExcel(data, "KCL_Contracts", "Contracts");
}

/**
 * Export Bids to Excel
 */
export function exportBidsToExcel(bids) {
  const data = bids.map((b) => ({
    Customer: b.customerName || "",
    Description: b.description || b.jobDescription || "",
    Amount: parseFloat(b.totalAmount || b.amount || 0),
    Status: b.status || "pending",
    "Created Date": b.createdAt
      ? moment(b.createdAt).format("MM/DD/YYYY")
      : "",
    Address: b.customerAddress || b.address || "",
    Phone: b.customerPhone || b.phone || "",
    Email: b.customerEmail || b.email || "",
  }));

  downloadExcel(data, "KCL_Bids", "Bids");
}

/**
 * Core Excel download helper with formatting
 */
function downloadExcel(data, fileName, sheetName) {
  if (!data || data.length === 0) {
    alert("No data to export.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns based on content
  const colWidths = Object.keys(data[0]).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => String(row[key] || "").length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, `${fileName}_${moment().format("YYYY-MM-DD")}.xlsx`);
}

// ============================================================
// WORD DOCUMENT EXPORTS (Individual Contracts/Bids)
// ============================================================

/**
 * Export a single Contract as a Word document
 */
export async function exportContractToWord(contract) {
  const doc = buildContractDocument(contract);
  const blob = await Packer.toBlob(doc);
  saveAs(
    blob,
    `Contract_${(contract.customerName || contract.clientName || "Unknown").replace(/\s+/g, "_")}_${moment().format("YYYY-MM-DD")}.docx`
  );
}

/**
 * Export a single Bid as a Word document
 */
export async function exportBidToWord(bid) {
  const doc = buildBidDocument(bid);
  const blob = await Packer.toBlob(doc);
  saveAs(
    blob,
    `Bid_${(bid.customerName || "Unknown").replace(/\s+/g, "_")}_${moment().format("YYYY-MM-DD")}.docx`
  );
}

// ============================================================
// BULK WORD EXPORTS (All Contracts/Bids → Zip)
// ============================================================

/**
 * Export ALL Contracts as Word docs in a single Zip file
 */
export async function exportAllContractsToWord(contracts) {
  if (!contracts || contracts.length === 0) {
    alert("No contracts to export.");
    return;
  }

  const zip = new JSZip();

  for (const contract of contracts) {
    try {
      const doc = buildContractDocument(contract);
      const blob = await Packer.toBlob(doc);
      const safeName = (contract.customerName || contract.clientName || "Unknown")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, "_");
      zip.file(`Contract_${safeName}.docx`, blob);
    } catch (error) {
      console.error(`Error generating doc for ${contract.clientName}:`, error);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, `KCL_All_Contracts_${moment().format("YYYY-MM-DD")}.zip`);
}

/**
 * Export ALL Bids as Word docs in a single Zip file
 */
export async function exportAllBidsToWord(bids) {
  if (!bids || bids.length === 0) {
    alert("No bids to export.");
    return;
  }

  const zip = new JSZip();

  for (const bid of bids) {
    try {
      const doc = buildBidDocument(bid);
      const blob = await Packer.toBlob(doc);
      const safeName = (bid.customerName || "Unknown")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, "_");
      zip.file(`Bid_${safeName}.docx`, blob);
    } catch (error) {
      console.error(`Error generating doc for ${bid.customerName}:`, error);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, `KCL_All_Bids_${moment().format("YYYY-MM-DD")}.zip`);
}

// ============================================================
// WORD DOCUMENT BUILDERS (shared by single + bulk exports)
// ============================================================

function buildContractDocument(contract) {
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          ...buildCompanyHeader(),
          new Paragraph({
            children: [
              new TextRun({
                text: "SERVICE CONTRACT",
                bold: true,
                size: 32,
                font: "Arial",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Date: ${
                  contract.createdAt
                    ? moment(contract.createdAt).format("MMMM DD, YYYY")
                    : moment().format("MMMM DD, YYYY")
                }`,
                size: 22,
                font: "Arial",
              }),
            ],
            spacing: { after: 200 },
          }),
          buildDivider(),
          buildSectionHeader("CLIENT INFORMATION"),
          buildLabelValue("Name", contract.customerName || contract.clientName || ""),
          buildLabelValue("Address", contract.customerAddress || contract.address || ""),
          buildLabelValue("Phone", contract.customerPhone || contract.phone || ""),
          buildLabelValue("Email", contract.customerEmail || contract.email || ""),
          buildDivider(),
          buildSectionHeader("SERVICE DETAILS"),
          buildLabelValue("Description", contract.description || contract.jobDescription || ""),
          ...(contract.lineItems && contract.lineItems.length > 0
            ? [
                new Paragraph({ spacing: { before: 200, after: 100 } }),
                buildLineItemsTable(contract.lineItems),
              ]
            : []),
          new Paragraph({ spacing: { before: 200 } }),
          buildLabelValue(
            "Total Amount",
            `$${parseFloat(
              contract.amount || contract.totalAmount || 0
            ).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          ),
          buildLabelValue("Status", contract.status || ""),
          buildDivider(),
          buildSectionHeader("TERMS & CONDITIONS"),
          new Paragraph({
            children: [
              new TextRun({
                text:
                  contract.terms ||
                  "Standard terms and conditions apply. Payment is due upon completion of services unless otherwise agreed upon in writing. Kings Canyon Landscaping LLC reserves the right to modify scope upon mutual agreement.",
                size: 20,
                font: "Arial",
              }),
            ],
            spacing: { after: 200 },
          }),
          buildDivider(),
          buildSectionHeader("SIGNATURES"),
          new Paragraph({ spacing: { before: 400 } }),
          buildSignatureLine("Client Signature"),
          new Paragraph({ spacing: { before: 300 } }),
          buildSignatureLine("Kings Canyon Landscaping LLC"),
          new Paragraph({
            children: [
              new TextRun({
                text: "\nKings Canyon Landscaping LLC | Bullhead City, AZ | ramslife2569@gmail.com",
                size: 16,
                font: "Arial",
                color: "888888",
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600 },
          }),
        ],
      },
    ],
  });
}

function buildBidDocument(bid) {
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          ...buildCompanyHeader(),
          new Paragraph({
            children: [
              new TextRun({
                text: "PROJECT BID / ESTIMATE",
                bold: true,
                size: 32,
                font: "Arial",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Date: ${
                  bid.createdAt
                    ? moment(bid.createdAt).format("MMMM DD, YYYY")
                    : moment().format("MMMM DD, YYYY")
                }`,
                size: 22,
                font: "Arial",
              }),
            ],
            spacing: { after: 200 },
          }),
          buildDivider(),
          buildSectionHeader("PREPARED FOR"),
          buildLabelValue("Name", bid.customerName || ""),
          buildLabelValue("Address", bid.customerAddress || bid.address || ""),
          buildLabelValue("Phone", bid.customerPhone || bid.phone || ""),
          buildLabelValue("Email", bid.customerEmail || bid.email || ""),
          buildDivider(),
          buildSectionHeader("SCOPE OF WORK"),
          new Paragraph({
            children: [
              new TextRun({
                text: bid.description || bid.jobDescription || "See attached specifications.",
                size: 22,
                font: "Arial",
              }),
            ],
            spacing: { after: 200 },
          }),
          ...(bid.lineItems && bid.lineItems.length > 0
            ? [
                new Paragraph({ spacing: { before: 200, after: 100 } }),
                buildLineItemsTable(bid.lineItems),
              ]
            : []),
          buildDivider(),
          buildSectionHeader("PRICING"),
          buildLabelValue(
            "Estimated Total",
            `$${parseFloat(
              bid.totalAmount || bid.amount || 0
            ).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          ),
          ...(bid.notes
            ? [
                buildDivider(),
                buildSectionHeader("ADDITIONAL NOTES"),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: bid.notes,
                      size: 20,
                      font: "Arial",
                    }),
                  ],
                  spacing: { after: 200 },
                }),
              ]
            : []),
          buildDivider(),
          new Paragraph({
            children: [
              new TextRun({
                text: "This bid is valid for 30 days from the date above. Pricing may change after the validity period.",
                size: 20,
                font: "Arial",
                italics: true,
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          buildSectionHeader("ACCEPTANCE"),
          new Paragraph({
            children: [
              new TextRun({
                text: "By signing below, the client accepts this bid and authorizes Kings Canyon Landscaping LLC to proceed with the work described above.",
                size: 20,
                font: "Arial",
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({ spacing: { before: 300 } }),
          buildSignatureLine("Client Signature"),
          new Paragraph({ spacing: { before: 200 } }),
          buildSignatureLine("Date"),
          new Paragraph({
            children: [
              new TextRun({
                text: "\nKings Canyon Landscaping LLC | Bullhead City, AZ | ramslife2569@gmail.com",
                size: 16,
                font: "Arial",
                color: "888888",
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600 },
          }),
        ],
      },
    ],
  });
}

// ============================================================
// WORD DOCUMENT HELPERS
// ============================================================

function buildCompanyHeader() {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "KINGS CANYON LANDSCAPING LLC",
          bold: true,
          size: 36,
          font: "Arial",
          color: "2E7D32",
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Bullhead City, Arizona | ramslife2569@gmail.com",
          size: 20,
          font: "Arial",
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
  ];
}

function buildSectionHeader(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        font: "Arial",
        color: "2E7D32",
      }),
    ],
    spacing: { before: 300, after: 100 },
  });
}

function buildLabelValue(label, value) {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        size: 22,
        font: "Arial",
      }),
      new TextRun({
        text: value || "—",
        size: 22,
        font: "Arial",
      }),
    ],
    spacing: { after: 60 },
  });
}

function buildDivider() {
  return new Paragraph({
    children: [
      new TextRun({
        text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        size: 16,
        color: "CCCCCC",
        font: "Arial",
      }),
    ],
    spacing: { before: 200, after: 200 },
  });
}

function buildSignatureLine(label) {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${label}                                                              Date`,
        size: 18,
        font: "Arial",
        color: "888888",
      }),
    ],
    spacing: { before: 40, after: 40 },
  });
}

function buildLineItemsTable(lineItems) {
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Description", bold: true, size: 20, font: "Arial" }),
            ],
          }),
        ],
        width: { size: 70, type: WidthType.PERCENTAGE },
        shading: { fill: "E8F5E9" },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Amount", bold: true, size: 20, font: "Arial" }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
        ],
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { fill: "E8F5E9" },
      }),
    ],
  });

  const itemRows = lineItems.map(
    (item) =>
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.description || item.name || "",
                    size: 20,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `$${parseFloat(item.amount || item.price || 0).toFixed(2)}`,
                    size: 20,
                    font: "Arial",
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        ],
      })
  );

  return new Table({
    rows: [headerRow, ...itemRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}
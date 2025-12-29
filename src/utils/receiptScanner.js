import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

/**
 * Receipt Scanner using Google Cloud Vision API
 * Extracts vendor, date, amount, items, and tax from receipt photos
 */

// Vendor to Category mapping
const VENDOR_CATEGORIES = {
  // Building Materials
  "home depot": "Materials",
  "homedepot": "Materials",
  "lowe's": "Materials",
  "lowes": "Materials",
  "ace hardware": "Materials",
  "true value": "Materials",
  "menards": "Materials",
  
  // Fuel
  "shell": "Fuel",
  "chevron": "Fuel",
  "exxon": "Fuel",
  "mobil": "Fuel",
  "circle k": "Fuel",
  "7-eleven": "Fuel",
  "arco": "Fuel",
  "bp": "Fuel",
  "valero": "Fuel",
  
  // Vehicle Maintenance
  "autozone": "Vehicle Maintenance",
  "o'reilly": "Vehicle Maintenance",
  "napa": "Vehicle Maintenance",
  "advance auto": "Vehicle Maintenance",
  
  // Meals
  "subway": "Meals",
  "mcdonald": "Meals",
  "burger king": "Meals",
  "taco bell": "Meals",
  "wendy": "Meals",
  "starbucks": "Meals",
  "dunkin": "Meals",
  
  // Nursery/Plants
  "nursery": "Plants",
  "garden center": "Plants",
  
  // Other
  "walmart": "Materials",
  "target": "Materials",
  "costco": "Materials",
};

/**
 * Scan receipt using Google Cloud Vision API
 * @param {File} imageFile - Receipt image file
 * @returns {Promise<Object>} Extracted receipt data
 */
export const scanReceipt = async (imageFile) => {
  try {
    console.log("📸 Starting receipt scan...");
    
    // Convert image to base64
    const base64Image = await fileToBase64(imageFile);
    
    // Call Google Cloud Vision API
    const apiKey = process.env.REACT_APP_GOOGLE_VISION_API_KEY;
    
    if (!apiKey) {
      throw new Error("Google Vision API key not configured. Add REACT_APP_GOOGLE_VISION_API_KEY to your .env file");
    }
    
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image.split(',')[1], // Remove data:image prefix
              },
              features: [
                {
                  type: "DOCUMENT_TEXT_DETECTION",
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Vision API request failed");
    }

    const result = await response.json();
    const text = result.responses[0]?.fullTextAnnotation?.text || "";
    
    if (!text) {
      throw new Error("No text detected in receipt image");
    }

    console.log("✅ Receipt text extracted:", text);

    // Parse the extracted text
    const parsedData = parseReceiptText(text);
    
    // Upload receipt image to Firebase Storage
    const receiptUrl = await uploadReceiptImage(imageFile);
    parsedData.receiptUrl = receiptUrl;
    
    console.log("✅ Receipt scan complete:", parsedData);
    
    return parsedData;
  } catch (error) {
    console.error("❌ Receipt scan error:", error);
    throw error;
  }
};

/**
 * Convert file to base64
 */
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Upload receipt image to Firebase Storage
 */
const uploadReceiptImage = async (file) => {
  try {
    const timestamp = Date.now();
    const filename = `receipts/${timestamp}_${file.name}`;
    const storageRef = ref(storage, filename);
    
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    
    return url;
  } catch (error) {
    console.error("Error uploading receipt:", error);
    throw error;
  }
};

/**
 * Parse extracted text to find receipt data
 */
const parseReceiptText = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  const result = {
    vendor: "",
    category: "",
    date: "",
    amount: 0,
    description: "",
    tax: 0,
    items: [],
    confidence: "medium",
  };

  // Extract vendor (usually first few lines)
  const vendor = extractVendor(lines);
  result.vendor = vendor;
  result.category = categorizeVendor(vendor);

  // Extract date
  result.date = extractDate(lines);

  // Extract total amount
  const amounts = extractAmounts(text);
  result.amount = amounts.total;
  result.tax = amounts.tax;

  // Extract items
  result.items = extractItems(lines);
  result.description = result.items.slice(0, 3).join(", ") || "Receipt items";

  return result;
};

/**
 * Extract vendor name from receipt
 */
const extractVendor = (lines) => {
  // Vendor is usually in the first 1-5 lines
  const topLines = lines.slice(0, 5).join(" ").toLowerCase();
  
  // Check known vendors
  for (const [vendor, category] of Object.entries(VENDOR_CATEGORIES)) {
    if (topLines.includes(vendor)) {
      return vendor.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  
  // Return first line as vendor if no match
  return lines[0] || "Unknown Vendor";
};

/**
 * Categorize vendor
 */
const categorizeVendor = (vendor) => {
  const vendorLower = vendor.toLowerCase();
  
  for (const [key, category] of Object.entries(VENDOR_CATEGORIES)) {
    if (vendorLower.includes(key)) {
      return category;
    }
  }
  
  return "Other";
};

/**
 * Extract date from receipt
 */
const extractDate = (lines) => {
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,  // MM/DD/YYYY or MM-DD-YY
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,    // YYYY/MM/DD
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{4})/i, // Month DD, YYYY
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        // Convert to YYYY-MM-DD format
        try {
          const dateStr = match[0];
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch (e) {
          continue;
        }
      }
    }
  }

  // Default to today's date
  return new Date().toISOString().split('T')[0];
};

/**
 * Extract amounts from receipt
 */
const extractAmounts = (text) => {
  const amounts = {
    total: 0,
    tax: 0,
  };

  // Look for total
  const totalPatterns = [
    /total[:\s]*\$?(\d+\.\d{2})/i,
    /amount[:\s]*\$?(\d+\.\d{2})/i,
    /balance[:\s]*\$?(\d+\.\d{2})/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      amounts.total = parseFloat(match[1]);
      break;
    }
  }

  // Look for tax
  const taxPatterns = [
    /tax[:\s]*\$?(\d+\.\d{2})/i,
    /sales\s+tax[:\s]*\$?(\d+\.\d{2})/i,
  ];

  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match) {
      amounts.tax = parseFloat(match[1]);
      break;
    }
  }

  // If no total found, find the largest dollar amount
  if (amounts.total === 0) {
    const allAmounts = text.match(/\$?(\d+\.\d{2})/g) || [];
    const numbers = allAmounts.map(a => parseFloat(a.replace('$', '')));
    amounts.total = Math.max(...numbers, 0);
  }

  return amounts;
};

/**
 * Extract line items from receipt
 */
const extractItems = (lines) => {
  const items = [];
  
  // Look for lines with item descriptions and prices
  const itemPattern = /^(.+?)\s+\$?(\d+\.\d{2})$/;
  
  for (const line of lines) {
    const match = line.match(itemPattern);
    if (match) {
      const description = match[1].trim();
      const price = match[2];
      
      // Skip total/tax lines
      if (!/total|tax|subtotal|amount|balance/i.test(description)) {
        items.push(`${description} ($${price})`);
      }
    }
  }
  
  return items.slice(0, 10); // Limit to 10 items
};

export default scanReceipt;
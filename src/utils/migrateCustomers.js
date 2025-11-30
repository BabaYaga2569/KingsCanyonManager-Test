import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc,
  writeBatch 
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Scan all existing data and create customer records
 * Links all bids/contracts/invoices/jobs to the new customer records
 */
export async function migrateCustomersFromExistingData() {
  const results = {
    customersCreated: 0,
    bidsLinked: 0,
    contractsLinked: 0,
    invoicesLinked: 0,
    jobsLinked: 0,
    errors: [],
  };

  try {
    // Step 1: Collect all unique customer data from all collections
    const customerMap = new Map();

    // Get all invoices (best source of customer data)
    const invoicesSnap = await getDocs(collection(db, "invoices"));
    invoicesSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.clientName || "Unknown Customer";
      
      if (!customerMap.has(name)) {
        customerMap.set(name, {
          name: name,
          email: data.clientEmail || "",
          phone: data.clientPhone || "",
          address: data.clientAddress || "",
          notes: "",
          createdAt: new Date().toISOString(),
          lifetimeValue: 0,
          linkedDocs: {
            bids: [],
            contracts: [],
            invoices: [],
            jobs: [],
          },
        });
      }

      // Update customer data if invoice has more info
      const customer = customerMap.get(name);
      if (data.clientEmail && !customer.email) {
        customer.email = data.clientEmail;
      }
      if (data.clientPhone && !customer.phone) {
        customer.phone = data.clientPhone;
      }
      if (data.clientAddress && !customer.address) {
        customer.address = data.clientAddress;
      }

      // Track invoice
      customer.linkedDocs.invoices.push(doc.id);
      
      // Add to lifetime value if invoice is paid
      if (data.status?.toLowerCase() === "paid") {
        const amount = parseFloat(data.total || data.amount || 0);
        customer.lifetimeValue += amount;
      }
    });

    // Get contracts
    const contractsSnap = await getDocs(collection(db, "contracts"));
    contractsSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.clientName || "Unknown Customer";
      
      if (!customerMap.has(name)) {
        customerMap.set(name, {
          name: name,
          email: "",
          phone: "",
          address: "",
          notes: "",
          createdAt: new Date().toISOString(),
          lifetimeValue: 0,
          linkedDocs: {
            bids: [],
            contracts: [],
            invoices: [],
            jobs: [],
          },
        });
      }

      customerMap.get(name).linkedDocs.contracts.push(doc.id);
    });

    // Get jobs
    const jobsSnap = await getDocs(collection(db, "jobs"));
    jobsSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.clientName || "Unknown Customer";
      
      if (!customerMap.has(name)) {
        customerMap.set(name, {
          name: name,
          email: "",
          phone: "",
          address: "",
          notes: "",
          createdAt: new Date().toISOString(),
          lifetimeValue: 0,
          linkedDocs: {
            bids: [],
            contracts: [],
            invoices: [],
            jobs: [],
          },
        });
      }

      customerMap.get(name).linkedDocs.jobs.push(doc.id);
    });

    // Get bids
    const bidsSnap = await getDocs(collection(db, "bids"));
    bidsSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.customerName || "Unknown Customer";
      
      if (!customerMap.has(name)) {
        customerMap.set(name, {
          name: name,
          email: "",
          phone: "",
          address: "",
          notes: "",
          createdAt: new Date().toISOString(),
          lifetimeValue: 0,
          linkedDocs: {
            bids: [],
            contracts: [],
            invoices: [],
            jobs: [],
          },
        });
      }

      customerMap.get(name).linkedDocs.bids.push(doc.id);
    });

    console.log(`Found ${customerMap.size} unique customers`);

    // Step 2: Create customer records and get their IDs
    const customerIdMap = new Map(); // name -> customerId

    for (const [name, customerData] of customerMap) {
      try {
        const customerRef = await addDoc(collection(db, "customers"), {
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          address: customerData.address,
          notes: customerData.notes,
          createdAt: customerData.createdAt,
          lifetimeValue: customerData.lifetimeValue,
        });

        customerIdMap.set(name, customerRef.id);
        results.customersCreated++;
      } catch (error) {
        results.errors.push(`Failed to create customer ${name}: ${error.message}`);
      }
    }

    // Step 3: Link all documents to their customers
    const batch = writeBatch(db);
    let batchCount = 0;

    // Link invoices
    for (const [name, customerData] of customerMap) {
      const customerId = customerIdMap.get(name);
      if (!customerId) continue;

      for (const invoiceId of customerData.linkedDocs.invoices) {
        batch.update(doc(db, "invoices", invoiceId), { customerId });
        results.invoicesLinked++;
        batchCount++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }

      for (const contractId of customerData.linkedDocs.contracts) {
        batch.update(doc(db, "contracts", contractId), { customerId });
        results.contractsLinked++;
        batchCount++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }

      for (const jobId of customerData.linkedDocs.jobs) {
        batch.update(doc(db, "jobs", jobId), { customerId });
        results.jobsLinked++;
        batchCount++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }

      for (const bidId of customerData.linkedDocs.bids) {
        batch.update(doc(db, "bids", bidId), { customerId });
        results.bidsLinked++;
        batchCount++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
    }

    return results;
  } catch (error) {
    console.error("Migration error:", error);
    results.errors.push(`Migration failed: ${error.message}`);
    return results;
  }
}

/**
 * Preview what will be imported without making changes
 */
export async function previewCustomerMigration() {
  const preview = {
    customers: [],
    totalCustomers: 0,
    totalLifetimeValue: 0,
  };

  try {
    const customerMap = new Map();

    // Scan invoices for customer data
    const invoicesSnap = await getDocs(collection(db, "invoices"));
    invoicesSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.clientName || "Unknown Customer";
      
      if (!customerMap.has(name)) {
        customerMap.set(name, {
          name: name,
          email: data.clientEmail || "",
          phone: data.clientPhone || "",
          address: data.clientAddress || "",
          lifetimeValue: 0,
          invoiceCount: 0,
          contractCount: 0,
          jobCount: 0,
          bidCount: 0,
        });
      }

      const customer = customerMap.get(name);
      customer.invoiceCount++;
      
      if (data.status?.toLowerCase() === "paid") {
        const amount = parseFloat(data.total || data.amount || 0);
        customer.lifetimeValue += amount;
      }
    });

    // Count contracts
    const contractsSnap = await getDocs(collection(db, "contracts"));
    contractsSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.clientName || "Unknown Customer";
      if (customerMap.has(name)) {
        customerMap.get(name).contractCount++;
      }
    });

    // Count jobs
    const jobsSnap = await getDocs(collection(db, "jobs"));
    jobsSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.clientName || "Unknown Customer";
      if (customerMap.has(name)) {
        customerMap.get(name).jobCount++;
      }
    });

    // Count bids
    const bidsSnap = await getDocs(collection(db, "bids"));
    bidsSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.customerName || "Unknown Customer";
      if (customerMap.has(name)) {
        customerMap.get(name).bidCount++;
      }
    });

    // Build preview
    preview.totalCustomers = customerMap.size;
    preview.customers = Array.from(customerMap.values()).sort((a, b) => 
      b.lifetimeValue - a.lifetimeValue
    );
    preview.totalLifetimeValue = preview.customers.reduce(
      (sum, c) => sum + c.lifetimeValue, 
      0
    );

    return preview;
  } catch (error) {
    console.error("Preview error:", error);
    throw error;
  }
}
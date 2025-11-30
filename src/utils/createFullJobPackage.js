import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

async function checkExistingPackage(clientName) {
  try {
    const contractsQuery = query(
      collection(db, "contracts"),
      where("clientName", "==", clientName)
    );
    const contractsSnap = await getDocs(contractsQuery);
    
    if (!contractsSnap.empty) {
      const existingContract = contractsSnap.docs[0];
      const contractData = existingContract.data();
      const sharedJobId = contractData.jobId;
      
      const invoicesQuery = query(
        collection(db, "invoices"),
        where("jobId", "==", sharedJobId)
      );
      const jobsQuery = query(
        collection(db, "jobs"),
        where("jobId", "==", sharedJobId)
      );
      
      const [invoicesSnap, jobsSnap] = await Promise.all([
        getDocs(invoicesQuery),
        getDocs(jobsQuery)
      ]);
      
      return {
        exists: true,
        contractId: existingContract.id,
        invoiceId: invoicesSnap.empty ? null : invoicesSnap.docs[0].id,
        jobId: jobsSnap.empty ? null : jobsSnap.docs[0].id,
        sharedJobId: sharedJobId,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error checking for existing package:", error);
    return null;
  }
}

export async function createFullJobPackage(bid, forceCreate = false) {
  const clientName = bid.customerName || "Unnamed Client";
  
  if (!forceCreate) {
    const existing = await checkExistingPackage(clientName);
    if (existing) {
      return {
        ...existing,
        wasExisting: true,
        message: `${clientName} already has a job package. Opening existing contract.`,
      };
    }
  }
  
  const sharedJobId = crypto.randomUUID();
  const base = {
    jobId: sharedJobId,
    clientName: clientName,
    amount: bid.amount || 0,
    description: bid.description || "",
    materials: bid.materials || "",
    notes: bid.notes || "",
    createdAt: serverTimestamp(),
    status: "Pending",
  };

  const contractRef = await addDoc(collection(db, "contracts"), {
    ...base,
    type: "contract",
  });

  const invoiceRef = await addDoc(collection(db, "invoices"), {
    ...base,
    type: "invoice",
    subtotal: bid.amount || 0,
    tax: 0,
    total: bid.amount || 0,
  });

  const jobRef = await addDoc(collection(db, "jobs"), {
    ...base,
    type: "job",
    photos: [],
  });

  return {
    contractId: contractRef.id,
    invoiceId: invoiceRef.id,
    jobId: jobRef.id,
    sharedJobId: sharedJobId,
    wasExisting: false,
    message: `New job package created for ${clientName}.`,
  };
}
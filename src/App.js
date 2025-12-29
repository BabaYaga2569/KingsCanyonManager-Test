import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  ButtonGroup,
  Container,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Box,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import Swal from "sweetalert2";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

import ContractsDashboard from "./ContractsDashboard";
import CreateBid from "./CreateBid";
import BidEditor from "./BidEditor";
import ContractEditor from "./ContractEditor";
import Dashboard from "./Dashboard";
import InvoicesDashboard from "./InvoicesDashboard";
import InvoiceEditor from "./InvoiceEditor";
import JobsManager from "./JobsManager";
import CustomersDashboard from "./CustomersDashboard";
import CustomerProfile from "./CustomerProfile";
import CustomerEditor from "./CustomerEditor";
import ScheduleJob from "./ScheduleJob";
import ScheduleDashboard from "./ScheduleDashboard";
import CalendarView from "./CalendarView";
import PaymentTracker from "./PaymentTracker";
import PaymentsDashboard from "./PaymentsDashboard";
import CrewManager from "./CrewManager";
import EquipmentManager from "./EquipmentManager";
import NDAEditor from "./NDAEditor";
import NDASigningPage from "./NDASigningPage";
import ExpensesManager from "./ExpensesManager";
import CrewPayroll from "./CrewPayroll";
import CrewPaymentHistory from "./CrewPaymentHistory";
import TaxReport from "./TaxReport";
import JobExpenses from "./JobExpenses";
import JobTimeTracking from "./JobTimeTracking";
import { createFullJobPackage } from "./utils/createFullJobPackage";
import { useNavigate } from "react-router-dom";
import generateBidPDF from "./pdf/generateBidPDF";
import ContractSigningPage from "./ContractSigningPage";
import PaymentPortal from "./PaymentPortal";

// --------------------- BIDS LIST (was Home) ---------------------
function BidsList() {
  const [bids, setBids] = useState([]);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const navigate = useNavigate();

  // Load logo for PDF generation
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        setLogoDataUrl(canvas.toDataURL("image/png"));
      } catch (e) {
        console.warn("Logo loading failed:", e);
        setLogoDataUrl(null);
      }
    };
    img.src = "/logo-kcl.png";
  }, []);

  useEffect(() => {
    const fetchBids = async () => {
      const querySnapshot = await getDocs(collection(db, "bids"));
      const bidsData = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setBids(bidsData);
    };
    fetchBids();
  }, []);

  const handleDelete = async (bid) => {
    await deleteDoc(doc(db, "bids", bid.id));
    setBids(bids.filter((b) => b.id !== bid.id));
  };

  const handleCreateContract = async (bid) => {
    try {
      const result = await createFullJobPackage(bid);
      
      // createFullJobPackage returns null if user cancelled or opened existing
      if (!result) return;
      
      const { contractId, invoiceId, jobId } = result;

      Swal.fire({
        icon: "success",
        title: "Job Package Created!",
        html: `
          <b>${bid.customerName}</b>'s bid has been promoted.<br>
          <ul style="text-align:left">
            <li>Contract: ${contractId}</li>
            <li>Invoice: ${invoiceId}</li>
            <li>Job Folder: ${jobId}</li>
          </ul>
        `,
        confirmButtonText: "Open Contract",
      }).then(() => {
        window.location.assign(`/contract/${contractId}`);
      });
    } catch (error) {
      console.error("Error creating full job package:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Could not create linked documents. Check console for details.",
      });
    }
  };

  const handleGeneratePDF = async (bid) => {
    try {
      const pdf = await generateBidPDF(bid, logoDataUrl);
      
      // Create blob URL for viewing in browser
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open in new tab for preview
      window.open(pdfUrl, '_blank');
      
      Swal.fire({
        icon: "success",
        title: "PDF Opened!",
        text: `Viewing bid proposal for ${bid.customerName}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error generating bid PDF:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to generate PDF. Please try again.",
      });
    }
  };

  return (
    <Container sx={{ mt: 3, px: { xs: 1, sm: 2 } }}>
      <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        Bids List
      </Typography>
      
      {/* Mobile: Card layout */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {bids.map((bid) => (
          <Box
            key={bid.id}
            sx={{
              mb: 2,
              p: 2,
              border: '1px solid #ddd',
              borderRadius: 2,
              backgroundColor: 'white',
            }}
          >
            <Typography variant="h6" sx={{ mb: 1 }}>{bid.customerName}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Amount: ${bid.amount}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>{bid.description}</Typography>
            {bid.materials && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Materials: {bid.materials}
              </Typography>
            )}
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={() => navigate(`/bid/${bid.id}`)}
                fullWidth
              >
                Edit
              </Button>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={() => handleGeneratePDF(bid)}
                fullWidth
              >
                View PDF
              </Button>
              <Button
                variant="outlined"
                color="success"
                size="small"
                onClick={() => handleCreateContract(bid)}
                fullWidth
              >
                Create Contract
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => handleDelete(bid)}
                fullWidth
              >
                Delete
              </Button>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Desktop: Table layout */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f2f2f2",
                textAlign: "left",
                borderBottom: "2px solid #ccc",
              }}
            >
              <th style={{ padding: 10 }}>Customer</th>
              <th style={{ padding: 10 }}>Amount ($)</th>
              <th style={{ padding: 10 }}>Description</th>
              <th style={{ padding: 10 }}>Materials</th>
              <th style={{ padding: 10 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => (
              <tr key={bid.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: 10 }}>{bid.customerName}</td>
                <td style={{ padding: 10 }}>${bid.amount}</td>
                <td style={{ padding: 10 }}>{bid.description}</td>
                <td style={{ padding: 10 }}>{bid.materials}</td>
                <td style={{ padding: 10 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => navigate(`/bid/${bid.id}`)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => handleGeneratePDF(bid)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    View PDF
                  </Button>
                  <Button
                    variant="outlined"
                    color="success"
                    size="small"
                    onClick={() => handleCreateContract(bid)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    Create Contract
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => handleDelete(bid)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Container>
  );
}

// ------------------------- APP CHROME -------------------------
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (p) => location.pathname === p;
  
  // Check if we're on a public page (no navigation should show)
  const isPublicPage = location.pathname.startsWith('/public/');

  const menuItems = [
    { label: "Dashboard", path: "/" },
    { label: "Bids", path: "/bids" },
    { label: "Create Bid", path: "/create-bid" },
    { label: "Contracts", path: "/contracts" },
    { label: "Invoices", path: "/invoices" },
    { label: "Jobs", path: "/jobs" },
    { label: "Customers", path: "/customers" },
    { label: "Schedule", path: "/schedule-dashboard" },
    { label: "Calendar", path: "/calendar-view" },
    { label: "Payments", path: "/payments-dashboard" },
    { label: "Expenses", path: "/expenses-manager" },
    { label: "Payroll", path: "/crew-payroll" },
    { label: "Tax Report", path: "/tax-report" },
    { label: "Crew", path: "/crew-manager" },
    { label: "Equipment", path: "/equipment-manager" },
    { label: "Job Tracking", path: "/job-tracking" },
  ];

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleMenuClick = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Only show navigation for private pages, hide for public pages */}
      {!isPublicPage && (
        <>
          <AppBar position="static" sx={{ backgroundColor: "#1565c0" }}>
            <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
              <Typography variant="h6" sx={{ flexGrow: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                KCL Manager
              </Typography>

              {/* Mobile: Hamburger Menu */}
              {isMobile ? (
                <IconButton
                  color="inherit"
                  edge="end"
                  onClick={handleDrawerToggle}
                  sx={{ ml: 2 }}
                >
                  <MenuIcon />
                </IconButton>
              ) : (
                // Desktop: Button Group
                <ButtonGroup variant="text" sx={{ "& .MuiButton-root": { textTransform: "none" } }}>
                  {menuItems.map((item) => (
                    <Button
                      key={item.path}
                      component={Link}
                      to={item.path}
                      sx={{
                        color: isActive(item.path) ? "#FFD700" : "#fff",
                        fontWeight: isActive(item.path) ? 700 : 500,
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                </ButtonGroup>
              )}
            </Toolbar>
          </AppBar>

          {/* Mobile Drawer */}
          <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={handleDrawerToggle}
            sx={{
              '& .MuiDrawer-paper': {
                width: 250,
              },
            }}
          >
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Menu</Typography>
              <IconButton onClick={handleDrawerToggle}>
                <CloseIcon />
              </IconButton>
            </Box>
            <List>
              {menuItems.map((item) => (
                <ListItem
                  button
                  key={item.path}
                  onClick={() => handleMenuClick(item.path)}
                  sx={{
                    backgroundColor: isActive(item.path) ? '#e3f2fd' : 'transparent',
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    },
                  }}
                >
                  <ListItemText
                    primary={item.label}
                    sx={{
                      '& .MuiTypography-root': {
                        fontWeight: isActive(item.path) ? 700 : 400,
                        color: isActive(item.path) ? '#1565c0' : 'inherit',
                      },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Drawer>
        </>
      )}

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bids" element={<BidsList />} />
        <Route path="/create-bid" element={<CreateBid />} />
        <Route path="/bid/:id" element={<BidEditor />} />
        <Route path="/contracts" element={<ContractsDashboard />} />
        <Route path="/contract/:id" element={<ContractEditor />} />
        <Route path="/invoices" element={<InvoicesDashboard />} />
        <Route path="/invoice/:id" element={<InvoiceEditor />} />
        <Route path="/jobs" element={<JobsManager />} />
        <Route path="/customers" element={<CustomersDashboard />} />
        <Route path="/customer/:id" element={<CustomerEditor />} />
        <Route path="/customer-profile/:id" element={<CustomerProfile />} />
        <Route path="/schedule-job" element={<ScheduleJob />} />
        <Route path="/schedule-dashboard" element={<ScheduleDashboard />} />
        <Route path="/calendar-view" element={<CalendarView />} />
        <Route path="/payment-tracker/:id" element={<PaymentTracker />} />
        <Route path="/payments-dashboard" element={<PaymentsDashboard />} />
        <Route path="/crew-manager" element={<CrewManager />} />
        <Route path="/equipment-manager" element={<EquipmentManager />} />
        <Route path="/nda/:crewId" element={<NDAEditor />} />
		<Route path="/public/nda/:crewId" element={<NDASigningPage />} />
        
        {/* Expenses & Payroll Routes */}
        <Route path="/expenses-manager" element={<ExpensesManager />} />
        <Route path="/crew-payroll" element={<CrewPayroll />} />
        <Route path="/crew-payment-history" element={<CrewPaymentHistory />} />
        <Route path="/tax-report" element={<TaxReport />} />
        <Route path="/job-expenses/:id" element={<JobExpenses />} />
        <Route path="/job-tracking" element={<JobTimeTracking />} />
        
        {/* PUBLIC ROUTES - Customer signature & payment pages (NO NAVIGATION SHOWN) */}
        <Route path="/public/sign/:contractId" element={<ContractSigningPage />} />
        <Route path="/public/pay/:invoiceId" element={<PaymentPortal />} />
      </Routes>
    </>
  );
}

// ------------------------- ROUTER WRAPPER -------------------------
export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
// COMPLETE APP.JS - WITH SORTING ON BIDS LIST + NOTES MANAGER
// Supports CREW, ADMIN, and GOD roles
// Crew members see limited menu and are redirected to Time Clock
// Now includes sorting dropdown for Bids List!
// ADDED: Notes Manager for tracking customer requests, materials, and tasks

import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  Navigate,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Badge,
  Chip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import LogoutIcon from "@mui/icons-material/Logout";
import SortIcon from "@mui/icons-material/Sort";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionIcon from "@mui/icons-material/Description";
import Swal from "sweetalert2";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
// Import AuthProvider
import { AuthProvider, useAuth } from "./AuthProvider";

// Import notification counts hook
import { useNotificationCounts, markAsViewed } from "./useNotificationCounts";

// Import cascade cancel utility
import { cascadeCancelJob, buildCancelSummary, buildCancelConfirmationMessage } from "./utils/cascadeCancel";

import ContractsDashboard from "./ContractsDashboard";
import CreateBid from "./CreateBid";
import ContractEditor from "./ContractEditor";
import Dashboard from "./Dashboard";
import EnhancedDashboard from './EnhancedDashboard';
import CalendarView from './CalendarView';
import InvoicesDashboard from "./InvoicesDashboard";
import InvoiceEditor from "./InvoiceEditor";
import JobsManager from "./JobsManager";
import CustomersDashboard from "./CustomersDashboard";
import CustomerProfile from "./CustomerProfile";
import CustomerEditor from "./CustomerEditor";
import ScheduleJob from "./ScheduleJob";
import ScheduleDashboard from "./ScheduleDashboard";
// ========================================
// 🔒 CRITICAL: MAINTENANCE COMPONENTS - DO NOT REMOVE
// If these are missing, the Maintenance tab won't work!
// ========================================
import MaintenanceDashboard from "./MaintenanceDashboard";
import MaintenanceEditor from "./MaintenanceEditor";
// ========================================
import PaymentTracker from "./PaymentTracker";
import PaymentsDashboard from "./PaymentsDashboard";
import CrewManager from "./CrewManager";
import EquipmentManager from "./EquipmentManager";
import NDAEditor from "./NDAEditor";
import NDASigningPage from "./NDASigningPage";
import NDASigning from "./NDASigning"; // NEW: Employee first-login NDA
import ExpensesManager from "./ExpensesManager";
import IntegratedPayroll from "./IntegratedPayroll"; // ✅ CHANGED: New integrated payroll system
import CrewPaymentHistory from "./CrewPaymentHistory";
import TaxReport from "./TaxReport";
import MigrationPage from './MigrationPage';
import MigrationDashboard from './MigrationDashboard';
import JobExpenses from "./JobExpenses";
import NotesManager from "./NotesManager"; // ← ADDED: Notes Manager
import NotificationSettings from "./NotificationSettings"; // NEW: SMS Notification Settings
import EmployeeAccountManager from './EmployeeAccountManager';
import { createFullJobPackage } from "./utils/createFullJobPackage";
import { exportBidsToExcel, exportBidToWord, exportAllBidsToWord } from "./utils/exportUtils";
import generateBidPDF from "./pdf/generateBidPDF";
import ContractSigningPage from "./ContractSigningPage";
import BidSigningPage from './BidSigningPage';
import PaymentPortal from "./PaymentPortal";
import BidEditor from "./BidEditor";

// REFRESH SYSTEM IMPORTS
import UpdateNotification from "./UpdateNotification";
import RefreshButton from "./RefreshButton";
import VersionDisplay from "./VersionDisplay";

// TIME CLOCK IMPORTS
import TimeClock from "./TimeClock";
import MyHours from "./MyHours";
import ApproveTime from "./ApproveTime";
import UserProfile from "./UserProfile"; // User profile and password change
import InviteSignup from "./InviteSignup"; // Employee invite signup page


// --------------------- BIDS LIST WITH SORTING ---------------------
function BidsList() {  
  const [bids, setBids] = useState([]);
  const [sortedBids, setSortedBids] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [contracts, setContracts] = useState([]);
  const navigate = useNavigate();

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
      
      // Also fetch contracts to check if bids have been converted
      const contractsSnapshot = await getDocs(collection(db, "contracts"));
      const contractsData = contractsSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setContracts(contractsData);
    };
    fetchBids();
  }, []);
  useEffect(() => {
    markAsViewed('bids');
  }, []);


  // Sort bids whenever bids or sortOrder changes
  useEffect(() => {
    const sorted = [...bids].sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
        case "oldest":
          return new Date(a.createdAt || a.date || 0) - new Date(b.createdAt || b.date || 0);
        case "name-asc":
          return (a.customerName || "").localeCompare(b.customerName || "");
        case "name-desc":
          return (b.customerName || "").localeCompare(a.customerName || "");
        case "amount-high":
          return parseFloat(b.amount || 0) - parseFloat(a.amount || 0);
        case "amount-low":
          return parseFloat(a.amount || 0) - parseFloat(b.amount || 0);
        default:
          return 0;
      }
    });
    setSortedBids(sorted);
  }, [bids, sortOrder]);

  // Check if a bid has an associated contract
  const hasContract = (bidId) => {
    return contracts.some(contract => contract.bidId === bidId);
  };

  // Get bid status for display
  const getBidStatus = (bid) => {
    // Check if bid has been converted to contract
    if (hasContract(bid.id)) {
      return { label: "Accepted", color: "success" };
    }
    
    // Check if both signatures exist
    if (bid.clientSignature && bid.contractorSignature) {
      return { label: "Signed", color: "info" };
    }
    
    // Check if sent for signing
    if (bid.signingToken) {
      return { label: "Sent", color: "warning" };
    }
    
    // Default status
    return { label: "Pending", color: "default" };
  };

  const handleDelete = async (bid) => {
    const confirm = await Swal.fire({
      title: `Delete bid for ${bid.customerName}?`,
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (confirm.isConfirmed) {
      await deleteDoc(doc(db, "bids", bid.id));
      setBids(bids.filter((b) => b.id !== bid.id));
      Swal.fire("Deleted!", "Bid has been removed.", "success");
    }
  };

  const handleCancelBid = async (bid) => {
    const result = await Swal.fire({
      title: "Cancel Bid?",
      html: buildCancelConfirmationMessage(bid.customerName, "bid"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Cancel Bid",
      confirmButtonColor: "#f44336",
      cancelButtonText: "No, Keep It",
    });

    if (result.isConfirmed) {
      try {
        const cancelResult = await cascadeCancelJob("bids", bid.id);
        
        const summaryHtml = buildCancelSummary(cancelResult);
        
        await Swal.fire({
          icon: cancelResult.success ? "success" : "warning",
          title: cancelResult.success ? "Bid Cancelled" : "Partial Cancellation",
          html: summaryHtml,
          confirmButtonText: "OK",
        });
        
        // Reload bids
        const querySnapshot = await getDocs(collection(db, "bids"));
        const bidsData = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setBids(bidsData);
      } catch (error) {
        console.error("Error cancelling bid:", error);
        Swal.fire("Error", "Failed to cancel bid. Check console for details.", "error");
      }
    }
  };

  const handleEdit = (bid) => {
    navigate(`/bid/${bid.id}`);
  };

  const handleCreateContract = async (bid) => {
    try {
      const result = await createFullJobPackage(bid);
      
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
      
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
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
      {/* Header with Sort Dropdown */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Bids List ({sortedBids.length})
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => exportBidsToExcel(sortedBids)}
          >
            Export Excel
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionIcon />}
            onClick={() => exportAllBidsToWord(sortedBids)}
          >
            Export All (Word Zip)
          </Button>
        </Box>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="sort-label">
            <SortIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
            Sort By
          </InputLabel>
          <Select
            labelId="sort-label"
            value={sortOrder}
            label="Sort By"
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <MenuItem value="newest">Newest First</MenuItem>
            <MenuItem value="oldest">Oldest First</MenuItem>
            <MenuItem value="name-asc">Name (A-Z)</MenuItem>
            <MenuItem value="name-desc">Name (Z-A)</MenuItem>
            <MenuItem value="amount-high">Highest Amount</MenuItem>
            <MenuItem value="amount-low">Lowest Amount</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {/* MOBILE VIEW - Card Layout */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {sortedBids.map((bid) => (
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
            <Chip 
              label={getBidStatus(bid).label} 
              color={getBidStatus(bid).color} 
              size="small" 
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Amount: ${bid.amount}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>{bid.description}</Typography>
            {bid.materials && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Materials: {bid.materials}
              </Typography>
            )}
            {bid.createdAt && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Created: {new Date(bid.createdAt).toLocaleDateString()}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                color="info"
                size="small"
                onClick={() => handleEdit(bid)}
                fullWidth
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={() => handleGeneratePDF(bid)}
                fullWidth
              >
                View PDF
              </Button>
              {!hasContract(bid.id) && (
                <Button
                  variant="outlined"
                  color="success"
                  size="small"
                  onClick={() => handleCreateContract(bid)}
                  fullWidth
                >
                  Create Contract
                </Button>
              )}
              <Button
                variant="outlined"
                color="warning"
                size="small"
                onClick={() => handleCancelBid(bid)}
                fullWidth
                startIcon={<CancelIcon />}
              >
                Cancel
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DescriptionIcon />}
                onClick={() => exportBidToWord(bid)}
                fullWidth
              >
                Word Doc
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
        
        {sortedBids.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No Bids Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first bid to get started
            </Typography>
            <Button variant="contained" onClick={() => navigate('/create-bid')}>
              Create Bid
            </Button>
          </Box>
        )}
      </Box>

      {/* DESKTOP VIEW - Table Layout */}
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
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }}>Amount ($)</th>
              <th style={{ padding: 10 }}>Description</th>
              <th style={{ padding: 10 }}>Materials</th>
              <th style={{ padding: 10 }}>Date</th>
              <th style={{ padding: 10 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedBids.map((bid) => (
              <tr key={bid.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: 10 }}>{bid.customerName}</td>
                <td style={{ padding: 10 }}>
                  <Chip 
                    label={getBidStatus(bid).label} 
                    color={getBidStatus(bid).color} 
                    size="small" 
                  />
                </td>
                <td style={{ padding: 10 }}>${bid.amount}</td>
                <td style={{ padding: 10 }}>{bid.description}</td>
                <td style={{ padding: 10 }}>{bid.materials}</td>
                <td style={{ padding: 10 }}>
                  {bid.createdAt ? new Date(bid.createdAt).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: 10 }}>
                  <Button
                    variant="outlined"
                    color="info"
                    size="small"
                    onClick={() => handleEdit(bid)}
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
                  {!hasContract(bid.id) && (
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      onClick={() => handleCreateContract(bid)}
                      sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                    >
                      Create Contract
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    onClick={() => handleCancelBid(bid)}
                    startIcon={<CancelIcon />}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DescriptionIcon />}
                    onClick={() => exportBidToWord(bid)}
                    sx={{ mr: 1, mb: { xs: 1, lg: 0 } }}
                  >
                    Word
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
            
            {sortedBids.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: 40, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary">
                    No Bids Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Create your first bid to get started
                  </Typography>
                  <Button variant="contained" onClick={() => navigate('/create-bid')}>
                    Create Bid
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Box>
    </Container>
  );
}

// ------------------------- HOME REDIRECT COMPONENT -------------------------
function HomeRedirect() {
  const { userRole } = useAuth();

  // Still loading role
  if (!userRole) return null;

  // Crew members get instantly redirected to time clock
  if (userRole === 'crew' || userRole === 'user') {
    return <Navigate to="/time-clock" replace />;
  }

  return <EnhancedDashboard />;
}

// ------------------------- ADMIN ROUTE PROTECTION -------------------------
/**
 * AdminRoute - Route protection component for admin-only pages
 * 
 * This component restricts access to routes that should only be accessible
 * by users with 'admin' or 'god' roles. Users with 'user' or 'crew' roles
 * are automatically redirected to /time-clock.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The protected route component to render
 * @returns {React.ReactNode|null} The protected component or null during redirect
 */
function AdminRoute({ children }) {
  const { userRole } = useAuth();

  // Still loading role
  if (!userRole) return null;

  // Non-admin gets instantly redirected
  if (userRole !== 'admin' && userRole !== 'god') {
    return <Navigate to="/time-clock" replace />;
  }

  return children;
}
  
  

// ------------------------- APP CHROME -------------------------
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Get auth context

  // Get auth context
  const { userRole, logout, user } = useAuth();
  
  // NEW: User data state for first-login detection
  const [userData, setUserData] = useState(null);

  // Load notification counts
  const { counts, loading: countsLoading } = useNotificationCounts();
 
  useEffect(() => {
    window.dispatchEvent(new Event('refreshBadges'));
  }, [location.pathname]);

  // NEW: Listen to user data changes for first-login detection
  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }

    // Subscribe to user document changes
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      },
      (error) => {
        console.error('Error listening to user data:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // NEW: First-login NDA redirect logic
  useEffect(() => {
    if (!user || !userData) return;
    
    const currentPath = location.pathname;
    
    // Don't redirect if already on NDA page or public pages
    if (currentPath === '/nda-signing' || currentPath.startsWith('/public/')) {
      return;
    }

    // Check if employee needs to sign NDA
    if (userData.firstLogin === true && userData.ndaSigned === false) {
      console.log('First login detected, redirecting to NDA signing...');
      navigate('/nda-signing');
    }
  }, [user, userData, location.pathname, navigate]);
  const isActive = (p) => location.pathname === p;
  
  const isPublicPage = location.pathname.startsWith('/public/');

  // ROLE-SPECIFIC MENU ITEMS
  let menuItems = [];

  if (userRole === 'admin' || userRole === 'god') {
    // ADMIN and GOD see full menu
    menuItems = [
      { label: "Dashboard", path: "/", notificationKey: null },
      { label: "Bids", path: "/bids", notificationKey: "bids" },
      { label: "Create Bid", path: "/create-bid", notificationKey: null },
      { label: "Contracts", path: "/contracts", notificationKey: "contracts" },
      { label: "Invoices", path: "/invoices", notificationKey: "invoices" },
      { label: "Jobs", path: "/jobs", notificationKey: "jobs" },
      { label: "Notes", path: "/notes", notificationKey: "notes" },
      { label: "Customers", path: "/customers", notificationKey: "customers" },      
      { label: "Calendar", path: "/calendar", notificationKey: null }, // ✅ FIXED: Changed to /calendar
      // 🔒 CRITICAL: Maintenance menu item - DO NOT REMOVE
      { label: "Maintenance", path: "/maintenance", notificationKey: null },
      { label: "Payments", path: "/payments-dashboard", notificationKey: "payments" },
      { label: "Expenses", path: "/expenses-manager", notificationKey: "expenses" },
      { label: "Payroll", path: "/crew-payroll", notificationKey: null },
      { label: "Approve Time", path: "/approve-time", notificationKey: null },
      { label: "Tax Report", path: "/tax-report", notificationKey: null },
      { label: "Equipment", path: "/equipment-manager", notificationKey: null },
	  { label: "Employees", path: "/employees", notificationKey: null },
      { label: "SMS Notifications", path: "/notification-settings", notificationKey: null },
      { label: "My Profile", path: "/profile", notificationKey: null },
    ];
  } else {
    // CREW, USER, or any other role gets limited menu
    menuItems = [
      { label: "Time Clock", path: "/time-clock", notificationKey: null },
      { label: "My Profile", path: "/profile", notificationKey: null },
      { label: "My Hours", path: "/my-hours", notificationKey: null },
    ];
  }

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleMenuClick = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to logout?');
    if (confirmed) {
      await logout();
    }
  };

  // Role badge emoji
  const getRoleBadge = () => {
    if (userRole === 'god') return '⚡';
    if (userRole === 'admin') return '🔧';
    if (userRole === 'crew') return '👷';
    return '';
  };

  return (
    <>
      {/* Auto-update notification */}
      <UpdateNotification />
      
      {!isPublicPage && (
        <>
          <AppBar position="static" sx={{ backgroundColor: "#1565c0" }}>
            <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
              <Typography variant="h6" sx={{ flexGrow: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                KCL Manager {getRoleBadge()}
              </Typography>

              {isMobile ? (
                <>
                  <RefreshButton isMobile={true} />
                  <IconButton
                    color="inherit"
                    onClick={handleLogout}
                    title={`Logout (${user?.email})`}
                    sx={{ mr: 1 }}
                  >
                    <LogoutIcon />
                  </IconButton>
                  <IconButton
                    color="inherit"
                    edge="end"
                    onClick={handleDrawerToggle}
                  >
                    <MenuIcon />
                  </IconButton>
                </>
              ) : (
                <>
                  <ButtonGroup variant="text" sx={{ mr: 2 }}>
                    {menuItems.map((item) => {
                      const count = item.notificationKey ? counts[item.notificationKey] : 0;
                      const showBadge = count > 0 && !countsLoading;

                      return (
                        <Button
                          key={item.path}
                          component={Link}
                          to={item.path}
                          sx={{
                            color: isActive(item.path) ? "#fff" : "rgba(255,255,255,0.7)",
                            backgroundColor: isActive(item.path)
                              ? "rgba(255,255,255,0.1)"
                              : "transparent",
                            fontWeight: isActive(item.path) ? 700 : 500,
                            fontSize: { sm: '0.75rem', md: '0.875rem' },
                            px: { sm: 1, md: 1.5 },
                            "&:hover": {
                              backgroundColor: "rgba(255,255,255,0.15)",
                              color: "#fff",
                            },
                          }}
                        >
                          <Badge 
                            badgeContent={showBadge ? count : 0} 
                            color="error"
                            sx={{
                              '& .MuiBadge-badge': {
                                fontSize: '0.7rem',
                                minWidth: '18px',
                                height: '18px',
                                padding: '0 4px',
                              }
                            }}
                          >
                            {item.label}
                          </Badge>
                        </Button>
                      );
                    })}
                  </ButtonGroup>

                  <RefreshButton isMobile={false} />
                  <Button
                    color="inherit"
                    onClick={handleLogout}
                    startIcon={<LogoutIcon />}
                    title={user?.email || 'Logout'}
                  >
                    Logout
                  </Button>
                </>
              )}
            </Toolbar>
          </AppBar>

          <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={handleDrawerToggle}
            sx={{
              '& .MuiDrawer-paper': {
                width: 280,
              },
            }}
          >
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="h6">Menu</Typography>
              <IconButton onClick={handleDrawerToggle}>
                <CloseIcon />
              </IconButton>
            </Box>
            <List>
              {menuItems.map((item) => {
                const count = item.notificationKey ? counts[item.notificationKey] : 0;
                const showBadge = count > 0 && !countsLoading;

                return (
                  <ListItem
                    button
                    key={item.path}
                    onClick={() => handleMenuClick(item.path)}
                    sx={{
                      backgroundColor: isActive(item.path) ? "#e3f2fd" : "transparent",
                    }}
                  >
                    <Badge 
                      badgeContent={showBadge ? count : 0} 
                      color="error"
                      sx={{ width: '100%' }}
                    >
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontWeight: isActive(item.path) ? 700 : 500,
                        }}
                      />
                    </Badge>
                  </ListItem>
                );
              })}
            </List>
          </Drawer>
        </>
      )}

      <Routes>
        {/* ACCESSIBLE TO ALL AUTHENTICATED USERS */}
        <Route path="/time-clock" element={<TimeClock />} />
        <Route path="/my-hours" element={<MyHours />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route 
          path="/nda-signing" 
          element={
            <NDASigning 
              currentUser={user} 
              onNDAComplete={() => {
                // Refresh user data after NDA signing
                if (user) {
                  getDoc(doc(db, 'users', user.uid)).then((docSnap) => {
                    if (docSnap.exists()) {
                      setUserData(docSnap.data());
                    }
                  });
                }
                navigate('/');
              }}
            />
          } 
        />
        
        {/* PUBLIC ROUTES (NOT AUTHENTICATED) */}
        <Route path="/public/nda/:crewId" element={<NDASigningPage />} />
        <Route path="/public/sign/:contractId" element={<ContractSigningPage />} />
        <Route path="/public/sign-bid/:bidId" element={<BidSigningPage />} />
        <Route path="/public/pay/:invoiceId" element={<PaymentPortal />} />
		<Route path="/public/invite/:token" element={<InviteSignup />} />
        
        {/* HOME ROUTE - REDIRECTS CREW/USER TO TIME CLOCK */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<HomeRedirect />} />
        
        {/* ADMIN/GOD ONLY ROUTES */}
        <Route path="/approve-time" element={<AdminRoute><ApproveTime /></AdminRoute>} />
        <Route path="/bids" element={<AdminRoute><BidsList /></AdminRoute>} />
        <Route path="/bid/:id" element={<AdminRoute><BidEditor /></AdminRoute>} />
        <Route path="/create-bid" element={<AdminRoute><CreateBid /></AdminRoute>} />
        <Route path="/contracts" element={<AdminRoute><ContractsDashboard /></AdminRoute>} />
        <Route path="/contract/:id" element={<AdminRoute><ContractEditor /></AdminRoute>} />
        <Route path="/invoices" element={<AdminRoute><InvoicesDashboard /></AdminRoute>} />
        <Route path="/invoice/:id" element={<AdminRoute><InvoiceEditor /></AdminRoute>} />		
        <Route path="/jobs" element={<AdminRoute><JobsManager /></AdminRoute>} />
        <Route path="/notes" element={<AdminRoute><NotesManager /></AdminRoute>} />
        <Route path="/customers" element={<AdminRoute><CustomersDashboard /></AdminRoute>} />
		<Route path="/migration" element={<AdminRoute><MigrationDashboard /></AdminRoute>} />
        <Route path="/customer-edit/:id" element={<AdminRoute><CustomerEditor /></AdminRoute>} />
        <Route path="/customer/:id" element={<AdminRoute><CustomerProfile /></AdminRoute>} />
        <Route path="/migrate-tokens" element={<AdminRoute><MigrationPage /></AdminRoute>} />
        <Route path="/schedule-dashboard" element={<AdminRoute><ScheduleDashboard /></AdminRoute>} />
        <Route path="/calendar" element={<AdminRoute><CalendarView /></AdminRoute>} />
        <Route path="/calendar-view" element={<AdminRoute><CalendarView /></AdminRoute>} />
        <Route path="/maintenance" element={<AdminRoute><MaintenanceDashboard /></AdminRoute>} />
        <Route path="/maintenance/:id" element={<AdminRoute><MaintenanceEditor /></AdminRoute>} />
        <Route path="/notification-settings" element={<AdminRoute><NotificationSettings /></AdminRoute>} />
        <Route path="/payment-tracker/:id" element={<AdminRoute><PaymentTracker /></AdminRoute>} />
        <Route path="/payments-dashboard" element={<AdminRoute><PaymentsDashboard /></AdminRoute>} />
        <Route path="/crew-manager" element={<AdminRoute><CrewManager /></AdminRoute>} />
        <Route path="/equipment-manager" element={<AdminRoute><EquipmentManager /></AdminRoute>} />
		<Route path="/employees" element={<AdminRoute><EmployeeAccountManager currentUser={user} currentUserRole={userRole} /></AdminRoute>} />
        <Route path="/nda/:crewId" element={<AdminRoute><NDAEditor /></AdminRoute>} />
        <Route path="/expenses-manager" element={<AdminRoute><ExpensesManager /></AdminRoute>} />
        <Route path="/crew-payroll" element={<AdminRoute><IntegratedPayroll /></AdminRoute>} />
        <Route path="/crew-payment-history" element={<AdminRoute><CrewPaymentHistory /></AdminRoute>} />
        <Route path="/tax-report" element={<AdminRoute><TaxReport /></AdminRoute>} />
        <Route path="/job-expenses/:id" element={<AdminRoute><JobExpenses /></AdminRoute>} />
      </Routes>
    </>
  );
}

// ------------------------- ROUTER WRAPPER -------------------------
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
      
      {/* Version display in bottom-right corner */}
      <VersionDisplay />
    </AuthProvider>
  );
}
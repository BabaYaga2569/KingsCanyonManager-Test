import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
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
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import AddBoxIcon from "@mui/icons-material/AddBox";
import DescriptionIcon from "@mui/icons-material/Description";
import ReceiptIcon from "@mui/icons-material/Receipt";
import WorkIcon from "@mui/icons-material/Work";
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
import ContractEditor from "./ContractEditor";
import Dashboard from "./Dashboard";
import InvoicesDashboard from "./InvoicesDashboard";
import InvoiceEditor from "./InvoiceEditor";
import JobsManager from "./JobsManager";  
import { createFullJobPackage } from "./createFullJobPackage";

// --------------------- BIDS LIST ---------------------
function BidsList() {
  const [bids, setBids] = useState([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
      const { contractId, invoiceId, jobId } = await createFullJobPackage(bid);

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

  // Mobile Card View
  if (isMobile) {
    return (
      <Container sx={{ mt: 3, pb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Bids List
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {bids.map((bid) => (
            <Box
              key={bid.id}
              sx={{
                p: 2,
                border: '1px solid #ddd',
                borderRadius: 2,
                backgroundColor: 'white',
              }}
            >
              <Typography variant="subtitle1" fontWeight="bold">
                {bid.customerName}
              </Typography>
              <Typography variant="h6" color="primary" sx={{ my: 1 }}>
                ${bid.amount}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Description:</strong> {bid.description}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Materials:</strong> {bid.materials}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  onClick={() => handleCreateContract(bid)}
                >
                  Create Contract
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  onClick={() => handleDelete(bid)}
                >
                  Delete
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    );
  }

  // Desktop Table View
  return (
    <Container sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Bids List
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <table
          style={{
            width: "100%",
            minWidth: "600px",
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
                    color="success"
                    size="small"
                    onClick={() => handleCreateContract(bid)}
                    sx={{ mr: 1, mb: { xs: 1, sm: 0 } }}
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

// ------------------------- MOBILE NAV DRAWER -------------------------
function MobileDrawer({ open, onClose, currentPath }) {
  const navigate = useNavigate();
  
  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/" },
    { text: "Bids", icon: <RequestQuoteIcon />, path: "/bids" },
    { text: "Create Bid", icon: <AddBoxIcon />, path: "/create-bid" },
    { text: "Contracts", icon: <DescriptionIcon />, path: "/contracts" },
    { text: "Invoices", icon: <ReceiptIcon />, path: "/invoices" },
    { text: "Jobs", icon: <WorkIcon />, path: "/jobs" },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 250 }} role="presentation">
        <Box sx={{ p: 2, backgroundColor: "#1565c0", color: "white" }}>
          <Typography variant="h6" fontWeight="bold">
            KCL Manager
          </Typography>
        </Box>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={currentPath === item.path}
                onClick={() => handleNavigation(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

// ------------------------- APP CHROME -------------------------
function AppContent() {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (p) => location.pathname === p;

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: "#1565c0" }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            KCL Manager
          </Typography>

          {!isMobile && (
            <ButtonGroup variant="text" sx={{ "& .MuiButton-root": { textTransform: "none" } }}>
              <Button component={Link} to="/"
                sx={{ color: isActive("/") ? "#FFD700" : "#fff", fontWeight: isActive("/") ? 700 : 500 }}>
                Dashboard
              </Button>
              <Button component={Link} to="/bids"
                sx={{ color: isActive("/bids") ? "#FFD700" : "#fff", fontWeight: isActive("/bids") ? 700 : 500 }}>
                Bids
              </Button>
              <Button component={Link} to="/create-bid"
                sx={{ color: isActive("/create-bid") ? "#FFD700" : "#fff", fontWeight: isActive("/create-bid") ? 700 : 500 }}>
                Create Bid
              </Button>
              <Button component={Link} to="/contracts"
                sx={{ color: isActive("/contracts") ? "#FFD700" : "#fff", fontWeight: isActive("/contracts") ? 700 : 500 }}>
                Contracts
              </Button>
              <Button component={Link} to="/invoices"
                sx={{ color: isActive("/invoices") ? "#FFD700" : "#fff", fontWeight: isActive("/invoices") ? 700 : 500 }}>
                Invoices
              </Button>
              <Button component={Link} to="/jobs"
                sx={{ color: isActive("/jobs") ? "#FFD700" : "#fff", fontWeight: isActive("/jobs") ? 700 : 500 }}>
                Jobs
              </Button>
            </ButtonGroup>
          )}
        </Toolbar>
      </AppBar>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentPath={location.pathname}
      />

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bids" element={<BidsList />} />
        <Route path="/create-bid" element={<CreateBid />} />
        <Route path="/contracts" element={<ContractsDashboard />} />
        <Route path="/contract/:id" element={<ContractEditor />} />
        <Route path="/invoices" element={<InvoicesDashboard />} />
        <Route path="/invoice/:id" element={<InvoiceEditor />} />
        <Route path="/jobs" element={<JobsManager />} />
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

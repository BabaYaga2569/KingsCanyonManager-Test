import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getTokenFromUrl } from "./utils/tokenUtils";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Chip,
} from "@mui/material";
import SignatureCanvas from "react-signature-canvas";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LandscapeIcon from "@mui/icons-material/Landscape";
import Swal from "sweetalert2";

const publicTheme = createTheme({
  palette: {
    primary: {
      main: "#1565c0",
    },
    success: {
      main: "#2e7d32",
    },
  },
});

const COMPANY = {
  name: "Kings Canyon Landscaping LLC",
  owner: "Darren Bennett",
  title: "Owner",
  phone: "(928) 450-5733",
  email: "kingscanyon775@gmail.com",
  logoPath: "/logo-kcl.png",
};

function BidSigningPageContent() {
  const { bidId } = useParams();

  const [loading, setLoading] = useState(true);
  const [bid, setBid] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    href: "",
    bidId: "",
    token: "",
    loadedFromCallable: false,
    errorMessage: "",
    userAgent: "",
  });

  const sigPadRef = useRef(null);
  const signingRef = useRef(false);

  const isBidAlreadySigned = useCallback((data) => {
    if (!data) return false;
    return Boolean(
      data.clientSignedAt ||
      data.clientSignature ||
      data.status === "Accepted" ||
      data.status === "Fully Signed"
    );
  }, []);

  const loadBid = useCallback(async () => {
    const href = window.location.href;
    const token = getTokenFromUrl();

    setDebugInfo((prev) => ({
      ...prev,
      href,
      bidId: bidId || "",
      token: token || "",
      userAgent: navigator.userAgent || "",
      loadedFromCallable: false,
      errorMessage: "",
    }));

    try {
      const functions = getFunctions();
      const getPublicBid = httpsCallable(functions, "getPublicBid");

      const result = await getPublicBid({
        bidId,
        signingToken: token,
      });

      const response = result?.data || {};
      const publicBid = response?.bid || null;

      if (!publicBid) {
        throw new Error("Public bid payload was empty");
      }

      setBid(publicBid);
      setAlreadySigned(isBidAlreadySigned(publicBid));

      setDebugInfo((prev) => ({
        ...prev,
        loadedFromCallable: true,
        errorMessage: "",
      }));

      setLoading(false);
    } catch (error) {
      console.error("Error loading bid:", error);

      const message =
        error?.message ||
        error?.details ||
        "Failed to load bid. Please try again.";

      setDebugInfo((prev) => ({
        ...prev,
        loadedFromCallable: false,
        errorMessage: message,
      }));

      setBid(null);
      setAlreadySigned(false);
      setLoading(false);

      Swal.fire("Error", "Failed to load bid. Please try again.", "error");
    }
  }, [bidId, isBidAlreadySigned]);

  useEffect(() => {
    loadBid();
  }, [loadBid]);

  const handleClearSignature = () => {
    sigPadRef.current?.clear();
  };

  const handleSign = async () => {
    if (signingRef.current || signing) return;

    if (!agreed) {
      Swal.fire(
        "Agreement Required",
        "Please check the box to accept this bid.",
        "warning"
      );
      return;
    }

    if (sigPadRef.current?.isEmpty()) {
      Swal.fire("Signature Required", "Please sign in the box above.", "warning");
      return;
    }

    signingRef.current = true;
    setSigning(true);

    try {
      const signatureData = sigPadRef.current.toDataURL();
      const functions = getFunctions();
      const signPublicBid = httpsCallable(functions, "signPublicBid");

      const result = await signPublicBid({
        bidId,
        signatureData,
        signingToken: getTokenFromUrl(),
      });

      const response = result?.data || {};
      console.log("signPublicBid response:", response);

      await loadBid();

      if (response.alreadySigned) {
        await Swal.fire({
          icon: "info",
          title: "Bid Already Accepted",
          html: `
            <p>This bid has already been accepted.</p>
            <p>
              Accepted on
              <strong>
                ${
                  response.signedAt
                    ? new Date(response.signedAt).toLocaleString()
                    : " a previous date"
                }
              </strong>
            </p>
          `,
          confirmButtonText: "OK",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Bid Accepted!",
        html: `
          <p>Thank you for accepting our bid!</p>
          <p><strong>Next Steps:</strong></p>
          <ul style="text-align: left;">
            <li>We'll contact you to schedule the work</li>
            <li>A deposit of 50% will be required to begin</li>
            <li>Estimated amount: <strong>$${(bid?.amount || 0).toFixed(2)}</strong></li>
          </ul>
          <p>Questions? Call us at ${COMPANY.phone}</p>
        `,
        confirmButtonText: "Close",
      });
    } catch (error) {
      console.error("Error signing bid:", error);

      const message =
        error?.message ||
        error?.details ||
        "Failed to accept bid. Please try again.";

      try {
        await loadBid();

        if (bid && isBidAlreadySigned(bid)) {
          await Swal.fire({
            icon: "success",
            title: "Bid Accepted!",
            html: `
              <p>This bid has already been accepted.</p>
              <p>We'll contact you to schedule the work.</p>
            `,
            confirmButtonText: "OK",
          });
          return;
        }
      } catch (reloadError) {
        console.error("Error reloading bid after sign error:", reloadError);
      }

      Swal.fire("Error", message, "error");
    } finally {
      signingRef.current = false;
      setSigning(false);
    }
  };

  const renderDebugPanel = () => (
    <Paper
      sx={{
        p: 2,
        mt: 3,
        backgroundColor: "#fff8e1",
        border: "1px solid #ffcc80",
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Debug Info
      </Typography>
      <Typography variant="caption" display="block">
        <strong>URL:</strong> {debugInfo.href || "N/A"}
      </Typography>
      <Typography variant="caption" display="block">
        <strong>bidId:</strong> {debugInfo.bidId || "N/A"}
      </Typography>
      <Typography variant="caption" display="block">
        <strong>token:</strong> {debugInfo.token || "N/A"}
      </Typography>
      <Typography variant="caption" display="block">
        <strong>loadedFromCallable:</strong> {String(debugInfo.loadedFromCallable)}
      </Typography>
      <Typography variant="caption" display="block">
        <strong>error:</strong> {debugInfo.errorMessage || "None"}
      </Typography>
      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
        <strong>User Agent:</strong> {debugInfo.userAgent || "N/A"}
      </Typography>
    </Paper>
  );

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading bid...
        </Typography>
        {renderDebugPanel()}
      </Container>
    );
  }

  if (!bid) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Bid Not Found</Typography>
          <Typography>This bid link is invalid or has expired.</Typography>
        </Alert>
        {renderDebugPanel()}
      </Container>
    );
  }

  if (alreadySigned) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: "success.main", mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Bid Already Accepted
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You accepted this bid on{" "}
            {bid.clientSignedAt
              ? new Date(bid.clientSignedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "a previous date"}
          </Typography>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Next Steps:
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            • We'll contact you to schedule the work
            <br />
            • A deposit of 50% will be required to begin
            <br />• Estimated amount: <strong>${(bid.amount || 0).toFixed(2)}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Questions? Call us at {COMPANY.phone}
          </Typography>
        </Paper>
        {renderDebugPanel()}
      </Container>
    );
  }

  const depositAmount = (bid.amount || 0) * 0.5;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: { xs: 2, sm: 4 } }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <img
            src={COMPANY.logoPath}
            alt="Kings Canyon Landscaping"
            style={{ height: 80, marginBottom: 16 }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <Typography variant="h4" gutterBottom>
            Bid Proposal
          </Typography>
          <Typography variant="h5" color="primary">
            {COMPANY.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {COMPANY.phone} • {COMPANY.email}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Bid Details
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Client:</strong> {bid.customerName}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Estimated Amount:</strong> ${(bid.amount || 0).toFixed(2)}
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Required Deposit (50%):</strong> ${depositAmount.toFixed(2)}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Date:</strong> {new Date().toLocaleDateString()}
            </Typography>

            {bid.description && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Scope of Work:</strong>
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", pl: 2 }}>
                  {bid.description}
                </Typography>
              </Box>
            )}

            {bid.materials && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Materials:</strong>
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", pl: 2 }}>
                  {bid.materials}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* AI Visual Rendering Section */}
        {(bid.hasAiConceptRenderingImage || bid.hasAiConceptRendering) && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                <LandscapeIcon sx={{ color: "#7c3aed", fontSize: 28 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: "#7c3aed", fontWeight: 700 }}>
                    🎨 Your Landscape Rendering
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    AI-generated visual concept for your property
                  </Typography>
                </Box>
              </Box>

              {bid.hasAiConceptRenderingImage && bid.aiConceptRenderingImageUrl ? (
                <Paper
                  sx={{
                    p: { xs: 2, sm: 3 },
                    background: "linear-gradient(135deg, #f3e5f5 0%, #e8eaf6 100%)",
                    border: "1px solid #ce93d8",
                    borderRadius: 2,
                  }}
                >
                  {/* Before/After layout if source photo is available */}
                  {bid.aiConceptRenderingSourcePhotoUrl ? (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 0.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}
                        >
                          📷 Current Site
                        </Typography>
                        <Box
                          component="img"
                          src={bid.aiConceptRenderingSourcePhotoUrl}
                          alt="Current site photo"
                          sx={{
                            width: "100%",
                            borderRadius: 2,
                            border: "1px solid #ddd",
                            aspectRatio: "16/9",
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 0.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}
                        >
                          ✨ Concept Rendering
                        </Typography>
                        <Box
                          component="img"
                          src={bid.aiConceptRenderingImageUrl}
                          alt="AI landscape rendering concept"
                          sx={{
                            width: "100%",
                            borderRadius: 2,
                            border: "3px solid #7c3aed",
                            aspectRatio: "16/9",
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 0.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}
                      >
                        ✨ AI Concept Rendering
                      </Typography>
                      <Box
                        component="img"
                        src={bid.aiConceptRenderingImageUrl}
                        alt="AI landscape rendering concept"
                        sx={{
                          width: "100%",
                          borderRadius: 2,
                          border: "3px solid #7c3aed",
                          display: "block",
                          maxHeight: { xs: 220, sm: 380 },
                          objectFit: "cover",
                        }}
                      />
                    </Box>
                  )}

                  {/* Tags */}
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                    {bid.aiConceptRenderingStyle && (
                      <Chip
                        label={bid.aiConceptRenderingStyle}
                        size="small"
                        sx={{ bgcolor: "#7c3aed", color: "white", fontWeight: 600 }}
                      />
                    )}
                    {bid.aiConceptRendering?.projectType && (
                      <Chip
                        label={bid.aiConceptRendering.projectType}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: "#7c3aed", color: "#7c3aed" }}
                      />
                    )}
                    {bid.aiConceptRendering?.dimensions?.width && bid.aiConceptRendering?.dimensions?.length && (
                      <Chip
                        label={`${bid.aiConceptRendering.dimensions.width} × ${bid.aiConceptRendering.dimensions.length} ${bid.aiConceptRendering.dimensions.unit || "ft"}`}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: "#7c3aed", color: "#7c3aed" }}
                      />
                    )}
                  </Box>

                  {/* Concept summary if available */}
                  {bid.aiConceptRendering?.conceptSummary && (
                    <Typography
                      variant="body2"
                      sx={{ mb: 2, fontStyle: "italic", color: "text.primary", lineHeight: 1.7 }}
                    >
                      "{bid.aiConceptRendering.conceptSummary}"
                    </Typography>
                  )}

                  {/* Disclaimer */}
                  <Alert
                    severity="info"
                    icon={<AutoAwesomeIcon fontSize="small" />}
                    sx={{ mt: 1, fontSize: "0.78rem", bgcolor: "rgba(255,255,255,0.6)" }}
                  >
                    <strong>Visual concept only.</strong> This AI-generated rendering is for design inspiration. Final plant selection, sizing, spacing, rock coverage, boulder placement, and overall layout may vary based on site conditions, material availability, and installation requirements.
                  </Alert>
                </Paper>
              ) : (
                /* Text-only fallback — no image was generated */
                bid.hasAiConceptRendering && bid.aiConceptRendering && (
                  <Paper
                    sx={{
                      p: { xs: 2, sm: 3 },
                      background: "linear-gradient(135deg, #f3e5f5 0%, #e8eaf6 100%)",
                      border: "1px solid #ce93d8",
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                      {bid.aiConceptRendering.stylePreset && (
                        <Chip
                          label={bid.aiConceptRendering.stylePreset}
                          size="small"
                          sx={{ bgcolor: "#7c3aed", color: "white", fontWeight: 600 }}
                        />
                      )}
                      {bid.aiConceptRendering.projectType && (
                        <Chip
                          label={bid.aiConceptRendering.projectType}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: "#7c3aed", color: "#7c3aed" }}
                        />
                      )}
                    </Box>
                    {bid.aiConceptRendering.conceptSummary && (
                      <Typography variant="body1" sx={{ mb: 2, fontStyle: "italic", color: "text.primary", lineHeight: 1.7 }}>
                        "{bid.aiConceptRendering.conceptSummary}"
                      </Typography>
                    )}
                    {bid.aiConceptRendering.focalElements && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Featured Elements:</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", pl: 1 }}>
                          {bid.aiConceptRendering.focalElements}
                        </Typography>
                      </Box>
                    )}
                    <Alert
                      severity="info"
                      icon={<AutoAwesomeIcon fontSize="small" />}
                      sx={{ mt: 1, fontSize: "0.78rem", bgcolor: "rgba(255,255,255,0.6)" }}
                    >
                      <strong>Concept visualization only.</strong> Final plant size, spacing, rock coverage, boulder placement, and overall layout may vary based on site conditions, material availability, and installation requirements.
                    </Alert>
                  </Paper>
                )
              )}
            </Box>
          </>
        )}

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Accept This Bid
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            By signing below, you accept this bid and agree to the terms and
            conditions.
          </Alert>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 2,
              border: "2px solid",
              borderColor: "primary.main",
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Sign with your finger or mouse:
            </Typography>
            <Box
              sx={{
                border: "1px solid #ccc",
                borderRadius: 1,
                backgroundColor: "white",
                touchAction: "none",
              }}
            >
              <SignatureCanvas
                ref={sigPadRef}
                canvasProps={{
                  width: 500,
                  height: 200,
                  style: {
                    width: "100%",
                    height: "auto",
                    touchAction: "none",
                  },
                }}
              />
            </Box>
            <Button size="small" onClick={handleClearSignature} sx={{ mt: 1 }}>
              Clear Signature
            </Button>
          </Paper>

          <FormControlLabel
            control={
              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                I accept this bid and agree to the terms and conditions
              </Typography>
            }
          />
        </Box>

        <Box sx={{ textAlign: "center" }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSign}
            disabled={signing || !agreed}
            sx={{
              minWidth: 200,
              py: 1.5,
              fontSize: "1.1rem",
            }}
          >
            {signing ? "Accepting..." : "Accept Bid"}
          </Button>
          <Typography
            variant="caption"
            display="block"
            sx={{ mt: 2, color: "text.secondary" }}
          >
            Your signature will be securely stored and we'll contact you to
            schedule work
          </Typography>
        </Box>
      </Paper>

      {renderDebugPanel()}

      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {COMPANY.name} | {COMPANY.phone} | {COMPANY.email}
        </Typography>
      </Box>
    </Container>
  );
}

export default function BidSigningPage() {
  return (
    <ThemeProvider theme={publicTheme}>
      <CssBaseline />
      <BidSigningPageContent />
    </ThemeProvider>
  );
}
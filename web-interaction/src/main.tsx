import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import App from "./App.tsx";
import Dashboard from "./Dashboard.tsx";
import "./index.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";
// Import các component MUI cần thiết cho thanh điều hướng
import { CssBaseline, AppBar, Toolbar, Typography, Button, Box as MuiBox } from "@mui/material";

// Tạo một theme cơ bản
const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2", // Màu primary mặc định của MUI Blue
    },
    secondary: {
      main: "#dc004e", // Màu secondary
    },
  },
  typography: {
    fontFamily: "Roboto, sans-serif", // Ví dụ đổi font
  },
  spacing: 8, // Khoảng cách mặc định theo px (theme.spacing(1) = 8px)
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        {/* Thanh điều hướng chính */}
        <AppBar
          position="sticky"
          sx={{
            bgcolor: "primary.main",
            boxShadow: 4,
            borderBottom: "2px solid #f0f0f0", // Thêm đường viền dưới
          }}
        >
          <Toolbar
            sx={{
              justifyContent: "space-between",
              px: { xs: 2, sm: 3 },
            }}
          >
            <Typography
              variant="h6"
              component="div"
              sx={{
                flexGrow: 1,
                textAlign: "left",
                fontWeight: "bold",
                letterSpacing: 1,
                fontSize: { xs: "1.1rem", sm: "1.3rem" }, // Tăng kích thước chữ
                color: "white",
                textShadow: "1px 1px 2px rgba(0,0,0,0.3)", // Thêm bóng đổ cho chữ
              }}
            >
              Short Video App Viewer
            </Typography>
            <MuiBox sx={{ display: "flex", gap: { xs: 1, sm: 2 } }}>
              <Button
                color="inherit"
                component={Link}
                to="/"
                sx={{
                  textTransform: "none",
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.2)", // Màu nền khi hover đậm hơn
                    borderRadius: 2,
                  },
                  fontSize: { xs: "0.9rem", sm: "1.1rem" }, // Tăng kích thước chữ
                }}
              >
                Trang Chủ
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/dashboard"
                sx={{
                  textTransform: "none",
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.2)",
                    borderRadius: 2,
                  },
                  fontSize: { xs: "0.9rem", sm: "1.1rem" },
                }}
              >
                Dashboard Thống kê
              </Button>
            </MuiBox>
          </Toolbar>
        </AppBar>

        {/* Nội dung trang */}
        <MuiBox component="main" sx={{ mt: 3, p: { xs: 2, sm: 3 } }}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </MuiBox>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);

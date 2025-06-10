// File: src/Dashboard.tsx

import { useEffect, useState, type ChangeEvent } from "react";
import { Box, Typography, CircularProgress, Alert, Grid, Paper, List, ListItem, ListItemText, Button, TextField, Autocomplete } from "@mui/material";

// Import Bar chart component
import { Bar, Pie } from "react-chartjs-2";
// Import Chart.js components for Bar chart
import {
  Chart as ChartJS,
  CategoryScale, // X-axis for categorical data
  LinearScale, // Y-axis for numerical data
  BarElement, // Bar element itself
  ArcElement, // Needed for Pie chart (still used for Interaction Summary)
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement, // Keep ArcElement for the Interaction Pie Chart
  Tooltip,
  Legend
);

import ErrorBoundary from "./ErrorBoundary";

const BACKEND_API_URL = "http://localhost:3001/api";
const CATEGORY_CACHE_KEY = "videoCategoryCache";

// Interface cho User
interface User {
  userId: string;
  displayName: string;
}

// Interface cho Tóm tắt tương tác
interface InteractionSummary {
  [activity: string]: number;
}

// Interface cho Số lượng video theo Category
interface CategoryCounts {
  [category: string]: number;
}

// Interface cho dữ liệu Cache
interface CategoryCache {
  data: CategoryCounts;
  timestamp: number;
}

function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [interactionSummary, setInteractionSummary] = useState<InteractionSummary | null>(null);
  const [categoryCountsFromAPI, setCategoryCountsFromAPI] = useState<CategoryCounts | null>(null);

  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [loadingInteractionSummary, setLoadingInteractionSummary] = useState<boolean>(false);
  const [loadingCategoryCounts, setLoadingCategoryCounts] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // isCacheStale không còn dùng cho logic tự động, chỉ giữ để báo hiệu có nút làm mới
  // const [isCacheStale, setIsCacheStale] = useState<boolean>(false);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${BACKEND_API_URL}/users`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message}`);
        }
        const data: User[] = await response.json();
        setUsers(data);
        setLoadingUsers(false);
      } catch (error: unknown) {
        console.error("Error fetching users:", error);
        setError(`Không thể tải danh sách người dùng: ${error instanceof Error ? error.message : String(error)}`);
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch interaction summary when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      setLoadingInteractionSummary(true);
      const fetchSummary = async (userId: string) => {
        try {
          const response = await fetch(`${BACKEND_API_URL}/users/${userId}/interaction-summary`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || JSON.stringify(errorData)}`);
          }
          const data: InteractionSummary = await response.json();
          setInteractionSummary(data);
        } catch (error: unknown) {
          console.error("Error fetching interaction summary:", error);
          setError((prevError) =>
            prevError
              ? `${prevError}\nLỗi khi tải tóm tắt tương tác: ${error instanceof Error ? error.message : String(error)}`
              : `Lỗi khi tải tóm tắt tương tác: ${error instanceof Error ? error.message : String(error)}`
          );
          setInteractionSummary(null);
        } finally {
          setLoadingInteractionSummary(false);
        }
      };
      fetchSummary(selectedUser);
    } else {
      setInteractionSummary(null);
    }
  }, [selectedUser]);

  // Fetch category counts with caching logic
  const fetchCategoryData = async () => {
    setLoadingCategoryCounts(true);
    // Không reset lỗi chung ở đây
    try {
      // 1. Thử đọc từ cache
      const cachedDataString = localStorage.getItem(CATEGORY_CACHE_KEY);
      if (cachedDataString) {
        const cachedData: CategoryCache = JSON.parse(cachedDataString);
        console.log("Loading category counts from cache.");
        setCategoryCountsFromAPI(cachedData.data);
        setLoadingCategoryCounts(false);
        // Có thể thêm return ở đây nếu muốn CHỈ load từ cache lần đầu tiên
        // và chỉ fetch API khi nhấn nút làm mới.
        // Nếu muốn tự động làm mới sau 1 khoảng thời gian, thì thêm logic kiểm tra timestamp ở đây
        // và chỉ return nếu cache vẫn còn "tươi".
        // Hiện tại, logic sẽ load từ cache trước rồi fetch API luôn nếu không có return
        // hoặc cache hết hạn (nếu thêm logic hết hạn).
        // Để đơn giản theo yêu cầu "chỉ lấy lần đầu", ta sẽ thêm return ở đây.
        return; // Uncomment dòng này để chỉ load từ cache nếu có và không fetch API tự động
      }

      // 2. Nếu không có cache, fetch từ API
      console.log("Fetching category counts from API...");
      const response = await fetch(`${BACKEND_API_URL}/video-categories`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || JSON.stringify(errorData)}`);
      }
      const data: CategoryCounts = await response.json();

      // 3. Lưu vào cache
      const newCache: CategoryCache = {
        data: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(newCache));
      console.log("Category counts fetched and cached.");
      setCategoryCountsFromAPI(data);
    } catch (error: unknown) {
      console.error("Error fetching or caching category counts:", error);
      setError((prevError) =>
        prevError
          ? `${prevError}\nLỗi khi tải thống kê danh mục video: ${error instanceof Error ? error.message : String(error)}`
          : `Lỗi khi tải thống kê danh mục video: ${error instanceof Error ? error.message : String(error)}`
      );
      setCategoryCountsFromAPI(null);
    } finally {
      setLoadingCategoryCounts(false);
    }
  };

  // Effect để fetch category data khi component mount
  useEffect(() => {
    fetchCategoryData();
  }, []);

  // Hàm xử lý khi nhấn nút làm mới cache
  const handleRefreshCategoryCache = () => {
    localStorage.removeItem(CATEGORY_CACHE_KEY); // Xóa cache
    console.log("Category cache cleared. Fetching new data.");
    fetchCategoryData(); // Fetch lại dữ liệu mới
  };

  const handleUserChange = (_event: ChangeEvent<object>, newValue: User | null) => {
    setSelectedUser(newValue ? newValue.userId : "");
  };

  const selectedUserDisplayName = users.find((u) => u.userId === selectedUser)?.displayName || "Người dùng không xác định";

  // Prepare data for Interaction Summary Pie Chart (unchanged)
  const interactionChartData =
    interactionSummary && Object.keys(interactionSummary).length > 0
      ? {
          labels: Object.keys(interactionSummary),
          datasets: [
            {
              label: "Số lượng",
              data: Object.values(interactionSummary),
              backgroundColor: ["rgba(255, 99, 132, 0.6)", "rgba(54, 162, 235, 0.6)", "rgba(255, 206, 86, 0.6)", "rgba(75, 192, 192, 0.6)", "rgba(153, 102, 255, 0.6)", "rgba(255, 159, 64, 0.6)"],
              borderColor: ["rgba(255, 99, 132, 1)", "rgba(54, 162, 235, 1)", "rgba(255, 206, 86, 1)", "rgba(75, 192, 192, 1)", "rgba(153, 102, 255, 1)", "rgba(255, 159, 64, 1)"],
              borderWidth: 1,
            },
          ],
        }
      : null;

  const interactionChartOptions: ChartOptions<"pie"> = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.raw as number;
            const total = (context.dataset.data as number[]).reduce((sum, current) => sum + current, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) + "%" : "0%";
            return `${label}: ${value} (${percentage})`;
          },
        },
      },
    },
    // Adjust aspect ratio to make the chart taller if needed
    aspectRatio: 1, // 1:1 aspect ratio
    maintainAspectRatio: true,
  };

  // Prepare and SORT data for Category Counts Bar Chart
  const sortedCategoryEntries = categoryCountsFromAPI
    ? Object.entries(categoryCountsFromAPI).sort(([, countA], [, countB]) => countB - countA) // Sort descending by count
    : [];

  const categoryChartData =
    sortedCategoryEntries.length > 0
      ? {
          labels: sortedCategoryEntries.map(([category]) => category), // Extract sorted category names
          datasets: [
            {
              label: "Số lượng video",
              data: sortedCategoryEntries.map(([, count]) => count), // Extract sorted counts
              backgroundColor: sortedCategoryEntries.map(() => "rgba(75, 192, 192, 0.6)"), // Sử dụng màu xanh cố định
              borderColor: sortedCategoryEntries.map(() => "rgba(75, 192, 192, 1)"),
              borderWidth: 1,
            },
          ],
        }
      : null;

  const categoryChartOptions: ChartOptions<"bar"> = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
        text: "Thống kê Video theo Danh mục",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const categoryLabel = context.label || "";
            const count = context.raw as number;
            return `${categoryLabel}: ${count}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Danh mục",
        },
      },
      y: {
        title: {
          display: true,
          text: "Số lượng video",
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto", textAlign: "center" }}>
      <Typography color="primary" variant="h4" component="h1" gutterBottom>
        Video Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-wrap", textAlign: "left" }}>
          {error}
        </Alert>
      )}

      <ErrorBoundary>
        <Grid container spacing={4} sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          {/* Cột 1: Tóm tắt tương tác theo User */}
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-expect-error // Still need to check why Grid item type is an issue */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 2, height: "100%" }}>
              <Typography variant="h5" component="h2" gutterBottom sx={{ borderBottom: "1px solid #eee", pb: 1, mb: 2 }}>
                Tóm tắt tương tác theo Người dùng
              </Typography>

              <Box sx={{ mb: 4, display: "flex", justifyContent: "center" }}>
                <Autocomplete
                  disablePortal
                  id="user-autocomplete"
                  options={users}
                  getOptionLabel={(option) => option.displayName}
                  isOptionEqualToValue={(option, value) => option.userId === value.userId}
                  value={users.find((user) => user.userId === selectedUser) || null}
                  onChange={(event, newValue) => handleUserChange(event, newValue)}
                  loading={loadingUsers}
                  disabled={loadingUsers}
                  sx={{ minWidth: 400 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Chọn người dùng"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Box>

              {/* Hiển thị Biểu đồ Tương tác */}
              {selectedUser ? (
                <>
                  <Typography variant="h6" gutterBottom>
                    Biểu đồ tương tác của {selectedUserDisplayName}
                  </Typography>
                  {loadingInteractionSummary ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : interactionChartData ? (
                    <Box sx={{ width: "100%", maxWidth: 400, mx: "auto" }}>
                      <Pie data={interactionChartData} options={interactionChartOptions} />
                    </Box>
                  ) : (
                    <Typography>Không có dữ liệu tương tác để vẽ biểu đồ cho người dùng này.</Typography>
                  )}
                </>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  Chọn một người dùng để xem biểu đồ tương tác của họ.
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Cột 2: Thống kê Category Video (Bar Chart) */}
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-expect-error // Still need to check why Grid item type is an issue */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 2, height: "100%" }}>
              <Typography variant="h5" component="h2" gutterBottom sx={{ borderBottom: "1px solid #eee", pb: 1, mb: 2 }}>
                Thống kê Video theo Danh mục
              </Typography>

              {loadingCategoryCounts ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : categoryChartData ? (
                <Box sx={{ textAlign: "left" }}>
                  {/* Hiển thị biểu đồ Bar cho Category */}
                  <Box
                    sx={{
                      width: "100%",
                      maxWidth: 600,
                      mx: "auto",
                      mb: 2,
                      height: 300,
                    }}
                  >
                    {" "}
                    {/* Giới hạn kích thước biểu đồ và thêm height */}
                    <Bar data={categoryChartData} options={categoryChartOptions} /> {/* Sử dụng component Bar */}
                  </Box>

                  {/* Nút làm mới cache */}
                  <Box sx={{ textAlign: "center", mb: 2 }}>
                    <Button variant="outlined" onClick={handleRefreshCategoryCache} disabled={loadingCategoryCounts} startIcon={loadingCategoryCounts ? <CircularProgress size={16} /> : null}>
                      {loadingCategoryCounts ? "Đang làm mới..." : "Làm mới Cache Danh mục"}
                    </Button>
                  </Box>

                  {/* Hiển thị danh sách chi tiết (sorted by count descending) */}
                  <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                    Chi tiết:
                  </Typography>
                  <List dense>
                    {/* Sử dụng sortedCategoryEntries trực tiếp để render list */}
                    {sortedCategoryEntries.map(([category, count]) => (
                      <ListItem key={category} disablePadding>
                        <ListItemText primary={`${category}: ${count}`} />
                      </ListItem>
                    ))}
                  </List>

                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Lưu ý: Dữ liệu thống kê danh mục có thể không chính xác hoàn toàn hoặc bị chậm nếu collection video rất lớn do hạn chế của phương pháp truy vấn hiện tại.
                  </Alert>
                </Box>
              ) : (
                <Typography>Không có dữ liệu thống kê danh mục video.</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </ErrorBoundary>
    </Box>
  );
}

export default Dashboard;

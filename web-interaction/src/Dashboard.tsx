// File: src/Dashboard.tsx

import { useEffect, useState, type ChangeEvent } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Button,
  TextField,
  Autocomplete,
  ButtonGroup, // Use ButtonGroup for better button grouping
} from "@mui/material";

// Import Bar chart component
import { Bar, Pie } from "react-chartjs-2";
// Import Chart.js components for Bar chart
import {
  Chart as ChartJS,
  CategoryScale, // X-axis for categorical data
  LinearScale, // Y-axis for numerical data
  BarElement, // Bar element itself
  ArcElement, // Needed for Pie chart
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

import ErrorBoundary from "./ErrorBoundary";

const BACKEND_API_URL = "http://localhost:3001/api";
const CATEGORY_CACHE_KEY = "videoCategoryCache";
// Cache expiration time in milliseconds (e.g., 1 hour)
const CATEGORY_CACHE_EXPIRY = 60 * 60 * 1000;

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

// Define possible states for the displayed section
type DisplayedSection = "none" | "userInteraction" | "categoryCounts";

function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [interactionSummary, setInteractionSummary] = useState<InteractionSummary | null>(null);
  // We now store both cached and potentially fresher API data here
  const [categoryCountsFromAPI, setCategoryCountsFromAPI] = useState<CategoryCounts | null>(null);

  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [loadingInteractionSummary, setLoadingInteractionSummary] = useState<boolean>(false);
  // Use a separate loading state for the *initial* cache/fetch on mount
  // and another for the refresh button click if needed, but let's simplify and use one loading state for category counts fetch
  const [loadingCategoryCounts, setLoadingCategoryCounts] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  // New state to control which section is displayed
  const [displayedSection, setDisplayedSection] = useState<DisplayedSection>("none");

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await fetch(`${BACKEND_API_URL}/users`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || JSON.stringify(errorData)}`);
        }
        const data: User[] = await response.json();
        setUsers(data);
        // Clear previous error if successful
        setError(null);
      } catch (error: unknown) {
        console.error("Error fetching users:", error);
        setError(`Không thể tải danh sách người dùng: ${error instanceof Error ? error.message : String(error)}`);
        setUsers([]); // Clear users on error
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch interaction summary when selectedUser changes AND the interaction section is potentially displayed
  useEffect(() => {
    if (selectedUser && displayedSection === "userInteraction") {
      // Only fetch if a user is selected AND the section is active
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
          // Clear user interaction specific error if successful
          setError((prevError) => (prevError?.includes("Lỗi khi tải tóm tắt tương tác") ? null : prevError));
        } catch (error: unknown) {
          console.error("Error fetching interaction summary:", error);
          setError((prevError) => (prevError ? `${prevError}\nLỗi khi tải tóm tắt tương tác: ${error instanceof Error ? error.message : String(error)}` : `Lỗi khi tải tóm tắt tương tác: ${error instanceof Error ? error.message : String(error)}`));
          setInteractionSummary(null);
        } finally {
          setLoadingInteractionSummary(false);
        }
      };
      fetchSummary(selectedUser);
    } else {
      // Clear summary and user-specific loading when no user is selected or section changes
      setInteractionSummary(null);
      setLoadingInteractionSummary(false);
      // Clear user interaction specific error if the user is deselected
      setError((prevError) => (prevError?.includes("Lỗi khi tải tóm tắt tương tác") ? null : prevError));
    }
  }, [selectedUser, displayedSection]); // Depend on displayedSection as well

  // Function to fetch category data with caching logic
  const fetchCategoryData = async (ignoreCache = false) => {
    setLoadingCategoryCounts(true);
    // Do not clear error state here, fetch logic will update it if needed

    try {
      // 1. Try reading from cache if not ignoring
      if (!ignoreCache) {
        const cachedDataString = localStorage.getItem(CATEGORY_CACHE_KEY);
        if (cachedDataString) {
          const cachedData: CategoryCache = JSON.parse(cachedDataString);
          const now = Date.now();
          // Check if cache is still valid
          if (now - cachedData.timestamp < CATEGORY_CACHE_EXPIRY) {
            console.log("Loading category counts from cache.");
            setCategoryCountsFromAPI(cachedData.data);
            setLoadingCategoryCounts(false);
            // Clear category specific error if successful from cache
            setError((prevError) => (prevError?.includes("Lỗi khi tải thống kê danh mục video") ? null : prevError));
            // Return early if cache is fresh and used
            return;
          } else {
            console.log("Category cache is stale.");
            // Cache is stale, will proceed to fetch from API
          }
        }
      } else {
        console.log("Ignoring cache due to ignoreCache flag.");
      }

      // 2. Fetch from API (either because no cache, cache is stale, or ignoring cache)
      console.log(`Fetching category counts from API... (Ignore cache: ${ignoreCache})`);
      const response = await fetch(`${BACKEND_API_URL}/video-categories`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || JSON.stringify(errorData)}`);
      }
      const data: CategoryCounts = await response.json();

      // 3. Save to cache
      const newCache: CategoryCache = {
        data: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(newCache));
      console.log("Category counts fetched and cached.");
      setCategoryCountsFromAPI(data);
      // Clear category specific error if successful from API
      setError((prevError) => (prevError?.includes("Lỗi khi tải thống kê danh mục video") ? null : prevError));
    } catch (error: unknown) {
      console.error("Error fetching or caching category counts:", error);
      setError((prevError) =>
        prevError ? `${prevError}\nLỗi khi tải thống kê danh mục video: ${error instanceof Error ? error.message : String(error)}` : `Lỗi khi tải thống kê danh mục video: ${error instanceof Error ? error.message : String(error)}`
      );
      // If there was a cached version, keep it visible even if API fetch failed,
      // but only if it's not null. If cache was null and API failed, set to null.
      const cachedDataString = localStorage.getItem(CATEGORY_CACHE_KEY);
      if (!cachedDataString) {
        setCategoryCountsFromAPI(null);
      } else {
        // Keep the stale cache data displayed, but the error message will show
        console.warn("API fetch failed, keeping stale cache data displayed.");
      }
    } finally {
      setLoadingCategoryCounts(false);
    }
  };

  // Effect to fetch category data when component mounts
  useEffect(() => {
    // Fetch category data only once on mount
    fetchCategoryData();
  }, []); // Empty dependency array means this runs only on mount

  // Handler for the refresh cache button
  const handleRefreshCategoryCache = () => {
    localStorage.removeItem(CATEGORY_CACHE_KEY); // Clear cache
    console.log("Category cache cleared by user. Fetching new data.");
    fetchCategoryData(true); // Fetch new data, explicitly ignoring any existing cache for this fetch attempt
  };

  // Handler for user selection in Autocomplete
  const handleUserChange = (_event: ChangeEvent<object>, newValue: User | null) => {
    setSelectedUser(newValue ? newValue.userId : "");
    // When user changes, clear interaction summary until new data is fetched
    setInteractionSummary(null);
    // Also clear any user-specific error messages
    setError((prevError) => (prevError?.includes("Lỗi khi tải tóm tắt tương tác") ? null : prevError));
  };

  // Handler for section selection buttons
  const handleSectionChange = (section: DisplayedSection) => {
    setDisplayedSection(section);
    // Optionally clear data for the *other* section when switching,
    // but keeping it might allow faster display if switching back.
    // Let's keep the data for now, only clearing loading/error states.
    if (section === "userInteraction") {
      setLoadingCategoryCounts(false); // Stop loading indicator for category if switching away
      // Clear category-specific error if switching away
      setError((prevError) => (prevError?.includes("Lỗi khi tải thống kê danh mục video") ? null : prevError));
    } else if (section === "categoryCounts") {
      setLoadingInteractionSummary(false); // Stop loading indicator for user if switching away
      // Clear user interaction specific error if switching away
      setError((prevError) => (prevError?.includes("Lỗi khi tải tóm tắt tương tác") ? null : prevError));
    } else {
      // section is 'none'
      setLoadingCategoryCounts(false);
      setLoadingInteractionSummary(false);
      // Optionally clear all data and errors when going to 'none'
      // setInteractionSummary(null);
      // setCategoryCountsFromAPI(null); // Be careful clearing this if cache is the source
      // setError(null); // Clear all errors when going to 'none'
    }
  };

  // Find the display name for the selected user
  const selectedUserDisplayName = users.find((u) => u.userId === selectedUser)?.displayName || "Người dùng không xác định";

  // Prepare data for Interaction Summary Pie Chart
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

  // Options for Interaction Summary Pie Chart
  const interactionChartOptions: ChartOptions<"pie"> = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: false }, // Title will be handled by Typography
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
    // Make the pie chart a reasonable size, responsive within its container
    maintainAspectRatio: true, // Keep aspect ratio for pie chart
    aspectRatio: 1, // 1:1 aspect ratio
  };

  // Prepare and SORT data for Category Counts Bar Chart (descending by count)
  const sortedCategoryEntries = categoryCountsFromAPI ? Object.entries(categoryCountsFromAPI).sort(([, countA], [, countB]) => countB - countA) : [];

  // Prepare data for Category Counts Bar Chart
  const categoryChartData =
    sortedCategoryEntries.length > 0
      ? {
          labels: sortedCategoryEntries.map(([category]) => category), // Extract sorted category names
          datasets: [
            {
              label: "Số lượng video",
              data: sortedCategoryEntries.map(([, count]) => count), // Extract sorted counts
              backgroundColor: sortedCategoryEntries.map(() => "rgba(75, 192, 192, 0.8)"), // Slightly more opaque color
              borderColor: sortedCategoryEntries.map(() => "rgba(75, 192, 192, 1)"),
              borderWidth: 1,
            },
          ],
        }
      : null;

  // Options for Category Counts Bar Chart
  const categoryChartOptions: ChartOptions<"bar"> = {
    responsive: true,
    // Disable maintaining aspect ratio so we can control height via container
    maintainAspectRatio: false, // <<<<<< IMPORTANT for controlling size with parent height
    plugins: {
      legend: {
        display: false, // Legend is simple (only one dataset)
      },
      title: {
        display: false, // Title handled by Typography
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
        // Adjust tick rotation if many categories
        ticks: {
          autoSkip: true, // Let Chart.js decide which ticks to skip
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        title: {
          display: true,
          text: "Số lượng video",
        },
        beginAtZero: true,
        // Ensure Y-axis displays integer ticks if counts are always integers
        ticks: {
          stepSize: 1,
          // Use callback to ensure only integers are displayed if needed
          callback: function (value) {
            if (Number.isInteger(value)) {
              return value;
            }
          },
        },
      },
    },
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto", textAlign: "center" }}>
      <Typography color="primary" variant="h4" component="h1" gutterBottom>
        Video Dashboard
      </Typography>

      <ErrorBoundary>
        {/* Section Selection Buttons */}
        <Box sx={{ mb: 4, display: "flex", justifyContent: "center" }}>
          <ButtonGroup variant="contained" aria-label="dashboard section selection">
            <Button variant={displayedSection === "userInteraction" ? "contained" : "outlined"} onClick={() => handleSectionChange("userInteraction")} disabled={loadingUsers || (users.length === 0 && !loadingUsers)}>
              Tóm tắt tương tác theo Người dùng
              {loadingUsers ? <CircularProgress size={16} sx={{ ml: 1, color: "currentColor" }} /> : null}
            </Button>

            <Button variant={displayedSection === "categoryCounts" ? "contained" : "outlined"} onClick={() => handleSectionChange("categoryCounts")} disabled={loadingCategoryCounts}>
              Thống kê Video theo Danh mục
              {loadingCategoryCounts ? <CircularProgress size={16} sx={{ ml: 1, color: "currentColor" }} /> : null}
            </Button>
          </ButtonGroup>
        </Box>

        {/* Display Area based on selectedSection */}
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        <Grid container spacing={4} justifyContent="center">
          {/* This single grid item will hold the content of the selected section */}
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-expect-error */}
          <Grid item xs={12}>
            {displayedSection === "none" && (
              <Typography variant="h6" color="text.secondary" sx={{ mt: 4 }}>
                Chọn một mục báo cáo ở trên để xem dữ liệu.
              </Typography>
            )}

            {/* User Interaction Section */}
            {displayedSection === "userInteraction" && (
              <Paper elevation={3} sx={{ p: 2, height: "100%" }}>
                <Typography variant="h5" component="h2" gutterBottom sx={{ borderBottom: "1px solid #eee", pb: 1, mb: 2 }}>
                  Tóm tắt tương tác theo Người dùng
                </Typography>

                {/* User Selection Autocomplete */}
                <Box sx={{ mb: 4, display: "flex", justifyContent: "center" }}>
                  <Autocomplete
                    disablePortal
                    id="user-autocomplete"
                    options={users}
                    getOptionLabel={(option) => option.displayName}
                    isOptionEqualToValue={(option, value) => option.userId === value.userId}
                    value={users.find((user) => user.userId === selectedUser) || null}
                    onChange={handleUserChange}
                    loading={loadingUsers}
                    disabled={loadingUsers || users.length === 0}
                    sx={{ minWidth: 300, width: "100%", maxWidth: 400 }} // Adjust width
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

                {/* Display Interaction Summary */}
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
                      // Box for the Pie Chart - limit size slightly
                      <Box sx={{ width: "100%", maxWidth: 400, mx: "auto", height: 300 }}>
                        <Pie data={interactionChartData} options={interactionChartOptions} />
                      </Box>
                    ) : (
                      <Typography>Không có dữ liệu tương tác để vẽ biểu đồ cho người dùng này.</Typography>
                    )}
                  </>
                ) : (
                  <Typography variant="body1" color="text.secondary">
                    Chọn một người dùng từ danh sách trên để xem biểu đồ tương tác của họ.
                  </Typography>
                )}
              </Paper>
            )}

            {/* Category Video Counts Section */}
            {displayedSection === "categoryCounts" && (
              <Paper elevation={3} sx={{ p: 3, height: "100%" }}>
                <Typography variant="h5" component="h2" gutterBottom sx={{ borderBottom: "1px solid #eee", pb: 1, mb: 2 }}>
                  Thống kê Video theo Danh mục
                </Typography>

                {loadingCategoryCounts && !categoryCountsFromAPI ? ( // Show loader only if initial data is loading and no data is available
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  // Always render the content box, even if categoryCountsFromAPI is null,
                  // so the "No data" message or stale cache is displayed
                  <Box sx={{ textAlign: "left" }}>
                    {/* Nút làm mới cache */}
                    <Box sx={{ textAlign: "center", mb: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={handleRefreshCategoryCache}
                        disabled={loadingCategoryCounts} // Disable button while fetching/re-fetching
                        startIcon={loadingCategoryCounts ? <CircularProgress size={16} color="inherit" /> : null} // Use color="inherit"
                      >
                        {loadingCategoryCounts ? "Đang làm mới..." : "Làm mới Cache Danh mục"}
                      </Button>
                      {/* Display error message below the refresh button if relevant */}
                      {error && error.includes("Lỗi khi tải thống kê danh mục video") && (
                        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                          {error.split("\n").find((line) => line.includes("Lỗi khi tải thống kê danh mục video"))}
                        </Typography>
                      )}
                    </Box>

                    {categoryChartData ? (
                      <>
                        {/* Hiển thị biểu đồ Bar cho Category */}
                        <Box
                          sx={{
                            width: "100%",
                            height: 400,
                            maxWidth: 800,
                            mb: 2,
                          }}
                        >
                          <Bar data={categoryChartData} options={categoryChartOptions} />
                        </Box>

                        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                          Chi tiết:
                        </Typography>
                        <List dense>
                          {" "}
                          {sortedCategoryEntries.map(([category, count]) => (
                            <ListItem key={category} disablePadding>
                              <ListItemText primary={`${category}: ${count}`} />
                            </ListItem>
                          ))}
                        </List>
                      </>
                    ) : (
                      !loadingCategoryCounts && !error?.includes("Lỗi khi tải thống kê danh mục video") && <Typography>Không có dữ liệu thống kê danh mục video.</Typography>
                    )}

                  </Box>
                )}
              </Paper>
            )}
          </Grid>
        </Grid>

        {error && (
          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Typography color="error" variant="body1">
              Một số lỗi đã xảy ra:
              {error.split("\n").map((line, index) => (
                <Box component="span" key={index} sx={{ display: "block" }}>
                  {line}
                </Box>
              ))}
            </Typography>
          </Box>
        )}
      </ErrorBoundary>
    </Box>
  );
}

export default Dashboard;

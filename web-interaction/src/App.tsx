import { useEffect, useState } from "react";
import "./App.css";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  CardMedia,
  Button,
  Stack,
  Autocomplete,
  TextField,
  Chip,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { format } from "date-fns";

import ErrorBoundary from "./ErrorBoundary";

import { db } from "./firebaseConfig";

import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  getDocs,
} from "firebase/firestore";

const BACKEND_API_URL = "http://localhost:3001/api";

const VideoInfoBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.grey[100],
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  flexWrap: "wrap",
}));

type ActiveView = "none" | "interactions" | "recommendations";

type User = {
  userId: string;
  displayName: string;
};

type Interaction = {
  interactionId: string;
  activity: string;
  time: string;
  content: string;
  videoId: string;
  video?: SRSVideoDetails | null;
};

type SRSVideoDetails = {
  id: string;
  title: string;
  category?: string;
  author?: {
    name?: string;
    [key: string]: unknown;
  };
  video?: {
    thumbnailPath?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type RecommendedVideo = {
  video_guid?: string;
  title?: string;
  url?: string;
  source?: string;
  [key: string]: unknown;
};

const fetchVideoDetails = async (
  videoIds: string[]
): Promise<Map<string, SRSVideoDetails>> => {
  const videoDetailsMap = new Map<string, SRSVideoDetails>();
  if (videoIds.length === 0) {
    return videoDetailsMap;
  }

  const batches = [];
  for (let i = 0; i < videoIds.length; i += 10) {
    batches.push(videoIds.slice(i, i + 10));
  }

  try {
    const results = await Promise.all(
      batches.map((batch) =>
        getDocs(
          query(
            collection(db, "shorts-recommend-system"),
            where("id", "in", batch)
          )
        )
      )
    );

    results.forEach((snapshot) => {
      snapshot.forEach((doc) => {
        const videoData = doc.data() as SRSVideoDetails;
        videoDetailsMap.set(videoData.id, videoData);
      });
    });
  } catch (error) {
    console.error("Error fetching video details:", error);
  }

  return videoDetailsMap;
};

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [recommendedVideos, setRecommendedVideos] = useState<
    RecommendedVideo[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [loadingInteractions, setLoadingInteractions] =
    useState<boolean>(false);
  const [loadingRecommendations, setLoadingRecommendations] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("none");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${BACKEND_API_URL}/users`);
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Unknown error" }));
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorData.message}`
          );
        }
        const data: User[] = await response.json();
        setUsers(data);
        setLoadingUsers(false);
      } catch (error: unknown) {
        console.error("Error fetching users:", error);
        setError(
          `Không thể tải danh sách người dùng: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (selectedUser) {
      setActiveView("none");
      setInteractions([]);
      setRecommendedVideos([]);
      setError(null);

      setLoadingInteractions(true);
      try {
        const interactionsCollectionRef = collection(
          db,
          "users",
          selectedUser,
          "interactions"
        );
        const interactionsQuery = query(
          interactionsCollectionRef,
          orderBy("time", "desc"),
          limit(20) // Match backend limit or use a state variable
        );

        unsubscribe = onSnapshot(
          interactionsQuery,
          async (snapshot) => {
            console.log("Firestore interactions snapshot received");
            if (snapshot.empty) {
              setInteractions([]);
              setLoadingInteractions(false);
              console.log("No interactions found for user", selectedUser);
              return; // No interactions, nothing more to do
            }

            const interactionsData = snapshot.docs.map((doc) => ({
              interactionId: doc.id,
              ...(doc.data() as Omit<Interaction, "interactionId" | "video">), // Cast data, omit fields added later
            }));

            // Collect unique video IDs from interactions
            const videoIds = [
              ...new Set(
                interactionsData.map((interaction) => interaction.videoId)
              ),
            ];

            // Fetch video details for these video IDs
            const videoDetailsMap = await fetchVideoDetails(videoIds);

            // Combine interactions with video details
            const interactionsWithVideo = interactionsData.map(
              (interaction) => ({
                ...interaction,
                video: videoDetailsMap.get(interaction.videoId) || null, // Add video details
              })
            );

            setInteractions(interactionsWithVideo);
            setLoadingInteractions(false); // Data loaded, set loading to false
          },
          (firestoreError) => {
            // Error callback for onSnapshot
            console.error(
              `Error listening to interactions for user ${selectedUser}:`,
              firestoreError
            );
            setError((prevError) =>
              prevError
                ? `${prevError}\nLỗi realtime khi tải tương tác: ${firestoreError.message}`
                : `Lỗi realtime khi tải tương tác: ${firestoreError.message}`
            );
            setInteractions([]); // Clear interactions on error
            setLoadingInteractions(false); // Loading finished (with error)
          }
        );
      } catch (error: unknown) {
        // Catch errors during listener setup (e.g., invalid user ID format)
        console.error("Error setting up interaction listener:", error);
        setError((prevError) =>
          prevError
            ? `${prevError}\nLỗi khởi tạo listener tương tác: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            : `Lỗi khởi tạo listener tương tác: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
        );
        setInteractions([]);
        setLoadingInteractions(false);
      }

      const fetchRecommendations = async (userId: string) => {
        setLoadingRecommendations(true);
        try {
          const response = await fetch(
            `${BACKEND_API_URL}/users/${userId}/recommendations?limit=10` // Keep using backend for external API
          );
          if (!response.ok) {
            const errorData = await response
              .json()
              .catch(() => ({ message: "Unknown error" }));
            throw new Error(
              `HTTP error! status: ${response.status}, message: ${
                errorData.message || JSON.stringify(errorData)
              }`
            );
          }
          const data: RecommendedVideo[] = await response.json();
          setRecommendedVideos(data);
        } catch (error: unknown) {
          console.error("Error fetching recommendations:", error);
          setError((prevError) =>
            prevError
              ? `${prevError}\nLỗi khi tải đề xuất: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              : `Lỗi khi tải đề xuất: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
          );
          setRecommendedVideos([]);
        } finally {
          setLoadingRecommendations(false);
        }
      };

      fetchRecommendations(selectedUser);
    } else {
      setActiveView("none");
      setInteractions([]);
      setRecommendedVideos([]);
      setError(null);
    }

    return () => {
      console.log("Cleaning up listener for user:", selectedUser);
      unsubscribe();
    };
  }, [selectedUser]);

  const handleUserChange = (_event: unknown, value: User | null) => {
    setSelectedUser(value ? value.userId : "");
  };

  const selectedUserDisplayName =
    users.find((u) => u.userId === selectedUser)?.displayName ||
    selectedUser ||
    "Người dùng không xác định";

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: "auto", textAlign: "center" }}>
      <Typography color="primary" variant="h4" component="h1" gutterBottom>
        Video Interaction & Recommendation Viewer
      </Typography>

      {/* Autocomplete cho User */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "center" }}>
        <Autocomplete
          disablePortal
          id="user-autocomplete"
          options={users}
          getOptionLabel={(option) => option.displayName}
          isOptionEqualToValue={(option, value) =>
            option.userId === value.userId
          }
          value={users.find((user) => user.userId === selectedUser) || null}
          onChange={handleUserChange}
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
                    {loadingUsers ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, whiteSpace: "pre-wrap", textAlign: "left" }}
        >
          {error}
        </Alert>
      )}

      {selectedUser && (
        <Stack
          direction="row"
          spacing={2}
          justifyContent="center"
          sx={{ mb: 4 }}
        >
          <Button
            variant={activeView === "interactions" ? "contained" : "outlined"}
            onClick={() => setActiveView("interactions")}
            disabled={
              loadingInteractions ||
              (interactions.length === 0 && !loadingInteractions)
            }
          >
            Xem Tương tác (
            {loadingInteractions ? (
              <CircularProgress
                size={16}
                sx={{ ml: 1, color: "currentColor" }}
              />
            ) : (
              interactions.length
            )}
            )
          </Button>
          <Button
            variant={
              activeView === "recommendations" ? "contained" : "outlined"
            }
            onClick={() => setActiveView("recommendations")}
            disabled={
              loadingRecommendations ||
              (recommendedVideos.length === 0 && !loadingRecommendations)
            }
          >
            Xem Đề xuất (
            {loadingRecommendations ? (
              <CircularProgress
                size={16}
                sx={{ ml: 1, color: "currentColor" }}
              />
            ) : (
              recommendedVideos.length
            )}
            )
          </Button>
        </Stack>
      )}

      <ErrorBoundary>
        {selectedUser && (
          <Box sx={{ width: "100%" }}>
            {activeView === "interactions" && (
              <Paper elevation={3} sx={{ p: 2 }}>
                <Typography
                  variant="h5"
                  component="h2"
                  gutterBottom
                  sx={{ borderBottom: "1px solid #eee", pb: 1, mb: 2 }}
                >
                  Tương tác gần đây của {selectedUserDisplayName}
                </Typography>
                {loadingInteractions && interactions.length === 0 ? (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", py: 4 }}
                  >
                    <CircularProgress />
                  </Box>
                ) : interactions.length === 0 ? (
                  <Typography>Không có tương tác nào được tìm thấy.</Typography>
                ) : (
                  <List sx={{ width: "100%" }}>
                    {interactions.map((interaction) => (
                      <ListItem
                        key={interaction.interactionId}
                        divider
                        alignItems="flex-start"
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1">
                              <strong>{interaction.activity}</strong> lúc{" "}
                              <Chip
                                label={format(
                                  new Date(interaction.time),
                                  "dd/MM/yyyy, hh:mm a"
                                )}
                                color="primary"
                                size="small"
                                sx={{ marginLeft: 1 }}
                              />
                            </Typography>
                          }
                          secondary={
                            <Box component="div" sx={{ mt: 1 }}>
                              {interaction.video ? (
                                <VideoInfoBox>
                                  {interaction.video.video?.thumbnailPath && (
                                    <CardMedia
                                      component="img"
                                      sx={{
                                        width: 100,
                                        height: 100,
                                        objectFit: "cover",
                                        borderRadius: 1,
                                        flexShrink: 0,
                                      }}
                                      image={
                                        interaction.video.video.thumbnailPath
                                      }
                                      alt="Video Thumbnail"
                                    />
                                  )}
                                  <Box sx={{ flexGrow: 1, minWidth: "150px" }}>
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      Video: "
                                      {interaction.video.title ||
                                        "Không có tiêu đề"}
                                      "
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      ID:{" "}
                                      {interaction.video.id ||
                                        interaction.videoId}
                                    </Typography>
                                    {interaction.video.category && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                      >
                                        Thể loại: {interaction.video.category}
                                      </Typography>
                                    )}
                                    {interaction.video.author?.name && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                      >
                                        Tác giả: {interaction.video.author.name}
                                      </Typography>
                                    )}
                                  </Box>
                                </VideoInfoBox>
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ mt: 1 }}
                                >
                                  Video ID: {interaction.videoId} (Không tìm
                                  thấy thông tin video trong collection
                                  shorts-recommend-system)
                                </Typography>
                              )}
                              {interaction.activity === "view" ? (
                                <Box sx={{ mt: 1 }}>
                                  {(() => {
                                    try {
                                      const contentObject = JSON.parse(
                                        interaction.content
                                      );
                                      return Object.entries(contentObject).map(
                                        ([key, value]) => (
                                          <List key={key} sx={{ padding: 0 }}>
                                            <ListItem sx={{ padding: 0 }}>
                                              <ListItemText
                                                primary={
                                                  <strong>{key}:</strong>
                                                }
                                                secondary={
                                                  <Typography variant="body2">
                                                    {typeof value === "object"
                                                      ? JSON.stringify(value)
                                                      : String(value)}
                                                  </Typography>
                                                }
                                              />
                                            </ListItem>
                                          </List>
                                        )
                                      );
                                    } catch (e) {
                                      console.error(
                                        "Failed to parse interaction content:",
                                        interaction.content,
                                        e
                                      );
                                      return (
                                        <Typography
                                          variant="body2"
                                          color="error"
                                        >
                                          Lỗi phân tích nội dung:{" "}
                                          {interaction.content}
                                        </Typography>
                                      );
                                    }
                                  })()}
                                </Box>
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.primary"
                                  sx={{ mt: 1 }}
                                >
                                  Chi tiết: {interaction.content}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            )}

            {activeView === "recommendations" && (
              <Paper elevation={3} sx={{ p: 2 }}>
                <Typography
                  variant="h5"
                  component="h2"
                  gutterBottom
                  sx={{ borderBottom: "1px solid #eee", pb: 1, mb: 2 }}
                >
                  Video đề xuất cho {selectedUserDisplayName}
                </Typography>
                {loadingRecommendations ? (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", py: 4 }}
                  >
                    <CircularProgress />
                  </Box>
                ) : recommendedVideos.length === 0 ? (
                  <Typography>
                    Không có video đề xuất nào được tìm thấy.
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    {recommendedVideos.map((video, index) => (
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-expect-error // Still need to check why Grid item type is an issue
                      <Grid
                        item
                        xs={12}
                        sm={6}
                        md={4}
                        key={
                          video.video_guid ||
                          video.title ||
                          video.url ||
                          `rec-${index}`
                        }
                      >
                        <Card sx={{ display: "flex", flexDirection: "column" }}>
                          <CardContent>
                            <Typography
                              variant="body1"
                              sx={{
                                display: "inline-block",
                                maxWidth: "150px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              <strong>
                                {video.title || "Không có tiêu đề"}
                              </strong>
                            </Typography>
                            {video.source && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 1 }}
                              >
                                Nguồn đề xuất: {video.source}
                              </Typography>
                            )}

                            {typeof video.url === "string" && video.url ? (
                              <Box
                                sx={{
                                  mt: 2,
                                  width: "100%",
                                  display: "flex",
                                  justifyContent: "center",
                                }}
                              >
                                <video
                                  controls
                                  style={{
                                    width: "auto",
                                    height: "auto",
                                    maxWidth: "100%",
                                    maxHeight: "300px",
                                  }}
                                >
                                  <source src={video.url} type="video/mp4" />
                                  Trình duyệt của bạn không hỗ trợ thẻ video.
                                </video>
                              </Box>
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 1 }}
                              >
                                Không có URL video hợp lệ để hiển thị.
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Paper>
            )}

            {activeView === "none" &&
              !loadingInteractions && // Don't show message if interactions are loading
              !loadingRecommendations &&
              selectedUser && ( // Only show if a user is selected but no view active
                <Typography variant="body1" color="text.secondary">
                  Chọn một người dùng và nhấn "Xem Tương tác" hoặc "Xem Đề
                  xuất".
                </Typography>
              )}

            {/* Show loading spinner only when a user is selected, no view is active, and data is being loaded */}
            {(loadingInteractions || loadingRecommendations) &&
              activeView === "none" &&
              selectedUser && (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    py: 4,
                  }}
                >
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Đang tải dữ liệu tương tác và đề xuất...
                  </Typography>
                </Box>
              )}
          </Box>
        )}
      </ErrorBoundary>
    </Box>
  );
}

export default App;

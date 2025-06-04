const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios');

// Khởi tạo Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json'); // Đảm bảo đường dẫn đúng
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const port = 3001; // Cổng cho backend server

// Middleware
app.use(cors()); // Cho phép frontend từ origin khác gọi API
app.use(express.json());

// --- API Endpoint 1: Lấy danh sách User cho Select Box ---
app.get('/api/users', async (req, res) => {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
      return res.status(200).json([]); // Trả về mảng rỗng nếu không có user
    }

    const users = snapshot.docs.map(doc => ({
      id: doc.id, // Document ID chính là userID
      ...doc.data() // Lấy các field khác như displayName, email
    }));

    // Chỉ trả về id và displayName/email để select box hiển thị
    const userOptions = users.map(user => ({
        userId: user.id,
        displayName: user.displayName || user.email || user.id // Dùng displayName hoặc email hoặc ID
    }));

    res.status(200).json(userOptions);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// --- API Endpoint 2: Lấy tương tác mới nhất của User ---
app.get('/api/users/:userId/interactions', async (req, res) => {
  const userId = req.params.userId;
  const limit = parseInt(req.query.limit) || 20; // Số lượng tương tác muốn lấy, mặc định 20

  try {
    // Lấy các tương tác mới nhất của user từ subcollection interactions
    const interactionsRef = db.collection('users').doc(userId).collection('interactions');
    const interactionsSnapshot = await interactionsRef
      .orderBy('time', 'desc') // Sắp xếp theo thời gian giảm dần
      .limit(limit)
      .get();

    if (interactionsSnapshot.empty) {
      return res.status(200).json([]); // Trả về mảng rỗng nếu không có tương tác
    }

    const interactions = interactionsSnapshot.docs.map(doc => ({
      interactionId: doc.id, // ID của document tương tác
      ...doc.data()
    }));

    // Lấy danh sách videoIds từ các tương tác
    const videoIds = [...new Set(interactions.map(interaction => interaction.videoId))]; // Sử dụng Set để loại bỏ trùng lặp
    // Lấy thông tin chi tiết các video liên quan từ collection videos
    let videosMap = new Map();
    if (videoIds.length > 0) {
        // Firestore không hỗ trợ truy vấn 'in' quá 10 giá trị,
        // nếu có nhiều videoId, bạn cần chia nhỏ truy vấn hoặc xử lý khác
        // Giả sử số lượng videoId ít (<10) hoặc bạn xử lý chia batch
        const videosSnapshot = await db.collection('shorts-recommend-system')
            .where('id', 'in', videoIds.slice(0, 10)) // Giới hạn 10 cho truy vấn 'in'
            .get();
        
        console.log(`Fetched ${videosSnapshot.size} videos for user ${userId}`);

        videosSnapshot.forEach(doc => {
            videosMap.set(doc.data().id, doc.data());
        });

        // Xử lý các batch videoId còn lại nếu cần
        for (let i = 10; i < videoIds.length; i += 10) {
             const batchVideoIds = videoIds.slice(i, i + 10);
             const batchVideosSnapshot = await db.collection('shorts-recommend-system')
                 .where('id', 'in', batchVideoIds)
                 .get();
             batchVideosSnapshot.forEach(doc => {
                 videosMap.set(doc.data().id, doc.data());
             });
        }
    }


    // Kết hợp thông tin tương tác với thông tin video
    const interactionsWithVideo = interactions.map(interaction => {
      const video = videosMap.get(interaction.videoId) || null; // Lấy thông tin video, trả về null nếu không tìm thấy
      return {
        ...interaction,
        video: video
      };
    });

    res.status(200).json(interactionsWithVideo);
  } catch (error) {
    console.error(`Error fetching interactions for user ${userId}:`, error);
    res.status(500).json({ message: 'Error fetching interactions', error: error.message });
  }
});


// --- API Endpoint 3: Lấy Video đề xuất từ API ngoài ---
app.get('/api/users/:userId/recommendations', async (req, res) => {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 10; // Số lượng đề xuất, mặc định 10
    const simpleFormat = req.query.simple_format !== 'false'; // Mặc định là true

    const apiUrl = `http://209.159.153.54:6565/retrieval-10k?user_id=${userId}&limit=${limit}&simple_format=${simpleFormat}`;

    try {
        const response = await axios.get(apiUrl);
        // Kiểm tra cấu trúc response từ API ngoài
        if (response.data && response.data.statusCode === 200 && response.data.data && response.data.data.items) {
             // Map video_guid từ API ngoài sang videoId của bạn nếu cần kết hợp với data videos
             // Hiện tại API ngoài đã trả về title và url, có thể dùng trực tiếp
             res.status(200).json(response.data.data.items);
        } else {
            // Xử lý trường hợp API ngoài trả về lỗi hoặc cấu trúc khác
             console.error('External recommendation API returned an unexpected response:', response.data);
             res.status(response.status).json(response.data); // Trả về nguyên response từ API ngoài
        }

    } catch (error) {
        console.error(`Error fetching recommendations for user ${userId}:`, error.message);
        // Kiểm tra nếu lỗi là từ response HTTP (ví dụ: 404, 500)
        if (error.response) {
             res.status(error.response.status).json({
                 message: 'Error calling external recommendation API',
                 error: error.response.data
             });
        } else {
             // Lỗi khác (ví dụ: mạng, cấu hình)
             res.status(500).json({
                 message: 'Error calling external recommendation API',
                 error: error.message
             });
        }
    }
});


// Khởi động server
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// DATABASE SETUP
// ==========================================
const db = require('./database/db');

// ==========================================
// REST API ROUTES
// ==========================================

// Auth Route: Send OTP
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number required" });
  res.json({ message: "OTP sent successfully (Simulated)" });
});

// Auth Route: Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: "Phone and code required" });
    
    // Check if user exists or create
    let user = await db.getUserByPhone(phone);
    if (!user) {
      user = await db.createUser(phone);
    }

    res.json({
      token: `jwt_token_mock_${user.id}`,
      userId: user.id,
      onboarded: user.onboarded
    });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get colleges
app.get('/api/colleges', async (req, res) => {
  try {
    const colleges = await db.getColleges();
    res.json(colleges);
  } catch (err) {
    console.error('Error fetching colleges:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current profile
app.get('/api/profile', async (req, res) => {
  try {
    const userId = req.headers.authorization?.split('_')[1];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await db.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error('Error getting profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile
app.put('/api/profile', async (req, res) => {
  try {
    const userId = req.headers.authorization?.split('_')[1];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, age, gender, preference, collegeId, collegeName, course, gradYear, bio, prompts, interests, imageUrl, aadhaarNumber, studentIdCard, latitude, longitude } = req.body;
    
    const updatedUser = await db.updateProfile(userId, {
      name,
      age,
      gender,
      preference,
      collegeId,
      collegeName,
      course,
      gradYear,
      bio,
      prompts,
      interests,
      imageUrl,
      aadhaarNumber,
      studentIdCard,
      latitude,
      longitude
    });

    res.json({ success: true, profile: updatedUser.profile });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join blind date matchmaking queue
app.post('/api/blind-date/join', async (req, res) => {
  try {
    const userId = parseInt(req.headers.authorization?.split('_')[1]);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await db.getUser(userId);
    if (!user || !user.profile) {
      return res.status(401).json({ error: "Onboarding required before joining queue." });
    }

    // Check if free user exceeded 5 dates limit
    const dateCount = await db.getBlindDateCount(userId);
    if (dateCount >= 5 && !user.isPremium) {
      return res.json({ status: "subscription_required" });
    }

    // Check if user is already in a date
    const activeDate = await db.getActiveDate(userId);
    if (activeDate) {
      return res.json({ status: "already_matched", date: activeDate });
    }

    // Add to queue
    await db.joinQueue(userId);

    // Run matchmaking
    const matchFoundId = await db.findMatch(userId);
    if (matchFoundId) {
      // Create new date
      const newDate = await db.createDate(userId, matchFoundId);
      
      // Remove both from queue
      await db.leaveQueue(userId);
      await db.leaveQueue(matchFoundId);

      // Notify clients via WS socket
      io.emit('match_created', newDate);
      return res.json({ status: "matched", date: newDate });
    }

    res.json({ status: "queued" });
  } catch (err) {
    console.error('Error joining queue:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave blind date queue
app.post('/api/blind-date/leave', async (req, res) => {
  try {
    const userId = parseInt(req.headers.authorization?.split('_')[1]);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    await db.leaveQueue(userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error leaving queue:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current date
app.get('/api/blind-date/current', async (req, res) => {
  try {
    const userId = parseInt(req.headers.authorization?.split('_')[1]);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const activeDate = await db.getActiveDate(userId);
    if (!activeDate) return res.json({ date: null });

    // Enrich match profile
    const partnerId = activeDate.user1_id === userId ? activeDate.user2_id : activeDate.user1_id;
    const partnerUser = await db.getUser(partnerId);
    const partner = partnerUser?.profile;

    res.json({
      date: activeDate,
      partner: partner ? {
        name: activeDate.status === 'revealed' ? partner.name : partner.codename,
        codename: partner.codename,
        age: partner.age,
        gender: partner.gender,
        college: await db.getCollegeName(partner.collegeId),
        course: partner.course,
        gradYear: partner.gradYear,
        bio: partner.bio,
        prompts: partner.prompts,
        interests: partner.interests,
        imageUrl: activeDate.status === 'revealed' ? partner.imageUrl : "/assets/user_placeholder.png" // send blurred/placeholder if blind
      } : null
    });
  } catch (err) {
    console.error('Error getting current date:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vote to reveal profile
app.post('/api/blind-date/reveal', async (req, res) => {
  try {
    const userId = parseInt(req.headers.authorization?.split('_')[1]);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    const activeDate = await db.getActiveDate(userId);
    if (!activeDate) return res.status(404).json({ error: "No active date found" });

    const updatedDate = await db.revealDate(activeDate.id, userId);

    if (updatedDate && updatedDate.status === 'revealed') {
      io.to(`room_${activeDate.id}`).emit('profile_revealed', updatedDate);
    }

    res.json({ date: updatedDate });
  } catch (err) {
    console.error('Error revealing profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get message history
app.get('/api/blind-date/:id/messages', async (req, res) => {
  try {
    const dateId = parseInt(req.params.id);
    const dateMsgs = await db.getMessages(dateId);
    res.json(dateMsgs);
  } catch (err) {
    console.error('Error getting messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Activate subscription (Mock payment)
app.post('/api/subscription/activate', async (req, res) => {
  try {
    const userId = parseInt(req.headers.authorization?.split('_')[1]);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { type } = req.body;
    if (!type || (type !== 'monthly' && type !== 'yearly')) {
      return res.status(400).json({ error: "Invalid subscription type" });
    }

    const updatedUser = await db.activateSubscription(userId, type);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Error activating subscription:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simulate 5 completed dates for testing
app.post('/api/test/simulate-dates', async (req, res) => {
  try {
    const userId = parseInt(req.headers.authorization?.split('_')[1]);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await db.simulateCompletedDates(userId);
    const count = await db.getBlindDateCount(userId);
    res.json({ success: true, count: count });
  } catch (err) {
    console.error('Error simulating dates:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ==========================================
// SOCKET.IO REAL-TIME CHAT & BOT MOCK CHATS
// ==========================================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_room', ({ dateId }) => {
    socket.join(`room_${dateId}`);
    console.log(`Socket ${socket.id} joined room_${dateId}`);
  });

  socket.on('send_msg', async (data) => {
    try {
      const { dateId, senderId, content, msgType } = data;
      
      const message = await db.saveMessage(dateId, senderId, content, msgType || 'text');

      // Broadcast to room
      io.to(`room_${dateId}`).emit('receive_msg', message);

      // MOCK CHAT BOT RESPONDER
      // If the partner is a bot (id < 1000), let's trigger a dynamic response
      const activeDate = await db.getActiveDate(senderId);
      if (activeDate && activeDate.id === parseInt(dateId)) {
        const partnerId = activeDate.user1_id === parseInt(senderId) ? activeDate.user2_id : activeDate.user1_id;
        if (partnerId < 1000) {
          // Partner is a bot, simulate typing and message
          setTimeout(async () => {
            io.to(`room_${dateId}`).emit('typing_status', { userId: partnerId, isTyping: true });
            
            setTimeout(async () => {
              io.to(`room_${dateId}`).emit('typing_status', { userId: partnerId, isTyping: false });
              
              // Bot responses based on count
              const botUser = await db.getUser(partnerId);
              const botProfile = botUser?.profile;
              if (!botProfile) return;

              const botResponses = [
                `Hey there! Love the codename. They call me ${botProfile.codename}. How's your week going?`,
                `That's awesome! I'm studying ${botProfile.course} here. It keeps me pretty busy, but blind dates are a fun escape. What about you?`,
                `Haha, I completely agree! By the way, check out my profile prompts. The one about "${botProfile.prompts[0].question}" is 100% true.`,
                `We've already shared quite a few messages! If you want to see who is behind the curtain, feel free to click 'Reveal Profile' at the top of the chat. I'll click it too!`,
                `Wow, it's nice to officially meet you! You look great. Let's schedule a real coffee meetup on campus soon!`
              ];

              const currentMsgs = await db.getMessages(dateId);
              const conversationLength = currentMsgs.filter(m => m.sender_id === partnerId).length;
              const replyContent = botResponses[Math.min(conversationLength, botResponses.length - 1)];

              const botMessage = await db.saveMessage(dateId, partnerId, replyContent);
              io.to(`room_${dateId}`).emit('receive_msg', botMessage);

            }, 1500 + Math.random() * 1000);
          }, 800);
        }
      }
    } catch (err) {
      console.error('Error handling socket message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`  CAMPFIRE SERVER RUNNING ON http://localhost:${PORT}`);
  console.log(`========================================================`);
});

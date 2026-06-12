const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  console.log('PostgreSQL database pool initialized.');

  // Run database migrations on startup
  const runMigrations = async () => {
    try {
      console.log('Running database migrations...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('Database migrations completed successfully.');
    } catch (err) {
      console.error('Failed to run database migrations:', err);
    }
  };
  runMigrations();
} else {
  console.log('No DATABASE_URL found. Running with in-memory database fallback.');
}

// IN-MEMORY FALLBACK DATABASE
const inMemoryColleges = [
  { id: 1, name: "Stanford University", city: "Stanford" },
  { id: 2, name: "UC Berkeley", city: "Berkeley" },
  { id: 3, name: "MIT", city: "Cambridge" },
  { id: 4, name: "Harvard University", city: "Cambridge" },
  { id: 5, name: "Caltech", city: "Pasadena" }
];

let inMemoryUsers = {};
let inMemoryQueue = [];
let inMemoryDates = [];
let inMemoryMessages = [];

// Preset demo profiles for matching
const demoProfiles = [
  {
    userId: 101,
    name: "Aria Chen",
    age: 20,
    gender: "female",
    preference: "male",
    collegeId: 2, // UC Berkeley
    course: "Computer Science",
    gradYear: 2028,
    bio: "Always down for late-night boba runs. I spend 70% of my time debugging code and the other 30% thinking about food.",
    prompts: [
      { question: "My ideal blind date is...", answer: "Getting lost in a museum or bookstore and arguing over which exhibit/book is better." },
      { question: "A social cause I care about...", answer: "Making tech education accessible to underprivileged youth." }
    ],
    interests: ["Coding", "Boba", "Museums", "Reading"],
    imageUrl: "/assets/aria.png",
    codename: "Velvet Fox"
  },
  {
    userId: 102,
    name: "Marcus Vance",
    age: 21,
    gender: "male",
    preference: "female",
    collegeId: 3, // MIT
    course: "Mechanical Engineering",
    gradYear: 2027,
    bio: "Build things by day, play acoustic guitar by night. Let's talk about aerospace, robotics, or literally anything else.",
    prompts: [
      { question: "Most spontaneous thing I've done...", answer: "Booked a train ride to Chicago with an hour's notice just to get deep-dish pizza." },
      { question: "I get along best with people who...", answer: "Don't take themselves too seriously and love random trivia." }
    ],
    interests: ["Guitars", "Robotics", "Pizza", "Hiking"],
    imageUrl: "/assets/marcus.png",
    codename: "Bronze Phoenix"
  },
  {
    userId: 103,
    name: "Sophia Martinez",
    age: 19,
    gender: "female",
    preference: "everyone",
    collegeId: 4, // Harvard
    course: "Economics & Philosophy",
    gradYear: 2029,
    bio: "Debate enthusiast, espresso shot collector, and part-time runner. Looking for someone to explore vinyl record stores with.",
    prompts: [
      { question: "The key to my heart is...", answer: "A perfectly brewed double espresso and a playlist recommendation." },
      { question: "We'll get along if...", answer: "You love hiking early mornings and hate group project freeloaders." }
    ],
    interests: ["Debate", "Coffee", "Vinyl", "Running"],
    imageUrl: "/assets/sophia.png",
    codename: "Emerald Koala"
  }
];

// Seed bots into in-memory
demoProfiles.forEach(bot => {
  inMemoryUsers[bot.userId] = {
    id: bot.userId,
    phone: `bot_${bot.userId}`,
    email: '',
    email_verified: true,
    onboarded: true,
    profile: bot
  };
});

// Seed colleges helper
const getCollegeNameInMemory = (id) => {
  const col = inMemoryColleges.find(c => c.id === parseInt(id));
  return col ? col.name : "Unknown College";
};

const getCollegeName = async (id) => {
  if (pool) {
    const res = await pool.query('SELECT name FROM colleges WHERE id = $1', [parseInt(id)]);
    return res.rows[0] ? res.rows[0].name : "Unknown College";
  }
  return getCollegeNameInMemory(id);
};

const getColleges = async () => {
  if (pool) {
    const res = await pool.query('SELECT * FROM colleges ORDER BY id ASC');
    return res.rows;
  }
  return inMemoryColleges;
};

const getUserByPhone = async (phone) => {
  if (pool) {
    const res = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    return res.rows[0] || null;
  }
  return Object.values(inMemoryUsers).find(u => u.phone === phone) || null;
};

const createUser = async (phone) => {
  if (pool) {
    const res = await pool.query('INSERT INTO users (phone) VALUES ($1) RETURNING *', [phone]);
    return res.rows[0];
  }
  const userId = 1000 + Math.floor(Math.random() * 9000);
  inMemoryUsers[userId] = {
    id: userId,
    phone: phone,
    email: '',
    email_verified: false,
    isPremium: false,
    subscriptionType: 'free',
    onboarded: false,
    profile: null
  };
  return inMemoryUsers[userId];
};

const getUser = async (id) => {
  const userId = parseInt(id);
  if (pool) {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];
    
    const profileRes = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    const profile = profileRes.rows[0] || null;
    
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      email_verified: user.email_verified,
      isPremium: user.is_premium || false,
      subscriptionType: user.subscription_type || 'free',
      onboarded: profile ? profile.is_onboarded : false,
      profile: profile ? {
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        preference: profile.preference,
        collegeId: profile.college_id,
        collegeName: await getCollegeName(profile.college_id),
        course: profile.course,
        gradYear: profile.grad_year,
        bio: profile.bio,
        prompts: typeof profile.prompts === 'string' ? JSON.parse(profile.prompts) : profile.prompts,
        interests: profile.interests,
        imageUrl: profile.image_url,
        imageUrls: profile.image_urls || [profile.image_url],
        codename: profile.codename || "Golden Griffin",
        is_onboarded: profile.is_onboarded,
        aadhaarNumber: profile.aadhaar_number,
        studentIdCard: profile.student_id_card,
        latitude: profile.latitude,
        longitude: profile.longitude
      } : null
    };
  }
  return inMemoryUsers[userId] || null;
};

const updateProfile = async (id, profileData) => {
  const userId = parseInt(id);
  let { name, age, gender, preference, collegeId, collegeName, course, gradYear, bio, prompts, interests, imageUrl, imageUrls, aadhaarNumber, studentIdCard, latitude, longitude } = profileData;
  const codenames = ["Golden Griffin", "Ruby Panther", "Silver Badger", "Amethyst Hawk", "Cobalt Otter"];
  const codename = codenames[userId % codenames.length];

  // Resolve custom collegeName to collegeId if provided
  if (collegeName && !collegeId) {
    if (pool) {
      collegeName = collegeName.trim();
      const colRes = await pool.query('SELECT id FROM colleges WHERE LOWER(name) = LOWER($1)', [collegeName]);
      if (colRes.rows.length > 0) {
        collegeId = colRes.rows[0].id;
      } else {
        const domain = collegeName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.edu';
        const city = "Unknown";
        const insertCol = await pool.query('INSERT INTO colleges (name, domain, city) VALUES ($1, $2, $3) RETURNING id', [collegeName, domain, city]);
        collegeId = insertCol.rows[0].id;
      }
    } else {
      collegeName = collegeName.trim();
      let col = inMemoryColleges.find(c => c.name.toLowerCase() === collegeName.toLowerCase());
      if (col) {
        collegeId = col.id;
      } else {
        collegeId = inMemoryColleges.length + 1;
        inMemoryColleges.push({ id: collegeId, name: collegeName, city: "Unknown" });
      }
    }
  }

  if (pool) {
    const check = await pool.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
    if (check.rows.length > 0) {
      await pool.query(
        `UPDATE profiles 
         SET name = $1, age = $2, gender = $3, preference = $4, college_id = $5, course = $6, grad_year = $7, bio = $8, prompts = $9, interests = $10, image_url = $11, is_onboarded = TRUE, codename = $12, aadhaar_number = $13, student_id_card = $14, latitude = $15, longitude = $16, image_urls = $17
         WHERE user_id = $18`,
        [name, parseInt(age), gender, preference, parseInt(collegeId), course, parseInt(gradYear), bio, JSON.stringify(prompts), interests, imageUrl || '/assets/user_placeholder.png', codename, aadhaarNumber || null, studentIdCard || null, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, imageUrls || [imageUrl || '/assets/user_placeholder.png'], userId]
      );
    } else {
      await pool.query(
        `INSERT INTO profiles (user_id, name, age, gender, preference, college_id, course, grad_year, bio, prompts, interests, image_url, is_onboarded, codename, aadhaar_number, student_id_card, latitude, longitude, image_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, $13, $14, $15, $16, $17, $18)`,
        [userId, name, parseInt(age), gender, preference, parseInt(collegeId), course, parseInt(gradYear), bio, JSON.stringify(prompts), interests, imageUrl || '/assets/user_placeholder.png', codename, aadhaarNumber || null, studentIdCard || null, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, imageUrls || [imageUrl || '/assets/user_placeholder.png']]
      );
    }
    return await getUser(userId);
  }

  inMemoryUsers[userId].profile = {
    name,
    age: parseInt(age),
    gender,
    preference,
    collegeId: parseInt(collegeId),
    collegeName: collegeName,
    course,
    gradYear: parseInt(gradYear),
    bio,
    prompts,
    interests,
    imageUrl: imageUrl || "/assets/user_placeholder.png",
    imageUrls: imageUrls || [imageUrl || "/assets/user_placeholder.png"],
    codename: codename,
    is_onboarded: true,
    aadhaarNumber: aadhaarNumber || null,
    studentIdCard: studentIdCard || null,
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null
  };
  inMemoryUsers[userId].onboarded = true;
  return inMemoryUsers[userId];
};

const joinQueue = async (userId) => {
  if (pool) {
    await pool.query('INSERT INTO blind_date_queue (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    return;
  }
  if (!inMemoryQueue.includes(userId)) {
    inMemoryQueue.push(userId);
  }
};

const leaveQueue = async (userId) => {
  if (pool) {
    await pool.query('DELETE FROM blind_date_queue WHERE user_id = $1', [userId]);
    return;
  }
  inMemoryQueue = inMemoryQueue.filter(id => id !== userId);
};

const getActiveDate = async (userId) => {
  if (pool) {
    const res = await pool.query(
      `SELECT * FROM blind_dates 
       WHERE (user1_id = $1 OR user2_id = $1) AND status != 'ended'
       LIMIT 1`,
      [userId]
    );
    if (res.rows.length === 0) return null;
    
    // Normalize format
    const row = res.rows[0];
    return {
      id: row.id,
      user1_id: row.user1_id,
      user2_id: row.user2_id,
      status: row.status,
      user1_reveal: row.user1_reveal,
      user2_reveal: row.user2_reveal,
      created_at: row.created_at
    };
  }
  return inMemoryDates.find(d => (d.user1_id === userId || d.user2_id === userId) && d.status !== 'ended') || null;
};

const findMatch = async (userId) => {
  const me = await getUser(userId);
  if (!me || !me.profile) return null;
  const myProfile = me.profile;

  if (pool) {
    const res = await pool.query(
      `SELECT q.user_id 
       FROM blind_date_queue q
       JOIN profiles p ON q.user_id = p.user_id
       WHERE q.user_id != $1
         AND p.college_id != $2
         AND (p.preference = 'everyone' OR p.preference = $3)
         AND ($4 = 'everyone' OR p.gender = $4)
       ORDER BY (p.latitude - $5)^2 + (p.longitude - $6)^2 ASC NULLS LAST, q.joined_at ASC
       LIMIT 1`,
      [userId, myProfile.collegeId, myProfile.gender, myProfile.preference, myProfile.latitude || 0.0, myProfile.longitude || 0.0]
    );
    if (res.rows.length > 0) {
      return res.rows[0].user_id;
    }
  } else {
    const candidates = [];
    for (let candidateId of inMemoryQueue) {
      if (candidateId === userId) continue;
      const cand = inMemoryUsers[candidateId];
      if (!cand || !cand.profile) continue;
      const candProfile = cand.profile;

      const isInterCollege = candProfile.collegeId !== myProfile.collegeId;
      const genderCompatible = 
        (myProfile.preference === 'everyone' || myProfile.preference === candProfile.gender) &&
        (candProfile.preference === 'everyone' || candProfile.preference === myProfile.gender);

      if (isInterCollege && genderCompatible) {
        const myLat = myProfile.latitude || 0;
        const myLon = myProfile.longitude || 0;
        const candLat = candProfile.latitude || 0;
        const candLon = candProfile.longitude || 0;
        const dist = Math.sqrt(Math.pow(candLat - myLat, 2) + Math.pow(candLon - myLon, 2));
        candidates.push({ candidateId, dist });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      return candidates[0].candidateId;
    }
  }

  // Fallback: Bot matching
  for (let bot of demoProfiles) {
    const isInterCollege = bot.collegeId !== myProfile.collegeId;
    const genderCompatible = 
      (myProfile.preference === 'everyone' || myProfile.preference === bot.gender) &&
      (bot.preference === 'everyone' || bot.preference === myProfile.gender);

    if (isInterCollege && genderCompatible) {
      if (pool) {
        await pool.query('INSERT INTO users (id, phone) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [bot.userId, `bot_${bot.userId}`]);
        await pool.query(
          `INSERT INTO profiles (user_id, name, age, gender, preference, college_id, course, grad_year, bio, prompts, interests, image_url, is_onboarded, codename)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, $13)
           ON CONFLICT (user_id) DO NOTHING`,
          [bot.userId, bot.name, bot.age, bot.gender, bot.preference, bot.collegeId, bot.course, bot.gradYear, bot.bio, JSON.stringify(bot.prompts), bot.interests, bot.imageUrl, bot.codename]
        );
      } else {
        inMemoryUsers[bot.userId] = {
          id: bot.userId,
          onboarded: true,
          profile: bot
        };
      }
      return bot.userId;
    }
  }
  return null;
};

const createDate = async (user1Id, user2Id) => {
  if (pool) {
    const res = await pool.query(
      `INSERT INTO blind_dates (user1_id, user2_id, status, user1_reveal, user2_reveal)
       VALUES ($1, $2, 'blind', FALSE, FALSE)
       RETURNING *`,
      [user1Id, user2Id]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      user1_id: row.user1_id,
      user2_id: row.user2_id,
      status: row.status,
      user1_reveal: row.user1_reveal,
      user2_reveal: row.user2_reveal,
      created_at: row.created_at
    };
  }
  const newDate = {
    id: inMemoryDates.length + 1,
    user1_id: user1Id,
    user2_id: user2Id,
    status: 'blind',
    user1_reveal: false,
    user2_reveal: false,
    created_at: new Date()
  };
  inMemoryDates.push(newDate);
  return newDate;
};

const revealDate = async (dateId, userId) => {
  const dId = parseInt(dateId);
  const uId = parseInt(userId);

  if (pool) {
    const res = await pool.query('SELECT * FROM blind_dates WHERE id = $1', [dId]);
    if (res.rows.length === 0) return null;
    const date = res.rows[0];

    let user1_reveal = date.user1_reveal;
    let user2_reveal = date.user2_reveal;

    if (date.user1_id === uId) {
      user1_reveal = true;
    } else if (date.user2_id === uId) {
      user2_reveal = true;
    }

    // Instantly reveal if matched with a bot (id < 1000)
    const partnerId = date.user1_id === uId ? date.user2_id : date.user1_id;
    if (partnerId < 1000) {
      user2_reveal = true;
      user1_reveal = true;
    }

    const status = (user1_reveal && user2_reveal) ? 'revealed' : date.status;

    const updateRes = await pool.query(
      `UPDATE blind_dates 
       SET user1_reveal = $1, user2_reveal = $2, status = $3 
       WHERE id = $4 
       RETURNING *`,
      [user1_reveal, user2_reveal, status, dId]
    );
    const row = updateRes.rows[0];
    return {
      id: row.id,
      user1_id: row.user1_id,
      user2_id: row.user2_id,
      status: row.status,
      user1_reveal: row.user1_reveal,
      user2_reveal: row.user2_reveal,
      created_at: row.created_at
    };
  }

  const activeDate = inMemoryDates.find(d => d.id === dId);
  if (!activeDate) return null;

  if (activeDate.user1_id === uId) {
    activeDate.user1_reveal = true;
  } else {
    activeDate.user2_reveal = true;
  }

  const partnerId = activeDate.user1_id === uId ? activeDate.user2_id : activeDate.user1_id;
  if (partnerId < 1000) {
    activeDate.user1_reveal = true;
    activeDate.user2_reveal = true;
  }

  if (activeDate.user1_reveal && activeDate.user2_reveal) {
    activeDate.status = 'revealed';
  }
  return activeDate;
};

const getMessages = async (dateId) => {
  const dId = parseInt(dateId);
  if (pool) {
    const res = await pool.query('SELECT * FROM messages WHERE blind_date_id = $1 ORDER BY created_at ASC', [dId]);
    return res.rows.map(row => ({
      id: row.id,
      blind_date_id: row.blind_date_id,
      sender_id: row.sender_id,
      content: row.content,
      msg_type: row.msg_type || 'text',
      created_at: row.created_at
    }));
  }
  return inMemoryMessages.filter(m => m.blind_date_id === dId);
};

const saveMessage = async (dateId, senderId, content, msgType = 'text') => {
  const dId = parseInt(dateId);
  const sId = parseInt(senderId);

  if (pool) {
    const res = await pool.query(
      `INSERT INTO messages (blind_date_id, sender_id, content, msg_type) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [dId, sId, content, msgType]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      blind_date_id: row.blind_date_id,
      sender_id: row.sender_id,
      content: row.content,
      msg_type: row.msg_type,
      created_at: row.created_at
    };
  }

  const message = {
    id: inMemoryMessages.length + 1,
    blind_date_id: dId,
    sender_id: sId,
    content: content,
    msg_type: msgType,
    created_at: new Date()
  };
  inMemoryMessages.push(message);
  return message;
};

const getBlindDateCount = async (userId) => {
  const uId = parseInt(userId);
  if (pool) {
    const res = await pool.query(
      `SELECT COUNT(*) FROM blind_dates 
       WHERE (user1_id = $1 OR user2_id = $1)`,
      [uId]
    );
    return parseInt(res.rows[0].count);
  }
  return inMemoryDates.filter(d => d.user1_id === uId || d.user2_id === uId).length;
};

const activateSubscription = async (userId, type) => {
  const uId = parseInt(userId);
  if (pool) {
    await pool.query(
      `UPDATE users 
       SET is_premium = TRUE, subscription_type = $1 
       WHERE id = $2`,
      [type, uId]
    );
    return await getUser(uId);
  }
  if (inMemoryUsers[uId]) {
    inMemoryUsers[uId].isPremium = true;
    inMemoryUsers[uId].subscriptionType = type;
  }
  return inMemoryUsers[uId] || null;
};

const simulateCompletedDates = async (userId) => {
  const uId = parseInt(userId);
  if (pool) {
    for (let i = 0; i < 5; i++) {
      const partnerId = 101 + (i % 3);
      await pool.query(
        `INSERT INTO blind_dates (user1_id, user2_id, status)
         VALUES ($1, $2, 'revealed')
         ON CONFLICT DO NOTHING`,
        [uId, partnerId]
      );
    }
    return;
  }
  for (let i = 0; i < 5; i++) {
    const partnerId = 101 + (i % 3);
    inMemoryDates.push({
      id: inMemoryDates.length + 1,
      user1_id: uId,
      user2_id: partnerId,
      status: 'revealed',
      created_at: new Date()
    });
  }
};

module.exports = {
  getCollegeName,
  getColleges,
  getUserByPhone,
  createUser,
  getUser,
  updateProfile,
  joinQueue,
  leaveQueue,
  getActiveDate,
  findMatch,
  createDate,
  revealDate,
  getMessages,
  saveMessage,
  getBlindDateCount,
  activateSubscription,
  simulateCompletedDates
};

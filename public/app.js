// ==========================================================================
// CAMPFIRE - CLIENT LOGIC (SINGLE PAGE APPLICATION)
// ==========================================================================

const API_BASE = ""; // Same host
let socket = null;

// Application State
const state = {
  token: localStorage.getItem("campfire_token") || null,
  userId: localStorage.getItem("campfire_userid") || null,
  profile: null,
  currentDate: null,
  currentPartner: null,
  messages: [],
  onboardingStep: 1,
  queueInterval: null,
  timerInterval: null
};

// ==========================================
// ROUTER & NAVIGATION
// ==========================================
function navigateTo(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add("active");
  }
}

// Clock Header Simulation
function updateClock() {
  const clock = document.getElementById("device-clock");
  if (clock) {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    clock.textContent = `${hours}:${minutes}`;
  }
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// APP INITIALIZATION
// ==========================================
window.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  
  // Fake splash loading time for branding effect
  setTimeout(async () => {
    if (state.token && state.userId) {
      await checkProfileStatus();
    } else {
      navigateTo("page-login");
    }
  }, 2200);
});

async function checkProfileStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: { "Authorization": `Bearer_${state.userId}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      state.profile = data.profile;
      
      if (data.onboarded && state.profile) {
        // Init socket and check active matches
        initSocket();
        await checkActiveDate();
      } else {
        navigateTo("page-onboarding");
      }
    } else {
      // Token expired or invalid
      logout();
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    navigateTo("page-login");
  }
}

// ==========================================
// SOCKET CONNECTION
// ==========================================
function initSocket() {
  if (socket) return;
  
  socket = io({
    auth: { token: state.token }
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("receive_msg", (message) => {
    if (state.currentDate && message.blind_date_id === state.currentDate.id) {
      state.messages.push(message);
      appendMessage(message);
      updateRevealProgress();
    }
  });

  socket.on("typing_status", ({ userId, isTyping }) => {
    const typingSpan = document.getElementById("chat-typing-status");
    if (typingSpan && userId !== parseInt(state.userId)) {
      if (isTyping) {
        typingSpan.classList.add("active");
      } else {
        typingSpan.classList.remove("active");
      }
    }
  });

  socket.on("profile_revealed", (updatedDate) => {
    if (state.currentDate && state.currentDate.id === updatedDate.id) {
      state.currentDate = updatedDate;
      // Refresh current active date layout to update images & names!
      checkActiveDate();
      alert("Profiles Revealed! Standard profile is unlocked.");
    }
  });

  socket.on("match_created", (newDate) => {
    if (newDate.user1_id === parseInt(state.userId) || newDate.user2_id === parseInt(state.userId)) {
      clearInterval(state.queueInterval);
      state.queueInterval = null;
      checkActiveDate();
    }
  });
}

// ==========================================
// EVENT LISTENERS Setup
// ==========================================
function setupEventListeners() {
  // Login Page
  const phoneInput = document.getElementById("phone-input");
  const btnSendOtp = document.getElementById("btn-send-otp");
  const otpWrapper = document.getElementById("otp-wrapper");
  const btnVerifyOtp = document.getElementById("btn-verify-otp");

  btnSendOtp.addEventListener("click", async () => {
    const phone = phoneInput.value.trim();
    if (!phone) return alert("Please enter a valid phone number");
    
    btnSendOtp.disabled = true;
    btnSendOtp.textContent = "Sending...";
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      if (res.ok) {
        otpWrapper.classList.remove("hidden");
        btnSendOtp.classList.add("hidden");
      } else {
        alert("Failed to send OTP. Try again.");
        btnSendOtp.disabled = false;
        btnSendOtp.textContent = "Send Verification Code";
      }
    } catch (err) {
      console.error(err);
      btnSendOtp.disabled = false;
    }
  });

  btnVerifyOtp.addEventListener("click", async () => {
    const phone = phoneInput.value.trim();
    const code = document.getElementById("otp-input").value.trim();
    if (code.length < 4) return alert("Enter valid verification code");

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code })
      });
      if (res.ok) {
        const data = await res.json();
        state.token = data.token;
        state.userId = data.userId;
        localStorage.setItem("campfire_token", data.token);
        localStorage.setItem("campfire_userid", data.userId);
        
        await checkProfileStatus();
      } else {
        alert("Invalid verification code");
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Onboarding Form step changes
  document.getElementById("btn-next-step").addEventListener("click", () => {
    // Validate Step 1 inputs
    const name = document.getElementById("ob-name").value.trim();
    const age = document.getElementById("ob-age").value.trim();
    const gender = document.getElementById("ob-gender").value;
    const pref = document.getElementById("ob-pref").value;

    if (!name || !age || !gender || !pref) {
      return alert("Please fill out all fields on this step.");
    }
    
    // Switch Steps
    document.getElementById("step-1").classList.add("hidden");
    document.getElementById("step-2").classList.remove("hidden");
    document.querySelector(".step-indicator").textContent = "2 of 2";
  });

  document.getElementById("btn-prev-step").addEventListener("click", () => {
    document.getElementById("step-2").classList.add("hidden");
    document.getElementById("step-1").classList.remove("hidden");
    document.querySelector(".step-indicator").textContent = "1 of 2";
  });

  // Helper to submit profile with coordinates
  async function submitProfileWithLocation(latitude, longitude) {
    const prompts = [];
    document.querySelectorAll(".ob-prompt-ans").forEach(ta => {
      const val = ta.value.trim();
      if (val) {
        prompts.push({ question: ta.dataset.q, answer: val });
      }
    });

    const gender = document.getElementById("ob-gender").value;
    let fallbackImg = "/assets/user_placeholder.png";
    if (gender === "female") fallbackImg = "/assets/aria.png";
    else if (gender === "male") fallbackImg = "/assets/marcus.png";

    const imageUrls = [];
    document.querySelectorAll(".ob-photo-url").forEach(input => {
      const val = input.value.trim();
      if (val) imageUrls.push(val);
    });

    const payload = {
      name: document.getElementById("ob-name").value.trim(),
      age: document.getElementById("ob-age").value,
      gender: gender,
      preference: document.getElementById("ob-pref").value,
      collegeName: document.getElementById("ob-college").value.trim(),
      course: document.getElementById("ob-course").value.trim(),
      gradYear: document.getElementById("ob-grad").value,
      bio: document.getElementById("ob-bio").value.trim(),
      prompts: prompts,
      interests: ["Coffee", "Art", "Books", "Hiking"],
      imageUrl: imageUrls[0] || fallbackImg,
      imageUrls: imageUrls.length > 0 ? imageUrls : [fallbackImg],
      aadhaarNumber: document.getElementById("ob-aadhaar").value.trim(),
      studentIdCard: document.getElementById("ob-idcard").value.trim(),
      latitude: latitude,
      longitude: longitude
    };

    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer_${state.userId}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        initSocket();
        await checkProfileStatus();
      } else {
        alert("Failed to submit profile. Please review.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Onboarding Form Submit
  document.getElementById("onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await submitProfileWithLocation(position.coords.latitude, position.coords.longitude);
        },
        async (error) => {
          console.warn("Location permission denied or unavailable, using fallback coordinates.");
          // Fallback coords: Stanford campus
          await submitProfileWithLocation(37.4275, -122.1697);
        }
      );
    } else {
      await submitProfileWithLocation(37.4275, -122.1697);
    }
  });

  // Dashboard Page Actions
  document.getElementById("btn-join-queue").addEventListener("click", async () => {
    document.getElementById("btn-join-queue").classList.add("hidden");
    document.getElementById("btn-leave-queue").classList.remove("hidden");
    document.getElementById("queue-title").textContent = "Searching for dates...";
    document.getElementById("queue-desc").textContent = "Looking for matches from another campus nearby. Pulling matching logs...";

    // Trigger queue join
    await joinQueue();
    // Poll queue status periodically
    state.queueInterval = setInterval(joinQueue, 4000);
  });

  document.getElementById("btn-leave-queue").addEventListener("click", async () => {
    clearInterval(state.queueInterval);
    state.queueInterval = null;
    
    try {
      await fetch(`${API_BASE}/api/blind-date/leave`, {
        method: "POST",
        headers: { "Authorization": `Bearer_${state.userId}` }
      });
      resetQueueUI();
    } catch (err) {
      console.error(err);
    }
  });

  // Active Profile Page Actions
  document.getElementById("btn-active-to-dashboard").addEventListener("click", () => {
    navigateTo("page-dashboard");
  });
  
  document.getElementById("btn-to-chat").addEventListener("click", () => {
    openChatScreen();
  });
  
  document.getElementById("btn-chat-now").addEventListener("click", () => {
    openChatScreen();
  });

  // Chat Page Actions
  document.getElementById("btn-chat-to-active").addEventListener("click", () => {
    navigateTo("page-active-date");
  });

  document.getElementById("btn-send-message").addEventListener("click", sendMessage);
  document.getElementById("chat-message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Handle typing simulation
  let typingTimeout = null;
  document.getElementById("chat-message-input").addEventListener("input", () => {
    if (!socket || !state.currentDate) return;
    
    socket.emit("typing", { dateId: state.currentDate.id, isTyping: true });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("typing", { dateId: state.currentDate.id, isTyping: false });
    }, 1500);
  });

  document.getElementById("btn-chat-reveal").addEventListener("click", async () => {
    try {
      const res = await fetch(`${API_BASE}/api/blind-date/reveal`, {
        method: "POST",
        headers: { "Authorization": `Bearer_${state.userId}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert("Reveal requested! Waiting for match to also accept (reveals instantly in demo mode).");
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Settings Actions
  document.getElementById("btn-to-settings").addEventListener("click", () => {
    document.getElementById("settings-name").textContent = state.profile.name;
    document.getElementById("settings-college").textContent = state.profile.collegeName || `Student at College ID ${state.profile.collegeId}`;
    document.getElementById("settings-avatar").src = state.profile.imageUrl;
    navigateTo("page-settings");
  });

  document.getElementById("btn-settings-to-dashboard").addEventListener("click", () => {
    navigateTo("page-dashboard");
  });

  document.getElementById("btn-reset-demo").addEventListener("click", logout);



  // Chat attachment button click
  document.getElementById("btn-chat-attach").addEventListener("click", () => {
    const url = prompt("Enter Image URL to share (e.g. /assets/aria.png):", "/assets/aria.png");
    if (!url) return;
    if (socket && state.currentDate) {
      socket.emit("send_msg", {
        dateId: state.currentDate.id,
        senderId: parseInt(state.userId),
        content: url,
        msgType: "image"
      });
    }
  });
}

// ==========================================
// CORE CONTROLLER LOGIC
// ==========================================

function resetQueueUI() {
  document.getElementById("btn-join-queue").classList.remove("hidden");
  document.getElementById("btn-leave-queue").classList.add("hidden");
  document.getElementById("queue-title").textContent = "Ready for a Blind Date?";
  document.getElementById("queue-desc").textContent = "Join the queue to match randomly with a student from an inter-college campus. You will chat anonymously first!";
}

async function joinQueue() {
  try {
    const res = await fetch(`${API_BASE}/api/blind-date/join`, {
      method: "POST",
      headers: { "Authorization": `Bearer_${state.userId}` }
    });
    
    if (res.ok) {
      const data = await res.json();

      if (data.status === "matched" || data.status === "already_matched") {
        clearInterval(state.queueInterval);
        state.queueInterval = null;
        resetQueueUI();
        await checkActiveDate();
      }
    } else {
      if (res.status === 401) {
        clearInterval(state.queueInterval);
        state.queueInterval = null;
        logout();
      }
    }
  } catch (err) {
    console.error("Failed queue check", err);
  }
}

async function checkActiveDate() {
  try {
    const res = await fetch(`${API_BASE}/api/blind-date/current`, {
      headers: { "Authorization": `Bearer_${state.userId}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.date) {
        state.currentDate = data.date;
        state.currentPartner = data.partner;
        renderActiveDateScreen();
        navigateTo("page-active-date");
      } else {
        state.currentDate = null;
        state.currentPartner = null;
        navigateTo("page-dashboard");
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function renderActiveDateScreen() {
  const partner = state.currentPartner;
  const date = state.currentDate;
  
  if (!partner) return;

  // Header and image details
  document.getElementById("active-partner-codename").textContent = partner.name;
  
  const partnerImg = document.getElementById("active-partner-img");
  const blurOverlay = document.getElementById("blur-overlay");
  
  if (date.status === "revealed") {
    partnerImg.src = partner.imageUrl;
    partnerImg.classList.remove("blurred");
    blurOverlay.classList.add("hidden");
  } else {
    partnerImg.src = "/assets/user_placeholder.png";
    partnerImg.classList.add("blurred");
    blurOverlay.classList.remove("hidden");
  }

  document.getElementById("active-partner-college").textContent = partner.college;
  document.getElementById("active-partner-age").textContent = partner.age;
  document.getElementById("active-partner-gender").textContent = partner.gender;
  document.getElementById("active-partner-course").textContent = partner.course;
  document.getElementById("active-partner-bio").textContent = partner.bio;

  // Photos Gallery Grid
  const photosGrid = document.getElementById("active-partner-photos-grid");
  if (photosGrid) {
    photosGrid.innerHTML = "";
    const urls = partner.imageUrls || [partner.imageUrl];
    urls.forEach(url => {
      const img = document.createElement("img");
      img.className = "profile-photo-thumb";
      img.src = url;
      if (date.status !== "revealed") {
        img.style.filter = "blur(16px)";
      }
      photosGrid.appendChild(img);
    });
  }

  // Prompts
  const container = document.getElementById("active-prompts-container");
  container.innerHTML = "";
  if (partner.prompts && partner.prompts.length > 0) {
    partner.prompts.forEach(p => {
      const card = document.createElement("div");
      card.className = "prompt-card";
      card.innerHTML = `
        <div class="prompt-card-q">${p.question}</div>
        <div class="prompt-card-a">${p.answer}</div>
      `;
      container.appendChild(card);
    });
  }
}

async function openChatScreen() {
  if (!state.currentDate) return;
  
  // Set partner header details
  const partnerName = document.getElementById("chat-partner-name");
  const partnerAvatar = document.getElementById("chat-partner-avatar");
  
  partnerName.textContent = state.currentPartner.name;
  
  if (state.currentDate.status === "revealed") {
    partnerAvatar.src = state.currentPartner.imageUrl;
    partnerAvatar.classList.remove("blurred");
  } else {
    partnerAvatar.src = "/assets/user_placeholder.png";
    partnerAvatar.classList.add("blurred");
  }

  // Join Room
  if (socket) {
    socket.emit("join_room", { dateId: state.currentDate.id });
  }

  // Fetch Message history
  try {
    const res = await fetch(`${API_BASE}/api/blind-date/${state.currentDate.id}/messages`);
    if (res.ok) {
      state.messages = await res.json();
      renderMessages();
      updateRevealProgress();
    }
  } catch (err) {
    console.error(err);
  }

  navigateTo("page-chat");
  startChatTimer();
}

function renderMessages() {
  const container = document.getElementById("chat-messages-container");
  container.innerHTML = "";
  state.messages.forEach(msg => {
    appendMessage(msg, false);
  });
  scrollChatToBottom();
}

function appendMessage(msg, scroll = true) {
  const container = document.getElementById("chat-messages-container");
  const div = document.createElement("div");
  const isMe = msg.sender_id === parseInt(state.userId);
  
  if (msg.msg_type === 'image') {
    div.className = `msg msg-img ${isMe ? "msg-sent" : "msg-received"}`;
    const img = document.createElement("img");
    img.src = msg.content;
    img.alt = "Shared Image";
    img.onload = () => { if (scroll) scrollChatToBottom(); };
    div.appendChild(img);
  } else {
    div.className = `msg ${isMe ? "msg-sent" : "msg-received"}`;
    div.textContent = msg.content;
  }
  container.appendChild(div);

  if (scroll) {
    scrollChatToBottom();
  }
}

function scrollChatToBottom() {
  const container = document.getElementById("chat-messages-container");
  container.scrollTop = container.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById("chat-message-input");
  const content = input.value.trim();
  if (!content || !state.currentDate) return;

  const data = {
    dateId: state.currentDate.id,
    senderId: parseInt(state.userId),
    content: content
  };

  if (socket) {
    socket.emit("send_msg", data);
  }
  input.value = "";
}

function updateRevealProgress() {
  const mySentMessagesCount = state.messages.filter(m => m.sender_id === parseInt(state.userId)).length;
  const partnerMessagesCount = state.messages.filter(m => m.sender_id !== parseInt(state.userId)).length;
  
  const totalExchange = mySentMessagesCount + partnerMessagesCount;
  const limit = 10; // Demo mode: 10 messages total (5 each) to unlock reveal!
  const percentage = Math.min((totalExchange / limit) * 100, 100);
  
  const bar = document.getElementById("reveal-progress-bar");
  const label = document.getElementById("reveal-progress-text");
  
  if (bar && label) {
    bar.style.width = `${percentage}%`;
    if (totalExchange >= limit) {
      label.textContent = "Profile Unlock Available! Click 'Reveal' above.";
      label.style.color = "#ffaa00";
    } else {
      label.textContent = `${totalExchange} / ${limit} messages exchanged to Unlock Reveal`;
      label.style.color = "";
    }
  }
}

function startChatTimer() {
  clearInterval(state.timerInterval);
  const countdown = document.getElementById("chat-countdown");
  
  let totalSeconds = 24 * 60 * 60; // 24 hours
  
  state.timerInterval = setInterval(() => {
    totalSeconds--;
    if (totalSeconds <= 0) {
      clearInterval(state.timerInterval);
      countdown.textContent = "00:00:00";
      return;
    }
    
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    countdown.textContent = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }, 1000);
}

function logout() {
  localStorage.removeItem("campfire_token");
  localStorage.removeItem("campfire_userid");
  state.token = null;
  state.userId = null;
  state.profile = null;
  state.currentDate = null;
  state.currentPartner = null;
  state.messages = [];
  
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  clearInterval(state.timerInterval);
  clearInterval(state.queueInterval);
  
  navigateTo("page-login");
  
  // Reset fields
  document.getElementById("phone-input").value = "";
  document.getElementById("otp-input").value = "";
  document.getElementById("otp-wrapper").classList.add("hidden");
  document.getElementById("btn-send-otp").classList.remove("hidden");
  document.getElementById("btn-send-otp").disabled = false;
  document.getElementById("onboarding-form").reset();
  document.getElementById("step-1").classList.remove("hidden");
  document.getElementById("step-2").classList.add("hidden");
}

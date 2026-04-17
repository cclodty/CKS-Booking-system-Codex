const ROOMS = [
  { id: "120", category: "special", label: "功能室" },
  { id: "219", category: "classroom", label: "課室" },
  { id: "320", category: "classroom", label: "課室" },
  { id: "library-a", category: "special", name: "圖書館會議室", label: "功能室 - A" },
  { id: "library-b", category: "special", name: "圖書館會議室", label: "功能室 - B" },
  { id: "music", category: "special", name: "音樂室", label: "功能室" },
  { id: "art", category: "special", name: "美術室", label: "功能室" }
];

const SLOTS = [
  { key: "第1節", value: "8:30-9:10" },
  { key: "第2節", value: "9:20-10:00" },
  { key: "第3節", value: "10:05-10:45" },
  { key: "第4節", value: "10:50-11:35" },
  { key: "第5節", value: "11:40-12:20" },
  { key: "第6節", value: "14:00-14:40" },
  { key: "第7節", value: "14:45-15:30" },
  { key: "第8節", value: "15:35-16:15" }
];

const STORAGE_KEY = "cks_booking_mock_records_v2";
const today = new Date().toISOString().slice(0, 10);

const state = {
  selectedDate: today,
  selectedRoomId: "120",
  filter: "all",
  query: "",
  selectedSlot: null,
  adminLoggedIn: false,
  adminTab: "records",
  mode: "mock"
};

const el = {
  selectedDate: document.getElementById("selectedDate"),
  roomList: document.getElementById("roomList"),
  roomCount: document.getElementById("roomCount"),
  roomSearch: document.getElementById("roomSearch"),
  selectedRoomTitle: document.getElementById("selectedRoomTitle"),
  slotGrid: document.getElementById("slotGrid"),
  bookingDialog: document.getElementById("bookingDialog"),
  bookingSummary: document.getElementById("bookingSummary"),
  closeDialog: document.getElementById("closeDialog"),
  confirmForm: document.getElementById("confirmForm"),
  myNameInput: document.getElementById("myNameInput"),
  myBookingRows: document.getElementById("myBookingRows"),
  searchMyBookings: document.getElementById("searchMyBookings"),
  adminRows: document.getElementById("adminRows"),
  adminLoginBtn: document.getElementById("adminLoginBtn"),
  adminLogoutBtn: document.getElementById("adminLogoutBtn"),
  adminSession: document.getElementById("adminSession"),
  weekStart: document.getElementById("weekStart"),
  printRoomChecks: document.getElementById("printRoomChecks"),
  printPreview: document.getElementById("printPreview")
};

function safeName(room) {
  return room.name || room.id;
}

function getMockRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setMockRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createBookingId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `b_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createMockStore() {
  return {
    mode: "mock",
    async listBookings() {
      return getMockRecords().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    },
    async listFutureBookings() {
      return getMockRecords().filter((item) => item.date >= today);
    },
    async listByName(name) {
      const kw = name.toLowerCase();
      return getMockRecords().filter((item) => item.date >= today && item.booker.toLowerCase() === kw);
    },
    async hasConflict(date, roomId, time) {
      return getMockRecords().some((item) => item.date === date && item.roomId === roomId && item.time === time);
    },
    async addBooking(payload) {
      const records = getMockRecords();
      records.push(payload);
      setMockRecords(records);
    },
    async deleteBooking(id) {
      const records = getMockRecords().filter((item) => item.id !== id);
      setMockRecords(records);
    }
  };
}

async function createFirebaseStore() {
  const firebaseModule = await import("./firebase.js");
  const firestore = await import("https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js");
  const { db } = firebaseModule;
  const { collection, addDoc, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } = firestore;

  return {
    mode: "firebase",
    async listBookings() {
      const snap = await getDocs(query(collection(db, "bookings"), orderBy("date", "asc")));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async listFutureBookings() {
      const snap = await getDocs(query(collection(db, "bookings"), orderBy("date", "asc")));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.date >= today)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    },
    async listByName(name) {
      const normalized = name.toLowerCase();
      const snap = await getDocs(query(collection(db, "bookings"), orderBy("date", "asc")));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.date >= today && String(item.booker || "").toLowerCase() === normalized)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    },
    async hasConflict(date, roomId, time) {
      const snap = await getDocs(query(collection(db, "bookings"), orderBy("date", "asc")));
      return snap.docs
        .map((d) => d.data())
        .some((item) => item.date === date && item.roomId === roomId && item.time === time);
    },
    async addBooking(payload) {
      await addDoc(collection(db, "bookings"), { ...payload, createdAt: serverTimestamp() });
    },
    async deleteBooking(id) {
      await deleteDoc(doc(db, "bookings", id));
    }
  };
}

async function initStore() {
  try {
    return await createFirebaseStore();
  } catch (error) {
    console.warn("Firebase unavailable, using mock store", error);
    return createMockStore();
  }
}

function renderRooms() {
  const filtered = ROOMS.filter((room) => {
    const categoryMatched = state.filter === "all" || room.category === state.filter;
    const textMatched = `${room.id} ${safeName(room)}`.toLowerCase().includes(state.query.toLowerCase());
    return categoryMatched && textMatched;
  });

  el.roomCount.textContent = filtered.length;
  el.roomList.innerHTML = filtered
    .map((room) => {
      const active = room.id === state.selectedRoomId ? "active" : "";
      return `<button class="room-item ${active}" data-room-id="${room.id}">
        <strong>${safeName(room)}</strong>
        <small>${room.label}</small>
      </button>`;
    })
    .join("");

  const selected = ROOMS.find((room) => room.id === state.selectedRoomId);
  el.selectedRoomTitle.textContent = safeName(selected);
}

async function renderSlots(store) {
  const slotsHtml = await Promise.all(
    SLOTS.map(async (slot) => {
      const time = `${slot.key} ${slot.value}`;
      const conflicted = await store.hasConflict(state.selectedDate, state.selectedRoomId, time);
      return `<button class="slot-card ${conflicted ? "conflict" : ""}" data-slot-time="${time}" ${
        conflicted ? "disabled" : ""
      }>
        <div>🕒</div><div>${time}</div><span>${conflicted ? "已預約" : "可預約"}</span>
      </button>`;
    })
  );
  el.slotGrid.innerHTML = slotsHtml.join("");
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.id === viewId));
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === viewId));
}

async function renderMyBookings(store) {
  const name = el.myNameInput.value.trim();
  if (!name) {
    el.myBookingRows.innerHTML = `<tr><td colspan="5" class="empty">請在上方輸入姓名並點擊查詢</td></tr>`;
    return;
  }

  const rows = await store.listByName(name);
  if (!rows.length) {
    el.myBookingRows.innerHTML = `<tr><td colspan="5" class="empty">找不到符合條件的預約記錄</td></tr>`;
    return;
  }

  el.myBookingRows.innerHTML = rows
    .map((item) => `<tr><td>${item.date}</td><td>${item.time}</td><td>${item.roomName}</td><td>${item.booker} / ${item.purpose}</td><td>—</td></tr>`)
    .join("");
}

async function renderAdminRecords(store) {
  const rows = await store.listFutureBookings();
  if (!rows.length) {
    el.adminRows.innerHTML = `<tr><td colspan="6" class="empty">目前沒有未來預約資料</td></tr>`;
    return;
  }

  el.adminRows.innerHTML = rows
    .map((item) => `<tr>
      <td>${item.date}</td>
      <td>${item.time}</td>
      <td>${item.roomName}</td>
      <td>${item.booker}</td>
      <td>${item.purpose}</td>
      <td><button class="danger" data-delete-id="${item.id}">刪除</button></td>
    </tr>`)
    .join("");
}

function renderPrintRoomChecks() {
  el.printRoomChecks.innerHTML = ROOMS.map((room) => `<label><input type="checkbox" value="${room.id}" /> ${safeName(room)}</label>`).join("");
}

function refreshPrintPreview() {
  const checked = [...el.printRoomChecks.querySelectorAll("input:checked")].map((box) => box.value);
  el.printPreview.textContent = checked.length ? `已選擇課室：${checked.join("、")}（後續可接真實列印格式）` : "請至少勾選一個課室進行預覽與列印";
}

function buildSummary(slotOrTime) {
  const room = ROOMS.find((item) => item.id === state.selectedRoomId);
  return `
    <div><span>起始預約日期</span><strong>${state.selectedDate}</strong></div>
    <div><span>選擇時段</span><strong>${slotOrTime}</strong></div>
    <div><span>課室名稱</span><strong>${safeName(room)}</strong></div>
  `;
}

function parseCustomTime() {
  const start = document.getElementById("customStart").value;
  const end = document.getElementById("customEnd").value;
  if (!start || !end || start >= end) return null;
  return `${start}-${end}`;
}

function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function initApp() {
  const store = await initStore();
  state.mode = store.mode;

  el.selectedDate.value = today;
  el.selectedDate.min = today;
  el.weekStart.value = startOfWeek(new Date());

  renderRooms();
  await renderSlots(store);
  renderPrintRoomChecks();
  refreshPrintPreview();
  await renderAdminRecords(store);

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("admin-only") && !state.adminLoggedIn) return;
      switchView(btn.dataset.view);
    });
  });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.filter = btn.dataset.filter;
      document.querySelectorAll(".seg-btn").forEach((node) => node.classList.remove("active"));
      btn.classList.add("active");
      renderRooms();
    });
  });

  el.roomSearch.addEventListener("input", () => {
    state.query = el.roomSearch.value;
    renderRooms();
  });

  el.roomList.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-room-id]");
    if (!target) return;
    state.selectedRoomId = target.dataset.roomId;
    renderRooms();
    await renderSlots(store);
  });

  el.selectedDate.addEventListener("change", async () => {
    state.selectedDate = el.selectedDate.value;
    await renderSlots(store);
  });

  el.slotGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-slot-time]");
    if (!target) return;
    state.selectedSlot = target.dataset.slotTime;
    el.bookingSummary.innerHTML = buildSummary(state.selectedSlot);
    el.bookingDialog.showModal();
  });

  document.getElementById("customBookBtn").addEventListener("click", () => {
    const range = parseCustomTime();
    if (!range) {
      alert("請輸入有效的開始與結束時間");
      return;
    }
    state.selectedSlot = range;
    el.bookingSummary.innerHTML = buildSummary(range);
    el.bookingDialog.showModal();
  });

  el.closeDialog.addEventListener("click", () => el.bookingDialog.close());

  el.confirmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const booker = document.getElementById("bookerName").value.trim();
    const purpose = document.getElementById("bookerPurpose").value.trim();
    if (!booker || !purpose) return;

    const room = ROOMS.find((item) => item.id === state.selectedRoomId);
    const conflict = await store.hasConflict(state.selectedDate, state.selectedRoomId, state.selectedSlot);
    if (conflict) {
      alert("該時段已被預約，請選擇其他時段");
      el.bookingDialog.close();
      await renderSlots(store);
      return;
    }

    await store.addBooking({
      id: createBookingId(),
      date: state.selectedDate,
      roomId: state.selectedRoomId,
      roomName: safeName(room),
      time: state.selectedSlot,
      booker,
      purpose,
      type: document.getElementById("bookingType").value,
      createdBy: state.mode
    });

    el.bookingDialog.close();
    el.confirmForm.reset();
    await renderSlots(store);
    await renderAdminRecords(store);
    alert("預約已送出");
  });

  el.searchMyBookings.addEventListener("click", () => renderMyBookings(store));

  el.adminLoginBtn.addEventListener("click", () => {
    state.adminLoggedIn = true;
    document.querySelector(".admin-only")?.classList.remove("hidden");
    el.adminLoginBtn.classList.add("hidden");
    el.adminSession.classList.remove("hidden");
    switchView("admin");
  });

  el.adminLogoutBtn.addEventListener("click", () => {
    state.adminLoggedIn = false;
    document.querySelector(".admin-only")?.classList.add("hidden");
    el.adminLoginBtn.classList.remove("hidden");
    el.adminSession.classList.add("hidden");
    switchView("booking");
  });

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.adminTab = tab.dataset.adminTab;
      document.querySelectorAll(".admin-tab").forEach((node) => node.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".admin-view").forEach((node) => node.classList.toggle("active", node.id === `admin${state.adminTab[0].toUpperCase()}${state.adminTab.slice(1)}`));
    });
  });

  document.getElementById("refreshAdmin").addEventListener("click", () => renderAdminRecords(store));

  el.adminRows.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-delete-id]");
    if (!target) return;
    await store.deleteBooking(target.dataset.deleteId);
    await renderAdminRecords(store);
    await renderSlots(store);
  });

  document.getElementById("exportCsv").addEventListener("click", async () => {
    const rows = await store.listFutureBookings();
    const header = ["日期", "時間", "課室", "預約人", "用途"];
    const csv = [header.join(","), ...rows.map((item) => [item.date, item.time, item.roomName, item.booker, item.purpose].join(","))].join("\n");
    downloadCsv("booking_records.csv", csv);
  });

  document.getElementById("checkAllRooms").addEventListener("click", () => {
    el.printRoomChecks.querySelectorAll("input").forEach((box) => {
      box.checked = true;
    });
    refreshPrintPreview();
  });

  document.getElementById("uncheckAllRooms").addEventListener("click", () => {
    el.printRoomChecks.querySelectorAll("input").forEach((box) => {
      box.checked = false;
    });
    refreshPrintPreview();
  });

  el.printRoomChecks.addEventListener("change", refreshPrintPreview);

  document.getElementById("prevWeek").addEventListener("click", () => {
    const d = new Date(el.weekStart.value);
    d.setDate(d.getDate() - 7);
    el.weekStart.value = d.toISOString().slice(0, 10);
  });

  document.getElementById("nextWeek").addEventListener("click", () => {
    const d = new Date(el.weekStart.value);
    d.setDate(d.getDate() + 7);
    el.weekStart.value = d.toISOString().slice(0, 10);
  });

  document.getElementById("printBtn").addEventListener("click", () => window.print());
}

initApp();

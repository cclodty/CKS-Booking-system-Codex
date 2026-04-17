const form = document.getElementById("bookingForm");
const message = document.getElementById("formMessage");
const bookingRows = document.getElementById("bookingRows");
const refreshBtn = document.getElementById("refreshBtn");

const today = new Date().toISOString().slice(0, 10);
document.getElementById("date").min = today;

const STORAGE_KEY = "cks_booking_mock_records_v1";

function setMessage(text, type = "ok") {
  message.textContent = text;
  message.className = type;
}

function rowTemplate(item) {
  return `<tr>
    <td>${item.date}</td>
    <td>${item.slot}</td>
    <td>${item.resourceId}</td>
    <td>${item.applicantName}</td>
    <td>${item.email}</td>
    <td>${item.phone}</td>
  </tr>`;
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

function createMockStore() {
  return {
    mode: "mock",
    async hasConflict(resourceId, date, slot) {
      const records = getMockRecords();
      return records.some(
        (item) => item.resourceId === resourceId && item.date === date && item.slot === slot
      );
    },
    async addBooking(payload) {
      const records = getMockRecords();
      records.push({ ...payload, createdAt: Date.now() });
      setMockRecords(records);
    },
    async listBookings() {
      const records = getMockRecords();
      return records
        .filter((item) => item.date >= today)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.slot.localeCompare(b.slot);
        });
    }
  };
}

async function createFirebaseStore() {
  const firebaseModule = await import("./firebase.js");
  const firestoreModule = await import(
    "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js"
  );

  const { db } = firebaseModule;
  const { collection, addDoc, getDocs, orderBy, query, serverTimestamp, where, limit } =
    firestoreModule;

  return {
    mode: "firebase",
    async hasConflict(resourceId, date, slot) {
      const q = query(
        collection(db, "bookings"),
        where("resourceId", "==", resourceId),
        where("date", "==", date),
        where("slot", "==", slot),
        limit(1)
      );

      const snapshot = await getDocs(q);
      return !snapshot.empty;
    },
    async addBooking(payload) {
      await addDoc(collection(db, "bookings"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    },
    async listBookings() {
      const q = query(
        collection(db, "bookings"),
        where("date", ">=", today),
        orderBy("date", "asc"),
        orderBy("slot", "asc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => doc.data());
    }
  };
}

function setModeLabel(mode) {
  const subtitle = document.querySelector(".subtitle");
  if (!subtitle) return;

  if (mode === "firebase") {
    subtitle.textContent = "Firebase 後端版本（已連線）";
    return;
  }

  subtitle.textContent = "預覽模式（LocalStorage 模擬資料）";
}

async function initStore() {
  try {
    const firebaseStore = await createFirebaseStore();
    setModeLabel(firebaseStore.mode);
    return firebaseStore;
  } catch (error) {
    console.warn("Firebase not configured; switched to preview mode.", error);
    const mockStore = createMockStore();
    setModeLabel(mockStore.mode);
    setMessage("目前是預覽模式（資料存本機瀏覽器）", "ok");
    return mockStore;
  }
}

async function initApp() {
  const store = await initStore();

  async function loadBookings() {
    bookingRows.innerHTML = `<tr><td colspan="6">讀取中...</td></tr>`;

    try {
      const rows = await store.listBookings();
      if (!rows.length) {
        bookingRows.innerHTML = `<tr><td colspan="6">目前沒有資料</td></tr>`;
        return;
      }

      bookingRows.innerHTML = rows.map((item) => rowTemplate(item)).join("");
    } catch (error) {
      console.error(error);
      bookingRows.innerHTML = `<tr><td colspan="6">讀取失敗</td></tr>`;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("送出中...", "ok");

    const payload = {
      date: document.getElementById("date").value,
      slot: document.getElementById("slot").value,
      resourceId: document.getElementById("resourceId").value,
      applicantName: document.getElementById("applicantName").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      note: document.getElementById("note").value.trim()
    };

    if (!payload.date || !payload.slot || !payload.resourceId) {
      setMessage("請完整填寫必填欄位", "err");
      return;
    }

    try {
      const conflict = await store.hasConflict(payload.resourceId, payload.date, payload.slot);
      if (conflict) {
        setMessage("該場地此時段已被預約，請改選其他時段", "err");
        return;
      }

      await store.addBooking(payload);
      setMessage("預約成功", "ok");
      form.reset();
      await loadBookings();
    } catch (error) {
      console.error(error);
      setMessage("送出失敗，請檢查 Firebase 設定與規則", "err");
    }
  });

  refreshBtn.addEventListener("click", loadBookings);
  await loadBookings();
}

initApp();

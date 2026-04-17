# CKS Booking System (Firebase 版本草案)

這個專案是「仿製學校預約系統 UI + 改用 Firebase 作為後端」的第一版骨架。
目前先完成：

- 基礎預約頁面（日期、時段、場地、申請者資料）
- Firestore 寫入預約資料
- Firestore 讀取今日之後的預約清單
- 衝突檢查（同場地+同日期+同時段不可重複）
- **無 Firebase 設定時可用預覽模式（localStorage）**

> 由於原始站點目前無法直接連線取得頁面內容（403），此版先提供可運作的近似預約流程，後續可再依你指定的細節逐步微調成更接近原系統。

## 先看成果（不用 Firebase）

1. 在專案根目錄執行：
   ```bash
   python3 -m http.server 5500
   ```
2. 打開瀏覽器進入：
   `http://localhost:5500`
3. 頁面副標題若顯示「預覽模式（LocalStorage 模擬資料）」代表可直接試填表單。

## 接上 Firebase（正式資料）

1. 建立 Firebase 專案，啟用 Firestore。
2. 複製 `src/firebase.example.js` 成 `src/firebase.js`，填入你的 Firebase 設定。
3. 重新整理頁面。
4. 頁面副標題顯示「Firebase 後端版本（已連線）」即代表已接上 Firestore。

## Firestore 結構

Collection: `bookings`

文件欄位：
- `resourceId` (string)
- `date` (string, YYYY-MM-DD)
- `slot` (string)
- `applicantName` (string)
- `email` (string)
- `phone` (string)
- `note` (string)
- `createdAt` (serverTimestamp)

## Firestore 安全規則（開發期示例）

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bookings/{bookingId} {
      allow read, write: if true;
    }
  }
}
```

上線前請改成嚴格規則（例如需登入、限制欄位格式與可寫入範圍）。

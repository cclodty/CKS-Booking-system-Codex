# CKS Booking System Clone（Firebase + Preview Mode）

此版本是依照你提供的截圖重建的前端架構，支援：

- `預約課室`（日期、課室清單、節次卡、自訂時間段、確認彈窗）
- `我的預約`（按姓名查詢）
- `時間表列印`（一週起始日、課室勾選、預覽/列印）
- `管理後台`（預約記錄、帳戶管理 UI、CSV 匯出、刪除）
- Firebase Firestore 優先 + 無設定時 LocalStorage fallback

---

## 快速預覽（不需 Firebase）

```bash
python3 -m http.server 5500
```

開啟：`http://localhost:5500`

若未設定 `src/firebase.js`，系統會自動進入 LocalStorage 預覽模式。

---

## 啟用 Firebase

1. 在 Firebase 建立專案並啟用 Firestore。
2. 複製 `src/firebase.example.js` 為 `src/firebase.js`。
3. 填入你的 Firebase 專案設定。
4. 重新整理頁面。

> `src/firebase.js` 已在 `.gitignore`，不會被提交到 Git。

---

## GitHub Actions / GitHub Pages 部署檢查

部署後若頁面有功能但查詢/預約報錯，先檢查：

- Firestore 規則是否允許讀寫（開發期可先放寬）
- 瀏覽器 Console 是否有 Firebase 欄位或權限錯誤
- 是否漏了 `src/firebase.js`（這個檔案需在部署流程中自行提供）

---

## 如果你在清理舊版本時弄亂了（重置到最新工作版本）

> 以下命令會覆蓋你本機未提交變更，請先確認。

```bash
git fetch origin
git checkout work
git reset --hard origin/work
```

如果你是要把 `main` 直接更新為 `work`：

```bash
git checkout main
git reset --hard origin/work
git push --force-with-lease origin main
```

---

## 開發期 Firestore 規則（示例）

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

上線前請改成正式權限規則（登入、欄位驗證、角色限制）。

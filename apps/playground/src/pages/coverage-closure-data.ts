export interface ClosureExample {
  id: string;
  title: string;
  summary: string;
  persistence: 'memory' | 'visual' | 'contract';
  fixture: string;
  outcome: string;
  evidence: string[];
  testName: string;
  command: string;
}
export const CLOSURE_EXAMPLES: ClosureExample[] = [
  {
    id: 'lifecycle.save-reload',
    title: '資源儲存與重開',
    summary: '普通 Resource create/edit/store/update 的儲存、重開與安全 urls。',
    persistence: 'contract',
    fixture:
      'POST /admin/resource-orders，values.number=TEST20；再 PUT 同一 id，number=UPDATED、customer=Bob。',
    outcome:
      '回應提供 id 與安全 urls.edit；GET edit 的 formId=brume.resource-orders；更新後 number=UPDATED。',
    evidence: [
      'brume-laravel:src/Resource/Resource.php',
      'brume-laravel:tests/Feature/Form/ResourceTest.php',
    ],
    testName: 'stores and updates using stable form identity and safe URLs',
    command:
      'vendor/bin/pest tests/Feature/Form/ResourceTest.php --filter="stores and updates using stable form identity and safe URLs"',
  },
  {
    id: 'lifecycle.readonly',
    title: '唯讀權威值',
    summary: '讀取鎖定根與對應 owner 後決定 readOnly；偽造 scalar/關聯值不覆寫權威值。',
    persistence: 'contract',
    fixture: '既有 status=open 且 readOnly，提交 status=paid、customer=forged。',
    outcome: '權威 status 仍為 open，依賴 paid 的 customer 不進入可寫值。',
    evidence: [
      'brume-laravel:src/Form/FormSaver.php',
      'brume-laravel:tests/Feature/Form/DeclarativeTest.php',
    ],
    testName: 'uses authoritative readonly controls and strips inactive forged values',
    command:
      'vendor/bin/pest tests/Feature/Form/DeclarativeTest.php --filter="uses authoritative readonly controls and strips inactive forged values"',
  },
  {
    id: 'lifecycle.inactive',
    title: '非作用中欄位保留',
    summary:
      'inactive 欄位／關聯保留既有資料，不寫隱藏草稿；invalid controlling value 不逃避驗證。',
    persistence: 'contract',
    fixture: '關聯條件 inactive，提交含外部來源 id 的關聯草稿。',
    outcome:
      '隱藏關聯維持原值；無效控制值不能藉隱藏逃避驗證，另見 DeclarativeTest conservative activity。',
    evidence: [
      'brume-laravel:src/Form/FormValidator.php',
      'brume-laravel:tests/Feature/Form/RelationsTest.php',
    ],
    testName: 'ignores inactive relation input including foreign identities',
    command:
      'vendor/bin/pest tests/Feature/Form/RelationsTest.php --filter="ignores inactive relation input including foreign identities"',
  },
  {
    id: 'lifecycle.password',
    title: '密碼空白與雜湊',
    summary: '空白密碼保留原值、hashed cast；編輯回應不回傳既有密碼。',
    persistence: 'contract',
    fixture: '先提交 new-secret，再提交 password 空字串；model 使用 hashed cast。',
    outcome: 'Hash::check 成功；第二次不呼叫 writer、不覆寫雜湊；Password valueFor 不回傳原密碼。',
    evidence: [
      'brume-laravel:src/Form/Fields/Password.php',
      'brume-laravel:tests/Feature/Form/HooksTest.php',
    ],
    testName: 'honors hashed casts and never writes empty passwords through a custom writer',
    command:
      'vendor/bin/pest tests/Feature/Form/HooksTest.php --filter="honors hashed casts and never writes empty passwords through a custom writer"',
  },
  {
    id: 'lifecycle.exact-values',
    title: '精確數值與日期',
    summary:
      'decimal/currency 精確字串、Date/Datetime normalization、dateRange 起迄欄位清除與 omitted 保留。',
    persistence: 'contract',
    fixture:
      'amount=99999999999999.10，period.start=2026-10-31T12:30，period.end=2026-11-01T14:00。',
    outcome:
      '金額保持字串；時間存為 2026-10-31 12:30:00；整段 null 清除起迄，省略欄位保留，見同檔 range cases。',
    evidence: [
      'brume-laravel:src/Form/Fields/Decimal.php',
      'brume-laravel:tests/Feature/Form/HooksTest.php',
    ],
    testName: 'preserves embedded siblings and fixed point strings and maps date ranges',
    command:
      'vendor/bin/pest tests/Feature/Form/HooksTest.php --filter="preserves embedded siblings and fixed point strings and maps date ranges"',
  },
  {
    id: 'lifecycle.embeds',
    title: '嵌入 JSON 保留',
    summary: 'JSON embeds 保留未宣告 siblings，只寫 declared 值；必要 cast 與 mapped attributes。',
    persistence: 'contract',
    fixture: 'meta 既有 color=old、locked=keep、unknown=keep；送 color=red 並偽造 siblings。',
    outcome: '只更新宣告可編輯 color；locked 與 unknown 保持 keep，需 JSON cast。',
    evidence: [
      'brume-laravel:src/Form/Fields/Field.php',
      'brume-laravel:tests/Feature/Form/HooksTest.php',
    ],
    testName: 'preserves embedded siblings and fixed point strings and maps date ranges',
    command:
      'vendor/bin/pest tests/Feature/Form/HooksTest.php --filter="preserves embedded siblings and fixed point strings and maps date ranges"',
  },
  {
    id: 'lifecycle.custom-mapping',
    title: '自訂欄位映射',
    summary:
      'attribute/attributes/value/saveUsing/childRules，複合地址無 carrier 欄位；未知 key 拒絕。',
    persistence: 'contract',
    fixture:
      'address={zipcode:100,county:Taipei,district:Zhongzheng,address:Road} 映射 customer/status/note/password。',
    outcome:
      '資料寫入映射欄位，無 address carrier 欄；隱藏 password 回讀 null；未知 admin key 拒絕。',
    evidence: [
      'brume-laravel:src/Form/Fields/CustomField.php',
      'brume-laravel:tests/Feature/Form/DeclarativeTest.php',
    ],
    testName: 'maps a custom object to declared attributes without a carrier column',
    command:
      'vendor/bin/pest tests/Feature/Form/DeclarativeTest.php --filter="maps a custom object to declared attributes without a carrier column"',
  },
  {
    id: 'lifecycle.unique-server-rules',
    title: '伺服器驗證規則',
    summary: 'unique/Closure/rules/messages 的 server-only422，不假裝全部規則是 ClientRule。',
    persistence: 'contract',
    fixture: '編輯既有記錄，用自己的 unique 欄位值，再使用另一記錄的相同值。',
    outcome:
      '自己的值允許，重複值回 422；Closure rules/messages 由伺服器執行，非所有規則都有 ClientRule。',
    evidence: [
      'brume-laravel:src/Form/Fields/Field.php',
      'brume-laravel:tests/Feature/Form/ValidationTest.php',
    ],
    testName: 'ignores the scoped editing record in unique validation',
    command:
      'vendor/bin/pest tests/Feature/Form/ValidationTest.php --filter="ignores the scoped editing record in unique validation"',
  },
  {
    id: 'lifecycle.belongs-to',
    title: '單筆所屬關聯',
    summary: '單選 assigns/clears 及 scoped identity 驗證，extras 寫對來源 owner。',
    persistence: 'contract',
    fixture: 'owner 指向 owned id，再提交 tenant=2 的 foreign id，最後提交 null。',
    outcome:
      'owned id 指派成功；foreign id 拒絕且原關聯不變；null 清除 owner_id；extras 寫入 scoped source。',
    evidence: [
      'brume-laravel:src/Form/Fields/RelationPicker.php',
      'brume-laravel:tests/Feature/Form/RelationsTest.php',
    ],
    testName: 'belongsTo assigns clears and rejects scoped foreign ids',
    command:
      'vendor/bin/pest tests/Feature/Form/RelationsTest.php --filter="belongsTo assigns clears and rejects scoped foreign ids"',
  },
  {
    id: 'lifecycle.has-many',
    title: '多筆直接關聯',
    summary: '直接關聯重新指派與移除歸零，不改 unrelated 資料。',
    persistence: 'contract',
    fixture: 'products 從 old 換成 other root 的 new；省略 products，再送空陣列。',
    outcome: 'new 指向目前 root、old 歸零；省略保留 new，空陣列清除；不修改其他資料。',
    evidence: [
      'brume-laravel:src/Form/Fields/RelationPicker.php',
      'brume-laravel:tests/Feature/Form/RelationsTest.php',
    ],
    testName: 'direct hasMany reassigns and nulls removed products',
    command:
      'vendor/bin/pest tests/Feature/Form/RelationsTest.php --filter="direct hasMany reassigns and nulls removed products"',
  },
  {
    id: 'lifecycle.pivot',
    title: '中樞資料與排序',
    summary: 'belongsToMany 的 pivot extras 與 orderColumn，保留未宣告 counter／alternate key。',
    persistence: 'contract',
    fixture: 'pivot quantity=3、sold=9，提交 quantity=7 並選第二筆 quantity=2。',
    outcome:
      '只改 declared quantity，sold 保留 9；orderColumn 另見 CompositionTest；alternate key 見同檔 round one pivot case。',
    evidence: [
      'brume-laravel:src/Form/Fields/RelationPicker.php',
      'brume-laravel:tests/Feature/Form/RelationsTest.php',
    ],
    testName: 'belongsToMany preserves selected pivot quantities and counters',
    command:
      'vendor/bin/pest tests/Feature/Form/RelationsTest.php --filter="belongsToMany preserves selected pivot quantities and counters"',
  },
  {
    id: 'lifecycle.intermediary',
    title: '中介還原與身份',
    summary: 'associateBy/restoreRemoved 保留中介 id/counter，移除再加入還原，歷史歧義原子拒絕。',
    persistence: 'contract',
    fixture: '既有 gift sold=17；先 gifts=[]，再選同商品 quantity=4 並偽造 sold=0。',
    outcome: '恢復同一 gift id，sold 仍 17、quantity=4；歷史重複關聯整批拒絕。',
    evidence: [
      'brume-laravel:src/Form/Fields/RelationPicker.php',
      'brume-laravel:tests/Feature/Form/RelationsTest.php',
    ],
    testName: 'intermediary restore preserves identity and counters',
    command:
      'vendor/bin/pest tests/Feature/Form/RelationsTest.php --filter="intermediary restore preserves identity and counters"',
  },
  {
    id: 'lifecycle.repeater-sync',
    title: '重複列同步',
    summary:
      'relation repeater orderColumn、新增／刪除／重排原地更新 id；JSON 穩定 key 及 legacy identity。',
    persistence: 'contract',
    fixture: '四層 children repeater 帶穩定 _brume.key；重新排序並修改 leaf。',
    outcome:
      '關聯列保留 id、position 更新；JSON legacy identity 見 DeclarativeTest reorder/reload case。',
    evidence: [
      'brume-laravel:src/Form/Fields/Repeater.php',
      'brume-laravel:tests/Feature/Form/RelationsTest.php',
    ],
    testName: 'four level repeater updates in place and orders on create and edit',
    command:
      'vendor/bin/pest tests/Feature/Form/RelationsTest.php --filter="four level repeater updates in place and orders on create and edit"',
  },
  {
    id: 'lifecycle.atomic-graph',
    title: '原子關聯圖',
    summary: '深層失敗整圖回滾；foreign id、duplicate key/id、mixed connections 在寫入前拒絕。',
    persistence: 'contract',
    fixture: '深層 children 出現無效值，或最後 child 使用 foreign id。',
    outcome:
      'ValidationException 後所有 siblings 與 root 維持原值；duplicate key/id、mixed connections 亦在 mutation 前拒絕。',
    evidence: [
      'brume-laravel:src/Form/Relations/RelationPlanner.php',
      'brume-laravel:tests/Feature/Form/RelationsTest.php',
    ],
    testName: 'nested failure rolls back all rows',
    command:
      'vendor/bin/pest tests/Feature/Form/RelationsTest.php --filter="nested failure rolls back all rows"',
  },
  {
    id: 'lifecycle.options-authority',
    title: '選項來源權威',
    summary:
      'OptionSource label/depth/search/columns/sections、dependOn 與已選 hydration 依權威 owner；bounded lookup。',
    persistence: 'contract',
    fixture: '同一 scoped OptionSource 執行 search 與已選 ids hydration。',
    outcome:
      '查詢保持 scope 與原 query；回 label/depth；分段、dependOn 與 owner 權威見同檔 nested cases。',
    evidence: [
      'brume-laravel:src/Options/OptionSource.php',
      'brume-laravel:tests/Feature/Form/OptionsTest.php',
    ],
    testName: 'source search and hydration preserve scope and clone queries',
    command:
      'vendor/bin/pest tests/Feature/Form/OptionsTest.php --filter="source search and hydration preserve scope and clone queries"',
  },
  {
    id: 'lifecycle.creating',
    title: '建立初始化',
    summary: 'creating callback 初始化新資源欄位。',
    persistence: 'contract',
    fixture:
      '新 User 表單宣告 creating/submitted/saving/saved，提交 username=new、password=secret、name=New。',
    outcome:
      '呼叫順序 creating → submitted → saving → saved；creating 可設定表單宣告與新資源初始值。',
    evidence: ['brume-laravel:src/Form/Form.php', 'brume-laravel:tests/Feature/Form/SaveTest.php'],
    testName: 'orders lifecycle hooks and merges saved feedback and safe urls',
    command:
      'vendor/bin/pest tests/Feature/Form/SaveTest.php --filter="orders lifecycle hooks and merges saved feedback and safe urls"',
  },
  {
    id: 'lifecycle.editing',
    title: '編輯初始化',
    summary: 'editing callback render 與鎖定 save 各初始化一次，使用更新後權威值。',
    persistence: 'contract',
    fixture: '同一 edit form 呼叫 toSchema 兩次，再 save 空 values。',
    outcome: 'render editing 次數 1；鎖定 save 後累計 2，權威值以鎖定根為準。',
    evidence: ['brume-laravel:src/Form/Form.php', 'brume-laravel:tests/Feature/Form/HooksTest.php'],
    testName: 'initializes editing once for rendering and again with the locked root for save',
    command:
      'vendor/bin/pest tests/Feature/Form/HooksTest.php --filter="initializes editing once for rendering and again with the locked root for save"',
  },
  {
    id: 'lifecycle.submitted',
    title: '提交前取消',
    summary: 'submitted 在驗證前可取消並回傳 feedback；不得假成功。',
    persistence: 'contract',
    fixture: 'submitted 回 Feedback::toast(error,Stop)->redirect(/safe)，提交 name=Changed。',
    outcome: 'cancelled=true，沒有 id；資料仍為管理員，不宣稱儲存成功。',
    evidence: ['brume-laravel:src/Form/Form.php', 'brume-laravel:tests/Feature/Form/SaveTest.php'],
    testName: 'cancels before validation or inside the transaction',
    command:
      'vendor/bin/pest tests/Feature/Form/SaveTest.php --filter="cancels before validation or inside the transaction"',
  },
  {
    id: 'lifecycle.saving',
    title: '交易內儲存',
    summary: 'saving 在 transaction 內調整 values 或取消，改圖仍需驗證。',
    persistence: 'contract',
    fixture: 'saving callback 先寫入 side effect，再回取消 Feedback。',
    outcome: '取消發生於 transaction 內，資料庫副作用回滾；改過的 graph 仍需再驗證。',
    evidence: ['brume-laravel:src/Form/Form.php', 'brume-laravel:tests/Feature/Form/HooksTest.php'],
    testName: 'rolls back database side effects made by a cancelling saving hook',
    command:
      'vendor/bin/pest tests/Feature/Form/HooksTest.php --filter="rolls back database side effects made by a cancelling saving hook"',
  },
  {
    id: 'lifecycle.saved',
    title: '儲存後回饋',
    summary: 'saved 可合併 feedback，失敗回滾；安全 redirect/urls 優先順序。',
    persistence: 'contract',
    fixture: 'saved callback 拋 total=Invalid total 的 ValidationException。',
    outcome:
      '回 422 並保留 total 錯誤；原名稱管理員不變；成功回饋合併與安全 urls 見同檔 hook ordering。',
    evidence: ['brume-laravel:src/Form/Form.php', 'brume-laravel:tests/Feature/Form/SaveTest.php'],
    testName: 'rolls back writes when saved validation fails',
    command:
      'vendor/bin/pest tests/Feature/Form/SaveTest.php --filter="rolls back writes when saved validation fails"',
  },
  {
    id: 'lifecycle.deleting',
    title: '刪除前取消',
    summary: 'deleting hook 可取消整批刪除並回滾。',
    persistence: 'contract',
    fixture: '刪除兩筆；第二筆 deleting 回 cancelled Feedback。',
    outcome: '整批 rows 與 files 保留，提交後不清檔；第一筆已執行 deleted 也被回滾。',
    evidence: [
      'brume-laravel:src/Resource/ResourceDeletion.php',
      'brume-laravel:tests/Feature/Form/ResourceTest.php',
    ],
    testName: 'cancels the entire batch on second row Feedback without running cleanup',
    command:
      'vendor/bin/pest tests/Feature/Form/ResourceTest.php --filter="cancels the entire batch on second row Feedback without running cleanup"',
  },
  {
    id: 'lifecycle.deleted',
    title: '刪除後結果',
    summary: 'deleted hook 與 model veto、檔案 cleanup 按 transaction 結果執行。',
    persistence: 'contract',
    fixture: 'deleted hook 拋例外，或 model deleting event veto。',
    outcome:
      '例外回 500 並回滾 rows/files；veto 的 row 不呼叫 deleted，同檔明確測試 partial behavior。',
    evidence: [
      'brume-laravel:src/Resource/ResourceDeletion.php',
      'brume-laravel:tests/Feature/Form/ResourceTest.php',
    ],
    testName: 'rolls the batch back when a deleted hook throws',
    command:
      'vendor/bin/pest tests/Feature/Form/ResourceTest.php --filter="rolls the batch back when a deleted hook throws"',
  },
  {
    id: 'lifecycle.upload-temp',
    title: '暫存上傳綁定',
    summary:
      'multipart token 綁 user/root/field/rowContext/ancestorSources，過期／重複 claim 拒絕。',
    persistence: 'contract',
    fixture: 'multipart 檔案取得 token，換 user/form/field/root 或使 token 過期後嘗試 claim。',
    outcome:
      '拒絕跨 owner 與過期 token；NestedUploadTest 補 rowContext/ancestorSources；重複 claim 不產生 finals。',
    evidence: [
      'brume-laravel:src/Uploads/UploadController.php',
      'brume-laravel:tests/Feature/Form/UploadTest.php',
    ],
    testName: 'isolates tokens across users guards forms fields root records and expiry',
    command:
      'vendor/bin/pest tests/Feature/Form/UploadTest.php --filter="isolates tokens across users guards forms fields root records and expiry"',
  },
  {
    id: 'lifecycle.upload-archive',
    title: '附件歸檔',
    summary: '成功儲存 token 歸檔到 disk/directory，回讀 path/url；MIME/size/extra rules 驗證。',
    persistence: 'contract',
    fixture: '提交屬於目前欄位的 temp token；在外層 transaction rollback，再以相同 token 重試。',
    outcome:
      '先歸檔至 declared disk/directory 再寫 path；回讀 path/url；MIME/size/extras 不符先拒絕。',
    evidence: [
      'brume-laravel:src/Uploads/UploadArchiver.php',
      'brume-laravel:tests/Feature/Form/UploadTest.php',
    ],
    testName:
      'archives before string persistence and retains temp through outer rollback and retry',
    command:
      'vendor/bin/pest tests/Feature/Form/UploadTest.php --filter="archives before string persistence and retains temp through outer rollback and retry"',
  },
  {
    id: 'lifecycle.upload-nested',
    title: '巢狀附件身份',
    summary: 'JSON/relation/picker/pivot 附件在重排後仍綁穩定 owner，source-owned 檔案不誤刪。',
    persistence: 'contract',
    fixture: '兩列 relation row，附件 token 綁其中一列；交換列順序再儲存。',
    outcome: '附件跟隨穩定 owner，非舊 index；pivot/JSON/source-owned 邊界見同檔其餘 cases。',
    evidence: [
      'brume-laravel:src/Uploads/UploadInventory.php',
      'brume-laravel:tests/Feature/Form/NestedUploadTest.php',
    ],
    testName: 'nested upload follows a stable relation row after reorder',
    command:
      'vendor/bin/pest tests/Feature/Form/NestedUploadTest.php --filter="nested upload follows a stable relation row after reorder"',
  },
  {
    id: 'lifecycle.upload-rollback',
    title: '附件交易回滾',
    summary: '外層 rollback 只清新 finals 並保留 temp 重試；commit 後才清舊檔。',
    persistence: 'contract',
    fixture: 'nested token 已複製 final，在外層 rollback 後重試同 token。',
    outcome: '只刪新 finals，temp 可再 claim；舊檔直到 durable commit 後才清理。',
    evidence: [
      'brume-laravel:src/Uploads/Support/UploadTransactions.php',
      'brume-laravel:tests/Feature/Form/NestedUploadTest.php',
    ],
    testName:
      'nested rollback removes only new finals and permits retry with unchanged temporary content',
    command:
      'vendor/bin/pest tests/Feature/Form/NestedUploadTest.php --filter="nested rollback removes only new finals and permits retry with unchanged temporary content"',
  },
  {
    id: 'lifecycle.upload-removal',
    title: '附件移除清理',
    summary:
      'replace/remove/hard delete 的 owned files commit 後清理；soft delete/source detach 保留。',
    persistence: 'contract',
    fixture: '移除 soft child 或 detach source-owned selection；另有 hard parent removal 案例。',
    outcome:
      'soft delete/source detach 保留 source files；owned descendants hard delete 僅在 commit 後清理。',
    evidence: [
      'brume-laravel:src/Uploads/StoredUploadCleanup.php',
      'brume-laravel:tests/Feature/Form/NestedUploadTest.php',
    ],
    testName: 'nested soft child removal and source detach retain source owned files',
    command:
      'vendor/bin/pest tests/Feature/Form/NestedUploadTest.php --filter="nested soft child removal and source detach retain source owned files"',
  },
  {
    id: 'lifecycle.form-transport',
    title: '表單傳輸協定',
    summary: 'X-Brume-Form JSON envelope/Vary、nested422、cancelled、可用 URL 與安全 redirect。',
    persistence: 'contract',
    fixture: 'GET create/edit 帶 X-Brume-Form:1；POST values、無效 nested 欄位、multipart upload。',
    outcome:
      'JSON envelope/submit/upload 皆通過公開 schema；422 使用點路徑；Vary 保留，unsafe redirect 拒絕。',
    evidence: [
      'brume-laravel:src/Resource/Resource.php',
      'brume-laravel:tests/Feature/Form/ProtocolContractTest.php',
    ],
    testName:
      'validates resource create edit submission validation and uploads against the public protocol',
    command:
      'vendor/bin/pest tests/Feature/Form/ProtocolContractTest.php --filter="validates resource create edit submission validation and uploads against the public protocol"',
  },
  {
    id: 'react.Alert',
    title: '訊息色調',
    summary: '比較 danger、warning、info、success 的標題與內容，再切換錯誤訊息。',
    persistence: 'visual',
    fixture: '比較 danger、warning、info、success 的標題與內容，再切換錯誤訊息。',
    outcome: '各 tone 可見，錯誤內容隨控制更新；role alert/status 可供輔助工具讀取。',
    evidence: [
      'brume-ui:packages/react/src/components/alert.tsx',
      'brume-ui:packages/react/src/components/alert.test.tsx',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'react.CompactTable',
    title: '內嵌明細',
    summary: '直接閱讀兩筆商品、quantity 與精確金額，無需先開啟隱藏欄位。',
    persistence: 'visual',
    fixture: '直接閱讀兩筆商品、quantity 與精確金額，無需先開啟隱藏欄位。',
    outcome: '表頭、caption 與兩筆值初始可見；物件用 JSON 字串顯示。',
    evidence: [
      'brume-ui:packages/react/src/components/compact-table.tsx',
      'brume-ui:packages/react/src/components/compact-table.test.tsx',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'react.Link',
    title: '安全連結與導覽',
    summary:
      '先點「記錄本範例導覽」查看 adapter 記錄，再點 Link 前往目錄或用 Ctrl/Cmd 點擊；核對安全 href 判定。',
    persistence: 'memory',
    fixture:
      '先點「記錄本範例導覽」查看 adapter 記錄，再點 Link 前往目錄或用 Ctrl/Cmd 點擊；核對安全 href 判定。',
    outcome:
      '一般點擊呼叫 adapter.visit 並到達有效目錄；修飾點擊交給瀏覽器。Link 本身不過濾 href，需呼叫 isSafeHref。',
    evidence: [
      'brume-ui:packages/react/src/components/link.tsx',
      'brume-ui:packages/react/src/components/link.test.tsx',
      'brume-ui:packages/react/src/http.test.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'react.LinkButton',
    title: '頁內連結外觀按鈕',
    summary: '按開啟明細，再關閉；此公開元件使用 button，不具有 href。',
    persistence: 'memory',
    fixture: '按開啟明細，再關閉；此公開元件使用 button，不具有 href。',
    outcome: '明細原地切換；連結目的地與修飾點擊由 Link 示範，不假設 LinkButton 是 anchor。',
    evidence: [
      'brume-ui:packages/react/src/components/link.tsx',
      'brume-ui:packages/react/src/components/link.test.tsx',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'react.ProgressBar',
    title: '可見進度與上限',
    summary: '調整進度，核對 value/max、百分比及超過 max 的截限。',
    persistence: 'memory',
    fixture: '調整進度，核對 value/max、百分比及超過 max 的截限。',
    outcome: 'value=25、max=80 初始為 31%；超過 max 時顯示 100%。',
    evidence: [
      'brume-ui:packages/react/src/components/progress-bar.tsx',
      'brume-ui:packages/react/src/components/progress-bar.test.tsx',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'react.StaticValue',
    title: '唯讀格式值',
    summary: '閱讀日期 2026-11-01、金額 NT$ 1,280.50 與多選 臺北、臺中。',
    persistence: 'visual',
    fixture: '閱讀日期 2026-11-01、金額 NT$ 1,280.50 與多選 臺北、臺中。',
    outcome: 'StaticValue 展示已格式化 children；不宣稱元件本身轉換日期或金額。',
    evidence: ['brume-ui:packages/react/src/components/static-value.tsx'],
    testName: '',
    command: '',
  },
  {
    id: 'react.FieldLayoutContext',
    title: '欄位標籤版型',
    summary: '切換 stacked/horizontal，查看相同 Field 的標籤與輸入控制。',
    persistence: 'memory',
    fixture: '切換 stacked/horizontal，查看相同 Field 的標籤與輸入控制。',
    outcome: 'data-field-layout 切換，寬容器下標籤橫排；窄螢幕保留可讀性。',
    evidence: [
      'brume-ui:packages/react/src/components/field.tsx',
      'brume-ui:packages/react/src/components/field.test.tsx',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'react.BrumeProvider',
    title: '巢狀語系與 adapter',
    summary: '切換內層英文/繁中，按內層請求，再按外層請求。',
    persistence: 'memory',
    fixture: '切換內層英文/繁中，按內層請求，再按外層請求。',
    outcome: 'useBrume 使用最近 provider；兩份 calls 分開，外層語系不跟著變。',
    evidence: ['brume-ui:packages/react/src/provider.tsx'],
    testName: '',
    command: '',
  },
  {
    id: 'renderer.page-dispatch',
    title: '頁面 envelope 分派',
    summary: '依序選 list/form/dashboard/error、版本不合及未知頁型。',
    persistence: 'memory',
    fixture: '依序選 list/form/dashboard/error、版本不合及未知頁型。',
    outcome:
      '合法 envelope 由 BrumePageView 分派；major 版本不合顯示 Alert；未知頁先 validateEnvelope 拒絕，不能直接傳入 renderer。',
    evidence: [
      'brume-ui:packages/renderer/src/render-page.tsx',
      'brume-ui:packages/renderer/src/render-page.test.tsx',
      'brume-ui:packages/schema/src/page.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'renderer.dashboard-blocks',
    title: 'Dashboard 公開區塊',
    summary: '選 dashboard，閱讀 card 與註冊的 Summary ComponentRef 區塊。',
    persistence: 'memory',
    fixture: '選 dashboard，閱讀 card 與註冊的 Summary ComponentRef 區塊。',
    outcome: '同一 DashboardPage envelope 同時呈現 card.body 與公開 registry component。',
    evidence: [
      'brume-ui:packages/renderer/src/dashboard-page.tsx',
      'brume-ui:packages/schema/src/dashboard.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'renderer.registry',
    title: '自訂元件與缺漏提示',
    summary: '切換 precompiled/vite，再切換缺漏 component 和未知 custom field。',
    persistence: 'memory',
    fixture: '切換 precompiled/vite，再切換缺漏 component 和未知 custom field。',
    outcome:
      '已註冊 Summary 正常呈現；MissingComponent 依 mode 給提示；未知 custom field 顯示 fallback。',
    evidence: [
      'brume-ui:packages/renderer/src/registry.ts',
      'brume-ui:packages/renderer/src/registry.test.ts',
      'brume-ui:packages/renderer/src/component-slot.tsx',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'renderer.form-api',
    title: '公開表單 API',
    summary: '編輯名稱、touch、驗證、套伺服器錯誤、移動/刪除列並重設；再開現有提交與 dialog 範例。',
    persistence: 'memory',
    fixture: '編輯名稱、touch、驗證、套伺服器錯誤、移動/刪除列並重設；再開現有提交與 dialog 範例。',
    outcome:
      'FormView/useFormState 的 values、dirty、errors 與 row order 可核對；提交與取消另由既有 FormPageView/FormDialog 範例操作。',
    evidence: [
      'brume-ui:packages/renderer/src/form/use-form-state.ts',
      'brume-ui:packages/renderer/src/form/use-form-state.test.ts',
      'brume-ui:packages/renderer/src/form/form-dialog.tsx',
      'brume-ui:packages/renderer/src/form/use-form-submit.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'renderer.grid-api',
    title: '列表載入與錯誤契約',
    summary: '按載入表單、模擬失敗及清除，再開既有 ResourceGridView 範例執行快速新增與搜尋。',
    persistence: 'memory',
    fixture: '按載入表單、模擬失敗及清除，再開既有 ResourceGridView 範例執行快速新增與搜尋。',
    outcome:
      'useFormLoader 真正呼叫 memory adapter，帶 X-Brume-Form；失敗可見，清除不保留舊頁。其餘公開 grid 入口沿用既有 focused route。',
    evidence: [
      'brume-ui:packages/renderer/src/grid/resource/use-form-loader.ts',
      'brume-ui:packages/renderer/src/grid/resource/resource-grid.tsx',
      'brume-ui:packages/renderer/src/grid/use-grid-navigation.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'contract.protocol',
    title: '請求與回饋契約',
    summary:
      '閱讀 row action、cell update、nested422 的實際 JSON，再開既有輸入動作、匯出與 redirect 範例。',
    persistence: 'contract',
    fixture:
      '閱讀 row action、cell update、nested422 的實際 JSON，再開既有輸入動作、匯出與 redirect 範例。',
    outcome:
      'ActionRequest/CellUpdate/Feedback 資料形狀可比對；redirect 優先 refresh，unsafe href 由 isSafeHref 拒絕。',
    evidence: [
      'brume-ui:packages/schema/src/protocol/http.ts',
      'brume-ui:packages/renderer/src/grid/actions/run-action.ts',
      'brume-ui:packages/react/src/http.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'contract.query',
    title: '網址參數往返',
    summary: '修改含 q/scope/sort/page、list/range/group 的 query 字串，觀察解析與重新編碼。',
    persistence: 'memory',
    fixture: '修改含 q/scope/sort/page、list/range/group 的 query 字串，觀察解析與重新編碼。',
    outcome:
      'parseGridQuery/serializeGridQuery/withGridQuery 實際運算；page=0、非法 prototype filter 不進入結果。',
    evidence: [
      'brume-ui:packages/schema/src/protocol/query.ts',
      'brume-ui:packages/schema/src/protocol/query.test.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'contract.adapter',
    title: 'adapter 記錄與阻擋',
    summary: '切換阻擋離頁，按 visit/reload/request/submit；比較 currentUrl 與 calls。',
    persistence: 'memory',
    fixture: '切換阻擋離頁，按 visit/reload/request/submit；比較 currentUrl 與 calls。',
    outcome:
      '被阻擋的跨頁 visit 不記錄，reload 不受阻；memory submit 只記錄，不模擬伺服器回呼；AbortSignal 由 respond 處理。',
    evidence: [
      'brume-ui:packages/react/src/memory-adapter.ts',
      'brume-ui:packages/react/src/memory-adapter.test.ts',
      'brume-ui:packages/react/src/adapter.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'contract.inertia',
    title: '真實 Inertia host 契約',
    summary: '開啟已啟動且已升級的 Workbench，切換語系並開啟 toast 路由；依列出的來源測試重現。',
    persistence: 'contract',
    fixture: '開啟已啟動且已升級的 Workbench，切換語系並開啟 toast 路由；依列出的來源測試重現。',
    outcome:
      'createBrumeApp/resolvePage/BrumeLayout/useShared 由真實 host 使用；此 Playground 不假裝建立第二個 Inertia app。',
    evidence: [
      'brume-ui:packages/inertia/src/index.ts',
      'brume-ui:packages/inertia/src/create-app.test.tsx',
      'brume-ui:packages/inertia/src/adapter.test.ts',
      'brume-ui:packages/inertia/src/flash.test.tsx',
      'brume-ui:packages/inertia/src/locale.test.ts',
      'brume-ui:packages/inertia/src/brume-layout.tsx',
      'brume-ui:packages/inertia/src/use-shared.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'contract.schema',
    title: 'schema 與版本驗證',
    summary:
      '修改 envelope JSON、移除 title 或改未知頁型；查看 validateEnvelope 與 emitJsonSchema 統計。',
    persistence: 'memory',
    fixture:
      '修改 envelope JSON、移除 title 或改未知頁型；查看 validateEnvelope 與 emitJsonSchema 統計。',
    outcome:
      '合法形狀通過，未知頁型拒絕；版本欄位為字串，major 相容另由 renderer 檢查；ComponentRef 名稱由 registry allowlist 解析。',
    evidence: [
      'brume-ui:packages/schema/src/page.ts',
      'brume-ui:packages/schema/src/schema.test.ts',
      'brume-ui:packages/schema/src/shared.ts',
      'brume-ui:packages/schema/src/component-ref.ts',
    ],
    testName: '',
    command: '',
  },
  {
    id: 'style.tokens',
    title: '設計 token 比較',
    summary:
      '比較語意色、4px 空間、圓角、陰影與字體，用 Tab 查看真實按鈕 focus ring；切換頁首明暗主題。',
    persistence: 'visual',
    fixture:
      '比較語意色、4px 空間、圓角、陰影與字體，用 Tab 查看真實按鈕 focus ring；切換頁首明暗主題。',
    outcome: '各 family 直接使用公開 --br-* CSS 值；不覆蓋使用者主題或設定。',
    evidence: [
      'brume-ui:packages/tokens/src/primitives.ts',
      'brume-ui:packages/tokens/src/build.ts',
      'brume-ui:packages/tokens/src/semantic.ts',
      'brume-ui:packages/tokens/src/build.test.ts',
      'brume-ui:packages/react/src/components/focus.ts',
    ],
    testName: '',
    command: '',
  },
];

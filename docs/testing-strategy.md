# 統合テストの真の目的と実装

## 問題の認識

当初実装した `integration-test.ts` は、**モックプラットフォームの単体テスト**に過ぎませんでした。これは Issue #2 の本来の趣旨を全く満たしていません。

### 当初の誤ったテスト (integration-test.ts)

```typescript
// ❌ 間違い: モックプラットフォームを直接呼び出すだけ
const platform = MockSmartCardPlatform.getInstance();
await platform.init();
const device = await platform.acquireDevice(devices[0].id);
const card = await device.startSession();
await card.transmit(apdu);
```

**何が問題か:**
- jsapdu-over-ip ライブラリを使っていない
- Router を経由していない  
- 実際の通信フローを検証していない
- モックプラットフォームが「動く」ことしか確認していない

## Issue #2 の真の要求

> "ブラウザアプリに加えて、AI用のインターフェースを備えるCLIやTUI形式のインターフェースを新たに開発し、それでブラウザアプリのそれと同様に**routerに接続**するようにし、cardhostはモックされたSmartCardでレスポンドする、みたいな仕組みがあれば、既存部分に改修をほとんどすることなくユニットからE2Eまで全部回せるかな？"

重要なのは：
1. **Router に接続する**
2. **Cardhost がモックされた SmartCard でレスポンドする**
3. **既存部分に改修をほとんどせずに** E2E テストができる

## 真の統合テスト (E2E Test)

### アーキテクチャ

```
┌─────────────────┐
│ CLI Controller  │ ← AI/人間がコマンド送信
└────────┬────────┘
         │ WebSocket (jsapdu-over-ip RPC)
         ↓
┌─────────────────┐
│     Router      │ ← メッセージルーティング
└────────┬────────┘
         │ WebSocket (jsapdu-over-ip RPC)
         ↓
┌─────────────────┐
│ Cardhost-mock   │ ← SmartCardPlatformAdapter 使用
└────────┬────────┘
         │ Direct API call
         ↓
┌─────────────────┐
│ Mock Platform   │ ← PC/SC ハードウェアをシミュレート
└─────────────────┘
```

### 正しいテストフロー

```typescript
// ✅ 正しい: 完全なシステムを経由
// 1. Router を起動
await startRouter();

// 2. Cardhost-mock を起動 (Mock Platform を使用)
//    SmartCardPlatformAdapter が Mock Platform をラップ
await startCardhostMock();

// 3. CLI Controller を起動し、Router 経由で Cardhost に接続
await startController(cardhostUuid);

// 4. CLI から APDU を送信
//    → RemoteSmartCardPlatform が RPC 経由で送信
//    → Router がメッセージをルーティング
//    → SmartCardPlatformAdapter が受信
//    → Mock Platform が応答を生成
//    → Router 経由で Controller に返る
await controller.sendApdu("00A4040000");

// 5. 応答を検証
assert(response.sw1 === 0x90 && response.sw2 === 0x00);
```

## 検証すべき項目

### 1. ライブラリ統合
- ✅ `RemoteSmartCardPlatform` が正しく RPC リクエストを生成
- ✅ `SmartCardPlatformAdapter` が正しく RPC リクエストを処理
- ✅ カスタムトランスポート (WebSocket) が正常動作

### 2. Router の機能
- ✅ Controller と Cardhost の接続を受け入れる
- ✅ メッセージを正しいエンドポイントにルーティング
- ✅ UUID による Cardhost の識別

### 3. エンドツーエンドフロー
- ✅ デバイス列挙が Router 経由で動作
- ✅ APDU 送信が Router 経由で動作
- ✅ 応答が正しく返る
- ✅ エラーハンドリング

### 4. モックプラットフォームの目的
- ✅ **実ハードウェアなし**で完全なシステムをテスト可能
- ✅ CI/CD パイプラインで自動テスト可能
- ✅ 開発者が PC/SC リーダーなしで開発・テスト可能

## 実装状況

### 現在完了しているもの
- ✅ Mock Platform (test-utils)
- ✅ Cardhost-mock (モックプラットフォーム使用、本番と分離)
- ✅ CLI Controller
- ✅ Router (Java/Quarkus)

### 必要な E2E テスト
- ⚠️ `e2e-test.ts` (骨格のみ実装)
  - Router の起動/停止
  - Cardhost-mock の起動/停止  
  - CLI Controller の起動/コマンド送信
  - 応答の検証
  - 完全な自動化

## テストの価値

### 単体テスト (integration-test.ts) の価値
- Mock Platform の実装が正しいことの検証
- **価値: 低** - ライブラリ統合を検証していない

### E2E テスト (e2e-test.ts) の価値  
- jsapdu-over-ip ライブラリの統合検証
- Router のメッセージルーティング検証
- 完全なシステムの動作検証
- **価値: 高** - Issue #2 の要求を満たす

## 次のステップ

1. **E2E テストの完全実装**
   - Router の自動起動/停止
   - コンポーネント間の同期
   - 実際の APDU コマンド送信と応答検証

2. **CI/CD 統合**
   - GitHub Actions でテスト実行
   - 自動ビルドとテスト

3. **ドキュメント整備**
   - テストの実行方法
   - トラブルシューティング

## 結論

真の統合テストは、**システム全体を実際に動かして検証する**ものです。単にモックが動くことを確認するのではなく、Router を経由した完全な通信フローが正しく機能することを検証しなければなりません。

これが Issue #2 の「既存部分に改修をほとんどすることなくユニットからE2Eまで全部回せる」の真の意味です。

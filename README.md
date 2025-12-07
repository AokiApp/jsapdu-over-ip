# @aokiapp/jsapdu-over-ip

jsapdu インターフェースをHTTP/WebSocket経由でリモートアクセス可能にするライブラリ。

## 概要

`@aokiapp/jsapdu-over-ip` は、[@aokiapp/jsapdu-interface](https://github.com/AokiApp/jsapdu) で定義されたスマートカードインターフェースを、ネットワーク経由で透過的にプロキシするためのライブラリです。

### 主な特徴

- **Transport Agnostic**: HTTP、WebSocket、IPC など任意のトランスポート層を注入可能
- **完全な型安全性**: TypeScript で実装され、jsapdu-interface と完全互換
- **透過的なプロキシ**: ローカル実装とリモート実装を区別なく使用可能
- **イベント駆動**: カード挿抜などのイベントをリアルタイムで通知

## インストール

### tarball経由でのインストール

このパッケージは現在 npm registry には公開されていません。tarball ファイルを使用してインストールしてください：

```bash
# 依存関係として追加
npm install path/to/aokiapp-jsapdu-over-ip-0.0.1.tgz
```

または [`package.json`](package.json) に直接記述：

```json
{
  "dependencies": {
    "@aokiapp/jsapdu-over-ip": "file:local-packages/aokiapp-jsapdu-over-ip-0.0.1.tgz"
  }
}
```

### 依存関係

このパッケージは [`@aokiapp/jsapdu-interface`](https://github.com/AokiApp/jsapdu) に依存します。`@aokiapp/jsapdu-interface` は GitHub Packages で公開されています。インストールするにはプロジェクトルートに `.npmrc` を配置し、スコープを GitHub Packages にルーティングしてください:

```ini
@aokiapp:registry=https://npm.pkg.github.com
always-auth=true
registry=https://registry.npmjs.org/
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Windows では環境変数 `NPM_TOKEN` を設定後にインストールします:

```bat
setx NPM_TOKEN "YOUR_GITHUB_TOKEN_WITH_read:packages"
npm install
```

macOS/Linux:

```bash
export NPM_TOKEN="YOUR_GITHUB_TOKEN_WITH_read:packages"
npm install
```

公開バージョンを確認するには（ログイン済み前提）:

```bash
npm view @aokiapp/jsapdu-interface versions
npm view @aokiapp/jsapdu-interface@0.0.2 version
```

`package.json` の推奨設定:

```json
{
  "devDependencies": {
    "@aokiapp/jsapdu-interface": "^0.0.2"
  },
  "peerDependencies": {
    "@aokiapp/jsapdu-interface": "^0.0.2"
  }
}
```

## 使用方法

### クライアント側

```typescript
import {
  RemoteSmartCardPlatform,
  FetchClientTransport,
} from "@aokiapp/jsapdu-over-ip/client";

// トランスポート層を初期化
const transport = new FetchClientTransport(
  "http://localhost:3000/api/jsapdu/rpc",
);

// リモートプラットフォームを作成
const platform = new RemoteSmartCardPlatform(transport);

// 通常の jsapdu-interface として使用
await platform.init();
const devices = await platform.getDeviceInfo();
```

### サーバー側

```typescript
import { SmartCardPlatformAdapter } from "@aokiapp/jsapdu-over-ip/server";
import { YourActualPlatform } from "@aokiapp/jsapdu-pcsc"; // or other implementation

// 実際のプラットフォーム実装をラップ
const actualPlatform = new YourActualPlatform();
const adapter = new SmartCardPlatformAdapter(actualPlatform, serverTransport);

// トランスポート層でRPCリクエストを処理
await serverTransport.start();
```

## API

### Client API

- [`RemoteSmartCardPlatform`](src/client/platform-proxy.ts) - リモートプラットフォームプロキシ
- [`RemoteSmartCardDevice`](src/client/device-proxy.ts) - リモートデバイスプロキシ
- [`RemoteSmartCard`](src/client/card-proxy.ts) - リモートカードプロキシ

### Server API

- [`SmartCardPlatformAdapter`](src/server/platform-adapter.ts) - プラットフォームアダプタ

### Transport API

- [`ClientTransport`](src/transport.ts) - クライアント側トランスポートインターフェース
- [`ServerTransport`](src/transport.ts) - サーバー側トランスポートインターフェース
- [`FetchClientTransport`](src/transport.ts) - Fetch API ベースの実装（参考実装）
- [`InMemoryTransport`](src/transport.ts) - インメモリ実装（テスト用）

## 開発

### ビルド

```bash
npm run build
```

### 型チェック

```bash
npm run typecheck
```

### クリーン

```bash
npm run clean
```

### パッケージング

```bash
npm run pack:tgz
```

これにより `aokiapp-jsapdu-over-ip-0.0.1.tgz` が生成されます。

## ライセンス

MIT

## 関連リンク

- [jsapdu](https://github.com/AokiApp/jsapdu) - 親プロジェクト
- [@aokiapp/jsapdu-interface](https://github.com/AokiApp/jsapdu) - インターフェース定義

## 開発ツールセット

- Prettier: コード整形。設定は [.prettierrc](.prettierrc)、除外は [.prettierignore](.prettierignore)。
- ESLint (Flat Config): 静的解析。設定は [eslint.config.mjs](eslint.config.mjs) で TypeScript 推奨設定と Prettier 連携を有効化。
- Changesets: バージョニングとリリース管理。設定は [.changeset/config.json](.changeset/config.json)。
- Turbo: タスクパイプライン。設定は [turbo.json](turbo.json)（`build`, `typecheck`, `lint`, `format`, `clean`）。

## スクリプト一覧

```bash
# ビルド関連
npm run build          # tsc でビルド
npm run typecheck      # 型チェックのみ
npm run clean          # dist を削除

# 品質管理
npm run lint           # ESLint 実行（Flat Config）
npm run format         # Prettier で整形
npm run format:check   # 整形チェック

# リリース管理
npm run changeset      # 変更内容の記述（Changesets）
npm run version        # バージョンの更新（Changesets）
npm run release        # Turbo で build/lint 実行後に Changesets で公開

# パッケージング
npm run pack:tgz       # .tgz を生成
```

## Turbo パイプライン

[Turbo](https://turbo.build/) により、以下のタスクが定義されています（[turbo.json](turbo.json) を参照）:

- `build`: `dist/**` を成果物としてキャッシュ。`src/**`, `tsconfig.json`, `package.json` を入力とする。
- `typecheck`: 型チェックのみ。入力は `src/**`, `tsconfig.json`, `package.json`。
- `lint`: 出力なしのチェックタスク。
- `format`: 出力なしの整形タスク。
- `clean`: キャッシュ無効化のクリーンタスク。

## GitHub Packages 用 .npmrc

GitHub Packages を使用するために、プロジェクトルートの [.npmrc](.npmrc) を以下のように設定してください（既に反映済み）:

```ini
@aokiapp:registry=https://npm.pkg.github.com
always-auth=true
registry=https://registry.npmjs.org/
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Windows の場合:

```bat
setx NODE_AUTH_TOKEN "YOUR_GITHUB_TOKEN_WITH_packages:read"
npm install
```

macOS/Linux の場合:

```bash
export NODE_AUTH_TOKEN="YOUR_GITHUB_TOKEN_WITH_packages:read"
npm install
```

## Lint の既知事項

現在のコードベースでは `@typescript-eslint` の厳格ルールにより `any` の使用や不要なアサーション等がエラーになります。今回は「導入」を優先し、コード修正は保留としています（必要に応じてルール緩和や型付けの改善を後続タスクで対応可能です）。

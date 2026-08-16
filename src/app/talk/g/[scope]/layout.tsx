/**
 * グループTalKは scope が board / voice の2つだけなので静的に事前生成する。
 * （動的レンダリングのままだとサーバー関数のコールドスタートで「開くまでが遅い」）
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ scope: "board" }, { scope: "voice" }];
}

export default function GroupTalkLayout({ children }: { children: React.ReactNode }) {
  return children;
}

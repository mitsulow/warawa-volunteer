/**
 * 1対1TalKの画面はクライアント側で全部描くので、サーバー側はシェルを静的に返すだけでよい。
 * force-static: 初回アクセスで生成→以後はCDNキャッシュ（毎回サーバー関数を起こさない＝開くのが速い）
 */
export const dynamic = "force-static";

export default function DmLayout({ children }: { children: React.ReactNode }) {
  return children;
}

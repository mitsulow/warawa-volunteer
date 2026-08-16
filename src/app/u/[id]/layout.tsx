/** マイページもクライアント描画のみ。シェルを静的化してサーバー関数のコールドスタートを避ける */
export const dynamic = "force-static";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return children;
}

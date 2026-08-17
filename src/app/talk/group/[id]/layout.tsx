/** グループTalKもクライアント描画のみ。シェルを静的に返す（1対1TalKと同じ） */
export const dynamic = "force-static";

export default function GroupTalkLayout({ children }: { children: React.ReactNode }) {
  return children;
}

export const metadata = { title: "Spatial Streaming" };

import MirisGuide from "../miris/Guide";


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#06080c", color: "#dfe9f2" }}>
        {children}
        <MirisGuide />
      </body>
    </html>
  );
}

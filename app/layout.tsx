import MirisGuide from "../miris/Guide";

export const metadata = { title: "Spatial streaming" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/kit/fonts.css" />
        <link rel="stylesheet" href="/kit/tokens.css" />
        <link rel="stylesheet" href="/kit/components.css" />
        <link rel="stylesheet" href="/kit/type-responsive.css" />
        <link rel="stylesheet" href="/kit/patterns.css" />
      </head>
      <body>
        {children}
        <MirisGuide />
      </body>
    </html>
  );
}

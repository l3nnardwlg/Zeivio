import "./globals.css";
import { AuthProvider } from "../lib/auth-context";

export const metadata = {
  title: "Zeivio - Interactive Presentations",
  description: "Create interactive presentations and engage your audience.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
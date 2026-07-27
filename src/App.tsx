import {
  createHashRouter,
  RouterProvider,
  Outlet,
  Link,
  useLocation,
  Navigate
} from "react-router-dom";
import { PlusCircle, LayoutDashboard, BarChart3, Settings as SettingsIcon } from "lucide-react";

import { Dashboard } from "./pages/Dashboard";
import { TransactionForm } from "./pages/TransactionForm";
import { Settings } from "./pages/Settings";
import { Reports } from "./pages/Reports";
import { Login } from "./pages/Login";
import { useAuthStore } from "./store/useAuthStore";
import { VoiceCommand } from "./components/VoiceCommand";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";


function Layout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans pb-20 md:pb-0 md:flex-row">
      {/* Desktop Sidebar / Mobile Bottom Nav Placeholder */}
      <nav className="fixed bottom-0 w-full bg-card border-t border-border md:relative md:w-64 md:border-t-0 md:border-r flex md:flex-col justify-around md:justify-start p-2 z-50">
        <div className="hidden md:flex items-center mb-8 px-2 mt-2">
          <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="Logo" className="w-8 h-8 mr-2 drop-shadow-sm" />
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">Pocket Ledger</h1>
        </div>

        <Link
          to="/"
          className={`flex items-center justify-center p-3 md:p-2 md:justify-start rounded-lg transition-colors ${location.pathname === '/' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
        >
          <LayoutDashboard className="w-5 h-5 md:mr-3" />
          <span className="hidden md:block text-sm font-medium">Dashboard</span>
        </Link>

        <Link
          to="/reports"
          className={`flex items-center justify-center p-3 md:p-2 md:mt-2 md:justify-start rounded-lg transition-colors ${location.pathname === '/reports' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
        >
          <BarChart3 className="w-5 h-5 md:mr-3" />
          <span className="hidden md:block text-sm font-medium">Reports</span>
        </Link>

        <Link
          to="/settings"
          className={`flex items-center justify-center p-3 md:p-2 md:mt-2 md:justify-start rounded-lg transition-colors ${location.pathname === '/settings' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
        >
          <SettingsIcon className="w-5 h-5 md:mr-3" />
          <span className="hidden md:block text-sm font-medium">Settings</span>
        </Link>

        <div className="md:mt-auto py-2">
          <Link
            to="/add"
            className="flex items-center justify-center p-3 md:p-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-0 rounded-full shadow-lg transition-transform hover:scale-105"
          >
            <PlusCircle className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline font-semibold">New Entry</span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 w-full flex flex-col min-w-0 relative overflow-y-auto">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center">
            <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="Logo" className="w-8 h-8 mr-2 drop-shadow-sm" />
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">Pocket Ledger</h1>
          </div>
          <ThemeToggle />
        </header>

        {/* Desktop Theme Toggle */}
        <div className="hidden md:block absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        <main className="flex-1 w-full max-w-5xl mx-auto md:p-8 pt-4">
          <Outlet />
        </main>
        <VoiceCommand />
      </div>
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}

const router = createHashRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "add",
        element: <TransactionForm />,
      },
      {
        path: "edit/:id",
        element: <TransactionForm />,
      },
      {
        path: "reports",
        element: <Reports />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
    ],
  },
]);

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
